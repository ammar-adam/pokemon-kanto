import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { scores,musicId } from '../artwork/music-score.mjs';

const root=path.resolve(import.meta.dirname,'..');
const studio=process.argv[2]||process.env.GB_STUDIO_SOURCE;
if(!studio)throw new Error('Pass the installed GB Studio source folder; it is read only.');
const require=createRequire(path.join(studio,'package.json'));
const {build}=require('esbuild');
await mkdir(path.join(root,'build'),{recursive:true});
const helper=path.join(root,'build/uge-authoring.cjs');
await build({stdin:{contents:'export * from "./src/shared/lib/uge/ugeHelper"; export * from "./src/shared/lib/uge/song";',resolveDir:studio,loader:'ts'},
  bundle:true,platform:'node',format:'cjs',outfile:helper,tsconfig:path.join(studio,'tsconfig.json'),logLevel:'silent'});
const {loadUGESong,saveUGESong,createPattern,createSequenceItem,createSubPattern}=await import(pathToFileURL(helper));
const template=loadUGESong(await readFile(path.join(studio,'src/apps/gbs-music-web/data/template.uge')));
const note=s=>{
  const m=s.match(/^([A-G])(#?)([3-8])$/);
  if(!m)throw new Error('Invalid score note '+s);
  return (Number(m[3])-3)*12+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]?1:0);
};
const output=path.join(root,'assets/music');
await mkdir(output,{recursive:true});
for(const [key,score]of Object.entries(scores)){
  const song=structuredClone(template);
  Object.assign(song,{name:score.name,artist:'Pokemon Kanto homebrew',comment:'Original composition. Not the Nintendo/Game Freak soundtrack.',filename:key,ticksPerRow:score.ticks,timerEnabled:false,patterns:[],sequence:[]});
  const base={length:null,subpatternEnabled:false,subpattern:createSubPattern()};
  song.dutyInstruments=[{...base,index:0,name:'Warm lead',dutyCycle:2,initialVolume:10,volumeSweepChange:-2,frequencySweepTime:0,frequencySweepShift:0},
    {...base,index:1,name:'Quiet arpeggio',dutyCycle:1,initialVolume:4,volumeSweepChange:-3,frequencySweepTime:0,frequencySweepShift:0}];
  song.waveInstruments=[{...base,index:0,name:'Rounded bass',volume:2,waveIndex:0}];
  song.noiseInstruments=[{...base,index:0,name:'Soft hat',length:12,initialVolume:3,volumeSweepChange:-7,bitCount:15}];
  for(const field of ['dutyInstruments','waveInstruments','noiseInstruments']) {
    while(song[field].length<15)song[field].push({...structuredClone(song[field][0]),index:song[field].length,name:'Unused'});
  }
  song.waves=[Array.from({length:32},(_,i)=>Math.round(7.5+7.5*Math.sin(i*Math.PI/16)))];
  for(let section=0;section<score.lead.length;section++){
    const patterns=Array.from({length:4},createPattern),melody=score.lead[section].split(' '),chord=score.chords[section];
    assert.equal(melody.length,16);
    const put=(channel,row,pitch,instrument=0)=>{assert.ok(pitch>=0&&pitch<72);patterns[channel][row]={note:pitch,instrument,effectCode:null,effectParam:null};};
    for(let step=0;step<16;step++){
      if(melody[step]!=='-')put(0,step*4,note(melody[step]));
      put(1,step*4,12+chord[[0,1,2,1][step%4]],1);
      if(step%2===0)put(2,step*4,chord[step%4===0?0:2]);
      if(key!=='refuge'&&step%2===1)put(3,step*4,step%4===3?36:42);
    }
    song.patterns.push(...patterns);song.sequence.push(createSequenceItem(section));
  }
  const bytes=saveUGESong(song),roundtrip=loadUGESong(bytes);
  assert.equal(roundtrip.name,score.name);assert.equal(roundtrip.sequence.length,4);
  assert.ok(roundtrip.patterns.flat().filter(c=>c.note!==null).length>100);
  await writeFile(path.join(output,key+'.uge'),bytes);
  await writeFile(path.join(output,key+'.uge.gbsres'),JSON.stringify({_resourceType:'music',id:musicId(key),name:score.name,symbol:'music_kanto_'+key,filename:key+'.uge',type:'uge',settings:{}},null,2)+'\n');
  console.log(`${key}: ${bytes.length} bytes; official UGE roundtrip passed`);
}
