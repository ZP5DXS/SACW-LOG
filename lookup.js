// CTY.DAT: country-files.com. Prefix-derived zones are estimates, never received exchanges.
export function parseCTY(text){
 const entries=[],exact=new Map();let country=null;
 for(const line of text.split(/\r?\n/)){
  if(line&&!/^\s/.test(line)&&line.includes(':')){const p=line.split(':').map(x=>x.trim());country={country:p[0],cqzone:+p[1],ituzone:+p[2],continent:p[3],entity:p[7]?.replace('*','')};continue;}
  if(!country)continue;
  for(let token of line.trim().replaceAll(';',',').split(',').map(x=>x.trim()).filter(Boolean)){
   const q={...country},cq=token.match(/\((\d+)\)/),itu=token.match(/\[(\d+)\]/),cont=token.match(/\{([A-Z]{2})\}/);if(cq)q.cqzone=+cq[1];if(itu)q.ituzone=+itu[1];if(cont)q.continent=cont[1];
   token=token.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|<[^>]*>|~[^~]*~/g,'');
   if(token.startsWith('='))exact.set(token.slice(1),q);else entries.push([token,q]);
  }
 }
 entries.sort((a,b)=>b[0].length-a[0].length);return {entries,exact};
}
export function prefixLookup(db,call){
 call=call.toUpperCase().trim();if(db.exact.has(call))return {...db.exact.get(call),call,source:'Prefijo estimado'};
 let candidates=[call];if(call.includes('/')){const parts=call.split('/').filter(x=>!['P','M','MM','AM','QRP'].includes(x));const short=parts.find(x=>x.length<4&&!/^\d+$/.test(x));candidates=short?[short,...parts]:parts;}
 for(const candidate of candidates){const item=db.entries.find(([p])=>candidate.startsWith(p));if(item)return {...item[1],call,source:'Prefijo estimado'};}
 return {call,source:'Sin datos'};
}
export function xmlValue(xml,tag){const m=xml.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+tag+'>','i'));if(!m)return '';return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#x([0-9a-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi,(_,hex,dec,key)=>hex?String.fromCodePoint(parseInt(hex,16)):dec?String.fromCodePoint(+dec):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[key.toLowerCase()]));}
export function parseQRZ(xml){const section=xml.match(/<Callsign(?:\s[^>]*)?>([\s\S]*?)<\/Callsign>/i)?.[1]||'';if(!section)throw Error(xmlValue(xml,'Error')||'QRZ no devolvió datos del indicativo.');const v=t=>xmlValue(section,t);return {call:v('call').toUpperCase(),name:[v('fname'),v('name')].filter(Boolean).join(' '),country:v('country'),cqzone:+v('cqzone')||null,ituzone:+v('ituzone')||null,dxcc:v('dxcc'),continent:v('cont'),grid:v('grid'),source:'QRZ'};}
export function callsFromText(text,mycall=''){
 const words=text.toUpperCase().match(/[A-Z0-9/]+/g)||[],found=[];
 for(const word of words){if(word===mycall||/^(?:CQ|TEST|DE|QRZ|AGN|TU|BK|QRS|QTH|RST|[0-9]+|5NN|599)$/.test(word))continue;
  if(/^(?:[A-Z0-9]{1,4}\/)?(?:[A-Z]{1,2}[0-9]|[0-9][A-Z][0-9]|[A-Z][0-9][0-9])[A-Z]{1,5}(?:\/[A-Z0-9]{1,4})?$/.test(word))found.push(word);
 }return found;
}
