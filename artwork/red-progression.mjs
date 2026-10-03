export function authorRedProgression({plan,ids,uuid,actor,trainer,IF,EX,say,menu,set,startBattle}){
  const change=(key,events,type='actor')=>{const s=plan.scripts.find(s=>s.target[type+'Id']===uuid(type+':'+key)&&s.target.scriptKey==='script');if(!s)throw new Error('Missing progression script '+key);s.events=events;};
  const challenge=(mode,flag)=>[IF(flag,'==',1,[say('BLUE: KEEP\nTRAINING. WE WILL\nMEET AGAIN.')],[say('BLUE: LET US\nSEE HOW FAR\nYOU HAVE COME.'),menu(13,['BATTLE','LATER']),IF(13,'==',1,[set(19,mode),set(20,1),...startBattle()])])];
  change('league rival',[EX('$12$ + $150$ + $151$ + $152$ + $180$ + $181$ + $182$ + $183$ == 8',challenge(42,211),[IF(248,'==',1,challenge(57,262),[say('BLUE: FIRST\nFINISH THAT JOB\nFOR PROFESSOR OAK.')])])]);
  actor('cerulean','cerulean blue','Blue','blue',17,5,challenge(58,263));
  const bridge=plan.scripts.find(s=>s.target.triggerId===uuid('trigger:north bridge'));
  if(!bridge)throw new Error('Missing Cerulean bridge gate');
  bridge.events=[IF(263,'==',1,bridge.events,[say('BLUE IS WAITING\nNEAR THE NORTHERN\nEXIT. BATTLE HIM\nBEFORE THE BRIDGE.')])];
  for(const key of ['forest scout','forest catcher','forest kid']){
    const a=plan.actors.find(a=>a.id===uuid('actor:'+key));a.name='Bug Catcher';a.spriteSheetId=ids.sprites['trainer-catcher'];
  }
  const guide=plan.actors.find(a=>a.id===uuid('actor:forest expert'));guide.name='Forest Guide';guide.spriteSheetId=ids.sprites.oak;
  change('forest expert',[say('BUG CATCHERS\nTRAIN IN THESE\nWOODS.'),say('PIKACHU IS RARE.\nCHECK THE GRASS\nAND KEEP LOOKING.')]);
  const youngster=plan.actors.find(a=>a.id===uuid('actor:route three hiker'));youngster.name='Youngster';youngster.spriteSheetId=ids.sprites.blue;
  trainer('route_three','route three catcher one','Bug Catcher','oak',6,7,59,264);
  trainer('route_three','route three catcher two','Bug Catcher','oak',23,10,60,265);
  trainer('route_three','route three catcher three','Bug Catcher','oak',7,20,61,266);
  trainer('route_three','route three youngster two','Youngster','blue',24,26,62,267);
  trainer('route_three','route three lass two','Lass','joy',22,6,63,268);
  trainer('route_three','route three lass three','Lass','joy',11,26,64,269);
  trainer('arena','pewter camper','Camper','blue',6,10,65,270);
}
