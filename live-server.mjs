import http from 'node:http';import {readFileSync,mkdirSync} from 'node:fs';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {createLiveStore} from './live-store.js';
const base=fileURLToPath(new URL('.',import.meta.url)),data=process.env.SACW_DATA_DIR||join(base,'data');mkdirSync(data,{recursive:true,mode:0o700});
const store=createLiveStore({path:join(data,'live.sqlite'),cty:readFileSync(join(base,'cty.dat'),'utf8')}),peers=new Set();
function publish(){for(const peer of peers){try{peer.res.write('data: '+JSON.stringify(store.board(peer.workspace,peer.band,peer.power))+'\n\n');}catch{peers.delete(peer);}}}
const server=http.createServer(async(req,res)=>{
 const json=(status,body)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(body));
 try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/health')return json(200,{app:'sacw-live-test',version:'1.2.0',storage:'sqlite',scope:'private-ssh'});
 if(url.pathname==='/api/live/events'&&req.method==='GET'){const workspace=url.searchParams.get('workspace')||'demo',band=url.searchParams.get('band')||'ALL',power=url.searchParams.get('power')||'LOW';if(!['official','demo','free'].includes(workspace)||!['ALL','80','40','15','10'].includes(band)||!['LOW','HIGH','QRP'].includes(power))throw Error('SYNC_VALIDATION');res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});const peer={res,workspace,band,power};peers.add(peer);res.write('data: '+JSON.stringify(store.board(workspace,band,power))+'\n\n');req.on('close',()=>peers.delete(peer));return;}
 if(url.pathname==='/api/sync'&&req.method==='POST'){let body='';for await(const chunk of req){body+=chunk;if(body.length>12000000)return json(413,{error:'BODY_LIMIT'});}const result=store.sync(JSON.parse(body));json(200,result);publish();return;}
 return json(404,{error:'NOT_FOUND'});
 }catch(e){json(400,{error:e.message.startsWith('SYNC_')?e.message:'REQUEST_FAILED'});}
});
setInterval(()=>{for(const p of peers)p.res.write(': heartbeat\n\n');publish();},15000).unref();
server.listen(Number(process.env.SACW_LIVE_PORT||18791),'127.0.0.1',()=>console.log('SACW private live service ready'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{for(const p of peers)p.res.end();server.close(()=>{store.close();process.exit();});});
