import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {rigs} from './radios.js';

const runRigctl=promisify(execFile);
const speeds=[4800,9600,19200,38400,57600,115200];

export function createHamlibService(run=runRigctl){
 let busy=false;
 return async function hamlib({rig,port,baud,hz,mode}){
  const profile=Object.hasOwn(rigs,rig)?rigs[rig]:null;
  if(!profile?.hamlib||typeof port!=='string'||!/^COM[1-9]\d{0,2}$/i.test(port)||!speeds.includes(baud))throw Error('CAT_HAMLIB_CONFIG');
  if(hz!==undefined&&(!Number.isInteger(hz)||hz<1800000||hz>54000000))throw Error('CAT_RANGE');
  if(mode!==undefined&&!['3','7'].includes(mode))throw Error('CAT_MODE');
  if(busy)throw Error('CAT_HAMLIB_BUSY');
  busy=true;
  try{
   const args=['-m',String(profile.hamlib),'-r','\\\\.\\'+port.toUpperCase(),'-s',String(baud),'-P','NONE'];
   if(hz!==undefined)args.push('F',String(hz));
   if(mode!==undefined)args.push('M',mode==='3'?'CW':'CWR','0');
   args.push('f','m');
   const {stdout}=await run(process.env.SACW_RIGCTL||'rigctl.exe',args,{windowsHide:true,timeout:7000,maxBuffer:8192});
   const match=/^(\d+)\r?\n([A-Z0-9-]+)\r?\n\d+/m.exec(stdout);
   if(!match)throw Error('CAT_HAMLIB_RESPONSE');
   return {hz:+match[1],mode:match[2]==='CW'?'3':match[2]==='CWR'?'7':'other'};
  }catch(e){
   if(e.code==='ENOENT')throw Error('CAT_HAMLIB_MISSING');
   throw Error('CAT_HAMLIB_RADIO');
  }finally{busy=false;}
 };
}
