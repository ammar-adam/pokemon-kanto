import {moveStats} from './battle-damage.mjs';
import {indexedDispatch} from './indexed-dispatch.mjs';

const moveKey = move => (typeof move === 'string' ? move : move.key || move.name)
  .toLowerCase().replace(/[^a-z]/g, '').replace('highjumpkick', 'hijumpkick');
const specialTypes = new Set(['FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'PSYCHIC', 'DRAGON']);

function normalizeMoves(moves) {
  if (!Array.isArray(moves) || moves.length > 4) throw new Error('Enemy moves must be an array of up to four moves');
  const unique = new Map();
  for (const move of moves) {
    const key = moveKey(move);
    if (!unique.has(key)) unique.set(key, typeof move === 'string' ? move : move.name || move.key);
  }
  return [...unique.values()];
}

// The callback runs at authoring time, never on the cartridge.
export function enemyMoveTiers(species, getMoves) {
  const tiers = [];
  for (let level = 1; level <= 100; level++) {
    const moves = normalizeMoves(getMoves(species, level));
    const previous = tiers.at(-1);
    if (previous && previous.moves.map(moveKey).join('|') === moves.map(moveKey).join('|')) previous.maxLevel = level;
    else tiers.push({minLevel: level, maxLevel: level, moves});
  }
  return tiers;
}

function checkedTiers(tiers) {
  if (!Array.isArray(tiers) || !tiers.length) throw new Error('Enemy move tiers must cover levels 1..100');
  let nextLevel = 1;
  const result = tiers.map(tier => {
    if (tier.minLevel !== nextLevel || !Number.isInteger(tier.maxLevel)
      || tier.maxLevel < tier.minLevel || tier.maxLevel > 100) {
      throw new Error('Enemy move tiers must be ordered, contiguous ranges covering levels 1..100');
    }
    nextLevel = tier.maxLevel + 1;
    return {...tier, moves: normalizeMoves(tier.moves)};
  });
  if (nextLevel !== 101) throw new Error('Enemy move tiers must cover levels 1..100');
  return result;
}

/**
 * Reuse unused bossReturn slot 136; values 0..31 encode capped battle flags.
 * 1: player Attack down; 2: player Defense down; 4: enemy Defense up.
 * 8: enemy Defense down; 16: player Defense up. Opposite Defense stages cancel.
 * Existing slot 29 continues to hold enemy Attack down (player Growl).
 * This deliberately models one simplified stage through physical damage ratios.
 * Reset at battle entry, clearPlayer on any player switch (including fainting),
 * clearEnemy when replacing a defeated foe. Pass enemyDamage as damageModifiers;
 * apply playerDamage after the player's base calculation, before variance.
 */
export function enemyBattleStateAuthoring({EX, set, math, say, state = 136}) {
  const present = bit => `($${state}$ % ${bit * 2}) >= ${bit}`;
  const add = (bit, message) => [EX(present(bit), [say('IT CANNOT CHANGE\nANY FURTHER.')],
    [math(state, 'add', bit), say(message)])];
  const clear = bit => EX(present(bit), [math(state, 'sub', bit)]);
  const stage = (bit, opposite, message) => [EX(present(opposite),
    [math(state, 'sub', opposite), say(message)], add(bit, message))];
  const physical = '!($300$ == 2 || $300$ == 3 || $300$ == 4 || $300$ == 5 || $300$ == 6 || $300$ == 11 || $300$ == 15)';
  const ratio = (bit, numerator, denominator) => EX(present(bit), [
    math(16, 'mul', numerator), math(16, 'div', denominator),
    EX('$16$ == 0', [set(16, 1)])
  ]);
  const attackDown = () => add(1, 'YOUR ATTACK\nFELL!');
  const defenseDown = () => stage(2, 16, 'YOUR DEFENSE\nFELL!');
  const defenseUp = () => stage(4, 8, 'FOE DEFENSE\nROSE!');
  const playerDefenseDown = () => stage(8, 4, 'FOE DEFENSE\nFELL!');
  const playerDefenseUp = () => stage(16, 2, 'YOUR DEFENSE\nROSE!');
  return {
    state,
    statusEffects: {
      ATTACK_DOWN1_EFFECT: attackDown,
      DEFENSE_DOWN1_EFFECT: defenseDown,
      DEFENSE_DOWN2_EFFECT: defenseDown,
      DEFENSE_UP1_EFFECT: defenseUp,
      DEFENSE_UP2_EFFECT: defenseUp,
    },
    playerStatusEffects: {
      ATTACK_DOWN1_EFFECT: () => [EX('$29$ == 1', [say('IT CANNOT CHANGE\nANY FURTHER.')],
        [set(29, 1), say('FOE ATTACK\nFELL!')])],
      DEFENSE_DOWN1_EFFECT: playerDefenseDown,
      DEFENSE_DOWN2_EFFECT: playerDefenseDown,
      DEFENSE_UP1_EFFECT: playerDefenseUp,
      DEFENSE_UP2_EFFECT: playerDefenseUp,
    },
    reset: () => [set(state, 0)],
    clearPlayer: () => [clear(1), clear(2), clear(16)],
    clearEnemy: () => [clear(4), clear(8)],
    playerDamage: () => [EX(`$16$ > 0 && ${physical}`, [ratio(1, 2, 3), ratio(4, 2, 3), ratio(8, 3, 2)])],
    enemyDamage: () => [EX(`$16$ > 0 && ${physical}`, [ratio(2, 3, 2), ratio(16, 2, 3)])],
  };
}

/**
 * Inject the existing game-design event builders and damage helpers.
 * Supply getMoves(species, level), or moveTiers(species) / an array parallel to species.
 * statusEffects maps Red effect constants to (move) => events (or event arrays).
 * Handlers own status storage, immunities and secondary-effect probability. They
 * run only after accuracy succeeds; secondary handlers also require damage and
 * a living player. No enemy PP or per-species move-ID variables are allocated.
 * damageModifiers() optionally returns the packed state's enemyDamage events.
 * Scratch: 14=move ID, 15=RNG, 16=damage, 135/307=temporary arithmetic;
 * 300/301=move type/power. Existing foe effects: 29, 68, 69, 302, 303.
 */
export function enemyMoveAuthoring({species, getMoves, moveTiers, IF, EX, V, set, math,
  rand, say, shared, chunked, typeCode, damage, effectiveness, storeHP,
  invoke, sfx, fx, statusEffects = {}, damageModifiers = () => []}) {
  if (!getMoves && !moveTiers) throw new Error('Enemy move authoring requires getMoves or moveTiers');
  const catalog = new Map();
  const register = authored => {
    const key = moveKey(authored);
    if (!catalog.has(key)) {
      const stats = moveStats(key);
      catalog.set(key, {id: catalog.size + 1, key,
        name: authored.toUpperCase(), ...stats});
    }
    return catalog.get(key).id;
  };
  const tiers = species.map((pokemon, i) => checkedTiers(moveTiers
    ? typeof moveTiers === 'function' ? moveTiers(pokemon) : moveTiers[i]
    : enemyMoveTiers(pokemon, getMoves)));
  for (const ranges of tiers) for (const range of ranges) range.moves.forEach(register);
  const struggleId = register('struggle');
  const pools = new Map();
  function pool(moves) {
    const ids = moves.length ? moves.map(register) : [struggleId];
    const key = ids.join('_');
    if (!pools.has(key)) pools.set(key, 'enemy_pool_' + key);
    return shared(pools.get(key), ids.length === 1 ? [set(14, ids[0])] : [
      rand(15, 1, ids.length), ...ids.map((id, i) => IF(15, '==', i + 1, [set(14, id)]))
    ]);
  }
  function select() {
    return [set(14, struggleId), ...indexedDispatch('enemy_move_select',4,species.map((pokemon, i) =>
      ({value:i+1,events:tiers[i].flatMap(tier => [
        EX(`$7$ >= ${tier.minLevel} && $7$ <= ${tier.maxLevel}`, pool(tier.moves))
      ])})),{IF,shared})];
  }
  const failed = () => [say('BUT IT FAILED!')];
  function status(move) {
    const handler = statusEffects[move.effect];
    return typeof handler === 'function' ? handler(move) : handler;
  }
  function heal(gain) {
    return [set(135, V(6)), math(135, 'sub', 5, 'var'),
      EX('$16$ > $135$', [set(16, V(135))]), math(5, 'add', 16, 'var'),
      invoke('hud'), say(gain)];
  }
  function hit(move) {
    const fixed = move.effect === 'SPECIAL_DAMAGE_EFFECT';
    const half = move.effect === 'SUPER_FANG_EFFECT';
    const events = fixed
      ? move.key === 'dragonrage' ? [set(16, 40)]
        : move.key === 'sonicboom' ? [set(16, 20)]
        : move.key === 'psywave' ? [set(307, V(7)), math(307, 'mul', 3), math(307, 'div', 2),
          rand(15, 1, 150), math(15, 'mul', 307, 'var'), math(15, 'div', 150),
          set(16, V(15)), IF(16, '<', 1, [set(16, 1)])]
          : [set(16, V(7))]
      : half ? [set(16, V(3)), math(16, 'div', 2), IF(16, '<', 1, [set(16, 1)])]
        : [...damage.base(4, 1, 7, 0)];
    // Fixed-damage moves use type immunity, but do not receive type multipliers.
    if (fixed || half) {
      events.push(set(135, V(16)), ...effectiveness(4, 1), IF(16, '>', 0, [set(16, V(135))]));
    } else events.push(...damageModifiers(), ...effectiveness(4, 1), rand(15, 217, 255), ...damage.variance());
    // Only a positive, non-immune hit can receive the post-reduction floor.
    const reductions = !fixed && !half && !specialTypes.has(move.type)
      ? [IF(29, '==', 1, [math(16, 'div', 2)])] : [];
    reductions.push(IF(17, '==', 1, [math(16, 'div', 2), set(17, 0)]),
      IF(16, '==', 0, [set(16, 1)]));
    events.push(IF(16, '>', 0, reductions),
      EX('$16$ > $3$', [set(16, V(3))]), math(3, 'sub', 16, 'var'),
      IF(3, '<', 0, [set(3, 0)]), ...storeHP(), sfx(2), fx('partner'), invoke('hud'));
    if (move.effect === 'DRAIN_HP_EFFECT') events.push(IF(16, '>', 0, [
      math(16, 'div', 2), IF(16, '==', 0, [set(16, 1)]), ...heal('THE FOE DRAINED\nYOUR HP!')
    ]));
    if (move.effect === 'RECOIL_EFFECT') events.push(IF(16, '>', 0, [
      math(16, 'div', 4), IF(16, '==', 0, [set(16, 1)]), math(5, 'sub', 16, 'var'),
      IF(5, '<', 0, [set(5, 0)]), invoke('hud'), say('RECOIL HURT\nTHE FOE!')
    ]));
    if (move.effect === 'EXPLODE_EFFECT') events.push(set(5, 0), invoke('hud'));
    const secondary = status(move);
    if (secondary) events.push(EX('$3$ > 0 && $16$ > 0', secondary));
    return events;
  }
  function action(move) {
    if (move.effect === 'SPLASH_EFFECT') return [say('NOTHING HAPPENED.')];
    if (move.effect === 'HEAL_EFFECT') {
      return [EX('$5$ < $6$', [set(16, V(6)), ...(move.key === 'rest'
        ? [set(5, 0), set(302, 2), set(303, 0), set(69, 0)] : [math(16, 'div', 2)]),
        ...heal('THE FOE RESTORED\nITS HP!')], failed())];
    }
    if (move.effect === 'DREAM_EATER_EFFECT' || move.effect === 'OHKO_EFFECT') return status(move) || failed();
    if (move.power === 1 && !['SPECIAL_DAMAGE_EFFECT', 'SUPER_FANG_EFFECT'].includes(move.effect)) return status(move) || failed();
    if (move.power === 0 && move.effect !== 'SPECIAL_DAMAGE_EFFECT') return status(move) || failed();
    return hit(move);
  }
  function resolve() {
    return indexedDispatch('enemy_move_resolve',14,[...catalog.values()].map(move => {
      const body = action(move);
      const accurate = move.effect === 'SWIFT_EFFECT' || move.accuracy >= 100 ? body : [
        rand(15, 1, 100), IF(15, '<=', move.accuracy, body, [say('THE FOE MISSED!')])
      ];
      return {value:move.id,events:shared('enemy_move_' + move.key, [
        set(16, 0), set(300, typeCode(move.type)), set(301, move.power),
        say(`THE FOE USED\n${move.name}!`),
        ...(move.effect === 'SWIFT_EFFECT' ? accurate : [set(135, 1), IF(68, '==', 1, [
          rand(15, 1, 100), IF(15, '<=', 30, [set(135, 0)])
        ]), IF(135, '==', 1, accurate, [say('THE FOE MISSED!')])])
      ])};
    }),{IF,shared});
  }
  function counter({selected=false}={}) {
    const turn = [...(selected?[]:select()), ...resolve()];
    return [set(16, 0), IF(302, '>', 0, [math(302, 'sub', 1), say('THE FOE IS\nFAST ASLEEP.')], [
      IF(69, '==', 1, [rand(15, 1, 100), IF(15, '>', 25, shared(selected?'enemy_queued_turn':'enemy_turn', turn),
        [say('THE FOE IS\nFULLY PARALYZED!')])], shared(selected?'enemy_queued_turn':'enemy_turn', turn))
    ])];
  }
  return {select, resolve, counter, tiers, moves: [...catalog.values()]};
}
