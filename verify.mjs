import assert from 'node:assert/strict';import {readFile,writeFile,unlink} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import vm from 'node:vm';
import {calculate,adif,cabrillo,START,END} from './domain.js';import {parseCTY,prefixLookup} from './lookup.js';import {SacwCAT,frequencyCommand,bandOf} from './cat.js';import {safeEndpoint} from './connectors.js';import {messages} from './i18n.js';
import {rigs,parseFrequency,encodeBCD,decodeBCD} from './radios.js';import {createQRZService} from './qrz-service.js';
const db=parseCTY(await readFile(new URL('cty.dat',import.meta.url),'utf8')),settings={mycall:'ZP5DXS',myname:'Test Operator',email:'test@example.com',myitu:14,categoryBand:'ALL',categoryPower:'LOW',declaredPower:100,sacwMessage:'ITU'},home={...prefixLookup(db,settings.mycall),ituzone:14};
const q=(call,exchange,hz=7025000,time='2026-11-21T18:01:00Z')=>({...prefixLookup(db,call),id:call+'-'+hz+'-'+exchange,call,exchange,hz,band:bandOf(hz),mode:'CW',radioMode:'3',time,sent:'599',received:'599',txExchange:'14'});
const fixture=[q('LU1DZ','14'),q('PY2AA','15'),q('CX1AA','YL'),q('CE3AA','QRP'),q('PY2ZZ','M')];
let r=calculate(fixture,settings,'official',home);assert.equal(r.points,14);assert.equal(r.countries,4);assert.equal(r.prefixes,4);assert.equal(r.computedScore,112);
r=calculate([...fixture,{...fixture[0],id:'duplicate'}],settings,'official',home);assert.equal(r.computedScore,112);assert.equal(r.dupes,1);
assert.equal(calculate([q('LU1DZ','14',7025000,'2026-11-09T15:00:00Z')],settings,'official',home).points,0);assert.equal(calculate([q('LU1DZ','14',7025000,'2026-11-09T15:00:00Z')],settings,'demo',home).points,1);
assert.equal(calculate([q('LU1DZ','14',7025000,new Date(END).toISOString())],settings,'official',home).points,0);assert.equal(calculate([q('LU1DZ','14',7025000,new Date(START).toISOString())],settings,'official',home).points,1);
assert.equal(calculate([q('W4RM','8')],settings,'official',home).points,0);assert.equal(calculate(fixture,{...settings,categoryBand:'15'},'official',home).points,0);assert.equal(calculate(fixture,{...settings,checklog:true},'official',home).computedScore,112);assert.equal(calculate(fixture,{...settings,checklog:true},'official',home).score,null);
assert.equal(calculate([...fixture,q('LU1DZ','14',21025000)],settings,'official',home).countries,5);assert.equal(calculate([{...fixture[0],time:'invalid'}],settings,'official',home).points,0);assert.equal(calculate(fixture,settings,'free',home).score,null);
const cab=cabrillo(fixture,settings,'official'),line=cab.split('\r\n').find(l=>l.startsWith('QSO:'));assert.equal(line.slice(4,9),' 7025');assert.equal(line.slice(10,12),'CW');assert.equal(line.slice(13,23),'2026-11-21');assert.equal(line.slice(29,42).trim(),'ZP5DXS');assert.equal(line.slice(50,63).trim(),'LU1DZ');assert(cab.includes('X-ZONE: 14'));assert(cabrillo(fixture,settings,'demo').includes('PRACTICE ONLY'));assert(cabrillo(fixture,settings,'free').includes('GENERAL-QSO'));assert(adif(fixture,settings,'official').includes('<CONTEST_ID:4>SACW'));assert(!adif(fixture,settings,'free').includes('CONTEST_ID'));
assert.equal(frequencyCommand(7025000),'FA007025000;FA;');assert.throws(()=>frequencyCommand(0));assert.throws(()=>safeEndpoint('http://example.com'));assert.equal(safeEndpoint('https://example.com/api'),'https://example.com/api');
const cat=new SacwCAT();cat.parse('FA007025000');cat.parse('MD03');assert.equal(cat.state.hz,7025000);assert.equal(cat.state.mode,'3');cat.parse('FT1');assert.equal(cat.state.split,true);cat.parse('FT0');assert.equal(cat.state.split,false);const sent=[];cat.writer={write:async bytes=>sent.push(new TextDecoder().decode(bytes))};await assert.rejects(cat.send('TX1;'));await assert.rejects(cat.send('KY TEST;'));await cat.send('FA;MD0;FT;');assert.deepEqual(sent,['FA;MD0;FT;']);
for(const key of Object.keys(messages.es))assert(key in messages.pt,'Missing Portuguese: '+key);
const html=await readFile(new URL('index.html',import.meta.url),'utf8'),script=html.split('<script type="module">')[1].split('</script>')[0];await writeFile(new URL('.inline-check.mjs',import.meta.url),script);const checked=spawnSync(process.execPath,['--check',new URL('.inline-check.mjs',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')],{encoding:'utf8'});assert.equal(checked.status,0,checked.stderr);await unlink(new URL('.inline-check.mjs',import.meta.url));
// Execute the actual single-file application against a minimal DOM: keyboard flow,
// persistence, score, workspace separation and exports without hardware or RF.
const classes=()=>({add(){},remove(){},toggle(){}}),elements=new Map();
function element(id=''){if(elements.has(id))return elements.get(id);const el={id,value:'',textContent:'',innerHTML:'',hidden:false,dataset:{},classList:classes(),style:{},firstChild:{textContent:''},addEventListener(type,fn){this['event_'+type]=fn;},focus(){document.activeElement=this;},select(){},click(){this.onclick?.({target:this});},reset(){for(const key of ['call','exchange','sent','received','qname','qcountry','qentity','qcontinent','qitu','qcq','qtime','qtx'])element(key).value='';},showModal(){this.open=true;},close(){this.open=false;},removeAttribute(name){delete this[name];}};let inputValue='';Object.defineProperty(el,'value',{get:()=>inputValue,set:v=>inputValue=String(v??'')});if(id==='rows'){el.rows=[];el.parentElement={tHead:{offsetHeight:30}};}if(id==='settingsForm')el.elements={namedItem:name=>element('setting-'+name)};elements.set(id,el);return el;}
for(const [,id] of html.matchAll(/\bid="([^"]+)"/g))element(id);const bands=['80','40','15','10'].map(b=>Object.assign(element('band'+b),{dataset:{band:b}})),spaces=['official','demo','free'].map(w=>Object.assign(element('space'+w),{dataset:{workspace:w}}));
const document={body:{classList:classes()},documentElement:{},getElementById:element,querySelector(selector){return element(selector);},querySelectorAll(selector){return selector==='[data-band]'?bands:selector==='[data-workspace]'?spaces:[];},addEventListener(){},createElement:()=>({click(){}})};const memory=new Map(),context={console,document,navigator:{onLine:true},location:{protocol:'file:'},crypto:globalThis.crypto,localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},indexedDB:{open(){throw Error('not available');}},setInterval(){},setTimeout(){},clearTimeout(){},clearInterval(){},URL,Date,Intl,TextEncoder,TextDecoder,Blob,structuredClone,confirm:()=>true,AbortSignal};context.window=context;context.addEventListener=()=>{};vm.createContext(context);vm.runInContext(script,context);assert(context.SACW);vm.runInContext('state.settings={...state.settings,...'+JSON.stringify(settings)+'};state.workspace="demo";paint();',context);element('call').value='LU1DZ';element('call').event_keydown({key:'Enter',preventDefault(){}});assert.equal(document.activeElement.id,'exchange');assert.equal(element('exchange').value,'14');element('sent').value=element('received').value='599';element('qsoForm').onsubmit({preventDefault(){}});assert.equal(context.SACW.getSnapshot().logs.demo.length,1);assert.equal(context.SACW.calculate().points,1);assert.equal(context.SACW.getSnapshot().logs.official.length,0);assert(memory.size>0);spaces[0].onclick();assert.equal(context.SACW.calculate().points,1);assert.equal(context.SACW.getSnapshot().workspace,'demo');spaces[2].onclick();assert.equal(context.SACW.calculate().score,null);spaces[1].onclick();assert.equal(context.SACW.calculate().points,1);
const restoredContext={...context,document,window:null};restoredContext.window=restoredContext;vm.createContext(restoredContext);vm.runInContext(script,restoredContext);assert.equal(restoredContext.SACW.getSnapshot().logs.demo.length,1);assert.equal(restoredContext.SACW.getSnapshot().settings.mycall,'ZP5DXS');assert.equal(restoredContext.SACW.calculate().points,1);
console.log('OK · SACW points/multipliers, dupes, period, categories, Cabrillo columns, ADIF, CAT allowlist, ES/PT, full HTML and Enter/persistence flow.');
assert.equal(parseFrequency('7025'),7025000);assert.equal(parseFrequency('7.025'),7025000);assert.equal(parseFrequency('7.025.000'),7025000);assert.equal(parseFrequency('21025,1'),21025100);assert.equal(decodeBCD(encodeBCD(28025100)),28025100);
for(const profile of Object.values(rigs).filter(profile=>!profile.hamlib&&!['ft817','ft757'].includes(profile.protocol))){const test=new SacwCAT();test.profile=profile;test.address=profile.address||0x94;const commands=[];test.writer={write:async bytes=>commands.push([...bytes])};await test.poll();if(profile.protocol==='icom'){test.parseCiv([0xfe,0xfe,0xe0,test.address,3,...encodeBCD(7025000),0xfd]);test.parseCiv([0xfe,0xfe,0xe0,test.address,4,3,1,0xfd]);test.parseCiv([0xfe,0xfe,0xe0,test.address,15,0,0xfd]);await assert.rejects(test.civ(0x1c,[0,1]));}else{test.parse(profile.protocol==='kenwood'?'FA00007025000':'FA007025000');test.parse(profile.protocol==='kenwood'?'MD3':'MD03');test.parse('FT0');if(profile.protocol==='kenwood')test.parse('FR0');await assert.rejects(test.send('TX1;'));}assert.equal(test.state.hz,7025000,profile.name);assert.equal(test.state.mode,'3',profile.name);assert.equal(test.state.split,false,profile.name);test.state.connected=true;await test.tune(21025000);assert(commands.length>=2);}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs');assert(!html.includes('name="facebook"'));assert(!html.includes('name="checklog"'));assert(!html.includes('id="entryHint"'));assert(!html.includes('id="stepHint"'));assert(html.includes('<span id="mode"'));
vm.runInContext('state.workspace="demo";resetEntry();',restoredContext);element('call').value='PY2ZZ';element('call').event_keydown({key:'Enter',preventDefault(){}});assert.equal(document.activeElement.id,'exchange');element('exchange').event_keydown({key:'Enter',preventDefault(){}});assert.equal(document.activeElement.id,'frequency');element('frequency').value='21025';element('qsoForm').onsubmit({preventDefault(){}});let snapshot=restoredContext.SACW.getSnapshot();assert.equal(snapshot.logs.demo.at(-1).hz,21025000);assert.equal(snapshot.logs.demo.at(-1).band,'15');
vm.runInContext('editQso(state.logs.demo.at(-1).id)',restoredContext);assert.equal(element('qsoEditor').open,true);element('editName').value='Updated name';element('editFreq').value='28025';element('editForm').onsubmit({preventDefault(){}});snapshot=restoredContext.SACW.getSnapshot();assert.equal(snapshot.logs.demo.at(-1).name,'Updated name');assert.equal(snapshot.logs.demo.at(-1).band,'10');assert.equal(element('qsoEditor').open,false);assert.equal(snapshot.logs.demo.length,2);
vm.runInContext('state.workspace="free";state.logs.free=[{...state.logs.demo[0],id:"free-only"}];',restoredContext);element('resetLog').onclick();assert.equal(element('resetConfirm').disabled,true);element('resetConfirm').onclick();assert.equal(restoredContext.SACW.getSnapshot().logs.free.length,1);vm.runInContext('resetDeadline=Date.now()-1;',restoredContext);element('resetConfirm').onclick();assert.equal(restoredContext.SACW.getSnapshot().logs.free.length,0);assert.equal(restoredContext.SACW.getSnapshot().logs.demo.length,2);
const remoteCalls=[];const service=createQRZService({fetchImpl:async(url,opts)=>{remoteCalls.push({url:String(url),opts});if(String(url).includes('xmldata'))return {ok:true,text:async()=>String(url).includes('callsign=')?'<QRZDatabase><Callsign><call>PY2AA</call><country>Brazil</country><ituzone>15</ituzone><cont>SA</cont></Callsign></QRZDatabase>':'<QRZDatabase><Session><Key>fake-xml-key</Key></Session></QRZDatabase>'};return {ok:true,text:async()=>'RESULT=OK&LOGID=123&COUNT=1'};}});
const auth=await service({path:'/api/qrz/connect',method:'POST',body:{username:'TEST',password:'fake-password',apiKey:'fake-api-key'}});assert(auth.lookup&&auth.upload);const looked=await service({path:'/api/qrz/lookup',method:'GET',query:{call:'PY2AA'},authorization:'Bearer '+auth.session});assert.equal(looked.result.country,'Brazil');const uploaded=await service({path:'/api/qrz/upload',method:'POST',body:{adif:adif([fixture[0]],settings,'official')},authorization:'Bearer '+auth.session});assert(uploaded.ok);assert.equal(remoteCalls.at(-1).opts.body.get('ACTION'),'INSERT');assert.equal(remoteCalls.at(-1).opts.body.get('OPTION'),null);assert(!remoteCalls.at(-1).opts.body.get('ADIF').includes('EOH'));await assert.rejects(service({path:'/api/qrz/lookup',method:'GET',query:{call:'PY2AA'},authorization:'Bearer invalid'}));
console.log('OK · expanded CAT profiles, CI-V BCD/frames, manual Enter/frequency flow, separate QSO editor, reset countdown/isolation, QRZ lookup/upload with mocked service (no external account accessed).');
const template=await readFile(new URL('index.template.html',import.meta.url),'utf8');assert(!template.includes('class="eventdate"'));assert(!template.includes('class="chips"'));assert(!template.includes('id="localStart"'));assert(!template.includes('id="localEnd"'));assert(!template.includes('id="apiToken"'));assert(!template.includes('name="syncEndpoint"'));assert(template.includes('class="creator contestcredit"'));assert(template.includes('name="qrzUpload"'));assert(template.includes('id="qrzBookPanel"'));assert(template.indexOf('id="qrzConnect"')<template.indexOf('id="qrzBookPanel"'));assert.equal(element('shareScore').disabled,true);
const beforePreview=JSON.stringify(restoredContext.SACW.getSnapshot().logs);element('onlinePreview').onclick();assert.equal(element('onlineDialog').open,true);assert(element('previewBoard').innerHTML.includes('ZP0TEST'));assert(element('previewBoard').innerHTML.includes('24'));assert.equal(JSON.stringify(restoredContext.SACW.getSnapshot().logs),beforePreview);element('onlineClose').onclick();assert.equal(element('onlineDialog').open,false);
vm.runInContext("renderBoard($('ranking'),{onlineCount:3,categoryLabel:'SOAB HIGH',ranking:[{call:'<script>bad</script>',score:123,online:true}]})",restoredContext);assert(!element('ranking').innerHTML.includes('<script>'));assert(element('ranking').innerHTML.includes('&lt;script&gt;'));
console.log('OK · simplified header/footer, QRZ grouping, hidden deployment settings, disabled unconfigured online service and clearly marked preview without changing logs.');


const authLookup=await service({path:'/api/qrz/connect-lookup',method:'POST',body:{username:'TEST',password:'fake-password'}});
const authBook=await service({path:'/api/qrz/connect-logbook',method:'POST',body:{apiKey:'another-fake-key'}});
assert((await service({path:'/api/qrz/lookup',method:'GET',query:{call:'PY2AA'},authorization:'Bearer '+authLookup.session})).result);
await service({path:'/api/qrz/upload',method:'POST',body:{adif:adif([fixture[0]],settings,'official')},authorization:'Bearer '+authBook.session});
await service({path:'/api/qrz/disconnect',method:'POST',authorization:'Bearer '+authBook.session});
assert((await service({path:'/api/qrz/status',method:'GET',authorization:'Bearer '+authLookup.session})).lookup);
restoredContext.location={protocol:'http:',hostname:'127.0.0.1',origin:'http://127.0.0.1:8791',href:'http://127.0.0.1:8791/'};
vm.runInContext("globalThis.qrzTestCalls=[];requestJSON=async(url,auth,opts)=>{qrzTestCalls.push({url,auth,body:opts?.body});return url.endsWith('connect-lookup')?{session:'lookup-only',lookup:true}:url.endsWith('connect-logbook')?{session:'book-only',upload:true}:{ok:true};}",restoredContext);
element('qrzUser').value='TEST';element('qrzPassword').value='fake-password';await vm.runInContext('connectQRZLookup()',restoredContext);
assert.equal(vm.runInContext('qrzLookupSession',restoredContext),'lookup-only');assert.equal(element('qrzPassword').value,'');assert.equal(restoredContext.SACW.getSnapshot().settings.qrzUser,'TEST');
element('qrzKey').value='fake-api-key';element('setting-qrzUpload').checked=true;await vm.runInContext('connectQRZLogbook()',restoredContext);
assert.equal(vm.runInContext('qrzLookupSession',restoredContext),'lookup-only');assert.equal(vm.runInContext('qrzUploadSession',restoredContext),'book-only');assert.equal(restoredContext.qrzTestCalls[1].body.username,undefined);assert.equal(restoredContext.SACW.getSnapshot().settings.qrzLookup,true);
await vm.runInContext('connectQRZLookup()',restoredContext);assert.equal(vm.runInContext('qrzUploadSession',restoredContext),'book-only');assert.equal(restoredContext.SACW.getSnapshot().settings.qrzUpload,true);
vm.runInContext('globalThis.NormalDate=Date;Date=class extends NormalDate{static now(){return START+1000}};clock();Date=NormalDate;',restoredContext);assert.equal(element('onAir').hidden,false);assert.equal(element('countLabel').textContent,'EL CONCURSO TERMINA EN');
assert(!template.includes('id="ownInfo"'));assert(!template.includes('id="saveStatus"'));assert(!template.includes('footerdisclaimer'));assert(template.indexOf('id="globalStats"')<template.indexOf('</aside>'));
console.log('OK · QRZ separate sessions, username persistence, connecting API after lookup, independent disconnect, contest countdown ON AIR and reduced UI.');
assert.equal(vm.runInContext('defaults.shareScore',restoredContext),true);vm.runInContext("renderCategoryLeaders({workspace:'demo',categories:[{band:'ALL',power:'HIGH',label:'SOAB HIGH',ranking:[{call:'PY2AA',score:500},{call:'LU1DZ',score:300},{call:'CX1AA',score:200},{call:'CE3AA',score:100}]}]})",restoredContext);assert.equal(element('categoryStrip').hidden,false);assert(element('categoryLeaders').innerHTML.includes('PY2AA'));assert(!element('categoryLeaders').innerHTML.includes('CE3AA'));
vm.runInContext('state.settings.shareScore=false;persist();',restoredContext);const optedOutContext={...context,document,window:null};optedOutContext.window=optedOutContext;vm.createContext(optedOutContext);vm.runInContext(script,optedOutContext);assert.equal(optedOutContext.SACW.getSnapshot().settings.shareScore,false);assert(template.includes('id="categoryStrip"'));assert(template.indexOf('id="categoryStrip"')<template.indexOf('<aside>'));console.log('OK · horizontal top-three strip, default participation and persistent opt-out.');
optedOutContext.location={protocol:'http:',hostname:'127.0.0.1',origin:'http://127.0.0.1:8791',href:'http://127.0.0.1:8791/'};const fullList=['PY2AA','LU1DZ','CX1AA','CE3AA'].map((call,i)=>({call,score:100-i,qsos:10-i}));const carouselBoard={workspace:'free',ranking:fullList,categories:['HIGH','LOW','QRP','OTHER'].map((power,i)=>({band:i===3?'80':'ALL',power:i===3?'LOW':power,label:'Category '+i,ranking:fullList.slice(0,3),fullRanking:fullList}))};optedOutContext.carouselFixture=carouselBoard;
vm.runInContext('state.workspace="free";state.settings.shareScore=true;liveBoards.free=carouselFixture;liveReceived.free=Date.now();paintNetwork();',optedOutContext);assert.equal(element('globalStats').hidden,true);assert.equal(element('categoryStrip').hidden,false);vm.runInContext('carouselIndex=0;advanceCategoryCarousel(1)',optedOutContext);assert.equal(vm.runInContext('carouselIndex',optedOutContext),1);vm.runInContext('openCategoryRanking("ALL:HIGH")',optedOutContext);assert.equal(element('categoryRanking').open,true);assert(element('categoryRankingRows').innerHTML.includes('CE3AA'));element('categoryRankingClose').onclick();assert.equal(element('categoryRanking').open,false);element('categoryPause').onclick();assert.equal(vm.runInContext('carouselPaused',optedOutContext),true);console.log('OK · LIBRE local-only sidebar, automatic-carousel navigation/pause and full ranking beyond three places.');

assert(!template.includes('data-i="qrzNote"'));assert(!template.includes('data-i="rigNote"'));assert.equal(rigs.g90.protocol,'icom');assert.equal(rigs.g90.address,0x88);assert.equal(rigs.g90.defaultBaud,19200);element('rigSelect').value='g90';element('rigSelect').onchange();assert.equal(element('setting-baud').value,'19200');assert.equal(element('setting-civAddress').value,'88');assert(element('rigSelect').innerHTML.includes('Conexión manual'));assert(rigs['yaesu-generic']&&rigs['kenwood-generic']&&rigs['icom-generic']);console.log('OK · removed notices, manual CAT profiles and G90 CI-V/baud defaults.');

const ft817Commands=[];
let ft817Rx,ft817Settings,ft817Closed=false,ft817Digits=[0x00,0x70,0x25,0x00],ft817Mode=0x02;
const ft817Port={
 async open(options){ft817Settings=options;},
 async close(){ft817Closed=true;},
 readable:new ReadableStream({start(controller){ft817Rx=controller;}}),
 writable:new WritableStream({write(bytes){
  const frame=[...bytes],opcode=frame[4];
  ft817Commands.push(frame);
  if(opcode===0x01){
   ft817Digits=frame.slice(0,4);
   ft817Rx.enqueue(Uint8Array.of(0));
  }else if(opcode===0x07){
   ft817Mode=frame[0];
  }else if(opcode===0x03){
   ft817Rx.enqueue(Uint8Array.from(ft817Digits.slice(0,2)));
   ft817Rx.enqueue(Uint8Array.from([...ft817Digits.slice(2),ft817Mode]));
  }else assert.fail('Unexpected CAT command');
 }})
};
const navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serial:{requestPort:async()=>ft817Port}}});
const ft817=new SacwCAT();
try{
 await ft817.connect({rig:'ft817',baud:38400});
 assert.deepEqual(ft817Settings,{baudRate:38400,dataBits:8,stopBits:2,parity:'none',flowControl:'none'});
 assert.equal(ft817.state.hz,7025000);
 assert.equal(ft817.state.mode,'3');
 await ft817.tune(14023456);
 assert.equal(ft817.state.hz,14023450);
 await ft817.mode('7');
 assert.equal(ft817.state.mode,'7');
 assert.deepEqual(ft817Commands,[
  [0,0,0,0,3],[0x01,0x40,0x23,0x45,1],[0,0,0,0,3],[3,0,0,0,7],[0,0,0,0,3]
 ]);
}finally{
 await ft817.disconnect();
 Object.defineProperty(globalThis,'navigator',navigatorDescriptor);
}
assert(ft817Closed);
console.log('OK · FT-817/817ND Web Serial, 8N2, fragmented replies, frequency and mode readback, no PTT.');

assert.equal(rigs.ft818.protocol,rigs.ft817.protocol);
assert.equal(rigs.ft747.manualRead,true);
const gx=new SacwCAT(),gxFrames=[];
gx.profile=rigs.ft757;
gx.writer={write:async bytes=>gxFrames.push([...bytes])};
gx.state.connected=true;
assert.equal(await gx.tune(14250000),14250000);
assert.deepEqual(gxFrames,[[0x00,0x50,0x42,0x01,0x0a]]);
assert.equal(gx.state.hz,null);
await assert.rejects(gx.mode('3'),/CAT_MODE/);
console.log('OK · FT-818 shares the native driver and FT-757GX uses only the documented write command.');
