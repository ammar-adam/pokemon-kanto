import {readFileSync} from 'node:fs';
import {indexedDispatch} from './indexed-dispatch.mjs';

export const redCatchRates = Object.freeze(JSON.parse(readFileSync(
  new URL('./red-catch-rates.json', import.meta.url), 'utf8')).rates);

export const captureContract = Object.freeze({
  enemy: 4, currentHP: 5, maximumHP: 6, trainer: 19,
  sleep: 302, poison: 303, paralysis: 69,
  result: 16, clobbers: Object.freeze([16, 135, 307, 308, 309, 310])
});

/**
 * Independent numeric reference for ordinary Blue Poke Balls / Master Balls.
 * Rolls are a byte stream; only consumed bytes are validated. Inputs are never
 * mutated. Trainer/invalid targets return false without consuming randomness.
 * Valid battle HP is 1..999, current <= maximum; out-of-domain states fail closed.
 * Source: pinned red-catch-rates.json, ItemUseBall .loop through .captured.
 */
export function referenceCapture({dex, currentHP, maximumHP, sleep = 0,
  poison = 0, paralysis = 0, master = false, trainer = false}, rolls = []) {
  if (typeof master !== 'boolean') throw new TypeError('master must be boolean');
  let rollsUsed = 0;
  const finish = caught => ({caught, rollsUsed});
  if (trainer || !Number.isInteger(dex) || !redCatchRates[dex] ||
    !Number.isInteger(currentHP) || !Number.isInteger(maximumHP) ||
    currentHP < 1 || currentHP > maximumHP || maximumHP > 999) return finish(false);
  const byte = () => {
    const value = rolls[rollsUsed++];
    if (!Number.isInteger(value) || value < 0 || value > 255)
      throw new RangeError('Capture RNG needs an integer byte 0..255');
    return value;
  };
  // Blue calls Random before testing the Master Ball item ID.
  const first = byte();
  if (master) return finish(true);
  const status = sleep > 0 ? 25 : poison > 0 || paralysis > 0 ? 12 : 0;
  if (first < status) return finish(true);
  const hpFactor = Math.floor(Math.floor(maximumHP * 255 / 12) /
    Math.max(Math.floor(currentHP / 4), 1));
  if (first - status > redCatchRates[dex]) return finish(false);
  if (hpFactor > 255) return finish(true);
  return finish(byte() <= hpFactor);
}

/**
 * Instantiate once per shared-script cache with the parent's ordered species
 * array and existing IF/EX/V/set/math/rand/shared callbacks. Enemy slot 4 is a
 * ONE-BASED ROSTER POSITION, not a dex number. Rates use species[i].dex and never
 * modern species[i].catchRate. No inventory, turn, text, HUD, party or PC writes.
 *
 * attempt(master=false) returns events. Read slot 16 immediately: 1 = caught,
 * 0 = failed/ineligible. Other clobbers: 135 = rate, 307 = roll/difference,
 * 308 = status bonus, 309 = HP factor, 310 = division/RNG scratch. Their values
 * are unspecified on early exits. All input and non-clobber slots are preserved.
 * Do not interleave a HUD/damage/menu helper before branching on the result.
 *
 * Call after the parent's trainer, ball-count and capacity guards. Parent owns
 * inventory decrement / spent-turn state, registration and battle exit. Replace
 * only its old roll/tier block with ...capture.attempt(master), then IF(16,...).
 * Trainer guard is repeated here, including Master Balls. Invalid species/HP
 * are rejected without RNG. Legitimate Master Balls consume one byte; ordinary
 * balls consume one or two, matching Blue's short circuits (W=255 still rolls).
 *
 * Scope: ordinary Poke Ball and Master Ball capture outcome; no shake animation,
 * Great/Ultra/Safari factors, ghost/Marowak/old-man exceptions, freeze/burn state,
 * transformed-species quirks or original ROM PRNG. rand must supply uniform
 * inclusive 0..255 bytes; this API preserves decision thresholds and draw count.
 */
export function captureAuthoring({species, IF, EX, V, set, math, rand, shared}) {
  if (!Array.isArray(species) || species.length < 1 || species.length > 151)
    throw new Error('Capture species must contain 1..151 roster entries');
  const dexes = new Set();
  const rows = species.map((pokemon, i) => {
    const dex = pokemon?.dex;
    if (!Number.isInteger(dex) || !redCatchRates[dex] || dexes.has(dex))
      throw new Error('Capture species require unique dex numbers 1..151');
    dexes.add(dex);
    return {value: i + 1, events: [set(135, redCatchRates[dex])]};
  });
  const rates = indexedDispatch('capture_species_rate', 4, rows, {IF, shared});
  const validHP = '$5$ > 0 && $6$ > 0 && $6$ <= 999 && $5$ <= $6$';
  const ordinary = [
    set(308, 0),
    IF(302, '>', 0, [set(308, 25)], [
      EX('$303$ > 0 || $69$ > 0', [set(308, 12)])
    ]),
    EX('$307$ < $308$', [set(16, 1)], [
      math(307, 'sub', 308, 'var'),
      // floor(M*255/12) = 21*M + floor(M/4); peak 21228 at M=999.
      set(309, V(6)), math(309, 'mul', 21),
      set(310, V(6)), math(310, 'div', 4), math(309, 'add', 310, 'var'),
      set(310, V(5)), math(310, 'div', 4), IF(310, '==', 0, [set(310, 1)]),
      math(309, 'div', 310, 'var'),
      EX('$307$ <= $135$', [IF(309, '>', 255, [set(16, 1)], [
        rand(310, 0, 255), EX('$310$ <= $309$', [set(16, 1)])
      ])])
    ])
  ];
  function attempt(master = false) {
    if (typeof master !== 'boolean') throw new TypeError('master must be boolean');
    return shared(master ? 'capture_master_ball' : 'capture_poke_ball', [
      set(16, 0), set(135, 0),
      IF(19, '==', 0, [EX(validHP, [
        ...rates,
        IF(135, '>', 0, [rand(307, 0, 255), ...(master ? [set(16, 1)] : ordinary)])
      ])])
    ]);
  }
  return {attempt, resultVariable: captureContract.result};
}
