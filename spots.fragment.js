const spotInterval=()=>Math.min(120,Math.max(10,Number($('spotMinutes').value)||10))*60000;
let spotArmed=false,spotArmedCall='',spotBand='',spotDue=0,spotBusy=false,lastSpotAttempt=-Infinity;
let reports={sent:[],received:[],feeds:[]},spotReportCall='',spotFetching=false;

function renderSpotReports(){
 const call=state.settings.mycall;
 const data=spotReportCall===call?reports:{sent:[],received:[],feeds:[]};
 $('spotPublisher').textContent=data.publishing?.ready?data.publishing.node:data.publishing?t('spotRegistrationPending'):t('spotUnavailable');
 $('spotLiveFields').hidden=!data.publishing;
 $('spotCodeLabel').hidden=!data.publishing?.accessCode;
 $('spotNodeRegistration').hidden=data.publishing?.node!=='dx1.g5gdx.com:7300';
 $('spotToggle').disabled=!spotArmed&&!data.publishing?.ready;
 if(!data.publishing&&spotArmed)setSpotArmed(false);
 $('spotFeeds').textContent=['DXFun','RBN'].map(source=>source+' '+(data.feeds.find(feed=>feed.source===source)?.ready?'âœ“':'â€”')).join(' Â· ');
 for(const [id,entries] of [['sentSpots',data.sent],['receivedSpots',data.received]]){
  $(id).innerHTML=entries.length?entries.slice(0,30).map(spot=>'<li><time>'+new Date(spot.time).toISOString().slice(11,16)+'Z</time><strong>'+esc(id==='sentSpots'?spot.call:spot.by)+'</strong><span>'+formatHz(spot.hz)+' kHz</span><span>'+esc(spot.source)+'</span><small>'+esc(spot.comment)+'</small></li>').join(''):'<li>'+t('spotsEmpty')+'</li>';
 }
}

async function refreshSpotReports(){
 const call=state.settings.mycall,url=appAPI('api/spots');
 if(spotFetching||!url||!validCall(call)){renderSpotReports();return;}
 spotFetching=true;
 try{
  const data=await requestJSON(url+'?call='+encodeURIComponent(call));
  if(state.settings.mycall!==call)return;
  if(!Array.isArray(data.feeds)||!Array.isArray(data.sent)||!Array.isArray(data.received))throw Error('SPOT_RESPONSE');
  reports=data;
  spotReportCall=call;
 }catch{reports={sent:[],received:[],feeds:[]};}
 finally{spotFetching=false;renderSpotReports();}
}

function updateAutoSpot(){
 if(!spotArmed||spotBusy)return;
 if(state.settings.mycall!==spotArmedCall){setSpotArmed(false);return;}
 const now=Date.now(),hz=currentHz(),cs=cat.state,band=bandOf(hz);
 if(!band||!['3','7'].includes(currentMode())||(cs.connected&&(now-cs.fresh>4000||now-cs.modeFresh>4000||cs.split))){
  $('spotStatus').textContent=t('spotWaiting');
  return;
 }
 if(band!==spotBand){
  spotBand=band;
  spotDue=Math.max(now+15000,lastSpotAttempt+spotInterval());
 }
 if(now<spotDue){
  $('spotStatus').textContent=t('spotNext')+' '+Math.ceil((spotDue-now)/1000)+' s';
  return;
 }
 const call=state.settings.mycall;
 if(!validCall(call)){$('spotStatus').textContent=t('validCall');return;}
 spotBusy=true;
 lastSpotAttempt=now;
 spotDue=now+spotInterval();
 void requestJSON(appAPI('api/spots'),spotAuthorization(),{method:'POST',body:{call,hz},timeout:12000}).then(result=>{
  $('spotResult').textContent=t(result.confirmed?'spotConfirmed':'spotQueued');
  void refreshSpotReports();
 }).catch(error=>{
  $('spotResult').textContent=t(error.message.startsWith('SPOT_')?error.message:'spotError');
  setSpotArmed(false);
 }).finally(()=>{spotBusy=false;});
}

function setSpotArmed(armed){
 spotArmed=armed;
 spotArmedCall=armed?state.settings.mycall:'';
 spotBand='';
 spotDue=Date.now()+spotInterval();
 $('spotToggle').textContent=t(armed?'spotStop':'spotStart');
 $('spotStatus').textContent=armed?t('spotWaiting'):'';
}

function spotAuthorization(){
 const code=reports.publishing?.accessCode&&$('spotToken').value.trim();
 return code||(String(state.settings.qrzUser).toUpperCase()===spotArmedCall||String(state.settings.qrzUser).toUpperCase()===state.settings.mycall?qrzLookupSession:'');
}
function setupSpots(){
 try{const saved=localStorage.getItem('sacw-spot-minutes');if(saved)$('spotMinutes').value=saved;}catch{}
 setSpotArmed(false);
 $('spotToggle').onclick=()=>{
  if(spotArmed){setSpotArmed(false);return;}
  if(!validCall(state.settings.mycall)){toast(t('validCall'));return;}
  if(!reports.publishing?.ready||spotReportCall!==state.settings.mycall||!spotAuthorization()||!$('spotPolicy').checked){
   toast(t('spotPermission'));
   return;
  }
  $('spotResult').textContent='';
  setSpotArmed(true);
  spotBand=bandOf(currentHz());
  spotDue=Math.max(spotDue,lastSpotAttempt+spotInterval());
 };
 $('spotPolicy').onchange=()=>setSpotArmed(false);
 $('spotToken').onchange=()=>setSpotArmed(false);
 $('spotMinutes').onchange=()=>{
  $('spotMinutes').value=spotInterval()/60000;
  try{localStorage.setItem('sacw-spot-minutes',$('spotMinutes').value);}catch{}
  if(spotArmed)setSpotArmed(false);
 };
 setInterval(updateAutoSpot,1000);
 setInterval(()=>void refreshSpotReports(),15000);
 void refreshSpotReports();
}
