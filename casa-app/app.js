/* ===================================================================
   Casa Carobbio · webapp
   Fase 1: dati nel browser (localStorage). Il resto dell'app parla solo
   con Repo, che usa un "adattatore". Per passare al NAS basta scrivere un
   ApiAdapter con gli stessi metodi (loadAll, put, del, saveMeta) e
   impostarlo in Repo.adapter. Il backup JSON si importa nel nuovo DB.
   =================================================================== */
const APP_ID = 'casa-carobbio';
const SCHEMA = 1;
const STORE_KEY = 'casa-carobbio.v1';
const COLLS = ['subalterni','quote','soggetti','eventi','documenti','criticita','checklist','spese','preventivi','detrazioni','scadenze'];

/* ---------- adattatore: memoria del browser ---------- */
const LocalAdapter = {
  name: 'Memoria del browser (solo questo dispositivo)',
  ok: null,
  test(){ try{ const k='__cc_t'; localStorage.setItem(k,'1'); localStorage.removeItem(k); this.ok=true; }catch(e){ this.ok=false; } return this.ok; },
  async loadAll(){ try{ const s=localStorage.getItem(STORE_KEY); return s?JSON.parse(s):null; }catch(e){ return null; } },
  async saveAll(db){ if(!this.ok) return false; try{ localStorage.setItem(STORE_KEY, JSON.stringify(db)); return true; }catch(e){ return false; } },
  async put(coll, rec, db){ return this.saveAll(db); },
  async del(coll, id, db){ return this.saveAll(db); },
  async saveMeta(db){ return this.saveAll(db); },
  async clear(){ try{ localStorage.removeItem(STORE_KEY); }catch(e){} }
};
/* ---------- adattatore: Supabase (pagina pubblicata) ----------
   Attivo quando la build definisce CC_SUPABASE = {url, key} (chiave pubblica anon).
   Tabelle cc_records (una riga per record) e cc_meta (meta, settings, immobile). */
const META_KEYS = ['meta','settings','immobile'];
const SupabaseAdapter = {
  name: 'Supabase (condiviso con i familiari)',
  ok: null, sb: null, user: null, nome: '', ruolo: null, err: '',
  test(){ this.ok = !!this.user; return this.ok; },
  async connect(){
    this.sb = supabase.createClient(CC_SUPABASE.url, CC_SUPABASE.key);
    const { data, error } = await this.sb.auth.getSession(); if(error) throw error;
    this.user = data.session ? data.session.user : null;
    if(!this.user) return;
    const r = await this.sb.from('cc_membri').select('nome,ruolo').eq('user_id', this.user.id).maybeSingle();
    if(r.error) throw r.error;
    this.nome = r.data ? r.data.nome : ''; this.ruolo = r.data ? r.data.ruolo : null;
  },
  fail(e){ this.err = (e && e.message) || String(e); console.warn('Supabase:', this.err); return false; },
  async liveRows(cols){ // PostgREST restituisce al massimo 1000 righe per richiesta
    const out = [];
    for(let from=0;; from+=1000){
      const { data, error } = await this.sb.from('cc_records').select(cols).eq('deleted', false).order('coll').order('id').range(from, from+999);
      if(error) throw error; out.push(...data); if(data.length<1000) return out;
    }
  },
  async loadAll(){
    const rows = await this.liveRows('coll,data');
    const { data: meta, error } = await this.sb.from('cc_meta').select('key,value'); if(error) throw error;
    if(!rows.length && !meta.length) return null;
    const base = freshDb(), db = { app: APP_ID, schema: SCHEMA, colls: {} };
    META_KEYS.forEach(k => { const m = meta.find(x => x.key===k); db[k] = m ? m.value : base[k]; });
    db.settings = {...db.settings, utente: this.nome}; // chi modifica = il membro collegato
    COLLS.forEach(c => db.colls[c] = []);
    rows.forEach(r => (db.colls[r.coll] = db.colls[r.coll] || []).push(r.data));
    return db;
  },
  async saveMeta(db){
    try{
      const { utente, ...settings } = db.settings || {};
      const { error } = await this.sb.from('cc_meta').upsert([{key:'meta', value:db.meta}, {key:'settings', value:settings}, {key:'immobile', value:db.immobile||{}}]);
      if(error) throw error; this.err = ''; return true;
    }catch(e){ return this.fail(e); }
  },
  async put(coll, rec, db){
    try{
      const { error } = await this.sb.from('cc_records').upsert({coll, id:rec.id, data:rec, deleted:false}); if(error) throw error;
      return this.saveMeta(db);
    }catch(e){ return this.fail(e); }
  },
  async del(coll, id, db){
    try{
      const { error } = await this.sb.from('cc_records').update({deleted:true}).eq('coll', coll).eq('id', id); if(error) throw error;
      return this.saveMeta(db);
    }catch(e){ return this.fail(e); }
  },
  /* Import di un backup: scrive tutti i record e segna come eliminati quelli che non ci sono più. */
  async saveAll(db){
    try{
      const rows = [], keep = new Set();
      COLLS.forEach(c => (db.colls[c]||[]).forEach(r => { rows.push({coll:c, id:r.id, data:r, deleted:false}); keep.add(c+'\n'+r.id); }));
      for(let i=0; i<rows.length; i+=500){ const { error } = await this.sb.from('cc_records').upsert(rows.slice(i, i+500)); if(error) throw error; }
      const gone = {};
      (await this.liveRows('coll,id')).forEach(r => { if(!keep.has(r.coll+'\n'+r.id)) (gone[r.coll] = gone[r.coll] || []).push(r.id); });
      for(const [c, ids] of Object.entries(gone)){
        for(let i=0; i<ids.length; i+=200){ const { error } = await this.sb.from('cc_records').update({deleted:true}).eq('coll', c).in('id', ids.slice(i, i+200)); if(error) throw error; }
      }
      return this.saveMeta(db);
    }catch(e){ return this.fail(e); }
  }
};
const isShared = () => Repo.adapter === SupabaseAdapter;

let DB = null;
let saveOk = true;

function clone(o){ return JSON.parse(JSON.stringify(o)); }
function nowIso(){ return new Date().toISOString(); }
function todayIso(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function newId(prefix){ return prefix+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

function freshDb(){
  const colls = {};
  COLLS.forEach(c => colls[c] = clone(SEED[c]).map(r => ({...r, _seed:true})));
  return {
    app: APP_ID, schema: SCHEMA,
    meta: { seedVersion: SEED_VERSION, created: nowIso(), updated: nowIso(), lastBackup: null, changesSinceBackup: 0, deletedSeed: [] },
    settings: { docBase: '', quotaBelotti: 50, utente: '' },
    immobile: clone(SEED.immobile),
    colls
  };
}
/* Aggiorna i dati di riferimento quando la pagina viene ripubblicata con un seed più nuovo:
   aggiunge i record nuovi e sostituisce quelli di riferimento mai modificati. */
function upgradeSeed(db){
  if((db.meta.seedVersion||0) >= SEED_VERSION) return db;
  const deleted = new Set(db.meta.deletedSeed||[]);
  COLLS.forEach(c => {
    const list = db.colls[c] = db.colls[c] || [];
    SEED[c].forEach(sr => {
      if(deleted.has(sr.id)) return;
      const i = list.findIndex(r => r.id===sr.id);
      if(i<0) list.push({...clone(sr), _seed:true});
      else if(!list[i]._mod) list[i] = {...clone(sr), _seed:true};
    });
  });
  db.immobile = clone(SEED.immobile);
  db.meta.seedVersion = SEED_VERSION;
  return db;
}

const Repo = {
  adapter: LocalAdapter,
  async init(){
    this.adapter.test();
    let d = await this.adapter.loadAll();
    if(!d || d.app!==APP_ID){ d = freshDb(); DB = d; saveOk = await this.adapter.saveAll(d); }
    else {
      COLLS.forEach(c => { d.colls[c] = d.colls[c] || []; }); d.settings = {docBase:'', quotaBelotti:50, utente:'', ...(d.settings||{})};
      const v = d.meta.seedVersion||0; DB = upgradeSeed(d);
      // riscrive tutto solo se il seed è cambiato: con Supabase non sovrascrive le modifiche degli altri
      saveOk = DB.meta.seedVersion!==v || !isShared() ? await this.adapter.saveAll(DB) : true;
    }
  },
  list(c){ return DB.colls[c] || []; },
  get(c, id){ return this.list(c).find(r => r.id===id); },
  touch(){ DB.meta.updated = nowIso(); DB.meta.changesSinceBackup = (DB.meta.changesSinceBackup||0)+1; },
  async put(c, rec){
    const list = this.list(c);
    rec._upd = nowIso(); if(DB.settings.utente) rec._by = DB.settings.utente;
    const i = list.findIndex(r => r.id===rec.id);
    if(i>=0){ if(list[i]._seed) rec._mod = true; list[i] = rec; } else list.push(rec);
    this.touch(); saveOk = await this.adapter.put(c, rec, DB); renderStatus(); return rec;
  },
  async del(c, id){
    const list = this.list(c); const i = list.findIndex(r => r.id===id); if(i<0) return;
    if(list[i]._seed){ DB.meta.deletedSeed = DB.meta.deletedSeed||[]; DB.meta.deletedSeed.push(id); }
    list.splice(i,1); this.touch(); saveOk = await this.adapter.del(c, id, DB); renderStatus();
  },
  async saveMeta(){ saveOk = await this.adapter.saveMeta(DB); renderStatus(); },
  async replaceAll(d){ DB = d; saveOk = await this.adapter.saveAll(DB); renderStatus(); }
};

/* ---------- utilità ---------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eur = c => (c===null || c===undefined || c==='' || isNaN(c)) ? '—' : (c/100).toLocaleString('it-IT',{style:'currency',currency:'EUR'});
const eur0 = c => (c===null || c===undefined || isNaN(c)) ? '—' : (c/100).toLocaleString('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0});
const MESI = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
function fmtDate(s, testo){
  if(testo) return testo;
  if(!s) return '';
  if(s==='?') return 'data da recuperare';
  const m = String(s).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if(!m) return s;
  if(m[3]) return m[3]+'/'+m[2]+'/'+m[1];
  if(m[2]) return MESI[+m[2]-1]+' '+m[1];
  return m[1];
}
function parseMoney(v){
  if(v===null || v===undefined) return null;
  let s = String(v).trim().replace(/[€\s]/g,'');
  if(!s) return null;
  if(s.includes(',')) s = s.replace(/\./g,'').replace(',','.');
  const n = Number(s);
  return isFinite(n) ? Math.round(n*100) : NaN;
}
const moneyInput = c => (c===null || c===undefined || c==='') ? '' : (c/100).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
const RAMI = { belotti:'Belotti', pasinetti:'Pasinetti', comune:'Comune' };
const ramoPill = r => r && RAMI[r] ? `<span class="pill ${r}">${RAMI[r]}</span>` : '';
const slug = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const stPill = s => s ? `<span class="pill st-${slug(s)}">${esc(s)}</span>` : '';
function subsList(str){ return String(str||'').split(/[^0-9]+/).filter(Boolean); }
function hasSub(str, sub){ return subsList(str).includes(String(sub)); }
function sortKey(d){ return d ? String(d) : '9999'; }

function quote(spesa){
  if(spesa.ramo==='belotti') return {b:100, p:0};
  if(spesa.ramo==='pasinetti') return {b:0, p:100};
  const b = (spesa.quotaBelotti===null || spesa.quotaBelotti===undefined || spesa.quotaBelotti==='') ? (DB.settings.quotaBelotti??50) : +spesa.quotaBelotti;
  return {b, p:100-b};
}
function docHref(d){
  if(!d) return '';
  const base = (DB.settings.docBase||'').trim();
  if(base && d.percorso) return base.replace(/\/+$/,'') + '/' + d.percorso.split('/').map(encodeURIComponent).join('/');
  return d.url || '';
}

let toastTimer;
function toast(msg){
  let t = $('#toast');
  if(!t){ t = document.createElement('div'); t.id='toast'; t.className='toast'; t.setAttribute('role','status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}
async function copyText(text, btn){
  try{ await navigator.clipboard.writeText(text); toast('Copiato: '+text); }
  catch(e){
    const v = btn && btn.closest('.contact') ? btn.closest('.contact').querySelector('.v') : null;
    if(v){ const r=document.createRange(); r.selectNodeContents(v); const s=getSelection(); s.removeAllRanges(); s.addRange(r); toast('Testo selezionato: copialo con Ctrl+C'); }
    else toast('Copia non disponibile qui');
  }
}

/* ---------- schemi dei moduli ---------- */
const CAT_SPESE = ['Professionisti e pratiche','Notaio e atti','Imposte e tasse','Lavori','Manutenzione','Utenze','Assicurazione','Arredi e impianti','Altro'];
const RAMO_OPTS = [['belotti','Belotti (piano terra)'],['pasinetti','Pasinetti (piano primo)'],['comune','Comune (ripartita)']];
const SCHEMAS = {
  spese: { label:'spesa', prefix:'s', fields:[
    {k:'data', label:'Data', type:'date', req:true},
    {k:'totale', label:'Importo totale (€)', type:'money', req:true, help:'IVA compresa'},
    {k:'descrizione', label:'Descrizione', type:'text', req:true, wide:true},
    {k:'categoria', label:'Categoria', type:'select', opts:CAT_SPESE},
    {k:'fornitore', label:'Fornitore', type:'text', list:'dl-fornitori'},
    {k:'ramo', label:'A carico di', type:'select', opts:RAMO_OPTS},
    {k:'quotaBelotti', label:'Quota Belotti % (se comune)', type:'number', min:0, max:100, help:'Il resto va a Pasinetti'},
    {k:'pagatoDa', label:'Pagato da', type:'text', list:'dl-persone'},
    {k:'iva', label:'di cui IVA (€)', type:'money'},
    {k:'detraibile', label:'Detraibile', type:'select', opts:[['no','No'],['si','Sì']]},
    {k:'bonus', label:'Bonus / detrazione', type:'text', help:'Es. ristrutturazione 50%'},
    {k:'documentoId', label:'Documento collegato', type:'doc'},
    {k:'daVerificare', label:'Da verificare', type:'check'},
    {k:'note', label:'Note', type:'textarea', wide:true}
  ]},
  preventivi: { label:'preventivo', prefix:'v', fields:[
    {k:'data', label:'Data', type:'date', req:true},
    {k:'fornitore', label:'Fornitore', type:'text', req:true, list:'dl-fornitori'},
    {k:'oggetto', label:'Oggetto', type:'text', req:true, wide:true},
    {k:'importo', label:'Importo (€)', type:'money', req:true, help:'Per una stima: il minimo'},
    {k:'importoMax', label:'Importo massimo (€)', type:'money', help:'Solo per le stime a forbice'},
    {k:'iva', label:'IVA', type:'select', opts:[['esclusa','IVA esclusa'],['inclusa','IVA inclusa']]},
    {k:'stato', label:'Stato', type:'select', opts:['ricevuto','in valutazione','accettato','scartato','stima']},
    {k:'categoria', label:'Categoria', type:'select', opts:CAT_SPESE},
    {k:'ramo', label:'A carico di', type:'select', opts:RAMO_OPTS},
    {k:'quotaBelotti', label:'Quota Belotti % (se comune)', type:'number', min:0, max:100},
    {k:'documentoId', label:'Documento collegato', type:'doc'},
    {k:'note', label:'Note', type:'textarea', wide:true}
  ]},
  soggetti: { label:'contatto', prefix:'p', fields:[
    {k:'nome', label:'Nome', type:'text', req:true, wide:true},
    {k:'gruppo', label:'Gruppo', type:'select', opts:['Proprietari e famiglia','Professionisti','Fornitori','Uffici','Storici']},
    {k:'ramo', label:'Riguarda', type:'select', opts:[['comune','Entrambe / comune'],['belotti','Belotti'],['pasinetti','Pasinetti']]},
    {k:'ruolo', label:'Ruolo', type:'text', wide:true},
    {k:'cellulare', label:'Cellulare', type:'tel'},
    {k:'telefono', label:'Telefono', type:'tel'},
    {k:'email', label:'Email', type:'email'},
    {k:'sito', label:'Sito web', type:'url'},
    {k:'indirizzo', label:'Indirizzo', type:'text', wide:true},
    {k:'note', label:'Note', type:'textarea', wide:true}
  ]},
  eventi: { label:'evento', prefix:'e', fields:[
    {k:'data', label:'Data', type:'text', help:'AAAA-MM-GG, AAAA-MM o AAAA'},
    {k:'dataTesto', label:'Data come testo', type:'text', help:'Facoltativo, es. "prima del 1960"'},
    {k:'titolo', label:'Titolo', type:'text', req:true, wide:true},
    {k:'tipo', label:'Tipo', type:'select', opts:['Atto','Catasto','Urbanistica','Lavori','Famiglia','Spesa','Previsto']},
    {k:'stato', label:'Stato', type:'select', opts:[['avvenuto','Avvenuto'],['previsto','In programma']]},
    {k:'ramo', label:'Riguarda', type:'select', opts:[['comune','Entrambe / comune'],['belotti','Belotti'],['pasinetti','Pasinetti']]},
    {k:'subs', label:'Subalterni', type:'text', help:'Es. 704, 705'},
    {k:'descrizione', label:'Descrizione', type:'textarea', wide:true},
    {k:'riferimento', label:'Riferimento (atto, pratica, protocollo)', type:'text', wide:true}
  ]},
  documenti: { label:'documento', prefix:'d', fields:[
    {k:'titolo', label:'Titolo', type:'text', req:true, wide:true},
    {k:'data', label:'Data', type:'text', help:'AAAA-MM-GG, AAAA-MM o AAAA'},
    {k:'categoria', label:'Categoria', type:'select', opts:['Atti e titoli','Catasto','Urbanistica','Progetti e disegni','Fatture e ricevute','Preventivi','Foto','Analisi','Altro']},
    {k:'ramo', label:'Riguarda', type:'select', opts:[['comune','Entrambe / comune'],['belotti','Belotti'],['pasinetti','Pasinetti']]},
    {k:'subs', label:'Subalterni', type:'text'},
    {k:'contenuto', label:'Contenuto', type:'text', wide:true},
    {k:'url', label:'Link attuale (Drive o altro)', type:'url', wide:true},
    {k:'percorso', label:'Percorso nell\'archivio (NAS)', type:'text', wide:true, help:'Relativo alla cartella documenti, es. Catasto/2022 Visura.pdf'},
    {k:'note', label:'Note', type:'textarea', wide:true}
  ]},
  criticita: { label:'criticità', prefix:'c', fields:[
    {k:'titolo', label:'Titolo', type:'text', req:true, wide:true},
    {k:'stato', label:'Stato', type:'select', opts:['aperta','in corso','risolta']},
    {k:'priorita', label:'Priorità', type:'select', opts:['alta','media','bassa']},
    {k:'ramo', label:'Riguarda', type:'select', opts:[['comune','Entrambe / comune'],['belotti','Belotti'],['pasinetti','Pasinetti']]},
    {k:'subs', label:'Subalterni', type:'text'},
    {k:'descrizione', label:'Problema', type:'textarea', wide:true},
    {k:'azione', label:'Cosa fare', type:'textarea', wide:true},
    {k:'chi', label:'Chi', type:'text'},
    {k:'note', label:'Note e aggiornamenti', type:'textarea', wide:true}
  ]},
  checklist: { label:'documento da procurare', prefix:'k', fields:[
    {k:'titolo', label:'Documento', type:'text', req:true, wide:true},
    {k:'perche', label:'A cosa serve', type:'text', wide:true},
    {k:'stato', label:'Stato', type:'select', opts:['da procurare','richiesto','ottenuto']},
    {k:'note', label:'Note', type:'textarea', wide:true}
  ]},
  quote: { label:'riga di proprietà', prefix:'q', fields:[
    {k:'ramo', label:'Ramo', type:'select', opts:[['belotti','Belotti'],['pasinetti','Pasinetti'],['comune','Comune']]},
    {k:'subs', label:'Subalterni', type:'text'},
    {k:'soggetto', label:'Intestatario', type:'text', req:true, list:'dl-persone'},
    {k:'diritto', label:'Diritto', type:'select', opts:['Proprietà','Nuda proprietà','Usufrutto','Comproprietà','Comodato d\'uso','Locazione']},
    {k:'quota', label:'Quota', type:'text', help:'Es. 1/1, 1/2'},
    {k:'dal', label:'Dal', type:'text', help:'AAAA-MM-GG, oppure ? se ignota'},
    {k:'al', label:'Al', type:'text', help:'Vuoto se ancora in corso'},
    {k:'atto', label:'Atto', type:'text', wide:true},
    {k:'note', label:'Note', type:'textarea', wide:true}
  ]},
  subalterni: { label:'subalterno', prefix:'sub', fields:[
    {k:'sub', label:'Numero', type:'text', req:true},
    {k:'ramo', label:'Ramo', type:'select', opts:[['belotti','Belotti'],['pasinetti','Pasinetti'],['comune','Comune']]},
    {k:'piano', label:'Piano', type:'text'},
    {k:'stato', label:'Stato', type:'select', opts:['attivo','soppresso']},
    {k:'descrizione', label:'Descrizione', type:'text', wide:true},
    {k:'categoria', label:'Categoria', type:'text'},
    {k:'consistenza', label:'Consistenza', type:'text'},
    {k:'superficie', label:'Superficie catastale', type:'text'},
    {k:'rendita', label:'Rendita (€)', type:'money'},
    {k:'dettagli', label:'Dettagli', type:'text', wide:true},
    {k:'origine', label:'Ultimo atto catastale', type:'text', wide:true},
    {k:'note', label:'Note', type:'textarea', wide:true}
  ]}
};

/* ---------- dialog generico ---------- */
const dlg = () => $('#dlg');
let dlgCtx = null;
function fieldHtml(f, v){
  const id = 'f-'+f.k;
  const req = f.req ? ' required' : '';
  let input;
  if(f.type==='select'){
    input = `<select id="${id}" name="${f.k}">${f.opts.map(o => { const [val,lab] = Array.isArray(o)?o:[o,o]; return `<option value="${esc(val)}"${String(v??'')===String(val)?' selected':''}>${esc(lab)}</option>`; }).join('')}</select>`;
  } else if(f.type==='textarea'){
    input = `<textarea id="${id}" name="${f.k}">${esc(v)}</textarea>`;
  } else if(f.type==='check'){
    return `<label class="f" style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" id="${id}" name="${f.k}"${v?' checked':''}> ${esc(f.label)}</label>`;
  } else if(f.type==='doc'){
    const docs = Repo.list('documenti').slice().sort((a,b)=>sortKey(b.data).localeCompare(sortKey(a.data)));
    input = `<select id="${id}" name="${f.k}"><option value="">Nessuno</option>${docs.map(d => `<option value="${esc(d.id)}"${v===d.id?' selected':''}>${esc(fmtDate(d.data))} · ${esc(d.titolo)}</option>`).join('')}</select>`;
  } else if(f.type==='spesa'){
    const sp = Repo.list('spese').slice().sort((a,b)=>sortKey(b.data).localeCompare(sortKey(a.data)));
    input = `<select id="${id}" name="${f.k}"><option value="">Nessuna</option>${sp.map(s => `<option value="${esc(s.id)}"${v===s.id?' selected':''}>${esc(fmtDate(s.data))} · ${esc(s.descrizione)} · ${esc(eur(s.totale))}</option>`).join('')}</select>`;
  } else if(f.type==='money'){
    input = `<input id="${id}" name="${f.k}" inputmode="decimal" placeholder="0,00" value="${esc(moneyInput(v))}"${req}>`;
  } else {
    const t = f.type==='date' ? 'date' : f.type==='number' ? 'number' : f.type==='tel' ? 'tel' : f.type==='email' ? 'email' : f.type==='url' ? 'url' : 'text';
    const val = (t==='date' && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) ? '' : v;
    input = `<input id="${id}" name="${f.k}" type="${t}" value="${esc(val)}"${f.min!==undefined?` min="${f.min}"`:''}${f.max!==undefined?` max="${f.max}"`:''}${f.list?` list="${f.list}"`:''}${req}>`;
    if(t==='date' && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) input += `<small class="muted">Data attuale: ${esc(fmtDate(v))}. Lasciala vuota per non cambiarla.</small>`;
  }
  return `<label class="f${f.wide?' wide':''}" for="${id}">${esc(f.label)}${f.help?` <small>${esc(f.help)}</small>`:''}${input}</label>`;
}
function datalists(){
  const fornitori = new Set(); const persone = new Set(Repo.list('quote').map(q => q.soggetto).filter(Boolean));
  Repo.list('soggetti').forEach(s => { if(['Professionisti','Fornitori','Uffici'].includes(s.gruppo)) fornitori.add(s.nome); else if(s.gruppo!=='Storici') persone.add(s.nome); });
  Repo.list('spese').forEach(s => { if(s.fornitore) fornitori.add(s.fornitore); if(s.pagatoDa) persone.add(s.pagatoDa); });
  Repo.list('preventivi').forEach(s => { if(s.fornitore) fornitori.add(s.fornitore); });
  const dl = (id, set) => `<datalist id="${id}">${[...set].map(v=>`<option value="${esc(v)}"></option>`).join('')}</datalist>`;
  return dl('dl-fornitori', fornitori) + dl('dl-persone', persone);
}
function openForm(coll, rec, opts={}){
  const sc = SCHEMAS[coll];
  const isNew = !rec;
  const data = rec ? clone(rec) : {...(opts.preset||{})};
  dlgCtx = { coll, id: rec ? rec.id : null, data, onSaved: opts.onSaved };
  const title = opts.title || (isNew ? 'Nuovo '+sc.label : 'Modifica '+sc.label);
  dlg().innerHTML = `<form class="dlg" id="dlg-form" novalidate>
    <header><h3>${esc(title)}</h3><button type="button" class="ghost" data-act="dlg-close" aria-label="Chiudi">Chiudi</button></header>
    <div class="body">${opts.intro?`<p class="muted small">${opts.intro}</p>`:''}<div class="form-grid">${sc.fields.map(f => fieldHtml(f, data[f.k])).join('')}</div>${datalists()}<p class="err" id="dlg-err" hidden></p></div>
    <footer><div class="actions">${!isNew?`<button type="button" class="danger" data-act="dlg-del">Elimina</button>`:''}</div>
    <div class="actions"><button type="button" data-act="dlg-close">Annulla</button><button type="submit" class="primary">${isNew?'Aggiungi':'Salva'}</button></div></footer>
  </form>`;
  dlg().showModal();
  const first = dlg().querySelector('input:not([type=checkbox]),select,textarea'); if(first) first.focus();
}
function readForm(coll, base){
  const sc = SCHEMAS[coll]; const out = {...base}; const errs = [];
  sc.fields.forEach(f => {
    const el = $('#f-'+f.k); if(!el) return;
    let v;
    if(f.type==='check') v = el.checked;
    else if(f.type==='money'){ v = parseMoney(el.value); if(Number.isNaN(v)){ errs.push(f.label+': importo non valido (es. 1.250,00)'); v = null; } }
    else if(f.type==='number'){ v = el.value==='' ? null : Number(el.value); }
    else if(f.type==='date'){ v = el.value || base[f.k] || ''; }
    else v = el.value.trim();
    if(f.req && (v===null || v==='' )) errs.push(f.label+' è obbligatorio');
    out[f.k] = v;
  });
  return {out, errs};
}
async function submitForm(){
  const {coll, id, data, onSaved} = dlgCtx;
  const {out, errs} = readForm(coll, data);
  if(errs.length){ const e=$('#dlg-err'); e.textContent = errs.join('. '); e.hidden=false; return; }
  if(!id) out.id = newId(SCHEMAS[coll].prefix); else out.id = id;
  await Repo.put(coll, out);
  dlg().close();
  toast(id ? 'Modifiche salvate' : 'Aggiunto');
  if(onSaved) await onSaved(out);
  render();
}

/* ---------- stato salvataggio ---------- */
function backupAgeDays(){ if(!DB.meta.lastBackup) return null; return Math.floor((Date.now()-new Date(DB.meta.lastBackup).getTime())/86400000); }
function renderStatus(){
  const el = $('#save-state'); if(!el) return;
  if(isShared()){ el.innerHTML = saveOk ? '<i class="dot"></i>Salvato su Supabase' : '<i class="dot bad"></i>Non salvato su Supabase'; return; }
  if(!LocalAdapter.ok || !saveOk){ el.innerHTML = '<i class="dot bad"></i>Non salvato nel browser'; return; }
  const n = DB.meta.changesSinceBackup||0;
  el.innerHTML = n ? `<i class="dot warn"></i>${n} modific${n===1?'a':'he'} senza backup` : '<i class="dot"></i>Salvato nel browser';
}
function backupBanner(){
  if(isShared()) return saveOk ? '' : `<div class="banner bad"><p><b>L'ultima modifica non è stata salvata su Supabase.</b> ${esc(SupabaseAdapter.err)} Ricarica la pagina prima di continuare.</p><button type="button" class="primary" data-nav="dati">Vedi lo stato</button></div>`;
  if(!LocalAdapter.ok || !saveOk) return `<div class="banner bad"><p><b>La memoria del browser non è disponibile.</b> Le modifiche restano solo finché la pagina è aperta. Esporta un backup prima di chiuderla.</p><button type="button" class="primary" data-nav="dati">Vai al backup</button></div>`;
  const n = DB.meta.changesSinceBackup||0; const age = backupAgeDays();
  if(n===0) return '';
  const when = age===null ? 'Non hai ancora esportato un backup.' : `Ultimo backup ${age===0?'oggi':age===1?'ieri':age+' giorni fa'}.`;
  return `<div class="banner"><p><b>${n} modific${n===1?'a':'he'} solo in questo browser.</b> ${when} I dati inseriti qui non arrivano agli altri dispositivi finché non passiamo al NAS.</p><button type="button" data-nav="dati">Esporta backup</button></div>`;
}

/* ---------- viste ---------- */
const TABS = [
  ['panoramica','Panoramica'],['subalterni','Subalterni'],['proprieta','Proprietà'],['storia','Storia'],
  ['persone','Persone'],['documenti','Documenti'],['criticita','Criticità'],['spese','Spese'],['preventivi','Preventivi'],['scadenze','Scadenze'],['detrazioni','Detrazioni'],['dati','Dati e backup']
];
let route = 'panoramica';
let selSub = '704';
const UI = { storiaRamo:'tutte', storiaTipo:'', personeQ:'', docQ:'', docCat:'', docRamo:'', critStato:'aperte', speseAnno:'', speseCat:'', speseRamo:'', spesePag:'' };

function currentHolders(ramo){
  return Repo.list('quote').filter(q => q.ramo===ramo && !q.al && q.diritto!=='Comodato d\'uso' && q.diritto!=='Locazione');
}
function previsti(){ return Repo.list('eventi').filter(e => e.stato==='previsto'); }

function viewPanoramica(){
  const subs = Repo.list('subalterni').filter(s => s.stato==='attivo');
  const ownerCard = ramo => {
    const ORD = ['704','702','705','4','703','2','706','701'];
    const list = subs.filter(s => s.ramo===ramo).sort((a,b)=>((ORD.indexOf(a.sub)+99)%99)-((ORD.indexOf(b.sub)+99)%99));
    const holders = currentHolders(ramo);
    const uso = Repo.list('quote').filter(q => q.ramo===ramo && !q.al && (q.diritto==='Comodato d\'uso' || q.diritto==='Locazione'));
    const next = previsti().filter(e => e.ramo===ramo);
    const name = ramo==='comune' ? 'Parti comuni' : (holders.map(h=>h.soggetto).join(', ') || 'Intestatario da verificare');
    const sub = ramo==='comune' ? 'di entrambi, metà ciascuno' : holders.map(h => `${h.diritto.toLowerCase()} ${h.quota}`).join(' · ') + (uso.length ? ' · ' + uso.map(u => `${u.diritto.toLowerCase()} a ${u.soggetto}`).join(', ') : '');
    return `<div class="owner ${ramo}"><div class="eyebrow">${RAMI[ramo]}</div><h3>${esc(name)}<small>${esc(sub)}</small></h3>
      <ul>${list.map(s => `<li><button type="button" class="linkish mono" data-act="pick-sub" data-sub="${esc(s.sub)}">${esc(s.sub)}</button><span>${esc(s.descrizione.split(':')[0])}${s.consistenza&&s.consistenza!=='—'?', '+esc(s.consistenza):''}</span></li>`).join('')}</ul>
      ${ramo!=='comune'?'<div class="foot">Più la metà delle parti comuni 701 e 706.</div>':'<div class="foot">Anche tetto, facciate e struttura sono comuni (art. 1117 c.c.).</div>'}
      ${next.length?`<div class="next"><b>In programma</b>${next.map(e=>esc(e.titolo)).join('<br>')}</div>`:''}</div>`;
  };
  const year = String(new Date().getFullYear());
  const spese = Repo.list('spese');
  const tot = spese.reduce((a,s)=>a+(s.totale||0),0);
  const totYear = spese.filter(s => String(s.data||'').startsWith(year)).reduce((a,s)=>a+(s.totale||0),0);
  const prevAperti = Repo.list('preventivi').filter(p => ['ricevuto','in valutazione'].includes(p.stato));
  const prevTot = prevAperti.reduce((a,p)=>a+(p.importo||0),0);
  const crit = Repo.list('criticita').filter(c => c.stato!=='risolta');
  const critAlte = crit.filter(c => c.priorita==='alta');
  const daProc = Repo.list('checklist').filter(k => k.stato!=='ottenuto');
  const lastSpese = spese.slice().sort((a,b)=>sortKey(b.data).localeCompare(sortKey(a.data))).slice(0,5);
  const im = DB.immobile;
  return `
  <section class="hero">
    <div class="eyebrow">${esc(im.indirizzo)}</div>
    <h1>Casa Carobbio</h1>
    <div class="meta"><span>Catasto fabbricati <b>${esc(im.catastoFabbricati)}</b></span><span>Lotto <b>${esc(im.lotto)}</b></span><span>${esc(im.exMappale)}</span></div>
    <p class="lead">Un fabbricato su quattro livelli diviso dal 1965 tra due proprietà: piano terra (Belotti) e piano primo (Pasinetti), con giardino, scala e sottotetto in comune.</p>
  </section>
  ${backupBanner()}
  <section><div class="head"><h2>Chi possiede cosa oggi</h2><button type="button" data-nav="proprieta">Storico proprietà</button></div>
    <div class="grid3">${ownerCard('belotti')}${ownerCard('pasinetti')}${ownerCard('comune')}</div></section>
  <section class="kpis">
    <button type="button" class="kpi" data-nav="criticita"><span class="l">Criticità aperte</span><span class="v">${crit.length}</span><span class="s">${critAlte.length} ad alta priorità</span></button>
    <button type="button" class="kpi" data-nav="documenti"><span class="l">Documenti da procurare</span><span class="v">${daProc.length}</span><span class="s">su ${Repo.list('checklist').length} in elenco</span></button>
    <button type="button" class="kpi" data-nav="spese"><span class="l">Spese registrate</span><span class="v">${eur0(tot)}</span><span class="s">${eur0(totYear)} nel ${year}</span></button>
    <button type="button" class="kpi" data-nav="preventivi"><span class="l">Preventivi da decidere</span><span class="v">${eur0(prevTot)}</span><span class="s">${prevAperti.length} preventiv${prevAperti.length===1?'o':'i'}, IVA come da preventivo</span></button>
  </section>
  ${typeof panScadenze==='function' ? panScadenze() : ''}
  <div class="grid2">
    <section><div class="head"><h2>Priorità aperte</h2><button type="button" data-nav="criticita">Tutte</button></div>
      <div class="list">${critAlte.length ? critAlte.map(c => `<div class="row"><div><div class="t">${esc(c.titolo)}</div><div class="d">${esc(c.azione)}</div></div><div class="side">${stPill(c.stato)}</div></div>`).join('') : '<div class="empty">Nessuna criticità ad alta priorità aperta.</div>'}</div></section>
    <section><div class="head"><h2>Ultime spese</h2><button class="primary" data-act="add" data-coll="spese">Aggiungi spesa</button></div>
      <div class="list">${lastSpese.length ? lastSpese.map(s => `<div class="row"><div><div class="t">${esc(s.descrizione)}</div><div class="d">${esc(fmtDate(s.data))} · ${esc(s.fornitore||s.categoria)}</div></div><div class="side"><span class="mono num">${eur(s.totale)}</span>${ramoPill(s.ramo)}</div></div>`).join('') : '<div class="empty">Ancora nessuna spesa.</div>'}</div></section>
  </div>`;
}

function subDetail(sub){
  const s = Repo.list('subalterni').find(x => x.sub===String(sub));
  if(!s) return '<div class="panel">Seleziona un subalterno dallo schema.</div>';
  const holders = s.ramo==='comune' ? [] : currentHolders(s.ramo);
  const uso = Repo.list('quote').filter(q => q.ramo===s.ramo && !q.al && q.diritto==='Comodato d\'uso' && hasSub(q.subs, s.sub));
  const docs = Repo.list('documenti').filter(d => hasSub(d.subs, s.sub));
  const crit = Repo.list('criticita').filter(c => hasSub(c.subs, s.sub) && c.stato!=='risolta');
  return `<div class="panel detail" id="sub-detail">
    <div class="head"><div><div class="eyebrow">Subalterno · piano ${esc(s.piano)}</div><div class="big">${esc(s.sub)}</div></div><div class="actions">${ramoPill(s.ramo)}${s.stato==='soppresso'?'<span class="pill neutral">soppresso</span>':''}<button class="mini" data-act="edit" data-coll="subalterni" data-id="${esc(s.id)}">Modifica</button></div></div>
    <p>${esc(s.descrizione)}</p>
    <dl class="kv">
      <dt>Categoria</dt><dd>${esc(s.categoria)}</dd>
      <dt>Consistenza</dt><dd>${esc(s.consistenza)}</dd>
      <dt>Sup. catastale</dt><dd>${esc(s.superficie)}</dd>
      <dt>Rendita</dt><dd class="num">${s.rendita!==null && s.rendita!==undefined ? eur(s.rendita) : 'nessuna'}</dd>
      ${s.dettagli?`<dt>Dettagli</dt><dd>${esc(s.dettagli)}</dd>`:''}
      <dt>Ultimo atto</dt><dd>${esc(s.origine)}</dd>
      <dt>Intestazione</dt><dd>${s.ramo==='comune' ? 'Comune ai due rami, metà ciascuno' : holders.map(h => `${esc(h.soggetto)} (${esc(h.diritto.toLowerCase())} ${esc(h.quota)})`).join(', ') || 'da verificare'}${uso.length?'<br><span class="muted">'+uso.map(u=>`In comodato a ${esc(u.soggetto)} dal ${esc(fmtDate(u.dal))}`).join('<br>')+'</span>':''}</dd>
    </dl>
    ${s.note?`<p class="small" style="color:var(--mid)">${esc(s.note)}</p>`:''}
    ${crit.length?`<div><div class="eyebrow">Criticità aperte</div><ul class="steps">${crit.map(c=>`<li><button type="button" class="linkish" data-nav="criticita">${esc(c.titolo)}</button></li>`).join('')}</ul></div>`:''}
    <div><div class="eyebrow">Documenti collegati</div>${docs.length?`<ul class="steps">${docs.map(d=>{const h=docHref(d); return `<li>${h?`<a href="${esc(h)}" target="_blank" rel="noopener">${esc(d.titolo)}</a>`:esc(d.titolo)} <span class="muted small">${esc(fmtDate(d.data))}</span></li>`;}).join('')}</ul>`:'<p class="muted small">Nessun documento collegato.</p>'}</div>
  </div>`;
}
function viewSubalterni(){
  const all = Repo.list('subalterni');
  const order = {S1:0,'T':1,'T + S1':1,'T-1':2,'1':3,'1 (e 2)':3,'T-1-2':4,'2':5};
  const rows = all.slice().sort((a,b) => (a.stato===b.stato?0:a.stato==='attivo'?-1:1) || ((order[a.piano]??9)-(order[b.piano]??9)) || a.sub.localeCompare(b.sub,undefined,{numeric:true}));
  const rB = all.filter(s=>s.ramo==='belotti'&&s.stato==='attivo').reduce((a,s)=>a+(s.rendita||0),0);
  const rP = all.filter(s=>s.ramo==='pasinetti'&&s.stato==='attivo').reduce((a,s)=>a+(s.rendita||0),0);
  return `
  <section><div class="head"><div><div class="eyebrow">${esc(DB.immobile.catastoFabbricati)}</div><h2>Subalterni e planimetrie</h2></div>
    <div class="legend"><span><i class="sw belotti"></i>Belotti</span><span><i class="sw pasinetti"></i>Pasinetti</span><span><i class="sw comune"></i>Comune</span></div></div>
    <p class="muted">Tocca una parte della casa per vedere i dati catastali, chi la possiede e i documenti collegati. Schemi non in scala, semplificati dall'elaborato planimetrico 2022.</p>
  </section>
  <div class="subwrap">
    <div style="display:grid;gap:12px;min-width:0">
      <div class="fig"><div class="eyebrow">Sezione per piani</div><div class="scroll">${SVG_SECTION}</div></div>
      <div class="plans">${SVG_PLANS.map(p => `<figure class="plan">${p.svg}<figcaption>${esc(p.cap)}</figcaption></figure>`).join('')}</div>
    </div>
    ${subDetail(selSub)}
  </div>
  <section><div class="head"><h2>Tutti i dati catastali</h2><button data-act="add" data-coll="subalterni">Aggiungi subalterno</button></div>
  <div class="table"><table>
    <thead><tr><th>Sub</th><th>Piano</th><th>Cos'è</th><th>Categoria</th><th>Consistenza</th><th class="n">Sup. cat.</th><th class="n">Rendita</th><th>Ramo</th></tr></thead>
    <tbody>${rows.map(s => `<tr class="click ${s.ramo}${s.stato!=='attivo'?' gone':''}" data-act="pick-sub" data-sub="${esc(s.sub)}"><td class="sub">${esc(s.sub)}</td><td>${esc(s.piano)}</td><td>${esc(s.descrizione)}${s.stato!=='attivo'?`<small>${esc(s.note)}</small>`:''}</td><td>${esc(s.categoria)}</td><td>${esc(s.consistenza)}</td><td class="n">${esc(s.superficie)}</td><td class="n">${s.rendita!=null?eur(s.rendita):'—'}</td><td>${s.stato==='attivo'?ramoPill(s.ramo):'<span class="pill neutral">soppresso</span>'}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="6">Rendite totali</td><td class="n" colspan="2">Belotti ${eur(rB)} · Pasinetti ${eur(rP)}</td></tr></tfoot>
  </table></div></section>`;
}

function viewProprieta(){
  const q = Repo.list('quote');
  const block = ramo => {
    const rows = q.filter(r => r.ramo===ramo).sort((a,b) => {
      const ka = a.dal==='?' ? (a.al && a.al!=='?' ? a.al : '9998') : a.dal; const kb = b.dal==='?' ? (b.al && b.al!=='?' ? b.al : '9998') : b.dal;
      return String(ka).localeCompare(String(kb));
    });
    return `<section><div class="head"><h3>${ramoPill(ramo)} ${ramo==='comune'?'Parti comuni':'Ramo '+RAMI[ramo]}</h3></div>
    <div class="table"><table><thead><tr><th>Intestatario</th><th>Diritto</th><th>Subalterni</th><th>Dal</th><th>Al</th><th>Atto</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr class="${r.al?'gone':''}"><td><b>${esc(r.soggetto)}</b>${r.note?`<small>${esc(r.note)}</small>`:''}</td><td>${esc(r.diritto)}${r.quota?` <span class="muted">${esc(r.quota)}</span>`:''}${!r.al?' <span class="pill st-accettato">in corso</span>':''}</td><td class="mono small">${esc(r.subs)}</td><td class="num">${esc(fmtDate(r.dal))}</td><td class="num">${r.al?esc(fmtDate(r.al)):'—'}</td><td class="small">${esc(r.atto)}</td><td><button class="mini ghost" data-act="edit" data-coll="quote" data-id="${esc(r.id)}">Modifica</button></td></tr>`).join('')}
    </tbody></table></div></section>`;
  };
  const prev = previsti().filter(e => /donazione|acquista|vend/i.test(e.titolo));
  return `
  <section><div class="head"><div><h2>Proprietà nel tempo</h2><p class="muted">Ogni riga è un intestatario con il suo diritto e il periodo in cui lo ha avuto. Un cambio di proprietà chiude le righe in corso e ne apre una nuova.</p></div>
    <div class="actions"><button class="primary" data-act="cambio">Registra cambio di proprietà</button><button data-act="add" data-coll="quote">Aggiungi riga</button></div></div>
    ${prev.length?`<div class="list">${prev.map(e=>`<div class="row"><div><div class="t">${esc(e.titolo)}</div><div class="d">${esc(e.descrizione)}</div></div><div class="side"><span class="pill st-ricevuto">in programma ${esc(fmtDate(e.data))}</span>${ramoPill(e.ramo)}</div></div>`).join('')}</div>`:''}
  </section>
  ${block('belotti')}${block('pasinetti')}${block('comune')}`;
}
const subsDelRamo = ramo => Repo.list('subalterni').filter(s => s.ramo===ramo && s.stato==='attivo').map(s => s.sub).join(', ');
function openCambio(){
  dlgCtx = { coll:'cambio' };
  const opts = ['belotti','pasinetti'].map(r => [r, `${RAMI[r]} (${subsDelRamo(r)})`]);
  dlg().innerHTML = `<form class="dlg" id="cambio-form" novalidate>
    <header><h3>Registra cambio di proprietà</h3><button type="button" class="ghost" data-act="dlg-close">Chiudi</button></header>
    <div class="body"><p class="muted small">Le righe di proprietà in corso del ramo vengono chiuse alla data indicata e se ne apre una nuova. Viene aggiunto anche un evento nella storia.</p>
    <div class="form-grid">
      <label class="f" for="cb-ramo">Ramo<select id="cb-ramo">${opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>
      <label class="f" for="cb-data">Data dell'atto<input id="cb-data" type="date" value="${todayIso()}"></label>
      <label class="f wide" for="cb-sogg">Nuovo intestatario<input id="cb-sogg" list="dl-persone" placeholder="Cognome Nome"></label>
      <label class="f" for="cb-dir">Diritto<select id="cb-dir"><option>Proprietà</option><option>Nuda proprietà</option><option>Usufrutto</option></select></label>
      <label class="f" for="cb-quota">Quota<input id="cb-quota" value="1/1"></label>
      <label class="f wide" for="cb-tipo">Tipo di atto<select id="cb-tipo"><option>Donazione</option><option>Compravendita</option><option>Successione</option><option>Altro</option></select></label>
      <label class="f wide" for="cb-atto">Riferimenti dell'atto<input id="cb-atto" placeholder="Notaio, repertorio, trascrizione"></label>
      <label class="f wide" style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" id="cb-close" checked> Chiudi le righe di proprietà in corso del ramo</label>
      <label class="f wide" style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" id="cb-comodato"> Chiudi anche comodati e locazioni in corso</label>
    </div>${datalists()}<p class="err" id="cb-err" hidden></p></div>
    <footer><span></span><div class="actions"><button type="button" data-act="dlg-close">Annulla</button><button type="submit" class="primary">Registra</button></div></footer></form>`;
  dlg().showModal();
}
async function submitCambio(){
  const ramo = $('#cb-ramo').value, data = $('#cb-data').value, sogg = $('#cb-sogg').value.trim();
  const dir = $('#cb-dir').value, quotaV = $('#cb-quota').value.trim(), tipo = $('#cb-tipo').value, atto = $('#cb-atto').value.trim();
  if(!sogg || !data){ const e=$('#cb-err'); e.textContent='Indica il nuovo intestatario e la data.'; e.hidden=false; return; }
  const subs = subsDelRamo(ramo);
  const open = Repo.list('quote').filter(q => q.ramo===ramo && !q.al);
  for(const q of open){
    const isUso = q.diritto==='Comodato d\'uso' || q.diritto==='Locazione';
    if((isUso && $('#cb-comodato').checked) || (!isUso && $('#cb-close').checked)) await Repo.put('quote', {...q, al:data});
  }
  await Repo.put('quote', { id:newId('q'), ramo, subs, soggetto:sogg, diritto:dir, quota:quotaV, dal:data, al:'', atto:(tipo+(atto?': '+atto:'')), note:'' });
  await Repo.put('eventi', { id:newId('e'), data, dataTesto:'', ramo, tipo:'Atto', stato:'avvenuto', titolo:`${tipo}: ${sogg} diventa intestatario (${dir.toLowerCase()} ${quotaV})`, descrizione:'', riferimento:atto, subs });
  dlg().close(); toast('Cambio di proprietà registrato'); render();
}

function viewStoria(){
  const tipi = [...new Set(Repo.list('eventi').map(e=>e.tipo).filter(Boolean))].sort();
  let ev = Repo.list('eventi').filter(e => (UI.storiaRamo==='tutte' || e.ramo===UI.storiaRamo || e.ramo==='comune') && (!UI.storiaTipo || e.tipo===UI.storiaTipo));
  const prog = ev.filter(e => e.stato==='previsto');
  const dated = ev.filter(e => e.stato!=='previsto' && e.data).sort((a,b)=>String(a.data).localeCompare(String(b.data)));
  const undated = ev.filter(e => e.stato!=='previsto' && !e.data);
  const item = e => `<div class="tl-item ${e.ramo}${e.stato==='previsto'?' prev':''}">
    <div class="y">${esc(fmtDate(e.data, e.dataTesto))}<small>${esc(e.tipo||'')}</small></div>
    <div class="body"><h3>${esc(e.titolo)}</h3>${e.descrizione?`<p class="small">${esc(e.descrizione)}</p>`:''}${e.riferimento?`<div class="ref">${esc(e.riferimento)}</div>`:''}
      <div class="tags">${ramoPill(e.ramo)}${subsList(e.subs).map(s=>`<span class="chip">sub ${esc(s)}</span>`).join('')}</div></div>
    <div><button class="mini ghost" data-act="edit" data-coll="eventi" data-id="${esc(e.id)}">Modifica</button></div></div>`;
  const decade = y => y ? (Math.floor(+String(y).slice(0,4)/10)*10)+'' : '';
  let groups = ''; let cur = null;
  dated.forEach(e => { const d = decade(e.data); if(d!==cur){ cur=d; groups += `<div class="tl-group">Anni ${d}</div>`; } groups += item(e); });
  return `
  <section><div class="head"><div><h2>Storia della casa</h2><p class="muted">Atti, pratiche catastali e urbanistiche, lavori ed eventi di famiglia dal 1965 a oggi.</p></div><button class="primary" data-act="add" data-coll="eventi">Aggiungi evento</button></div>
    <div class="filters">
      <div class="seg" role="group" aria-label="Ramo">${[['tutte','Tutti'],['belotti','Belotti'],['pasinetti','Pasinetti']].map(([v,l])=>`<button data-act="ui" data-k="storiaRamo" data-v="${v}" aria-pressed="${UI.storiaRamo===v}">${l}</button>`).join('')}</div>
      <select id="flt-tipo" data-ui="storiaTipo" aria-label="Tipo"><option value="">Tutti i tipi</option>${tipi.map(t=>`<option${UI.storiaTipo===t?' selected':''}>${esc(t)}</option>`).join('')}</select>
    </div></section>
  ${prog.length?`<section><h3>In programma</h3><div class="tl">${prog.map(item).join('')}</div></section>`:''}
  <section><h3>Cronologia</h3><div class="tl">${groups || '<div class="empty">Nessun evento con questi filtri.</div>'}</div></section>
  ${undated.length?`<section><h3>Date da recuperare</h3><div class="tl">${undated.map(item).join('')}</div></section>`:''}`;
}

function viewPersone(){
  const q = UI.personeQ.toLowerCase();
  const all = Repo.list('soggetti').filter(s => !q || [s.nome,s.ruolo,s.note,s.email].join(' ').toLowerCase().includes(q));
  const order = ['Proprietari e famiglia','Professionisti','Fornitori','Uffici','Storici'];
  const contact = (k, v, href) => v ? `<div class="contact"><span class="k">${k}</span><span class="v">${href?`<a href="${esc(href)}"${href.startsWith('http')?' target="_blank" rel="noopener"':''}>${esc(v)}</a>`:esc(v)}</span><button class="mini ghost" data-act="copy" data-v="${esc(v)}" aria-label="Copia ${k}">Copia</button></div>` : '';
  const card = s => {
    const hasAny = s.cellulare||s.telefono||s.email;
    const showMissing = !hasAny && ['Professionisti','Fornitori'].includes(s.gruppo);
    return `<div class="person"><div class="top-line"><div><h3>${esc(s.nome)}</h3></div>${ramoPill(s.ramo)}</div>
    ${s.ruolo?`<div class="role">${esc(s.ruolo)}</div>`:''}
    <div class="contacts">${contact('Cellulare', s.cellulare, 'tel:'+String(s.cellulare).replace(/[^+0-9]/g,''))}${contact('Telefono', s.telefono, 'tel:'+String(s.telefono).replace(/[^+0-9]/g,''))}${contact('Email', s.email, 'mailto:'+s.email)}${contact('Indirizzo', s.indirizzo)}${contact('Sito', s.sito ? s.sito.replace(/^https?:\/\//,'').replace(/\/$/,'') : '', s.sito)}</div>
    ${showMissing?'<div class="missing">Recapiti da aggiungere</div>':''}
    ${s.note?`<div class="small muted">${esc(s.note)}</div>`:''}
    <div><button class="mini" data-act="edit" data-coll="soggetti" data-id="${esc(s.id)}">Modifica</button></div></div>`;
  };
  return `
  <section><div class="head"><div><h2>Persone e contatti</h2><p class="muted">Proprietari, famiglia, professionisti, fornitori e uffici. I numeri si possono copiare con un tocco.</p></div><button class="primary" data-act="add" data-coll="soggetti">Aggiungi contatto</button></div>
    <div class="filters"><input type="search" id="flt-persone" data-ui="personeQ" placeholder="Cerca per nome, ruolo, email" value="${esc(UI.personeQ)}" aria-label="Cerca"></div></section>
  ${order.map(g => { const list = all.filter(s => (s.gruppo||'Professionisti')===g); return list.length ? `<section><h3>${esc(g)} <span class="muted small">${list.length}</span></h3><div class="people">${list.map(card).join('')}</div></section>` : ''; }).join('')}
  ${all.length?'':'<div class="empty">Nessun contatto trovato.</div>'}`;
}

function viewDocumenti(){
  const q = UI.docQ.toLowerCase();
  const cats = ['Atti e titoli','Catasto','Urbanistica','Progetti e disegni','Fatture e ricevute','Preventivi','Foto','Analisi','Altro'];
  const docs = Repo.list('documenti').filter(d => (!q || [d.titolo,d.contenuto,d.note,d.subs].join(' ').toLowerCase().includes(q)) && (!UI.docCat || d.categoria===UI.docCat) && (!UI.docRamo || d.ramo===UI.docRamo || d.ramo==='comune'));
  const base = (DB.settings.docBase||'').trim();
  const row = d => { const h = docHref(d); return `<div class="row"><div><div class="t">${h?`<a href="${esc(h)}" target="_blank" rel="noopener">${esc(d.titolo)}</a>`:esc(d.titolo)}</div><div class="d">${esc(fmtDate(d.data))}${d.contenuto?' · '+esc(d.contenuto):''}</div>${d.subs?`<div class="d">${subsList(d.subs).map(s=>`<span class="chip">sub ${esc(s)}</span>`).join(' ')}</div>`:''}<div class="d mono small">${esc(d.percorso)}</div>${d.note && !/^DWG/.test(d.note)?`<div class="d">${esc(d.note)}</div>`:''}</div>
    <div class="side">${ramoPill(d.ramo)}${h?'':'<span class="pill st-da-procurare">non collegato</span>'}<button class="mini ghost" data-act="edit" data-coll="documenti" data-id="${esc(d.id)}">Modifica</button></div></div>`; };
  const kl = Repo.list('checklist');
  return `
  <section><div class="head"><div><h2>Documenti</h2><p class="muted">${base?`I link puntano all'archivio <span class="mono">${esc(base)}</span>.`:'I link aprono i file su Google Drive. Quando l\'archivio sarà sul NAS, imposta il suo indirizzo in Dati e backup: i link useranno il percorso indicato sotto ogni documento.'}</p></div><button class="primary" data-act="add" data-coll="documenti">Aggiungi documento</button></div>
    <div class="filters"><input type="search" id="flt-doc" data-ui="docQ" placeholder="Cerca titolo, contenuto, subalterno" value="${esc(UI.docQ)}" aria-label="Cerca documenti">
      <select id="flt-doccat" data-ui="docCat" aria-label="Categoria"><option value="">Tutte le categorie</option>${cats.map(c=>`<option${UI.docCat===c?' selected':''}>${c}</option>`).join('')}</select>
      <select id="flt-docramo" data-ui="docRamo" aria-label="Ramo"><option value="">Tutti i rami</option><option value="belotti"${UI.docRamo==='belotti'?' selected':''}>Belotti</option><option value="pasinetti"${UI.docRamo==='pasinetti'?' selected':''}>Pasinetti</option></select></div></section>
  <section><div class="head"><h3>Da procurare</h3><button data-act="add" data-coll="checklist">Aggiungi</button></div>
    <div class="list">${kl.map(k => `<div class="row"><div><div class="t">${esc(k.titolo)}</div><div class="d">${esc(k.perche)}${k.note?' · '+esc(k.note):''}</div></div><div class="side"><select class="inline-state" data-coll="checklist" data-id="${esc(k.id)}" aria-label="Stato di ${esc(k.titolo)}" style="width:auto">${['da procurare','richiesto','ottenuto'].map(s=>`<option${k.stato===s?' selected':''}>${s}</option>`).join('')}</select><button class="mini ghost" data-act="edit" data-coll="checklist" data-id="${esc(k.id)}">Modifica</button></div></div>`).join('')}</div></section>
  ${cats.map(c => { const l = docs.filter(d => d.categoria===c).sort((a,b)=>sortKey(a.data).localeCompare(sortKey(b.data))); return l.length?`<section><h3>${c} <span class="muted small">${l.length}</span></h3><div class="list">${l.map(row).join('')}</div></section>`:''; }).join('')}
  ${docs.length?'':'<div class="empty">Nessun documento trovato.</div>'}`;
}

function viewCriticita(){
  const all = Repo.list('criticita');
  const pr = {alta:0, media:1, bassa:2}; const st = {aperta:0,'in corso':1,risolta:2};
  const list = all.filter(c => UI.critStato==='tutte' || (UI.critStato==='aperte' ? c.stato!=='risolta' : c.stato==='risolta'))
    .sort((a,b) => (st[a.stato]-st[b.stato]) || (pr[a.priorita]-pr[b.priorita]) || ((a.n||99)-(b.n||99)));
  const counts = { aperta: all.filter(c=>c.stato==='aperta').length, 'in corso': all.filter(c=>c.stato==='in corso').length, risolta: all.filter(c=>c.stato==='risolta').length };
  return `
  <section><div class="head"><div><h2>Criticità</h2><p class="muted">Cosa blocca donazione, rogito e lavori. La conformità urbanistica dell'intero edificio viene prima di tutto.</p></div><button class="primary" data-act="add" data-coll="criticita">Aggiungi criticità</button></div>
    <div class="filters"><div class="seg" role="group" aria-label="Filtro">${[['aperte',`Da risolvere (${counts.aperta+counts['in corso']})`],['risolte',`Risolte (${counts.risolta})`],['tutte','Tutte']].map(([v,l])=>`<button data-act="ui" data-k="critStato" data-v="${v}" aria-pressed="${UI.critStato===v}">${l}</button>`).join('')}</div></div></section>
  <div class="issues">${list.map(c => `<article class="issue ${c.priorita}${c.stato==='risolta'?' done':''}">
    <div class="hd"><h3>${c.n?`<span class="mono">#${c.n}</span>`:''}${esc(c.titolo)}</h3><div class="actions">${stPill(c.priorita)}${ramoPill(c.ramo)}</div></div>
    ${c.descrizione?`<p class="what">${esc(c.descrizione)}</p>`:''}
    <div class="todo">${c.azione?`<b>Cosa fare</b><span>${esc(c.azione)}</span>`:''}${c.chi?`<b>Chi</b><span>${esc(c.chi)}</span>`:''}${c.note?`<b>Note</b><span>${esc(c.note)}</span>`:''}</div>
    <div class="ft"><label class="small muted" for="st-${esc(c.id)}">Stato <select id="st-${esc(c.id)}" class="inline-state" data-coll="criticita" data-id="${esc(c.id)}">${['aperta','in corso','risolta'].map(s=>`<option${c.stato===s?' selected':''}>${s}</option>`).join('')}</select></label>
    <button class="mini" data-act="edit" data-coll="criticita" data-id="${esc(c.id)}">Modifica</button></div></article>`).join('') || '<div class="empty">Nessuna criticità in questo filtro.</div>'}</div>`;
}

function speseFiltrate(){
  return Repo.list('spese').filter(s =>
    (!UI.speseAnno || String(s.data||'').startsWith(UI.speseAnno)) && (!UI.speseCat || s.categoria===UI.speseCat) &&
    (!UI.speseRamo || s.ramo===UI.speseRamo) && (!UI.spesePag || (s.pagatoDa||'')===UI.spesePag)
  ).sort((a,b)=>sortKey(b.data).localeCompare(sortKey(a.data)));
}
function viewSpese(){
  const all = Repo.list('spese');
  const anni = [...new Set(all.map(s=>String(s.data||'').slice(0,4)).filter(Boolean))].sort().reverse();
  const pag = [...new Set(all.map(s=>s.pagatoDa).filter(Boolean))].sort();
  const list = speseFiltrate();
  const tot = list.reduce((a,s)=>a+(s.totale||0),0);
  let qb = 0, qp = 0; list.forEach(s => { const q = quote(s); qb += (s.totale||0)*q.b/100; qp += (s.totale||0)*q.p/100; });
  const byCat = {}; list.forEach(s => { const k = s.categoria||'Altro'; byCat[k] = (byCat[k]||0)+(s.totale||0); });
  const cats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const max = cats.length ? cats[0][1] : 0;
  const pctB = tot ? Math.round(qb/tot*100) : 0;
  return `
  <section><div class="head"><div><h2>Spese</h2><p class="muted">Ogni spesa ha chi la paga e su chi ricade: Belotti, Pasinetti o parti comuni divise in percentuale (predefinito ${DB.settings.quotaBelotti??50}% Belotti).</p></div>
    <div class="actions"><button data-act="csv-spese">Esporta CSV</button><button class="primary" data-act="add" data-coll="spese">Aggiungi spesa</button></div></div>
    <div class="filters">
      <select id="flt-anno" data-ui="speseAnno" aria-label="Anno"><option value="">Tutti gli anni</option>${anni.map(a=>`<option${UI.speseAnno===a?' selected':''}>${a}</option>`).join('')}</select>
      <select id="flt-cat" data-ui="speseCat" aria-label="Categoria"><option value="">Tutte le categorie</option>${CAT_SPESE.map(c=>`<option${UI.speseCat===c?' selected':''}>${c}</option>`).join('')}</select>
      <select id="flt-ramo" data-ui="speseRamo" aria-label="A carico di"><option value="">Tutti i rami</option>${RAMO_OPTS.map(([v,l])=>`<option value="${v}"${UI.speseRamo===v?' selected':''}>${l}</option>`).join('')}</select>
      <select id="flt-pag" data-ui="spesePag" aria-label="Pagato da"><option value="">Pagato da chiunque</option>${pag.map(p=>`<option${UI.spesePag===p?' selected':''}>${esc(p)}</option>`).join('')}</select>
    </div></section>
  <section class="summary">
    <div class="kpi"><span class="l">Totale</span><span class="v">${eur0(tot)}</span><span class="s">${list.length} spes${list.length===1?'a':'e'}</span></div>
    <div class="kpi"><span class="l">A carico Belotti</span><span class="v">${eur0(qb)}</span><span class="s">${pctB}% del totale</span></div>
    <div class="kpi"><span class="l">A carico Pasinetti</span><span class="v">${eur0(qp)}</span><span class="s">${tot?100-pctB:0}% del totale</span></div>
    <div class="kpi"><span class="l">Da verificare</span><span class="v">${list.filter(s=>s.daVerificare).length}</span><span class="s">spese con dubbi aperti</span></div>
  </section>
  ${list.length?`<div class="grid2">
    <div class="panel" style="display:grid;gap:12px"><h3>Per categoria</h3><div class="bars">${cats.map(([k,v])=>`<div class="bar-row" title="${esc(k)}: ${eur(v)}"><span class="lab">${esc(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${max?Math.max(1,v/max*100):0}%"></div></div><span class="val">${eur(v)}</span></div>`).join('')}</div></div>
    <div class="panel" style="display:grid;gap:12px;align-content:start"><h3>Ripartizione tra i due rami</h3>
      <div class="split" role="img" aria-label="Belotti ${pctB}%, Pasinetti ${100-pctB}%">${qb?`<div class="sb" style="flex:${qb}" title="Belotti ${eur(qb)}"></div>`:''}${qp?`<div class="sp" style="flex:${qp}" title="Pasinetti ${eur(qp)}"></div>`:''}</div>
      <div class="split-leg"><span><i style="background:var(--b)"></i>Belotti ${eur(qb)} · ${pctB}%</span><span><i style="background:var(--p)"></i>Pasinetti ${eur(qp)} · ${100-pctB}%</span></div>
      <p class="small muted">Le spese comuni sono divise secondo la quota indicata in ogni spesa.</p></div>
  </div>`:''}
  <section><div class="table"><table>
    <thead><tr><th>Data</th><th>Descrizione</th><th>Categoria</th><th>A carico di</th><th>Pagato da</th><th class="n">Importo</th></tr></thead>
    <tbody>${list.map(s => { const q = quote(s); return `<tr class="click" data-act="edit" data-coll="spese" data-id="${esc(s.id)}"><td class="num" style="white-space:nowrap">${esc(fmtDate(s.data))}</td><td><b>${esc(s.descrizione)}</b><small>${esc(s.fornitore||'')}${s.detraibile==='si'?' · detraibile'+(s.bonus?' ('+esc(s.bonus)+')':''):''}</small>${s.daVerificare?'<span class="flag">Da verificare</span>':''}</td><td>${esc(s.categoria)}</td><td>${ramoPill(s.ramo)}${s.ramo==='comune'?`<small>${q.b}% / ${q.p}%</small>`:''}</td><td>${esc(s.pagatoDa||'—')}</td><td class="n">${eur(s.totale)}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">Nessuna spesa con questi filtri.</td></tr>'}</tbody>
    ${list.length?`<tfoot><tr><td colspan="5">Totale</td><td class="n">${eur(tot)}</td></tr></tfoot>`:''}
  </table></div></section>`;
}

function viewPreventivi(){
  const all = Repo.list('preventivi').slice().sort((a,b)=>sortKey(b.data).localeCompare(sortKey(a.data)));
  const spese = Repo.list('spese');
  const groups = [['Da decidere', p => ['ricevuto','in valutazione'].includes(p.stato)], ['Accettati', p => p.stato==='accettato'], ['Stime di massima', p => p.stato==='stima'], ['Scartati', p => p.stato==='scartato']];
  const card = p => {
    const linked = spese.filter(s => s.preventivoId===p.id);
    const speso = linked.reduce((a,s)=>a+(s.totale||0),0);
    const doc = p.documentoId ? Repo.get('documenti', p.documentoId) : null; const h = docHref(doc);
    return `<div class="row"><div><div class="t">${esc(p.fornitore)}</div><div class="d">${esc(p.oggetto)}</div><div class="d">${esc(fmtDate(p.data))}${p.note?' · '+esc(p.note):''}${h?` · <a href="${esc(h)}" target="_blank" rel="noopener">Apri il preventivo</a>`:''}</div>
      ${linked.length?`<div class="d">Spese registrate: <b class="num">${eur(speso)}</b> (${linked.length})</div>`:''}</div>
      <div class="side"><span class="mono num"><b>${eur0(p.importo)}${p.importoMax?' – '+eur0(p.importoMax):''}</b></span><span class="muted small">IVA ${esc(p.iva||'')}</span>${stPill(p.stato)}${ramoPill(p.ramo)}
      ${p.stato!=='stima' && p.stato!=='scartato'?`<button class="mini" data-act="prev-spesa" data-id="${esc(p.id)}">Registra spesa</button>`:''}<button class="mini ghost" data-act="edit" data-coll="preventivi" data-id="${esc(p.id)}">Modifica</button></div></div>`;
  };
  return `
  <section><div class="head"><div><h2>Preventivi</h2><p class="muted">Quando un lavoro parte, "Registra spesa" crea la spesa collegata al preventivo e lo segna come accettato. Così si confronta il previsto con lo speso.</p></div><button class="primary" data-act="add" data-coll="preventivi">Aggiungi preventivo</button></div></section>
  ${groups.map(([t, fn]) => { const l = all.filter(fn); return l.length?`<section><h3>${t} <span class="muted small">${l.length}</span></h3><div class="list">${l.map(card).join('')}</div></section>`:''; }).join('')}
  ${all.length?'':'<div class="empty">Ancora nessun preventivo.</div>'}`;
}

function viewDati(){
  const counts = COLLS.map(c => [c, Repo.list(c).length]);
  const labels = {subalterni:'Subalterni',quote:'Righe di proprietà',soggetti:'Contatti',eventi:'Eventi',documenti:'Documenti',criticita:'Criticità',checklist:'Da procurare',spese:'Spese',preventivi:'Preventivi',detrazioni:'Piani di detrazione',scadenze:'Scadenze'};
  const age = backupAgeDays();
  return `
  <section><div class="head"><div><h2>Dati e backup</h2><p class="muted">${isShared() ? 'I dati sono su Supabase e condivisi con i familiari abilitati. Il backup JSON resta utile come copia di sicurezza.' : 'In questa prima fase i dati vivono nella memoria di questo browser. Non sono condivisi con altri dispositivi o familiari e si perdono se si cancellano i dati di navigazione: esporta spesso il backup.'}</p></div></div></section>
  ${isShared() ? `<section class="panel"><h3>Connessione</h3>
      <div class="storage"><div><b>Accesso:</b> ${esc(SupabaseAdapter.user.email)}${SupabaseAdapter.nome ? ' ('+esc(SupabaseAdapter.nome)+')' : ''}</div>
      <div><b>Ruolo:</b> ${SupabaseAdapter.ruolo==='editor' ? 'può modificare' : 'solo lettura'}</div>
      <div><b>Stato:</b> ${saveOk ? 'connesso, salvataggio attivo' : `<span style="color:var(--warn)">errore: ${esc(SupabaseAdapter.err)}</span>`}</div></div>
      <div class="actions"><button data-act="logout">Esci</button></div></section>` : ''}
  <div class="grid2">
    <section class="panel"><h3>Dove sono i dati</h3>
      <div class="storage"><div><b>Archivio:</b> ${esc(Repo.adapter.name)}</div>
      <div><b>Stato:</b> ${isShared() ? (saveOk ? 'salvataggio attivo' : '<span style="color:var(--warn)">salvataggio non riuscito</span>') : LocalAdapter.ok && saveOk ? 'salvataggio attivo' : '<span style="color:var(--warn)">memoria del browser non disponibile</span>'}</div>
      <div><b>Ultima modifica:</b> ${esc(new Date(DB.meta.updated).toLocaleString('it-IT'))}</div>
      <div><b>Ultimo backup:</b> ${DB.meta.lastBackup ? esc(new Date(DB.meta.lastBackup).toLocaleString('it-IT'))+(age!==null?` (${age===0?'oggi':age+' giorni fa'})`:'') : 'mai'}</div>
      <div><b>Modifiche dall'ultimo backup:</b> ${DB.meta.changesSinceBackup||0}</div></div>
      <div class="table"><table><tbody>${counts.map(([c,n])=>`<tr><td>${labels[c]}</td><td class="n">${n}</td></tr>`).join('')}</tbody></table></div>
    </section>
    <section class="panel"><h3>Backup</h3>
      <p class="small">Il backup è un file JSON con tutti i dati. Serve per non perderli, per spostarli su un altro dispositivo e per importarli nel database del NAS.</p>
      <div class="actions"><button class="primary" data-act="export-json">Esporta backup JSON</button><button data-act="csv-spese">Spese in CSV</button><button data-act="csv-prev">Preventivi in CSV</button></div>
      <label class="f" for="imp-file">Importa un backup <small>${isShared() ? 'Sostituisce i dati condivisi per tutti (i record tolti restano nello storico)' : 'Sostituisce tutti i dati di questo browser'}</small><input type="file" id="imp-file" accept=".json,application/json"></label>
      <p class="err" id="imp-msg" hidden></p>
      <div id="imp-confirm" hidden class="banner bad"><p id="imp-text"></p><div class="actions"><button data-act="imp-cancel">Annulla</button><button class="danger armed" data-act="imp-do">Sostituisci i dati</button></div></div>
    </section>
  </div>
  <section class="panel"><h3>Impostazioni</h3>
    <form id="settings-form" class="form-grid" novalidate>
      <label class="f wide" for="set-docbase">Indirizzo dell'archivio documenti <small>Vuoto = link Google Drive. Sul NAS, ad esempio http://nas.local/casa-carobbio/documenti</small><input id="set-docbase" type="url" value="${esc(DB.settings.docBase)}" placeholder="http://nas.local/casa-carobbio/documenti"></label>
      <label class="f" for="set-quota">Quota Belotti predefinita per le spese comuni (%)<input id="set-quota" type="number" min="0" max="100" value="${esc(DB.settings.quotaBelotti??50)}"></label>
      <label class="f" for="set-utente">Chi usa questo dispositivo <small>Viene registrato su ogni modifica</small><input id="set-utente" value="${esc(DB.settings.utente)}" placeholder="Il tuo nome"${isShared() ? ' readonly' : ''}></label>
      <div class="actions wide"><button type="submit" class="primary">Salva impostazioni</button></div>
    </form></section>
  ${isShared() ? '' : `<section class="panel"><h3>Verso il NAS</h3>
    <ol class="steps">
      <li>Sul NAS: database (per esempio PocketBase o PostgreSQL in Docker) e cartella documenti con le sottocartelle Atti, Catasto, Urbanistica, Progetti, Fatture, Preventivi, Foto, Analisi.</li>
      <li>Copia i file dei documenti nei percorsi indicati in ogni scheda (pagina Documenti), poi imposta qui sopra l'indirizzo dell'archivio.</li>
      <li>Importa nel database il backup JSON: ogni chiave di <span class="mono">colls</span> diventa una tabella, ogni record ha un <span class="mono">id</span> stabile.</li>
      <li>Questa stessa pagina, servita dal NAS, passa dal salvataggio nel browser a quello sul database cambiando solo l'adattatore dei dati.</li>
    </ol></section>
  <section class="panel"><h3>Ripristina i dati iniziali</h3>
    <p class="small">Cancella spese, preventivi e modifiche fatte in questo browser e ricarica i dati di riferimento. Esporta prima un backup se vuoi conservarli.</p>
    <div class="actions"><button class="danger" data-act="reset">Ripristina</button></div></section>`}`;
}

/* ---------- export / import ---------- */
let downloadsNs;
async function getDownloads(){
  if(downloadsNs !== undefined) return downloadsNs;
  try{ if(window.claude && typeof window.claude.use==='function'){ downloadsNs = await window.claude.use('downloads'); return downloadsNs; } }catch(e){ downloadsNs = null; return null; }
  return undefined; // fuori da Claude (es. servita dal NAS)
}
async function offerFile(filename, text, mime){
  const dl = await getDownloads();
  if(dl){
    try{ await dl.save({filename, data:text}); toast('File pronto: '+filename); return true; }
    catch(e){ if(e && e.code==='declined'){ toast('Salvataggio annullato'); return false; } }
  } else if(dl===undefined && window.self===window.top){
    try{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:mime})); a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},500); return true; }catch(e){}
  }
  dlg().innerHTML = `<div class="dlg"><header><h3>${esc(filename)}</h3><button type="button" class="ghost" data-act="dlg-close">Chiudi</button></header>
    <div class="body"><p class="small">Il salvataggio del file non è disponibile qui. Copia il contenuto e incollalo in un file di testo chiamato <span class="mono">${esc(filename)}</span>.</p><textarea id="fallback-text" style="min-height:240px;font-family:var(--f-mono);font-size:12px" readonly>${esc(text)}</textarea></div>
    <footer><span></span><div class="actions"><button class="primary" data-act="copy-fallback">Copia tutto</button></div></footer></div>`;
  dlg().showModal();
  return false;
}
async function exportJson(){
  const out = { app:APP_ID, schema:SCHEMA, exportedAt:nowIso(), seedVersion:DB.meta.seedVersion, meta:DB.meta, settings:DB.settings, immobile:DB.immobile, colls:DB.colls };
  const ok = await offerFile(`casa-carobbio-backup-${todayIso()}.json`, JSON.stringify(out, null, 2), 'application/json');
  if(ok){ DB.meta.lastBackup = nowIso(); DB.meta.changesSinceBackup = 0; await Repo.saveMeta(); render(); }
}
function csvCell(v){ const s = String(v ?? ''); return /[";\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }
const csvNum = c => (c===null || c===undefined || c==='') ? '' : (c/100).toFixed(2).replace('.',',');
async function exportCsvSpese(){
  const rows = [['Data','Descrizione','Categoria','Fornitore','A carico di','Quota Belotti %','Quota Pasinetti %','Pagato da','Totale','di cui IVA','Detraibile','Bonus','Da verificare','Note']];
  speseFiltrate().forEach(s => { const q = quote(s); rows.push([s.data, s.descrizione, s.categoria, s.fornitore, RAMI[s.ramo]||'', q.b, q.p, s.pagatoDa, csvNum(s.totale), csvNum(s.iva), s.detraibile==='si'?'sì':'no', s.bonus, s.daVerificare?'sì':'', s.note]); });
  await offerFile(`casa-carobbio-spese-${todayIso()}.csv`, '﻿'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n'), 'text/csv');
}
async function exportCsvPrev(){
  const rows = [['Data','Fornitore','Oggetto','Categoria','A carico di','Importo','Importo massimo','IVA','Stato','Note']];
  Repo.list('preventivi').forEach(p => rows.push([p.data, p.fornitore, p.oggetto, p.categoria, RAMI[p.ramo]||'', csvNum(p.importo), csvNum(p.importoMax), p.iva, p.stato, p.note]));
  await offerFile(`casa-carobbio-preventivi-${todayIso()}.csv`, '﻿'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n'), 'text/csv');
}
let pendingImport = null;
function handleImportFile(file){
  const msg = $('#imp-msg'); msg.hidden = true;
  const r = new FileReader();
  r.onload = () => {
    try{
      const d = JSON.parse(r.result);
      if(d.app!==APP_ID || !d.colls) throw new Error('Il file non è un backup di Casa Carobbio.');
      pendingImport = d;
      const n = COLLS.reduce((a,c)=>a+((d.colls[c]||[]).length),0);
      $('#imp-text').textContent = `Backup del ${d.exportedAt ? new Date(d.exportedAt).toLocaleString('it-IT') : 'data sconosciuta'} con ${n} record (${(d.colls.spese||[]).length} spese). Sostituirà tutti i dati di questo browser.`;
      $('#imp-confirm').hidden = false;
    }catch(e){ msg.textContent = e.message || 'File non leggibile.'; msg.hidden = false; }
  };
  r.onerror = () => { msg.textContent = 'File non leggibile.'; msg.hidden = false; };
  r.readAsText(file);
}
async function doImport(){
  const d = pendingImport; if(!d) return;
  const db = { app:APP_ID, schema:SCHEMA, meta:{...(d.meta||{}), updated:nowIso(), lastBackup: d.exportedAt || nowIso(), changesSinceBackup:0, deletedSeed:(d.meta&&d.meta.deletedSeed)||[], seedVersion: d.seedVersion || (d.meta&&d.meta.seedVersion) || 0}, settings:{docBase:'', quotaBelotti:50, utente:'', ...(d.settings||{})}, immobile: d.immobile || clone(SEED.immobile), colls:{} };
  COLLS.forEach(c => db.colls[c] = Array.isArray(d.colls[c]) ? d.colls[c] : []);
  await Repo.replaceAll(upgradeSeed(db)); pendingImport = null; toast('Backup importato'); render();
}

/* ---------- render e navigazione ---------- */
const VIEWS = { panoramica:viewPanoramica, subalterni:viewSubalterni, proprieta:viewProprieta, storia:viewStoria, persone:viewPersone, documenti:viewDocumenti, criticita:viewCriticita, spese:viewSpese, preventivi:viewPreventivi, dati:viewDati };
function renderTabs(){
  const open = Repo.list('criticita').filter(c=>c.stato!=='risolta' && c.priorita==='alta').length;
  const late = Repo.list('scadenze').filter(z => z.stato!=='completata' && /^\d{4}-\d{2}-\d{2}$/.test(z.prossima||'') && z.prossima < todayIso()).length;
  $('#tabs').innerHTML = TABS.map(([k,l]) => `<button type="button" data-nav="${k}"${route===k?' aria-current="page"':''}>${l}${k==='criticita'&&open?`<span class="count">${open}</span>`:''}${k==='scadenze'&&late?`<span class="count">${late}</span>`:''}</button>`).join('');
  $('#nav-select').innerHTML = TABS.map(([k,l]) => `<option value="${k}"${route===k?' selected':''}>${l}${k==='criticita'&&open?` (${open} prioritarie)`:''}${k==='scadenze'&&late?` (${late} scadute)`:''}</option>`).join('') + (route==='cerca' ? '<option value="cerca" selected disabled>Risultati della ricerca</option>' : '');
}
function render(keepFocusId){
  const active = keepFocusId || (document.activeElement && document.activeElement.id);
  const pos = active && document.activeElement && document.activeElement.selectionStart;
  renderTabs(); renderStatus();
  $('#view').innerHTML = (VIEWS[route]||viewPanoramica)();
  if(route==='subalterni') markSelected();
  if(active){ const el = document.getElementById(active); if(el && el.closest('#view') && el.matches('input[type=search]')){ el.focus(); try{ el.setSelectionRange(pos,pos); }catch(e){} } }
}
function markSelected(){ $$('#view svg [data-sub]').forEach(el => el.classList.toggle('sel', el.dataset.sub===String(selSub))); }
function go(){
  if(!DB) return; // schermata di accesso
  const h = (location.hash||'').replace('#','');
  route = VIEWS[h] ? h : 'panoramica';
  render(); window.scrollTo(0,0);
}
/* Navigazione interna senza link: dentro la cornice della pagina i link "#" non sono affidabili. */
function navigate(r){
  if(!VIEWS[r]) return;
  if(r!=='cerca'){ UI.q = ''; const g = $('#global-q'); if(g) g.value = ''; }
  route = r;
  try{ history.replaceState(null, '', '#'+r); }catch(e){}
  render(); window.scrollTo(0,0);
  const m = $('#view'); if(m) m.focus({preventScroll:true});
}

/* ---------- eventi ---------- */
document.addEventListener('click', async ev => {
  const nav = ev.target.closest('[data-nav]');
  if(nav){ ev.preventDefault(); navigate(nav.dataset.nav); return; }
  const t = ev.target.closest('[data-act], svg [data-sub]');
  if(!t) return;
  const act = t.dataset.act || (t.dataset.sub ? 'pick-sub' : '');
  const coll = t.dataset.coll, id = t.dataset.id;
  switch(act){
    case 'pick-sub':
      selSub = t.dataset.sub;
      if(route!=='subalterni'){ ev.preventDefault(); navigate('subalterni'); return; }
      ev.preventDefault();
      { const d = $('#sub-detail'); if(d){ d.outerHTML = subDetail(selSub); markSelected(); if(window.innerWidth<=900){ const nd=$('#sub-detail'); if(nd) nd.scrollIntoView({behavior:'smooth', block:'start'}); } } }
      break;
    case 'add': openForm(coll, null, { preset: (typeof EXTRA_PRESETS!=='undefined' && EXTRA_PRESETS[coll]) ? EXTRA_PRESETS[coll]() : coll==='spese' ? {data:todayIso(), ramo:'comune', quotaBelotti:DB.settings.quotaBelotti??50, categoria:'Lavori', detraibile:'no', pagatoDa:DB.settings.utente||''} : coll==='preventivi' ? {data:todayIso(), stato:'ricevuto', iva:'esclusa', ramo:'comune', quotaBelotti:DB.settings.quotaBelotti??50, categoria:'Lavori'} : coll==='eventi' ? {data:todayIso(), stato:'avvenuto', tipo:'Lavori', ramo:'comune'} : coll==='criticita' ? {stato:'aperta', priorita:'media', ramo:'comune'} : coll==='checklist' ? {stato:'da procurare'} : coll==='soggetti' ? {gruppo:'Professionisti', ramo:'comune'} : coll==='documenti' ? {categoria:'Altro', ramo:'comune'} : coll==='quote' ? {ramo:'belotti', diritto:'Proprietà', quota:'1/1'} : {} }); break;
    case 'edit': { const r = Repo.get(coll, id); if(r) openForm(coll, r); break; }
    case 'dlg-close': dlg().close(); break;
    case 'dlg-del':
      if(!t.classList.contains('armed')){ t.classList.add('armed'); t.textContent = 'Conferma eliminazione'; return; }
      await Repo.del(dlgCtx.coll, dlgCtx.id); dlg().close(); toast('Eliminato'); render(); break;
    case 'ui': UI[t.dataset.k] = t.dataset.v; render(); break;
    case 'copy': copyText(t.dataset.v, t); break;
    case 'copy-fallback': { const ta = $('#fallback-text'); try{ await navigator.clipboard.writeText(ta.value); toast('Copiato'); }catch(e){ ta.focus(); ta.select(); toast('Testo selezionato: copialo con Ctrl+C'); } break; }
    case 'cambio': openCambio(); break;
    case 'prev-spesa': {
      const p = Repo.get('preventivi', id); if(!p) return;
      openForm('spese', null, { title:'Registra spesa da preventivo', intro:`Preventivo ${esc(p.fornitore)}: ${esc(p.oggetto)}. Indica l'importo effettivamente pagato (acconto o saldo).`,
        preset:{ data:todayIso(), descrizione:p.oggetto, fornitore:p.fornitore, categoria:p.categoria||'Lavori', ramo:p.ramo, quotaBelotti:p.quotaBelotti, totale:p.importo, preventivoId:p.id, documentoId:p.documentoId||'', detraibile:'no', pagatoDa:DB.settings.utente||'' },
        onSaved: async () => { if(p.stato!=='accettato') await Repo.put('preventivi', {...p, stato:'accettato'}); } });
      break; }
    case 'export-json': exportJson(); break;
    case 'csv-spese': exportCsvSpese(); break;
    case 'csv-prev': exportCsvPrev(); break;
    case 'imp-cancel': pendingImport = null; $('#imp-confirm').hidden = true; $('#imp-file').value=''; break;
    case 'imp-do': doImport(); break;
    case 'logout': await SupabaseAdapter.sb.auth.signOut(); location.replace(location.pathname); break;
    case 'reset':
      if(!t.classList.contains('armed')){ t.classList.add('armed'); t.textContent = 'Conferma: cancella e ripristina'; return; }
      await Repo.replaceAll(freshDb()); toast('Dati iniziali ripristinati'); render(); break;
  }
});
document.addEventListener('submit', ev => {
  ev.preventDefault();
  if(ev.target.id==='login-form') sendLoginLink();
  else if(ev.target.id==='dlg-form') submitForm();
  else if(ev.target.id==='cambio-form') submitCambio();
  else if(ev.target.id==='settings-form'){
    DB.settings.docBase = $('#set-docbase').value.trim();
    const q = Number($('#set-quota').value); DB.settings.quotaBelotti = isFinite(q) ? Math.min(100, Math.max(0, q)) : 50;
    DB.settings.utente = $('#set-utente').value.trim();
    Repo.saveMeta(); toast('Impostazioni salvate'); render();
  }
});
document.addEventListener('change', async ev => {
  const t = ev.target;
  if(t.id==='nav-select'){ navigate(t.value); return; }
  if(t.matches('select.inline-state')){ const r = Repo.get(t.dataset.coll, t.dataset.id); if(r){ await Repo.put(t.dataset.coll, {...r, stato:t.value}); toast('Stato aggiornato'); render(); } }
  else if(t.matches('select[data-ui]')){ UI[t.dataset.ui] = t.value; render(); }
  else if(t.id==='imp-file' && t.files && t.files[0]) handleImportFile(t.files[0]);
});
document.addEventListener('input', ev => { const t = ev.target; if(t.matches('input[data-ui]')){ UI[t.dataset.ui] = t.value; render(t.id); } });
document.addEventListener('keydown', ev => { const t = ev.target; if((ev.key==='Enter' || ev.key===' ') && t.matches && t.matches('svg [data-sub]')){ ev.preventDefault(); t.dispatchEvent(new MouseEvent('click',{bubbles:true})); } });
window.addEventListener('hashchange', go);

