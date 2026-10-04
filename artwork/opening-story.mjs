import {dexId} from './campaign-world.mjs';
export const openingEncounters={
 route_one:[[16,3,20],[19,3,20],[19,3,15],[19,2,10],[16,2,10],[16,3,10],[16,3,5],[19,4,5],[16,4,4],[16,5,1]],
 forest:[[10,4,20],[11,5,20],[10,3,15],[10,5,10],[11,4,10],[11,6,10],[14,4,5],[13,3,5],[25,3,4],[25,5,1]],
 route_twenty_two:[[19,3,20],[29,3,20],[19,4,15],[29,4,10],[19,2,10],[29,2,10],[21,3,5],[21,5,5],[32,3,4],[32,4,1]],
 route_three:[[16,6,20],[21,5,20],[16,7,15],[21,6,10],[21,7,10],[16,8,10],[21,8,5],[39,3,5],[39,5,4],[39,7,1]],
 mt_moon:[[41,8,20],[41,7,20],[41,9,15],[74,8,10],[41,6,10],[41,10,10],[74,10,5],[46,8,5],[41,11,4],[35,8,1]]
};
export function authorOpening(h){
 const {plan,ids,uuid,E,IF,EX,N,V,set,math,rand,say,menu,script,actor,trigger,switchScene,position,hide,show,heal,loadHP,storage,pauseMenu,restorePP,startBattle,sfx,maxHPEvents}=h;
 const change=(key,events,type='actor')=>{const s=plan.scripts.find(s=>s.target[type+'Id']===uuid(type+':'+key)&&s.target.scriptKey==='script');if(!s)throw new Error('Missing opening script '+key);s.events=events;};
 const move=(key,x,y,name)=>{const a=plan.actors.find(a=>a.id===uuid('actor:'+key));Object.assign(a,{x,y,...(name?{name}:{})});};
 const doorway=(key,x,y,events)=>{const t=plan.triggers.find(t=>t.id===uuid('trigger:'+key));Object.assign(t,{x,y});change(key,events,'trigger');};
 move('mom',13,11);change('mom',[IF(1,'>',0,[say('MOM: SO THIS IS\nYOUR NEW PARTNER!\nCOME SIT WITH ME.'),...heal(),...loadHP(),say('YOU CAN ALWAYS\nCOME HOME, RED.\nI WILL BE HERE.')],[say('MOM: OAK ASKED\nFOR YOU AND BLUE\nTHIS MORNING.'),say('HIS LAB IS SOUTH\nOF HERE, BY THE\nWATER. GO SEE HIM.')])]);
 actor('red_house','bedroom pc','Home PC','logic',2,6,[IF(249,'==',0,[set(249,1),math(9,'add',1),say('WITHDREW A POTION\nFROM THE PC.')],[say('THE ITEM BOX\nIS EMPTY.')])]);
 move('prof',5,9);change('prof',[
   IF(1,'==',0,[set(246,1),say('OAK: I ONCE\nDREAMED OF SEEING\nEVERY POKEMON.'),say('NOW I NEED TWO\nYOUNG TRAINERS\nTO GO WHERE I\nCANNOT. YOU AND\nBLUE.'),say('THREE POKEMON\nWAIT ON THE TABLE.\nCHOOSE A PARTNER.')],[
     IF(247,'==',1,[set(247,2),set(248,1),say('OAK: MY PARCEL!\nYOU MADE IT THERE\nAND BACK TOGETHER.'),say('TAKE THIS\nPOKEDEX. EVERY\nDISCOVERY HELPS\nMY RESEARCH.'),say('BLUE IS ALREADY\nCHASING BADGES.\nFIND YOUR OWN\nREASON TO TRAVEL.'),say('BUY POKE BALLS\nAT THE MART. THEN\nCROSS VIRIDIAN\nFOREST TO PEWTER.')],[IF(248,'==',0,[say('OAK: TRY ROUTE 1\nWITH YOUR PARTNER.\nIT LEADS NORTH TO\nVIRIDIAN CITY.'),say('THE MART THERE\nIS HOLDING A\nPARCEL FOR ME.')],[say('OAK: EVERY NEW\nSPECIES TELLS US\nSOMETHING. WHAT\nHAVE YOU FOUND?')])]),...heal(),...loadHP()
   ])
 ]);
 for(const [starter,x]of [[2,8],[3,11],[1,14]]){
   const names={1:'CHARMANDER',2:'BULBASAUR',3:'SQUIRTLE'};
   actor('laboratory','starter ball '+starter,names[starter]+' Ball','logic',x,7,[IF(1,'==',0,[IF(246,'==',1,[say(names[starter]+' IS INSIDE\nTHIS POKE BALL.'),menu(13,['CHOOSE','LOOK AGAIN']),IF(13,'==',1,[set(1,starter),set(27,starter),set(29+starter,1),set(49+starter,1),set(59+starter,5),set(0,5),...maxHPEvents(starter,0,2),set(3,V(2)),set(39+starter,V(2)),...restorePP(starter-1),set(10,1),set(25,1),sfx(7),say(names[starter]+'\nIS YOUR FIRST\nPARTNER!')])],[say('TALK TO OAK\nBEFORE CHOOSING.')])],[say('THE REMAINING\nPOKEMON STAYS\nWITH PROFESSOR OAK.')])]);
 }
 const rival=[say('BLUE: WAIT, RED!\nWE ARE TRAINERS\nNOW. PROVE YOU\nCAN HANDLE IT.'),say('OAK: WATCH BOTH\nPOKEMONS HEALTH.\nA POTION CAN KEEP\nYOUR PARTNER IN\nTHE FIGHT.'),set(19,2),set(20,1),...startBattle()];
 actor('laboratory','opening blue','Blue','blue',7,12,[IF(26,'==',0,[IF(1,'==',0,[say('BLUE: GO AHEAD.\nPICK YOUR\nPOKEMON FIRST.')],rival)],[say('BLUE: I AM\nHEADING FOR THE\nPOKEMON LEAGUE.')])]);
 change('leave lab',[IF(1,'==',0,[say('CHOOSE YOUR\nFIRST POKEMON.'),position(9,15)],[IF(26,'==',0,rival,[switchScene('fernvale',23,23)])])],'trigger');
 doorway('enter lab',23,22,[switchScene('laboratory',9,15,'up')]);
 doorway('enter red house',7,10,[switchScene('red_house',9,15,'up')]);
 change('leave red house',[switchScene('fernvale',7,11)],'trigger');
 change('north route',[IF(1,'==',0,[say('OAK: WAIT, RED!\nWILD POKEMON LIVE\nIN THE GRASS.'),set(246,1),say('COME TO MY LAB.\nYOU NEED A\nPOKEMON PARTNER.'),switchScene('laboratory',9,12)],[switchScene('route_one',15,29,'up')])],'trigger');
 move('nurse',11,16,'Pallet Neighbor');change('nurse',[say('I HEAR OAK IS\nTRUSTING YOU WITH\nA POKEMON TODAY.')]);
 move('kid',25,12,'Daisy');change('kid',[IF(248,'==',1,[say('DAISY: VIRIDIAN\nIS NORTH OF HERE.\nPEWTER IS BEYOND\nTHE FOREST.')],[say('DAISY: BLUE\nWENT TO THE LAB\nEARLIER TODAY.')])]);
 move('journal',4,15,'Pallet Sign');change('journal',[say('PALLET TOWN\nA QUIET PLACE\nTO BEGIN AGAIN.')]);
 move('fernvale mart',12,20,'Coastal Resident');change('fernvale mart',[say('THE SEA GOES ALL\nTHE WAY SOUTH TO\nCINNABAR ISLAND.')]);
 move('scout',18,22,'Mart Employee');change('scout',[IF(261,'==',0,[set(261,1),math(9,'add',1),say('I WORK AT THE\nMART IN VIRIDIAN.\nHERE IS A POTION.'),say('IT HELPS WHEN\nYOUR POKEMON\nIS HURT.')],[say('FOLLOW THIS ROAD\nNORTH TO REACH\nVIRIDIAN CITY.')])]);
 // Interiors keep their own interactions instead of duplicating outdoor services.
 for(const room of ['viridian_mart','viridian_center'])script(room,room,[show('player'),pauseMenu()],'script','scene');
 trigger('viridian','enter opening center',7,21,2,1,[switchScene('viridian_center',9,15)]);
 trigger('viridian_center','leave opening center',8,17,4,1,[switchScene('viridian',7,22)]);
 trigger('viridian','enter opening mart',24,21,2,1,[switchScene('viridian_mart',9,15)]);
 trigger('viridian_mart','leave opening mart',8,17,4,1,[switchScene('viridian',24,22)]);
 const gym=plan.triggers.find(t=>t.id===uuid('trigger:enter viridian gym'));gym.y=10;
 change('leave viridian gym',[switchScene('viridian',24,11)],'trigger');
 const shop=[say('WELCOME!\nMONEY $133$'),menu(13,['BALL 200','POTION 300','LEAVE']),...[[1,8,200,'POKE BALL'],[2,9,300,'POTION']].map(([choice,v,price,item])=>IF(13,'==',choice,[IF(v,'>=',99,[say('YOUR BAG IS FULL.')],[IF(133,'>=',price,[math(133,'sub',price),math(v,'add',1),say('BOUGHT A '+item+'.')],[say('NOT ENOUGH MONEY.')])])]))];
 actor('viridian_mart','parcel clerk','Mart Clerk','oak',9,7,[IF(248,'==',0,[IF(247,'==',0,[set(247,1),say('YOU CAME FROM\nPALLET TOWN?\nI HAVE A DELIVERY.'),say('PLEASE TAKE THIS\nPARCEL BACK TO\nPROFESSOR OAK.')],[say('OAK IS WAITING\nFOR THAT PARCEL.')])],shop)]);
 actor('viridian_center','opening joy','Nurse Joy','joy',9,7,[say('WELCOME TO OUR\nPOKEMON CENTER.'),menu(13,['HEAL','NOT NOW']),IF(13,'==',1,[...heal(),...loadHP(),set(134,1),sfx(7),say('YOUR POKEMON\nARE FULLY HEALED.\nTAKE CARE!')])]);
 actor('viridian_center','opening pc','Bills PC','logic',3,13,storage());
 change('viridian nurse',[say('THE POKEMON\nCENTER IS THE\nBUILDING TO THE\nWEST.')]);move('viridian nurse',19,22,'Center Visitor');
 change('viridian pc',[say('THE GYM LEADER\nIS AWAY. THE\nMART IS OPEN.')]);move('viridian pc',18,16,'Viridian Resident');
 change('viridian mart',[say('THE SHOP IS\nINSIDE THE\nBUILDING ABOVE.')]);move('viridian mart',25,23,'Shop Customer');
 change('north forest',[IF(248,'==',1,[switchScene('forest',15,29)],[IF(247,'==',1,[say('YOU STILL HAVE\nOAKS PARCEL.\nPALLET TOWN IS\nSOUTH OF HERE.')],[say('THE PATH IS\nBLOCKED FOR NOW.\nTHE MART CLERK\nIS CALLING YOU\nFROM THE EAST.')])])],'trigger');
 // Ten-slot Blue encounter tables; cumulative percentages preserve rare Pikachu.
 for(const area of Object.keys(openingEncounters)){
   const records=openingEncounters[area];let threshold=0;
   const choose=records.map(([dex,level,weight],i)=>{const low=threshold;threshold+=weight;return EX(`$135$ > ${low} && $135$ <= ${threshold}`,[set(4,dexId(dex)),set(7,level)]);});
   for(const t of plan.triggers.filter(t=>t.sceneId===ids.scenes[area]&&(t.name.startsWith('grass ')||t.name.startsWith('wild '))))change(t.name,[IF(21,'==',1,[set(21,0)],[rand(15,1,100),IF(15,'<=',area==='forest'?12:20,[set(19,0),rand(135,1,100),...choose,...maxHPEvents(V(4),7,6),set(5,V(6)),...startBattle()])])],'trigger');
 }
 // Redirect recovery and travel away from the lab's new footprint.
 const relocate=events=>{for(const e of events){if(e.command==='EVENT_SWITCH_SCENE'){
   if(e.args.sceneId===ids.scenes.fernvale&&e.args.x?.value===18&&e.args.y?.value===21){e.args.x=N(15);e.args.y=N(19);}
   if(e.args.sceneId===ids.scenes.viridian&&e.args.x?.value===3&&e.args.y?.value===16)e.args.y=N(14);
 }for(const v of Object.values(e.children||{}))relocate(v);}};
 for(const s of [...plan.scripts,...plan.customScripts])relocate(s.events||s.script);
 const victory=plan.scripts.find(s=>s.target.actorId===uuid('actor:victory'));
 const noFreeBalls=events=>{for(const e of events){if(e.command==='EVENT_IF'&&e.args.condition?.valueA?.value==='19'&&e.args.condition?.valueB?.value===0)e.children.true=[];for(const list of Object.values(e.children||{}))noFreeBalls(list);}};
 noFreeBalls(victory.events);
 const field=plan.customScripts.find(s=>s.name==='Kanto field_menu');
 for(const e of field.script){
   if(e.command!=='EVENT_IF'||e.args.condition?.valueA?.value!=='23')continue;
   if(e.args.condition.valueB.value===2)e.children.true=[IF(248,'==',1,e.children.true,[say('OAK HAS NOT\nGIVEN YOU A\nPOKEDEX YET.')])];
 }
}
