import {redStats} from './battle-damage.mjs';
import {indexedDispatch} from './indexed-dispatch.mjs';
export const isHighCriticalMove=name=>['karatechop','razorleaf','crabhammer','slash'].includes(name.toLowerCase().replace(/[^a-z]/g,''));
export function criticalThreshold(dex,high=false){
 if(!redStats[dex])throw new RangeError('Unknown critical-hit species');
 return Math.min(255,Math.floor(redStats[dex].speed/2)*(high?8:1));
}
export function criticalAuthoring({species,IF,EX,set,math,rand,shared,flag=305}){
 const select=selector=>indexedDispatch('critical_speed_'+selector,selector,species.map((p,i)=>({value:i+1,events:[set(308,criticalThreshold(p.dex))]})),{IF,shared});
 return {flag,clear:()=>[set(flag,0)],roll:(selector,high)=>[
  ...(high===undefined?[]:[set(flag,high?2:0)]),...select(selector),
  IF(flag,'==',2,[math(308,'mul',8),IF(308,'>',255,[set(308,255)])]),
  rand(15,0,255),EX('$15$ < $308$',[set(flag,1)],[set(flag,0)])
 ]};
}
