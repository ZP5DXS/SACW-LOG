import {readFile,writeFile} from 'node:fs/promises';
const read=async name=>(await readFile(new URL(name,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const names=['contest.js','lookup.js','radios.js','cat.js','domain.js','cwsp-members.js','connectors.js','service-config.js','i18n.js','app.js'];
let js='';for(const name of names){let source=await read(name);source=source.replace(/^import .*?;\r?\n/gm,'').replace(/^export \{[^}]*\};?\r?\n?/gm,'').replace(/\bexport (?=(?:async )?(?:const|function|class))/g,'');if(name==='app.js'){const fragment=(await read('options.fragment.js'))+'\n'+(await read('spots.fragment.js')),cty=await read('cty.dat');source=source.replace('setupOptions();paint();',()=>fragment+'\nsetupOptions();setupSpots();paint();').replace('"__CTY_DATA__"',()=>JSON.stringify(cty));}js+=source+'\n';}
const template=await read('index.template.html'),css=await read('style.css');
await writeFile(new URL('index.html',import.meta.url),template.replace('/*STYLE*/',()=>css).replace('/*APP*/',()=>js.replaceAll('</script','<\\/script')));
await writeFile(new URL('../SACW-ZP5DXS.html',import.meta.url),(await read('index.html')).replace('<link rel="manifest" href="manifest.webmanifest">',''));
console.log('SACW index.html creado Â· HTML autÃ³nomo con cÃ³digo y prefijos locales.');
