import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {captureAuthoring, captureContract, redCatchRates, referenceCapture}
  from '../artwork/capture-rules.mjs';

const roster = JSON.parse(readFileSync(new URL('../artwork/roster.json', import.meta.url), 'utf8'));
const metadata = JSON.parse(readFileSync(new URL('../artwork/red-catch-rates.json', import.meta.url), 'utf8'));
const commit = 'd2704a63c26f9ba046ade877445216b3de0519a4';
const source = `https://github.com/pret/pokered/blob/${commit}/engine/items/item_effects.asm`;
// Facts independently checked against all pinned base_stats includes, plus Mew.
const expectedRates = [
  45,45,45,45,45,45,45,45,45,255,120,45,255,120,45,255,120,45,255,90,
  255,90,255,90,190,75,255,90,235,120,45,235,120,45,150,25,190,75,170,50,
  255,90,255,120,45,190,75,190,75,255,50,255,90,190,75,190,75,190,75,255,
  120,45,200,100,50,180,90,45,255,120,45,190,60,255,120,45,190,60,190,75,
  190,60,45,190,45,190,75,190,75,190,60,190,90,45,45,190,75,225,60,190,
  60,90,45,190,75,45,45,45,190,60,120,60,30,45,45,225,75,225,60,225,
  60,45,45,45,45,45,45,45,255,45,45,35,45,45,45,45,45,45,45,45,
  45,45,25,3,3,3,45,45,45,3,45
];
let suites = 0, comparisons = 0, worstSteps = 0, peakValue = 0;
function test(name, fn) {fn(); suites++; console.log('PASS ' + name);}

// Emits the same event shapes as game-design; no generated plan or ROM needed.
function fixture(species = roster) {
  const scripts = new Map(), expressions = new Map();
  const E = (command, args, children) => ({command, args, ...(children ? {children} : {})});
  const N = value => ({type: 'number', value});
  const V = variable => ({type: 'variable', value: String(variable)});
  const set = (variable, value) => E('EVENT_SET_VALUE', {variable: String(variable),
    value: typeof value === 'object' ? value : N(value)});
  const math = (variable, operation, value, other = 'val') => E('EVENT_VARIABLE_MATH', {
    vectorX: String(variable), operation, other, clamp: false,
    ...(other === 'var' ? {vectorY: String(value)} : {value})
  });
  const rand = (variable, minValue, maxValue) => E('EVENT_VARIABLE_MATH', {
    vectorX: String(variable), operation: 'set', other: 'rnd', minValue, maxValue
  });
  const IF = (variable, operator, value, yes, no = []) => E('EVENT_IF', {condition: {
    type: {'==': 'eq', '!=': 'ne', '<': 'lt', '>': 'gt', '<=': 'lte', '>=': 'gte'}[operator],
    valueA: V(variable), valueB: N(value)
  }}, {true: yes, false: no});
  const EX = (expression, yes, no = []) => E('EVENT_IF', {
    condition: {type: 'expression', value: expression}
  }, {true: yes, false: no});
  const shared = (name, events) => {
    if (!scripts.has(name)) scripts.set(name, events);
    return [E('EVENT_CALL_CUSTOM_EVENT', {customEventId: name})];
  };
  const api = captureAuthoring({species, IF, EX, V, set, math, rand, shared});
  const poke = api.attempt(), master = api.attempt(true);
  assert.deepEqual(api.attempt(), poke);
  assert.deepEqual(api.attempt(true), master);
  return {api, scripts, run(initial, rolls = [], isMaster = false) {
    const vars = {16: 1, 135: 255, 307: -123, 308: -123, 309: -123, 310: -123, ...initial};
    let consumed = 0, steps = 0;
    const get = id => vars[id] ?? 0;
    const write = (id, value) => {
      assert.ok(Number.isInteger(value) && value >= -32768 && value <= 32767,
        `signed16 overflow in slot ${id}: ${value}`);
      peakValue = Math.max(peakValue, Math.abs(value));
      vars[id] = value;
    };
    const value = v => v.type === 'variable' ? get(v.value) : v.value;
    function condition(c) {
      if (c.type === 'expression') {
        if (!expressions.has(c.value)) {
          const expression = c.value.replace(/\$(\d+)\$/g, (_, id) => `get(${id})`);
          assert.match(c.value.replace(/\$(\d+)\$/g, '0'), /^[\d\s<>=!&|()+\-*/%.]+$/);
          expressions.set(c.value, Function('get', 'return (' + expression + ')'));
        }
        return expressions.get(c.value)(get);
      }
      const a = value(c.valueA), b = value(c.valueB);
      switch (c.type) {
        case 'eq': return a === b;
        case 'ne': return a !== b;
        case 'lt': return a < b;
        case 'gt': return a > b;
        case 'lte': return a <= b;
        case 'gte': return a >= b;
        default: assert.fail('Unknown condition ' + c.type);
      }
    }
    function body(events) {
      for (const e of events) {
        assert.ok(++steps < 120, 'bounded capture event execution');
        const a = e.args;
        switch (e.command) {
          case 'EVENT_SET_VALUE': write(a.variable, value(a.value)); break;
          case 'EVENT_VARIABLE_MATH': {
            let operand = a.other === 'var' ? get(a.vectorY) : a.value;
            if (a.other === 'rnd') {
              assert.equal(a.minValue, 0); assert.equal(a.maxValue, 255);
              operand = rolls[consumed++];
              assert.ok(Number.isInteger(operand) && operand >= 0 && operand <= 255,
                'expected a supplied byte roll');
            }
            const current = get(a.vectorX);
            let result;
            switch (a.operation) {
              case 'set': result = operand; break;
              case 'add': result = current + operand; break;
              case 'sub': result = current - operand; break;
              case 'mul': result = current * operand; break;
              case 'div': assert.notEqual(operand, 0); result = Math.trunc(current / operand); break;
              default: assert.fail('Unknown math ' + a.operation);
            }
            write(a.vectorX, result);
            break;
          }
          case 'EVENT_IF': body(e.children[condition(a.condition) ? 'true' : 'false']); break;
          case 'EVENT_CALL_CUSTOM_EVENT': assert.ok(scripts.has(a.customEventId)); body(scripts.get(a.customEventId)); break;
          default: assert.fail('Unexpected capture side effect ' + e.command);
        }
      }
    }
    body(isMaster ? master : poke);
    worstSteps = Math.max(worstSteps, steps);
    for (const [id, before] of Object.entries(initial)) {
      if (!captureContract.clobbers.includes(Number(id))) assert.equal(get(id), before, 'preserved slot ' + id);
    }
    return {caught: get(16) === 1, rollsUsed: consumed, vars};
  }};
}

const f = fixture();
const byDex = new Map(roster.map((pokemon, i) => [pokemon.dex, i + 1]));
const statuses = [{}, {sleep: 1}, {poison: 1}, {paralysis: 1}];
function state(input) {
  return {4: byDex.get(input.dex) ?? 0, 5: input.currentHP, 6: input.maximumHP,
    19: input.trainer ? 7 : 0, 302: input.sleep ?? 0, 303: input.poison ?? 0, 69: input.paralysis ?? 0,
    8: 23, 202: 1, 18: 0, 13: 4, 15: 211, 25: 6, 10: 14, 30: 1, 40: 50, 50: 1,
    133: 1234, 136: 123, 300: 5, 301: 90, 304: 1, 305: 2, 306: 1};
}
function check(input, rolls, expected) {
  const reference = referenceCapture(input, rolls);
  if (expected) assert.deepEqual(reference, expected, JSON.stringify({input, rolls}));
  const actual = f.run(state(input), rolls, input.master);
  assert.equal(actual.caught, reference.caught, JSON.stringify({input, rolls}));
  assert.equal(actual.rollsUsed, reference.rollsUsed, 'same short-circuit RNG consumption');
  comparisons++;
  return actual;
}

test('Pinned Blue facts cover every dex, independent of the modern roster rates', () => {
  assert.equal(metadata.commit, commit); assert.equal(metadata.source, 'https://github.com/pret/pokered');
  assert.equal(expectedRates.length, 151); assert.equal(roster.length, 151);
  assert.equal(new Set(roster.map(p => p.dex)).size, 151);
  assert.deepEqual(Object.keys(redCatchRates), expectedRates.map((_, i) => String(i + 1)));
  expectedRates.forEach((rate, i) => assert.equal(redCatchRates[i + 1], rate, 'dex ' + (i + 1)));
  assert.ok(Object.isFrozen(redCatchRates));
  const reversed = fixture([...roster].reverse().map(p => ({...p, catchRate: 1})));
  [...roster].reverse().forEach((p, i) => {
    const end = reversed.run({4: i + 1, 5: 1, 6: 100, 19: 0}, [expectedRates[p.dex - 1]]);
    assert.equal(end.vars[135], expectedRates[p.dex - 1]); assert.equal(end.caught, true);
    if (expectedRates[p.dex - 1] < 255)
      assert.equal(reversed.run({4: i + 1, 5: 1, 6: 100, 19: 0}, [expectedRates[p.dex - 1] + 1]).caught, false);
  });
});

test('Source-backed exact comparisons, division floors and RNG short circuits', () => {
  // Source .checkForAilments, .skip1..3 and .captured; all comparisons inclusive
  // except immediate status subtraction underflow. No upstream code is copied.
  const defaults = {dex: 150, maximumHP: 100, currentHP: 100};
  const vectors = [
    [{}, [3, 85], true, 2], [{}, [3, 86], false, 2], [{}, [4], false, 1],
    [{currentHP: 1}, [3], true, 1], [{currentHP: 1}, [4], false, 1],
    [{sleep: 1}, [24], true, 1], [{sleep: 1}, [25, 86], false, 2],
    [{sleep: 1}, [28, 85], true, 2], [{sleep: 1}, [29], false, 1],
    [{poison: 1}, [11], true, 1], [{poison: 1}, [12, 86], false, 2],
    [{paralysis: 1}, [15, 85], true, 2], [{paralysis: 1}, [16], false, 1],
    [{maximumHP: 12, currentHP: 4}, [3, 255], true, 2],
    [{maximumHP: 13, currentHP: 4}, [3], true, 1],
    [{maximumHP: 7, currentHP: 7}, [3, 148], true, 2],
    [{maximumHP: 7, currentHP: 7}, [3, 149], false, 2],
    [{maximumHP: 47, currentHP: 17}, [3, 249], true, 2],
    [{maximumHP: 47, currentHP: 17}, [3, 250], false, 2],
    [{maximumHP: 999, currentHP: 999}, [3, 85], true, 2],
    [{maximumHP: 999, currentHP: 999}, [3, 86], false, 2],
    [{dex: 10}, [255, 85], true, 2], [{dex: 10}, [255, 86], false, 2],
    [{dex: 4, currentHP: 33}, [46], false, 1],
    [{dex: 4, currentHP: 33}, [45], true, 1],
    [{master: true}, [255], true, 1], [{trainer: true}, [], false, 0],
    [{master: true, trainer: true}, [], false, 0]
  ];
  for (const [extra, rolls, caught, rollsUsed] of vectors)
    check({...defaults, ...extra}, rolls, {caught, rollsUsed});
});

test('Every first and second byte for all 151 species and supported statuses', () => {
  for (const pokemon of roster) for (const status of statuses) {
    const input = {dex: pokemon.dex, maximumHP: 100, currentHP: 100, ...status};
    const bonus = status.sleep ? 25 : status.poison || status.paralysis ? 12 : 0;
    const passingFirst = Math.min(255, expectedRates[pokemon.dex - 1] + bonus);
    for (let byte = 0; byte <= 255; byte++) {
      check(input, [byte, 86]);
      check(input, [passingFirst, byte]);
    }
  }
});

test('All species at HP/status/RNG boundaries; modifiers do not stack', () => {
  const combined = [...statuses, {poison: 1, paralysis: 1}, {sleep: 7, poison: 1, paralysis: 1},
    {sleep: 0, poison: 0, paralysis: 0}, {sleep: -1, poison: -1, paralysis: -1}];
  for (const pokemon of roster) for (const status of combined) {
    const bonus = status.sleep > 0 ? 25 : status.poison > 0 || status.paralysis > 0 ? 12 : 0;
    const rate = expectedRates[pokemon.dex - 1];
    for (const hp of [1, 3, 4, 7, 8, 33, 34, 100, 999]) {
      const maximumHP = hp === 999 ? 999 : 100;
      const factor = Math.floor(Math.floor(maximumHP * 255 / 12) / Math.max(hp >> 2, 1));
      const bytes = values => [...new Set(values.filter(v => v >= 0 && v <= 255))];
      for (const first of bytes([0, bonus - 1, bonus, bonus + rate, bonus + rate + 1, 255]))
        for (const second of bytes([0, factor - 1, factor, factor + 1, 255]))
          check({dex: pokemon.dex, maximumHP, currentHP: hp, ...status}, [first, second]);
    }
  }
  for (const hp of [1, 100]) for (const first of [12, 23, 24, 25, 28, 29]) {
    for (const second of [0, 85, 86, 255]) {
      const base = {dex: 150, maximumHP: 100, currentHP: hp};
      assert.deepEqual(referenceCapture({...base, poison: 1, paralysis: 1}, [first, second]),
        referenceCapture({...base, poison: 1}, [first, second]));
      assert.deepEqual(referenceCapture({...base, sleep: 1, poison: 1, paralysis: 1}, [first, second]),
        referenceCapture({...base, sleep: 1}, [first, second]));
    }
  }
});

test('Every legal maximum HP; all legal HP pairs preserve integer floors and signed16 safety', () => {
  for (let maximumHP = 1; maximumHP <= 999; maximumHP++) {
    const originalNumerator = Math.floor(maximumHP * 255 / 12);
    const safeNumerator = 21 * maximumHP + Math.floor(maximumHP / 4);
    assert.equal(safeNumerator, originalNumerator); assert.ok(safeNumerator <= 21228);
    for (let currentHP = 1; currentHP <= maximumHP; currentHP++) {
      const divisor = Math.max(Math.floor(currentHP / 4), 1);
      assert.equal(Math.trunc(safeNumerator / divisor), Math.floor(originalNumerator / divisor));
    }
    const hps = [1, 2, 3, 4, 7, 8, maximumHP - 1, maximumHP,
      Math.floor(maximumHP / 3) - 1, Math.floor(maximumHP / 3), Math.floor(maximumHP / 3) + 1];
    for (const currentHP of new Set(hps.filter(hp => hp >= 1 && hp <= maximumHP))) {
      const factor = Math.floor(originalNumerator / Math.max(currentHP >> 2, 1));
      for (const second of new Set([0, Math.min(255, factor), Math.min(255, factor + 1), 255]))
        check({dex: 150, maximumHP, currentHP}, [3, second]);
    }
  }
});

test('Exact reference probabilities use all 65536 byte pairs, not percentage tiers', () => {
  // At 100/100 HP X=85; first-byte acceptance includes CatchRate itself.
  // At 1/100 HP W>255; status-underflow catches bypass both remaining gates.
  for (const dex of [4, 10, 150]) for (const status of statuses) for (const currentHP of [1, 100]) {
    const bonus = status.sleep ? 25 : status.poison || status.paralysis ? 12 : 0;
    const passing = Math.min(256 - bonus, expectedRates[dex - 1] + 1);
    const expected = bonus * 256 + passing * (currentHP === 1 ? 256 : 86);
    let caught = 0;
    for (let first = 0; first <= 255; first++) for (let second = 0; second <= 255; second++)
      caught += Number(referenceCapture({dex, maximumHP: 100, currentHP, ...status}, [first, second]).caught);
    assert.equal(caught, expected, JSON.stringify({dex, status, currentHP}));
  }
});

test('Master is guaranteed for all legitimate targets; trainers and invalid states consume no rolls', () => {
  for (const pokemon of roster) for (const status of statuses) {
    for (const currentHP of [1, 100]) for (const first of [0, 255])
      check({dex: pokemon.dex, maximumHP: 100, currentHP, ...status, master: true}, [first],
        {caught: true, rollsUsed: 1});
    for (const master of [false, true])
      check({dex: pokemon.dex, maximumHP: 100, currentHP: 100, ...status, master, trainer: true}, [],
        {caught: false, rollsUsed: 0});
  }
  for (const master of [false, true]) {
    for (const [maximumHP, currentHP] of [[0,0], [100,0], [100,-1], [-1,1], [100,101], [1000,1], [32767,1]])
      check({dex: 150, maximumHP, currentHP, master}, [], {caught: false, rollsUsed: 0});
    for (const id of [-32768, -1, 0, 152, 32767])
      assert.deepEqual(f.run({4: id, 5: 100, 6: 100, 19: 0}, [], master).caught, false);
    for (const trainer of [-32768, -1, 1, 7, 32767])
      assert.equal(f.run({4: byDex.get(150), 5: 100, 6: 100, 19: trainer}, [], master).rollsUsed, 0);
    for (const dex of [-1, 0, 152, 1.5])
      assert.deepEqual(referenceCapture({dex, maximumHP: 100, currentHP: 100, master}, []),
        {caught: false, rollsUsed: 0});
  }
});

test('Strict byte streams, pure reference inputs and authoring validation', () => {
  const input = Object.freeze({dex: 150, maximumHP: 100, currentHP: 100});
  const rolls = Object.freeze([3, 85]);
  assert.deepEqual(referenceCapture(input, rolls), {caught: true, rollsUsed: 2});
  assert.deepEqual(rolls, [3, 85]);
  for (const bad of [undefined, -1, 256, 1.5, NaN, '3']) {
    assert.throws(() => referenceCapture(input, [bad, 85]), /integer byte/);
    assert.throws(() => referenceCapture(input, [3, bad]), /integer byte/);
    assert.throws(() => f.run(state(input), [bad, 85]), /supplied byte/);
  }
  assert.deepEqual(referenceCapture({...input, currentHP: 1}, [3, 999]), {caught: true, rollsUsed: 1});
  assert.deepEqual(referenceCapture({...input, master: true}, [0, 999]), {caught: true, rollsUsed: 1});
  assert.throws(() => referenceCapture({...input, master: 1}, [0]), /boolean/);
  assert.throws(() => f.api.attempt(1), /boolean/);
  for (const species of [[], [{dex: 0}], [{dex: 152}], [{dex: 1.5}], [{dex: 1}, {dex: 1}],
    Array.from({length: 152}, (_, i) => ({dex: i + 1}))]) assert.throws(() => fixture(species), /species/);
  const subset = fixture([{dex: 150}]);
  assert.equal(subset.run({4: 1, 5: 1, 6: 100, 19: 0}, [3]).caught, true);
});

test('Only declared scratch/output slots are written; shared event trees stay small', () => {
  const writes = new Set(), reads = new Set();
  const walk = events => {
    for (const e of events) {
      const a = e.args;
      if (e.command === 'EVENT_SET_VALUE') {
        writes.add(Number(a.variable)); if (a.value.type === 'variable') reads.add(Number(a.value.value));
      } else if (e.command === 'EVENT_VARIABLE_MATH') {
        writes.add(Number(a.vectorX)); reads.add(Number(a.vectorX));
        if (a.other === 'var') reads.add(Number(a.vectorY));
        if (a.other === 'rnd') assert.deepEqual([a.minValue, a.maxValue], [0, 255]);
      } else if (e.command === 'EVENT_IF') {
        const c = a.condition;
        if (c.type === 'expression') for (const match of c.value.matchAll(/\$(\d+)\$/g)) reads.add(Number(match[1]));
        else for (const v of [c.valueA, c.valueB]) if (v.type === 'variable') reads.add(Number(v.value));
      } else assert.equal(e.command, 'EVENT_CALL_CUSTOM_EVENT');
      for (const child of Object.values(e.children ?? {})) walk(child);
    }
  };
  const count = events => events.reduce((n, e) => n + 1 + Object.values(e.children ?? {}).reduce((sum, c) => sum + count(c), 0), 0);
  for (const events of f.scripts.values()) {
    walk(events); assert.ok(count(events) < 64, 'bank-sized script body');
  }
  assert.deepEqual([...writes].sort((a,b) => a-b), [...captureContract.clobbers]);
  const allowed = new Set([...captureContract.clobbers, 4, 5, 6, 19, 69, 302, 303]);
  for (const slot of reads) assert.ok(allowed.has(slot), 'declared input/scratch slot ' + slot);
  assert.equal(f.api.resultVariable, 16);
});

console.log(`Verified ${suites} suites; ${comparisons} event/reference cases; worst ${worstSteps} events; peak arithmetic ${peakValue}.`);
console.log('Evidence: ' + source);
console.log('Event semantics only; no generators, native resources, builds or emulators used.');
