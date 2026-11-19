import {createConnection} from 'node:net';
import {bandOf} from './cat.js';

const callPattern=/^[A-Z0-9]{3,12}(?:\/[A-Z0-9]{1,8}){0,2}$/;
const loginPrompt=/\b(?:login|callsign|call sign|your call)\s*[:>]/i;
const cleanTelnet=chunk=>chunk.replace(/\xff[\xfb-\xfe][\x00-\xff]/g,'').replace(/\x07/g,'');
const dxSpiderPrompt=(text,call)=>text.toUpperCase().includes(call+' DE ')&&/dxspider\s*>/i.test(text);
const retention=60*60000;

export function parseClusterSpot(line,source,now=Date.now()){
 const m=/^DX de\s+([A-Z0-9/-]+(?:#)?):\s+(\d+(?:\.\d+)?)\s+([A-Z0-9/]+)\s+(?:(.*?)\s+)?(\d{2})(\d{2})Z(?:\s|$)/i.exec(line);
 if(!m||+m[5]>23||+m[6]>59)return null;
 let time=Math.floor(now/86400000)*86400000+(+m[5]*60 + +m[6])*60000;
 if(time>now+60000)time-=86400000;
 const comment=(m[4]||'').trim();
 const cw=source==='RBN'?/^CW\s/i.test(comment):/\bCW(?:-[ULR])?\b/i.test(comment)&&!/\b(?:SSB|USB|LSB|FT[248]|RTTY|PSK\d*|FM|AM)\b/i.test(comment);
 return {cw,by:m[1].toUpperCase().replace(/-#$/,''),hz:Math.round(+m[2]*1000),call:m[3].toUpperCase(),comment,source:source==='RBN'||/\b\d+\s*dB\s+\d+\s*WPM\b/i.test(comment)?'RBN':source,time};
}

export function createSpotService({env=process.env,connect=createConnection,clock=Date.now}={}){
 const station=String(env.SACW_SPOT_CALL||'').toUpperCase(),validStation=callPattern.test(station);
 const entries=[],feeds=[];
 const endpoint=value=>{
  const match=/^([a-z0-9.-]+):(\d{1,5})$/i.exec(value||'');
  return match&&+match[2]>0&&+match[2]<=65535?[match[1].toLowerCase(),+match[2]]:null;
 };
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
  list(call,band){
   const current=entries.filter(row=>row.time>=clock()-retention).sort((a,b)=>b.time-a.time);
   const station=callPattern.test(call||'')?call:'';
   return {
    feeds:feeds.map(feed=>({source:feed.source,ready:feed.ready})),
    cluster:current.filter(row=>row.cw&&bandOf(row.hz)===band).slice(0,50),
    received:station?current.filter(row=>row.call===station&&row.by!==station).slice(0,30):[]
   };
  },
  close(){closed=true;for(const feed of feeds){clearTimeout(feed.retry);feed.socket?.destroy();}}
 };
}
