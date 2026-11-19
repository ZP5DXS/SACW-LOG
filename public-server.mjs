import {createSpotService} from './spot-service.js';
import http from 'node:http';import {readFileSync,mkdirSync,existsSync,statSync,createReadStream} from 'node:fs';import {join,resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash,timingSafeEqual} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import {createQRZService} from './qrz-service.js';import {createLiveStore} from './live-store.js';
export function createPublicServer({dataDir=process.env.SACW_DATA_DIR||fileURLToPath(new URL('./data/',import.meta.url)),dbPath=process.env.SACW_DB_PATH,publicOrigin=process.env.SACW_PUBLIC_ORIGIN||'https://zp5dxs.org',allowedOrigins=process.env.SACW_ALLOWED_ORIGINS||'https://zp5dxs.org,https://www.zp5dxs.org,https://zp5dxs.github.io',fetchImpl=fetch,clock=Date.now}={}){
 const base=fileURLToPath(new URL('.',import.meta.url));mkdirSync(dataDir,{recursive:true,mode:0o700});const path=dbPath||join(dataDir,'live.sqlite'),store=createLiveStore({path,cty:readFileSync(join(base,'cty.dat'),'utf8'),now:clock}),auth=new DatabaseSync(path);auth.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS device_access (client TEXT PRIMARY KEY, proof_hash TEXT NOT NULL);');
 const qrz=createQRZService({fetchImpl}),origins=new Set(allowedOrigins.split(',').map(s=>s.trim()).filter(Boolean)),hosts=new Set([...origins].map(s=>new URL(s).host));hosts.add(new URL(publicOrigin).host);const clients=new Set(),limits=new Map();
 function permit(key,max,period){const time=clock();let l=limits.get(key);if(!l||time-l.start>=period){l={start:time,count:0};limits.set(key,l);}if(++l.count>max)return false;if(limits.size>10000)for(const [k,v] of limits)if(time-v.start>600000)limits.delete(k);return true;}
 function authorize(body,ip){if(!/^[-a-zA-Z0-9]{8,80}$/.test(body.clientId||'')||!/^[-a-f0-9]{64,128}$/i.test(body.clientProof||''))throw Error('ACCESS_DEVICE');const hash=createHash('sha256').update(body.clientProof).digest('hex'),old=auth.prepare('SELECT proof_hash FROM device_access WHERE client=?').get(body.clientId);if(old){if(!timingSafeEqual(Buffer.from(old.proof_hash,'hex'),Buffer.from(hash,'hex')))throw Error('ACCESS_DEVICE');}else{if(!permit('register:'+ip,30,600000))throw Error('RATE_LIMIT');auth.prepare('INSERT INTO device_access VALUES (?,?)').run(body.clientId,hash);}if(!permit('sync:'+body.clientId,60,60000))throw Error('RATE_LIMIT');}
 function sendBoard(peer){peer.res.write('data: '+JSON.stringify(store.board(peer.workspace,peer.band,peer.power))+'\n\n');}
 function publish(){for(const peer of clients)try{sendBoard(peer);}catch{clients.delete(peer);}}
 const spots=createSpotService({clock,verifiedStation:qrz.station});
 const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin||'',host=req.headers.host||'',ip=String(req.headers['cf-connecting-ip']||req.headers['x-real-ip']||req.socket.remoteAddress||'').slice(0,100);
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  if(origin&&origins.has(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Vary','Origin');}
  const reply=(code,body)=>{if(res.headersSent)return res.end();res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(body));};
  try{
   if(!hosts.has(host)&&!/^127\.0\.0\.1:\d+$/.test(host)&&!/^localhost:\d+$/.test(host))return reply(403,{error:'HOST'});
   if(origin&&!origins.has(origin))return reply(403,{error:'ORIGIN'});
   if(!permit('ip:'+ip,1200,60000))return reply(429,{error:'RATE_LIMIT'});
   if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'}).end();return;}
   const url=new URL(req.url,'http://'+host),name=url.pathname.slice(1)||'index.html';
  if(name==='api/spots'){
   if(req.method==='GET')return reply(200,spots.list(url.searchParams.get('call')));
   if(req.method!=='POST')return reply(405,{error:'METHOD'});
   if(!(req.headers['content-type']||'').startsWith('application/json'))return reply(415,{error:'CONTENT_TYPE'});
   let raw='';
   for await(const chunk of req){raw+=chunk;if(raw.length>2048)return reply(413,{error:'BODY_LIMIT'});}
   const [code,data]=await spots.send(JSON.parse(raw),req.headers.authorization);
   return reply(code,data);
  }
   if(name==='health')return reply(200,{app:'sacw-log-public',version:'2.1.2',storage:'sqlite'});
   if(name==='api/live/events'&&req.method==='GET'){
    const workspace=url.searchParams.get('workspace')||'demo',band=url.searchParams.get('band')||'ALL',power=url.searchParams.get('power')||'LOW';if(!['official','demo','free'].includes(workspace)||!['ALL','80','40','15','10'].includes(band)||!['LOW','HIGH','QRP'].includes(power))throw Error('SYNC_VALIDATION');if(clients.size>=300)return reply(503,{error:'LIVE_BUSY'});
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});const peer={res,workspace,band,power};clients.add(peer);sendBoard(peer);res.on('close',()=>clients.delete(peer));return;
   }
   if(name.startsWith('api/')){
    let raw='';if(req.method==='POST'){if(!(req.headers['content-type']||'').startsWith('application/json'))return reply(415,{error:'CONTENT_TYPE'});const limit=name==='api/sync'?12000000:64000;for await(const chunk of req){raw+=chunk;if(raw.length>limit)return reply(413,{error:'BODY_LIMIT'});}}
    const body=raw?JSON.parse(raw):{};
    if(name==='api/sync'&&req.method==='POST'){authorize(body,ip);const result=store.sync(body);reply(200,result);publish();return;}
    if(name.startsWith('api/qrz/')){if(name.includes('/connect')&&!permit('qrz-login:'+ip,30,600000))return reply(429,{error:'RATE_LIMIT'});return reply(200,await qrz({path:url.pathname,method:req.method,body,query:Object.fromEntries(url.searchParams),authorization:req.headers.authorization||''}));}
    return reply(404,{error:'NOT_FOUND'});
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return reply(405,{error:'METHOD'});
   if(name==='downloads/SACW-LOG-Portable.exe'){
    const file=join(base,'downloads','SACW-LOG-Portable.exe');if(!existsSync(file))return reply(404,{error:'DOWNLOAD_PENDING'});res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="SACW-LOG-Portable.exe"','Content-Length':statSync(file).size,'Cache-Control':'public, max-age=300'});if(req.method==='HEAD')return res.end();createReadStream(file).pipe(res);return;
   }
   if(!['index.html','sw.js','manifest.webmanifest','icon.svg'].includes(name))return reply(404,{error:'NOT_FOUND'});
   const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',svg:'image/svg+xml',webmanifest:'application/manifest+json'},content=readFileSync(join(base,name));res.writeHead(200,{'Content-Type':mime[name.split('.').at(-1)],'Cache-Control':'no-cache','Content-Length':content.length});res.end(req.method==='HEAD'?undefined:content);
  }catch(e){reply(400,{error:/^(QRZ_|SYNC_|ACCESS_|RATE_)/.test(e.message)?e.message:'REQUEST_FAILED'});}
 });
 const heartbeat=setInterval(()=>{for(const p of clients)try{p.res.write(': heartbeat\n\n');sendBoard(p);}catch{clients.delete(p);}},15000);heartbeat.unref();server.on('close',()=>{spots.close();clearInterval(heartbeat);for(const p of clients)p.res.end();store.close();auth.close();});return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))createPublicServer().listen(Number(process.env.SACW_PUBLIC_PORT||18792),'127.0.0.1',()=>console.log('SACW LOG public service ready'));
