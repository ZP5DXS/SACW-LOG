import {DatabaseSync} from 'node:sqlite';
import {calculate,validCall,validateExchange} from './domain.js';import {bandOf} from './cat.js';import {parseCTY,prefixLookup} from './lookup.js';
export function createLiveStore({path=':memory:',cty,now=Date.now}={}){
 const db=new DatabaseSync(path);db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS stations (workspace TEXT NOT NULL, client TEXT NOT NULL, call TEXT NOT NULL, band TEXT NOT NULL, power TEXT NOT NULL, score INTEGER NOT NULL, qsos INTEGER NOT NULL, seen INTEGER NOT NULL, revision INTEGER NOT NULL, snapshot TEXT NOT NULL, PRIMARY KEY(workspace,client));');
 const prefixes=parseCTY(cty),upsert=db.prepare('INSERT INTO stations VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace,client) DO UPDATE SET call=excluded.call,band=excluded.band,power=excluded.power,score=excluded.score,qsos=excluded.qsos,seen=excluded.seen,revision=excluded.revision,snapshot=excluded.snapshot WHERE excluded.revision>=stations.revision');
 function board(workspace,band,power){
  const threshold=now()-60000,entries=db.prepare('SELECT client,call,band,power,score,qsos,seen FROM stations WHERE workspace=? ORDER BY seen DESC,client ASC').all(workspace),unique=new Map();
  for(const entry of entries)if(!unique.has(entry.call))unique.set(entry.call,entry);
  const label=(b,p)=>(b==='ALL'?'SOAB':'SOSB '+b+' m')+' · '+p;
  const rank=(b,p,limit)=>[...unique.values()].filter(s=>s.band===b&&s.power===p).sort((a,b)=>b.score-a.score||b.qsos-a.qsos||a.call.localeCompare(b.call)).slice(0,limit).map((s,i)=>({call:s.call,score:s.score,qsos:s.qsos,online:s.seen>threshold,position:i+1}));
  const categories=[...['LOW','HIGH','QRP'].map(p=>({band:'ALL',power:p})),...['80','40','15','10'].flatMap(b=>['LOW','HIGH'].map(p=>({band:b,power:p})))].map(c=>({...c,label:label(c.band,c.power),ranking:rank(c.band,c.power,3),fullRanking:rank(c.band,c.power,Number.MAX_SAFE_INTEGER)}));
  return {workspace,onlineCount:[...unique.values()].filter(s=>s.seen>threshold).length,categoryLabel:label(band,power),ranking:rank(band,power,10),categories,serverTime:new Date(now()).toISOString()};
 }
 function sync(body){
  const workspace=body.workspace||'official',settings=body.settings||{},client=String(body.clientId||''),call=String(body.station||'').trim().toUpperCase();if(!['official','demo','free'].includes(workspace)||!/^[-a-zA-Z0-9]{8,80}$/.test(client)||!validCall(call)||!['ALL','80','40','15','10'].includes(settings.categoryBand)||!['LOW','HIGH','QRP'].includes(settings.categoryPower)||!Number.isInteger(+settings.myitu)||+settings.myitu<1||+settings.myitu>90)throw Error('SYNC_VALIDATION');
  if(!Array.isArray(body.rows)||body.rows.length>25000)throw Error('SYNC_VALIDATION');const ids=new Set();const rows=body.rows.map(q=>{if(!q||typeof q.id!=='string'||ids.has(q.id)||!validCall(q.call)||!Number.isFinite(Date.parse(q.time))||q.mode!=='CW'||!Number.isInteger(q.hz)||bandOf(q.hz)!==q.band||!bandOf(q.hz)||typeof q.exchange!=='string'||workspace!=='free'&&(!validateExchange('sacw',q.exchange)||!validateExchange('sacw',q.txExchange)))throw Error('SYNC_VALIDATION');ids.add(q.id);const info=prefixLookup(prefixes,q.call);return {id:q.id,call:q.call,time:q.time,mode:'CW',hz:q.hz,band:q.band,exchange:q.exchange,txExchange:q.txExchange,entity:info.entity||q.entity||'',continent:info.continent||q.continent||'',sent:q.sent||'599',received:q.received||'599'};});
  const home={...prefixLookup(prefixes,call),ituzone:+settings.myitu},score=calculate(rows,{...settings,mycall:call,checklog:false},workspace,home),revision=Number(body.revision);if(!Number.isSafeInteger(revision)||revision<0)throw Error('SYNC_VALIDATION');const prior=db.prepare('SELECT revision FROM stations WHERE workspace=? AND client=?').get(workspace,client);if(prior&&prior.revision>revision)throw Error('SYNC_STALE');
  upsert.run(workspace,client,call,settings.categoryBand,settings.categoryPower,score.computedScore||0,score.valid,now(),revision,JSON.stringify(rows));
  return {...board(workspace,settings.categoryBand,settings.categoryPower),acknowledged:(body.events||[]).map(e=>e.eventId).filter(id=>typeof id==='string'),own:{score:score.computedScore,qsos:score.valid,points:score.points,mults:score.mults}};
 }
 return {sync,board,close:()=>db.close()};
}
