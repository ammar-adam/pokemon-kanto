import { readFileSync } from 'node:fs';
import { moveStats as originalMoveStats } from './battle-damage.mjs';

const snapshot = JSON.parse(readFileSync(new URL('./red-learnsets.json', import.meta.url), 'utf8'));
export const redLearnsets = snapshot.species;
export const learnsetCommit = snapshot.commit;
export const moveLearningPolicy = Object.freeze({
  replacement: 'Automatically retain the latest four distinct learned moves; no manual forgetting or refusal.',
  evolution: 'Recompute from the current species and level; inherited moves and evolution timing are not persisted.',
  effects: 'Original learnsets and PP do not imply exact status, fixed-damage, multi-turn, or other battle effects.',
});

function record(dex) {
  if (!Number.isInteger(dex) || !redLearnsets[dex]) throw new RangeError('Unknown Red dex ' + dex);
  return redLearnsets[dex];
}

function checkLevel(level) {
  if (!Number.isInteger(level) || level < 1 || level > 100) throw new RangeError('Level must be 1..100');
}

// A duplicate already in the four slots does not consume PP or reorder the slots.
function learn(moves, move) {
  if (moves.includes(move)) return moves;
  return [...moves, move].slice(-4);
}

export function movesAtLevel(dex, level) {
  checkLevel(level);
  const data = record(dex);
  let moves = [...data.initialMoves];
  for (const row of data.levelUp) {
    if (row.level > level) break;
    moves = learn(moves, row.move);
  }
  return moves;
}

const tierCache = new Map();
export function moveTiers(dex) {
  record(dex);
  if (!tierCache.has(dex)) {
    const tiers = [];
    for (let level = 1; level <= 100; level++) {
      const moves = movesAtLevel(dex, level);
      const previous = tiers.at(-1);
      if (previous && previous.moves.join('|') === moves.join('|')) previous.maxLevel = level;
      else tiers.push({ minLevel: level, maxLevel: level, moves: Object.freeze(moves) });
    }
    tierCache.set(dex, Object.freeze(tiers.map(Object.freeze)));
  }
  return tierCache.get(dex);
}

export function ppAtLevel(dex, level, stats = originalMoveStats) {
  const moves = movesAtLevel(dex, level);
  return Array.from({ length: 4 }, (_, slot) => moves[slot] ? stats(moves[slot]).pp : 0);
}

/**
 * Integration with game-design.mjs (native application belongs to the parent):
 * - Pass existing event callbacks, shared(), lv(i), pp(i,j), and species in roster order.
 * - Replace restorePP with this restorePP for starter/catch/heal/evolution initialization.
 * - Run learnLevel(i) inside each actual +1 level-up branch, after lv(i) increases,
 *   before evolve(). It moves surviving PP left in place and restores only new moves.
 * - Replace fixed fight routing with fight(indexes), or use menu(i) then selection(i).
 * - onMove({move,stats}) returns execution events using the actual Red move identity.
 *   It is authored once per distinct move. Slot/turn PP bookkeeping happens here.
 * - onStruggle() returns the project's Struggle events, including spent-turn handling.
 * - Optional onTurn({move,events}) schedules a valid selection. Its events include
 *   PP spending, so it may skip them when a faster opponent knocks the player out.
 *   Cancel and empty-PP choices never invoke it. By default events run immediately.
 * - Enemy authoring can use moveTiers(dex) with level variable 7, independently of PP.
 *
 * No variable allocation or multiplication is performed. The only common variables
 * written are existing menu slot 14 and spent-turn 18. PP stays four slots/species.
 * Evolution intentionally resets to the target species' level-derived moves. Old
 * fixed-move saves need a PP initialization/heal when adopting this policy.
 * onMove must explicitly implement or describe unsupported battle effects; do not
 * infer damage from slot position, or turn power-zero/fixed-damage moves into attacks.
 */
export function moveLearningAuthoring({
  species, IF, EX, V, set, math, menu: makeMenu, say, shared, lv, pp,
  moveStats = originalMoveStats, onMove, onStruggle, onTurn=({events})=>events,
}) {
  const emitted = new Set();
  const key = move => move.toLowerCase().replace(/[^a-z]/g, '');
  const once = (name, events) => {
    const body = emitted.has(name) ? [] : events();
    emitted.add(name);
    return shared(name, body);
  };
  const pokemon = index => {
    if (!Number.isInteger(index) || index < 0 || index >= species.length) throw new RangeError('Invalid roster index');
    record(species[index].dex);
    return species[index];
  };
  const tiers = index => moveTiers(pokemon(index).dex);

  // One branch runs even if an execution callback changes scratch variables.
  function atLevel(index, events) {
    return tiers(index).reduce((previous, tier, tierIndex) => tierIndex === 0
      ? events(tier)
      : [IF(lv(index), '>=', tier.minLevel, events(tier), previous)], []);
  }

  function restorePP(index) {
    return once('learned_restore_' + index, () => atLevel(index, tier =>
      Array.from({ length: 4 }, (_, slot) => set(pp(index, slot), tier.moves[slot] ? moveStats(tier.moves[slot]).pp : 0))));
  }

  function learnLevel(index, { announce = true } = {}) {
    const c = pokemon(index);
    return once('learned_level_' + index + (announce ? '_announce' : '_quiet'), () =>
      tiers(index).slice(1).map(tier => {
        const before = movesAtLevel(c.dex, tier.minLevel - 1);
        const updates = [];
        // Retained moves only shift left, so lower slots can be written first.
        for (let slot = 0; slot < 4; slot++) {
          const move = tier.moves[slot];
          const source = move ? before.indexOf(move) : -1;
          if (source >= 0 && source !== slot) {
            if (source < slot) throw new Error('PP transition would overwrite a source');
            updates.push(set(pp(index, slot), V(pp(index, source))));
          } else if (source < 0) updates.push(set(pp(index, slot), move ? moveStats(move).pp : 0));
        }
        if (announce) for (const move of tier.moves.filter(move => !before.includes(move))) {
          updates.push(say(`${c.name}\nLEARNED ${move}!`));
        }
        return IF(lv(index), '==', tier.minLevel, updates);
      }));
  }

  function execute(move) {
    if (typeof onMove !== 'function') throw new TypeError('onMove must author actual move execution');
    return once('learned_move_' + key(move), () => onMove({ move, stats: moveStats(move) }));
  }

  function selected(index, slot, move) {
    return [
      IF(pp(index, slot), '<=', 0, [say('NO PP LEFT\nFOR THAT MOVE.')], onTurn({move,events:[
        math(pp(index, slot), 'sub', 1), set(18, 1), set(14, slot + 1),
        say(`USED ${move}!`), ...execute(move),
      ]})),
    ];
  }

  function menuTier(index, tier) {
    // Four full-width rows avoid the narrow menu and a separate blocking PP page.
    const options = tier.moves.map((move, slot) => `${move} $${pp(index, slot)}$`);
    return [set(14, 0), makeMenu(14, options, true, 'dialogue')];
  }

  const menu = index => atLevel(index, tier => menuTier(index, tier));
  const selectionTier = (index, tier) => tier.moves.reduceRight((otherwise,move,slot)=>
    [IF(14,'==',slot+1,selected(index,slot,move),otherwise)],[]);
  const selection = index => atLevel(index, tier => selectionTier(index, tier));

  function fight(indexes) {
    if (typeof onStruggle !== 'function') throw new TypeError('onStruggle must author the exhausted-PP turn');
    return indexes.map(index => IF(1, '==', index + 1, atLevel(index, tier => [
      EX(tier.moves.map((_, slot) => `$${pp(index, slot)}$`).join(' + ') + ' <= 0',
        once('learned_struggle',()=>onTurn({move:'STRUGGLE',events:onStruggle()})),
        [...menuTier(index, tier), ...selectionTier(index, tier)]),
    ])));
  }

  return { restorePP, learnLevel, menu, selection, fight };
}
