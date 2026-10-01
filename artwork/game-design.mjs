import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ids = JSON.parse(await readFile(path.join(root,'artwork/pokemon-resource-ids.json'),'utf8'));
const art = JSON.parse(await readFile(path.join(root,'artwork/pokemon-asset-plan.json'),'utf8'));
const species = art.creatures;
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
  ...Object.fromEntries(species.flatMap((c,i)=>[['own '+c.name,30+i],['hp '+c.name,40+i],['party '+c.name,50+i],['level '+c.name,60+i],['xp '+c.name,70+i],...c.moves.map((m,j)=>['pp '+c.name+' '+m,100+i*4+j])]))
};
const plan={variables:Object.entries(vars).map(([name,variableId])=>({name,variableId:String(variableId),symbol:'var_'+name.toLowerCase().replaceAll(' ','_')})),actors:[],triggers:[],scripts:[]};
function script(scene,key,events,scriptKey='script',entityType='actor') { plan.scripts.push({target:{sceneId:ids.scenes[scene],...(entityType==='scene'?{}:{[entityType+'Id']:uuid(entityType+':'+key)}),scriptKey},events}); }
function actor(scene,key,name,sprite,x,y,events=[],properties={}) { plan.actors.push({sceneId:ids.scenes[scene],id:uuid('actor:'+key),name,spriteSheetId:ids.sprites[sprite],x,y,direction:'down',properties}); if(events.length)script(scene,key,events); }
function trigger(scene,key,x,y,width,height,events) {plan.triggers.push({sceneId:ids.scenes[scene],id:uuid('trigger:'+key),name:key,x,y,width,height});script(scene,key,events,'script','trigger');}
const ppMax = [35,25,20,15];
const restorePP = i => ppMax.map((n,j)=>set(100+i*4+j,n));
const heal = () => [...species.flatMap((_,i)=>[set(16,V(60+i)),math(16,'mul',4),math(16,'add',24),set(40+i,V(16)),...restorePP(i)]),set(9,3),IF(8,'<',6,[set(8,6)])];
const loadHP = () => species.map((_,i)=>IF(1,'==',i+1,[set(0,V(60+i)),set(2,V(0)),math(2,'mul',4),math(2,'add',24),set(3,V(40+i))]));
const storeHP = () => species.map((_,i)=>IF(1,'==',i+1,[set(40+i,V(3))]));
const living = () => [set(1,0),...species.map((_,i)=>EX(`$1$ == 0 && $${50+i}$ == 1 && $${40+i}$ > 0`,[set(1,i+1)])),...loadHP()];
const firstParty = () => [set(1,0),...species.map((_,i)=>EX(`$1$ == 0 && $${50+i}$ == 1`,[set(1,i+1)])),...loadHP()];
const pop = () => [set(21,1),E('EVENT_SCENE_POP_STATE',{fadeSpeed:2})];
const startBattle = () => [E('EVENT_SCENE_PUSH_STATE'),switchScene('battlefield',9,13)];
const save = () => E('EVENT_SAVE_DATA',{saveSlot:0},{true:[say('RED SAVED\nTHE GAME.')],load:[]});

function partyView() {
  return [say('PARTY $25$/6\nPOKE BALLS $8$\nPOTIONS $9$'),menu(13,species.map(c=>c.name)),...species.map((c,i)=>IF(13,'==',i+1,[IF(50+i,'==',1,[say(`${c.name}\nLV $${60+i}$ HP $${40+i}$\n${c.type}`),IF(40+i,'>',0,[set(1,i+1),...loadHP(),say(`${c.name}\nLEADS THE PARTY.`)],[say('NEEDS REST.')])],[IF(30+i,'==',1,[say('IN THE PC BOX.')],[say('NOT CAUGHT YET.')])])]))];
}
function pokedex(){return [say('POKEDEX\nCAUGHT $10$/8'),menu(13,species.map(c=>c.name)),...species.map((c,i)=>IF(13,'==',i+1,[IF(30+i,'==',1,[say(`NO. ${c.dex}\n${c.name}\n${c.type} POKEMON`)],[say(`${c.name}\nNO DATA YET.`)])]))];}
function storage(){return [say('BILL\'S PC\nPARTY $25$/6'),menu(13,species.map(c=>c.name)),...species.map((c,i)=>IF(13,'==',i+1,[IF(30+i,'==',0,[say('NOT CAUGHT YET.')],[IF(50+i,'==',1,[IF(25,'>',1,[set(50+i,0),math(25,'sub',1),IF(1,'==',i+1,firstParty()),say('DEPOSITED\nIN THE PC BOX.')],[say('KEEP ONE POKEMON\nIN YOUR PARTY.')])],[IF(25,'<',6,[set(50+i,1),math(25,'add',1),say('WITHDREW POKEMON.')],[say('PARTY IS FULL.\nDEPOSIT ONE FIRST.')])])])]))];}
function pauseMenu() {
  return E('EVENT_SET_INPUT_SCRIPT',{input:['start'],override:true},{true:[E('EVENT_SCRIPT_LOCK'),menu(23,['POKEMON','POKEDEX','SAVE','TRAINER','CLOSE'],true,'menu'),IF(23,'==',1,partyView()),IF(23,'==',2,pokedex()),IF(23,'==',3,[save()]),IF(23,'==',4,[IF(12,'==',1,[say('RED\nBOULDER BADGE\nWON FROM BROCK!')],[say('RED\nBOULDER BADGE: --\nBATTLES WON $11$')])]),E('EVENT_SCRIPT_UNLOCK')]});
}
for(const scene of ['fernvale','route_one','laboratory','arena']) script(scene,scene,[show('player'),pauseMenu()], 'script','scene');

script('title','title',[hide('player'),E('EVENT_REMOVE_INPUT_SCRIPT',{input:['start','select']}),label('title_menu'),menu(13,['NEW GAME','CONTINUE'],false),IF(13,'==',2,[E('EVENT_IF_SAVED_DATA',{saveSlot:0},{true:[E('EVENT_LOAD_DATA',{saveSlot:0})],false:[say('NO SAVE FILE YET.'),go('title_menu')]})]),IF(13,'==',1,[E('EVENT_RESET_VARIABLES'),set(0,5),set(2,44),set(8,6),set(9,3),set(22,1),say(['PROF. OAK:\nWELCOME TO THE\nWORLD OF POKEMON!','RED, YOUR JOURNEY\nBEGINS IN PALLET\nTOWN.','CHOOSE YOUR FIRST\nPOKEMON AT MY LAB.']),switchScene('laboratory',9,12,'up')]),go('title_menu')],'script','scene');

const starter = [IF(1,'==',0,[say('PROF. OAK:\nWHICH POKEMON\nWILL YOU CHOOSE?'),menu(13,species.slice(0,3).map(c=>c.name),false),set(1,V(13)),set(27,V(13)),...species.slice(0,3).map((c,i)=>IF(1,'==',i+1,[set(30+i,1),set(50+i,1),set(60+i,5),set(40+i,V(2)),...restorePP(i),sfx(6),say(`${c.name} JOINS\nYOUR PARTY!`)])),set(10,1),set(25,1),say(['HERE IS A POKEDEX,\nSIX POKE BALLS,\nAND THREE POTIONS.','BLUE IS WAITING\nOUTSIDE THE LAB.','EXPLORE ROUTE 1.\nTHEN WIN THE\nBOULDER BADGE!'])],[say('PROF. OAK:\nHOW IS YOUR\nPOKEDEX COMING?')])];
actor('laboratory','prof','Professor Oak','oak',9,8,starter);
trigger('laboratory','leave lab',8,17,4,1,[IF(1,'==',0,[say('CHOOSE A PARTNER\nBEFORE YOU LEAVE.'),position(9,15)],[switchScene('fernvale',7,13)])]);
trigger('fernvale','enter lab',7,12,2,1,[switchScene('laboratory',9,15,'up')]);
trigger('fernvale','enter arena',24,12,2,1,[switchScene('arena',9,15,'up')]);
trigger('arena','leave arena',8,17,4,1,[switchScene('fernvale',24,13)]);
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
const hiddenLogic=['hud','attack','counter','party','bag','victory','fight'];
for(const [index,key] of hiddenLogic.entries()) actor('battlefield',key,key.toUpperCase(),'logic',0,index*3%18,[],{collisionGroup:'none'});

const hud=[...species.flatMap((c,i)=>[IF(4,'==',i+1,[...changeSprite('enemy',c.key),draw(c.name.padEnd(10,' '),1,0),draw(`L$7$ ${c.type.padEnd(8,' ')}`,1,1)]),IF(1,'==',i+1,[...changeSprite('partner',c.key,true),draw(c.name.padEnd(10,' '),9,9)])]),draw('HP $5$/$6$   ',1,2),draw('HP $3$/$2$  ',9,10),draw('LV $0$   ',9,11)];
script('battlefield','hud',hud);

// Type advantages are authored as native conditionals, not a custom engine.
const advantages=[[1,2],[2,3],[2,5],[2,7],[3,1],[3,5],[3,7],[4,3],[4,6],[4,8],[5,1],[5,6],[5,8],[7,1],[7,6],[7,8],[6,2],[8,2]];
function effectiveness(attacker,defender,message=false){return [
  ...advantages.map(([a,d])=>EX(`$${attacker}$ == ${a} && $${defender}$ == ${d}`,[math(16,'mul',2),...(message?[say('SUPER EFFECTIVE!')]:[])])),
  EX(`$${attacker}$ == $${defender}$ || (($${attacker}$ == 5 || $${attacker}$ == 7) && ($${defender}$ == 5 || $${defender}$ == 7)) || (($${attacker}$ == 6 || $${attacker}$ == 8) && ($${defender}$ == 6 || $${defender}$ == 8))`,[math(16,'div',2),...(message?[say('NOT VERY EFFECTIVE.')]:[])]),
  EX(`$${attacker}$ == 4 && ($${defender}$ == 5 || $${defender}$ == 7)`,[set(16,0),...(message?[say('IT HAS NO EFFECT!')]:[])])
];}
script('battlefield','attack',[set(16,V(0)),math(16,'add',6),IF(14,'==',2,[math(16,'add',4),...effectiveness(1,4,true)]),rand(15,1,16),IF(15,'==',1,[math(16,'mul',2),say('A CRITICAL HIT!')]),math(5,'sub',16,'var'),IF(5,'<',0,[set(5,0)]),sfx(3),fx('enemy'),invoke('hud')]);

script('battlefield','counter',[set(16,V(7)),math(16,'add',3),rand(15,1,3),IF(15,'==',1,[math(16,'add',2),...effectiveness(4,1)]),IF(29,'==',1,[math(16,'div',2)]),IF(17,'==',1,[math(16,'div',2),set(17,0)]),rand(15,1,100),EX('($68$ == 1 && $15$ <= 30) || ($69$ == 1 && $15$ <= 25)',[set(16,0),say('THE FOE COULD\nNOT LAND A HIT.')],[say('THE FOE ATTACKS!')]),math(3,'sub',16,'var'),IF(3,'<',0,[set(3,0)]),...storeHP(),sfx(2),fx('partner'),invoke('hud')]);

script('battlefield','party',[menu(13,species.map(c=>c.name),true,'menu'),...species.map((c,i)=>IF(13,'==',i+1,[EX(`$${50+i}$ == 1 && $${40+i}$ > 0`,[IF(1,'==',i+1,[say('ALREADY IN BATTLE.')],[set(1,i+1),...loadHP(),set(18,1),set(17,0),invoke('hud'),say(`GO, ${c.name}!`)])],[say('NOT IN PARTY\nOR NEEDS REST.')])]))]);

function capture(){return [IF(19,'!=',0,[say('DO NOT STEAL\nA TRAINER\'S\nPOKEMON!')],[IF(8,'==',0,[say('NO POKE BALLS\nLEFT.')],[math(8,'sub',1),set(18,1),rand(15,1,100),set(16,V(6)),math(16,'div',3),EX('$5$ <= $16$ || $15$ <= 35',[set(15,1)],[set(16,V(6)),math(16,'div',2),EX('$5$ <= $16$ && $15$ <= 75',[set(15,1)],[set(15,0)])]),sfx(4),fx('enemy'),IF(15,'==',1,[...species.map((c,i)=>IF(4,'==',i+1,[IF(30+i,'==',0,[set(30+i,1),math(10,'add',1),set(60+i,V(7)),set(40+i,V(7)),math(40+i,'mul',4),math(40+i,'add',24),...restorePP(i),IF(25,'<',6,[set(50+i,1),math(25,'add',1)],[say('PARTY FULL.\nSENT TO BILL\'S PC.')])],[say('ALREADY REGISTERED\nIN YOUR POKEDEX.')]),say(`${c.name}\nWAS CAUGHT!`)])),sfx(7),...pop()],[say('IT BROKE FREE!')])])])];}
script('battlefield','bag',[menu(13,['POKE BALL','POTION','BACK']),IF(13,'==',1,capture()),IF(13,'==',2,[IF(9,'==',0,[say('NO POTIONS LEFT.')],[EX('$3$ >= $2$',[say('HP IS ALREADY FULL.')],[math(9,'sub',1),math(3,'add',20),EX('$3$ > $2$',[set(3,V(2))]),...storeHP(),set(18,1),invoke('hud'),sfx(6),say('POTION RESTORED HP.')])])])]);

function configureBoss(){return [IF(19,'==',1,[IF(20,'==',1,[set(4,5),set(7,8),set(6,46)],[set(4,7),set(7,10),set(6,60)])]),IF(19,'==',2,[IF(27,'==',1,[set(4,3)]),IF(27,'==',2,[set(4,1)]),IF(27,'==',3,[set(4,2)]),set(7,5),set(6,32)]),IF(19,'==',3,[set(4,8),set(7,6),set(6,32)]),set(5,V(6)),set(28,0),set(29,0),set(68,0),set(69,0)];}
const gainXP=()=>species.map((c,i)=>IF(1,'==',i+1,[math(70+i,'add',7,'var'),set(16,V(60+i)),math(16,'mul',2),EX(`$${70+i}$ >= $16$ && $${60+i}$ < 20`,[math(70+i,'sub',16,'var'),math(60+i,'add',1),math(40+i,'add',4),...loadHP(),say(`${c.name}\nGREW TO LV $0$!`)])]));
script('battlefield','victory',[...storeHP(),sfx(7),say('FOE POKEMON\nFAINTED!'),math(11,'add',1),...gainXP(),IF(19,'==',1,[IF(20,'<',2,[math(20,'add',1),...configureBoss(),invoke('hud'),say('BROCK SENT\nOUT ONIX!')],[set(12,1),say(['BROCK:\nI TOOK YOU\nFOR GRANTED.','RED RECEIVED\nTHE BOULDER BADGE!','CHAPTER COMPLETE!\nYOUR JOURNEY\nHAS JUST BEGUN.']),...heal(),...loadHP(),...pop()])],[IF(19,'==',2,[math(26,'add',1),say('BLUE:\nSMELL YOU LATER!')],[IF(19,'==',3,[math(26,'add',2),say('YOUNGSTER:\nI LOST!')],[IF(8,'<',20,[math(8,'add',1)]),say('FOUND A POKE BALL.')])]),...pop()])]);

function selectedMove(c,i,j){return [IF(100+i*4+j,'==',0,[say('NO PP LEFT\nFOR THAT MOVE.')],[math(100+i*4+j,'sub',1),set(18,1),set(14,j+1),say(`${c.name}\nUSED ${c.moves[j]}!`),...(j<2?[invoke('attack')]:j===2?([4,6].includes(i)?[set(17,1),say('DEFENSE ROSE!')]:[set(29,1),say('FOE ATTACK FELL!')]):i===0||i===7?[set(68,1),say('FOE ACCURACY FELL!')]:i===1?[set(28,1),say('FOE WAS SEEDED!')]:i===3?[set(69,1),say('FOE WAS PARALYZED!')]:i===5?[invoke('attack'),set(16,V(16)),math(16,'div',2),math(3,'add',16,'var'),EX('$3$ > $2$',[set(3,V(2))]),...storeHP()]:[set(17,1),say('DEFENSE ROSE!')])])];}
function fight(){return species.map((c,i)=>IF(1,'==',i+1,[EX(`$${100+i*4}$ + $${101+i*4}$ + $${102+i*4}$ + $${103+i*4}$ == 0`,[say(`${c.name}\nUSED STRUGGLE!`),set(14,1),invoke('attack'),math(3,'sub',4),IF(3,'<',0,[set(3,0)]),...storeHP(),set(18,1)],[say(`PP $${100+i*4}$/$${101+i*4}$/\n$${102+i*4}$/$${103+i*4}$`),menu(14,[...c.moves,'BACK'],true,'menu'),...c.moves.flatMap((_,j)=>IF(14,'==',j+1,selectedMove(c,i,j)))])]))};
script('battlefield','fight',fight());

const battle=[hide('player'),E('EVENT_REMOVE_INPUT_SCRIPT',{input:['start','select']}),...hiddenLogic.map(h=>hide(uuid('actor:'+h))),set(17,0),set(28,0),set(29,0),set(68,0),set(69,0),...loadHP(),IF(3,'<=',0,living()),IF(19,'!=',0,configureBoss()),invoke('hud'),IF(19,'!=',0,[IF(19,'==',1,[say('BROCK WANTS\nTO BATTLE!')],[IF(19,'==',2,[say('BLUE WANTS\nTO BATTLE!')],[say('YOUNGSTER WANTS\nTO BATTLE!')])])],[...species.map((c,i)=>IF(4,'==',i+1,[say(`WILD ${c.name}\nAPPEARED!`)]))]),label('turn'),IF(3,'<=',0,living()),IF(1,'==',0,[say('RED HAS NO\nPOKEMON LEFT!'),...heal(),set(1,0),...living(),E('EVENT_SCENE_RESET_STATE'),switchScene('fernvale',18,23)]),set(18,0),invoke('hud'),menu(24,['FIGHT','BAG','POKEMON','RUN'],false),
  IF(24,'==',1,[invoke('fight')]),
  IF(24,'==',2,[invoke('bag')]),IF(24,'==',3,[invoke('party')]),IF(24,'==',4,[IF(19,'!=',0,[say('NO RUNNING FROM\nA TRAINER BATTLE!')],[say('GOT AWAY SAFELY.'),...pop()])]),
  IF(18,'==',1,[EX('$28$ == 1 && $3$ > 0',[math(5,'sub',2),math(3,'add',2),EX('$3$ > $2$',[set(3,V(2))]),...storeHP(),say('LEECH SEED\nDRAINED THE FOE!')]),IF(5,'<=',0,[set(5,0),invoke('victory'),go('turn')]),IF(3,'>',0,[invoke('counter')]),IF(3,'<=',0,[say('YOUR POKEMON\nFAINTED!'),...living(),IF(1,'>',0,[set(17,0),invoke('hud'),say('THE NEXT POKEMON\nTAKES THE FIELD.')])])]),go('turn')];
script('battlefield','battlefield',battle,'script','scene');
const count = events => events.reduce((n,e)=>n+1+Object.values(e.children||{}).reduce((m,a)=>m+count(a),0),0);
plan.statistics={eventCount:plan.scripts.reduce((n,s)=>n+count(s.events),0),scriptCount:plan.scripts.length,actorCount:plan.actors.length,triggerCount:plan.triggers.length,variables:plan.variables.length};
await writeFile(path.join(root,'artwork/game-plan.json'),JSON.stringify(plan));
console.log(JSON.stringify(plan.statistics));
