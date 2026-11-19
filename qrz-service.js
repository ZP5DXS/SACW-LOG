import {randomUUID} from 'node:crypto';
import {xmlValue,parseQRZ} from './lookup.js';
export function createQRZService({fetchImpl=fetch,now=Date.now}={}){
 const sessions=new Map();
 async function xml(params){const url=new URL('https://xmldata.qrz.com/xml/current/');for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);const r=await fetchImpl(url,{signal:AbortSignal.timeout(6500),redirect:'error'});if(!r.ok)throw Error('QRZ_NETWORK');return r.text();}
 async function qrz({path,method,query={},body={},authorization=''}){
  for(const [id,s] of sessions)if(now()>s.expires)sessions.delete(id);
  if(path==='/api/qrz/connect-lookup'&&method==='POST'){
   const username=String(body.username||'').trim(),password=String(body.password||'');if(!username||!password)throw Error('QRZ_CREDENTIALS');
   const data=await xml({username,password,agent:'SACW-Web-ZP5DXS-1.2'}),key=xmlValue(data,'Key');if(!key||xmlValue(data,'Error'))throw Error('QRZ_AUTH');
   const session=randomUUID();sessions.set(session,{key,apiKey:'',kind:'lookup',username:username.toUpperCase(),expires:now()+30*3600000});return {session,lookup:true,upload:false};
  }
  if(path==='/api/qrz/connect-logbook'&&method==='POST'){
   const apiKey=String(body.apiKey||'').trim();if(!apiKey)throw Error('QRZ_API_KEY');const session=randomUUID();sessions.set(session,{key:'',apiKey,kind:'logbook',expires:now()+30*3600000});return {session,lookup:false,upload:true};
  }
  if(path==='/api/qrz/connect'&&method==='POST'){
   const username=String(body.username||'').trim(),password=String(body.password||''),apiKey=String(body.apiKey||'').trim();if(!apiKey&&(!username||!password))throw Error('QRZ_CREDENTIALS');
   let key='';if(username&&password){const data=await xml({username,password,agent:'SACW-Web-ZP5DXS-1.1'});key=xmlValue(data,'Key');if(!key||xmlValue(data,'Error'))throw Error('QRZ_AUTH');}
   const session=randomUUID();sessions.set(session,{key,apiKey,username:key?username.toUpperCase():'',expires:now()+30*3600000});return {session,lookup:!!key,upload:!!apiKey};
  }
  const session=sessions.get(authorization.replace(/^Bearer /i,''));if(!session)throw Error('QRZ_SESSION');
  if(path==='/api/qrz/status'&&method==='GET')return {lookup:!!session.key,upload:!!session.apiKey};
  if(path==='/api/qrz/disconnect'&&method==='POST'){sessions.delete(authorization.replace(/^Bearer /i,''));return {ok:true};}
  if(path==='/api/qrz/lookup'&&method==='GET'){
   if(!session.key)throw Error('QRZ_AUTH');const call=String(query.call||'').toUpperCase();if(!/^[A-Z0-9/]{3,20}$/.test(call))throw Error('QRZ_CALL');const result=parseQRZ(await xml({s:session.key,callsign:call}));return {result};
  }
  if(path==='/api/qrz/upload'&&method==='POST'){
   if(!session.apiKey)throw Error('QRZ_API_KEY');const record=String(body.adif||'').split(/<eoh>/i).at(-1).trim();if(!/<eor>/i.test(record)||record.length>20000)throw Error('QRZ_ADIF');
   const request=new URLSearchParams({KEY:session.apiKey,ACTION:'INSERT',ADIF:record});
   // Intentionally no OPTION=REPLACE: never overwrite confirmed QRZ QSOs.
   const response=await fetchImpl('https://logbook.qrz.com/api',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:request,signal:AbortSignal.timeout(6500),redirect:'error'});if(!response.ok)throw Error('QRZ_NETWORK');const values=new URLSearchParams(await response.text());if(values.get('RESULT')!=='OK')throw Error('QRZ_UPLOAD');return {ok:true,logid:values.get('LOGID')||values.get('LOGIDS')};
  }
  throw Error('QRZ_ROUTE');
 }
 qrz.station=authorization=>{
  const session=sessions.get(String(authorization||'').replace(/^Bearer /i,''));
  return session?.key&&session.expires>now()?session.username||'':'';
 };
 return qrz;
}
