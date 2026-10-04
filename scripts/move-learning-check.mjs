import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { moveStats } from '../artwork/battle-damage.mjs';
import {
  redLearnsets, learnsetCommit, movesAtLevel, moveTiers, ppAtLevel, moveLearningAuthoring,
} from '../artwork/move-learning.mjs';
import { RED_COMMIT, parseInitialMoves, parseLevelUpSource, parseMoveNames } from './fetch-red-learnsets.mjs';

const roster = JSON.parse(readFileSync(new URL('../artwork/roster.json', import.meta.url), 'utf8'));
const snapshot = JSON.parse(readFileSync(new URL('../artwork/red-learnsets.json', import.meta.url), 'utf8'));
assert.equal(learnsetCommit, RED_COMMIT);
assert.equal(snapshot.version, 'red');
assert.equal(snapshot.schemaVersion, 1);
assert.deepEqual(Object.keys(redLearnsets).map(Number), Array.from({ length: 151 }, (_, i) => i + 1));
for (const source of [...Object.values(snapshot.sources), ...Object.values(redLearnsets)]) {
  assert.match(source.url || source.source, new RegExp('/' + RED_COMMIT + '/'));
  assert.match(source.sha256, /^[a-f0-9]{64}$/);
}

// Fixed expectations distinguish the pinned Red schedules from later generations.
assert.deepEqual(movesAtLevel(4, 5), ['SCRATCH', 'GROWL']);
assert.deepEqual(movesAtLevel(4, 8), ['SCRATCH', 'GROWL']);
assert.deepEqual(movesAtLevel(4, 9), ['SCRATCH', 'GROWL', 'EMBER']);
assert.deepEqual(movesAtLevel(4, 22), ['GROWL', 'EMBER', 'LEER', 'RAGE']);
assert.deepEqual(movesAtLevel(4, 30), ['EMBER', 'LEER', 'RAGE', 'SLASH']);
assert.deepEqual(movesAtLevel(1, 20), ['GROWL', 'LEECH SEED', 'VINE WHIP', 'POISONPOWDER']);
assert.deepEqual(movesAtLevel(25, 9), ['THUNDERSHOCK', 'GROWL', 'THUNDER WAVE']);
assert.deepEqual(movesAtLevel(129, 14), ['SPLASH']);
assert.deepEqual(movesAtLevel(129, 15), ['SPLASH', 'TACKLE']);
assert.deepEqual(movesAtLevel(151, 40), ['TRANSFORM', 'MEGA PUNCH', 'METRONOME', 'PSYCHIC']);
assert.deepEqual(movesAtLevel(11, 7), ['HARDEN']);
assert.deepEqual(movesAtLevel(12, 10), ['CONFUSION']);
assert.deepEqual(movesAtLevel(59, 100), ['ROAR', 'EMBER', 'LEER', 'TAKE DOWN']);
assert.deepEqual(ppAtLevel(4, 5), [35, 40, 0, 0]);
assert.deepEqual(ppAtLevel(4, 9), [35, 40, 25, 0]);
assert.deepEqual(ppAtLevel(129, 5), [40, 0, 0, 0]);
for (const args of [[0, 5], [152, 5], [4, 0], [4, 101], [4, 5.5]]) assert.throws(() => movesAtLevel(...args), RangeError);

const nameFixture = new Map([['SCRATCH', 'SCRATCH'], ['GROWL', 'GROWL'], ['EMBER', 'EMBER']]);
assert.deepEqual(parseInitialMoves('db DEX_CHARMANDER ; pokedex id\ndb SCRATCH, GROWL, NO_MOVE, NO_MOVE ; level 1 learnset', nameFixture), {
  dexSymbol: 'DEX_CHARMANDER', initialMoves: ['SCRATCH', 'GROWL'],
});
assert.deepEqual(parseLevelUpSource('CharmanderEvosMoves:\n; Evolutions\ndb EVOLVE_LEVEL, 16, CHARMELEON\ndb 0\n; Learnset\ndb 9, EMBER\ndb 0\n', nameFixture).get('charmander'), [{ level: 9, move: 'EMBER' }]);
assert.throws(() => parseInitialMoves('db DEX_CHARMANDER ; id\ndb SCRATCH, NO_MOVE, GROWL, NO_MOVE ; level 1 learnset', nameFixture));
assert.throws(() => parseLevelUpSource('CharmanderEvosMoves:\ndb 0\ndb 9, MADE_UP\ndb 0\n', nameFixture));
assert.throws(() => parseLevelUpSource('CharmanderEvosMoves:\ndb 0\ndb 9, EMBER\ndb 8, GROWL\ndb 0\n', nameFixture));
assert.throws(() => parseLevelUpSource('CharmanderEvosMoves:\ndb 0\ndb 9, EMBER\n', nameFixture));
assert.throws(() => parseMoveNames('const NO_MOVE', 'li "SCRATCH"'));

let serial = 0;
const E = (command, args = {}, children) => ({ id: String(serial++), command, args, ...(children ? { children } : {}) });
const N = value => ({ type: 'number', value });
const V = variable => ({ type: 'variable', value: String(variable) });
const set = (variable, value) => E('EVENT_SET_VALUE', { variable: String(variable), value: typeof value === 'object' ? value : N(value) });
const math = (variable, operation, value) => E('EVENT_VARIABLE_MATH', { vectorX: String(variable), operation, other: 'val', value, clamp: false });
const IF = (variable, operator, number, yes, no = []) => E('EVENT_IF', {
  condition: { type: { '==': 'eq', '<=': 'lte', '>=': 'gte' }[operator], valueA: V(variable), valueB: N(number) },
}, { true: yes, false: no });
const EX = (expression, yes, no = []) => E('EVENT_IF', { condition: { type: 'expression', value: expression } }, { true: yes, false: no });
const say = text => E('EVENT_TEXT', { text });
const menu = (variable, options, cancel, layout) => E('EVENT_MENU', { variable: String(variable), options, cancel, layout });
const scripts = new Map();
const shared = (name, events) => {
  if (!scripts.has(name)) scripts.set(name, events);
  return [E('EVENT_CALL_CUSTOM_EVENT', { customEventId: name })];
};
const lv = i => i < 8 ? 60 + i : 403 + (i - 8) * 10;
const pp = (i, j) => i < 8 ? 100 + i * 4 + j : 405 + (i - 8) * 10 + j;
const executions = new Map();
const api = moveLearningAuthoring({
  species: roster, IF, EX, V, set, math, menu, say, shared, lv, pp, moveStats,
  onMove: ({ move, stats }) => {
    executions.set(move, (executions.get(move) || 0) + 1);
    return [E('TEST_MOVE_EXECUTION', { move, stats })];
  },
  onStruggle: () => [set(18, 1), E('TEST_STRUGGLE')],
});
const restores = roster.map((_, i) => api.restorePP(i));
const levels = roster.map((_, i) => api.learnLevel(i));
const menus = roster.map((_, i) => api.menu(i));
const selections = roster.map((_, i) => api.selection(i));
const fights = roster.map((_, i) => api.fight([i]));
const quiet = api.learnLevel(0, { announce: false });

const signed16 = value => (value << 16) >> 16;
function run(events, state, choice = 0) {
  const observed = { text: [], menus: [], moves: [], struggles: 0 };
  const value = operand => operand.type === 'variable' ? state[operand.value] || 0 : operand.value;
  function evaluate(condition) {
    if (condition.type === 'expression') {
      const match = condition.value.match(/^(\$\d+\$(?: \+ \$\d+\$)*) <= 0$/);
      assert.ok(match, 'only bounded PP-sum expressions expected');
      const sum = [...match[1].matchAll(/\$(\d+)\$/g)].reduce((total, row) => total + (state[row[1]] || 0), 0);
      assert.ok(sum >= -32768 && sum <= 32767);
      return sum <= 0;
    }
    const a = value(condition.valueA), b = value(condition.valueB);
    if (condition.type === 'eq') return a === b;
    if (condition.type === 'lte') return a <= b;
    if (condition.type === 'gte') return a >= b;
    throw new Error('Unsupported condition ' + condition.type);
  }
  function visit(list, depth = 0) {
    assert.ok(depth < 30, 'bounded script call/branch depth');
    for (const event of list) {
      const a = event.args;
      if (event.command === 'EVENT_CALL_CUSTOM_EVENT') {
        assert.ok(scripts.has(a.customEventId));
        visit(scripts.get(a.customEventId), depth + 1);
      } else if (event.command === 'EVENT_IF') visit(event.children[evaluate(a.condition) ? 'true' : 'false'], depth + 1);
      else if (event.command === 'EVENT_SET_VALUE') state[a.variable] = signed16(value(a.value));
      else if (event.command === 'EVENT_VARIABLE_MATH') {
        assert.equal(a.operation, 'sub');
        state[a.vectorX] = signed16((state[a.vectorX] || 0) - a.value);
      } else if (event.command === 'EVENT_TEXT') observed.text.push(a.text);
      else if (event.command === 'EVENT_MENU') {
        assert.equal(a.layout, 'dialogue');
        assert.equal(a.cancel, true);
        assert.ok(a.options.length <= 4);
        for (const option of a.options) assert.ok(option.replace(/\$\d+\$/g, '40').length <= 16, 'move and PP fit one row');
        observed.menus.push(a.options);
        state[a.variable] = choice;
      } else if (event.command === 'TEST_MOVE_EXECUTION') observed.moves.push(a.move);
      else if (event.command === 'TEST_STRUGGLE') observed.struggles++;
      else throw new Error('Unexpected event ' + event.command);
    }
  }
  visit(events);
  return observed;
}
const readPP = (state, i) => Array.from({ length: 4 }, (_, slot) => state[pp(i, slot)] || 0);
const writePP = (state, i, values) => values.forEach((value, slot) => { state[pp(i, slot)] = value; });
let transitions = 0, checks = 0;
for (const [i, c] of roster.entries()) {
  const tiers = moveTiers(c.dex);
  assert.equal(tiers[0].minLevel, 1);
  assert.equal(tiers.at(-1).maxLevel, 100);
  for (let tier = 1; tier < tiers.length; tier++) assert.equal(tiers[tier].minLevel, tiers[tier - 1].maxLevel + 1);
  for (let level = 1; level <= 100; level++) {
    const moves = movesAtLevel(c.dex, level);
    assert.ok(moves.length >= 1 && moves.length <= 4);
    assert.equal(new Set(moves).size, moves.length);
    const tier = tiers.find(row => level >= row.minLevel && level <= row.maxLevel);
    assert.deepEqual(tier.moves, moves, 'enemy tiers and player lookup agree');
    const state = { [lv(i)]: level, 1: i + 1, 18: 0 };
    run(restores[i], state);
    assert.deepEqual(readPP(state, i), ppAtLevel(c.dex, level));
    assert.ok(readPP(state, i).reduce((sum, n) => sum + n, 0) < 32768);
    const expectedMenu = moves.map((move, slot) => `${move} $${pp(i, slot)}$`);
    const menuResult = run(menus[i], state);
    assert.deepEqual(menuResult.menus, [expectedMenu]);
    assert.deepEqual(menuResult.text, [], 'opening move selection never blocks on a PP popup');
    const afterMenu = { ...state };
    assert.equal(run(selections[i], state).moves.length, 0, 'B cancel spends no turn');
    assert.deepEqual(state, afterMenu);
    state[14] = moves.length + 1;
    const beforeBack = { ...state };
    assert.equal(run(selections[i], state).moves.length, 0, 'Back spends no turn');
    assert.deepEqual(state, beforeBack);
    for (let slot = 0; slot < moves.length; slot++) {
      const attempt = { ...state, 14: slot + 1, 18: 0 };
      const before = readPP(attempt, i);
      const selected = run(selections[i], attempt);
      assert.deepEqual(selected.moves, [moves[slot]]);
      assert.equal(attempt[18], 1);
      const expected = [...before]; expected[slot]--;
      assert.deepEqual(readPP(attempt, i), expected);
      const empty = { ...state, 14: slot + 1, 18: 0, [pp(i, slot)]: 0 };
      assert.deepEqual(run(selections[i], empty).moves, [], 'depleted PP blocks execution');
      assert.equal(empty[pp(i, slot)], 0);
      assert.equal(empty[18], 0);
    }
    const depleted = { ...state, 18: 0 };
    writePP(depleted, i, [0, 0, 0, 0]);
    // Stale PP in inactive slots must not prevent the Struggle fallback.
    for (let slot = moves.length; slot < 4; slot++) depleted[pp(i, slot)] = 40;
    const exhausted = run(fights[i], depleted, 1);
    assert.equal(exhausted.struggles, 1);
    assert.equal(exhausted.menus.length, 0);
    assert.equal(depleted[18], 1);
    const active = { ...state, 18: 0 };
    const fighting = run(fights[i], active, 1);
    assert.deepEqual(fighting.moves, [moves[0]]);
    assert.deepEqual(fighting.menus, [expectedMenu]);
    if (level > 1) {
      const beforeMoves = movesAtLevel(c.dex, level - 1);
      const previousPP = beforeMoves.map((move, slot) => Math.max(0, moveStats(move).pp - 5 - slot));
      const learning = { [lv(i)]: level, 16: 247, 307: 11, 308: 91, 309: 137, 310: 5 };
      writePP(learning, i, Array.from({ length: 4 }, (_, slot) => previousPP[slot] || 0));
      const learned = run(levels[i], learning);
      const expected = Array.from({ length: 4 }, (_, slot) => {
        const move = moves[slot];
        const previousSlot = beforeMoves.indexOf(move);
        return !move ? 0 : previousSlot >= 0 ? previousPP[previousSlot] : moveStats(move).pp;
      });
      assert.deepEqual(readPP(learning, i), expected, `${c.name} level ${level}: retained PP follows moves`);
      const additions = moves.filter(move => !beforeMoves.includes(move));
      assert.equal(learned.text.length, additions.length, 'announce only newly learned moves');
      assert.deepEqual([learning[16], learning[307], learning[308], learning[309], learning[310]], [247, 11, 91, 137, 5]);
      if (additions.length) transitions++;
    }
    checks++;
  }
}

// Fully depleted retained moves remain depleted when the oldest move is replaced.
const charmanderIndex = roster.findIndex(c => c.dex === 4);
const replacement = { [lv(charmanderIndex)]: 22 };
writePP(replacement, charmanderIndex, [0, 0, 0, 0]);
run(levels[charmanderIndex], replacement);
assert.deepEqual(readPP(replacement, charmanderIndex), [0, 0, 0, 20]);
const quietState = { [lv(0)]: 9 };
writePP(quietState, 0, [7, 8, 0, 0]);
assert.equal(run(quiet, quietState).text.length, 0);
assert.deepEqual(readPP(quietState, 0), [7, 8, 25, 0]);
const butterfreeIndex = roster.findIndex(c => c.dex === 12);
const duplicate = { [lv(butterfreeIndex)]: 12 };
writePP(duplicate, butterfreeIndex, [3, 0, 0, 0]);
assert.equal(run(levels[butterfreeIndex], duplicate).text.length, 0);
assert.deepEqual(readPP(duplicate, butterfreeIndex), [3, 0, 0, 0]);

const allowed = new Set([1, 14, 18, ...roster.map((_, i) => lv(i)), ...roster.flatMap((_, i) => Array.from({ length: 4 }, (_, slot) => pp(i, slot)))]);
const referenced = new Set();
const eventIds = new Set();
let eventCount = 0;
function audit(events) {
  for (const event of events) {
    eventCount++;
    assert.ok(!eventIds.has(event.id), 'events keep unique editor IDs');
    eventIds.add(event.id);
    for (const [field, value] of Object.entries(event.args)) {
      if (['variable', 'vectorX', 'vectorY'].includes(field)) referenced.add(Number(value));
      if (value?.type === 'variable') referenced.add(Number(value.value));
      if (field === 'condition') {
        if (value.valueA?.type === 'variable') referenced.add(Number(value.valueA.value));
        for (const match of (value.value || '').matchAll(/\$(\d+)\$/g)) referenced.add(Number(match[1]));
      }
      if (typeof value === 'string') for (const match of value.matchAll(/\$(\d+)\$/g)) referenced.add(Number(match[1]));
    }
    for (const branch of Object.values(event.children || {})) audit(branch);
  }
}
for (const events of [...scripts.values(), ...restores, ...levels, ...menus, ...selections, ...fights, quiet]) audit(events);
for (const variable of referenced) assert.ok(allowed.has(variable), 'no new persisted or scratch variable ' + variable);
assert.equal(executions.size, [...scripts.keys()].filter(name => name.startsWith('learned_move_')).length);
assert.ok([...executions.values()].every(count => count === 1), 'move effects authored exactly once per move');
assert.equal([...scripts.keys()].filter(name => name === 'learned_struggle').length, 1);
const scriptCounts = Object.fromEntries(['restore', 'level', 'slot', 'menu', 'move', 'struggle'].map(kind =>
  [kind, [...scripts.keys()].filter(name => name.startsWith('learned_' + kind + (kind === 'struggle' ? '' : '_'))).length]));
const sourceBytes = ['artwork/move-learning.mjs', 'artwork/red-learnsets.json', 'scripts/fetch-red-learnsets.mjs', 'scripts/move-learning-check.mjs']
  .reduce((total, file) => total + statSync(new URL('../' + file, import.meta.url)).size, 0);
const authoredBytes = Buffer.byteLength(JSON.stringify({ scripts: [...scripts], fights, restores, levels }));
const routingCounts = {};
let routingTextBytes = 0;
function countRouting(events) {
  for (const event of events) {
    routingCounts[event.command] = (routingCounts[event.command] || 0) + 1;
    if (event.command === 'EVENT_TEXT') routingTextBytes += event.args.text.length + 1;
    if (event.command === 'EVENT_MENU') routingTextBytes += event.args.options.join('\n').length + 1;
    for (const branch of Object.values(event.children || {})) countRouting(branch);
  }
}
for (const [name, events] of scripts) if (!name.startsWith('learned_move_') && name !== 'learned_struggle') countRouting(events);
for (const events of fights) countRouting(events);
// Planning envelope only: assumed VM bytes/event plus literal text and script headers.
// These deliberately generous ranges are not measured compilation or a fit guarantee.
const assumedBytes = {
  EVENT_IF: [9, 32], EVENT_SET_VALUE: [5, 10], EVENT_VARIABLE_MATH: [12, 32],
  EVENT_TEXT: [32, 128], EVENT_MENU: [64, 256], EVENT_CALL_CUSTOM_EVENT: [4, 12],
};
const routingSizeEnvelope = [0, 1].map(bound => routingTextBytes + (scripts.size - executions.size - 1) * [4, 32][bound]
  + Object.entries(routingCounts).reduce((sum, [command, count]) => sum + count * assumedBytes[command][bound], 0));
console.log(`${checks} species/level cases and ${transitions} learning boundaries passed; PP, cancel, Struggle, signed16, and variable references checked.`);
console.log(JSON.stringify({ tiers: Object.keys(redLearnsets).reduce((total, dex) => total + moveTiers(Number(dex)).length, 0),
  scriptCounts, customScripts: scripts.size, eventCount, sourceBytes, testAuthoringJsonBytes: authoredBytes,
  routingCounts, routingTextBytes,
  routingPlanningBytes: { low: routingSizeEnvelope[0], high: routingSizeEnvelope[1], assumedBytesPerEvent: assumedBytes },
  romEstimate: 'Rough routing-only planning envelope; excludes real shared move effects and bank padding. Editor JSON is not ROM bytes. Parent must build and inspect the integrated ROM; 4 MiB fit is not verified.' }, null, 2));
