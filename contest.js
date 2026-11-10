export const profiles={
 free:{name:'Libre',exchange:'Dato opcional',zone:null},
 cqww:{name:'CQ WW CW 2026',exchange:'Zona CQ',zone:'cqzone',id:'CQ-WW-CW',bands:['160','80','40','20','15','10'],start:'2026-11-28T00:00:00Z',end:'2026-11-30T00:00:00Z',cq:'CQ TEST DE $mycall$ $mycall$ K',autoReply:false},
 sacw:{name:'SACW 2026 · Sudamérica',exchange:'ITU / M / QRP / YL',zone:'ituzone',id:'SACW',bands:['80','40','15','10'],start:'2026-11-21T18:00:00Z',end:'2026-11-22T21:00:00Z',cq:'CQ SACW TEST DE $mycall$ $mycall$ K',autoReply:false},
 itu:{name:'Intercambio ITU',exchange:'Zona ITU',zone:'ituzone'},serial:{name:'Intercambio correlativo',exchange:'Número recibido',zone:null},unscored:{name:'Concurso personalizado',exchange:'Intercambio',zone:null},custom:{name:'Práctica ITU',exchange:'Zona ITU',zone:'ituzone'}
};
export function nextSerial(rows){return Math.max(0,...rows.map(q=>q.serial||0))+1;}
export function validCall(call){return /^[A-Z0-9/]{3,20}$/.test(call)&&/[A-Z]/.test(call)&&/[0-9]/.test(call);}
export function validateExchange(profile,value){value=String(value).trim().toUpperCase();if(profile==='sacw'&&['M','QRP','YL'].includes(value))return true;if(profile==='cqww')return /^\d{1,2}$/.test(value)&&+value>=1&&+value<=40;if(['itu','custom','sacw'].includes(profile))return /^\d{1,2}$/.test(value)&&+value>=1&&+value<=90;if(profile==='serial')return /^\d{1,6}$/.test(value)&&+value>0;return profile==='free'||!!value;}
export function contestDefaults(profile){const p=profiles[profile]||profiles.free;return {profile,exchange:'',contestId:p.id||'',start:p.start||'',end:p.end||'',categoryBand:'ALL',categoryPower:'LOW',declaredPower:100,sacwMessage:'ITU',checklog:false,scoreMode:'auto'};}
export function ownExchange(settings,session,home={}){if(session.profile==='sacw'){if(session.categoryPower==='QRP')return 'QRP';if(['M','YL','QRP'].includes(session.sacwMessage))return session.sacwMessage;return String(settings.myitu||home.ituzone||'');}if(session.exchange)return session.exchange;if(session.profile==='cqww')return String(settings.mycqz||home.cqzone||'');if(['itu','custom'].includes(session.profile))return String(settings.myitu||home.ituzone||'');if(session.profile==='serial')return String(nextSerial(session.rows||[])).padStart(3,'0');return '';}
export function wpxPrefix(call){
 let c=call.toUpperCase();const parts=c.split('/').filter(x=>!['P','M','QRP','MM','AM'].includes(x));
 if(parts.length>1){const area=parts.find(x=>/^\d$/.test(x)),portable=parts.find(x=>x.length<=4&&!/^\d$/.test(x));if(portable)c=portable;else c=parts.find(x=>/\d/.test(x))||parts[0];if(area)c=c.replace(/(\d+)(?=[A-Z]*$)/,area);}
 const m=c.match(/^(.*\d)/);return m?m[1]:/^[A-Z]+$/.test(c)?c+'0':'';
}
export function scoreLog(rows,profile,home={},session={},options={}){
 const p=profiles[profile]||profiles.free,seen=new Set(),countries=new Set(),zones=new Set(),prefixes=new Set();let points=0,pending=0;
 const native=['cqww','sacw'].includes(profile),start=session.start||p.start,end=session.end||p.end;
 const annotated=rows.map(q=>{
  const key=q.call.toUpperCase()+':'+q.band,time=Date.parse(q.time);let reason='';
  if(p.bands&&!p.bands.includes(q.band))reason='Banda no válida';
  else if(!validateExchange(profile,q.exchange||''))reason='Intercambio inválido';
  else if(native&&start&&!options.ignorePeriod&&(time<Date.parse(start)||time>=Date.parse(end)))reason='Fuera de período';
  else if(session.categoryBand&&session.categoryBand!=='ALL'&&q.band!==session.categoryBand)reason='Otra banda: checklog';
  else if(profile==='sacw'&&((home.continent&&home.continent!=='SA')||(q.continent&&q.continent!=='SA')||/\/(?:MM|AM)$/.test(q.call)))reason='Fuera de Sudamérica';
  const dupe=!reason&&seen.has(key);if(dupe)reason='Duplicado';const valid=!reason;let qpoints=0,unresolved=false;
  const entity=q.entity||q.dxcc,own=home.entity||home.dxcc;
  if(valid&&profile==='cqww'){
   unresolved=!entity||!own||!q.continent||!home.continent;
   if(!unresolved){qpoints=entity===own?0:q.continent!==home.continent?3:q.continent==='NA'?2:1;if(!q.call.endsWith('/MM'))countries.add(q.band+':'+entity);zones.add(q.band+':'+Number(q.exchange));}
  }else if(valid&&profile==='sacw'){
   const prefix=wpxPrefix(q.call),msg=q.exchange.trim().toUpperCase();unresolved=!entity||q.continent!=='SA'||home.continent!=='SA'||!prefix||(!['M','QRP','YL'].includes(msg)&&!home.ituzone);
   if(!unresolved){qpoints=msg==='M'?5:['QRP','YL'].includes(msg)?3:+msg===+home.ituzone?1:2;countries.add(q.band+':'+entity);prefixes.add(q.band+':'+prefix);}
  }else if(valid&&profile==='custom'){qpoints=1;zones.add(q.band+':'+Number(q.exchange));}
  if(valid){if(unresolved)pending++;else{seen.add(key);points+=qpoints;}}
  return {...q,dupe,valid,points:qpoints,unresolved,reason};
 });
 const scored=['cqww','custom','sacw'].includes(profile),mults=countries.size+zones.size+prefixes.size;
 return {rows:annotated,valid:annotated.filter(q=>q.valid&&!q.unresolved).length,dupes:annotated.filter(q=>q.dupe).length,excluded:annotated.filter(q=>!q.valid&&!q.dupe).length,points,mults,countries:countries.size,zones:zones.size,prefixes:prefixes.size,pending,computedScore:scored?points*mults:null,score:scored&&!session.checklog?points*mults:null};
}
// Keep strict contest results separate from a clearly labelled practice preview.
// Practice ignores dates only: bands, exchanges, duplicates and category still apply.
export function scoreSummary(rows,profile,home={},session={},now=Date.now()){
 const official=scoreLog(rows,profile,home,session),p=profiles[profile]||profiles.free,native=['cqww','sacw'].includes(profile);
 const start=Date.parse(session.start||p.start),end=Date.parse(session.end||p.end);
 const outside=time=>Number.isFinite(time)&&Number.isFinite(start)&&Number.isFinite(end)&&(time<start||time>=end);
 const allOutside=native&&(rows.length?rows.every(q=>outside(Date.parse(q.time))):outside(now));
 const practice=native&&(session.scoreMode==='practice'||(session.scoreMode!=='official'&&allOutside));
 const display=practice?scoreLog(rows,profile,home,session,{ignorePeriod:true}):official;
 return {...display,practice,allOutside,checklog:!!session.checklog,officialScore:official.score,officialPoints:official.points,officialMults:official.mults};
}
const clean=v=>String(v??'').replace(/[\r\n]/g,' ').trim();
const ascii=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'');
export function sacwQso(q,mycall){const d=new Date(q.time).toISOString();return 'QSO:'+String(Math.round(q.hz/1000)).padStart(5)+' CW '+d.slice(0,10)+' '+d.slice(11,16).replace(':','')+' '+clean(mycall).padEnd(13)+clean(q.sent).padEnd(4)+clean(q.txExchange).padEnd(4)+clean(q.call).padEnd(13)+clean(q.received).padEnd(4)+clean(q.exchange);}
export function exportCabrillo(rows,settings,session){
 const p=profiles[session.profile]||profiles.unscored;if(session.profile==='free')throw Error('Elegí un concurso para exportar Cabrillo.');const id=p.id||clean(session.contestId);if(!id)throw Error('Completá el identificador Cabrillo.');if(!validCall(settings.mycall))throw Error('Configurá tu indicativo.');
 const power=session.categoryPower||(Number(settings.mypower)<=5?'QRP':Number(settings.mypower)<=100?'LOW':'HIGH'),watts=Number(session.declaredPower??settings.mypower);if(['sacw','cqww'].includes(session.profile)&&(!Number.isFinite(watts)||watts<=0||watts>1500))throw Error('Indicá una potencia declarada mayor que 0 y hasta 1500 W.');if(power==='QRP'&&watts>5)throw Error('La categoría QRP admite hasta 5 W declarados.');if(power==='LOW'&&watts>100)throw Error('LOW admite hasta 100 W declarados.');
 if(session.profile==='sacw'){if(!ascii(settings.myname)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email||''))throw Error('SACW requiere nombre y email en Ajustes.');if(!(+settings.myitu>=1&&+settings.myitu<=90))throw Error('SACW requiere tu zona ITU para X-ZONE.');for(const q of rows)if(!validateExchange('sacw',q.exchange)||!validateExchange('sacw',q.txExchange))throw Error('Revisá los mensajes SACW enviados y recibidos.');}
 const lines=['START-OF-LOG: 3.0','CALLSIGN: '+clean(settings.mycall),'CONTEST: '+id,'CATEGORY-BAND: '+(session.categoryBand||'ALL'),'CATEGORY-POWER: '+power,'CATEGORY-OPERATOR: '+(session.checklog?'CHECKLOG':'SINGLE-OP')];
 if(session.profile==='sacw')lines.push('X-ZONE: '+settings.myitu,'NAME: '+ascii(settings.myname),'EMAIL: '+clean(settings.email));
 else lines.push('CATEGORY-ASSISTED: ASSISTED','CATEGORY-MODE: CW','CATEGORY-TRANSMITTER: ONE');
 lines.push('CREATED-BY: CW Station 1.0 RC3');
 for(const q of [...rows].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time))){if(session.profile==='sacw')lines.push(sacwQso(q,settings.mycall));else{const d=new Date(q.time).toISOString();lines.push('QSO: '+String(Math.round(q.hz/1000)).padStart(5)+' CW '+d.slice(0,10)+' '+d.slice(11,16).replace(':','')+' '+clean(settings.mycall).padEnd(13)+' '+clean(q.sent).padEnd(3)+' '+clean(q.txExchange).padEnd(6)+' '+clean(q.call).padEnd(13)+' '+clean(q.received).padEnd(3)+' '+clean(q.exchange));}}
 lines.push('END-OF-LOG:');return lines.join('\r\n');
}

