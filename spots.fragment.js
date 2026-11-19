let reports={cluster:[],received:[],feeds:[]},reportKey='',reportCall='',pollingKey='',requestId=0,lastPoll=0,spotOffline=false;

function spotQuery(){
 const call=state.settings.mycall;
 return {call:validCall(call)?call:'',band:bandOf(currentHz())};
}

function renderSpotReports(){
 const {call,band}=spotQuery(),current=reportKey===call+'|'+band;
 const cluster=current?reports.cluster:[],received=reportCall===call?reports.received:[];
 $('clusterBand').textContent=band?band+' m · CW':'CW';
 $('spotFeeds').textContent=['DXFun','RBN'].map(source=>source+' '+(!spotOffline&&reports.feeds.find(feed=>feed.source===source)?.ready?'✓':'—')).join(' · ');
 for(const [id,entries,empty] of [
  ['clusterSpots',cluster,!band?'spotChooseBand':spotOffline?'spotOffline':'spotsEmpty'],
  ['receivedSpots',received,!call?'spotEnterCall':spotOffline?'spotOffline':'spotsEmpty']
 ]){
  $(id).innerHTML=entries.length?entries.map(spot=>{
   const target=id==='clusterSpots'?spot.call:spot.by;
   const detail=id==='clusterSpots'?[spot.by,spot.comment].filter(Boolean).join(' · '):spot.comment;
   return '<li><time>'+new Date(spot.time).toISOString().slice(11,16)+'Z</time><strong>'+esc(target)+'</strong><span>'+formatHz(spot.hz)+' kHz</span><span>'+esc(spot.source)+'</span>'+(detail?'<small>'+esc(detail)+'</small>':'')+'</li>';
  }).join(''):'<li>'+t(empty)+'</li>';
 }
}

async function refreshSpotReports(){
 const {call,band}=spotQuery(),key=call+'|'+band,url=appAPI('api/spots');
 if(!url||pollingKey===key||reportKey===key&&Date.now()-lastPoll<15000)return;
 pollingKey=key;
 const id=++requestId;
 renderSpotReports();
 try{
  const data=await requestJSON(url+'?'+new URLSearchParams({call,band}));
  if(requestId!==id)return;
  if(![data.feeds,cluster,data.received].every(Array.isArray))throw Error('SPOT_RESPONSE');
  reports=data;spotOffline=false;
 }catch{
  if(requestId!==id)return;
  if(reportKey!==key)reports={...reports,cluster:[],received:reportCall===call?reports.received:[]};
  spotOffline=true;
 }finally{
  if(requestId===id){reportKey=key;reportCall=call;pollingKey='';lastPoll=Date.now();renderSpotReports();}
 }
}

function setupSpots(){
 setInterval(()=>void refreshSpotReports(),1000);
 void refreshSpotReports();
}
