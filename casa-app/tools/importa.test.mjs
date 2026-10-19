// node --test tools/importa.test.mjs   (dati finti, nessuna rete)
import test from 'node:test'; import assert from 'node:assert/strict';
import { buildDb } from './importa.mjs';

const COLLS = ['subalterni','quote','soggetti','eventi','documenti','criticita','checklist','spese','preventivi','detrazioni','scadenze'];
const SEED = Object.fromEntries(COLLS.map(c => [c, []])); SEED.immobile = { x: 1 };
SEED.spese = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }, { id: 'c', v: 1 }];

test('solo seed: record marcati _seed', () => {
  const db = buildDb(SEED, 3, null);
  assert.deepEqual(db.colls.spese.map(r => r.id), ['a', 'b', 'c']);
  assert.ok(db.colls.spese.every(r => r._seed)); assert.equal(db.meta.seedVersion, 3);
});
test('il backup vince, rispetta deletedSeed e toglie utente', () => {
  const backup = { app: 'casa-carobbio', exportedAt: '1999-01-01T00:00:00Z', meta: { deletedSeed: ['b'] }, settings: { utente: 'X', quotaBelotti: 40 },
    colls: { spese: [{ id: 'a', v: 2, _seed: true, _mod: true }, { id: 'n', v: 9 }] } };
  const db = buildDb(SEED, 3, backup);
  assert.deepEqual(db.colls.spese.map(r => [r.id, r.v]), [['a', 2], ['c', 1], ['n', 9]]);
  assert.equal(db.settings.quotaBelotti, 40); assert.equal(db.settings.utente, undefined);
  assert.equal(db.meta.lastBackup, '1999-01-01T00:00:00Z');
});
test('rifiuta un file che non è un backup', () => assert.throws(() => buildDb(SEED, 3, { app: 'altro' })));
