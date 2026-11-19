import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),build=join(root,'desktop','build');await mkdir(build,{recursive:true});
const assets={};for(const name of ['index.html','sw.js','manifest.webmanifest','icon.svg','serve.mjs','spot-service.js','hamlib-service.js','cat.js','radios.js','qrz-service.js','lookup.js','connectors.js','package.json','CTY-COPYRIGHT.txt','THIRD-PARTY-NODE-LICENSE.txt'])assets[name]=join(root,name);
const config={main:join(root,'desktop','entry.cjs'),output:join(build,'sea.blob'),disableExperimentalSEAWarning:true,useSnapshot:false,useCodeCache:false,assets};await writeFile(join(build,'sea.json'),JSON.stringify(config));
const prepare=spawnSync(process.execPath,['--experimental-sea-config',join(build,'sea.json')],{encoding:'utf8'});if(prepare.status)throw Error(prepare.stderr);
const executable=join(build,'SACW-LOG-Portable.exe');await copyFile(process.execPath,executable);
const tool=process.env.SACW_POSTJECT||join(root,'..','..','work','portable-tools','node_modules','postject','dist','cli.js');const injection=spawnSync(process.execPath,[tool,executable,'NODE_SEA_BLOB',join(build,'sea.blob'),'--sentinel-fuse','NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'],{encoding:'utf8'});if(injection.status)throw Error(injection.stderr||injection.stdout);
// Use the Windows GUI subsystem so launching the portable does not leave a console.
const bytes=await readFile(executable),pe=bytes.readUInt32LE(0x3c),optional=pe+24;bytes.writeUInt16LE(2,optional+68);await writeFile(executable,bytes);console.log('Portable creado: '+executable);
