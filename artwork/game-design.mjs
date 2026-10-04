import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { additionalSpecies, bossTeams, rivalVariants, world, roster, dexId } from './campaign-world.mjs';
import { authorFullCampaign, travelMenu, journeyEvents } from './full-campaign.mjs';
import { authorOpening } from './opening-story.mjs';
import { authorRedProgression } from './red-progression.mjs';
import { damageAuthoring, moveStats } from './battle-damage.mjs';
import { hpAuthoring } from './hp-stats.mjs';
import { moveLearningAuthoring, movesAtLevel } from './move-learning.mjs';
import { playerMoveEffects } from './player-move-effects.mjs';
import { enemyMoveAuthoring, enemyBattleStateAuthoring } from './enemy-moves.mjs';
import { musicId,sceneScore } from './music-score.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ids = JSON.parse(await readFile(path.join(root,'artwork/pokemon-resource-ids.json'),'utf8'));
const art = JSON.parse(await readFile(path.join(root,'artwork/pokemon-asset-plan.json'),'utf8'));
const species = roster.map(p=>({...p,moves:p.moves.map(m=>m==='BUG BITE'?(p.dex===13?'POISON STING':'TACKLE'):m)}));
const uuid = key => { const h=createHash('sha256').update('frontier-game:'+key).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-b${h.slice(17,20)}-${h.slice(20,32)}`; };
let serial = 0;
const E = (command,args={},children) => ({id:uuid('kanto-event:'+serial++),command,args,...(children?{children}:{})});
const N = value => ({type:'number',value});
const V = variable => ({type:'variable',value:String(variable)});
const set = (v,n) => E('EVENT_SET_VALUE',{variable:String(v),value:typeof n==='object'?n:N(n)});
const math = (v,operation,n,other='val') => E('EVENT_VARIABLE_MATH',{vectorX:String(v),operation,other,...(other==='var'?{vectorY:String(n)}:{value:n}),clamp:false});
const rand = (v,minValue,maxValue) => E('EVENT_VARIABLE_MATH',{vectorX:String(v),operation:'set',other:'rnd',minValue,maxValue});
const IF = (v,operator,n,yes,no=[]) => E('EVENT_IF',{condition:{type:{'==':'eq','!=':'ne','<':'lt','>':'gt','<=':'lte','>=':'gte'}[operator],valueA:V(v),valueB:N(n)}},{true:yes,false:no});
const EX = (expression,yes,no=[]) => E('EVENT_IF',{condition:{type:'expression',value:expression}},{true:yes,false:no});
function dialoguePages(text) {
  return [].concat(text).flatMap(page => {
    const lines=[];
    for(const authoredLine of page.split('\n')) {
      let line='';
      for(const word of authoredLine.split(' ')) {
        if(line && line.length+1+word.length>16) { lines.push(line); line=''; }
        line+=(line?' ':'')+word;
      }
      lines.push(line);
    }
    return Array.from({length:Math.ceil(lines.length/3)},(_,i)=>lines.slice(i*3,i*3+3).join('\n'));
  });
}
const say = text => E('EVENT_TEXT',{text:dialoguePages(text),minHeight:4,maxHeight:5,textHeight:3,closeButton:'a',speedIn:0,speedOut:0});
const draw = (text,x,y) => E('EVENT_TEXT_DRAW',{text,x,y,location:'background'});
const menu = (variable,options,cancel=true,layout='dialogue') => E('EVENT_MENU',{variable:String(variable),items:options.length,...Object.fromEntries(options.map((s,i)=>['option'+(i+1),s])),layout,cancelOnB:cancel,cancelOnLastOption:false});
const sfx = (pitch=4,duration=.1) => E('EVENT_SOUND_PLAY_EFFECT',{type:'beep',pitch,duration,wait:false,priority:'medium'});
const hide = actorId => E('EVENT_ACTOR_HIDE',{actorId});
const show = actorId => E('EVENT_ACTOR_SHOW',{actorId});
const label = name => E('EVENT_DEFINE_LABEL',{label:name});
const go = name => E('EVENT_GOTO_LABEL',{label:name});
const switchScene = (key,x,y,direction='down') => E('EVENT_SWITCH_SCENE',{sceneId:ids.scenes[key],x:N(x),y:N(y),direction,fadeSpeed:2});
const invoke = key => E('EVENT_ACTOR_INVOKE',{actorId:uuid('actor:'+key)});
const position = (x,y) => E('EVENT_ACTOR_SET_POSITION',{actorId:'player',x:N(x),y:N(y),units:'tiles'});
const changeSprite = (actor,key,back=false) => [E('EVENT_ACTOR_SET_SPRITE',{actorId:uuid('actor:'+actor),spriteSheetId:ids.sprites[key]}),E('EVENT_ACTOR_SET_STATE',{actorId:uuid('actor:'+actor),spriteStateId:back?ids.back[key]:'',loopAnim:true})];
const fx = actor => E('EVENT_ACTOR_EFFECTS',{actorId:uuid('actor:'+actor),effect:'flicker',timeUnits:'frames',frames:12});
const vars = {
  level:0, active:1, maxHP:2, hp:3, enemy:4, enemyHP:5, enemyMax:6, enemyLevel:7,
  capsules:8,potions:9,caught:10,wins:11,badge:12,choice:13,move:14,roll:15,
  damage:16,guard:17,spent:18,boss:19,bossStage:20,cooldown:21,initialized:22,pauseChoice:23,battleChoice:24,
  partyCount:25,rivalDone:26,starter:27,leechSeed:28,attackDrop:29,enemyAccuracy:68,paralysis:69,
  selectedSpecies:132,cash:133,checkpoint:134,encounterChoice:135,battleStages:136,
  moveType:300,moveBonus:301,enemySleep:302,enemyPoison:303,evolutionMode:304,evolutionSource:305,evolutionDone:306,menuPage:307,attackerType:308,defenderType:309,defenderType2:310,
...Object.fromEntries(species.flatMap((c,i)=>[['own '+c.name,own(i)],['hp '+c.name,hp(i)],['party '+c.name,member(i)],['level '+c.name,lv(i)],['xp '+c.name,xp(i)],...Array.from({length:4},(_,j)=>['pp '+c.name+' slot '+(j+1),pp(i,j)])])),
  ...Object.fromEntries(species.map((c,i)=>['evolved '+c.name,retired(i)])),
  ...Object.fromEntries(Array.from({length:130},(_,i)=>150+i).map(i=>['quest '+i,i]))
};
function own(i){return i<8?30+i:400+(i-8)*10;}
function hp(i){return i<8?40+i:401+(i-8)*10;}
function member(i){return i<8?50+i:402+(i-8)*10;}
function lv(i){return i<8?60+i:403+(i-8)*10;}
function xp(i){return i<8?70+i:404+(i-8)*10;}
function pp(i,j){return i<8?100+i*4+j:405+(i-8)*10+j;}
function retired(i){return i<8?80+i:409+(i-8)*10;}
const plan={variables:Object.entries(vars).map(([name,variableId])=>({name,variableId:String(variableId),symbol:'var_'+name.toLowerCase().replaceAll(/[^a-z0-9_]/g,'_')})),actors:[],triggers:[],scripts:[],customScripts:[]};
const call=name=>E('EVENT_CALL_CUSTOM_EVENT',{customEventId:uuid('custom:'+name)});
const sharedCache=new Set();
function shared(name,events){
  if(!sharedCache.has(name)){sharedCache.add(name);plan.customScripts.push({_resourceType:'script',id:uuid('custom:'+name),name:'Kanto '+name,symbol:'script_kanto_'+name,description:'Shared Kanto game logic',variables:{},actors:{},script:events});}
  return [call(name)];
}
function chunked(name,events,size=8){
  if(sharedCache.has(name))return [call(name)];
  const calls=[];
  for(let at=0;at<events.length;at+=size)calls.push(...shared(name+'_'+at,events.slice(at,at+size)));
  return shared(name,calls);
}
function script(scene,key,events,scriptKey='script',entityType='actor') {
  const target={sceneId:ids.scenes[scene],...(entityType==='scene'?{}:{[entityType+'Id']:uuid(entityType+':'+key)}),scriptKey};
  const existing=plan.scripts.find(s=>JSON.stringify(s.target)===JSON.stringify(target));
  if(existing)existing.events=events;else plan.scripts.push({target,events});
}
function actor(scene,key,name,sprite,x,y,events=[],properties={}) { plan.actors.push({sceneId:ids.scenes[scene],id:uuid('actor:'+key),name,spriteSheetId:ids.sprites[sprite],x,y,direction:'down',properties}); if(events.length)script(scene,key,events); }
function trigger(scene,key,x,y,width,height,events) {plan.triggers.push({sceneId:ids.scenes[scene],id:uuid('trigger:'+key),name:key,x,y,width,height});script(scene,key,events,'script','trigger');}
const stages=enemyBattleStateAuthoring({EX,set,math,say});
const learning=moveLearningAuthoring({species,IF,EX,V,set,math,menu,say,shared,lv,pp,
  onMove:args=>playerEffects(args),
  onStruggle:()=>[say('USED STRUGGLE!'),set(14,1),set(300,1),set(301,50),invoke('attack'),math(3,'sub',4),IF(3,'<',0,[set(3,0)]),...storeHP(),set(18,1)]
});
const restorePP = i => learning.restorePP(i);
const {maxHPEvents,clampHPEvents,resizeHPEvents}=hpAuthoring({species,IF,EX,V,set,math,chunked});
const heal = () => chunked('heal',species.map((_,i)=>EX(`$${own(i)}$ == 1 && $${retired(i)}$ == 0`,[...maxHPEvents(i+1,lv(i),hp(i)),...restorePP(i)])),32);
const loadPokemonHP = i => [set(0,V(lv(i))),...maxHPEvents(i+1,0,2),...clampHPEvents(hp(i),2),set(3,V(hp(i)))];
const loadHP = () => chunked('load_hp',species.map((_,i)=>IF(1,'==',i+1,loadPokemonHP(i))));
const storeHP = () => chunked('store_hp',species.map((_,i)=>IF(1,'==',i+1,[set(hp(i),V(3))])));
const living = () => [...stages.clearPlayer(),set(1,0),...chunked('living',species.map((_,i)=>EX(`$1$ == 0 && $${member(i)}$ == 1 && $${hp(i)}$ > 0`,[set(1,i+1)]))),...loadHP()];
const firstParty = () => [set(1,0),...chunked('first_party',species.map((_,i)=>EX(`$1$ == 0 && $${member(i)}$ == 1`,[set(1,i+1)]))),...loadHP()];
const pop = () => [set(21,1),E('EVENT_SCENE_POP_STATE',{fadeSpeed:2})];
const startBattle = () => [E('EVENT_SCENE_PUSH_STATE'),switchScene('battlefield',9,13)];
const save = () => E('EVENT_SAVE_DATA',{saveSlot:0},{true:[say('RED SAVED\nTHE GAME.')],load:[]});
function speciesMenu(variable=13){
  const pages=[];
  for(let page=0;page<Math.ceil(species.length/7);page++){
    const group=species.slice(page*7,page*7+7),more=(page+1)*7<species.length,options=group.map(c=>c.name);
    if(more)options.push('MORE');
    pages.push(IF(307,'==',page,[menu(variable,options,true,'menu'),...group.map((_,i)=>IF(variable,'==',i+1,[set(132,page*7+i+1)])),...(more?[IF(variable,'==',8,[math(307,'add',1),go('species_page')])]:[]),go('species_done')]));
  }
  return shared('species_menu',[set(132,0),set(307,0),label('species_page'),...pages,label('species_done')]);
}

function partyView() {
  return [say('PARTY $25$/6\nPOKE BALLS $8$\nPOTIONS $9$'),...speciesMenu(),...chunked('party_view',species.map((c,i)=>IF(132,'==',i+1,[IF(member(i),'==',1,[say(`${c.name}\nLV $${lv(i)}$ HP $${hp(i)}$\n${c.type}`),IF(hp(i),'>',0,[set(1,i+1),...loadPokemonHP(i),say(`${c.name}\nLEADS THE PARTY.`)],[say('NEEDS REST.')])],[IF(retired(i),'==',1,[say('THIS POKEMON\nHAS EVOLVED.')],[IF(own(i),'==',1,[say('IN THE PC BOX.')],[say('NOT CAUGHT YET.')])])])])) )];
}
function pokedex(){return [say(`POKEDEX\nCAUGHT $10$/${species.length}`),...speciesMenu(),...chunked('pokedex',species.map((c,i)=>IF(132,'==',i+1,[IF(own(i),'==',1,[say(`NO. ${c.dex}\n${c.name}\n${c.type} POKEMON`)],[say(`${c.name}\nNO DATA YET.`)])])) )];}
function storage(){return [say('BILL\'S PC\nPARTY $25$/6'),...speciesMenu(),...chunked('storage',species.map((c,i)=>IF(132,'==',i+1,[EX(`$${own(i)}$ == 0 || $${retired(i)}$ == 1`,[say('NO POKEMON OF\nTHIS SPECIES IN\nYOUR COLLECTION.')],[IF(member(i),'==',1,[IF(25,'>',1,[set(member(i),0),math(25,'sub',1),IF(1,'==',i+1,[set(1,0)]),say('DEPOSITED\nIN THE PC BOX.')],[say('KEEP ONE POKEMON\nIN YOUR PARTY.')])],[IF(25,'<',6,[set(member(i),1),math(25,'add',1),say('WITHDREW POKEMON.')],[say('PARTY IS FULL.\nDEPOSIT ONE FIRST.')])])])])) ),IF(1,'==',0,firstParty())];}
function pauseMenu() {
  return E('EVENT_SET_INPUT_SCRIPT',{input:['start'],override:true},{true:[E('EVENT_SCRIPT_LOCK'),...shared('field_menu',[menu(23,['POKEMON','POKEDEX','SAVE','BADGES','JOURNEY','TRAVEL','CLOSE'],true,'menu'),IF(23,'==',1,partyView()),IF(23,'==',2,pokedex()),IF(23,'==',3,[save()]),IF(23,'==',4,[say('BADGES\nBOULDER $12$\nCASCADE $150$'),say('THUNDER $151$\nRAINBOW $152$'),say('SOUL $180$\nMARSH $181$'),say('VOLCANO $182$\nEARTH $183$')]),IF(23,'==',5,journeyEvents({IF,say})),IF(23,'==',6,travelMenu({IF,say,menu,switchScene}))]),E('EVENT_SCRIPT_UNLOCK')]});
}
for(const scene of world.map(s=>s.key).filter(s=>s in ids.scenes)) script(scene,scene,[show('player'),pauseMenu()], 'script','scene');

script('title','title',[hide('player'),E('EVENT_REMOVE_INPUT_SCRIPT',{input:['start','select']}),label('title_menu'),menu(13,['NEW GAME','CONTINUE'],false),IF(13,'==',2,[E('EVENT_IF_SAVED_DATA',{saveSlot:0},{true:[E('EVENT_LOAD_DATA',{saveSlot:0})],false:[say('NO SAVE FILE YET.'),go('title_menu')]})]),IF(13,'==',1,[E('EVENT_RESET_VARIABLES'),set(0,5),set(2,0),set(8,6),set(9,3),set(22,1),say(['PROF. OAK:\nWELCOME TO THE\nWORLD OF POKEMON!','RED, YOUR JOURNEY\nBEGINS IN PALLET\nTOWN.','CHOOSE YOUR FIRST\nPOKEMON AT MY LAB.']),switchScene('laboratory',9,12,'up')]),go('title_menu')],'script','scene');

const starter = [IF(1,'==',0,[say('PROF. OAK:\nWHICH POKEMON\nWILL YOU CHOOSE?'),menu(13,species.slice(0,3).map(c=>c.name),false),set(1,V(13)),set(27,V(13)),...species.slice(0,3).map((c,i)=>IF(1,'==',i+1,[set(30+i,1),set(50+i,1),set(60+i,5),...maxHPEvents(i+1,60+i,40+i),...loadPokemonHP(i),...restorePP(i),sfx(6),say(`${c.name} JOINS\nYOUR PARTY!`)])),set(10,1),set(25,1),say(['HERE IS A POKEDEX,\nSIX POKE BALLS,\nAND THREE POTIONS.','BLUE IS WAITING\nOUTSIDE THE LAB.','EXPLORE ROUTE 1.\nTHEN WIN THE\nBOULDER BADGE!'])],[say('PROF. OAK:\nHOW IS YOUR\nPOKEDEX COMING?')])];
actor('laboratory','prof','Professor Oak','oak',9,8,starter);
trigger('laboratory','leave lab',8,17,4,1,[IF(1,'==',0,[say('CHOOSE A PARTNER\nBEFORE YOU LEAVE.'),position(9,15)],[switchScene('fernvale',7,13)])]);
trigger('fernvale','enter lab',7,12,2,1,[switchScene('laboratory',9,15,'up')]);
trigger('arena','leave arena',8,17,4,1,[switchScene('pewter',24,13)]);
trigger('fernvale','north route',14,1,4,1,[IF(1,'==',0,[say('VISIT PROF. OAK\nAT THE LAB FIRST.'),position(15,3)],[switchScene('route_one',15,29,'up')])]);
trigger('route_one','south town',14,30,4,2,[switchScene('fernvale',15,3)]);

actor('fernvale','nurse','Nurse Joy','joy',19,22,[say('NURSE JOY:\nWE WILL HEAL\nYOUR POKEMON.'),...heal(),...loadHP(),sfx(5),sfx(7),say('HP AND PP\nFULLY RESTORED.\nSUPPLIES REFILLED.')]);
actor('fernvale','kid','Blue','blue',11,17,[EX('$26$ == 1 || $26$ == 3',[say('BLUE:\nBROCK IS TOUGH.\nKEEP TRAINING!')],[say('BLUE:\nLET\'S SEE YOUR\nNEW POKEMON!'),menu(13,['BATTLE','LATER']),IF(13,'==',1,[set(19,2),set(20,1),...startBattle()])])]);
actor('fernvale','journal','Bills PC','oak',18,16,storage());
actor('route_one','scout','Youngster','blue',18,22,[EX('$26$ >= 2',[say('YOUNGSTER:\nYOUR POKEMON\nARE STRONG!')],[say('YOUNGSTER:\nMY PIDGEY\nIS READY!'),menu(13,['BATTLE','LATER']),IF(13,'==',1,[set(19,3),set(20,1),...startBattle()])])]);
const champion=[IF(12,'==',1,[say('BROCK:\nYOUR BOULDER\nBADGE IS PROOF\nOF YOUR VICTORY.')],[say('BROCK:\nI BELIEVE IN MY\nROCK POKEMON.'),menu(13,['CHALLENGE','LATER']),IF(13,'==',1,[set(19,1),set(20,1),...startBattle()])])];
actor('arena','champion','Brock','brock',9,5,champion);
actor('arena','judge','Gym Guide','oak',3,10,[say('WATER AND GRASS\nWORK WELL AGAINST\nROCK POKEMON.')]);

const patches=[{x:4,y:5,h:7,types:[2,4]},{x:20,y:5,h:7,types:[1,7]},{x:4,y:15,h:6,types:[3,5]},{x:20,y:15,h:6,types:[6,5]},{x:4,y:24,h:4,types:[8,4]}];
for(let p=0;p<patches.length;p++){const a=patches[p];for(let y=a.y;y<a.y+a.h;y+=2){trigger('route_one',`grass ${p} ${y}`,a.x,y,8,1,[IF(21,'==',1,[set(21,0)],[rand(15,1,3),IF(15,'==',1,[set(19,0),rand(15,0,1),IF(15,'==',0,[set(4,a.types[0])],[set(4,a.types[1])]),rand(7,2,4),...maxHPEvents(V(4),7,6),set(5,V(6)),...startBattle()])])]);}}

actor('battlefield','enemy','Opponent','charmander',14,7,[],{collisionGroup:'none'});
actor('battlefield','partner','Partner','charmander',2,11,[],{collisionGroup:'none'});
const hiddenLogic=['hud','attack','counter','party','bag','victory','fight','boss-config','gain-xp','heal-all','fight0','fight1','fight2','fight3','fight4'];
for(const [index,key] of hiddenLogic.entries()) actor('battlefield',key,key.toUpperCase(),'logic',0,index*3%18,[],{collisionGroup:'none'});

// Identity uploads are infrequent; a hit only redraws the three numeric rows.
function identify(variable, render, rows=species.map((c,i)=>({c,id:i+1})),inChunk=false) {
  if(!inChunk&&rows.length<=16)return shared('identity_'+variable+'_'+rows[0].id,identify(variable,render,rows,true));
  if(rows.length===1)return [IF(variable,'==',rows[0].id,render(rows[0].c))];
  const mid=Math.floor(rows.length/2);
  return [IF(variable,'<',rows[mid].id,identify(variable,render,rows.slice(0,mid),inChunk),identify(variable,render,rows.slice(mid),inChunk))];
}
const identity=()=>shared('battle_identity',[
  ...identify(4,c=>[...changeSprite('enemy',c.key),draw(c.name.padEnd(10,' '),1,0),draw(`L$7$ ${c.type.padEnd(8,' ')}`,1,1)]),
  ...identify(1,c=>[...changeSprite('partner',c.key,true),draw(c.name.padEnd(10,' '),9,9)])
]);
const hud=[draw('HP %D3$5$/%D3$6$',1,2),draw('HP %D3$3$/%D3$2$',9,10),draw('LV %D3$0$',9,11)];
script('battlefield','hud',hud);

const types=['NORMAL','FIRE','WATER','GRASS','ELECTRIC','ICE','FIGHTING','POISON','GROUND','FLYING','PSYCHIC','BUG','ROCK','GHOST','DRAGON'];
function typeCode(type){return types.indexOf(type)+1;}
const damage=damageAuthoring({species,IF,EX,V,set,math,chunked,shared,typeCode});
const typeChart={
  NORMAL:[[],['ROCK'],['GHOST']],FIRE:[['GRASS','ICE','BUG'],['FIRE','WATER','ROCK','DRAGON'],[]],
  WATER:[['FIRE','GROUND','ROCK'],['WATER','GRASS','DRAGON'],[]],GRASS:[['WATER','GROUND','ROCK'],['FIRE','GRASS','POISON','FLYING','BUG','DRAGON'],[]],
  ELECTRIC:[['WATER','FLYING'],['ELECTRIC','GRASS','DRAGON'],['GROUND']],ICE:[['GRASS','GROUND','FLYING','DRAGON'],['WATER','ICE'],[]],
  FIGHTING:[['NORMAL','ICE','ROCK'],['POISON','FLYING','PSYCHIC','BUG'],['GHOST']],POISON:[['GRASS','BUG'],['POISON','GROUND','ROCK','GHOST'],[]],
  GROUND:[['FIRE','ELECTRIC','POISON','ROCK'],['GRASS','BUG'],['FLYING']],FLYING:[['GRASS','FIGHTING','BUG'],['ELECTRIC','ROCK'],[]],
  PSYCHIC:[['FIGHTING','POISON'],['PSYCHIC'],[]],BUG:[['GRASS','POISON','PSYCHIC'],['FIRE','FIGHTING','FLYING','GHOST'],[]],
  ROCK:[['FIRE','ICE','FLYING','BUG'],['FIGHTING','GROUND'],[]],GHOST:[['GHOST'],[],['NORMAL','PSYCHIC']],DRAGON:[['DRAGON'],[],[]]
};
function effectiveness(attacker,defender,message=false){return [
  ...chunked('types_'+attacker,species.flatMap((c,i)=>[IF(attacker,'==',i+1,[set(308,typeCode(c.types[0]))]),IF(defender,'==',i+1,[set(309,typeCode(c.types[0])),set(310,typeCode(c.types[1]))])])),
  IF(300,'>',0,[set(308,V(300))]),
  ...chunked('chart',Object.entries(typeChart).map(([type,groups])=>IF(308,'==',typeCode(type),groups.flatMap((group,g)=>group.flatMap(target=>[309,310].map(variable=>IF(variable,'==',typeCode(target),g===2?[set(16,0)]:g===0?[math(16,'mul',2)]:[IF(16,'>',0,[math(16,'div',2),IF(16,'==',0,[set(16,1)])])]))))))),
  ...(message?[IF(16,'==',0,[say('IT HAS NO EFFECT!')])]:[])
];}
script('battlefield','attack',[IF(300,'==',0,[set(300,1)]),IF(301,'<=',0,[set(301,40)]),...damage.base(1,4,0,7),...stages.playerDamage(),...effectiveness(1,4,true),rand(15,1,16),IF(15,'==',1,[math(16,'mul',2),say('A CRITICAL HIT!')]),rand(15,217,255),...damage.variance(),math(5,'sub',16,'var'),IF(5,'<',0,[set(5,0)]),sfx(3),fx('enemy'),invoke('hud')]);

const enemyMoves=enemyMoveAuthoring({species,getMoves:(p,level)=>movesAtLevel(p.dex,level),IF,EX,V,set,math,rand,say,shared,chunked,typeCode,damage,effectiveness,storeHP,invoke,sfx,fx,
  statusEffects:{...stages.statusEffects,SWITCH_AND_TELEPORT_EFFECT:()=>[IF(19,'==',0,[say('THE FOE FLED!'),...pop()],[say('BUT IT FAILED!')])]},damageModifiers:stages.enemyDamage
});
script('battlefield','counter',enemyMoves.counter());

script('battlefield','party',[...speciesMenu(),...species.map((c,i)=>IF(132,'==',i+1,[EX(`$${member(i)}$ == 1 && $${hp(i)}$ > 0`,[IF(1,'==',i+1,[say('ALREADY IN BATTLE.')],[...stages.clearPlayer(),set(1,i+1),...loadPokemonHP(i),set(18,1),set(17,0),invoke('hud'),say(`GO, ${c.name}!`)])],[say('NOT IN PARTY\nOR NEEDS REST.')])]))]);

function registerPokemon(caught=false){return chunked(caught?'register_caught':'register',species.map((c,i)=>IF(4,'==',i+1,[
  EX(`$${own(i)}$ == 0 || $${retired(i)}$ == 1`,[
    IF(own(i),'==',0,[set(own(i),1),math(10,'add',1)]),set(retired(i),0),set(lv(i),V(7)),set(xp(i),0),
    ...(caught?[...maxHPEvents(i+1,lv(i),16),set(hp(i),V(5)),...clampHPEvents(hp(i),16)]:maxHPEvents(i+1,lv(i),hp(i))),...restorePP(i),
    IF(25,'<',6,[set(member(i),1),math(25,'add',1)],[say('PARTY FULL.\nSENT TO BILL\'S PC.')])
  ],[say('ALREADY IN YOUR\nCOLLECTION.')]),say(`${c.name}\nWAS REGISTERED!`)
])));}
function capture(master=false){return [IF(19,'!=',0,[say('DO NOT STEAL\nA TRAINER\'S\nPOKEMON!')],[
  IF(master?202:8,'==',0,[say(master?'NO MASTER BALL.':'NO POKE BALLS\nLEFT.')],[
    math(master?202:8,'sub',1),set(18,1),
    ...(master?[set(15,1)]:[rand(15,1,100),set(16,V(6)),math(16,'div',3),EX('$5$ <= $16$ || $15$ <= 35',[set(15,1)],[set(16,V(6)),math(16,'div',2),EX('$5$ <= $16$ && $15$ <= 75',[set(15,1)],[set(15,0)])])]),
    sfx(4),fx('enemy'),IF(15,'==',1,[...registerPokemon(true),sfx(7),...pop()],[say('IT BROKE FREE!')])
  ])
])];}
script('battlefield','bag',[menu(13,['POKE BALL','POTION','BACK','MASTER BALL']),IF(13,'==',1,capture()),IF(13,'==',4,capture(true)),IF(13,'==',2,[IF(9,'==',0,[say('NO POTIONS LEFT.')],[EX('$3$ >= $2$',[say('HP IS ALREADY FULL.')],[math(9,'sub',1),math(3,'add',20),EX('$3$ > $2$',[set(3,V(2))]),...storeHP(),set(18,1),invoke('hud'),sfx(6),say('POTION RESTORED HP.')])])])]);

function configureBoss(){return [
  ...Object.entries(bossTeams).map(([mode,team])=>IF(19,'==',Number(mode),team.team.map(([pokemon,level],i)=>IF(20,'==',i+1,[set(4,pokemon),set(7,level)])))),
  IF(19,'==',2,[IF(27,'==',1,[set(4,3)]),IF(27,'==',2,[set(4,1)]),IF(27,'==',3,[set(4,2)]),set(7,5)]),
  ...Object.entries(rivalVariants).map(([mode,variants])=>IF(19,'==',Number(mode),Object.entries(variants).map(([starter,pairs])=>IF(27,'==',Number(starter),pairs.map(([dex,level],i)=>IF(20,'==',bossTeams[mode].team.length-pairs.length+i+1,[set(4,dexId(dex)),set(7,level)])))))),
  IF(19,'==',3,[set(4,8),set(7,6)]),...maxHPEvents(V(4),7,6),set(5,V(6)),...stages.clearEnemy(),set(28,0),set(29,0),set(68,0),set(69,0),set(302,0),set(303,0)];}
script('battlefield','boss-config',configureBoss());
script('battlefield','heal-all',heal());
const gainXP=()=>species.map((c,i)=>IF(1,'==',i+1,[math(xp(i),'add',7,'var'),set(16,V(lv(i))),math(16,'mul',2),EX(`$${xp(i)}$ >= $16$ && $${lv(i)}$ < 100`,[math(xp(i),'sub',16,'var'),...maxHPEvents(i+1,lv(i),16),math(lv(i),'add',1),set(0,V(lv(i))),...maxHPEvents(i+1,0,2),...resizeHPEvents(hp(i),16,2),set(3,V(hp(i))),say(`${c.name}\nGREW TO LV $0$!`),...learning.learnLevel(i)])]));
function evolve(){
  const itemModes={'water-stone':1,'thunder-stone':2,'fire-stone':3,'leaf-stone':4,'moon-stone':5};
  return [set(305,V(1)),set(306,0),...chunked('evolution',species.flatMap((c,i)=>c.evolutions.map(e=>{
    const target=e.to-1,mode=e.trigger==='trade'?6:itemModes[e.item]||0;
    if(e.trigger==='level-up'&&!e.level)return null;
    return EX(`$305$ == ${i+1} && $306$ == 0 && $304$ == ${mode} && $${member(i)}$ == 1 && $${lv(i)}$ >= ${e.level||1} && ($${own(target)}$ == 0 || $${retired(target)}$ == 1)`,[
      say(`WHAT? ${c.name}\nIS EVOLVING!`),IF(own(target),'==',0,[set(own(target),1),math(10,'add',1)]),
      set(retired(target),0),set(retired(i),1),set(member(i),0),set(member(target),1),set(lv(target),V(lv(i))),set(xp(target),V(xp(i))),set(hp(target),V(hp(i))),
      ...maxHPEvents(i+1,lv(i),16),...maxHPEvents(e.to,lv(target),2),...resizeHPEvents(hp(target),16,2),set(hp(i),0),...restorePP(target),set(1,e.to),set(306,1),sfx(7),say(`IT EVOLVED INTO\n${species[target].name}!`)
    ]);
  }).filter(Boolean))),...loadHP()];
}
script('battlefield','gain-xp',[...gainXP(),set(304,0),...evolve()]);
const trainerVictory=Object.entries(bossTeams).filter(([mode])=>Number(mode)!==1).map(([mode,team])=>IF(19,'==',Number(mode),[
  IF(20,'<',team.team.length,[math(20,'add',1),invoke('boss-config'),invoke('hud'),say(`${team.name}\nSENT ANOTHER\nPOKEMON!`)],[
    set(team.badge||team.flag,1),set(16,V(7)),math(16,'mul',10),math(16,'add',100),math(133,'add',16,'var'),IF(133,'>',9999,[set(133,9999)]),
    ...(team.leagueStep?[set(195,team.leagueStep)]:[]),say(team.badge?`${team.name}\nAWARDED A BADGE!`:`${team.name}\nWAS DEFEATED!`),
    ...(team.badge?[invoke('heal-all'),...loadHP()]:[]),...pop()
  ])
])) ;
script('battlefield','victory',[...storeHP(),sfx(7),say('FOE POKEMON\nFAINTED!'),math(11,'add',1),invoke('gain-xp'),IF(19,'==',1,[IF(20,'<',2,[math(20,'add',1),invoke('boss-config'),invoke('hud'),say('BROCK SENT\nOUT ONIX!')],[set(12,1),say(['BROCK:\nI TOOK YOU\nFOR GRANTED.','RED RECEIVED\nTHE BOULDER BADGE!','ROUTE THREE\nIS NOW OPEN.']),invoke('heal-all'),...loadHP(),...pop()])],[...trainerVictory,IF(19,'<=',3,[IF(19,'==',2,[math(26,'add',1),say('BLUE:\nSMELL YOU LATER!')]),IF(19,'==',3,[math(26,'add',2),say('YOUNGSTER:\nI LOST!')]),IF(19,'==',0,[IF(8,'<',20,[math(8,'add',1)]),say('FOUND A POKE BALL.')]),...pop()])])]);

const playerEffects=playerMoveEffects({IF,EX,V,set,math,rand,say,invoke,storeHP,effectiveness,typeCode,pop,statusEffects:stages.playerStatusEffects});
const fight=indexes=>learning.fight(indexes);
for(let i=0;i<5;i++)script('battlefield','fight'+i,fight(Array.from({length:4},(_,j)=>i*4+j)));
script('battlefield','fight',Array.from({length:Math.ceil(species.length/4)},(_,i)=>EX(`$1$ >= ${i*4+1} && $1$ <= ${i*4+4}`,i<5?[invoke('fight'+i)]:shared('fight_'+i,fight(Array.from({length:Math.min(4,species.length-i*4)},(_,j)=>i*4+j))))));

const battle=[...stages.reset(),hide('player'),E('EVENT_REMOVE_INPUT_SCRIPT',{input:['start','select']}),...hiddenLogic.map(h=>hide(uuid('actor:'+h))),set(17,0),set(28,0),set(29,0),set(68,0),set(69,0),set(300,0),set(301,0),set(302,0),set(303,0),...loadHP(),IF(3,'<=',0,living()),IF(19,'!=',0,[invoke('boss-config')]),invoke('hud'),IF(19,'!=',0,[IF(19,'==',2,[say('BLUE WANTS\nTO BATTLE!')],[IF(19,'==',3,[say('YOUNGSTER WANTS\nTO BATTLE!')],[...Object.entries(bossTeams).map(([mode,team])=>IF(19,'==',Number(mode),[say(`${team.name}\nWANTS TO BATTLE!`)]))])])],[...species.map((c,i)=>IF(4,'==',i+1,[say(`WILD ${c.name}\nAPPEARED!`)]))]),label('turn'),IF(3,'<=',0,living()),IF(1,'==',0,[say('RED HAS NO\nPOKEMON LEFT!'),set(195,0),invoke('heal-all'),set(1,0),...living(),E('EVENT_SCENE_RESET_STATE'),
  IF(134,'==',7,[switchScene('fuchsia',18,21)]),IF(134,'==',8,[switchScene('saffron',18,21)]),IF(134,'==',9,[switchScene('cinnabar',18,21)]),IF(134,'==',10,[switchScene('indigo',18,21)]),
  IF(134,'==',1,[switchScene('viridian',18,21)]),IF(134,'==',2,[switchScene('pewter',18,21)]),IF(134,'==',3,[switchScene('cerulean',18,21)]),IF(134,'==',4,[switchScene('vermilion',18,21)]),IF(134,'==',5,[switchScene('lavender',18,21)]),IF(134,'==',6,[switchScene('celadon',18,21)]),switchScene('fernvale',18,21)]),set(18,0),invoke('hud'),menu(24,['FIGHT','BAG','POKEMON','RUN'],false),
  IF(24,'==',1,[invoke('fight')]),
  IF(24,'==',2,[invoke('bag')]),IF(24,'==',3,[invoke('party')]),IF(24,'==',4,[IF(19,'!=',0,[say('NO RUNNING FROM\nA TRAINER BATTLE!')],[say('GOT AWAY SAFELY.'),...pop()])]),
IF(18,'==',1,[
  IF(5,'<=',0,[set(5,0),IF(3,'<=',0,living()),IF(1,'>',0,[invoke('victory')]),go('turn')]),
  IF(3,'>',0,[invoke('counter')]),
  ...shared('end_turn_residual',[
    EX('$303$ == 1 && $5$ > 0 && $3$ > 0',[
      set(16,V(6)),math(16,'div',16),IF(16,'<',1,[set(16,1)]),math(5,'sub',16,'var'),IF(5,'<',0,[set(5,0)]),
      invoke('hud'),say('POISON HURTS\nTHE FOE!')]),
    EX('$28$ == 1 && $5$ > 0 && $3$ > 0',[
      set(16,V(6)),math(16,'div',16),IF(16,'<',1,[set(16,1)]),EX('$16$ > $5$',[set(16,V(5))]),
      math(5,'sub',16,'var'),math(3,'add',16,'var'),EX('$3$ > $2$',[set(3,V(2))]),...storeHP(),
      invoke('hud'),say('LEECH SEED\nDRAINED THE FOE!')])
  ]),
  IF(5,'<=',0,[set(5,0),IF(3,'<=',0,living()),IF(1,'>',0,[invoke('victory')]),go('turn')]),
  IF(3,'<=',0,[say('YOUR POKEMON\nFAINTED!'),...living(),IF(1,'>',0,[set(17,0),invoke('hud'),say('THE NEXT POKEMON\nTAKES THE FIELD.')])])
]),go('turn')];
script('battlefield','battlefield',battle,'script','scene');
// The Kanto route is a series of authored scenes; every gate has a reachable return.
const enter=(from,key,x,y,w,h,to,tx,ty,guard=null)=>trigger(from,key,x,y,w,h,guard? [IF(guard.variable,'==',guard.value,[switchScene(to,tx,ty,guard.direction||'up')],[say(guard.message)])]:[switchScene(to,tx,ty)]);
enter('route_one','north viridian',14,1,4,1,'viridian',15,23);
enter('viridian','south route one',14,24,4,2,'route_one',15,3);
enter('viridian','north forest',14,1,4,1,'forest',15,29);
enter('forest','south viridian',14,30,4,2,'viridian',15,3);
enter('forest','north pewter',14,1,4,1,'pewter',15,23);
enter('pewter','south forest',14,24,4,2,'forest',15,3);
enter('pewter','east route three',30,15,2,3,'route_three',3,16,{variable:12,value:1,message:'BROCK WILL OPEN\nTHE ROAD EAST.'});
enter('route_three','west pewter',1,15,2,3,'pewter',28,16);
enter('route_three','north mt moon',14,1,4,1,'mt_moon',15,28);
enter('mt_moon','south route three',14,30,4,2,'route_three',15,27);
enter('mt_moon','north cerulean',14,1,4,1,'cerulean',3,16,{variable:153,value:1,message:'TEAM ROCKET\nBLOCKS THE EXIT.'});
enter('cerulean','west mt moon',1,15,2,3,'mt_moon',28,16);
enter('cerulean','north bridge',14,1,4,1,'nugget_bridge',15,28);
enter('nugget_bridge','south cerulean',14,30,4,2,'cerulean',15,3);
enter('nugget_bridge','north bill house',14,1,4,1,'bill_house',9,15,{variable:155,value:1,message:'THE ROCKET\nGRUNT BLOCKS\nBILLS HOUSE.'});
enter('bill_house','south nugget bridge',8,17,4,1,'nugget_bridge',15,3);
enter('cerulean','south route five',14,24,4,2,'route_five',15,28,{variable:150,value:1,message:'WIN THE CASCADE\nBADGE TO GO SOUTH.'});
enter('route_five','north cerulean via route five',14,1,4,1,'cerulean',15,3);
enter('route_five','south vermilion',14,30,4,2,'vermilion',15,23);
enter('vermilion','north route five',14,1,4,1,'route_five',15,3);
enter('vermilion','east route nine',30,15,2,3,'route_nine',3,16,{variable:151,value:1,message:'LT SURGE BLOCKS\nTHE WAY EAST.'});
enter('route_nine','west vermilion',1,15,2,3,'vermilion',28,16);
enter('route_nine','north rock tunnel',14,1,4,1,'rock_tunnel',15,28);
enter('rock_tunnel','south route nine',14,30,4,2,'route_nine',15,27);
enter('rock_tunnel','north lavender',14,1,4,1,'lavender',15,23);
enter('lavender','south rock tunnel',14,24,4,2,'rock_tunnel',15,3);
enter('lavender','east route eight',30,15,2,3,'route_eight',3,16);
enter('route_eight','west lavender',1,15,2,3,'lavender',28,16);
enter('route_eight','north celadon',14,1,4,1,'celadon',15,23);
enter('celadon','south route eight',14,24,4,2,'route_eight',15,3);
enter('celadon','rocket hideout',6,18,2,1,'rocket_hideout',15,27);
enter('rocket_hideout','leave hideout',14,30,4,2,'celadon',6,17);
enter('fernvale','enter red house',24,12,2,1,'red_house',9,15);
enter('red_house','leave red house',8,17,4,1,'fernvale',24,13);
enter('pewter','enter pewter gym',24,12,2,1,'arena',9,15);
enter('cerulean','enter cerulean gym',24,12,2,1,'cerulean_gym',9,15);
enter('cerulean_gym','leave cerulean gym',8,17,4,1,'cerulean',24,13);
enter('vermilion','enter vermilion gym',24,12,2,1,'vermilion_gym',9,15,{variable:158,value:1,message:'THE GYM NEEDS\nCUT. VISIT THE\nSS ANNE CAPTAIN.'});
enter('vermilion_gym','leave vermilion gym',8,17,4,1,'vermilion',24,13);
enter('celadon','enter celadon gym',24,12,2,1,'celadon_gym',9,15,{variable:159,value:1,message:'TEAM ROCKET IS\nHIDING NEARBY.'});
enter('celadon_gym','leave celadon gym',8,17,4,1,'celadon',24,13);
enter('vermilion','board ss anne',23,19,4,2,'ss_anne',11,21,{variable:157,value:1,message:'THE SHIP NEEDS\nA S.S. TICKET.'});
enter('ss_anne','leave ss anne',10,23,4,1,'vermilion',24,20);

const healer=(scene,checkpoint)=>{actor(scene,scene+' nurse','Nurse Joy','joy',19,22,[say('NURSE JOY:\nYOUR POKEMON\nNEED A REST.'),...heal(),...loadHP(),set(134,checkpoint),sfx(7),say('EVERYONE IS\nFULLY RESTORED.')]);};
for(const [scene,checkpoint]of [['viridian',1],['pewter',2],['cerulean',3],['vermilion',4],['lavender',5],['celadon',6]])healer(scene,checkpoint);
actor('red_house','mom','Mom','joy',9,8,[say('MOM:\nREST HERE, RED.'),...heal(),...loadHP(),say('YOUR POKEMON\nLOOK GREAT!')]);
const trainer=(scene,key,name,sprite,x,y,mode,flag)=>{const portrait=/ROCKET/i.test(name)?'trainer-rocket':/BUG CATCHER/i.test(name)?'trainer-catcher':/SAILOR/i.test(name)?'trainer-sailor':sprite;actor(scene,key,name,portrait,x,y,[IF(flag,'==',1,[say(`${name}:\nYOU WON OUR\nLAST BATTLE!`)],[say(`${name}:\nLET US BATTLE!`),menu(13,['BATTLE','LATER']),IF(13,'==',1,[set(19,mode),set(20,1),...startBattle()])])]);};
trainer('forest','forest scout','BUG CATCHER','blue',12,9,14,167);
trainer('forest','forest catcher','Bug Catcher','oak',20,19,15,168);
trainer('forest','forest expert','Forest Ranger','brock',11,24,16,169);
trainer('forest','forest kid','Bug Catcher II','blue',22,8,11,164);
trainer('route_three','route three lass','Lass','joy',12,12,13,166);
trainer('route_three','route three hiker','Youngster','blue',20,22,12,165);
trainer('mt_moon','moon rocket','Rocket Grunt','blue',15,10,7,153);
trainer('mt_moon','moon hiker','Moon Hiker','brock',20,23,22,173);
trainer('nugget_bridge','bridge grunt','Bridge Rocket','blue',15,9,9,155);
trainer('nugget_bridge','bridge scout','Bridge Scout','oak',18,22,25,176);
trainer('route_five','route five swimmer','Swimmer','blue',12,17,18,171);
trainer('ss_anne','ship sailor','Sailor','brock',6,11,21,172);
trainer('ss_anne','ship gentleman','Gentleman','oak',18,11,23,174);
trainer('ss_anne','ship blue','Blue','blue',11,8,10,162);
trainer('route_nine','route nine hiker','Hiker II','brock',20,18,26,177);
trainer('rock_tunnel','tunnel hiker','Tunnel Hiker','brock',12,17,27,178);
trainer('route_eight','route eight lass','Lass II','joy',20,10,28,179);
trainer('celadon','garden trainer','Gardener','joy',11,20,24,175);
trainer('rocket_hideout','hideout grunt','Rocket Guard','blue',13,13,17,170);
actor('mt_moon','moon fossil','Moon Fossils','oak',20,5,[IF(153,'==',1,[IF(154,'==',0,[say('THE ROCKETS LEFT\nTWO FOSSILS.'),menu(13,['HELIX','DOME','LATER']),IF(13,'==',1,[set(154,1),say('HELIX FOSSIL\nIS YOURS!')]),IF(13,'==',2,[set(154,2),say('DOME FOSSIL\nIS YOURS!')])],[say('KEEP THAT FOSSIL\nSAFE, RED.')])],[say('TEAM ROCKET IS\nSTILL INSIDE.')])]);
actor('bill_house','bill','Bill','oak',9,7,[IF(156,'==',1,[say('BILL:\nHOW IS KANTO?')],[say('BILL:\nTHANKS FOR\nVISITING MY PC!'),set(156,1),set(157,1),say('HERE IS AN\nS.S. TICKET!')])]);
actor('ss_anne','captain','S.S. Captain','oak',12,5,[IF(158,'==',1,[say('CAPTAIN:\nUSE CUT TO OPEN\nVERMILION GYM.')],[say('CAPTAIN:\nYOU HELPED BILL?\nTAKE HM CUT!'),set(158,1),say('HM01 CUT IS\nNOW YOURS!')])]);
actor('rocket_hideout','lift key','Lift Key','oak',20,6,[IF(160,'==',1,[say('YOU HAVE THE\nLIFT KEY.')],[IF(170,'==',1,[set(160,1),say('FOUND THE\nLIFT KEY!')],[say('A ROCKET GUARD\nHAS THE KEY.')])])]);
actor('rocket_hideout','giovanni','Giovanni','trainer-giovanni',15,5,[IF(159,'==',1,[say('GIOVANNI:\nTEAM ROCKET WILL\nREMEMBER YOU.')],[IF(160,'==',1,[say('GIOVANNI:\nTHE HIDEOUT\nIS MINE.'),menu(13,['CHALLENGE','LATER']),IF(13,'==',1,[set(19,8),set(20,1),...startBattle()])],[say('THE LIFT NEEDS\nA KEY.')])])]);
actor('cerulean_gym','misty','Misty','trainer-misty',9,5,[IF(150,'==',1,[say('MISTY:\nYOUR CASCADE\nBADGE SHINES!')],[say('MISTY:\nMY WATER POKEMON\nARE READY!'),menu(13,['CHALLENGE','LATER']),IF(13,'==',1,[set(19,4),set(20,1),...startBattle()])])]);
for(const [x,step]of [[5,1],[9,2],[14,3]])actor('vermilion_gym','switch '+step,'Electric Switch','oak',x,10,[IF(163,'==',step-1,[set(163,step),say(`SWITCH ${step}\nIS ON!`)],[set(163,0),say('THE LOCK\nRESET ITSELF.')])]);
actor('vermilion_gym','surge','Lt. Surge','trainer-surge',9,5,[IF(151,'==',1,[say('SURGE:\nYOUR THUNDER\nBADGE IS EARNED!')],[IF(163,'==',3,[say('SURGE:\nSHOW ME YOUR\nELECTRIC POWER!'),menu(13,['CHALLENGE','LATER']),IF(13,'==',1,[set(19,5),set(20,1),...startBattle()])],[say('THREE SWITCHES\nOPEN THE GYM\nLOCK IN ORDER.')])])]);
actor('celadon_gym','erika','Erika','trainer-erika',9,5,[IF(152,'==',1,[say('ERIKA:\nYOUR RAINBOW\nBADGE IS LOVELY.')],[say('ERIKA:\nGRASS CAN SURPRISE\nANYONE.'),menu(13,['CHALLENGE','LATER']),IF(13,'==',1,[set(19,6),set(20,1),...startBattle()])])]);
script('red_house','red_house',[show('player'),pauseMenu()],'script','scene');
for(const scene of ['viridian','pewter','cerulean','vermilion','lavender','celadon'])actor(scene,scene+' pc','Bills PC','oak',18,16,storage());
actor('bill_house','bill pc','Bills PC','oak',14,8,storage());
authorFullCampaign({actor,trainer,enter,trigger,IF,EX,say,menu,set,math,V,startBattle,switchScene,heal,loadHP,storage,evolve,registerPokemon,save,plan,ids,script,sfx,maxHPEvents});
for(const site of world.filter(s=>s.encounters&&s.key!=='route_one')){
  const candidates=site.encounters;
  const patches=['cave','hideout','bridge'].includes(site.kind)?[[0,14,7],[1,14,12],[2,14,20],[3,14,25]]:[[0,4,5],[1,20,5],[2,4,21],[3,20,21]];
  for(const [patch,x,y]of patches)for(const dy of [0,2]){
    trigger(site.key,`wild ${site.key} ${patch} ${dy}`,x,y+dy,['cave','hideout','bridge'].includes(site.kind)?4:8,1,[IF(21,'==',1,[set(21,0)],[rand(15,1,3),IF(15,'==',1,[set(19,0),rand(135,1,candidates.length),...candidates.map((id,i)=>IF(135,'==',i+1,[set(4,id)])),rand(7,Math.max(2,site.level-2),site.level+2),...maxHPEvents(V(4),7,6),set(5,V(6)),...startBattle()])])]);
  }
}
authorOpening({plan,ids,uuid,E,IF,EX,N,V,set,math,rand,say,menu,script,actor,trigger,switchScene,position,hide,show,heal,loadHP,storage,pauseMenu,restorePP,startBattle,sfx,maxHPEvents});
authorRedProgression({plan,ids,uuid,actor,trainer,IF,EX,say,menu,set,startBattle});
for(const owner of plan.scripts.filter(s=>!s.target.actorId&&!s.target.triggerId&&s.target.scriptKey==='script')) {
  const key=Object.keys(ids.scenes).find(key=>ids.scenes[key]===owner.target.sceneId);
  owner.events.unshift(E('EVENT_MUSIC_PLAY',{musicId:musicId(sceneScore(key))}));
}
// Refresh portraits on entry, party replacement, and a trainer's next opponent.
// The second top-level HUD call is the ordinary turn menu and stays lightweight.
for(const owner of plan.scripts.filter(s=>s.target.sceneId===ids.scenes.battlefield &&
  (!s.target.actorId || ['party','victory'].some(key=>s.target.actorId===uuid('actor:'+key))))) {
  let topHud=0;
  const refresh=(events,depth=0)=>events.flatMap(e=>{
    if(e.command==='EVENT_ACTOR_INVOKE'&&e.args.actorId===uuid('actor:hud')) {
      const regularTurn=!owner.target.actorId&&depth===0&&++topHud===2;
      return regularTurn?[e]:[...identity(),e];
    }
    for(const [branch,list] of Object.entries(e.children||{}))e.children[branch]=refresh(list,depth+1);
    return [e];
  });
  owner.events=refresh(owner.events);
}
// GB Studio cannot resolve actor-invoke targets passed through custom-script
// actor parameters. Export logic routines as explicit far-callable scripts.
const invokedActors=new Set();
function visitAuthored(events,visit){for(const e of events){visit(e);for(const list of Object.values(e.children||{}))visitAuthored(list,visit);}}
for(const s of [...plan.customScripts,...plan.scripts])visitAuthored(s.script||s.events,e=>{if(e.command==='EVENT_ACTOR_INVOKE')invokedActors.add(e.args.actorId);});
const logicCalls=new Map();
for(const actorId of invokedActors){
  const owner=plan.scripts.find(s=>s.target.actorId===actorId&&s.target.scriptKey==='script');
  if(!owner)throw new Error('Missing invoked actor logic '+actorId);
  const name='logic_'+plan.actors.find(a=>a.id===actorId).name.toLowerCase().replace(/[^a-z0-9]+/g,'_');
  const events=structuredClone(owner.events);
  visitAuthored(events,e=>{e.id=uuid('logic-copy:'+actorId+':'+e.id);});
  const [reference]=shared(name,events);logicCalls.set(actorId,reference.args.customEventId);
}
for(const s of [...plan.customScripts,...plan.scripts])visitAuthored(s.script||s.events,e=>{
  if(e.command==='EVENT_ACTOR_INVOKE'){e.command='EVENT_CALL_CUSTOM_EVENT';e.args={customEventId:logicCalls.get(e.args.actorId)};}
});
const count = events => events.reduce((n,e)=>n+1+Object.values(e.children||{}).reduce((m,a)=>m+count(a),0),0);
// A native script bank is small. Split independent event lists into shared calls.
let bankSerial=0;
function hasJump(events){return events.some(e=>['EVENT_DEFINE_LABEL','EVENT_GOTO_LABEL'].includes(e.command)||Object.values(e.children||{}).some(hasJump));}
function bankEvents(events){
  const next=events.map(e=>({...e,...(e.children?{children:Object.fromEntries(Object.entries(e.children).map(([key,list])=>[key,bankEvents(list)]))}:{})}));
  if(next.length<2||hasJump(next)||JSON.stringify(next).length<18000)return next;
  const calls=[];let group=[],size=0;
  for(const event of next){const length=JSON.stringify(event).length;if(group.length&&size+length>18000){calls.push(...shared('bank_'+bankSerial++,group));group=[];size=0;}group.push(event);size+=length;}
  if(group.length)calls.push(...shared('bank_'+bankSerial++,group));
  return calls;
}
for(const s of [...plan.customScripts])s.script=bankEvents(s.script);
for(const s of plan.scripts)s.events=bankEvents(s.events);
// Native shared scripts receive scene actors explicitly, including nested calls.
const sharedById=new Map(plan.customScripts.map(s=>[s.id,s]));
function walkEvents(events,visit){for(const e of events){visit(e);for(const list of Object.values(e.children||{}))walkEvents(list,visit);}}
function bindActors(s,visiting=new Set()){
  if(s.actorBindingsReady)return;
  if(visiting.has(s.id))throw new Error('Recursive shared script '+s.name);
  visiting.add(s.id);
  walkEvents(s.script,e=>{
    const id=e.args?.actorId;
    if(id&&id!=='player'&&id!=='$self$')s.actors[id]={id,name:plan.actors.find(a=>a.id===id)?.name||id};
    if(e.command==='EVENT_CALL_CUSTOM_EVENT'){
      const child=sharedById.get(e.args.customEventId);bindActors(child,visiting);
      Object.assign(s.actors,child.actors);
    }
  });
  visiting.delete(s.id);s.actorBindingsReady=true;
}
for(const s of plan.customScripts)bindActors(s);
// The compiler strips all zeroes from $0$ in shared text; pass it explicitly.
for(const s of plan.customScripts)walkEvents(s.script,e=>{
  if(e.args?.text!==undefined){
    const replace=text=>text.replace(/\$0\$/g,()=>{s.variables.V0={id:'V0',name:'Level',passByReference:true};return '$V0$';});
    e.args.text=Array.isArray(e.args.text)?e.args.text.map(replace):replace(e.args.text);
  }
});
for(const s of [...plan.customScripts,...plan.scripts]){
  walkEvents(s.script||s.events,e=>{if(e.command==='EVENT_CALL_CUSTOM_EVENT'){
    const child=sharedById.get(e.args.customEventId);
    for(const id of Object.keys(child.actors))e.args[`$actor[${id}]$`]=id;
    if(child.variables.V0)e.args['$variable[V0]$']={type:'variable',value:'0'};
  }});
  delete s.actorBindingsReady;
}
const entities=[...plan.actors,...plan.triggers];
if(new Set(entities.map(e=>e.id)).size!==entities.length)throw new Error('Duplicate native actor or trigger ID');
plan.statistics={eventCount:plan.scripts.reduce((n,s)=>n+count(s.events),0),scriptCount:plan.scripts.length,actorCount:plan.actors.length,triggerCount:plan.triggers.length,variables:plan.variables.length};
plan.statistics.customScripts=plan.customScripts.length;
await writeFile(path.join(root,'artwork/game-plan.json'),JSON.stringify(plan));
console.log(JSON.stringify(plan.statistics));
