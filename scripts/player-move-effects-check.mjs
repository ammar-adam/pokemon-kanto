import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playerMoveEffects } from '../artwork/player-move-effects.mjs';
import { damageAuthoring, moveStats } from '../artwork/battle-damage.mjs';
import { moveLearningAuthoring } from '../artwork/move-learning.mjs';
import { enemyBattleStateAuthoring } from '../artwork/enemy-moves.mjs';

const roster = JSON.parse(readFileSync(new URL('../artwork/roster.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(readFileSync(new URL('../artwork/red-moves.json', import.meta.url), 'utf8')).moves;
const types = ['NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG', 'ROCK', 'GHOST', 'DRAGON'];
const typeCode = type => types.indexOf(type) + 1;
const chart = {
  NORMAL: [[], ['ROCK'], ['GHOST']], FIRE: [['GRASS', 'ICE', 'BUG'], ['FIRE', 'WATER', 'ROCK', 'DRAGON'], []],
  WATER: [['FIRE', 'GROUND', 'ROCK'], ['WATER', 'GRASS', 'DRAGON'], []], GRASS: [['WATER', 'GROUND', 'ROCK'], ['FIRE', 'GRASS', 'POISON', 'FLYING', 'BUG', 'DRAGON'], []],
  ELECTRIC: [['WATER', 'FLYING'], ['ELECTRIC', 'GRASS', 'DRAGON'], ['GROUND']], ICE: [['GRASS', 'GROUND', 'FLYING', 'DRAGON'], ['WATER', 'ICE'], []],
  FIGHTING: [['NORMAL', 'ICE', 'ROCK'], ['POISON', 'FLYING', 'PSYCHIC', 'BUG'], ['GHOST']], POISON: [['GRASS', 'BUG'], ['POISON', 'GROUND', 'ROCK', 'GHOST'], []],
  GROUND: [['FIRE', 'ELECTRIC', 'POISON', 'ROCK'], ['GRASS', 'BUG'], ['FLYING']], FLYING: [['GRASS', 'FIGHTING', 'BUG'], ['ELECTRIC', 'ROCK'], []],
  PSYCHIC: [['FIGHTING', 'POISON'], ['PSYCHIC'], []], BUG: [['GRASS', 'POISON', 'PSYCHIC'], ['FIRE', 'FIGHTING', 'FLYING', 'GHOST'], []],
  ROCK: [['FIRE', 'ICE', 'FLYING', 'BUG'], ['FIGHTING', 'GROUND'], []], GHOST: [['GHOST'], [], ['NORMAL', 'PSYCHIC']], DRAGON: [['DRAGON'], [], []],
};
const tests = [];
function test(name, body) {
  try { body(); tests.push({ name, pass: true }); console.log('PASS ' + name); }
  catch (error) { tests.push({ name, pass: false }); console.error('FAIL ' + name + ': ' + error.message); }
}

function fixture({ targetTypes = ['NORMAL'], calculatedDamage = 100, realAttack = false, packed = false, hooks = {}, pokemonDex = 4 } = {}) {
  let serial = 0;
  const scripts = new Map();
  const E = (command, args = {}, children) => ({ id: String(serial++), command, args, ...(children ? { children } : {}) });
  const N = value => ({ type: 'number', value });
  const V = variable => ({ type: 'variable', value: String(variable) });
  const set = (variable, value) => E('EVENT_SET_VALUE', { variable: String(variable), value: typeof value === 'object' ? value : N(value) });
  const math = (variable, operation, value, other = 'val') => E('EVENT_VARIABLE_MATH', {
    vectorX: String(variable), operation, other, ...(other === 'var' ? { vectorY: String(value) } : { value }), clamp: false,
  });
  const rand = (variable, minValue, maxValue) => E('EVENT_VARIABLE_MATH', { vectorX: String(variable), operation: 'set', other: 'rnd', minValue, maxValue });
  const IF = (variable, operator, number, yes, no = []) => E('EVENT_IF', { condition: {
    type: { '==': 'eq', '!=': 'ne', '<': 'lt', '>': 'gt', '<=': 'lte', '>=': 'gte' }[operator], valueA: V(variable), valueB: N(number),
  } }, { true: yes, false: no });
  const EX = (expression, yes, no = []) => E('EVENT_IF', { condition: { type: 'expression', value: expression } }, { true: yes, false: no });
  const say = text => E('EVENT_TEXT', { text });
  const invoke = name => E('INVOKE', { name });
  const storeHP = () => [E('STORE_HP')];
  const pop = () => [E('POP_BATTLE')];
  const shared = (name, events) => {
    if (!scripts.has(name)) scripts.set(name, events);
    return [E('EVENT_CALL_CUSTOM_EVENT', { customEventId: name })];
  };
  const chunked = (name, events) => shared(name, events);
  const effectiveness = (attacker, defender) => [
    E('CHART_CALL', { attacker, defender }),
    set(308, typeCode('FIRE')), set(309, typeCode(targetTypes[0])), set(310, typeCode(targetTypes[1])),
    IF(300, '>', 0, [set(308, V(300))]),
    ...Object.entries(chart).map(([type, groups]) => IF(308, '==', typeCode(type), groups.flatMap((group, action) =>
      group.flatMap(target => [309, 310].map(variable => IF(variable, '==', typeCode(target), action === 2
        ? [set(16, 0)] : action === 0 ? [math(16, 'mul', 2)]
          : [IF(16, '>', 0, [math(16, 'div', 2), IF(16, '==', 0, [set(16, 1)])])])))))),
  ];
  const stages = enemyBattleStateAuthoring({ EX, set, math, say });
  const statusEffects = {
    ...(packed ? stages.playerStatusEffects : {}),
    ...Object.fromEntries(Object.entries(hooks).map(([effect, build]) => [effect, request => build(request, { set, math, say })])),
  };
  const resolve = playerMoveEffects({ IF, EX, V, set, math, rand, say, invoke, storeHP, effectiveness, typeCode, pop, statusEffects });
  const species = [roster.find(p => p.dex === pokemonDex)];
  const damage = damageAuthoring({ species, IF, EX, V, set, math, chunked, shared, typeCode });
  const attack = realAttack ? [
    ...damage.base(1, 4, 0, 7), ...effectiveness(1, 4), rand(15, 217, 255), ...damage.variance(),
    math(5, 'sub', 16, 'var'), IF(5, '<', 0, [set(5, 0)]), invoke('hud'),
  ] : [
    set(16, calculatedDamage), math(5, 'sub', 16, 'var'), IF(5, '<', 0, [set(5, 0)]),
    // The real attack overwrites these arithmetic/chart registers.
    ...[135, 307, 308, 309, 310].map(variable => set(variable, -123)), invoke('hud'),
  ];
  const menu = (variable, options) => E('MENU', { variable, options });
  const learning = moveLearningAuthoring({
    species, IF, EX, V, set, math, menu, say, shared, lv: () => 60, pp: (_, slot) => 100 + slot,
    moveStats, onMove: resolve, onStruggle: () => [set(18, 1)],
  });
  function run(move, { initial = {}, rolls = [], events, stats = moveStats(move) } = {}) {
    const state = { 0: 50, 1: 1, 2: 100, 3: 50, 4: 1, 5: 100, 6: 100, 7: 50, 13: 87, 14: 3, 18: 1, ...initial };
    const queue = [...rolls];
    const observed = { text: [], invocations: [], charts: [], stored: [], popped: 0, writes: [] };
    const get = variable => state[variable] || 0;
    const write = (variable, value) => {
      assert.ok(Number.isInteger(value) && value >= -32768 && value <= 32767, `signed16 overflow at ${variable}: ${value}`);
      state[variable] = value;
      observed.writes.push(Number(variable));
    };
    const value = operand => operand.type === 'variable' ? get(operand.value) : operand.value;
    function condition(c) {
      if (c.type === 'expression') {
        const expression = c.value.replace(/\$(\d+)\$/g, (_, variable) => String(get(variable)));
        assert.match(expression, /^[\d\s<>=!&|()+\-*/%.]+$/);
        return Function('return (' + expression + ')')();
      }
      const a = value(c.valueA), b = value(c.valueB);
      return { eq: a === b, ne: a !== b, lt: a < b, gt: a > b, lte: a <= b, gte: a >= b }[c.type];
    }
    let steps = 0;
    function body(list) {
      for (const e of list) {
        assert.ok(++steps < 50000);
        const a = e.args;
        if (e.command === 'EVENT_SET_VALUE') write(a.variable, value(a.value));
        else if (e.command === 'EVENT_VARIABLE_MATH') {
          let n = a.other === 'var' ? get(a.vectorY) : a.value;
          if (a.other === 'rnd') {
            n = queue.length ? queue.shift() : a.maxValue;
            assert.ok(n >= a.minValue && n <= a.maxValue, 'roll falls within requested bounds');
          }
          const x = get(a.vectorX);
          write(a.vectorX, { set: () => n, add: () => x + n, sub: () => x - n, mul: () => x * n, div: () => Math.trunc(x / n), mod: () => x % n }[a.operation]());
        } else if (e.command === 'EVENT_IF') body(e.children[condition(a.condition) ? 'true' : 'false']);
        else if (e.command === 'EVENT_CALL_CUSTOM_EVENT') { assert.ok(scripts.has(a.customEventId)); body(scripts.get(a.customEventId)); }
        else if (e.command === 'EVENT_TEXT') observed.text.push(a.text);
        else if (e.command === 'INVOKE') { observed.invocations.push(a.name); if (a.name === 'attack') body(attack); }
        else if (e.command === 'CHART_CALL') observed.charts.push([a.attacker, a.defender]);
        else if (e.command === 'STORE_HP') observed.stored.push(get(3));
        else if (e.command === 'POP_BATTLE') observed.popped++;
        else if (e.command === 'MENU') write(a.variable, queue.shift() || 0);
        else throw new Error('Unknown event ' + e.command);
      }
    }
    body(events || resolve({ move, stats }));
    assert.equal(queue.length, 0, 'all supplied random/input values used');
    return { ...observed, state, get };
  }
  return { run, resolve, learning, scripts };
}

test('Fixed damage ignores weakness/resistance while respecting primary and secondary immunity', () => {
  const cases = [
    ['SONICBOOM', 20, ['ROCK'], true], ['SONICBOOM', 20, ['POISON', 'GHOST'], false],
    ['SEISMIC TOSS', 50, ['NORMAL', 'ROCK'], true], ['SEISMIC TOSS', 50, ['GHOST', 'POISON'], false],
    ['NIGHT SHADE', 50, ['GHOST'], true], ['NIGHT SHADE', 50, ['NORMAL'], false], ['NIGHT SHADE', 50, ['WATER', 'PSYCHIC'], false],
    ['DRAGON RAGE', 40, ['DRAGON'], true], ['SUPER FANG', 50, ['ROCK'], true], ['SUPER FANG', 50, ['GHOST'], false],
  ];
  for (const [move, amount, targetTypes, hits] of cases) {
    const end = fixture({ targetTypes }).run(move, { rolls: moveStats(move).accuracy < 100 ? [moveStats(move).accuracy] : [] });
    assert.equal(end.get(5), hits ? 100 - amount : 100, move + ' versus ' + targetTypes);
    assert.equal(end.get(16), hits ? amount : 0);
    assert.deepEqual(end.charts, [[1, 4]]);
    assert.equal(end.get(308), typeCode(moveStats(move).type));
    assert.equal(end.get(309), typeCode(targetTypes[0]));
    assert.equal(end.get(310), typeCode(targetTypes[1]));
    assert.ok(!end.invocations.includes('attack'), 'fixed damage must not use the formula');
  }
});

test('Drain and recoil use actual target HP lost, including overkill and zero damage', () => {
  for (const calculatedDamage of [0, 1, 3, 8, 200, 9999]) for (const remaining of [1, 3, 9, 100]) {
    const actual = Math.min(calculatedDamage, remaining);
    const drained = fixture({ calculatedDamage }).run('ABSORB', { initial: { 5: remaining, 3: 10 } });
    assert.equal(drained.get(3), 10 + (actual ? Math.max(1, Math.floor(actual / 2)) : 0), `drain ${calculatedDamage} against ${remaining} HP`);
    assert.equal(drained.get(5), remaining - actual);
    const recoiled = fixture({ calculatedDamage }).run('DOUBLE-EDGE', { initial: { 5: remaining, 3: 100 } });
    assert.equal(recoiled.get(3), 100 - (actual ? Math.max(1, Math.floor(actual / 4)) : 0), `recoil ${calculatedDamage} against ${remaining} HP`);
    assert.equal(recoiled.get(5), remaining - actual);
  }
});

test('Misses and unsupported status actions clear stale damage and never invoke attack', () => {
  const miss = fixture().run('TAKE DOWN', { initial: { 16: 999 }, rolls: [86] });
  assert.equal(miss.get(16), 0);
  assert.equal(miss.get(3), 50);
  assert.equal(miss.get(5), 100);
  assert.ok(!miss.invocations.includes('attack'));
  for (const move of ['GROWL', 'HARDEN', 'SPLASH', 'SWORDS DANCE', 'TRANSFORM', 'COUNTER', 'DREAM EATER', 'FISSURE']) {
    const end = fixture().run(move, { initial: { 16: 999 } });
    assert.equal(end.get(16), 0, move);
    assert.equal(end.get(3), 50);
    assert.equal(end.get(5), 100);
    assert.ok(!end.invocations.includes('attack'), move);
  }
});

test('Accuracy accepts the last hitting roll and PP is spent exactly once outside effects', () => {
  const f = fixture({ calculatedDamage: 10, pokemonDex: 1 });
  assert.equal(f.run('TACKLE', { rolls: [95] }).get(5), 90);
  const miss = f.run('TACKLE', { rolls: [96], initial: { 100: 7, 14: 2, 18: 1 } });
  assert.equal(miss.get(100), 7);
  assert.equal(miss.get(14), 2);
  assert.equal(miss.get(18), 1);
  for (const roll of [95, 96]) {
    const end = f.run('TACKLE', { initial: { 60: 1, 100: 7, 14: 1, 18: 0 }, rolls: [roll], events: f.learning.selection(0) });
    assert.equal(end.get(100), 6);
    assert.equal(end.get(18), 1);
    assert.equal(end.get(5), roll === 95 ? 90 : 100);
  }
});

test('Fixed damage clamps foe HP, Super Fang handles odd HP, and Psywave stays within signed16', () => {
  for (const [move, hp, remaining] of [['DRAGON RAGE', 3, 0], ['SONICBOOM', 1, 0],
    ['SUPER FANG', 99, 50], ['SUPER FANG', 1, 0], ['NIGHT SHADE', 3, 0]]) {
    const end = fixture({ targetTypes: ['WATER'] }).run(move, { initial: { 5: hp }, rolls: moveStats(move).accuracy < 100 ? [moveStats(move).accuracy] : [] });
    assert.equal(end.get(5), remaining, move);
  }
  const f = fixture();
  for (let level = 1; level <= 100; level++) for (const roll of [1, 75, 150]) {
    const cap = Math.floor(level * 3 / 2);
    const amount = Math.max(1, Math.floor(roll * cap / 150));
    const end = f.run('PSYWAVE', { initial: { 0: level, 5: 999 }, rolls: [80, roll] });
    assert.equal(end.get(5), 999 - amount);
    assert.equal(end.get(16), amount);
    assert.ok(amount >= 1 && amount <= cap);
  }
});

test('Real damage helper can clobber arithmetic scratch without corrupting drain/recoil', () => {
  for (const [move, fraction] of [['ABSORB', 2], ['DOUBLE-EDGE', 4]]) for (const hp of [1, 3, 100]) {
    const end = fixture({ realAttack: true }).run(move, { initial: { 0: 100, 7: 100, 3: 50, 5: hp }, rolls: [255] });
    const actual = hp - end.get(5);
    const change = actual ? Math.max(1, Math.floor(actual / fraction)) : 0;
    assert.equal(end.get(3), move === 'ABSORB' ? Math.min(100, 50 + change) : Math.max(0, 50 - change));
    assert.equal(end.get(13), actual, 'existing choice scratch survives real arithmetic helpers');
    if (actual) assert.equal(end.stored.at(-1), end.get(3));
  }
});

test('Drain caps recovery, recoil caps fainting, and HP is stored before HUD refresh', () => {
  const drain = fixture({ calculatedDamage: 200 }).run('MEGA DRAIN', { initial: { 3: 99, 2: 100, 5: 100 } });
  assert.equal(drain.get(3), 100);
  assert.deepEqual(drain.stored, [100]);
  const recoil = fixture({ calculatedDamage: 200 }).run('DOUBLE-EDGE', { initial: { 3: 1, 5: 100 } });
  assert.equal(recoil.get(3), 0);
  assert.deepEqual(recoil.stored, [0]);
  const explosion = fixture().run('EXPLOSION');
  assert.equal(explosion.get(3), 0);
  assert.equal(explosion.stored.at(-1), 0);
  const immune = fixture({ realAttack: true, targetTypes: ['POISON', 'GHOST'] }).run('DOUBLE-EDGE', { rolls: [255] });
  assert.equal(immune.get(5), 100);
  assert.equal(immune.get(3), 50);
  assert.equal(immune.get(16), 0);
});

test('Swift skips accuracy RNG, and a drain miss skips both attack and healing', () => {
  const swift = fixture({ calculatedDamage: 3 }).run('SWIFT', { stats: { ...moveStats('SWIFT'), accuracy: 0 } });
  assert.equal(swift.get(5), 97);
  const drain = fixture().run('ABSORB', { initial: { 16: 999 }, rolls: [96], stats: { ...moveStats('ABSORB'), accuracy: 95 } });
  assert.equal(drain.get(3), 50);
  assert.equal(drain.get(5), 100);
  assert.equal(drain.get(16), 0);
  assert.equal(drain.get(13), 87, 'accuracy failure skips the actual-loss snapshot');
  assert.ok(!drain.invocations.includes('attack'));
});

test('Secondary effects respect their chance and require damage and a living target', () => {
  for (const [move, chance, variable] of [['POISON STING', 20, 303], ['SLUDGE', 40, 303],
    ['THUNDERBOLT', 10, 69], ['BODY SLAM', 30, 69], ['AURORA BEAM', 10, 29]]) {
    const f = fixture({ calculatedDamage: 3 });
    assert.equal(f.run(move, { rolls: [chance] }).get(variable), 1);
    assert.equal(f.run(move, { rolls: [chance + 1] }).get(variable), 0);
    const faint = f.run(move, { initial: { 5: 1 } });
    assert.equal(faint.get(5), 0);
    assert.equal(faint.get(variable), 0);
    assert.equal(fixture({ calculatedDamage: 0 }).run(move).get(variable), 0);
  }
});

test('Status callbacks run only after accuracy and packed stage handlers preserve other flags', () => {
  const f = fixture({ hooks: {
    SLEEP_EFFECT: ({ move }, { set, say }) => [set(302, 3), say('HOOK ' + move)],
  } });
  const hit = f.run('SLEEP POWDER', { rolls: [75] });
  assert.equal(hit.get(302), 3);
  assert.ok(hit.text.includes('HOOK SLEEP POWDER'));
  assert.equal(f.run('SLEEP POWDER', { rolls: [76] }).get(302), 0);
  const packed = fixture({ packed: true });
  const lowered = packed.run('TAIL WHIP', { initial: { 136: 1 } });
  assert.equal(lowered.get(136), 9);
  assert.equal(lowered.get(5), 100);
  assert.equal(lowered.get(3), 50);
  const capped = packed.run('TAIL WHIP', { initial: lowered.state });
  assert.equal(capped.get(136), 9);
  assert.ok(capped.text.includes('IT CANNOT CHANGE\nANY FURTHER.'));
});

test('Recover clamps HP, full-HP healing fails, and documented Rest is heal-only', () => {
  const f = fixture();
  assert.equal(f.run('RECOVER', { initial: { 2: 101, 3: 1 } }).get(3), 51);
  assert.equal(f.run('SOFTBOILED', { initial: { 2: 101, 3: 99 } }).get(3), 101);
  const full = f.run('RECOVER', { initial: { 2: 100, 3: 100, 16: 999 } });
  assert.equal(full.get(16), 0);
  assert.equal(full.stored.length, 0);
  assert.ok(full.text.includes('BUT IT FAILED!'));
  const rest = f.run('REST', { initial: { 3: 1, 302: 1, 303: 1, 69: 1 } });
  assert.equal(rest.get(3), 100);
  assert.deepEqual([rest.get(302), rest.get(303), rest.get(69)], [1, 1, 1]);
});

test('Wild escape succeeds, trainer escape fails, and unsupported complex moves are explicit', () => {
  assert.equal(fixture().run('TELEPORT', { initial: { 19: 0 } }).popped, 1);
  const trainer = fixture().run('TELEPORT', { initial: { 19: 1 } });
  assert.equal(trainer.popped, 0);
  assert.ok(trainer.text.includes('BUT IT FAILED!'));
  for (const move of ['COUNTER', 'DREAM EATER', 'FISSURE', 'METRONOME', 'TRANSFORM', 'BIDE', 'SUBSTITUTE', 'MIRROR MOVE']) {
    const end = fixture().run(move, { rolls: moveStats(move).accuracy < 100 ? [moveStats(move).accuracy] : [] });
    assert.ok(end.text.includes('BUT IT FAILED!'), move);
    assert.ok(!end.invocations.includes('attack'), move);
  }
  for (const move of ['DOUBLESLAP', 'SOLARBEAM', 'FIRE SPIN', 'HYPER BEAM']) {
    const end = fixture({ calculatedDamage: 3 }).run(move, { rolls: moveStats(move).accuracy < 100 ? [moveStats(move).accuracy] : [] });
    assert.equal(end.invocations.filter(name => name === 'attack').length, 1, move + ' is a documented single-hit approximation');
  }
});

test('All 165 moves author without PP/turn writes, and power-zero moves never become formula attacks', () => {
  const f = fixture();
  const allowed = new Set([0, 2, 3, 5, 13, 15, 16, 17, 19, 28, 29, 68, 69, 135, 300, 301, 302, 303, 307, 308, 309, 310]);
  for (const [move, stats] of Object.entries(catalog)) {
    const invokes = [];
    function audit(events) {
      for (const e of events) {
        if (e.command === 'INVOKE') invokes.push(e.args.name);
        for (const field of ['variable', 'vectorX', 'vectorY']) if (field in e.args) {
          assert.ok(allowed.has(Number(e.args[field])), 'existing-variable contract: ' + e.args[field]);
          assert.ok(![14, 18].includes(Number(e.args[field])), 'PP/turn selection must stay outside accuracy');
        }
        for (const branch of Object.values(e.children || {})) audit(branch);
      }
    }
    audit(f.resolve({ move, stats }));
    if (stats.power === 0 || ['OHKO_EFFECT', 'DREAM_EATER_EFFECT'].includes(stats.effect) || move === 'counter') {
      assert.ok(!invokes.includes('attack'), move + ' must not become a formula attack');
    }
  }
  assert.equal(Object.keys(catalog).length, 165);
  const depleted = f.run('SCRATCH', { initial: { 60: 1, 100: 0, 14: 1, 18: 0 }, events: f.learning.selection(0) });
  assert.equal(depleted.get(100), 0);
  assert.equal(depleted.get(18), 0);
  assert.ok(!depleted.invocations.includes('attack'));
});

const failed = tests.filter(row => !row.pass);
console.log(`${tests.length - failed.length}/${tests.length} player effect source groups passed.`);
if (failed.leng