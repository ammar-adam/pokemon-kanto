import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { moveStats } from '../artwork/battle-damage.mjs';

export const RED_COMMIT = 'd2704a63c26f9ba046ade877445216b3de0519a4';
const rawRoot = `https://raw.githubusercontent.com/pret/pokered/${RED_COMMIT}/`;
const destination = new URL('../artwork/red-learnsets.json', import.meta.url);
const normalize = value => value.replace(/_/g, '').toLowerCase();
const hash = text => createHash('sha256').update(text).digest('hex');

export function parseMoveNames(constants, names) {
  const moveSection = constants.split(/^DEF NUM_ATTACKS EQU/m)[0];
  const symbols = [...moveSection.matchAll(/^\s*const\s+([A-Z][A-Z_0-9]*)\s*(?:;.*)?$/gm)].map(match => match[1]);
  const labels = [...names.matchAll(/^\s*li\s+"([^"]+)"\s*(?:;.*)?$/gm)].map(match => match[1]);
  if (symbols[0] !== 'NO_MOVE' || symbols.length !== 166 || labels.length !== 165) {
    throw new Error('Expected NO_MOVE and 165 original move names');
  }
  return new Map(symbols.slice(1).map((symbol, index) => [symbol, labels[index]]));
}

export function parseInitialMoves(text, names) {
  const dexSymbol = text.match(/^\s*db\s+(DEX_[A-Z_]+)\s*;/m)?.[1];
  const declaration = text.match(/^\s*db\s+([^;\r\n]+)\s*;\s*level 1 learnset\s*$/m)?.[1];
  if (!dexSymbol || !declaration) throw new Error('Missing dex or initial move declaration');
  const symbols = declaration.split(',').map(value => value.trim());
  if (symbols.length !== 4) throw new Error('Expected exactly four initial move slots');
  let empty = false;
  const moves = [];
  for (const symbol of symbols) {
    if (symbol === 'NO_MOVE') { empty = true; continue; }
    if (empty || !names.has(symbol)) throw new Error('Invalid initial move ' + symbol);
    moves.push(names.get(symbol));
  }
  if (!moves.length || new Set(moves).size !== moves.length) throw new Error('Invalid initial move list');
  return { dexSymbol, initialMoves: moves };
}

export function parseLevelUpSource(text, names) {
  const sections = new Map();
  for (const match of text.matchAll(/^([A-Za-z0-9]+)EvosMoves:\s*\n([\s\S]*?)(?=^[A-Za-z0-9]+EvosMoves:|$(?![\s\S]))/gm)) {
    let phase = 'evolutions';
    let previous = 0;
    const moves = [];
    for (const raw of match[2].split(/\r?\n/)) {
      const line = raw.split(';')[0].trim();
      if (!line) continue;
      if (/^db\s+0$/.test(line)) {
        if (phase === 'evolutions') { phase = 'moves'; continue; }
        phase = 'done'; break;
      }
      if (phase === 'evolutions') {
        if (!/^db\s+EVOLVE_(?:LEVEL|ITEM|TRADE),/.test(line)) throw new Error('Unrecognized evolution ' + line);
        continue;
      }
      const move = line.match(/^db\s+(\d+),\s*([A-Z][A-Z_0-9]*)$/);
      if (!move || !names.has(move[2])) throw new Error('Unrecognized level-up ' + line);
      const level = Number(move[1]);
      if (level < 1 || level > 100 || level < previous) throw new Error('Invalid level order');
      previous = level;
      moves.push({ level, move: names.get(move[2]) });
    }
    if (phase !== 'done') throw new Error('Unterminated learnset ' + match[1]);
    const key = normalize(match[1]);
    if (sections.has(key)) throw new Error('Duplicate learnset ' + key);
    sections.set(key, moves);
  }
  return sections;
}

async function get(file) {
  const response = await fetch(rawRoot + file, {
    headers: { 'User-Agent': 'pocket-frontier-red-learnsets' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status}: ${rawRoot + file}`);
  return response.text();
}

export async function fetchRedLearnsets() {
  const paths = ['constants/pokedex_constants.asm', 'constants/move_constants.asm',
    'data/moves/names.asm', 'data/pokemon/evos_moves.asm', 'data/pokemon/base_stats.asm'];
  const contents = await Promise.all(paths.map(get));
  const [dexConstants, moveConstants, moveNames, evosMoves, baseStatsIndex] = contents;
  const dexSymbols = [...dexConstants.matchAll(/^\s*const\s+(DEX_[A-Z_]+)\s*(?:;.*)?$/gm)].map(match => match[1]);
  if (dexSymbols.length !== 151) throw new Error('Expected 151 dex constants');
  const names = parseMoveNames(moveConstants, moveNames);
  const schedules = parseLevelUpSource(evosMoves, names);
  const files = [...baseStatsIndex.matchAll(/^INCLUDE\s+"(data\/pokemon\/base_stats\/[^"\r\n]+\.asm)"/gm)].map(match => match[1]);
  // Red stores Mew separately from the 150-entry base-stat table.
  if (files.length !== 150) throw new Error('Expected 150 indexed species');
  files.push('data/pokemon/base_stats/mew.asm');
  const entries = new Array(files.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < files.length) {
      const index = cursor++;
      const source = files[index];
      const text = await get(source);
      const { dexSymbol, initialMoves } = parseInitialMoves(text, names);
      const dex = dexSymbols.indexOf(dexSymbol) + 1;
      const levelUp = schedules.get(normalize(dexSymbol.slice(4)));
      if (!dex || !levelUp) throw new Error('Missing original schedule for ' + dexSymbol);
      for (const name of [...initialMoves, ...levelUp.map(row => row.move)]) moveStats(name);
      entries[index] = [dex, { initialMoves, levelUp, source: rawRoot + source, sha256: hash(text) }];
    }
  }));
  if (new Set(entries.map(([dex]) => dex)).size !== 151) throw new Error('Missing or duplicate species');
  return {
    schemaVersion: 1,
    version: 'red',
    source: 'https://github.com/pret/pokered',
    commit: RED_COMMIT,
    sources: Object.fromEntries(paths.map((file, index) => [file, { url: rawRoot + file, sha256: hash(contents[index]) }])),
    species: Object.fromEntries(entries.sort(([a], [b]) => a - b)),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const snapshot = JSON.stringify(await fetchRedLearnsets(), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (await readFile(destination, 'utf8') !== snapshot) throw new Error('Pinned learnset snapshot differs');
    console.log('Pinned Red initial moves and level-up schedules match for all 151 species.');
  } else {
    await writeFile(destination, snapshot);
    console.log('Retained Red learnsets for all 151 species at ' + RED_COMMIT);
  }
}
