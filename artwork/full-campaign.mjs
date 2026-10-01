import { world,roster,dexId,bossTeams } from './campaign-world.mjs';

export const towns=[
  ['fernvale','PALLET',0],['viridian','VIRIDIAN',1],['pewter','PEWTER',2],
  ['cerulean','CERULEAN',3],['vermilion','VERMILION',4],['lavender','LAVENDER',5],
  ['celadon','CELADON',6],['fuchsia','FUCHSIA',7],['saffron','SAFFRON',8],
  ['cinnabar','CINNABAR',9],['indigo','INDIGO',10]
];
export function journeyEvents({IF,say}){
  const goals=[[12,'BROCK AT PEWTER'],[150,'MISTY AT CERULEAN'],[151,'LT SURGE'],[152,'ERIKA AT CELADON'],
    [185,'RESCUE MR FUJI IN\nPOKEMON TOWER'],[180,'KOGA AT FUCHSIA'],[186,'FIND SURF IN\nTHE SAFARI ZONE'],
    [187,'RETURN GOLD TEETH\nTO THE WARDEN'],[190,'FREE SILPH CO.\nIN SAFFRON'],[181,'SABRINA AT SAFFRON'],
    [191,'FIND THE KEY IN\nPOKEMON MANSION'],[182,'BLAINE AT CINNABAR'],[183,'GIOVANNI AT\nVIRIDIAN GYM'],
    [220,'CHALLENGE THE\nPOKEMON LEAGUE']];
  return goals.reduceRight((next,[flag,text])=>[IF(flag,'==',0,[say('NEXT: '+text)],next)],[say('KANTO CHAMPION!\nCOMPLETE ALL 151\nPOKEDEX ENTRIES.')]);
}
export function travelMenu({IF,say,menu,switchScene}){
  const choice=(town,i)=>IF(13,'==',i+1,[IF(250+towns.indexOf(town),'==',1,[switchScene(town[0],18,21)],[say('VISIT THIS TOWN\nON FOOT FIRST.')])]);
  return [IF(193,'==',0,[say('MEET THE FLY\nKEEPER IN CELADON\nAFTER ERIKA.')],[
    menu(13,[...towns.slice(0,7).map(t=>t[1]),'MORE'],true,'menu'),
    ...towns.slice(0,7).map(choice),
    IF(13,'==',8,[menu(13,towns.slice(7).map(t=>t[1]),true,'menu'),...towns.slice(7).map(choice)])
  ])];
}
export function authorFullCampaign(h){
  const {actor,trainer,enter,trigger,IF,EX,say,menu,set,math,V,startBattle,switchScene,heal,loadHP,storage,evolve,registerPokemon,save,plan,ids,script,sfx}=h;
  const guard=(variable,message)=>({variable,value:1,message});
  const wild=(dex,level)=>[set(19,0),set(4,dexId(dex)),set(7,level),set(6,level*4+24),set(5,V(6)),...startBattle()];
  const gift=(dex,level)=>[set(4,dexId(dex)),set(7,level),...registerPokemon()];
  const challenge=(mode)=>[set(19,mode),set(20,1),...startBattle()];
  const own=dex=>{const i=dexId(dex)-1;return i<8?30+i:400+(i-8)*10;};
  const leader=(scene,key,name,sprite,mode,flag,condition=null)=>{
    const events=[say(name+':\nSHOW ME YOUR\nPOKEMON!'),menu(13,['CHALLENGE','LATER']),IF(13,'==',1,challenge(mode))];
    actor(scene,key,name,sprite,9,5,[IF(flag,'==',1,[say(name+':\nYOU WON THIS\nCHALLENGE!')],condition?[IF(condition.variable,'==',condition.value,events,[say(condition.message)])]:events)]);
  };
  // Tower, the flute, and two independent routes to Fuchsia.
  enter('lavender','enter pokemon tower',24,12,2,1,'pokemon_tower',15,28,guard(159,'RECOVER THE SILPH\nSCOPE FROM THE\nROCKET HIDEOUT.'));
  enter('pokemon_tower','leave tower',14,30,4,2,'lavender',24,13);
  enter('pokemon_tower','climb tower',14,1,4,1,'tower_summit',15,28);
  enter('tower_summit','descend tower',14,30,4,2,'pokemon_tower',15,3);
  trainer('pokemon_tower','channeler','Channeler','joy',12,17,55,242);
  trainer('tower_summit','fuji rocket','Tower Rocket','trainer-rocket',15,10,34,197);
  actor('tower_summit','fuji','Mr Fuji','oak',15,5,[IF(197,'==',1,[set(184,1),set(185,1),say('MR FUJI:\nTHANK YOU, RED.\nTAKE THE POKE FLUTE!')],[say('TEAM ROCKET\nWONT LET ME GO.')])]);
  enter('lavender','west route twelve',1,15,2,3,'route_twelve',15,3,guard(185,'A SNORLAX SLEEPS\nHERE. MR FUJI\nMIGHT HELP.'));
  enter('route_twelve','route twelve north lavender',14,1,4,1,'lavender',3,16);
  enter('route_twelve','south fuchsia',14,30,4,2,'fuchsia',15,3);
  enter('fuchsia','north route twelve',14,1,4,1,'route_twelve',15,28);
  actor('route_twelve','sleeping snorlax','Snorlax','snorlax',15,17,[IF(own(143),'==',1,[say('SNORLAX IS IN\nYOUR COLLECTION.')],[say('THE POKE FLUTE\nWAKES SNORLAX!'),...wild(143,30)])]);
  trainer('route_twelve','fisherman','Fisherman','trainer-sailor',15,22,53,240);
  enter('celadon','west cycling road',1,15,2,3,'cycling_road',28,16,guard(206,'GET A BICYCLE\nIN CERULEAN CITY.'));
  enter('cycling_road','east celadon',30,15,2,3,'celadon',3,16);
  enter('cycling_road','south fuchsia west',14,30,4,2,'fuchsia',3,16);
  enter('fuchsia','fuchsia west cycling road',1,15,2,3,'cycling_road',15,28);
  actor('cerulean','bike shop','Bike Owner','oak',12,19,[IF(157,'==',1,[set(206,1),say('BILLS FRIEND?\nTAKE THIS BICYCLE!')],[say('MEET BILL NORTH\nOF NUGGET BRIDGE.')])]);
  trainer('cycling_road','biker','Biker','trainer-rocket',12,17,43,230);
  trainer('cycling_road','bird keeper','Bird Keeper','blue',20,23,44,231);
  // Safari exploration grants the two field HMs used by the second half.
  enter('fuchsia','enter fuchsia gym',24,12,2,1,'fuchsia_gym',9,15);
  enter('fuchsia_gym','leave fuchsia gym',8,17,4,1,'fuchsia',24,13);
  leader('fuchsia_gym','koga','Koga','trainer-koga',29,180);
  enter('fuchsia','enter safari gate',7,12,2,1,'safari_gate',9,15);
  enter('safari_gate','leave safari gate',8,17,4,1,'fuchsia',7,13);
  actor('safari_gate','safari ranger','Safari Ranger','trainer-catcher',9,7,[say('EXPLORE THE THREE\nSAFARI HABITATS.\nFIND THE LAKE HUT.'),set(207,1)]);
  enter('safari_gate','enter safari west',8,3,4,1,'safari_west',15,28,guard(207,'TALK TO THE\nSAFARI RANGER.'));
  enter('safari_west','leave safari west',14,30,4,2,'safari_gate',9,4);
  enter('safari_west','east safari',30,15,2,3,'safari_east',3,16);
  enter('safari_east','west safari',1,15,2,3,'safari_west',28,16);
  enter('safari_east','north safari lake',14,1,4,1,'safari_lake',15,28);
  enter('safari_lake','south safari east',14,30,4,2,'safari_east',15,3);
  actor('safari_east','gold teeth','Gold Teeth','oak',12,18,[set(188,1),say('FOUND THE\nWARDENS GOLD\nTEETH!')]);
  actor('safari_lake','surf keeper','Surf Keeper','oak',15,5,[set(186,1),say('YOU FOUND THE\nSECRET HUT!\nTAKE HM SURF.')]);
  actor('fuchsia','warden','Warden','oak',12,19,[IF(188,'==',1,[set(187,1),say('MY GOLD TEETH!\nTHANK YOU!\nTAKE HM STRENGTH.')],[say('MY TEETH ARE\nLOST IN THE\nSAFARI ZONE.')])]);
  trainer('safari_west','safari trainer','Safari Trainer','trainer-catcher',12,17,52,239);
  // Saffron, Silph's key, rival, boss and president.
  enter('celadon','east saffron',30,15,2,3,'saffron',3,16,guard(152,'WIN THE RAINBOW\nBADGE FIRST.'));
  enter('saffron','west celadon',1,15,2,3,'celadon',28,16);
  enter('saffron','enter silph',7,12,2,1,'silph_lobby',15,28);
  enter('silph_lobby','leave silph',14,30,4,2,'saffron',7,13);
  enter('silph_lobby','silph lift',14,1,4,1,'silph_floor',15,28,guard(233,'DEFEAT THE\nROCKET SCIENTIST.'));
  enter('silph_floor','silph downstairs',14,30,4,2,'silph_lobby',15,3);
  enter('silph_floor','silph office door',14,1,4,1,'silph_office',15,28,guard(189,'THE DOOR NEEDS\nA CARD KEY.'));
  enter('silph_office','silph return',14,30,4,2,'silph_floor',15,3);
  trainer('silph_lobby','silph scientist','Rocket Scientist','trainer-rocket',15,10,46,233);
  trainer('silph_floor','silph captain','Rocket Captain','trainer-rocket',13,13,47,234);
  actor('silph_floor','card key','Card Key','oak',20,6,[IF(234,'==',1,[set(189,1),say('FOUND THE\nSILPH CARD KEY!')],[say('THE ROCKET\nCAPTAIN HAS\nTHE CARD KEY.')])]);
  trainer('silph_office','silph blue','Blue','blue',13,13,35,210);
  actor('silph_office','silph giovanni','Giovanni','trainer-giovanni',15,5,[IF(190,'==',1,[say('TEAM ROCKET\nRETREATS FROM\nSILPH CO.')],[IF(210,'==',1,[say('GIOVANNI:\nYOU AGAIN!'),...challenge(33)],[say('BLUE WANTS\nA BATTLE FIRST.')])])]);
  actor('silph_office','president','Silph President','oak',20,5,[IF(190,'==',1,[IF(203,'==',0,[set(203,1),set(202,1),say('THANK YOU!\nTAKE A MASTER BALL\nAND THIS LAPRAS.'),...gift(131,30)],[say('SILPH IS SAFE\nTHANKS TO YOU!')])],[say('PLEASE STOP\nGIOVANNI.')])]);
  enter('saffron','enter saffron gym',24,12,2,1,'saffron_gym',9,15,guard(190,'FREE SILPH CO.\nFROM TEAM ROCKET.'));
  enter('saffron_gym','leave saffron gym',8,17,4,1,'saffron',24,13);
  leader('saffron_gym','sabrina','Sabrina','trainer-sabrina',30,181,guard(180,'WIN KOGAS SOUL\nBADGE FIRST.'));
  enter('saffron','enter dojo',14,23,4,1,'fighting_dojo',9,15);
  enter('fighting_dojo','leave dojo',8,17,4,1,'saffron',15,21);
  leader('fighting_dojo','karate master','Karate Master','brock',36,201);
  actor('fighting_dojo','dojo gift','Dojo Prize','oak',14,8,[IF(201,'==',1,[IF(217,'==',0,[menu(13,['HITMONLEE','HITMONCHAN','LATER']),IF(13,'==',1,[set(217,1),...gift(106,30)]),IF(13,'==',2,[set(217,1),...gift(107,30)])],[say('TRAIN YOUR\nPARTNER WELL.')])],[say('BEAT THE KARATE\nMASTER FIRST.')])]);
  trainer('saffron','saffron psychic','Psychic','trainer-erika',12,19,45,232);
  // Southern sea route, strength puzzle and Cinnabar research.
  enter('fuchsia','south sea route',14,24,4,2,'route_nineteen',15,3,guard(186,'FIND HM SURF IN\nTHE SAFARI ZONE.'));
  enter('route_nineteen','north fuchsia',14,1,4,1,'fuchsia',15,23);
  enter('route_nineteen','south seafoam',14,30,4,2,'seafoam',15,28);
  enter('seafoam','leave seafoam north',14,30,4,2,'route_nineteen',15,28);
  actor('seafoam','seafoam boulder','Boulder','brock',12,17,[IF(187,'==',1,[set(192,1),say('STRENGTH MOVED\nTHE BOULDER.\nTHE CURRENT SLOWS.')],[say('THIS BOULDER\nNEEDS STRENGTH.')])]);
  enter('seafoam','seafoam depths',14,1,4,1,'seafoam_depths',15,28,guard(192,'SLOW THE CURRENT\nWITH A BOULDER.'));
  enter('seafoam_depths','seafoam climb',14,30,4,2,'seafoam',15,3);
  enter('seafoam','west cinnabar',1,15,2,3,'cinnabar',28,16,guard(192,'SLOW THE CURRENT\nWITH STRENGTH.'));
  enter('cinnabar','east seafoam',30,15,2,3,'seafoam',3,16);
  trainer('route_nineteen','sea swimmer','Sea Swimmer','trainer-sailor',12,17,48,235);
  enter('cinnabar','enter cinnabar lab',7,12,2,1,'cinnabar_lab',9,15);
  enter('cinnabar_lab','leave cinnabar lab',8,17,4,1,'cinnabar',7,13);
  actor('cinnabar_lab','fossil researcher','Fossil Researcher','oak',9,7,[IF(205,'==',1,[say('YOUR FOSSIL\nPOKEMON IS\nDOING WELL.')],[IF(154,'>',0,[set(205,1),IF(154,'==',1,gift(138,30),gift(140,30)),say('YOUR FOSSIL\nLIVES AGAIN!')],[say('BRING A FOSSIL\nFROM MT MOON.')])])]);
  actor('cinnabar_lab','amber researcher','Amber Researcher','oak',14,8,[IF(218,'==',0,[set(218,1),say('THIS OLD AMBER\nBECAME AERODACTYL.\nPLEASE RAISE IT.'),...gift(142,35)],[say('AERODACTYL IS\nAN ANCIENT\nPOKEMON.')])]);
  enter('cinnabar','enter mansion',14,1,4,1,'mansion',15,28);
  enter('mansion','leave mansion',14,30,4,2,'cinnabar',15,3);
  actor('mansion','mansion statue','Secret Statue','oak',12,17,[set(198,1),say('A HIDDEN SWITCH!\nTHE CELLAR OPENS.')]);
  enter('mansion','mansion cellar',14,1,4,1,'mansion_depths',15,28,guard(198,'FIND THE\nSTATUE SWITCH.'));
  enter('mansion_depths','mansion stairs',14,30,4,2,'mansion',15,3);
  actor('mansion_depths','secret key','Secret Key','oak',15,5,[set(191,1),say('FOUND THE\nSECRET KEY TO\nCINNABAR GYM.')]);
  actor('mansion_depths','mew journal','Research Journal','oak',20,6,[say('JOURNAL:\nMEW GAVE RISE TO\nA POWERFUL POKEMON.\nWE COULD NOT\nCONTROL MEWTWO.')]);
  trainer('mansion','mansion burglar','Burglar','trainer-rocket',15,10,49,236);
  enter('cinnabar','enter cinnabar gym',24,12,2,1,'cinnabar_gym',9,15,guard(191,'FIND THE SECRET\nKEY IN THE\nPOKEMON MANSION.'));
  enter('cinnabar_gym','leave cinnabar gym',8,17,4,1,'cinnabar',24,13);
  leader('cinnabar_gym','blaine','Blaine','trainer-blaine',31,182,guard(181,'WIN SABRINAS\nMARSH BADGE FIRST.'));
  actor('cinnabar_gym','blaine quiz','Quiz Master','oak',3,10,[say('FIRE LOSES TO\nWATER AND ROCK.\nIS THAT TRUE?'),menu(13,['YES','NO']),IF(13,'==',1,[say('CORRECT!\nA POTION FOR YOU.'),IF(219,'==',0,[set(219,1),math(9,'add',1)])],[say('TRY WATER OR\nROCK AGAINST FIRE.')])]);
  enter('cinnabar','cinnabar south route twenty one',14,24,4,2,'route_twenty_one',15,28);
  enter('route_twenty_one','south cinnabar',14,30,4,2,'cinnabar',15,23);
  enter('route_twenty_one','north pallet sea',14,1,4,1,'fernvale',15,23);
  enter('fernvale','south route twenty one',14,24,4,2,'route_twenty_one',15,3,guard(186,'YOU NEED SURF\nTO CROSS THE SEA.'));
  // The final gym and the League.
  enter('viridian','enter viridian gym',24,12,2,1,'viridian_gym',9,15,guard(182,'THE GYM LEADER\nRETURNS AFTER\nSEVEN BADGES.'));
  enter('viridian_gym','leave viridian gym',8,17,4,1,'viridian',24,13);
  leader('viridian_gym','giovanni gym','Giovanni','trainer-giovanni',32,183);
  enter('viridian','west route twenty two',1,15,2,3,'route_twenty_two',28,16);
  enter('route_twenty_two','east viridian',30,15,2,3,'viridian',3,16);
  trainer('route_twenty_two','league rival','Blue','blue',15,9,42,211);
  trigger('route_twenty_two','league badge gate',14,1,4,1,[EX('$12$ + $150$ + $151$ + $152$ + $180$ + $181$ + $182$ + $183$ == 8 && $187$ == 1 && $211$ == 1',[switchScene('victory_road',15,28)],[say('ALL EIGHT BADGES,\nSTRENGTH AND A WIN\nOVER BLUE REQUIRED.')])]);
  enter('victory_road','leave victory road',14,30,4,2,'route_twenty_two',15,3);
  actor('victory_road','victory boulder','First Boulder','brock',12,17,[set(199,1),say('STRENGTH PUSHES\nTHE BOULDER ONTO\nA FLOOR SWITCH.')]);
  enter('victory_road','victory summit',14,1,4,1,'victory_summit',15,28,guard(199,'PUSH THE BOULDER\nONTO THE SWITCH.'));
  enter('victory_summit','victory downstairs',14,30,4,2,'victory_road',15,3);
  actor('victory_summit','victory last boulder','Second Boulder','brock',12,17,[set(200,1),say('THE FINAL GATE\nIS OPEN!')]);
  enter('victory_summit','north indigo',14,1,4,1,'indigo',15,23,guard(200,'PUSH THE LAST\nBOULDER TO OPEN\nTHE GATE.'));
  enter('indigo','south victory summit',14,24,4,2,'victory_summit',15,3);
  trainer('victory_road','victory cooltrainer','Cooltrainer','blue',15,10,50,237);
  trainer('victory_summit','victory ace','Ace Trainer','trainer-erika',15,10,51,238);
  actor('indigo','league attendant','League Attendant','oak',15,8,[say('FIVE BATTLES.\nNO HEALING BETWEEN\nTHE LEAGUE ROOMS.'),menu(13,['ENTER LEAGUE','LATER']),IF(13,'==',1,[set(195,0),...[221,222,223,224,196].map(v=>set(v,0)),...heal(),...loadHP(),set(134,10),switchScene('lorelei',9,15)])]);
  const league=[['lorelei','Lorelei','trainer-lorelei',37,221],['bruno','Bruno','trainer-bruno',38,222],['agatha','Agatha','trainer-agatha',39,223],['lance','Lance','trainer-lance',40,224],['champion_room','Champion Blue','blue',41,196]];
  league.forEach(([scene,name,sprite,mode,flag],index)=>{
    leader(scene,'league '+name,name,sprite,mode,flag);
    enter(scene,'league advance '+index,8,3,4,1,index===4?'hall_of_fame':league[index+1][0],9,15,{variable:195,value:index+1,message:'WIN THIS LEAGUE\nBATTLE TO ADVANCE.'});
    trigger(scene,'league retreat '+index,8,17,4,1,[say('LEAVE THIS\nLEAGUE ATTEMPT?'),menu(13,['KEEP GOING','LEAVE']),IF(13,'==',2,[set(195,0),switchScene('indigo',15,10)])]);
  });
  actor('hall_of_fame','hall oak','Professor Oak','oak',9,7,[IF(220,'==',0,[set(220,1),set(196,1),say(['PROF. OAK:\nRED! YOU ARE THE\nKANTO CHAMPION!','YOUR POKEMON\nENTER THE\nHALL OF FAME.','YOUR JOURNEY\nCONTINUES. FIND\nALL 151 POKEMON!']),sfx(7),save()],[say('WELCOME BACK,\nCHAMPION RED.\nYOUR LEGACY LIVES!')])]);
  enter('hall_of_fame','leave hall of fame',8,17,4,1,'indigo',15,10);
  // Legendary encounters remain available after fleeing or losing.
  function legendary(scene,key,name,dex,level,x,y){actor(scene,key,name,roster.find(p=>p.dex===dex).key,x,y,[IF(own(dex),'==',1,[say(name+' IS ALREADY\nIN YOUR POKEDEX.')],[say(name+'\nAPPEARS!'),...wild(dex,level)])]);}
  enter('route_nine','east power plant',30,15,2,3,'power_plant',15,28,guard(186,'SURF TO THE\nPOWER PLANT.'));
  enter('power_plant','leave power plant',14,30,4,2,'route_nine',28,16);
  trainer('power_plant','plant engineer','Engineer','trainer-surge',12,17,56,243);
  legendary('power_plant','zapdos','ZAPDOS',145,50,15,5);
  legendary('seafoam_depths','articuno','ARTICUNO',144,50,15,5);
  legendary('victory_summit','moltres','MOLTRES',146,50,20,6);
  enter('cerulean','east cerulean cave',30,15,2,3,'cerulean_cave',15,28,guard(220,'ONLY A HALL OF\nFAME TRAINER MAY\nENTER THIS CAVE.'));
  enter('cerulean_cave','leave cerulean cave',14,30,4,2,'cerulean',28,16);
  legendary('cerulean_cave','mewtwo','MEWTWO',150,70,15,5);
  enter('fernvale','west reserve',1,15,2,3,'secret_garden',28,16,guard(220,'BECOME CHAMPION\nTO VISIT OAKS\nPOKEMON RESERVE.'));
  enter('secret_garden','east pallet',30,15,2,3,'fernvale',3,16);
  actor('secret_garden','mew','Mew','mew',15,5,[IF(10,'>=',100,[IF(own(151),'==',0,wild(151,50),[say('MEW IS IN YOUR\nPOKEDEX!')])],[say('A RARE POKEMON\nAWAITS A TRAINER\nWITH 100 ENTRIES.')])]);
  // Services: finite purchases, stone/trade evolution, travel, and gifts.
  actor('celadon','fly keeper','Fly Keeper','trainer-catcher',12,19,[IF(152,'==',1,[set(193,1),say('TAKE HM FLY!\nUSE TRAVEL TO\nREVISIT TOWNS.')],[say('ERIKA WILL TEST\nYOUR POKEMON.')])]);
  actor('celadon','eevee keeper','Eevee Keeper','oak',18,20,[IF(204,'==',0,[set(204,1),say('PLEASE LOOK\nAFTER EEVEE.'),...gift(133,25)],[say('EEVEE RESPONDS\nTO THREE KINDS\nOF STONE.')])]);
  actor('viridian','mime keeper','Mr Mime Keeper','oak',12,20,[IF(155,'==',1,[IF(245,'==',0,[set(245,1),say('YOU STOPPED THE\nBRIDGE ROCKET?\nRAISE MY MR MIME.'),...gift(122,20)],[say('MR MIME IS\nA GREAT PARTNER.')])],[say('A ROCKET IS\nCAUSING TROUBLE\nON NUGGET BRIDGE.')])]);
  actor('celadon','evolution expert','Evolution Expert','oak',18,17,[
    say('I HELP YOUR LEAD\nPOKEMON EVOLVE.\nCHOOSE A METHOD.'),
    menu(304,['WATER STONE','THUNDER STONE','FIRE STONE','LEAF STONE','MOON STONE','LOCAL TRADE','CANCEL'],true,'menu'),
    EX('$304$ >= 1 && $304$ <= 6',[...evolve(),IF(306,'==',0,[say('YOUR LEAD CANNOT\nEVOLVE THIS WAY\nRIGHT NOW.')])])
  ]);
  for(const [scene,,checkpoint]of towns){
    const sceneScript=plan.scripts.find(s=>s.target.sceneId===ids.scenes[scene]&&!s.target.actorId&&!s.target.triggerId);
    if(sceneScript)sceneScript.events.unshift(set(250+towns.findIndex(t=>t[0]===scene),1));
    if(checkpoint>=7){
      actor(scene,scene+' nurse','Nurse Joy','joy',19,22,[...heal(),...loadHP(),set(134,checkpoint),say('YOUR POKEMON\nARE RESTORED.')]);
      actor(scene,scene+' pc','Bills PC','oak',18,16,storage());
    }
    actor(scene,scene+' mart','Poke Mart','blue',12,18,[say('POKE MART\nMONEY $133$'),menu(13,['BALL 50','POTION 80','LEAVE']),IF(13,'==',1,[EX('$133$ >= 50 && $8$ < 99',[math(133,'sub',50),math(8,'add',1),say('ONE POKE BALL.')],[say('NOT ENOUGH MONEY\nOR YOUR BAG\nIS FULL.')])]),IF(13,'==',2,[EX('$133$ >= 80 && $9$ < 99',[math(133,'sub',80),math(9,'add',1),say('ONE POTION.')],[say('NOT ENOUGH MONEY\nOR YOUR BAG\nIS FULL.')])])]);
  }
}
