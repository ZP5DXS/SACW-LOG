import {rigs,encodeBCD,decodeBCD} from './radios.js';
// Limited native Web Serial drivers: frequency, mode and split; never PTT/keying.
export const bandOf=hz=>{for(const [b,lo,hi] of [['80',3500000,4000000],['40',7000000,7300000],['15',21000000,21450000],['10',28000000,29700000]])if(hz>=lo&&hz<=hi)return b;return '';};
export const bandStart={'80':3525000,'40':7025000,'15':21025000,'10':28025000};
export function frequencyCommand(hz){if(!Number.isInteger(hz)||hz<1800000||hz>54000000)throw Error('CAT_RANGE');return 'FA'+String(hz).padStart(9,'0')+';FA;';}
export class SacwCAT{
 constructor(onState=()=>{},onError=()=>{}){this.onState=onState;this.onError=onError;this.state={connected:false,hz:null,mode:null,fresh:0,split:null};this.queue=Promise.resolve();this.profile=rigs['101'];}
 update(p){Object.assign(this.state,p);this.onState({...this.state});}
 async write(bytes){const writer=this.writer;if(!writer)throw Error('CAT_OFFLINE');this.queue=this.queue.catch(()=>{}).then(()=>writer.write(bytes));return this.queue;}
 async send(command){const valid=this.profile.protocol==='kenwood'?/^(?:(?:FA(?:\d{11})?|MD[37]?|FT|FR);)+$/:/^(?:(?:FA(?:\d{9})?|MD0[37]?|FT);)+$/;if(!valid.test(command))throw Error('CAT_COMMAND');return this.write(new TextEncoder().encode(command));}
 async civ(command,data=[]){if(![3,4,5,6,15].includes(command)||([3,4,15].includes(command)&&data.length)||command===5&&(data.length!==5||data.some(b=>(b&15)>9||(b>>4)>9))||command===6&&(data.length!==2||![3,7].includes(data[0])||data[1]!==1))throw Error('CAT_COMMAND');return this.write(Uint8Array.from([0xfe,0xfe,this.address,0xe0,command,...data,0xfd]));}
 async hamlibRequest(changes={}){
  if(this.hamlibPending)await this.hamlibPending.catch(()=>{});
  const pending=(async()=>{
   const response=await fetch('./api/hamlib',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...this.hamlibSettings,...changes}),signal:AbortSignal.timeout(8000)});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||'CAT_HAMLIB_LOCAL');
   this.update({...data,fresh:Date.now(),modeFresh:Date.now()});
  })();
  this.hamlibPending=pending;
  try{await pending;}finally{if(this.hamlibPending===pending)this.hamlibPending=null;}
 }
 async connectHamlib(settings){
  if(!['127.0.0.1','localhost'].includes(location.hostname))throw Error('CAT_HAMLIB_LOCAL');
  this.hamlibSettings={rig:settings.rig,port:settings.hamlibPort,baud:+settings.baud};
  await this.hamlibRequest();
  this.update({connected:true,split:null});
  this.timer=setInterval(()=>{
   if(!this.hamlibPending)void this.hamlibRequest().catch(e=>{this.onError(e);void this.disconnect();});
  },1800);
 }
 async poll(){if(this.profile.protocol==='icom'){await this.civ(3);await this.civ(4);await this.civ(15);}else await this.send(this.profile.protocol==='kenwood'?'FA;MD;FR;FT;':'FA;MD0;FT;');}
 async connect(settings){this.profile=rigs[settings.rig];if(!this.profile)throw Error('CAT_MODEL');if(this.profile.protocol==='hamlib')return this.connectHamlib(settings);if(!navigator.serial)throw Error('CAT_BROWSER');this.address=parseInt(settings.civAddress||this.profile.address?.toString(16)||'94',16);if(!Number.isInteger(this.address)||this.address<1||this.address>0xdf)throw Error('CAT_ADDRESS');const port=await navigator.serial.requestPort();try{await port.open({baudRate:+settings.baud,dataBits:8,stopBits:this.profile.protocol==='yaesu'||+settings.baud===4800?2:1,parity:'none',flowControl:'none'});this.port=port;this.reader=port.readable.getReader();this.writer=port.writable.getWriter();this.update({connected:true,hz:null,fresh:0,modeFresh:0,split:null,mode:null,rxVfo:null,txVfo:null});this.readTask=this.read();await this.poll();this.timer=setInterval(()=>this.poll().catch(e=>{this.onError(e);void this.disconnect();}),900);}catch(e){await this.disconnect();throw e;}}
 async read(){let text='',bytes=[];const decoder=new TextDecoder();try{while(this.reader){const {value,done}=await this.reader.read();if(done)break;if(this.profile.protocol==='icom'){bytes.push(...value);let end;while((end=bytes.indexOf(0xfd))>=0)this.parseCiv(bytes.splice(0,end+1));if(bytes.length>4096)bytes=[];}else{text+=decoder.decode(value,{stream:true});let index;while((index=text.indexOf(';'))>=0){this.parse(text.slice(0,index));text=text.slice(index+1);}if(text.length>4096)text='';}}}catch(e){if(!this.closing)this.onError(e);}finally{if(!this.closing)void this.disconnect();}}
 parse(text){const width=this.profile.protocol==='kenwood'?11:9;if(new RegExp('^FA\\d{'+width+'}$').test(text))this.update({hz:+text.slice(2),fresh:Date.now()});else if(this.profile.protocol==='kenwood'&&/^MD\d$/.test(text))this.update({mode:text.slice(2),modeFresh:Date.now()});else if(this.profile.protocol==='kenwood'&&/^FR[012]$/.test(text))this.update({rxVfo:+text[2],split:+text[2]!==0||this.state.txVfo!==null&&this.state.txVfo!==0});else if(/^MD0[0-9A-F]$/.test(text))this.update({mode:text.slice(3),modeFresh:Date.now()});else if(/^FT[012]$/.test(text))this.update({txVfo:+text[2],split:text!=='FT0'||this.profile.protocol==='kenwood'&&this.state.rxVfo!==null&&this.state.rxVfo!==0});}
 parseCiv(frame){const begin=frame.findIndex((b,i)=>b===0xfe&&frame[i+1]===0xfe);if(begin<0)return;const f=frame.slice(begin);if(f.length<7||![0xe0,0].includes(f[2])||f[3]!==this.address)return;const data=f.slice(5,-1);if([0,3].includes(f[4])&&data.length===5){try{this.update({hz:decodeBCD(data),fresh:Date.now()});}catch{}}else if([1,4].includes(f[4])&&data.length>=1)this.update({mode:data[0]===3?'3':data[0]===7?'7':'other',modeFresh:Date.now()});else if(f[4]===15&&data.length===1&&[0,1].includes(data[0]))this.update({split:data[0]===1});}
 async tune(hz){if(!this.state.connected||Date.now()-this.state.fresh>4000)throw Error('CAT_STALE');if(this.state.split)throw Error('CAT_SPLIT');frequencyCommand(hz);if(this.profile.protocol==='hamlib')return this.hamlibRequest({hz});if(this.profile.protocol==='icom'){await this.civ(5,encodeBCD(hz));await this.civ(3);}else await this.send(this.profile.protocol==='kenwood'?'FA'+String(hz).padStart(11,'0')+';FA;':frequencyCommand(hz));}
 async mode(mode){if(!['3','7'].includes(mode))throw Error('CAT_MODE');if(Date.now()-this.state.fresh>4000)throw Error('CAT_STALE');if(this.profile.protocol==='hamlib')return this.hamlibRequest({mode});if(this.profile.protocol==='icom')await this.civ(6,[+mode,1]);else await this.send(this.profile.protocol==='kenwood'?'MD'+mode+';MD;':'MD0'+mode+';MD0;');}
 async disconnect(){if(this.closing)return;this.closing=true;clearInterval(this.timer);const port=this.port;this.port=null;try{await this.hamlibPending?.catch(()=>{});await this.reader?.cancel();await this.readTask;this.reader?.releaseLock();await this.queue.catch(()=>{});this.writer?.releaseLock();await port?.close();}catch{}finally{this.reader=null;this.writer=null;this.closing=false;this.update({connected:false,fresh:0,mode:null,split:null});}}
}
