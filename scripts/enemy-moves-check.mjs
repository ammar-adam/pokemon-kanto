import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {enemyMoveAuthoring, enemyMoveTiers, enemyBattleStateAuthoring} from '../artwork/enemy-moves.mjs';
import {damageAuthoring, moveStats, redStats} from '../artwork/battle-damage.mjs';
import {movesAtLevel, moveTiers as learnedMoveTiers} from '../artwork/move-learning.mjs';

const roster = JSON.parse(readFileSync(new URL('../artwork/roster.json', import.meta.url), 'utf8'));
const types = ['NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'FIGHTING', 'POISON',
  'GROUND', 'FLYING', 'PSYCHIC', 'BUG', 'ROCK', 'GHOST', 'DRAGON'];
const typeCode = type => types.indexOf(type) + 1;
const results = [];
function test(name, fn) {fn(); results.push(name); console.log('PASS ' + name);}

function fixture({species = roster, getMoves = () => ['TACKLE'], moveTiers, statusEffects = {}, packed = false} = {}) {
  const scripts = new Map();
  let nextId = 0;
  const E = (command, args = {}, children) => ({id: nextId++, command, args, ...(children ? {children} : {})});
  const V = value => ({type: 'variable', value: String(value)});
  const set = (variable, value) => E('EVENT_SET_VALUE', {variable: String(variable),
    value: typeof value === 'object' ? value : {type: 'number', value}});
  const math = (variable, operation, value, other = 'val') => E('EVENT_VARIABLE_MATH',
    {vectorX: String(variable), operation, other, ...(other === 'var' ? {vectorY: String(value)} : {value})});
  const rand = (variable, minValue, maxValue) => E('EVENT_VARIABLE_MATH',
    {vectorX: String(variable), operation: 'set', other: 'rnd', minValue, maxValue});
  const IF = (variable, operator, value, yes, no = []) => E('EVENT_IF',
    {variable, operator, value}, {true: yes, false: no});
  const EX = (expression, yes, no = []) => E('EVENT_IF_EXPRESSION', {expression}, {true: yes, false: no});
  const say = text => E('EVENT_TEXT', {text});
  const shared = (name, events) => {
    if (!scripts.has(name)) scripts.set(name, events);
    return [E('EVENT_CALL_CUSTOM_EVENT', {name})];
  };
  const chunked = (name, events, size = 8) => {
    if (scripts.has(name)) return shared(name, []);
    const calls = [];
    for (let i = 0; i < events.length; i += size) calls.push(...shared(name + '_' + i, events.slice(i, i + size)));
    return shared(name, calls);
  };
  const damage = damageAuthoring({species, IF, EX, V, set, math, chunked, shared, typeCode});
  const effectiveness = () => [
    ...chunked('test_chart', species.map((pokemon, i) => IF(1, '==', i + 1, [
      ...(pokemon.types.includes('GHOST') ? [IF(300, '==', 1, [set(16, 0)]),
        IF(300, '==', 7, [set(16, 0)])] : []),
      ...(pokemon.types.some(type => ['NORMAL', 'PSYCHIC'].includes(type))
        ? [IF(300, '==', 14, [set(16, 0)])] : []),
      ...(pokemon.types.includes('GROUND') ? [IF(300, '==', 5, [set(16, 0)])] : []),
      ...(pokemon.types.includes('FIRE') ? [IF(300, '==', 2, [math(16, 'div', 2)]),
        IF(300, '==', 3, [math(16, 'mul', 2)])] : [])
    ])))
  ];
  const battleState = enemyBattleStateAuthoring({EX, set, math, say});
  const api = enemyMoveAuthoring({species, getMoves, moveTiers, IF, EX, V, set, math, rand,
    say, shared, chunked, typeCode, damage, effectiveness,
    storeHP: () => [E('STORE_HP')], invoke: name => E('INVOKE', {name}),
    sfx: () => E('SFX'), fx: () => E('FX'),
    statusEffects: {...(packed ? battleState.statusEffects : {}),
      ...Object.fromEntries(Object.entries(statusEffects).map(([key, fn]) => [key, move => fn(move, {set, say, math})]))},
    damageModifiers: packed ? battleState.enemyDamage : () => []});
  const counter = api.counter();
  return {api, counter, scripts, battleState, run(initial = {}, rolls = [], events = counter) {
    const vars = {0: 5, 1: 1, 2: 100, 3: 100, 4: 1, 5: 100, 6: 100, 7: 5, ...initial};
    const queue = [...rolls], text = [], trace = [], announcements = [];
    let steps = 0, storedHP;
    const get = id => vars[id] || 0;
    const write = (id, value) => {
      assert.ok(Number.isInteger(value) && value >= -32768 && value <= 32767,
        `signed16 overflow at ${id}: ${value}`);
      vars[id] = value;
    };
    const compare = (a, op, b) => ({'==': a === b, '!=': a !== b, '>': a > b, '<': a < b,
      '>=': a >= b, '<=': a <= b})[op];
    function body(events) {
      for (const e of events) {
        assert.ok(++steps < 100000, 'bounded source event execution');
        trace.push(e.command);
        const a = e.args;
        switch (e.command) {
          case 'EVENT_SET_VALUE': write(a.variable, a.value.type === 'variable' ? get(a.value.value) : a.value.value); break;
          case 'EVENT_VARIABLE_MATH': {
            let n = a.other === 'var' ? get(a.vectorY) : a.value;
            if (a.other === 'rnd') {
              n = queue.length ? queue.shift() : a.maxValue;
              assert.ok(n >= a.minValue && n <= a.maxValue, 'RNG bounds');
            }
            const x = get(a.vectorX);
            write(a.vectorX, ({set: () => n, add: () => x + n, sub: () => x - n,
              mul: () => x * n, div: () => Math.trunc(x / n), mod: () => x % n})[a.operation]());
            break;
          }
          case 'EVENT_IF': body(e.children[compare(get(a.variable), a.operator, a.value) ? 'true' : 'false']); break;
          case 'EVENT_IF_EXPRESSION': {
            const expression = a.expression.replace(/\$(\d+)\$/g, (_, id) => String(get(id)));
            assert.match(expression, /^[\d\s<>=!&|()+\-*/%.]+$/);
            body(e.children[Function('return (' + expression + ')')() ? 'true' : 'false']);
            break;
          }
          case 'EVENT_CALL_CUSTOM_EVENT': assert.ok(scripts.has(a.name)); body(scripts.get(a.name)); break;
          case 'EVENT_TEXT': text.push(a.text); announcements.push({text: a.text, type: get(300), power: get(301)}); break;
          case 'STORE_HP': storedHP = get(3); break;
          default: assert.ok(['INVOKE', 'SFX', 'FX'].includes(e.command));
        }
      }
    }
    body(events);
    assert.equal(queue.length, 0, 'all supplied rolls consumed');
    return {vars, text, trace, storedHP, announcements, get};
  }};
}

test('Callback tiers include exact learning levels, stable latest-four order, and object move names', () => {
  const p = roster[0];
  const tiers = enemyMoveTiers(p, (_, level) => level < 9
    ? ['SCRATCH', 'GROWL'] : [{key: 'ember', name: 'EMBER'}, 'GROWL']);
  assert.deepEqual(tiers, [{minLevel: 1, maxLevel: 8, moves: ['SCRATCH', 'GROWL']},
    {minLevel: 9, maxLevel: 100, moves: ['EMBER', 'GROWL']}]);
  const f = fixture({species: [p], getMoves: (_, level) => level < 9 ? ['SCRATCH'] : ['EMBER']});
  assert.equal(f.run({7: 8}).announcements.find(a => a.text.includes('USED')).power, 40);
  const learned = f.run({7: 9});
  assert.equal(learned.announcements.find(a => a.text.includes('USED')).power, 40); assert.equal(learned.get(300), 2);
  assert.ok(learned.text.includes('THE FOE USED\nEMBER!'));
});

test('Supplied tiers reject gaps, overlap, unsorted ranges, and excess moves', () => {
  for (const ranges of [[{minLevel: 2, maxLevel: 100, moves: []}],
    [{minLevel: 1, maxLevel: 30, moves: []}, {minLevel: 30, maxLevel: 100, moves: []}],
    [{minLevel: 1, maxLevel: 99, moves: []}]]) {
    assert.throws(() => fixture({species: [roster[0]], moveTiers: [ranges]}), /tiers/);
  }
  assert.throws(() => enemyMoveTiers(roster[0], () => ['A', 'B', 'C', 'D', 'E']), /four/);
});

test('Each real move slot is reachable and named; Red metadata overrides modern roster metadata', () => {
  const f = fixture({species: [roster[0]], getMoves: () => ['SCRATCH', 'EMBER', 'GROWL', 'SMOKESCREEN']});
  for (let slot = 1; slot <= 4; slot++) {
    const end = f.run({}, slot <= 2 ? [slot, 255] : [slot]);
    assert.equal(end.get(14), slot);
    assert.ok(end.text.includes('THE FOE USED\n' + ['SCRATCH', 'EMBER', 'GROWL', 'SMOKESCREEN'][slot - 1] + '!'));
    assert.equal(end.get(3) < 100, slot <= 2);
    if (slot >= 3) assert.ok(end.text.includes('BUT IT FAILED!'));
  }
  const tackle = fixture().run({}, [95, 255]);
  assert.equal(tackle.announcements.find(a => a.text.includes('USED')).power, 35); assert.equal(tackle.get(300), 1);
});

test('Move accuracy boundary, accuracy drop, and full paralysis suppress damage and feedback', () => {
  const f = fixture();
  assert.ok(f.run({}, [95, 255]).get(3) < 100);
  const miss = f.run({}, [96]);
  assert.equal(miss.get(3), 100); assert.equal(miss.get(16), 0); assert.ok(!miss.trace.includes('FX'));
  assert.equal(f.run({68: 1}, [30]).get(3), 100);
  assert.ok(f.run({68: 1}, [31, 95, 255]).get(3) < 100);
  const para = f.run({69: 1}, [25]);
  assert.equal(para.get(3), 100); assert.ok(!para.text.some(t => t.includes('USED')));
  assert.ok(f.run({69: 1}, [26, 95, 255]).get(3) < 100);
});

test('Sleep skips all RNG and selection; Swift bypasses move accuracy and accuracy reduction', () => {
  const sleeping = fixture().run({302: 2, 16: 500});
  assert.equal(sleeping.get(302), 1); assert.equal(sleeping.get(16), 0); assert.equal(sleeping.get(3), 100);
  assert.ok(fixture({getMoves: () => ['SWIFT']}).run({68: 1}, [255]).get(3) < 100);
});

test('Injected status effects execute only on hits and do not become attacks', () => {
  const f = fixture({getMoves: () => ['SLEEP POWDER'], statusEffects: {
    SLEEP_EFFECT: (move, {say}) => [say('PLAYER FELL ASLEEP: ' + move.name)]
  }});
  const hit = f.run({}, [75]);
  assert.ok(hit.text.includes('PLAYER FELL ASLEEP: SLEEP POWDER')); assert.equal(hit.get(3), 100);
  assert.ok(!f.run({}, [76]).text.some(t => t.startsWith('PLAYER FELL')));
  const secondary = fixture({getMoves: () => ['POISON STING'], statusEffects: {
    POISON_SIDE_EFFECT1: (_, {say}) => [say('PLAYER WAS POISONED')]
  }});
  assert.ok(secondary.run({}, [255]).text.includes('PLAYER WAS POISONED'));
  assert.ok(!secondary.run({3: 1}, [255]).text.includes('PLAYER WAS POISONED'));
});

test('Guard reduces a landed hit and persists HP; a miss leaves guard available', () => {
  const f = fixture();
  const normal = f.run({}, [95, 255]), guarded = f.run({17: 1}, [95, 255]);
  assert.equal(guarded.get(16), Math.trunc(normal.get(16) / 2));
  assert.equal(guarded.get(17), 0); assert.equal(guarded.storedHP, guarded.get(3));
  assert.equal(f.run({17: 1}, [96]).get(17), 1);
});

test('One-point hits survive attack drop and guard independently or together, while immunity stays zero', () => {
  const species = [roster.find(p => p.dex === 4), roster.find(p => p.dex === 92)];
  const f = fixture({species});
  const initial = {7: 1, 0: 100};
  assert.equal(f.run(initial, [95, 217]).get(16), 1, 'unmodified hit is one point');
  for (const effects of [{29: 1}, {17: 1}, {29: 1, 17: 1}]) {
    const hit = f.run({...initial, ...effects}, [95, 217]);
    assert.equal(hit.get(16), 1);
    assert.equal(hit.get(3), 99);
    assert.equal(hit.storedHP, 99);
    assert.equal(hit.get(17), 0);
    const immune = f.run({...initial, ...effects, 1: 2}, [95, 217]);
    assert.equal(immune.get(16), 0);
    assert.equal(immune.get(3), 100);
    assert.equal(immune.storedHP, 100);
    assert.equal(immune.get(17), effects[17] || 0, 'immunity does not spend guard');
  }
  const special = fixture({getMoves: () => ['THUNDERSHOCK']}).run({...initial, 17: 1}, [217]);
  assert.equal(special.get(16), 1); assert.equal(special.get(3), 99); assert.equal(special.get(17), 0);
  const miss = f.run({...initial, 17: 1, 29: 1}, [96]);
  assert.equal(miss.get(16), 0); assert.equal(miss.get(3), 100); assert.equal(miss.get(17), 1);
});

test('Drain uses actual lost HP, recovery clamps, Rest sleeps, and Splash does nothing', () => {
  const drained = fixture({getMoves: () => ['ABSORB']}).run({3: 1, 5: 99}, [255]);
  assert.equal(drained.get(3), 0); assert.equal(drained.get(5), 100);
  assert.equal(fixture({getMoves: () => ['RECOVER']}).run({5: 95}).get(5), 100);
  const rested = fixture({getMoves: () => ['REST']}).run({5: 10, 303: 1, 69: 1}, [100]);
  assert.equal(rested.get(5), 100); assert.equal(rested.get(302), 2);
  assert.equal(rested.get(303), 0); assert.equal(rested.get(69), 0);
  const splashed = fixture({getMoves: () => ['SPLASH']}).run();
  assert.equal(splashed.get(3), 100); assert.equal(splashed.get(301), 0);
});

test('Empty movepool uses named Red 50-power Struggle with recoil; unknown moves fail authoring', () => {
  const end = fixture({getMoves: () => []}).run({}, [255]);
  assert.ok(end.text.includes('THE FOE USED\nSTRUGGLE!'));
  assert.equal(end.announcements.find(a => a.text.includes('USED')).power, 50); assert.equal(end.get(300), 1);
  assert.ok(end.get(5) < 100);
  assert.throws(() => fixture({getMoves: () => ['UNKNOWN MOVE']}), /Missing original move/);
});

test('Fixed damage retains immunity but ignores resistance and weakness', () => {
  const species = [roster.find(p => p.dex === 4), roster.find(p => p.dex === 92)];
  const f = fixture({species, getMoves: () => ['SEISMIC TOSS']});
  assert.equal(f.run({7: 20}).get(3), 80);
  assert.equal(f.run({7: 20, 1: 2}).get(3), 100);
  const normal = fixture({species, getMoves: () => ['SUPER FANG']});
  assert.equal(normal.run({3: 99}, [90]).get(3), 50);
  assert.equal(normal.run({3: 99, 1: 2}, [90]).get(3), 99);
  const sonic = fixture({species, getMoves: () => ['SONICBOOM']});
  assert.equal(sonic.run({7: 60}, [90]).get(3), 80);
  assert.equal(sonic.run({7: 60, 1: 2}, [90]).get(3), 100);
  assert.equal(fixture({getMoves: () => ['DRAGON RAGE']}).run().get(3), 60);
  assert.equal(fixture({getMoves: () => ['COUNTER']}).run().get(3), 100);
});

test('Growl, Tail Whip/Leer, and Harden apply capped stages and preserve unrelated bits', () => {
  for (const [move, bit] of [['GROWL', 1], ['TAIL WHIP', 2], ['LEER', 2], ['HARDEN', 4]]) {
    const f = fixture({getMoves: () => [move], packed: true});
    const initial = bit === 4 ? 1 : 4;
    const end = f.run({136: initial});
    assert.equal(end.get(136), initial + bit); assert.equal(end.get(3), 100);
    const repeat = f.run(end.vars);
    assert.equal(repeat.get(136), initial + bit);
    assert.ok(repeat.text.includes('IT CANNOT CHANGE\nANY FURTHER.'));
  }
  const tail = fixture({getMoves: () => ['TAIL WHIP'], packed: true});
  assert.equal(tail.run({136: 16}).get(136), 0, 'opposite player Defense stages cancel');
  const harden = fixture({getMoves: () => ['HARDEN'], packed: true});
  assert.equal(harden.run({136: 8}).get(136), 0, 'opposite enemy Defense stages cancel');
});

test('Packed stages change physical damage, preserve special/zero damage, and clear on switches', () => {
  const f = fixture({packed: true});
  const apply = (events, vars) => f.run(vars, [], events);
  const player = f.battleState.playerDamage();
  assert.equal(apply(player, {16: 90, 300: 1, 136: 1}).get(16), 60);
  assert.equal(apply(player, {16: 90, 300: 1, 136: 4}).get(16), 60);
  assert.equal(apply(player, {16: 90, 300: 1, 136: 8}).get(16), 135);
  assert.equal(apply(player, {16: 90, 300: 1, 136: 5}).get(16), 40);
  assert.equal(apply(player, {16: 90, 300: 2, 136: 5}).get(16), 90);
  assert.equal(apply(player, {16: 0, 300: 1, 136: 5}).get(16), 0);
  assert.equal(apply(player, {16: 1, 300: 1, 136: 5}).get(16), 1);
  const enemy = f.battleState.enemyDamage();
  assert.equal(apply(enemy, {16: 90, 300: 1, 136: 2}).get(16), 135);
  assert.equal(apply(enemy, {16: 90, 300: 1, 136: 16}).get(16), 60);
  assert.equal(apply(enemy, {16: 90, 300: 2, 136: 2}).get(16), 90);
  assert.equal(apply(f.battleState.clearPlayer(), {136: 21}).get(136), 4);
  assert.equal(apply(f.battleState.clearEnemy(), {136: 13}).get(136), 1);
  assert.equal(apply(f.battleState.reset(), {136: 31}).get(136), 0);
  const original = f.run({}, [95, 255]), weakenedDefense = f.run({136: 2}, [95, 255]);
  assert.ok(weakenedDefense.get(16) > original.get(16), 'enemy damage uses injected modifier');
  for (const value of [3996, 7992]) apply(player, {16: value, 300: 1, 136: 8});
  const applyStatus = (effect, state) => apply(f.battleState.playerStatusEffects[effect](), {136: state});
  assert.equal(applyStatus('ATTACK_DOWN1_EFFECT', 0).get(29), 1);
  assert.equal(applyStatus('DEFENSE_DOWN1_EFFECT', 0).get(136), 8);
  assert.equal(applyStatus('DEFENSE_UP1_EFFECT', 0).get(136), 16);
  assert.equal(applyStatus('DEFENSE_DOWN1_EFFECT', 4).get(136), 0);
  assert.equal(applyStatus('DEFENSE_UP1_EFFECT', 2).get(136), 0);
});

test('Recoil and Explosion can faint the enemy without negative HP', () => {
  const recoil = fixture({getMoves: () => ['STRUGGLE']}).run({5: 1}, [255]);
  assert.equal(recoil.get(5), 0); assert.ok(recoil.get(3) < 100);
  const explosion = fixture({getMoves: () => ['EXPLOSION']}).run({5: 10}, [255]);
  assert.equal(explosion.get(5), 0); assert.ok(explosion.get(3) < 100);
});

test('Real Red learnsets integrate through callback or supplied tiers for all species and learning boundaries', () => {
  const callback = fixture({getMoves: (p, level) => movesAtLevel(p.dex, level)});
  const supplied = fixture({moveTiers: p => learnedMoveTiers(p.dex)});
  assert.deepEqual(callback.api.tiers, supplied.api.tiers);
  const select = callback.api.select();
  for (const [i, p] of roster.entries()) for (const tier of callback.api.tiers[i]) {
    for (const level of new Set([tier.minLevel, tier.maxLevel])) for (let slot = 0; slot < tier.moves.length; slot++) {
      const end = callback.run({4: i + 1, 7: level}, tier.moves.length > 1 ? [slot + 1] : [], select);
      const actual = callback.api.moves.find(move => move.id === end.get(14));
      assert.equal(actual.name, movesAtLevel(p.dex, level)[slot]);
    }
  }
  assert.ok(callback.api.moves.length <= 166);
  console.log(`INFO ${callback.api.moves.length} shared moves, ${callback.api.tiers.reduce((n, t) => n + t.length, 0)} level tiers`);
});

test('All 151 enemy attackers stay signed16 and match independent Red stat damage at levels 1, 50, 100', () => {
  const f = fixture({getMoves: () => ['HYPER BEAM']});
  for (const [i, pokemon] of roster.entries()) for (const level of [1, 50, 100]) {
    const end = f.run({4: i + 1, 7: level, 0: level, 3: 10000}, [90, 255]);
    const a = Math.trunc((redStats[pokemon.dex].attack + 9) * level / 50) + 5;
    const d = Math.trunc((redStats[roster[0].dex].defense + 9) * level / 50) + 5;
    let amount = Math.min(999, Math.trunc((Math.trunc(2 * level / 5) + 2) * moveStats('HYPER BEAM').power * a / (d * 50)) + 2);
    if (pokemon.types.includes('NORMAL')) amount = Math.trunc(amount * 3 / 2);
    assert.equal(end.get(3), 10000 - amount, pokemon.name + ' level ' + level);
    assert.equal(end.storedHP, end.get(3));
  }
});

test('Selection shares identical pools, resolution shares move bodies, and allocates no variable IDs', () => {
  const f = fixture({getMoves: () => ['TACKLE', 'GROWL']});
  assert.equal([...f.scripts.keys()].filter(k => k.startsWith('enemy_pool_')).length, 1);
  assert.equal([...f.scripts.keys()].filter(k => /^enemy_move_[a-z]+$/.test(k) && !['enemy_move_select', 'enemy_move_resolve'].includes(k)).length, 3);
  const allowed = new Set([3, 5, 14, 15, 16, 17, 69, 135, 300, 301, 302, 303, 307, 308, 309, 310]);
  const inspect = events => {for (const event of events) {
    if (event.command === 'EVENT_SET_VALUE') assert.ok(allowed.has(Number(event.args.variable)));
    if (event.command === 'EVENT_VARIABLE_MATH') assert.ok(allowed.has(Number(event.args.vectorX)));
    for (const child of Object.values(event.children || {})) inspect(child);
  }};
  inspect(f.counter); for (const script of f.scripts.values()) inspect(script);
});

test('Authored native event IDs are unique within every script and branch', () => {
  const f = fixture({getMoves: (p, level) => movesAtLevel(p.dex, level), packed: true});
  const inspect = (events, ids) => {for (const event of events) {
    assert.ok(!ids.has(event.id), 'event ID reused in a native script: ' + event.id);
    ids.add(event.id);
    for (const child of Object.values(event.children || {})) inspect(child, ids);
  }};
  inspect(f.counter, new Set());
  for (const script of f.scripts.values()) inspect(script, new Set());
});

console.log(`${results.length} enemy move source checks passed; native integration and ROM play are separate.`);
