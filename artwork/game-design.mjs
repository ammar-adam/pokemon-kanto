import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { additionalSpecies, bossTeams, world } from './campaign-world.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ids = JSON.parse(await readFile(path.join(root,'artwork/pokemon-resource-ids.json'),'utf8'));
const art = JSON.parse(await readFile(path.join(root,'artwork/pokemon-asset-plan.json'),'utf8'));
const species = [...art.creatures,...additionalSpecies];
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
  selectedSpecies:132,cash:133,checkpoint:134,encounterChoice:135,bossReturn:136,
  ...Object.fromEntries(species.flatMap((c,i)=>[['own '+c.name,own(i)],['hp '+c.name,hp(i)],['party '+c.name,member(i)],['level '+c.name,lv(i)],['xp '+c.name,xp(i)],...c.moves.map((m,j)=>['pp '+c.name+' '+m,pp(i,j)])])),
  ...Object.fromEntries(Array.from({length:30},(_,i)=>150+i).map(i=>['quest '+i,i]))
};
function own(i){return i<8?30+i:400+(i-8)*10;}
function hp(i){return i<8?40+i:401+(i-8)*10;}
function member(i){return i<8?50+i:402+(i-8)*10;}
function lv(i){return i<8?60+i:403+(i-8)*10;}
function xp(i){return i<8?70+i:404+(i-8)*10;}
function pp(i,j){return i<8?100+i*4+j:405+(i-8)*10+j;}
const plan={variables:Object.entries(vars).map(([name,variableId])=>({name,variableId:String(variableId),symbol:'var_'+name.toLowerCase().replaceAll(' ','_')})),actors:[],triggers:[],scripts:[]};
function script(scene,key,events,scriptKey='script',entityType='actor') { plan.scripts.push({target:{sceneId:ids.scenes[scene],...(entityType==='scene'?{}:{[entityType+'Id']:uuid(entityType+':'+key)}),scriptKey},events}); }
function actor(scene,key,name,sprite,x,y,events=[],properties={}) { plan.actors.push({sceneId:ids.scenes[scene],id:uuid('actor:'+key),name,spriteSheetId:ids.sprites[sprite],x,y,direction:'down',properties}); if(events.length)script(scene,key,events); }
function trigger(scene,key,x,y,width,height,events) {plan.triggers.push({sceneId:ids.scenes[scene],id:uuid('trigger:'+key),name:key,x,y,width,height});script(scene,key,events,'script','trigger');}
const ppMax = [35,25,20,15];
const restorePP = i => ppMax.map((n,j)=>set(pp(i,j),n));
const heal = () => [...species.flatMap((_,i)=>[set(16,V(lv(i))),math(16,'mul',4),math(16,'add',24),set(hp(i),V(16)),...restorePP(i)]),set(9,3),IF(8,'<',6,[set(8,6)])];
const loadHP = () => species.map((_,i)=>IF(1,'==',i+1,[set(0,V(lv(i))),set(2,V(0)),math(2,'mul',4),math(2,'add',24),set(3,V(hp(i)))]));
const storeHP = () => species.map((_,i)=>IF(1,'==',i+1,[set(hp(i),V(3))]));
const living = () => [set(1,0),...species.map((_,i)=>EX(`$1$ == 0 && $${member(i)}$ == 1 && $${hp(i)}$ > 0`,[set(1,i+1)])),...loadHP()];
const firstParty = () => [set(1,0),...species.map((_,i)=>EX(`$1$ == 0 && $${member(i)}$ == 1`,[set(1,i+1)])),...loadHP()];
const pop = () => [set(21,1),E('EVENT_SCENE_POP_STATE',{fadeSpeed:2})];
const startBattle = () => [E('EVENT_SCENE_PUSH_STATE'),switchScene('battlefield',9,13)];
const save = () => E('EVENT_SAVE_DATA',{saveSlot:0},{true:[say('RED SAVED\nTHE GAME.')],load:[]});
function speciesMenu(variable=13){
  let next=[];
  for(let page=Math.ceil(species.length/7)-1;page>=0;page--){
    const group=species.slice(page*7,page*7+7),options=group.map(c=>c.name);
    if(next.length)options.push('MORE');
    const current=[menu(variable,options,true,'menu'),...group.map((_,i)=>IF(variable,'==',i+1,[set(132,page*7+i+1)]))];
    if(next.length)current.push(IF(variable,'==',options.length,next));
    next=current;
  }
  return [set(132,0),...next];
}

function partyView() {
  return [say('PARTY $25$/6\nPOKE BALLS $8$\nPOTIONS $9$'),...speciesMenu(),...species.map((c,i)=>IF(132,'==',i+1,[IF(member(i),'==',1,[say(`${c.name}\nLV $${lv(i)}$ HP $${hp(i)}$\n${c.type}`),IF(hp(i),'>',0,[set(1,i+1),set(0,V(lv(i))),set(2,V(0)),math(2,'mul',4),math(2,'add',24),set(3,V(hp(i))),say(`${c.name}\nLEADS THE PARTY.`)],[say('NEEDS REST.')])],[IF(own(i),'==',1,[say('IN THE PC BOX.')],[say('NOT CAUGHT YET.')])])]))];
}
function pokedex(){return [say(`POKEDEX\nCAUGHT $10$/${species.length}`),...speciesMenu(),...species.map((c,i)=>IF(132,'==',i+1,[IF(own(i),'==',1,[say(`NO. ${c.dex}\n${c.name}\n${c.type} POKEMON`)],[say(`${c.name}\nNO DATA YET.`)])]))];}
function storage(){return [say('BILL\'S PC\nPARTY $25$/6'),...speciesMenu(),...species.map((c,i)=>IF(132,'==',i+1,[IF(own(i),'==',0,[say('NOT CAUGHT YET.')],[IF(member(i),'==',1,[IF(25,'>',1,[set(member(i),0),math(25,'sub',1),IF(1,'==',i+1,[set(1,0)]),say('DEPOSITED\nIN THE PC BOX.')],[say('KEEP ONE POKEMON\nIN YOUR PARTY.')])],[IF(25,'<',6,[set(member(i),1),math(25,'add',1),say('WITHDREW POKEMON.')],[say('PARTY IS FULL.\nDEPOSIT ONE FIRST.')])])])])),IF(1,'==',0,firstParty())];}
function pauseMenu() {
  return E('EVENT_SET_INPUT_SCRIPT',{input:['start'],override:true},{true:[E('EVENT_SCRIPT_LOCK'),menu(23,['POKEMON','POKEDEX','SAVE','BADGES','JOURNEY','CLOSE'],true,'menu'),IF(23,'==',1,partyView()),IF(23,'==',2,pokedex()),IF(23,'==',3,[save()]),IF(23,'==',4,[say('BADGES\nBOULDER $12$\nCASCADE $150$'),say('THUNDER $151$\nRAINBOW $152$')]),IF(23,'==',5,[IF(12,'==',0,[say('NEXT: BROCK\nPEWTER GYM.')],[IF(150,'==',0,[say('NEXT: MISTY\nCERULEAN GYM.')],[IF(151,'==',0,[say('NEXT: LT SURGE\nVERMILION GYM.')],[IF(152,'==',0,[say('NEXT: ERIKA\nCELADON GYM.')],[say('FOUR BADGES WON!\nEXPLORE KANTO.')])])])])]),E('EVENT_SCRIPT_UNLOCK')]});
}
for(const scene of world.filter(s=>s.key!=='red_house').map(s=>s.key).filter(s=>s in ids.scenes)) script(scene,scene,[show('player'),pauseMenu()], 'script','scene');

script('title','title',[hide('player'),E('EVENT_REMOVE_INPUT_SCRIPT',{input:['start','select']}),label('title_menu'),menu(13,['NEW GAME','CONTINUE'],false),IF(13,'==',2,[E('EVENT_IF_SAVED_DATA',{saveSlot:0},{true:[E('EVENT_LOAD_DATA',{saveSlot:0})],false:[say('NO SAVE FILE YET.'),go('title_menu')]})]),IF(13,'==',1,[E('EVENT_RESET_VARIABLES'),set(0,5),set(2,44),set(8,6),set(9,3),set(22,1),say(['PROF. OAK:\nWELCOME TO THE\nWORLD OF POKEMON!','RED, YOUR JOURNEY\nBEGINS IN PALLET\nTOWN.','CHOOSE YOUR FIRST\nPOKEMON AT MY LAB.']),switchScene('laboratory',9,12,'up')]),go('title_menu')],'script','scene');

const starter = [IF(1,'==',0,[say('PROF. OAK:\nWHICH POKEMON\nWILL YOU CHOOSE?'),menu(13,species.slice(0,3).map(c=>c.name),false),set(1,V(13)),set(27,V(13)),...species.slice(0,3).map((c,i)=>IF(1,'==',i+1,[set(30+i,1),set(50+i,1),set(60+i,5),set(40+i,V(2)),...restorePP(i),sfx(6),say(`${c.name} JOINS\nYOUR PARTY!`)])),set(10,1),set(25,1),say(['HERE IS A POKEDEX,\nSIX POKE BALLS,\nAND THREE POTIONS.','BLUE IS WAITING\nOUTSIDE THE LAB.','EXPLORE ROUTE 1.\nTHEN WIN THE\nBOULDER BADGE!'])],[say('PROF. OAK:\nHOW IS YOUR\nPOKEDEX COMING?')])];
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
for(let p=0;p<patches.length;p++){const a=patches[p];for(let y=a.y;y<a.y+a.h;y+=2){trigger('route_one',`grass ${p} ${y}`,a.x,y,8,1,[IF(21,'==',1,[set(21,0)],[rand(15,1,3),IF(15,'==',1,[set(19,0),rand(15,0,1),IF(15,'==',0,[set(4,a.types[0])],[set(4,a.types[1])]),rand(7,2,4),set(6,V(7)),math(6,'mul',4),math(6,'add',12),set(5,V(6)),...startBattle()])])]);}}

actor('battlefield','enemy','Opponent','charmander',14,7,[],{collisionGroup:'none'});
actor('battlefield','partner','Partner','charmander',2,11,[],{collisionGroup:'none'});
const hiddenLogic=['hud','attack','counter','party','bag','victory','fight','boss-config','gain-xp','heal-all','fight0','fight1','fight2','fight3','fight4'];
for(const [index,key] of hiddenLogic.entries()) actor('battlefield',key,key.toUpperCase(),'logic',0,index*3%18,[],{collisionGroup:'none'});

const hud=[...species.flatMap((c,i)=>[IF(4,'==',i+1,[...changeSprite('enemy',c.key),draw(c.name.padEnd(10,' '),1,0),draw(`L$7$ ${c.type.padEnd(8,' ')}`,1,1)]),IF(1,'==',i+1,[...changeSprite('partner',c.key,true),draw(c.name.padEnd(10,' '),9,9)])]),draw('HP $5$/$6$   ',1,2),draw('HP $3$/$2$  ',9,10),draw('LV $0$   ',9,11)];
script('battlefield','hud',hud);

// Type advantages are authored as native conditionals, not a custom engine.
const advantages=[[1,2],[2,3],[2,5],[2,7],[3,1],[3,5],[3,7],[4,3],[4,6],[4,8],[5,1],[5,6],[5,8],[7,1],[7,6],[7,8],[6,2],[8,2],
  [1,9],[1,17],[1,18],[1,19],[1,20],[2,12],[2,13],[3,15],[3,16],[4,12],[4,13],[4,19],
  [12,1],[12,5],[12,7],[13,1],[13,5],[13,7],[14,12],[14,13],[15,3],[15,12],[15,13],[16,3],[16,12],[16,13],
  [9,2],[17,2],[18,2],[19,2],[20,2]];
function effectiveness(attacker,defender,message=false){return [
  ...advantages.map(([a,d])=>EX(`$${attacker}$ == ${a} && $${defender}$ == ${d}`,[math(16,'mul',2),...(message?[say('SUPER EFFECTIVE!')]:[])])),
  EX(`$${attacker}$ == $${defender}$ || (($${attacker}$ == 5 || $${attacker}$ == 7) && ($${defender}$ == 5 || $${defender}$ == 7)) || (($${attacker}$ == 6 || $${attacker}$ == 8) && ($${defender}$ == 6 || $${defender}$ == 8))`,[math(16,'div',2),...(message?[say('NOT VERY EFFECTIVE.')]:[])]),
  EX(`$${attacker}$ == 4 && ($${defender}$ == 5 || $${defender}$ == 7)`,[set(16,0),...(message?[say('IT HAS NO EFFECT!')]:[])])
];}
script('battlefield','attack',[set(16,V(0)),math(16,'add',6),IF(14,'==',2,[math(16,'add',4),...effectiveness(1,4,true)]),rand(15,1,16),IF(15,'==',1,[math(16,'mul',2),say('A CRITICAL HIT!')]),math(5,'sub',16,'var'),IF(5,'<',0,[set(5,0)]),sfx(3),fx('enemy'),invoke('hud')]);

script('battlefield','counter',[set(16,V(7)),math(16,'add',3),rand(15,1,3),IF(15,'==',1,[math(16,'add',2),...effectiveness(4,1)]),IF(29,'==',1,[math(16,'div',2)]),IF(17,'==',1,[math(16,'div',2),set(17,0)]),rand(15,1,100),EX('($68$ == 1 && $15$ <= 30) || ($69$ == 1 && $15$ <= 25)',[set(16,0),say('THE FOE COULD\nNOT LAND A HIT.')],[say('THE FOE ATTACKS!')]),math(3,'sub',16,'var'),IF(3,'<',0,[set(3,0)]),...storeHP(),sfx(2),fx('partner'),invoke('hud')]);

script('battlefield','party',[...speciesMenu(),...species.map((c,i)=>IF(132,'==',i+1,[EX(`$${member(i)}$ == 1 && $${hp(i)}$ > 0`,[IF(1,'==',i+1,[say('ALREADY IN BATTLE.')],[set(1,i+1),set(0,V(lv(i))),set(2,V(0)),math(2,'mul',4),math(2,'add',24),set(3,V(hp(i))),set(18,1),set(17,0),invoke('hud'),say(`GO, ${c.name}!`)])],[say('NOT IN PARTY\nOR NEEDS REST.')])]))]);

function capture(){return [IF(19,'!=',0,[say('DO NOT STEAL\nA TRAINER\'S\nPOKEMON!')],[IF(8,'==',0,[say('NO POKE BALLS\nLEFT.')],[math(8,'sub',1),set(18,1),rand(15,1,100),set(16,V(6)),math(16,'div',3),EX('$5$ <= $16$ || $15$ <= 35',[set(15,1)],[set(16,V(6)),math(16,'div',2),EX('$5$ <= $16$ && $15$ <= 75',[set(15,1)],[set(15,0)])]),sfx(4),fx('enemy'),IF(15,'==',1,[...species.map((c,i)=>IF(4,'==',i+1,[IF(own(i),'==',0,[set(own(i),1),math(10,'add',1),set(lv(i),V(7)),set(hp(i),V(7)),math(hp(i),'mul',4),math(hp(i),'add',24),...restorePP(i),IF(25,'<',6,[set(member(i),1),math(25,'add',1)],[say('PARTY FULL.\nSENT TO BILL\'S PC.')])],[say('ALREADY REGISTERED\nIN YOUR POKEDEX.')]),say(`${c.name}\nWAS CAUGHT!`)])),sfx(7),...pop()],[say('IT BROKE FREE!')])])])];}
script('battlefield','bag',[menu(13,['POKE BALL','POTION','BACK']),IF(13,'==',1,capture()),IF(13,'==',2,[IF(9,'==',0,[say('NO POTIONS LEFT.')],[EX('$3$ >= $2$',[say('HP IS ALREADY FULL.')],[math(9,'sub',1),math(3,'add',20),EX('$3$ > $2$',[set(3,V(2))]),...storeHP(),set(18,1),invoke('hud'),sfx(6),say('POTION RESTORED HP.')])])])]);

function configureBoss(){return [
  ...Object.entries(bossTeams).map(([mode,team])=>IF(19,'==',Number(mode),team.team.map(([pokemon,level,max],i)=>IF(20,'==',i+1,[set(4,pokemon),set(7,level),set(6,max)])))),
  IF(19,'==',2,[IF(27,'==',1,[set(4,3)]),IF(27,'==',2,[set(4,1)]),IF(27,'==',3,[set(4,2)]),set(7,5),set(6,32)]),
  IF(19,'==',10,[IF(20,'==',2,[IF(27,'==',1,[set(4,3)]),IF(27,'==',2,[set(4,1)]),IF(27,'==',3,[set(4,2)])])]),
  IF(19,'==',3,[set(4,8),set(7,6),set(6,32)]),set(5,V(6)),set(28,0),set(29,0),set(68,0),set(69,0)];}
script('battlefield','boss-config',configureBoss());
script('battlefield','heal-all',heal());
const gainXP=()=>species.map((c,i)=>IF(1,'==',i+1,[math(xp(i),'add',7,'var'),set(16,V(lv(i))),math(16,'mul',2),EX(`$${xp(i)}$ >= $16$ && $${lv(i)}$ < 40`,[math(xp(i),'sub',16,'var'),math(lv(i),'add',1),math(hp(i),'add',4),set(0,V(lv(i))),set(2,V(0)),math(2,'mul',4),math(2,'add',24),set(3,V(hp(i))),say(`${c.name}\nGREW TO LV $0$!`)])]));
script('battlefield','gain-xp',gainXP());
const trainerVictory=Object.entries(bossTeams).filter(([mode])=>Number(mode)!==1).map(([mode,team])=>IF(19,'==',Number(mode),[IF(20,'<',team.team.length,[math(20,'add',1),invoke('boss-config'),invoke('hud'),say(`${team.name}\nSENT ANOTHER\nPOKEMON!`)],[set(team.badge||team.flag,1),math(133,'add',7,'var'),IF(133,'>',9999,[set(133,9999)]),say(team.badge?`${team.name}\nAWARDED A BADGE!`:`${team.name}\nWAS DEFEATED!`),...(team.badge?[invoke('heal-all'),...loadHP()]:[]),...pop()])])) ;
script('battlefield','victory',[...storeHP(),sfx(7),say('FOE POKEMON\nFAINTED!'),math(11,'add',1),invoke('gain-xp'),IF(19,'==',1,[IF(20,'<',2,[math(20,'add',1),invoke('boss-config'),invoke('hud'),say('BROCK SENT\nOUT ONIX!')],[set(12,1),say(['BROCK:\nI TOOK YOU\nFOR GRANTED.','RED RECEIVED\nTHE BOULDER BADGE!','ROUTE THREE\nIS NOW OPEN.']),invoke('heal-all'),...loadHP(),...pop()])],[...trainerVictory,IF(19,'<=',3,[IF(19,'==',2,[math(26,'add',1),say('BLUE:\nSMELL YOU LATER!')]),IF(19,'==',3,[math(26,'add',2),say('YOUNGSTER:\nI LOST!')]),IF(19,'==',0,[IF(8,'<',20,[math(8,'add',1)]),say('FOUND A POKE BALL.')]),...pop()])])]);

function selectedMove(c,i,j){
  const healMove=[11,12].includes(i)&&j===3;
  const attackMove=j<2||(i===18&&j===2);
  const effect=attackMove?[invoke('attack')]:healMove?
    [math(3,'add',20),EX('$3$ > $2$',[set(3,V(2))]),...storeHP(),invoke('hud'),say('HP WAS RESTORED!')]:
    j===2?([4,6].includes(i)?[set(17,1),say('DEFENSE ROSE!')]:[set(29,1),say('FOE ATTACK FELL!')]):
    i===0||i===7?[set(68,1),say('FOE ACCURACY FELL!')]:
    i===1||i===14||i===15?[set(28,1),say('FOE WAS SEEDED!')]:
    i===3||i===13?[set(69,1),say('FOE WAS PARALYZED!')]:
    i===5?[invoke('attack'),set(16,V(16)),math(16,'div',2),math(3,'add',16,'var'),EX('$3$ > $2$',[set(3,V(2))]),...storeHP()]:
    [set(17,1),say('DEFENSE ROSE!')];
  return [IF(pp(i,j),'==',0,[say('NO PP LEFT\nFOR THAT MOVE.')],[math(pp(i,j),'sub',1),set(18,1),set(14,j+1),say(`${c.name}\nUSED ${c.moves[j]}!`),...effect])];
}
function fight(indexes){return indexes.map(i=>{const c=species[i];return IF(1,'==',i+1,[EX(`$${pp(i,0)}$ + $${pp(i,1)}$ + $${pp(i,2)}$ + $${pp(i,3)}$ == 0`,[say(`${c.name}\nUSED STRUGGLE!`),set(14,1),invoke('attack'),math(3,'sub',4),IF(3,'<',0,[set(3,0)]),...storeHP(),set(18,1)],[say(`PP $${pp(i,0)}$/$${pp(i,1)}$/\n$${pp(i,2)}$/$${pp(i,3)}$`),menu(14,[...c.moves,'BACK'],true,'menu'),...c.moves.flatMap((_,j)=>IF(14,'==',j+1,selectedMove(c,i,j)))])])});}
for(let i=0;i<5;i++)script('battlefield','fight'+i,fight(Array.from({length:4},(_,j)=>i*4+j)));
script('battlefield','fight',Array.from({length:5},(_,i)=>EX(`$1$ >= ${i*4+1} && $1$ <= ${i*4+4}`,[invoke('fight'+i)])));

const battle=[hide('player'),E('EVENT_REMOVE_INPUT_SCRIPT',{input:['start','select']}),...hiddenLogic.map(h=>hide(uuid('actor:'+h))),set(17,0),set(28,0),set(29,0),set(68,0),set(69,0),...loadHP(),IF(3,'<=',0,living()),IF(19,'!=',0,[invoke('boss-config')]),invoke('hud'),IF(19,'!=',0,[IF(19,'==',2,[say('BLUE WANTS\nTO BATTLE!')],[IF(19,'==',3,[say('YOUNGSTER WANTS\nTO BATTLE!')],[...Object.entries(bossTeams).map(([mode,team])=>IF(19,'==',Number(mode),[say(`${team.name}\nWANTS TO BATTLE!`)]))])])],[...species.map((c,i)=>IF(4,'==',i+1,[say(`WILD ${c.name}\nAPPEARED!`)]))]),label('turn'),IF(3,'<=',0,living()),IF(1,'==',0,[say('RED HAS NO\nPOKEMON LEFT!'),invoke('heal-all'),set(1,0),...living(),E('EVENT_SCENE_RESET_STATE'),
  IF(134,'==',1,[switchScene('viridian',18,21)]),IF(134,'==',2,[switchScene('pewter',18,21)]),IF(134,'==',3,[switchScene('cerulean',18,21)]),IF(134,'==',4,[switchScene('vermilion',18,21)]),IF(134,'==',5,[switchScene('lavender',18,21)]),IF(134,'==',6,[switchScene('celadon',18,21)]),switchScene('fernvale',18,21)]),set(18,0),invoke('hud'),menu(24,['FIGHT','BAG','POKEMON','RUN'],false),
  IF(24,'==',1,[invoke('fight')]),
  IF(24,'==',2,[invoke('bag')]),IF(24,'==',3,[invoke('party')]),IF(24,'==',4,[IF(19,'!=',0,[say('NO RUNNING FROM\nA TRAINER BATTLE!')],[say('GOT AWAY SAFELY.'),...pop()])]),
  IF(18,'==',1,[EX('$28$ == 1 && $3$ > 0',[math(5,'sub',2),math(3,'add',2),EX('$3$ > $2$',[set(3,V(2))]),...storeHP(),say('LEECH SEED\nDRAINED THE FOE!')]),IF(5,'<=',0,[set(5,0),invoke('victory'),go('turn')]),IF(3,'>',0,[invoke('counter')]),IF(3,'<=',0,[say('YOUR POKEMON\nFAINTED!'),...living(),IF(1,'>',0,[set(17,0),invoke('hud'),say('THE NEXT POKEMON\nTAKES THE FIELD.')])])]),go('turn')];
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
trainer('forest','forest scout','Forest Scout','blue',12,9,14,167);
trainer('forest','forest catcher','Bug Catcher','oak',20,19,15,168);
trainer('forest','forest expert','Forest Ranger','brock',11,24,16,169);
trainer('forest','forest kid','Bug Catcher II','blue',22,8,11,164);
trainer('route_three','route three lass','Lass','joy',12,12,13,166);
trainer('route_three','route three hiker','Hiker','brock',20,22,12,165);
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
for(const site of world.filter(s=>s.encounters&&s.key!=='route_one')){
  const candidates=site.encounters;
  const patches=['cave','hideout','bridge'].includes(site.kind)?[[0,14,7],[1,14,12],[2,14,20],[3,14,25]]:[[0,4,5],[1,20,5],[2,4,21],[3,20,21]];
  for(const [patch,x,y]of patches)for(const dy of [0,2]){
    trigger(site.key,`wild ${site.key} ${patch} ${dy}`,x,y+dy,['cave','hideout','bridge'].includes(site.kind)?4:8,1,[IF(21,'==',1,[set(21,0)],[rand(15,1,3),IF(15,'==',1,[set(19,0),rand(135,1,candidates.length),...candidates.map((id,i)=>IF(135,'==',i+1,[set(4,id)])),rand(7,Math.max(2,site.level-2),site.level+2),set(6,V(7)),math(6,'mul',4),math(6,'add',12),set(5,V(6)),...startBattle()])])]);
  }
}
const count = events => events.reduce((n,e)=>n+1+Object.values(e.children||{}).reduce((m,a)=>m+count(a),0),0);
plan.statistics={eventCount:plan.scripts.reduce((n,s)=>n+count(s.events),0),scriptCount:plan.scripts.length,actorCount:plan.actors.length,triggerCount:plan.triggers.length,variables:plan.variables.length};
await writeFile(path.join(root,'artwork/game-plan.json'),JSON.stringify(plan));
console.log(JSON.stringify(plan.statistics));
