import {createConnection} from 'node:net';
import {timingSafeEqual} from 'node:crypto';
import {bandOf} from './cat.js';

const callPattern=/^[A-Z0-9]{3,12}(?:\/[A-Z0-9]{1,8}){0,2}$/;
const interval=10*60000;
const loginPrompt=/\b(?:login|callsign|call sign|your call)\s*[:>]/i;
const cleanTelnet=chunk=>chunk.replace(/\xff[\xfb-\xfe][\x00-\xff]/g,'').replace(/\x07/g,'');
const dxSpiderPrompt=(text,call)=>text.toUpperCase().includes(call+' DE ')&&/dxspider\s*>/i.test(text);
const retention=60*60000;

export function parseClusterSpot(line,source,now=Date.now()){
 const m=/^DX de\s+([A-Z0-9/-]+(?:#)?):\s+(\d+(?:\.\d+)?)\s+([A-Z0-9/]+)\s+(.*?)\s+(\d{2})(\d{2})Z(?:\s|$)/i.exec(line);
 if(!m||+m[5]>23||+m[6]>59)return null;
 let time=Math.floor(now/86400000)*86400000+(+m[5]*60 + +m[6])*60000;
 if(time>now+60000)time-=86400000;
 return {by:m[1].toUpperCase().replace(/-#$/,''),hz:Math.round(+m[2]*1000),call:m[3].toUpperCase(),comment:m[4].trim(),source:source==='RBN'||/\b\d+\s*dB\s+\d+\s*WPM\b/i.test(m[4])?'RBN':source,time};
}

export function createSpotService({env=process.env,connect=createConnection,clock=Date.now,verifiedStation=()=>''}={}){
 const station=String(env.SACW_SPOT_CALL||'').toUpperCase(),validStation=callPattern.test(station);
 const entries=[],feeds=[];
 const endpoint=value=>{
  const match=/^([a-z0-9.-]+):(\d{1,5})$/i.exec(value||'');
  return match&&+match[2]>0&&+match[2]<=65535?[match[1].toLowerCase(),+match[2]]:null;
 };
 const publishEndpoint=endpoint(env.SACW_SPOT_NODE);
 const supportedNode=!!publishEndpoint&&!/(^|[.])dxfun(?:cluster)?[.]/.test(publishEndpoint[0]);
 const registeredCalls=new Set(String(env.SACW_SPOT_REGISTERED_CALLS||'').toUpperCase().split(/[\s,]+/).filter(call=>callPattern.test(call)));
 const keys=new Map();
 if(station&&env.SACW_SPOT_TOKEN?.length>=24)keys.set(station,env.SACW_SPOT_TOKEN);
 if(env.SACW_SPOT_KEYS){
  try{
   for(const [call,key] of Object.entries(JSON.parse(env.SACW_SPOT_KEYS))){
    if(callPattern.test(call)&&typeof key==='string'&&key.length>=24)keys.set(call,key);
   }
  }catch{}
 }
 const attempts=new Map(),sockets=new Set();
 let previousGlobal=-Infinity;
 const publishing=call=>supportedNode&&callPattern.test(call||'')?{node:publishEndpoint.join(':'),ready:registeredCalls.has(call),accessCode:keys.has(call)&&registeredCalls.has(call)}:null;
 function authorized(call,authorization){
  if(verifiedStation(authorization)===call)return true;
  const key=keys.get(call);
  if(!key||typeof authorization!=='string'||!authorization.startsWith('Bearer '))return false;
  const expected=Buffer.from(key),actual=Buffer.from(authorization.slice(7));
  return expected.length===actual.length&&timingSafeEqual(expected,actual);
 }

 function publish(call,hz){
  return new Promise(resolve=>{
   const [host,port]=publishEndpoint,socket=connect({host,port});
   sockets.add(socket);
   let buffer='',loggedIn=false,sent=false,done=false;
   const finish=(status,data)=>{
    if(done)return;
    done=true;
    clearTimeout(timeout);
    sockets.delete(socket);
    socket.destroy();
    resolve([status,data]);
   };
   const timeout=setTimeout(()=>finish(503,{error:sent?'SPOT_UNCONFIRMED':'SPOT_OFFLINE'}),6500);
   socket.setEncoding('latin1');
   socket.on('error',()=>finish(503,{error:sent?'SPOT_UNCONFIRMED':'SPOT_OFFLINE'}));
   socket.on('close',()=>finish(503,{error:sent?'SPOT_UNCONFIRMED':'SPOT_OFFLINE'}));
   socket.on('data',chunk=>{
    buffer=(buffer+cleanTelnet(chunk)).slice(-8192);
    if(!loggedIn&&loginPrompt.test(buffer)){
     loggedIn=true;
     buffer='';
     socket.write(call+'\r\n');
     return;
    }
    if(!loggedIn)return;
    if(/password\s*:/i.test(buffer))return finish(403,{error:'SPOT_REGISTRATION'});
    if(!sent){
     if(!dxSpiderPrompt(buffer,call))return;
     sent=true;
     buffer='';
     socket.write('DX '+(hz/1000).toFixed(1)+' '+call+' CQ CW\r\n');
     return;
    }
    if(/not registered|must register|only registered|registration required|not (?:allowed|permitted|authori[sz]ed)|permission denied/i.test(buffer))return finish(403,{error:'SPOT_REGISTRATION'});
    for(const line of buffer.split('\n').slice(0,-1)){
     const spot=parseClusterSpot(line.trim(),'DX Cluster',clock());
     if(spot?.by!==call||spot.call!==call||spot.hz!==Math.round(hz/100)*100)continue;
     entries.push(spot);
     return finish(200,{confirmed:true});
    }
    if(/\bspot(?: has been)? (?:added|sent)\b/i.test(buffer))return finish(202,{queued:true});
   });
  });
 }

 function addFeed(source,host,port,password){
  const feed={source,host,port,socket:null,retry:null,ready:false};
  feeds.push(feed);
  function start(){
   const socket=connect({host,port});
   feed.socket=socket;
   let buffer='',loggedIn=false,passwordSent=false;
   socket.setEncoding('latin1');
   socket.setTimeout(180000,()=>socket.destroy());
   socket.on('error',()=>socket.destroy());
   socket.on('close',()=>{
    feed.socket=null;
    feed.ready=false;
    if(!closed){feed.retry=setTimeout(start,30000);feed.retry.unref();}
   });
   socket.on('data',chunk=>{
    buffer+=cleanTelnet(chunk);
    if(!loggedIn&&loginPrompt.test(buffer)){
     loggedIn=true;
     socket.write(station+'\r\n');
    }
    if(loggedIn&&!passwordSent&&/password\s*:/i.test(buffer)&&password&&!/[\r\n]/.test(password)){
     passwordSent=true;
     socket.write(password+'\r\n');
    }
    let end;
    while((end=buffer.indexOf('\n'))>=0){
     const line=buffer.slice(0,end).trim();
     buffer=buffer.slice(end+1);
     const spot=parseClusterSpot(line,source,clock());
     if(dxSpiderPrompt(line,station))feed.ready=true;
     if(!spot)continue;
     feed.ready=true;
     if(!entries.some(row=>row.by===spot.by&&row.call===spot.call&&row.hz===spot.hz&&row.time===spot.time&&row.source===spot.source))entries.push(spot);
     while(entries.length&&(entries.length>25000||entries[0].time<clock()-retention))entries.shift();
    }
    if(buffer.length>8192)buffer='';
   });
  }
  start();
  return feed;
 }
 let closed=false;
 if(validStation){
  addFeed('DXFun','dxfun.com',8000,env.SACW_DXFUN_PASSWORD);
  const rbn=endpoint(env.SACW_RBN_RELAY);
  if(rbn)addFeed('RBN',...rbn);

 }
 return {
  list(call){
   if(!callPattern.test(call||''))return {feeds:[],sent:[],received:[]};
   const current=entries.filter(row=>row.time>=clock()-retention).sort((a,b)=>b.time-a.time);
   return {publishing:publishing(call),feeds:feeds.map(feed=>({source:feed.source,ready:feed.ready})),sent:current.filter(row=>row.by===call).slice(0,30),received:current.filter(row=>row.call===call&&row.by!==call).slice(0,30)};
  },
  publishing,authorized,
  async send(body,auth,registrationConfirmed=false){
   const {call,hz}=body||{};
   const publisher=publishing(call);
   if(!publisher||!publisher.ready&&!registrationConfirmed)return [403,{error:'SPOT_REGISTRATION'}];
   if(!authorized(call,auth))return [403,{error:'SPOT_ACCESS'}];
   if(!Number.isInteger(hz)||!bandOf(hz))return [400,{error:'SPOT_FREQUENCY'}];
   const time=clock();
   for(const [sign,last] of attempts)if(time-last>=interval)attempts.delete(sign);
   if(attempts.has(call))return [429,{error:'SPOT_INTERVAL'}];
   if(time-previousGlobal<3000||sockets.size>=4)return [429,{error:'SPOT_BUSY'}];
   attempts.set(call,time);
   previousGlobal=time;
   return publish(call,hz);
  },
  close(){closed=true;for(const socket of sockets)socket.destroy();for(const feed of feeds){clearTimeout(feed.retry);feed.socket?.destroy();}}
 };
}
