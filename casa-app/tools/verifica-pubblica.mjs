// Blocca la build se la pagina pubblica contiene testi presi da data.js o dati personali.
// Uso: node tools/verifica-pubblica.mjs <pagina.html>
import { readFileSync, existsSync } from 'node:fs';
import { loadSeed, seedStrings } from './seed.mjs';

// Etichette e categorie usate anche dal codice: non sono dati personali.
const ETICHETTE = new Set(['belotti','attivo','pasinetti','1 (e 2)','comune','T + S1','soppresso','Proprietà','704, 705','Usufrutto','Nuda proprietà','Comproprietà','Proprietari e famiglia','Professionisti','Fornitori','Uffici','Storici','prima del 1960','Lavori','avvenuto','Urbanistica','Catasto','data da recuperare','Famiglia','Previsto','previsto','Ristrutturazione','Atti e titoli','Progetti e disegni','Fatture e ricevute','Analisi','Preventivi','aperta','Notaio','da procurare','Professionisti e pratiche','Imposte e tasse','attiva','Pratiche','Manutenzione','esclusa','in valutazione','inclusa','ricevuto']);
const VIETATI = [/drive\.google\.com\/(file|drive)/, /\bmapp(ale)?\.? ?\d/i, /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/, /\bIT\d{2}[A-Z]\d{10}/, /service_role/];

const page = readFileSync(process.argv[2], 'utf8');
const errori = VIETATI.filter(re => re.test(page)).map(re => 'schema vietato ' + re);
if(existsSync(new URL('../data.js', import.meta.url))){
  const { SEED } = loadSeed();
  // parole dell'indirizzo (via, comune) anche fuori dalla frase completa; il nome dell'app è ammesso
  const parole = [SEED.immobile.indirizzo, SEED.immobile.intestazione].join(' ').match(/\p{Lu}\p{L}{4,}/gu) || [];
  parole.filter(p => p !== 'Carobbio').forEach(p => { if(page.includes(p)) errori.push("parola dell'indirizzo: " + p); });
  for(const s of seedStrings(SEED)) if(s.length >= 6 && !ETICHETTE.has(s) && page.includes(s)) errori.push('testo di data.js: ' + s);
} else console.warn('data.js assente: controllo solo sugli schemi vietati');
if(errori.length){ console.error('PAGINA PUBBLICA NON SICURA:\n  ' + errori.join('\n  ')); process.exit(1); }
console.log('verifica privacy ok');
