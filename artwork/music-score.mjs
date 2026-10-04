import { createHash } from 'node:crypto';

export const musicId = key => {
  const h=createHash('sha256').update('kanto-original-score:'+key).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
};

// Original compositions, not transcriptions of the commercial game's soundtrack.
// Each group is two bars of eighth notes; harmony uses the indicated triads.
export const scores = {
  home: {name:'A Door Opens',ticks:7,lead:[
    'E5 G5 A5 - G5 E5 D5 - C5 E5 G5 - D5 E5 C5 -',
    'D5 F5 A5 - G5 F5 E5 D5 G5 - B5 A5 G5 D5 E5 -',
    'E5 G5 C6 B5 A5 - G5 E5 F5 A5 C6 - B5 A5 G5 -',
    'F5 E5 D5 - G5 B5 D6 B5 C6 - G5 E5 C5 - - -'
  ], chords:[[0,4,7],[2,5,9],[5,9,12],[7,11,14]]},
  road: {name:'Northbound',ticks:5,lead:[
    'G5 E5 G5 A5 B5 - A5 G5 E5 D5 E5 G5 A5 - G5 -',
    'A5 F5 A5 C6 B5 A5 G5 E5 D5 E5 G5 B5 A5 G5 E5 -',
    'C6 B5 A5 G5 A5 - E5 G5 F5 E5 D5 F5 A5 G5 F5 -',
    'E5 G5 B5 D6 C6 B5 A5 G5 A5 B5 D6 B5 C6 - G5 -'
  ],chords:[[0,4,7],[5,9,12],[9,12,16],[7,11,14]]},
  battle: {name:'Stand Your Ground',ticks:4,lead:[
    'E5 E5 B5 A5 G5 E5 F#5 G5 B5 A5 G5 F#5 E5 - B4 D5',
    'E5 G5 A5 B5 D6 B5 A5 G5 F#5 A5 C6 B5 A5 F#5 D5 -',
    'G5 B5 E6 D6 B5 G5 A5 B5 C6 A5 F#5 D5 F#5 A5 C6 -',
    'B5 G5 E5 B4 D5 F#5 A5 C6 B5 A5 F#5 D#5 E5 - - -'
  ],chords:[[4,7,11],[2,6,9],[0,4,7],[11,15,18]]},
  refuge: {name:'Rest Awhile',ticks:8,lead:[
    'G5 - E5 - C5 E5 G5 - A5 - F5 - D5 F5 A5 -',
    'B5 - A5 G5 E5 - D5 - F5 - E5 D5 C5 - - -',
    'C6 - B5 A5 G5 - E5 - A5 - G5 F5 E5 - D5 -',
    'F5 A5 G5 - E5 G5 D5 - C5 - E5 - C5 - - -'
  ],chords:[[0,4,7],[2,5,9],[5,9,12],[7,11,14]]},
  shadow: {name:'Under the Canopy',ticks:6,lead:[
    'E5 - B4 E5 G5 - F#5 - E5 B4 D5 - C5 - B4 -',
    'F#5 - A5 F#5 E5 - D5 - C5 E5 G5 - F#5 - E5 -',
    'B5 - G5 E5 F#5 - A5 - G5 E5 D5 - C5 E5 B4 -',
    'C5 - E5 G5 F#5 - D5 - B4 D#5 F#5 - E5 - - -'
  ],chords:[[4,7,11],[0,4,7],[2,6,9],[11,15,18]]}
};

export function sceneScore(key) {
  if(key==='battlefield')return 'battle';
  if(/center|house|laboratory|mart/.test(key))return key.includes('center')?'refuge':'home';
  if(/forest|tunnel|moon|hideout|tower|cave|mansion|silph/.test(key))return 'shadow';
  if(/route|bridge|road|safari|seafoam/.test(key))return 'road';
  return 'home';
}
