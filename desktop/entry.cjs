// Node SEA entry point. Embedded application files are extracted from the signed-
// format resource, never downloaded or loaded from a third-party script URL.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),sea=require('node:sea'),{createRequire}=require('node:module'),{spawn}=require('node:child_process');
const RELEASE='2.1.4',PORT=18591,root=path.join(process.env.LOCALAPPDATA||os.tmpdir(),'SACW-LOG','app-'+RELEASE);
function openBrowser(){const url='http://127.0.0.1:'+PORT;const edge=path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Microsoft','Edge','Application','msedge.exe');if(fs.existsSync(edge))spawn(edge,['--app='+url],{detached:true,stdio:'ignore',windowsHide:true}).unref();else spawn('cmd.exe',['/c','start','',url],{detached:true,stdio:'ignore',windowsHide:true}).unref();}
async function main(){
 const existing=await fetch('http://127.0.0.1:'+PORT+'/health',{signal:AbortSignal.timeout(600)}).then(r=>r.json()).catch(()=>null);if(existing?.app==='sacw-web'&&existing.version===RELEASE){if(!process.argv.includes('--test-server'))openBrowser();return;}
 fs.mkdirSync(root,{recursive:true});for(const name of sea.getAssetKeys()){const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.from(sea.getAsset(name)));}
 process.env.SACW_LIVE_UPSTREAM='https://zp5dxs.org/sacw/';
 const localRequire=createRequire(path.join(root,'package.json')),serverModule=localRequire(path.join(root,'serve.mjs'));
 const server=serverModule.createServer();server.on('error',e=>{fs.writeFileSync(path.join(root,'startup-error.txt'),e.code||e.message);process.exitCode=1;});server.listen(PORT,'127.0.0.1',()=>{if(!process.argv.includes('--test-server'))openBrowser();});
}
main().catch(e=>{fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'startup-error.txt'),String(e.stack||e));process.exitCode=1;});
