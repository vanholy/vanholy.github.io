// Importa in Supabase (cc_records, cc_meta) i dati di riferimento di data.js e, se presente,
// il backup JSON più recente in dati/ (il backup vince sui record con lo stesso id).
// Uso:
//   node tools/importa.mjs                 prova a secco: mostra cosa verrebbe scritto
//   node tools/importa.mjs --scrivi        scrive davvero (le righe già presenti non vengono toccate)
// Serve la service role SOLO in variabile d'ambiente, mai in un file del repository:
//   SUPABASE_SERVICE_ROLE_KEY=... node tools/importa.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { loadSeed } from './seed.mjs';

const URL_SB = 'https://cfejkhmrphjiccyrkblc.supabase.co';
const COLLS = ['subalterni','quote','soggetti','eventi','documenti','criticita','checklist','spese','preventivi','detrazioni','scadenze'];
const scrivi = process.argv.includes('--scrivi');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function buildDb(SEED, SEED_VERSION, backup){
  const now = new Date().toISOString();
  const colls = {};
  COLLS.forEach(c => colls[c] = SEED[c].map(r => ({ ...r, _seed: true })));
  let meta = { seedVersion: SEED_VERSION, created: now, updated: now, lastBackup: null, changesSinceBackup: 0, deletedSeed: [] };
  let settings = { docBase: '', quotaBelotti: 50 };
  if(backup){
    if(backup.app !== 'casa-carobbio' || !backup.colls) throw new Error('Il backup non è di Casa Carobbio');
    const deleted = new Set((backup.meta && backup.meta.deletedSeed) || []);
    COLLS.forEach(c => {
      const byId = new Map(colls[c].filter(r => !deleted.has(r.id)).map(r => [r.id, r]));
      (backup.colls[c] || []).forEach(r => byId.set(r.id, r));
      colls[c] = [...byId.values()];
    });
    meta = { ...meta, ...backup.meta, seedVersion: SEED_VERSION, lastBackup: backup.exportedAt || now, changesSinceBackup: 0 };
    settings = { ...settings, ...backup.settings };
  }
  delete settings.utente; // con Supabase è il membro collegato
  for(const c of COLLS) for(const r of colls[c]) if(!r.id) throw new Error(`Record senza id in ${c}`);
  return { meta, settings, immobile: SEED.immobile, colls };
}

async function api(path, opts = {}){
  const r = await fetch(URL_SB + '/rest/v1/' + path, { ...opts, headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...opts.headers } });
  if(!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.status === 204 || r.headers.get('content-length') === '0' ? null : r.json();
}

async function main(){
  const { SEED, SEED_VERSION } = loadSeed();
  const dir = new URL('../dati/', import.meta.url);
  const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')).sort() : [];
  const file = files.at(-1); // i nomi contengono la data: l'ultimo è il più recente
  const backup = file ? JSON.parse(readFileSync(new URL(file, dir), 'utf8')) : null;
  const db = buildDb(SEED, SEED_VERSION, backup);
  console.log(`Fonte: data.js (seed v${SEED_VERSION})` + (file ? ` + dati/${file}` : ', nessun backup in dati/'));

  let present = new Set(), metaPresent = new Set();
  if(key){
    for(let from = 0;; from += 1000){
      const rows = await api('cc_records?select=coll,id', { headers: { Range: `${from}-${from + 999}` } });
      rows.forEach(r => present.add(r.coll + '\n' + r.id)); if(rows.length < 1000) break;
    }
    (await api('cc_meta?select=key')).forEach(m => metaPresent.add(m.key));
  } else console.log('SUPABASE_SERVICE_ROLE_KEY non impostata: non confronto con il database.');

  const rows = [];
  console.log('\nCollezione       totale  nuovi  già presenti');
  for(const c of COLLS){
    const nuovi = db.colls[c].filter(r => !present.has(c + '\n' + r.id));
    nuovi.forEach(r => rows.push({ coll: c, id: r.id, data: r, deleted: false }));
    console.log(c.padEnd(16), String(db.colls[c].length).padStart(6), String(nuovi.length).padStart(6), String(db.colls[c].length - nuovi.length).padStart(13));
  }
  const metaRows = [['meta', db.meta], ['settings', db.settings], ['immobile', db.immobile]].filter(([k]) => !metaPresent.has(k)).map(([key, value]) => ({ key, value }));
  console.log(`\ncc_records da scrivere: ${rows.length} · cc_meta da scrivere: ${metaRows.map(m => m.key).join(', ') || 'nessuna'}`);

  if(!scrivi){ console.log('\nProva a secco: nulla è stato scritto. Rilancia con --scrivi per importare.'); return; }
  if(!key) throw new Error('Per scrivere serve SUPABASE_SERVICE_ROLE_KEY');
  // ignore-duplicates: non sovrascrive mai le modifiche già fatte dai familiari
  for(let i = 0; i < rows.length; i += 500) await api('cc_records?on_conflict=coll,id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500)) });
  if(metaRows.length) await api('cc_meta?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(metaRows) });
  console.log('Importazione completata.');
}

if(process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) main().catch(e => { console.error('Errore:', e.message); process.exit(1); });
