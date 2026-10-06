// Title-only palette pass. Run after polish-opening-art.mjs if regenerating.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {uuid} from '../artwork/author-art.mjs';
import {decodeResourceBytes} from './resource-bytes.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'verification/visual-polish');
await mkdir(path.join(out,'title-palette-before'),{recursive:true});
const scenePath=path.join(root,'project/scenes/start/scene.gbsres'),bgPath=path.join(root,'assets/backgrounds/campaign-title-complete.png.gbsres');
for(const [p,n] of [[scenePath,'start-scene.gbsres'],[bgPath,'title-background.gbsres']]){try{await readFile(path.join(out,'title-palette-before',n));}catch{await copyFile(p,path.join(out,'title-palette-before',n));}}
const scene=JSON.parse(await readFile(scenePath,'utf8')),bg=JSON.parse(await readFile(bgPath,'utf8'));
const beforeScene=structuredClone(scene),beforeBg=structuredClone(bg);
const logoId=uuid('palette:kanto-title-gold-blue');
const palette={_resourceType:'palette',id:logoId,name:'Kanto Title Gold and Blue',colors:['F8F8E8','F8D030','3868B8','183878'],defaultName:'Kanto Title Gold and Blue',defaultColors:['F8F8E8','F8D030','3868B8','183878']};
scene.paletteIds[2]=logoId;scene.paletteIds[5]='1a99c307-ca90-5ffd-9c28-632ed3e6705f';
const a=decodeResourceBytes(bg.tileColors,{maximumValues:360}),previous=Uint8Array.from(a);
for(let y=7;y<=12;y++)for(let x=8;x<=11;x++)a[y*20+x]=(a[y*20+x]&0xf8)|5;
let encoded='';for(let i=0;i<a.length;){let j=i+1;while(j<a.length&&a[j]===a[i])j++;encoded+=a[i].toString(16).padStart(2,'0')+(j-i===1?'!':(j-i).toString(16)+'+');i=j;}bg.tileColors=encoded;
assert.deepEqual(Object.keys(scene).filter(k=>JSON.stringify(scene[k])!==JSON.stringify(beforeScene[k])),scene.paletteIds[2]===beforeScene.paletteIds[2]&&scene.paletteIds[5]===beforeScene.paletteIds[5]?[]:['paletteIds']);
assert.equal(scene.paletteIds.length,6);assert.equal(scene.paletteIds[4],'default-ui');assert.deepEqual({...bg,tileColors:beforeBg.tileColors},beforeBg);
for(let i=0;i<a.length;i++)if(a[i]!==previous[i])assert.ok(i%20>=8&&i%20<=11&&Math.floor(i/20)>=7&&Math.floor(i/20)<=12);
await writeFile(path.join(root,'project/palettes/kanto_title_gold_blue.gbsres'),JSON.stringify(palette,null,2)+'\n');
await writeFile(scenePath,JSON.stringify(scene,null,2)+'\n');await writeFile(bgPath,JSON.stringify(bg,null,2)+'\n');
await copyFile(bgPath,path.join(out,'after','campaign-title-complete.png.gbsres'));
console.log(JSON.stringify({logoPaletteId:logoId,sceneBackgroundSlots:scene.paletteIds,consumedBackgroundSlots:[...new Set([...a].map(n=>n&7))].sort(),titlePixels:'unchanged',uiHardwareSlot7:'unchanged'}));
