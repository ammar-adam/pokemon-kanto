// Real pinned project loader + QuickJS + native ScriptBuilder differential check.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module');
const root=path.resolve(__dirname,'..');const vendor=path.resolve(process.argv[2]||'');
assert.equal(JSON.parse(fs.readFileSync(path.join(vendor,'package.json'))).version,'4.3.2','pinned compiler version');
const compilerPins={
 'src/lib/compiler/scriptBuilder/scriptBuilder.ts':'cf38cd6c26d21eaa7c9f318569ea34efc4aacfce52c67697d71e06f4a9502a87',
 'src/lib/compiler/scriptBuilder/scriptBuilderBase.ts':'8c84e7c0e1562445a20ba105f4049c83a607bff9641f9fa9c5795bf8e1f4c73c',
 'src/lib/project/loadScriptEventHandlers.ts':'b623e5fbd72dbf7aa7dcb1d010e563102db46a8d45c318d95a678ee3372eb666'
};
for(const [file,hash] of Object.entries(compilerPins))assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(vendor,file))).digest('hex'),hash,'exact pinned loader/builder bytes: '+file);
// Source archives need no Git metadata; never resolve an unrelated ancestor repository.
if(fs.existsSync(path.join(vendor,'.git')))assert.equal(require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:vendor,encoding:'utf8'}).trim(),'ccb891b2670134ba8237416772eea4ed09d34e1e','pinned source commit');
const provenance=JSON.parse(fs.readFileSync(path.join(root,'plugins/kanto-menu/upstream/provenance.json')));
assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(vendor,'src/lib/events/eventMenu.js'))).digest('hex'),provenance.upstreamSHA256,'native core event remains pinned');
process.env.NODE_ENV='test';const requireVendor=Module.createRequire(path.join(vendor,'package.json'));const ts=requireVendor('typescript');
const originalResolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...rest){
 if(request==='#my-quickjs-variant')request=path.join(vendor,'node_modules/@jitl/quickjs-singlefile-cjs-release-sync');
 else if(request==='consts'||request.startsWith('lib/')||request.startsWith('shared/')||request.startsWith('store/'))request=path.join(vendor,'src',request);
 return originalResolve.call(this,request,parent,...rest);
};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true,jsx:ts.JsxEmit.React}}).outputText,filename);
const originalJS=require.extensions['.js'];
require.extensions['.js']=(module,filename)=>filename.startsWith(path.join(vendor,'src')+path.sep)?module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{allowJs:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,filename):originalJS(module,filename);
(async()=>{
 const loadHandlers=require(path.join(vendor,'src/lib/project/loadScriptEventHandlers.ts')).default;
 const ScriptBuilder=require(path.join(vendor,'src/lib/compiler/scriptBuilder/scriptBuilder.ts')).default;
 const compileFonts=require(path.join(vendor,'src/lib/compiler/compileFonts.ts')).default;
 const handlers=await loadHandlers(root);
 assert.ok(handlers.EVENT_KANTO_MENU,'project-local event loaded through actual QuickJS loader');assert.ok(handlers.EVENT_MENU);
 const fontMeta=JSON.parse(fs.readFileSync(path.join(root,'assets/fonts/bench-mono.png.gbsres')));fontMeta.filename='bench-mono.png';
 const fonts=await compileFonts([fontMeta],root);
 const scene={id:'menu_regression',name:'Menu regression',symbol:'scene_menu_regression',width:20,height:18,type:'TOPDOWN',actors:[],triggers:[],sprites:[],parallax:[],actorsExclusiveLookup:{},projectiles:[]};
 function compile(id,args,options={}){
  const output=[];const builder=new ScriptBuilder(output,{scene,scriptEventHandlers:handlers,fonts,defaultFontId:fontMeta.id,...options});
  handlers[id].compile(args,{...builder.options,...builder,event:{id:'menu-regression',command:id,args}});
  return {output,locals:builder.localsLookup,localsSize:builder.localsSize};
 }
 const normalize=output=>output.map(line=>line.replace(/(VM_OVERLAY_CLEAR\s+0, 0, )10,/,(_m,prefix)=>prefix+'20,').replace(/(VM_OVERLAY_MOVE_TO\s+)10,/,(_m,prefix)=>prefix+'0,'));
 const baseline=JSON.parse(fs.readFileSync(path.join(root,'plugins/kanto-menu/upstream/menu-routing-baseline.json')));
 let scoped=0,dialogue=0;
 for(const menu of baseline){
  const native=compile('EVENT_MENU',menu.args);
  if(menu.args.layout==='menu'){
   const fixed=compile('EVENT_KANTO_MENU',menu.args);assert.deepEqual(fixed.output,normalize(native.output),menu.id+' geometry-only diff');assert.equal(fixed.output.filter((line,i)=>line!==native.output[i]).length,4);assert.deepEqual(fixed.locals,native.locals);scoped++;
  }else{const delegated=compile('EVENT_KANTO_MENU',menu.args);assert.deepEqual(delegated,native,'dialogue path unchanged');dialogue++;}
 }
 let matrix=0;
 for(let items=2;items<=8;items++)for(const cancelOnB of [false,true])for(const cancelOnLastOption of [false,true]){
  const args={variable:{type:'argument',symbol:'.SCRIPT_ARG_INDIRECT_0_VARIABLE',indirect:true},items,layout:'menu',cancelOnB,cancelOnLastOption,...Object.fromEntries(Array.from({length:items},(_,i)=>['option'+(i+1),'ITEM '+(i+1)]))};
  const native=compile('EVENT_MENU',args),fixed=compile('EVENT_KANTO_MENU',args);assert.deepEqual(fixed.output,normalize(native.output));assert.deepEqual(fixed.locals,native.locals);assert.equal(fixed.localsSize,native.localsSize);matrix++;
 }
 assert.ok(handlers.EVENT_KANTO_MOVE_MENU,'stored-move event loaded by the actual project loader');
 const stored=compile('EVENT_KANTO_MOVE_MENU',{variable:'14',word1:'100',word2:'101',word3:'102',word4:'103'});
 assert.equal(stored.output.filter(line=>/VM_PUSH_VALUE\s/.test(line)).length,4,'four move words passed');
 assert.ok(stored.output.some(line=>/VM_CALL_NATIVE.*b_kanto_move_menu_prepare.*_kanto_move_menu_prepare/.test(line)),'banked native formatter called');
 assert.ok(stored.output.some(line=>/VM_POP\s+4/.test(line)),'all four input words popped');
 assert.ok(stored.output.some(line=>/VM_OVERLAY_CLEAR\s+0, 0, 20, 6/.test(line)),'four full-width rows');
 assert.ok(handlers.EVENT_KANTO_PARTY_MENU,'owned-party event loaded by the actual project loader');
 for(let items=1;items<=6;items++){
   const party=compile('EVENT_KANTO_PARTY_MENU',{variable:'132',items,...Object.fromEntries(Array.from({length:6},(_,i)=>['word'+(i+1),String(304+i)]))});
   assert.equal(party.output.filter(line=>/VM_PUSH_VALUE\s/.test(line)).length,6);
   assert.ok(party.output.some(line=>/VM_CALL_NATIVE.*b_kanto_party_menu_prepare.*_kanto_party_menu_prepare/.test(line)));
   assert.ok(party.output.some(line=>/VM_POP\s+6/.test(line)));
   assert.ok(party.output.some(line=>new RegExp('VM_OVERLAY_CLEAR\\s+0, 0, 20, '+(items+2)).test(line)));
 }
 assert.ok(handlers.EVENT_KANTO_CALL,'bounded call loaded by the actual project loader');
 let boundedCallABI=0;
 for(const actors of [{},{A0:{id:'A0',name:'Actor'}}])for(const passByReference of [false,true])for(const value of [{type:'variable',value:'14'},{type:'number',value:17}]){
   const fixture={id:'abi_fixture',name:'ABI fixture',actors,variables:{V0:{id:'V0',name:'Value',passByReference}},script:[]};
   const options={customEvents:[fixture],compiledCustomEventScriptCache:{'abi_fixture-undefined':{scriptRef:'script_abi_fixture',argsLen:Object.keys(actors).length+1}}};
   const args={customEventId:'abi_fixture','$actor[A0]$':'player','$variable[V0]$':value};
   assert.deepEqual(compile('EVENT_KANTO_CALL',args,options),compile('EVENT_CALL_CUSTOM_EVENT',args,options),'native actor/value/reference call ABI preserved');boundedCallABI++;
 }
 const loadResources=require(path.join(vendor,'src/lib/project/loadProjectResources.ts')).loadProjectResources;
 const decompress=require(path.join(vendor,'src/shared/lib/resources/compression.ts')).decompressProjectResources;
 const determineUsedAssets=require(path.join(vendor,'src/lib/compiler/precompile/determineUsedAssets.ts')).determineUsedAssets;
 const resources=await loadResources(root,JSON.parse(fs.readFileSync(path.join(root,'project.gbsproj'))));
 const project=decompress(resources),assetStart=Date.now();
 const used=determineUsedAssets({projectData:project,customEventsLookup:Object.fromEntries(project.scripts.map(s=>[s.id,s])),scriptEventHandlers:handlers,warnings:message=>{throw new Error(message);}});
 assert.equal(used.referencedVariables.length,1664,'actual native asset walker preserves the variable budget');
 const requiredSprites=new Set(); const collectSpriteRefs=value=>{if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){if(key==='spriteSheetId'&&typeof item==='string'&&item)requiredSprites.add(item);else if(typeof item==='object')collectSpriteRefs(item);}}; collectSpriteRefs(project.scripts);collectSpriteRefs(project.scenes);assert.ok(requiredSprites.size>=151,'all species sprite resources referenced');for(const id of requiredSprites)assert.ok(used.referencedSprites.some(s=>s.id===id),'native asset walker retains referenced sprite '+id);
 const assetDiscoveryMs=Date.now()-assetStart;assert.ok(assetDiscoveryMs<30000,'actual asset discovery completes within thirty seconds');
 console.log(JSON.stringify({boundedCallABI,assetDiscoveryMs,variables:used.referencedVariables.length,sprites:used.referencedSprites.length,requiredSprites:requiredSprites.size}));
 for(const h of Object.values(handlers))h.cleanup();
 console.log(JSON.stringify({passed:true,compiler:'GB Studio 4.3.2',scope:'actual project loader, QuickJS plugin, real ScriptBuilder',scoped,dialogue,indirectAndCancelCases:matrix,storedMoves:true,ownedPartySizes:6,nativeBuild:false,runtime:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});
