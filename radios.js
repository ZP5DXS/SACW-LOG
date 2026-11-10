// Full catalog implemented by this native browser adapter (not the Hamlib catalog).
export const rigs={
 '101':{name:'Yaesu FTDX101MP / D',protocol:'yaesu'},'891':{name:'Yaesu FT-891',protocol:'yaesu'},'ftdx10':{name:'Yaesu FTDX10',protocol:'yaesu'},'ft710':{name:'Yaesu FT-710',protocol:'yaesu'},'ft991':{name:'Yaesu FT-991 / 991A',protocol:'yaesu'},
 'ts590':{name:'Kenwood TS-590S / SG',protocol:'kenwood'},'ts890':{name:'Kenwood TS-890S',protocol:'kenwood'},'ts480':{name:'Kenwood TS-480HX / SAT',protocol:'kenwood'},'ts2000':{name:'Kenwood TS-2000',protocol:'kenwood'},
 'ic7300':{name:'Icom IC-7300',protocol:'icom',address:0x94},'ic705':{name:'Icom IC-705',protocol:'icom',address:0xa4},'ic7610':{name:'Icom IC-7610',protocol:'icom',address:0x98},'ic7100':{name:'Icom IC-7100',protocol:'icom',address:0x88},'ic7200':{name:'Icom IC-7200',protocol:'icom',address:0x76},'ic7410':{name:'Icom IC-7410',protocol:'icom',address:0x80},'ic9100':{name:'Icom IC-9100',protocol:'icom',address:0x7c},'ic7600':{name:'Icom IC-7600',protocol:'icom',address:0x7a},
 'g90':{name:'Xiegu G90',protocol:'icom',address:0x88,defaultBaud:19200},
 'yaesu-generic':{name:'Genérico · Yaesu',protocol:'yaesu'},'kenwood-generic':{name:'Genérico · Kenwood',protocol:'kenwood'},'icom-generic':{name:'Genérico · CI-V',protocol:'icom',address:0x94}
};
export function parseFrequency(value){const s=String(value).trim().replace(/\s/g,'').replace(',','.');let n=(s.match(/\./g)||[]).length>1?Number(s.replaceAll('.','')):Number(s);if(!Number.isFinite(n)||n<=0)throw Error('bandError');if(n<100)n*=1e6;else if(n<100000)n*=1000;return Math.round(n);}
export function encodeBCD(hz){return [...String(hz).padStart(10,'0').matchAll(/../g)].map(m=>parseInt(m[0],16)).reverse();}
export function decodeBCD(bytes){if(bytes.length!==5||bytes.some(b=>(b&15)>9||(b>>4)>9))throw Error('CAT_FRAME');return Number([...bytes].reverse().map(b=>b.toString(16).padStart(2,'0')).join(''));}
