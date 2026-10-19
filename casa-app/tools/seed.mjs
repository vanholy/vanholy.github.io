// Legge SEED da data.js (file locale, escluso da git).
import { readFileSync } from 'node:fs';
export function loadSeed(path = new URL('../data.js', import.meta.url)){
  return new Function(readFileSync(path, 'utf8') + '\nreturn { SEED, SEED_VERSION };')();
}
export function seedStrings(seed){
  const out = new Set();
  const walk = v => { if(typeof v === 'string') out.add(v); else if(v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(seed);
  return out;
}
