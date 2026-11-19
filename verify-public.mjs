import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createPublicServer} from './public-server.mjs';
const server=createPublicServer({dataDir:mkdtempSync(join(tmpdir(),'sacw-public-'))});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
try{
 let r=await fetch(url+'/');assert.equal(r.status,200);assert((await r.text()).includes('SACW'));
 r=await fetch(url+'/api/sync',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://hostile.example'},body:'{}'});assert.equal(r.status,403);
 const body={clientId:'public-test-device',clientProof:'a'.repeat(64),station:'ZP5DXS',workspace:'demo',revision:1,settings:{myitu:14,categoryBand:'ALL',categoryPower:'LOW'},rows:[],events:[]};
 const send=value=>fetch(url+'/api/sync',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://zp5dxs.github.io'},body:JSON.stringify(value)});
 r=await send(body);assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://zp5dxs.github.io');assert.equal((await r.json()).categories.length,11);
 r=await send({...body,clientProof:'b'.repeat(64)});assert.equal(r.status,400);assert.equal((await r.json()).error,'ACCESS_DEVICE');
 r=await fetch(url+'/data/live.sqlite');assert.equal(r.status,404);r=await fetch(url+'/api/qrz/status');assert.equal((await r.json()).error,'QRZ_SESSION');
 console.log('OK · public origin/CORS, device ownership, server score, private DB/files and QRZ isolation.');
}finally{await new Promise(r=>server.close(r));}
