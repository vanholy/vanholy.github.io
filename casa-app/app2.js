/* ===================================================================
   Scadenze, detrazioni e ricerca unica
   =================================================================== */
const RICORRENZE = [['','Una volta'],['1','Ogni mese'],['3','Ogni 3 mesi'],['6','Ogni 6 mesi'],['12','Ogni anno'],['24','Ogni 2 anni'],['48','Ogni 4 anni']];
const ricLabel = v => (RICORRENZE.find(r => r[0]===String(v ?? '')) || ['',''])[1];

const EXTRA_PRESETS = {
  scadenze: () => ({ stato:'attiva', ricorrenza:'12', categoria:'Manutenzione', ramo:'comune', prossima:todayIso() }),
  detrazioni: () => ({ annoInizio:new Date().getFullYear(), percentuale:36, rate:10, tipo:'Ristrutturazione', ramo:'belotti' })
};

SCHEMAS.scadenze = { label:'scadenza', prefix:'z', fields:[
  {k:'titolo', label:'Cosa', type:'text', req:true, wide:true},
  {k:'prossima', label:'Prossima scadenza', type:'date', req:true},
  {k:'ricorrenza', label:'Si ripete', type:'select', opts:RICORRENZE},
  {k:'categoria', label:'Categoria', type:'select', opts:['Imposte e tasse','Manutenzione','Assicurazione','Utenze','Pratiche','Altro']},
  {k:'ramo', label:'Riguarda', type:'select', opts:[['comune','Entrambe / comune'],['belotti','Belotti'],['pasinetti','Pasinetti']]},
  {k:'importo', label:'Importo previsto (€)', type:'money'},
  {k:'fornitore', label:'Fornitore o ente', type:'text', list:'dl-fornitori'},
  {k:'ultima', label:'Ultima volta fatta', type:'date'},
  {k:'stato', label:'Stato', type:'select', opts:[['attiva','Attiva'],['completata','Completata']]},
  {k:'note', label:'Note', type:'textarea', wide:true}
]};
SCHEMAS.detrazioni = { label:'piano di detrazione', prefix:'t', fields:[
  {k:'titolo', label:'Lavoro', type:'text', req:true, wide:true},
  {k:'beneficiario', label:'Chi detrae', type:'text', req:true, list:'dl-persone'},
  {k:'ramo', label:'Unità', type:'select', opts:[['belotti','Belotti (piano terra)'],['pasinetti','Pasinetti (piano primo)']]},
  {k:'tipo', label:'Tipo di detrazione', type:'select', opts:['Ristrutturazione','Ecobonus','Bonus mobili','Sismabonus','Altro']},
  {k:'annoInizio', label:'Anno della spesa', type:'number', req:true, min:2000, max:2100, help:'Anno d\'imposta della prima rata'},
  {k:'spesa', label:'Spesa ammessa (€)', type:'money', req:true},
  {k:'percentuale', label:'Percentuale %', type:'number', req:true, min:0, max:110},
  {k:'rate', label:'Numero di rate annuali', type:'number', min:1, max:20},
  {k:'spesaId', label:'Spesa collegata', type:'spesa'},
  {k:'note', label:'Note', type:'textarea', wide:true}
]};

/* ---------- date ---------- */
const ISO = /^\d{4}-\d{2}-\d{2}$/;
function addMonths(iso, n){
  const [y,m,d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m-1+n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth()+1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0,10);
}
function daysTo(iso){
  if(!ISO.test(iso||'')) return null;
  const [y,m,d] = iso.split('-').map(Number);
  const n = new Date();
  return Math.round((Date.UTC(y,m-1,d) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))/86400000);
}
function whenLabel(days){
  if(days===null) return '';
  if(days<0) return `scaduta da ${-days} giorn${days===-1?'o':'i'}`;
  if(days===0) return 'oggi';
  if(days===1) return 'domani';
  return `tra ${days} giorni`;
}
function scadState(z){
  if(z.stato==='completata') return 'done';
  const d = daysTo(z.prossima);
  if(d===null) return 'later';
  if(d<0) return 'late';
  if(d<=30) return 'soon';
  return 'later';
}
function scadenzeAttive(){ return Repo.list('scadenze').filter(z => z.stato!=='completata').sort((a,b) => sortKey(a.prossima).localeCompare(sortKey(b.prossima))); }

/* ---------- scadenze ---------- */
function scadRow(z){
  const st = scadState(z), days = daysTo(z.prossima);
  const pill = st==='late' ? 'st-aperta' : st==='soon' ? 'st-in-corso' : st==='done' ? 'st-risolta' : 'neutral';
  return `<div class="scad ${st}">
    <div class="when">${esc(fmtDate(z.prossima))}<small>${st==='done' ? 'completata' : esc(whenLabel(days))}</small></div>
    <div><div class="t" style="font-weight:600">${esc(z.titolo)}</div>
      <div class="d small muted">${esc(z.categoria||'')}${z.ricorrenza?' · '+esc(ricLabel(z.ricorrenza).toLowerCase()):''}${z.fornitore?' · '+esc(z.fornitore):''}${z.importo?' · circa '+eur(z.importo):''}${z.ultima?' · ultima volta '+esc(fmtDate(z.ultima)):''}</div>
      ${z.note?`<div class="d small muted">${esc(z.note)}</div>`:''}</div>
    <div class="side"><span class="pill ${pill}">${st==='late'?'scaduta':st==='soon'?'a breve':st==='done'?'fatta':'in programma'}</span>${ramoPill(z.ramo)}
      ${st!=='done'?`<button class="mini primary" data-act="scad-done" data-id="${esc(z.id)}">Fatta</button><button class="mini" data-act="scad-spesa" data-id="${esc(z.id)}">Registra spesa</button>`:''}
      <button class="mini ghost" data-act="edit" data-coll="scadenze" data-id="${esc(z.id)}">Modifica</button></div></div>`;
}
function viewScadenze(){
  const all = Repo.list('scadenze').slice().sort((a,b) => sortKey(a.prossima).localeCompare(sortKey(b.prossima)));
  const groups = [['Scadute','late'],['Entro 30 giorni','soon'],['Più avanti','later'],['Completate','done']];
  return `
  <section><div class="head"><div><h2>Scadenze e manutenzioni</h2><p class="muted">Tasse, controlli e pratiche ricorrenti. "Fatta" sposta la data alla prossima ricorrenza; una scadenza che non si ripete passa tra le completate.</p></div><button class="primary" data-act="add" data-coll="scadenze">Aggiungi scadenza</button></div></section>
  ${groups.map(([t,k]) => { const l = all.filter(z => scadState(z)===k); return l.length ? `<section><h3>${t} <span class="muted small">${l.length}</span></h3><div class="list">${l.map(scadRow).join('')}</div></section>` : ''; }).join('')}
  ${all.length ? '' : '<div class="empty">Nessuna scadenza. Aggiungi IMU, assicurazione, manutenzione della caldaia e simili.</div>'}`;
}
function panScadenze(){
  const next = scadenzeAttive().slice(0,4);
  return `<section><div class="head"><h2>Prossime scadenze</h2><button type="button" data-nav="scadenze">Tutte</button></div>
    <div class="list">${next.length ? next.map(scadRow).join('') : '<div class="empty">Nessuna scadenza in programma.</div>'}</div></section>`;
}
async function scadDone(id){
  const z = Repo.get('scadenze', id); if(!z) return;
  const upd = {...z, ultima: todayIso()};
  const n = parseInt(z.ricorrenza, 10);
  if(n && ISO.test(z.prossima||'')){
    let next = addMonths(z.prossima, n), guard = 0;
    while(daysTo(next) < 0 && guard++ < 200) next = addMonths(next, n);
    upd.prossima = next;
    await Repo.put('scadenze', upd); toast('Prossima scadenza: '+fmtDate(next));
  } else {
    upd.stato = 'completata';
    await Repo.put('scadenze', upd); toast('Scadenza completata');
  }
  render();
}
function scadSpesa(id){
  const z = Repo.get('scadenze', id); if(!z) return;
  const catMap = {'Imposte e tasse':'Imposte e tasse','Manutenzione':'Manutenzione','Assicurazione':'Assicurazione','Utenze':'Utenze','Pratiche':'Professionisti e pratiche'};
  openForm('spese', null, { title:'Registra spesa della scadenza', intro:`${esc(z.titolo)} del ${esc(fmtDate(z.prossima))}.`,
    preset:{ data:todayIso(), descrizione:z.titolo, fornitore:z.fornitore||'', categoria:catMap[z.categoria]||'Altro', ramo:z.ramo||'comune', quotaBelotti:DB.settings.quotaBelotti??50, totale:z.importo, detraibile:'no', pagatoDa:DB.settings.utente||'' } });
}

/* ---------- detrazioni ---------- */
function piano(d){
  const spesa = d.spesa||0, pct = +d.percentuale||0, n = Math.max(1, +d.rate||10), y0 = +d.annoInizio || new Date().getFullYear();
  const tot = Math.round(spesa*pct/100);
  return { tot, rata: tot/n, n, y0, y1: y0+n-1 };
}
function viewDetrazioni(){
  const Y = new Date().getFullYear();
  const all = Repo.list('detrazioni').slice().sort((a,b) => (+a.annoInizio||0)-(+b.annoInizio||0));
  const piani = all.map(d => ({d, p:piano(d)}));
  const tot = piani.reduce((a,x)=>a+x.p.tot,0);
  const restante = piani.reduce((a,{p}) => a + p.rata*Math.max(0, p.y1 - Math.max(p.y0, Y) + 1), 0);
  const rataY = piani.reduce((a,{p}) => a + (Y>=p.y0 && Y<=p.y1 ? p.rata : 0), 0);
  const benef = [...new Set(all.map(d => d.beneficiario || '—'))].sort();
  let anni = [];
  if(piani.length){ const a0 = Math.min(...piani.map(x=>x.p.y0)), a1 = Math.max(...piani.map(x=>x.p.y1)); for(let y=a0; y<=a1; y++) anni.push(y); }
  const cell = (y, b) => piani.filter(x => (x.d.beneficiario||'—')===b && y>=x.p.y0 && y<=x.p.y1).reduce((a,x)=>a+x.p.rata,0);
  const maxY = anni.length ? Math.max(...anni.map(y => benef.reduce((a,b)=>a+cell(y,b),0))) : 0;
  const senza = Repo.list('spese').filter(s => s.detraibile==='si' && !all.some(d => d.spesaId===s.id));
  return `
  <section><div class="head"><div><h2>Detrazioni fiscali</h2><p class="muted">Ogni piano divide la detrazione in rate annuali. La rata di un anno d'imposta si recupera con la dichiarazione dell'anno dopo.</p></div><button class="primary" data-act="add" data-coll="detrazioni">Aggiungi piano</button></div>
    <div class="note-box">Regole verificate a ottobre 2026 per le spese dal 2027: 36% sull'abitazione principale e 30% sugli altri immobili, in 10 rate, con un tetto di 96.000 € di spesa per unità. La legge di bilancio 2027 può cambiarle: controlla con il commercialista e aggiorna la percentuale nei piani.</div></section>
  <section class="summary">
    <div class="kpi"><span class="l">Detrazioni totali</span><span class="v">${eur0(tot)}</span><span class="s">${all.length} pian${all.length===1?'o':'i'}</span></div>
    <div class="kpi"><span class="l">Rata anno d'imposta ${Y}</span><span class="v">${eur0(rataY)}</span><span class="s">si recupera nel ${Y+1}</span></div>
    <div class="kpi"><span class="l">Ancora da recuperare</span><span class="v">${eur0(restante)}</span><span class="s">dal ${Y} in poi</span></div>
    <div class="kpi"><span class="l">Spese detraibili senza piano</span><span class="v">${senza.length}</span><span class="s">segnate "detraibile" nelle spese</span></div>
  </section>
  ${senza.length ? `<section><h3>Spese detraibili senza piano</h3><div class="list">${senza.map(s => `<div class="row"><div><div class="t">${esc(s.descrizione)}</div><div class="d">${esc(fmtDate(s.data))} · ${eur(s.totale)}${s.bonus?' · '+esc(s.bonus):''}</div></div><div class="side">${ramoPill(s.ramo)}<button class="mini primary" data-act="detr-from-spesa" data-id="${esc(s.id)}">Crea piano</button></div></div>`).join('')}</div></section>` : ''}
  ${piani.length ? `
  <section><h3>Rate per anno d'imposta</h3><div class="table"><table>
    <thead><tr><th>Anno</th>${benef.map(b=>`<th class="n">${esc(b)}</th>`).join('')}<th class="n">Totale</th><th style="width:30%"></th></tr></thead>
    <tbody>${anni.map(y => { const t = benef.reduce((a,b)=>a+cell(y,b),0); return `<tr class="${y===Y?'now':''}"><td class="num">${y}${y===Y?' <small>anno in corso</small>':''}</td>${benef.map(b=>`<td class="n">${eur(Math.round(cell(y,b)))}</td>`).join('')}<td class="n"><b>${eur(Math.round(t))}</b></td><td><div class="bar-track"><div class="bar-fill" style="width:${maxY?Math.max(1,t/maxY*100):0}%"></div></div></td></tr>`; }).join('')}</tbody>
  </table></div></section>
  <section><h3>Piani</h3><div class="list">${piani.map(({d,p}) => { const godute = Math.min(p.n, Math.max(0, Y - p.y0)); const sp = d.spesaId ? Repo.get('spese', d.spesaId) : null; return `<div class="row"><div style="display:grid;gap:4px"><div class="t">${esc(d.titolo)}</div>
      <div class="d">${esc(d.beneficiario||'')} · ${esc(d.tipo||'')} ${esc(d.percentuale)}% di ${eur(d.spesa)} · ${p.n} rate da ${eur(Math.round(p.rata))} · anni d'imposta ${p.y0}–${p.y1}</div>
      ${sp?`<div class="d">Spesa collegata: ${esc(sp.descrizione)} (${esc(fmtDate(sp.data))})</div>`:''}${d.note?`<div class="d">${esc(d.note)}</div>`:''}
      <div class="prog" role="img" aria-label="${godute} rate su ${p.n} con anno d'imposta già chiuso"><i style="width:${godute/p.n*100}%"></i></div><div class="d small">${godute} di ${p.n} anni d'imposta chiusi</div></div>
      <div class="side"><span class="mono num"><b>${eur0(p.tot)}</b></span>${ramoPill(d.ramo)}<button class="mini ghost" data-act="edit" data-coll="detrazioni" data-id="${esc(d.id)}">Modifica</button></div></div>`; }).join('')}</div></section>` :
  `<div class="empty">Nessun piano ancora. Quando registri una spesa detraibile (campo "Detraibile: sì"), la trovi qui pronta per creare il piano.</div>`}`;
}
function detrFromSpesa(id){
  const s = Repo.get('spese', id); if(!s) return;
  const y = parseInt(String(s.data||'').slice(0,4), 10) || new Date().getFullYear();
  const ramo = s.ramo==='pasinetti' ? 'pasinetti' : 'belotti';
  const spesa = s.ramo==='comune' ? Math.round((s.totale||0) * quote(s).b/100) : s.totale;
  openForm('detrazioni', null, { title:'Nuovo piano di detrazione', intro: s.ramo==='comune' ? 'Spesa comune: la spesa ammessa proposta è la quota Belotti. Per la quota Pasinetti crea un secondo piano.' : '',
    preset:{ titolo:s.descrizione, beneficiario:s.pagatoDa||'', ramo, tipo:'Ristrutturazione', annoInizio:y, spesa, percentuale:36, rate:10, spesaId:s.id } });
}

/* ---------- ricerca unica ---------- */
const SEARCH_DEF = {
  spese:      { label:'Spese', nav:'spese', title:r=>r.descrizione, sub:r=>[fmtDate(r.data), r.fornitore, eur(r.totale)] },
  preventivi: { label:'Preventivi', nav:'preventivi', title:r=>r.fornitore, sub:r=>[r.oggetto, eur0(r.importo)] },
  scadenze:   { label:'Scadenze', nav:'scadenze', title:r=>r.titolo, sub:r=>[fmtDate(r.prossima), r.fornitore] },
  detrazioni: { label:'Detrazioni', nav:'detrazioni', title:r=>r.titolo, sub:r=>[r.beneficiario, r.annoInizio] },
  documenti:  { label:'Documenti', nav:'documenti', title:r=>r.titolo, sub:r=>[fmtDate(r.data), r.contenuto] },
  checklist:  { label:'Documenti da procurare', nav:'documenti', title:r=>r.titolo, sub:r=>[r.stato, r.perche] },
  soggetti:   { label:'Persone', nav:'persone', title:r=>r.nome, sub:r=>[r.cellulare, r.telefono, r.email, r.ruolo] },
  criticita:  { label:'Criticità', nav:'criticita', title:r=>r.titolo, sub:r=>[r.stato, r.azione] },
  eventi:     { label:'Storia', nav:'storia', title:r=>r.titolo, sub:r=>[fmtDate(r.data, r.dataTesto), r.riferimento] },
  subalterni: { label:'Subalterni', nav:'subalterni', title:r=>'Sub '+r.sub+' · '+r.descrizione, sub:r=>[r.categoria, r.piano?'piano '+r.piano:''] },
  quote:      { label:'Proprietà', nav:'proprieta', title:r=>r.soggetto+' · '+r.diritto, sub:r=>[r.subs, r.atto] }
};
const MONEY_KEYS = ['totale','importo','importoMax','iva','rendita','spesa'];
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function recText(r){
  return norm(Object.entries(r).filter(([k]) => !k.startsWith('_') && k!=='id' && k!=='url').map(([k,v]) =>
    (typeof v==='number' && MONEY_KEYS.includes(k)) ? moneyInput(v)+' '+(v/100) : (k==='data'||k==='prossima'||k==='dal'||k==='al') ? v+' '+fmtDate(v) : v
  ).join(' '));
}
function hl(text, tokens){
  let out = esc(text);
  tokens.forEach(t => { if(t.length<2) return; const re = new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'); out = out.replace(re, '<mark>$1</mark>'); });
  return out;
}
function viewCerca(){
  const q = (UI.q||'').trim();
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  let total = 0;
  const blocks = Object.entries(SEARCH_DEF).map(([coll, def]) => {
    const hits = Repo.list(coll).filter(r => { const t = recText(r); return tokens.every(k => t.includes(k)); });
    total += hits.length;
    if(!hits.length) return '';
    return `<section><h3>${def.label} <span class="muted small">${hits.length}</span></h3><div class="list">${hits.slice(0,30).map(r => {
      const sub = def.sub(r).filter(Boolean).join(' · ');
      const doc = coll==='documenti' ? docHref(r) : '';
      const open = coll==='subalterni' ? `<button class="mini" data-act="pick-sub" data-sub="${esc(r.sub)}">Apri</button>` : `<button class="mini" data-nav="${def.nav}">Vai a ${esc(def.label)}</button>`;
      return `<div class="row"><div><div class="t">${hl(def.title(r)||'', q.split(/\s+/))}</div>${sub?`<div class="d">${hl(sub, q.split(/\s+/))}</div>`:''}</div>
        <div class="side">${ramoPill(r.ramo)}${doc?`<a class="btn mini" href="${esc(doc)}" target="_blank" rel="noopener">Apri file</a>`:''}${open}<button class="mini ghost" data-act="edit" data-coll="${coll}" data-id="${esc(r.id)}">Modifica</button></div></div>`;
    }).join('')}</div></section>`;
  }).join('');
  return `<section><div class="head"><div><div class="eyebrow">Ricerca in tutta la casa</div><h2>${total} risultat${total===1?'o':'i'} per “${esc(q)}”</h2></div><button data-act="clear-search">Chiudi la ricerca</button></div></section>
  ${blocks || '<div class="empty">Nessun risultato. Prova con un nome, un numero di subalterno, un importo (es. 1716) o un anno.</div>'}`;
}

VIEWS.scadenze = viewScadenze;
VIEWS.detrazioni = viewDetrazioni;
VIEWS.cerca = viewCerca;

function clearSearch(){
  const g = $('#global-q'); if(g) g.value = '';
  UI.q = ''; route = UI.prevRoute || 'panoramica'; render();
}
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-act]'); if(!t) return;
  const id = t.dataset.id;
  if(t.dataset.act==='scad-done') scadDone(id);
  else if(t.dataset.act==='scad-spesa') scadSpesa(id);
  else if(t.dataset.act==='detr-from-spesa') detrFromSpesa(id);
  else if(t.dataset.act==='clear-search') clearSearch();
});
document.addEventListener('input', ev => {
  if(ev.target.id!=='global-q') return;
  const v = ev.target.value;
  UI.q = v;
  if(v.trim()){ if(route!=='cerca') UI.prevRoute = route; route = 'cerca'; }
  else route = UI.prevRoute || 'panoramica';
  render(); window.scrollTo(0,0);
});
document.addEventListener('keydown', ev => { if(ev.target.id==='global-q' && ev.key==='Escape'){ clearSearch(); } });

/* ---------- accesso (solo pagina pubblicata con Supabase) ---------- */
function viewLogin(msg){
  ['#tabs','.nav-pick','#global-q'].forEach(s => { const el = $(s); if(el) el.hidden = true; });
  const u = SupabaseAdapter.user;
  $('#view').innerHTML = `<section class="panel" style="max-width:440px;margin:40px auto"><h2>Accesso</h2>
    ${u ? `<p>Hai fatto l'accesso come <b>${esc(u.email)}</b>.</p>` : `<p class="muted">I dati della casa sono visibili solo ai familiari abilitati. Inserisci la tua email: riceverai un link per entrare.</p>
    <form id="login-form" novalidate><label class="f" for="login-email">Email<input id="login-email" type="email" autocomplete="email" required></label>
    <div class="actions"><button type="submit" class="primary" id="login-btn">Invia il link di accesso</button></div></form>`}
    <p class="small" id="login-msg" aria-live="polite">${esc(msg||'')}</p>
    ${u ? '<div class="actions"><button data-act="logout">Esci</button></div>' : ''}</section>`;
}
async function sendLoginLink(){
  const email = $('#login-email').value.trim(), msg = $('#login-msg'), btn = $('#login-btn');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ msg.textContent = 'Inserisci un indirizzo email valido.'; return; }
  btn.disabled = true; msg.textContent = 'Invio in corso…';
  // shouldCreateUser:false: entra solo chi è stato invitato dalla dashboard di Supabase
  const { error } = await SupabaseAdapter.sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
  btn.disabled = false;
  msg.textContent = !error ? 'Link inviato: apri l\'email da questo dispositivo e tocca il link.'
    : /signups? not allowed/i.test(error.message) ? 'Questo indirizzo non è abilitato. Chiedi di essere invitato.'
    : 'Invio non riuscito: ' + error.message;
}

(async function start(){
  $('#defs').innerHTML = SVG_DEFS;
  if(typeof CC_SUPABASE !== 'undefined'){
    Repo.adapter = SupabaseAdapter;
    try{ await SupabaseAdapter.connect(); }catch(e){ return viewLogin('Connessione a Supabase non riuscita: ' + (e.message||e)); }
    if(!SupabaseAdapter.user) return viewLogin();
    if(!SupabaseAdapter.ruolo) return viewLogin('Questo account non è ancora tra i membri abilitati.');
    try{ await Repo.init(); }catch(e){ return viewLogin('Caricamento dei dati non riuscito: ' + (e.message||e)); }
    history.replaceState(null, '', location.pathname + location.search + (location.hash.includes('access_token') ? '' : location.hash));
  }
  else await Repo.init();
  $('#brand-sub').textContent = (DB.immobile && DB.immobile.intestazione) || '';
  go();
  getDownloads();
})();
