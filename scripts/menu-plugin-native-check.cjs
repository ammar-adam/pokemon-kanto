// Real pinned project loader + QuickJS + native ScriptBuilder differential check.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module');
const root=path.resolve(__dirname,'..');const vendor=path.resolve(process.argv[2]||'');
assert.equal(JSON.parse(fs.readFileSync(path.join(vendor,'package.json'))).version,'4.3.2','pinned compiler version');
assert.equal(require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:vendor,encoding:'utf8'}).trim(),'ccb891b2670134ba8237416772eea4ed09d34e1e','pinned source commit');
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
 function compile(id,args){
  const output=[];const builder=new ScriptBuilder(output,{scene,scriptEventHandlers:handlers,fonts,defaultFontId:fontMeta.id});
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
 for(const h of Object.values(handlers))h.cleanup();
 console.log(JSON.stringify({passed:true,compiler:'GB Studio 4.3.2',scope:'actual project loader, QuickJS plugin, real ScriptBuilder',scoped,dialogue,indirectAndCancelCases:matrix,nativeBuild:false,runtime:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});
