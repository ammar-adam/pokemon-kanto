/**
 * PP and spent-turn bookkeeping belong to the selection caller, before accuracy.
 * Scratch 13 holds foe HP across attack; attack must leave it intact. Scratch 135
 * holds fixed damage across effectiveness, which may overwrite 308/309/310.
 * Status handlers can override the simplified built-ins. Unhandled power-zero
 * moves, Counter, OHKO and Dream Eater fail. Multi-hit, charge/trapping, recharge,
 * flinch, burn/freeze/confusion and other unhandled damaging effects use one hit
 * without those extra effects. Rest is heal-only; Psywave uses a bounded approximate
 * distribution. Status immunities/durations and full stage rules remain simplified.
 */
export function playerMoveEffects({IF,EX,V,set,math,rand,say,invoke,storeHP,effectiveness,typeCode,pop,statusEffects={}}){
  const fail=()=>[say('BUT IT FAILED!')];
  const sync=()=>[...storeHP(),invoke('hud')];
  const heal=()=>[math(3,'add',16,'var'),EX('$3$ > $2$',[set(3,V(2))]),...sync()];
  function resolve({move,stats}){
    const key=move.toLowerCase().replace(/[^a-z]/g,''),effect=stats.effect;
    const attack=[set(300,typeCode(stats.type)),set(301,stats.power),invoke('attack')];
    let events;
    if(statusEffects[effect])events=statusEffects[effect]({move,stats});
    else if(effect==='SPLASH_EFFECT')events=[say('NOTHING HAPPENED.')];
    else if(effect==='SWITCH_AND_TELEPORT_EFFECT')events=[IF(19,'==',0,[say('THE BATTLE ENDED.'),...pop()],fail())];
    else if(effect==='HEAL_EFFECT')events=[EX('$3$ < $2$',[set(16,V(2)),...(key==='rest'?[]:[math(16,'div',2)]),...heal(),say('HP WAS RESTORED!')],fail())];
    else if(effect==='LEECH_SEED_EFFECT')events=[set(28,1),say('THE FOE WAS\nSEEDED!')];
    else if(effect==='PARALYZE_EFFECT')events=[set(69,1),say('THE FOE WAS\nPARALYZED!')];
    else if(effect==='SLEEP_EFFECT')events=[set(302,2),say('THE FOE FELL\nASLEEP!')];
    else if(effect==='POISON_EFFECT')events=[set(303,1),say('THE FOE WAS\nPOISONED!')];
    else if(effect==='ATTACK_DOWN1_EFFECT')events=[set(29,1),say('FOE ATTACK FELL!')];
    else if(effect==='ACCURACY_DOWN1_EFFECT')events=[set(68,1),say('FOE ACCURACY FELL!')];
    else if(['DEFENSE_UP1_EFFECT','DEFENSE_UP2_EFFECT','REFLECT_EFFECT','LIGHT_SCREEN_EFFECT'].includes(effect))events=[set(17,1),say('DEFENSE ROSE!')];
    else if(effect==='SPECIAL_DAMAGE_EFFECT'||effect==='SUPER_FANG_EFFECT'){
      const amount=effect==='SUPER_FANG_EFFECT'?[set(16,V(5)),math(16,'div',2),IF(16,'<',1,[set(16,1)])]:
        key==='dragonrage'?[set(16,40)]:key==='sonicboom'?[set(16,20)]:key==='psywave'?
          [set(307,V(0)),math(307,'mul',3),math(307,'div',2),rand(15,1,150),math(15,'mul',307,'var'),math(15,'div',150),set(16,V(15)),IF(16,'<',1,[set(16,1)])]:[set(16,V(0))];
      events=[set(300,typeCode(stats.type)),...amount,set(135,V(16)),...effectiveness(1,4),IF(16,'>',0,[set(16,V(135))]),math(5,'sub',16,'var'),IF(5,'<',0,[set(5,0)]),invoke('hud')];
    }else if(['OHKO_EFFECT','DREAM_EATER_EFFECT'].includes(effect)||key==='counter'||stats.power===0)events=fail();
    else{
      const actualDamage=effect==='DRAIN_HP_EFFECT'||effect==='RECOIL_EFFECT';
      events=[...(actualDamage?[set(13,V(5))]:[]),...attack];
      if(actualDamage)events.push(math(13,'sub',5,'var'),set(16,V(13)));
      if(effect==='DRAIN_HP_EFFECT')events.push(IF(16,'>',0,[math(16,'div',2),IF(16,'<',1,[set(16,1)]),...heal()]));
      if(effect==='RECOIL_EFFECT')events.push(IF(16,'>',0,[math(16,'div',4),IF(16,'<',1,[set(16,1)]),math(3,'sub',16,'var'),IF(3,'<',0,[set(3,0)]),...sync()]));
      if(effect==='EXPLODE_EFFECT')events.push(set(3,0),...sync());
      const secondary={POISON_SIDE_EFFECT1:[20,303],POISON_SIDE_EFFECT2:[40,303],PARALYZE_SIDE_EFFECT1:[10,69],PARALYZE_SIDE_EFFECT2:[30,69],ATTACK_DOWN_SIDE_EFFECT:[10,29]};
      if(secondary[effect]){const[chance,variable]=secondary[effect];events.push(EX('$5$ > 0 && $16$ > 0',[rand(15,1,100),IF(15,'<=',chance,[set(variable,1)])]));}
    }
    return [set(16,0),...(stats.accuracy>=100||effect==='SWIFT_EFFECT'?events:[rand(15,1,100),IF(15,'<=',stats.accuracy,events,[say('THE ATTACK MISSED!')])])];
  }
  return resolve;
}
