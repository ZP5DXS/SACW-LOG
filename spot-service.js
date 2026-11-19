import {createConnection} from 'node:net';
import {timingSafeEqual} from 'node:crypto';
import {bandOf} from './cat.js';

const callPattern=/^[A-Z0-9]{3,12}(?:\/[A-Z0-9]{1,8}){0,2}$/;
const interval=10*60000;
const retention=60*60000;

export function parseClusterSpot(line,source,now=Date.now()){
 const m=/^DX de\s+([A-Z0-9/-]+(?:#)?):\s+(\d+(?:\.\d+)?)\s+([A-Z0-9/]+)\s+(.*?)\s+(\d{2})(\d{2})Z(?:\s|$)/i.exec(line);
 if(!m||+m[5]>23||+m[6]>59)return null;
 let time=Math.floor(now/86400000)*86400000+(+m[5]*60 + +m[6])*60000;
 if(time>now+60000)time-=86400000;
 return {by:m[1].toUpperCase().replace(/-#$/,''),hz:Math.round(+m[2]*1000),call:m[3].toUpperCase(),comment:m[4].trim(),source:source==='RBN'||/\b\d+\s*dB\s+\d+\s*WPM\b/i.test(m[4])?'RBN':source,time};
}

export function createSpotService({env=process.env,connect=createConnection,clock=Date.now}={}){
 const station=String(env.SACW_SPOT_CALL||'').toUpperCase(),validStation=callPattern.test(station);
 const key=Buffer.from(env.SACW_SPOT_TOKEN||'');
 const entries=[],feeds=[];
 const endpoint=value=>{
  const match=/^([a-z0-9.-]+):(\d{1,5})$/i.exec(value||'');
  return match&&+match[2]>0&&+match[2]<=65535?[match[1].toLowerCase(),+match[2]]:null;
 };
 const publishEndpoint=endpoint(env.SACW_SPOT_NODE);
 const canPublish=validStation&&env.SACW_SPOT_NODE_AUTHORIZED==='1'&&key.length>=24&&!!publishEndpoint;
 let publishFeed;
 let lastSend=-Infinity;

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
    buffer+=chunk.replace(/\xff[\xfb-\xfe][\x00-\xff]/g,'').replace(/\x07/g,'');
    if(!loggedIn&&/\b(?:login|callsign|call sign|your call)\s*[:>]/i.test(buffer)){
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
  const dxfun=addFeed('DXFun','dxfun.com',8000,env.SACW_DXFUN_PASSWORD);
  const rbn=endpoint(env.SACW_RBN_RELAY);
  if(rbn)addFeed('RBN',...rbn);
  if(canPublish){
   const [host,port]=publishEndpoint;
   publishFeed=host===dxfun.host&&port===dxfun.port?dxfun:addFeed('DX Cluster',host,port,env.SACW_SPOT_NODE_PASSWORD);
  }
 }
 return {
  list(call){
   if(!callPattern.test(call||''))return {feeds:[],sent:[],received:[]};
   const current=entries.filter(row=>row.time>=clock()-retention).sort((a,b)=>b.time-a.time);
   return {publishing:canPublish&&call===station?{node:publishEndpoint.join(':'),ready:!!publishFeed?.ready}:null,feeds:feeds.map(feed=>({source:feed.source,ready:feed.ready})),sent:current.filter(row=>row.by===call).slice(0,30),received:current.filter(row=>row.call===call&&row.by!==call).slice(0,30)};
  },
  send(body,auth){
   const provided=Buffer.from(auth||'');
   if(!canPublish)return [503,{error:'SPOT_DISABLED'}];
   if(provided.length!==key.length+7||!provided.subarray(0,7).equals(Buffer.from('Bearer '))||!timingSafeEqual(provided.subarray(7),key)||body?.call!==station)return [403,{error:'SPOT_ACCESS'}];
   if(!Number.isInteger(body.hz)||!bandOf(body.hz))return [400,{error:'SPOT_FREQUENCY'}];
   const feed=publishFeed;
   if(!feed?.ready||!feed.socket?.writable)return [503,{error:'SPOT_OFFLINE'}];
   if(clock()-lastSend<interval)return [429,{error:'SPOT_INTERVAL'}];
   lastSend=clock();
   feed.socket.write('DX '+(body.hz/1000).toFixed(1)+' '+station+' CQ CW\r\n');
   return [202,{queued:true}];
  },
  close(){closed=true;for(const feed of feeds){clearTimeout(feed.retry);feed.socket?.destroy();}}
 };
}
