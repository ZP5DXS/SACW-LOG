import {createHamlibService} from './hamlib-service.js';
import {createSpotService} from './spot-service.js';
import http from 'node:http';import {readFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {createQRZService} from './qrz-service.js';
const port=Number(process.env.SACW_PORT||8791),types={html:'text/html; charset=utf-8',js:'text/javascript',css:'text/css',svg:'image/svg+xml',webmanifest:'application/manifest+json'},qrz=createQRZService();
export function createServer(){const spots=createSpotService(),hamlib=createHamlibService();const server=http.createServer(async(req,res)=>{
 const reply=(code,data)=>res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(data));
 try{
  const host=req.headers.host||'';if(!/^(?:127\.0\.0\.1|localhost):\d+$/.test(host))return reply(403,{error:'HOST'});
  if(req.headers.origin&&req.headers.origin!=='http://'+host)return reply(403,{error:'ORIGIN'});
  const url=new URL(req.url,'http://'+host),name=url.pathname.slice(1)||'index.html';
  if(name==='api/hamlib'){
   if(req.method!=='POST')return reply(405,{error:'METHOD'});
   if(req.headers.origin!=='http://'+host)return reply(403,{error:'ORIGIN'});
   if(!(req.headers['content-type']||'').startsWith('application/json'))return reply(415,{error:'CONTENT_TYPE'});
   let raw='';
   for await(const chunk of req){raw+=chunk;if(raw.length>1024)return reply(413,{error:'BODY_LIMIT'});}
   return reply(200,await hamlib(JSON.parse(raw)));
  }
  if(name==='api/spots'){
   if(req.method!=='GET')return reply(405,{error:'METHOD'});
   const local=()=>spots.list(url.searchParams.get('call'),url.searchParams.get('band'));
   if(process.env.SACW_SPOT_CALL||!process.env.SACW_LIVE_UPSTREAM)return reply(200,local());
   const upstream=new URL('api/spots'+url.search,process.env.SACW_LIVE_UPSTREAM.replace(/\/?$/,'/'));
   try{
    const remote=await fetch(upstream,{signal:AbortSignal.timeout(7000)});
    return remote.ok?reply(200,await remote.json()):reply(503,{error:'SPOT_OFFLINE'});
   }catch{return reply(503,{error:'SPOT_OFFLINE'});}
  }
  if(name==='health')return reply(200,{app:'sacw-web',version:'2.1.4',root:fileURLToPath(new URL('.',import.meta.url)).replace(/[\\/]$/,'')});
  if(name==='api/sync'||name==='api/live/events'){
   const upstream=new URL(url.pathname.replace(/^\/+/,'')+url.search,(process.env.SACW_LIVE_UPSTREAM||'http://127.0.0.1:18791/').replace(/\/?$/,'/'));
   if(name==='api/live/events'){const controller=new AbortController();res.on('close',()=>controller.abort());const remote=await fetch(upstream,{signal:controller.signal});if(!remote.ok)return reply(503,{error:'LIVE_OFFLINE'});res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','X-Accel-Buffering':'no'});try{for await(const chunk of remote.body)res.write(chunk);}catch{}res.end();return;}
   if(req.method!=='POST'||!(req.headers['content-type']||'').startsWith('application/json'))return reply(415,{error:'CONTENT_TYPE'});let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>12000000)return reply(413,{error:'BODY_LIMIT'});}try{const remote=await fetch(upstream,{method:'POST',headers:{'Content-Type':'application/json'},body:raw,signal:AbortSignal.timeout(8000)});return reply(remote.status,await remote.json());}catch{return reply(503,{error:'LIVE_OFFLINE'});}
  }
  if(name.startsWith('api/qrz/')){let raw='';if(req.method==='POST'){if(!(req.headers['content-type']||'').startsWith('application/json'))return reply(415,{error:'CONTENT_TYPE'});for await(const chunk of req){raw+=chunk;if(raw.length>64000)return reply(413,{error:'BODY_LIMIT'});}}const body=raw?JSON.parse(raw):{};const data=await qrz({path:url.pathname,method:req.method,query:Object.fromEntries(url.searchParams),body,authorization:req.headers.authorization||''});return reply(200,data);}
  if(req.method!=='GET'||!['index.html','sw.js','manifest.webmanifest','icon.svg'].includes(name))return reply(404,{error:'NOT_FOUND'});
  const data=await readFile(new URL(name,import.meta.url));res.writeHead(200,{'Content-Type':types[name.split('.').at(-1)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}).end(data);
 }catch(e){reply(400,{error:/^(QRZ_|CAT_)/.test(e.message)?e.message:'REQUEST_FAILED'});}
});server.on('close',()=>spots.close());return server;}
if(process.argv[1]&&fileURLToPath(import.meta.url).toLowerCase()===process.argv[1].toLowerCase())createServer().on('error',e=>{console.error(e.code==='EADDRINUSE'?'SACW: el puerto '+port+' ya estÃƒÂ¡ ocupado.':e.message);process.exitCode=1;}).listen(port,'127.0.0.1',()=>console.log('SACW 2.1: http://127.0.0.1:'+port));
