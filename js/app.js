
let state = { pratiche: [], nextNum: 1 };
let ready = false;

function todayISO(){ return new Date().toISOString().slice(0,10); }
function todayIT(){
  const d = new Date();
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
}
document.getElementById('f-data').value = todayIT();
// campo data apertura lasciato libero per l'inserimento manuale

function fmtEuro(n){ return (Number(n)||0).toLocaleString('it-IT',{style:'currency',currency:'EUR'}); }
const STATI = {
  arrivo:{l:'In arrivo', c:'#8a8f98', e:'⚪'},
  lavorazione:{l:'In lavorazione', c:'#e0b000', e:'🟡'},
  da_lavorare_scansionata:{l:'Da lavorare scansionata', c:'#8d5a3b', e:'🟤'},
  da_pagare:{l:'Da pagare', c:'#f08a24', e:'🟠'},
  filca_non_paga:{l:'FILCA non paga', c:'#d63b3b', e:'🔴'},
  fps_non_paga:{l:'FPS non paga', c:'#d63b3b', e:'🔴'},
  lavorata:{l:'Lavorata', c:'#2f7de1', e:'🔵'},
  lavorata_da_fatturare:{l:'Lavorata da fatturare', c:'#8e5bd6', e:'🟣'},
  non_paga:{l:'Non paga', c:'#d63b3b', e:'🔴'},
  pagato:{l:'Pagato', c:'#2f9e5f', e:'🟢'},
  pagato_da_ritirare:{l:'Pagato da ritirare', c:'#2f9e5f', e:'🟢'},
  rinuncia_compilazione:{l:'Rinuncia alla compilazione', c:'#374151', e:'⚫'}
};
const TIPI_DEFAULT = ["730 SEDE","730 BRIGUGLIO ANTONIO","730 CAMINITI ANTONIO","730 CAMINITI LUIGI","730 RICCA AGATINO","730 FILCA","730 CRISAFULLI ROBERTO","730 FARAONE ARTURO","730 DECEDUTI","730 INTEGRATIVI/RETTIFICATIVI","730 TRIOLO CARMELA","730 DI BELLA SANTINO","CONTRATTI DI AFFITTO","CONTRATTI COLF E BADANTI"];
function getTipiList(){ return (state.collaboratori && state.collaboratori.length) ? state.collaboratori : TIPI_DEFAULT; }
Object.defineProperty(window, 'TIPI', { get: function(){ return getTipiList(); } });
function statoLabel(s){ return (STATI[s]||{}).l || s; }
function pallino(s){ return '<span class="dot" style="background:'+((STATI[s]||{}).c||'#8a8f98')+'"></span>'; }
function statoOptions(sel){ return Object.keys(STATI).map(k=>'<option value="'+k+'"'+(k===sel?' selected':'')+'>'+STATI[k].e+' '+STATI[k].l+'</option>').join(''); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function tipoOptions(sel){
  const list = (sel && TIPI.indexOf(sel)<0) ? [sel].concat(TIPI) : TIPI;
  return '<option value="">-</option>' + list.map(o=>'<option value="'+esc(o)+'"'+(o===sel?' selected':'')+'>'+esc(o)+'</option>').join('');
}

let chStati = null, chEur = null;
function aggiornaGrafici(fe, inc){
  if(!window.Chart) return;
  const cs = getComputedStyle(document.documentElement);
  const ink = cs.getPropertyValue('--ink').trim() || '#0f1b2d';
  const sub = cs.getPropertyValue('--sub').trim() || '#5b6b82';
  const card = cs.getPropertyValue('--card').trim() || '#ffffff';
  const cvS = document.getElementById('ch-stati');
  const cvE = document.getElementById('ch-eur');
  if(!cvS || !cvE) return;
  if(chStati && chStati.canvas !== cvS){ chStati.destroy(); chStati = null; }
  if(chEur && chEur.canvas !== cvE){ chEur.destroy(); chEur = null; }
  const keys = Object.keys(STATI).filter(function(k){ return state.pratiche.some(function(p){ return p.stato===k; }); });
  const dati = keys.map(function(k){ return state.pratiche.filter(function(p){ return p.stato===k; }).length; });
  const labs = keys.map(function(k){ return STATI[k].l; });
  const cols = keys.map(function(k){ return STATI[k].c; });
  if(!chStati){
    chStati = new Chart(cvS, {type:'doughnut', data:{labels:labs, datasets:[{data:dati, backgroundColor:cols, borderColor:card, borderWidth:2}]},
      options:{responsive:true, maintainAspectRatio:false, cutout:'62%', plugins:{legend:{position:'bottom', labels:{boxWidth:10, color:ink, font:{size:11}}}}}});
  } else {
    chStati.data.labels = labs; chStati.data.datasets[0].data = dati; chStati.data.datasets[0].backgroundColor = cols; chStati.update();
  }
  if(!chEur){
    chEur = new Chart(cvE, {type:'bar', data:{labels:['Fatture emesse','Incasso'], datasets:[{data:[fe,inc], backgroundColor:['#2f9e5f','#8e5bd6'], borderRadius:8, maxBarThickness:64}]},
      options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(c){ return fmtEuro(c.parsed.y); }}}},
        scales:{x:{ticks:{color:ink}, grid:{display:false}}, y:{beginAtZero:true, ticks:{color:sub, callback:function(v){ return '€ '+Number(v).toLocaleString('it-IT'); }}, grid:{color:'rgba(128,140,160,.18)'}}}}});
  } else {
    chEur.data.datasets[0].data = [fe,inc]; chEur.update();
  }
}

function toggleCong(cbId, inId){
  const on = document.getElementById(cbId).checked;
  const inp = document.getElementById(inId);
  inp.style.display = on ? '' : 'none';
  inp.disabled = !on;
  if(on){ inp.focus(); } else { inp.value = ''; }
}
function toggleCongBox(){
  const on = document.getElementById('f-congiunta-on').checked;
  document.getElementById('f-cong-box').style.display = on ? '' : 'none';
  if(!on){ ['f-cong-cognome','f-cong-nome','f-cong-data'].forEach(function(id){ document.getElementById(id).value=''; }); document.getElementById('cli-cerca-cong').value=''; }
}

function renderChips(containerId, selectId, items, getLabel, getVal, getDot, getColor){
  const cont = document.getElementById(containerId);
  const sel = document.getElementById(selectId);
  cont.innerHTML = items.map(function(it){
    const v = getVal(it), l = getLabel(it);
    const active = sel.value===v;
    let style = '';
    if(getColor){
      const c = getColor(it);
      style = active ? (' style="background:'+c+'; border-color:'+c+'; color:#12202b; font-weight:700"') : (' style="border-color:'+c+'55; background:'+c+'14; color:'+c+'"');
    }
    return '<button type="button" class="chip'+(active?' active':'')+'"'+style+' onclick="pickChip(\''+containerId+'\',\''+selectId+'\',\''+v.replace(/'/g,"\\'")+'\')">'+(getDot?getDot(it):'')+esc(l)+'</button>';
  }).join('');
}
let ARCHIVIO_CLIENTI = [];
function clienteEsiste(cognome, nome, dataNascita){
  const nc = (cognome+' '+nome).trim().toUpperCase();
  return ARCHIVIO_CLIENTI.some(function(c){ return c.nomeCompleto.toUpperCase() === nc && (c.dataNascita||'') === (dataNascita||''); });
}
function registraClienteSeNuovo(cognome, nome, dataNascita){
  cognome = (cognome||'').trim().toUpperCase();
  nome = (nome||'').trim().toUpperCase();
  if(!cognome && !nome) return;
  if(clienteEsiste(cognome, nome, dataNascita)) return;
  const nuovo = { nomeCompleto: (cognome+' '+nome).trim(), cognome: cognome, nome: nome, dataNascita: (dataNascita||'').trim() };
  ARCHIVIO_CLIENTI.push(nuovo);
  if(dbApi){ dbApi.collection('clienti_extra').add(nuovo).catch(function(e){ console.error('registrazione cliente', e); }); }
}
function subscribeClientiExtra(){
  dbApi.collection('clienti_extra').onSnapshot(function(qs){
    const base = ARCHIVIO_CLIENTI.filter(function(c){ return !c._extra; });
    const extra = qs.docs.map(function(d){ const c = Object.assign({ _extra:true }, d.data()); return c; });
    ARCHIVIO_CLIENTI = base.concat(extra);
  }, function(err){ console.error('sottoscrizione clienti extra', err); });
}
function caricaArchivioClienti(){
  const tag = document.getElementById('__clienti__');
  if(!tag) return;
  try{ ARCHIVIO_CLIENTI = JSON.parse(tag.textContent); }catch(e){ ARCHIVIO_CLIENTI = []; }
}
function cercaClienti(q, ctx){
  ctx = ctx || 'main';
  const box = document.getElementById(ctx==='cong' ? 'cli-results-cong' : 'cli-results');
  q = (q||'').trim().toLowerCase();
  if(!q){ box.classList.remove('open'); box.innerHTML=''; return; }
  const match = ARCHIVIO_CLIENTI.filter(function(c){ return c.nomeCompleto.toLowerCase().indexOf(q) >= 0; }).slice(0,8);
  if(!match.length){ box.innerHTML = '<div class="cli-row" style="cursor:default">Nessun cliente trovato</div>'; box.classList.add('open'); return; }
  box.innerHTML = match.map(function(c,i){
    return '<div class="cli-row" onclick="scegliCliente('+i+', &quot;'+ctx+'&quot;)" data-idx="'+i+'"><b>'+esc(c.nomeCompleto)+'</b><span class="sub2 sub">Nato/a il '+esc(c.dataNascita)+'</span></div>';
  }).join('');
  box.dataset.match = JSON.stringify(match);
  box.classList.add('open');
}
function scegliCliente(i, ctx){
  ctx = ctx || 'main';
  const box = document.getElementById(ctx==='cong' ? 'cli-results-cong' : 'cli-results');
  const match = JSON.parse(box.dataset.match || '[]');
  const c = match[i];
  if(!c) return;
  if(ctx==='cong'){
    document.getElementById('f-cong-cognome').value = c.cognome.toUpperCase();
    document.getElementById('f-cong-nome').value = c.nome.toUpperCase();
    document.getElementById('f-cong-data').value = c.dataNascita;
    document.getElementById('cli-cerca-cong').value = c.nomeCompleto;
  } else {
    document.getElementById('f-cognome').value = c.cognome.toUpperCase();
    document.getElementById('f-nome').value = c.nome.toUpperCase();
    document.getElementById('f-cf').value = c.dataNascita;
    document.getElementById('cli-cerca').value = c.nomeCompleto;
  }
  box.classList.remove('open');
}
document.addEventListener('click', function(e){
  [['cli-cerca','cli-results'], ['cli-cerca-cong','cli-results-cong']].forEach(function(pair){
    const wrap = document.getElementById(pair[0]);
    const box = document.getElementById(pair[1]);
    if(wrap && box && !wrap.contains(e.target) && !box.contains(e.target)) box.classList.remove('open');
  });
});

const ANNO_INIZIO_PROTOCOLLO = 2027;
function parseDataIT(s){
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s||'').trim());
  return m ? {g:+m[1], m:+m[2], a:+m[3]} : null;
}
function annoDiData(s){
  const d = parseDataIT(s);
  return d ? d.a : (new Date()).getFullYear();
}
function annoPratica(p){ return p.anno || annoDiData(p.data); }
async function prossimoNumeroProtocollo(anno){
  if(!dbApi){
    if(!state.nextNumByYear) state.nextNumByYear = {};
    const n = state.nextNumByYear[anno] || 1;
    state.nextNumByYear[anno] = n + 1;
    return n;
  }
  const ref = dbApi.doc('counters/anno_' + anno);
  const holder = 'h' + Math.random().toString(36).slice(2) + Date.now();
  for(let tentativi = 0; tentativi < 25; tentativi++){
    let res;
    try{ res = await ref.acquire({ holder: holder, ttlMs: 2000 }); }
    catch(e){ res = { acquired:false }; }
    if(res.acquired){
      let corrente = 1;
      try{ const snap = await ref.get(); corrente = (snap.exists && snap.data().next) || 1; }catch(e){}
      try{ await ref.set({ next: corrente + 1 }); }catch(e){}
      return corrente;
    }
    await new Promise(function(r){ setTimeout(r, 150 + Math.random()*200); });
  }
  return Date.now() % 100000;
}
function storicoClienteHTML(p){
  if(!p.nome) return '';
  const altre = (state.pratiche||[]).filter(function(x){ return x.nome === p.nome; });
  if(altre.length <= 1) return '';
  const totFatt = altre.reduce(function(a,x){ return a+Number(x.compenso||0); }, 0);
  const totPag = altre.reduce(function(a,x){ return a+Number(x.pagato||0); }, 0);
  const anni = Array.from(new Set(altre.map(annoPratica))).sort();
  return '<div class="meta" style="margin-top:6px; padding-top:6px; border-top:1px dashed var(--line)">'
    + '<b>Storico cliente (tutti gli anni: ' + anni.join(', ') + ')</b><br>'
    + altre.length + ' pratiche · Fatturato totale: ' + fmtEuro(totFatt) + ' · Pagato totale: ' + fmtEuro(totPag)
    + '</div>';
}
function formattaInserimento(p){
  if(!p.inseritoDa && !p.inseritoIl) return '-';
  let quando = '';
  if(p.inseritoIl){
    const d = new Date(p.inseritoIl);
    if(!isNaN(d.getTime())){
      quando = String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    }
  }
  return (p.inseritoDa||'-') + (quando ? '<div class="sub2">'+quando+'</div>' : '');
}
function formattaProtocollo(p){
  const anno = annoPratica(p);
  const num = String(p.numero).padStart(4,'0');
  return anno >= ANNO_INIZIO_PROTOCOLLO ? (num + '/' + anno) : num;
}
function elencoAnniDisponibili(){
  const anni = new Set();
  anni.add(ANNO_INIZIO_PROTOCOLLO);
  anni.add((new Date()).getFullYear());
  state.pratiche.forEach(function(p){ anni.add(annoPratica(p)); });
  (state.versamenti||[]).forEach(function(v){ anni.add(annoDiData(v.data)); });
  return Array.from(anni).sort(function(a,b){ return a-b; });
}
let annoAttivoLocale = null;
function annoAttivo(){
  if(!annoAttivoLocale){
    let salvato = null;
    try{ salvato = parseInt(localStorage.getItem('protocollo-anno'), 10); }catch(e){}
    annoAttivoLocale = salvato || Math.max(ANNO_INIZIO_PROTOCOLLO, (new Date()).getFullYear());
  }
  return annoAttivoLocale;
}
function initSelettoreAnno(){
  const sel = document.getElementById('anno-attivo');
  if(!sel) return;
  const anni = elencoAnniDisponibili();
  const cur = annoAttivo();
  sel.innerHTML = anni.map(function(a){ return '<option value="'+a+'"'+(a===cur?' selected':'')+'>'+a+(a<ANNO_INIZIO_PROTOCOLLO?' (storico)':'')+'</option>'; }).join('');
}
function cambiaAnnoAttivo(v){
  annoAttivoLocale = parseInt(v,10);
  try{ localStorage.setItem('protocollo-anno', v); }catch(e){}
  render();
}

const TAB_LABELS = {
  anagrafica: 'INSERIMENTO ANAGRAFICA',
  registro: 'REGISTRO DI PROTOCOLLO',
  contabilita: "CONTABILITA'",
  caf: 'VERSAMENTI CAF',
  collaboratori: 'COLLABORATORI'
};
let currentUser = null;
let loginSelezionato = null;
function permessiDefault(){
  return { tabs: { anagrafica:true, registro:true, contabilita:false, caf:false, collaboratori:false }, soloLettura: true };
}
function utentiDefault(){
  return [
    { id:'angelo', nome:'ANGELO', password:'', ruolo:'admin', permessi: permessiDefault() },
    { id:'federica', nome:'FEDERICA', password:'', ruolo:'operatore', permessi: (state.permessi || permessiDefault()) }
  ];
}
function getUtenti(){
  if(!state.utenti || !state.utenti.length) state.utenti = utentiDefault();
  return state.utenti;
}
function trovaUtente(id){
  return getUtenti().find(function(u){ return u.id === id; });
}
function renderLogin(){
  const wrap = document.getElementById('login-lista');
  if(!wrap) return;
  wrap.innerHTML = getUtenti().map(function(u){
    return '<button type="button" class="login-btn" onclick="selezionaLogin(&quot;'+u.id+'&quot;)">👤 '+esc(u.nome)+(u.ruolo==='admin'?' — Amministratore':'')+'</button>';
  }).join('');
}
function selezionaLogin(id){
  loginSelezionato = id;
  document.getElementById('login-pwd-box').style.display = '';
  document.getElementById('login-pwd').value = '';
  document.getElementById('login-msg').style.display = 'none';
  document.getElementById('login-pwd').focus();
}
function confermaLogin(){
  const u = trovaUtente(loginSelezionato);
  if(!u) return;
  const pwd = document.getElementById('login-pwd').value;
  if((u.password||'') !== pwd){
    const msg = document.getElementById('login-msg');
    msg.textContent = '⚠️ Password errata.';
    msg.style.display = 'block';
    return;
  }
  accedi(u.id);
}
function accedi(id){
  currentUser = id;
  try{ localStorage.setItem('protocollo-utente', id); }catch(e){}
  document.getElementById('login-overlay').style.display = 'none';
  applicaPermessi();
}
function cambiaUtente(){
  loginSelezionato = null;
  document.getElementById('login-pwd-box').style.display = 'none';
  document.getElementById('login-msg').style.display = 'none';
  renderLogin();
  document.getElementById('login-overlay').style.display = 'flex';
}
function esciDalProgramma(){
  currentUser = null;
  try{ localStorage.removeItem('protocollo-utente'); }catch(e){}
  cambiaUtente();
}
function applicaPermessi(){
  const bar = document.getElementById('userbar');
  const u = trovaUtente(currentUser);
  if(!u){ cambiaUtente(); return; }
  const isAdmin = u.ruolo === 'admin';
  bar.innerHTML = '<span>Accesso come <b>'+esc(u.nome)+(isAdmin?' (amministratore)':'')+'</b></span><button type="button" onclick="cambiaUtente()">Cambia utente</button><button type="button" onclick="esciDalProgramma()">🚪 Esci dal programma</button>';
  document.getElementById('nav-permessi').style.display = isAdmin ? '' : 'none';
  const perm = u.permessi || permessiDefault();
  Object.keys(TAB_LABELS).forEach(function(tab){
    const btn = document.querySelector('.navmenu button[data-tab="'+tab+'"]');
    if(!btn) return;
    const visibile = isAdmin || perm.tabs[tab];
    btn.style.display = visibile ? '' : 'none';
  });
  document.body.classList.toggle('sola-lettura', !isAdmin && perm.soloLettura);
  const attivo = document.querySelector('.navmenu button.active');
  if(!attivo || attivo.style.display === 'none'){
    const primo = Array.from(document.querySelectorAll('.navmenu button')).find(function(b){ return b.style.display !== 'none'; });
    if(primo) showTab(primo);
  }
  if(document.getElementById('tab-permessi').classList.contains('active')) renderPermessi();
}
function salvaUtenti(lista){
  if(dbApi){ dbApi.doc('config/utenti').set({ lista: lista }).catch(function(e){ console.error(e); }); }
  else { state.utenti = lista; embedState(); }
}
function aggiungiUtente(){
  const nome = document.getElementById('nu-nome').value.trim().toUpperCase();
  const pwd = document.getElementById('nu-pwd').value;
  if(!nome){ return; }
  const lista = getUtenti().slice();
  const id = 'u' + Date.now();
  lista.push({ id:id, nome:nome, password:pwd, ruolo:'operatore', permessi: permessiDefault() });
  document.getElementById('nu-nome').value = '';
  document.getElementById('nu-pwd').value = '';
  salvaUtenti(lista);
  if(!dbApi) renderPermessi();
}
function rimuoviUtente(id){
  const lista = getUtenti().filter(function(u){ return u.id !== id; });
  salvaUtenti(lista);
  if(!dbApi) renderPermessi();
}
function cambiaMiaPassword(){
  const pwd = document.getElementById('mia-pwd').value;
  cambiaPasswordUtente(currentUser, pwd);
  document.getElementById('mia-pwd').value = '';
  const msg = document.getElementById('mia-pwd-msg');
  msg.style.display = 'block';
  setTimeout(function(){ msg.style.display = 'none'; }, 3000);
}
function cambiaPasswordUtente(id, pwd){
  const lista = getUtenti().slice();
  const u = lista.find(function(x){ return x.id===id; });
  if(u) u.password = pwd;
  salvaUtenti(lista);
}
function dataOraFile(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'_'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0');
}
function pulisciArray(arr){
  return (arr||[]).map(function(x){ var c=Object.assign({},x); delete c._editing; delete c._confirmDelete; delete c._editingFattura; return c; });
}
async function esportaBackupJSON(){
  const downloads = await claude.use('downloads').catch(function(){ return null; });
  if(!downloads){ alert('Il download non è disponibile in questa sessione.'); return; }
  const payload = {
    versione: 1,
    esportatoIl: new Date().toISOString(),
    pratiche: pulisciArray(state.pratiche),
    versamenti: pulisciArray(state.versamenti),
    collaboratori: state.collaboratori || TIPI_DEFAULT.slice(),
    permessi: state.permessi || permessiDefault(),
    utenti: pulisciArray(getUtenti())
  };
  try{
    await downloads.save({ filename: 'backup-protocollo-' + dataOraFile() + '.json', data: JSON.stringify(payload, null, 2) });
  }catch(e){ console.error('esportazione backup', e); }
}
const PALETTE_COLLABORATORI = ['#1d4f91','#2f9e5f','#c0392b','#8e5bd6','#d98b1e','#2f9e9e','#b5486b','#5a6b3b','#3b6fa0','#a0522d','#5e4fa2','#1f8a70','#c2622f','#4a6b8a','#9c3f7a'];
function coloreCollaboratore(nome){
  let h = 0;
  const s = String(nome||'');
  for(let i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i)) >>> 0; }
  return PALETTE_COLLABORATORI[h % PALETTE_COLLABORATORI.length];
}
function nomeFoglio(s){
  return String(s||'Senza tipo').replace(/[\\\/\?\*\[\]:]/g,' ').slice(0,31) || 'Foglio';
}
function rigaPratica(p){
  return {
    'N. Protocollo': formattaProtocolloTesto(p),
    'Data': p.data||'',
    'Cognome e Nome': p.nome||'',
    'Congiunta': p.congiunta||'',
    'Data nascita': p.cf||'',
    'Telefono': p.telefono||'',
    'Stato': statoLabel(p.stato),
    'Fattura (€)': Number(p.compenso)||0,
    'Pagato (€)': Number(p.pagato)||0,
    'N. Fattura': p.numFattura||'',
    'Data Fattura': p.dataFattura||'',
    'Inserito da': p.inseritoDa||'',
    'Note': p.note||''
  };
}
function formattaProtocolloTesto(p){
  const anno = annoPratica(p);
  const num = String(p.numero).padStart(4,'0');
  return anno >= ANNO_INIZIO_PROTOCOLLO ? (num + '/' + anno) : num;
}
async function esportaRegistroExcel(){
  const downloads = await claude.use('downloads').catch(function(){ return null; });
  if(!downloads){ alert('Il download non è disponibile in questa sessione.'); return; }
  if(!window.XLSX){ alert('La libreria per generare il file Excel non si è caricata. Riprova tra poco.'); return; }

  const anno = annoAttivo();
  const tutte = (state.pratiche||[]).filter(function(p){ return annoPratica(p) === anno; });
  const gruppi = {};
  tutte.forEach(function(p){ const k = p.tipo || 'SENZA TIPO'; if(!gruppi[k]) gruppi[k] = []; gruppi[k].push(p); });
  const nomiGruppi = getTipiList().concat(Object.keys(gruppi).filter(function(k){ return getTipiList().indexOf(k) < 0; }));

  const fattureEmesse = tutte.reduce(function(a,p){ return a+Number(p.compenso||0); }, 0);
  const incassoLordo = tutte.reduce(function(a,p){ return a+Number(p.pagato||0); }, 0);
  const versAnno = (state.versamenti||[]).filter(function(v){ return annoDiData(v.data) === anno; });
  const versatoCaf = versAnno.reduce(function(a,v){ return a+Number(v.importo||0); }, 0);
  const incasso = incassoLordo - versatoCaf;
  const DA_LAVORARE = ['arrivo','lavorazione','da_lavorare_scansionata'];
  const daLavorare = tutte.filter(function(p){ return DA_LAVORARE.indexOf(p.stato)>=0; }).length;
  const rinunce = tutte.filter(function(p){ return p.stato==='rinuncia_compilazione'; }).length;
  const lavorate = tutte.length - daLavorare - rinunce;

  const contabRighe = [
    { 'Voce':'Anno di protocollo', 'Valore': anno },
    { 'Voce':'Pratiche totali', 'Valore': tutte.length },
    { 'Voce':'Lavorate', 'Valore': lavorate },
    { 'Voce':'Da lavorare', 'Valore': daLavorare },
    { 'Voce':'Rinuncia alla compilazione', 'Valore': rinunce },
    { 'Voce':'Fatture emesse (€)', 'Valore': fattureEmesse },
    { 'Voce':'Incasso (€)', 'Valore': incasso },
    { 'Voce':'Pagamenti CAF (€)', 'Valore': versatoCaf },
    { 'Voce':'Incasso − Fatture (€)', 'Valore': incasso - fattureEmesse },
    { 'Voce':'', 'Valore':'' },
    { 'Voce':'Dettaglio per collaboratore / tipo pratica', 'Valore':'' }
  ];
  nomiGruppi.forEach(function(k){
    const items = gruppi[k] || [];
    if(!items.length) return;
    const fe = items.reduce(function(a,p){ return a+Number(p.compenso||0); }, 0);
    const inc = items.reduce(function(a,p){ return a+Number(p.pagato||0); }, 0);
    contabRighe.push({ 'Voce': k + ' (' + items.length + ' pratiche)', 'Valore': 'Fatture ' + fe.toFixed(2) + ' € · Incasso ' + inc.toFixed(2) + ' €' });
  });

  const wb = XLSX.utils.book_new();
  const wsContab = XLSX.utils.json_to_sheet(contabRighe, { skipHeader:false });
  XLSX.utils.book_append_sheet(wb, wsContab, 'Contabilita');

  nomiGruppi.forEach(function(k){
    const items = (gruppi[k] || []).slice().sort(function(a,b){ return a.numero-b.numero; });
    if(!items.length) return;
    const righe = items.map(rigaPratica);
    const ws = XLSX.utils.json_to_sheet(righe);
    XLSX.utils.book_append_sheet(wb, ws, nomeFoglio(k));
  });

  const buf = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  try{
    await downloads.save({ filename: 'registro-protocollo-' + anno + '-' + dataOraFile() + '.xlsx', data: new Blob([buf], { type:'application/octet-stream' }) });
  }catch(e){ console.error('esportazione excel', e); }
}
async function importaBackup(){
  const inp = document.getElementById('import-file');
  const msg = document.getElementById('import-msg');
  msg.style.display = 'none';
  if(!inp.files || !inp.files.length){
    msg.textContent = '⚠️ Scegli prima un file .json da importare.'; msg.style.display='block'; return;
  }
  if(!confirm('Importando questo file, tutti i dati attuali (pratiche, versamenti, collaboratori, utenti) verranno sostituiti. Continuare?')) return;
  const btn = document.getElementById('btn-importa');
  btn.disabled = true; btn.textContent = 'Importazione in corso...';
  try{
    const testo = await inp.files[0].text();
    const dati = JSON.parse(testo);
    if(!dati || !Array.isArray(dati.pratiche)) throw new Error('Il file non sembra un backup valido.');
    if(dbApi){
      const vecchie = await dbApi.collection('pratiche').get();
      for(const d of vecchie.docs){ await dbApi.doc('pratiche/'+d.id).delete(); }
      for(const p of dati.pratiche){ await dbApi.collection('pratiche').add(pulisciArray([p])[0]); }
      const vecchiV = await dbApi.collection('versamenti').get();
      for(const d of vecchiV.docs){ await dbApi.doc('versamenti/'+d.id).delete(); }
      for(const v of (dati.versamenti||[])){ await dbApi.collection('versamenti').add(pulisciArray([v])[0]); }
      if(dati.collaboratori) await dbApi.doc('config/collaboratori').set({ lista: dati.collaboratori });
      if(dati.permessi) await dbApi.doc('config/permessi').set(dati.permessi);
      if(dati.utenti && dati.utenti.length) await dbApi.doc('config/utenti').set({ lista: dati.utenti });
      const maxPerAnno = {};
      dati.pratiche.forEach(function(p){ const a = p.anno || annoDiData(p.data); maxPerAnno[a] = Math.max(maxPerAnno[a]||0, Number(p.numero)||0); });
      for(const anno in maxPerAnno){ await dbApi.doc('counters/anno_'+anno).set({ next: maxPerAnno[anno]+1 }); }
    } else {
      state.pratiche = dati.pratiche;
      state.versamenti = dati.versamenti || [];
      state.collaboratori = dati.collaboratori || TIPI_DEFAULT.slice();
      state.permessi = dati.permessi || permessiDefault();
      state.utenti = dati.utenti && dati.utenti.length ? dati.utenti : utentiDefault();
      embedState();
    }
    msg.style.color = 'var(--accent)';
    msg.textContent = '✅ Backup importato correttamente.'; msg.style.display='block';
    inp.value = '';
    render();
  }catch(e){
    console.error('importazione backup', e);
    msg.style.color = '#c0392b';
    msg.textContent = '⚠️ Importazione non riuscita: file non valido o danneggiato.'; msg.style.display='block';
  }
  btn.disabled = false; btn.textContent = 'Importa Backup';
}

let confermaSvuota = false;
async function svuotaRegistro(){
  const btn = document.getElementById('btn-svuota');
  if(!confermaSvuota){
    confermaSvuota = true;
    if(btn){ btn.textContent = 'Sei sicuro? Clicca di nuovo per confermare'; btn.style.background = '#c0392b'; btn.style.color = '#fff'; }
    setTimeout(function(){ confermaSvuota = false; if(btn){ btn.textContent = 'Svuota registro (elimina tutte le pratiche)'; btn.style.background=''; btn.style.color=''; } }, 6000);
    return;
  }
  confermaSvuota = false;
  if(btn){ btn.disabled = true; btn.textContent = 'Eliminazione in corso...'; }
  if(dbApi){
    try{
      const snap = await dbApi.collection('pratiche').get();
      for(const d of snap.docs){ await dbApi.doc('pratiche/'+d.id).delete(); }
      for(const anno of elencoAnniDisponibili()){ try{ await dbApi.doc('counters/anno_'+anno).delete(); }catch(e){} }
    }catch(e){ console.error('svuotamento registro', e); }
  } else {
    state.pratiche = [];
  }
  if(btn){ btn.disabled = false; btn.textContent = 'Svuota registro (elimina tutte le pratiche)'; }
  render();
}
function renderPermessi(){
  const wrap = document.getElementById('perm-lista');
  const operatori = getUtenti().filter(function(u){ return u.ruolo !== 'admin'; });
  wrap.innerHTML = operatori.length ? operatori.map(function(u){
    const perm = u.permessi || permessiDefault();
    const righeTab = Object.keys(TAB_LABELS).map(function(tab){
      return '<div class="perm-row"><span>'+TAB_LABELS[tab]+'</span><label class="chk"><input type="checkbox" '+(perm.tabs[tab]?'checked':'')+' onchange="togglePermTab(&quot;'+u.id+'&quot;,&quot;'+tab+'&quot;,this.checked)"> Visibile</label></div>';
    }).join('');
    return '<div class="card" style="margin-bottom:12px">'
      + '<div class="raff-title">'+esc(u.nome)+'</div>'
      + righeTab
      + '<div class="perm-row" style="margin-top:6px; border-top:2px solid var(--line); padding-top:12px"><span>Sola lettura</span><label class="chk"><input type="checkbox" '+(perm.soloLettura?'checked':'')+' onchange="togglePermSoloLettura(&quot;'+u.id+'&quot;,this.checked)"> Attiva</label></div>'
      + '<div class="perm-row"><span>Nuova password</span><span style="display:flex; gap:6px"><input type="password" id="pwd-'+u.id+'" placeholder="Lascia vuoto per non cambiarla" style="width:160px; padding:6px 8px; font-size:12.5px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--ink)"><button type="button" style="background:var(--line); color:var(--ink); border:none; border-radius:6px; padding:6px 10px; font-size:12px; cursor:pointer" onclick="cambiaPasswordUtente(&quot;'+u.id+'&quot;, document.getElementById(&quot;pwd-'+u.id+'&quot;).value); document.getElementById(&quot;pwd-'+u.id+'&quot;).value=&quot;&quot;">Salva</button></span></div>'
      + '<div class="perm-row"><span></span><button type="button" style="background:none; border:none; color:#c0392b; font-weight:700; cursor:pointer" onclick="rimuoviUtente(&quot;'+u.id+'&quot;)">Elimina utente</button></div>'
      + '</div>';
  }).join('') : '<div class="empty">Nessun operatore oltre all\'amministratore</div>';
}
function togglePermTab(id, tab, val){
  const u = trovaUtente(id);
  if(!u) return;
  if(!u.permessi) u.permessi = permessiDefault();
  u.permessi.tabs[tab] = val;
  salvaUtenti(getUtenti());
}
function togglePermSoloLettura(id, val){
  const u = trovaUtente(id);
  if(!u) return;
  if(!u.permessi) u.permessi = permessiDefault();
  u.permessi.soloLettura = val;
  salvaUtenti(getUtenti());
}

let dbApi = null;
function pulisciPerDb(obj){
  const c = {};
  Object.keys(obj).forEach(function(k){ if(k.charAt(0)!=='_' && k!=='id') c[k]=obj[k]; });
  return c;
}
async function initDb(){
  try{ dbApi = await claude.use('db'); }catch(e){ dbApi = null; }
  const avviso = document.getElementById('db-avviso');
  if(!dbApi){
    if(avviso) avviso.style.display = 'block';
    return;
  }
  if(avviso) avviso.style.display = 'none';
  await migraDatiSeNecessario();
  subscribePratiche();
  subscribeVersamenti();
  subscribeClientiExtra();
  subscribeConfig();
}
async function migraDatiSeNecessario(){
  try{
    const snap = await dbApi.collection('pratiche').limit(1).get();
    if(snap.empty && state.pratiche && state.pratiche.length){
      for(const p of state.pratiche){ await dbApi.collection('pratiche').add(pulisciPerDb(p)); }
    }
  }catch(e){ console.error('migrazione pratiche', e); }
  try{
    const collDoc = await dbApi.doc('config/collaboratori').get();
    if(!collDoc.exists){ await dbApi.doc('config/collaboratori').set({ lista: (state.collaboratori && state.collaboratori.length) ? state.collaboratori : TIPI_DEFAULT }); }
  }catch(e){ console.error('migrazione collaboratori', e); }
  try{
    const permDoc = await dbApi.doc('config/permessi').get();
    if(!permDoc.exists){ await dbApi.doc('config/permessi').set(state.permessi || permessiDefault()); }
  }catch(e){ console.error('migrazione permessi', e); }
  try{
    const utDoc = await dbApi.doc('config/utenti').get();
    if(!utDoc.exists){ await dbApi.doc('config/utenti').set({ lista: getUtenti() }); }
    else if(utDoc.data().lista){ state.utenti = utDoc.data().lista; }
  }catch(e){ console.error('migrazione utenti', e); }
  try{
    if(state.versamenti && state.versamenti.length){
      const vsnap = await dbApi.collection('versamenti').limit(1).get();
      if(vsnap.empty){ for(const v of state.versamenti){ await dbApi.collection('versamenti').add(pulisciPerDb(v)); } }
    }
  }catch(e){ console.error('migrazione versamenti', e); }
  try{
    const maxPerAnno = {};
    (state.pratiche||[]).forEach(function(p){
      const a = annoPratica(p);
      maxPerAnno[a] = Math.max(maxPerAnno[a] || 0, Number(p.numero)||0);
    });
    for(const anno in maxPerAnno){
      const cdoc = dbApi.doc('counters/anno_'+anno);
      const csnap = await cdoc.get();
      if(!csnap.exists) await cdoc.set({ next: maxPerAnno[anno] + 1 });
    }
  }catch(e){ console.error('migrazione contatori', e); }
}
function subscribePratiche(){
  dbApi.collection('pratiche').onSnapshot(function(qs){
    const flags = {};
    (state.pratiche||[]).forEach(function(p){
      if(p._editing || p._confirmDelete) flags[p.id] = { _editing:p._editing, _confirmDelete:p._confirmDelete };
    });
    state.pratiche = qs.docs.map(function(d){
      const obj = Object.assign({ id:d.id }, d.data());
      if(flags[d.id]) Object.assign(obj, flags[d.id]);
      return obj;
    });
    render();
  }, function(err){ console.error('sottoscrizione pratiche', err); });
}
function subscribeVersamenti(){
  dbApi.collection('versamenti').onSnapshot(function(qs){
    state.versamenti = qs.docs.map(function(d){ return Object.assign({ id:d.id }, d.data()); });
    render();
  }, function(err){ console.error('sottoscrizione versamenti', err); });
}
function subscribeConfig(){
  dbApi.doc('config/collaboratori').onSnapshot(function(d){
    if(d.exists){ state.collaboratori = d.data().lista || []; initTipoBtns(); renderCollaboratori(); render(); }
  }, function(err){ console.error('sottoscrizione collaboratori', err); });
  dbApi.doc('config/permessi').onSnapshot(function(d){
    if(d.exists){ state.permessi = d.data(); applicaPermessi(); }
  }, function(err){ console.error('sottoscrizione permessi', err); });
  dbApi.doc('config/utenti').onSnapshot(function(d){
    if(d.exists && d.data().lista){
      state.utenti = d.data().lista;
      if(document.getElementById('login-overlay').style.display !== 'none') renderLogin();
      applicaPermessi();
    }
  }, function(err){ console.error('sottoscrizione utenti', err); });
}

const chipDDLabel = {};
function toggleDD(ddId){
  document.getElementById(ddId).classList.toggle('open');
}
function pickChip(containerId, selectId, val){
  document.getElementById(selectId).value = val;
  Array.from(document.getElementById(containerId).children).forEach(function(b){ b.classList.remove('active'); });
  const idx = Array.from(document.getElementById(selectId).options).findIndex(function(o){ return o.value===val; });
  if(document.getElementById(containerId).children[idx]) document.getElementById(containerId).children[idx].classList.add('active');
  const chip = document.getElementById(containerId).children[idx];
  const dd = document.getElementById(containerId).closest('.chip-dd');
  if(dd){
    const lbl = dd.querySelector('[id$="-dd-label"]');
    if(lbl && chip){ lbl.innerHTML = chip.innerHTML; }
    dd.classList.remove('open');
  }
}
function showTab(btn){
  const tab = btn.dataset.tab;
  document.querySelectorAll('.tabsec').forEach(function(s){ s.classList.remove('active'); });
  document.querySelectorAll('.navmenu button').forEach(function(b){ b.classList.remove('active'); });
  const sec = document.getElementById('tab-'+tab);
  if(sec) sec.classList.add('active');
  btn.classList.add('active');
  if(tab === 'collaboratori') renderCollaboratori();
  if(tab === 'permessi') renderPermessi();
}
function renderCollaboratori(){
  const wrap = document.getElementById('coll-lista');
  if(!wrap) return;
  const lista = getTipiList();
  wrap.innerHTML = lista.length ? lista.map(function(c){
    return '<div class="coll-row"><span>'+esc(c)+'</span><button onclick="rimuoviCollaboratore('+"'"+c.replace(/'/g,"\\'")+"'"+')">✕</button></div>';
  }).join('') : '<div class="empty">Nessun collaboratore</div>';
}
function aggiungiCollaboratore(){
  const inp = document.getElementById('coll-nuovo');
  const v = inp.value.trim().toUpperCase();
  if(!v) return;
  const lista = (state.collaboratori && state.collaboratori.length) ? state.collaboratori.slice() : TIPI_DEFAULT.slice();
  if(lista.indexOf(v) < 0) lista.push(v);
  inp.value = '';
  if(dbApi){
    dbApi.doc('config/collaboratori').set({ lista: lista }).catch(function(e){ console.error(e); });
  } else {
    state.collaboratori = lista;
    renderCollaboratori(); initTipoBtns(); embedState();
  }
}
function rimuoviCollaboratore(v){
  const lista = ((state.collaboratori && state.collaboratori.length) ? state.collaboratori : TIPI_DEFAULT).filter(function(c){ return c!==v; });
  if(dbApi){
    dbApi.doc('config/collaboratori').set({ lista: lista }).catch(function(e){ console.error(e); });
  } else {
    state.collaboratori = lista;
    renderCollaboratori(); initTipoBtns(); embedState();
  }
}

function initTipoBtns(){
  const sel = document.getElementById('f-tipo');
  sel.innerHTML = TIPI.map(function(o){ return '<option value="'+esc(o)+'">'+esc(o)+'</option>'; }).join('');
  renderChips('f-tipo-btns','f-tipo', TIPI, function(o){ return o; }, function(o){ return o; });
  const lbl = document.getElementById('f-tipo-dd-label');
  if(lbl && sel.value){ lbl.textContent = sel.value; }
}
function initStatoBtns(){
  const sel = document.getElementById('f-stato');
  sel.innerHTML = statoOptions('arrivo');
  renderChips('f-stato-btns','f-stato', Object.keys(STATI), function(k){ return STATI[k].l; }, function(k){ return k; }, null, function(k){ return STATI[k].c; });
  const chip = document.getElementById('f-stato-btns').querySelector('.active');
  const lbl = document.getElementById('f-stato-dd-label');
  if(lbl && chip){ lbl.innerHTML = chip.innerHTML; }
}
document.addEventListener('click', function(e){
  document.querySelectorAll('.chip-dd.open').forEach(function(dd){
    if(!dd.contains(e.target)) dd.classList.remove('open');
  });
});

function totCaf(){ return (state.versamenti||[]).reduce(function(a,v){ return a+Number(v.importo||0); }, 0); }

function parseImporto(v){
  return Number(String(v||'').trim().replace(/\./g,'').replace(',', '.'));
}
function aggiungiIsee(){
  const msg = document.getElementById('isee-msg');
  if(msg) msg.style.display = 'none';
  const nome = document.getElementById('is-nome').value.trim().toUpperCase();
  const impRaw = document.getElementById('is-importo').value;
  const imp = parseImporto(impRaw);
  const dat = document.getElementById('is-data').value;
  if(!nome || !impRaw || !(imp>0) || isNaN(imp)){
    if(msg){ msg.textContent = '⚠️ Inserisci nominativo e un importo valido.'; msg.style.display='block'; }
    return;
  }
  const nuovo = { nome: nome, importo: imp, data: dat, pagato: false };
  document.getElementById('is-nome').value = '';
  document.getElementById('is-importo').value = '';
  document.getElementById('is-data').value = '';
  if(dbApi){
    dbApi.collection('isee').add(nuovo).catch(function(e){ console.error(e); });
  } else {
    nuovo.id = 'is'+Date.now();
    if(!state.isee) state.isee = [];
    state.isee.push(nuovo);
    render(); embedState();
  }
}
function toggleIseePagato(id, val){
  if(dbApi){ dbApi.doc('isee/'+id).update({ pagato: val }).catch(function(e){ console.error(e); }); }
  else { const x = (state.isee||[]).find(function(i){ return i.id===id; }); if(x){ x.pagato=val; render(); embedState(); } }
}
function rimuoviIsee(id){
  if(dbApi){ dbApi.doc('isee/'+id).delete().catch(function(e){ console.error(e); }); }
  else { state.isee = (state.isee||[]).filter(function(i){ return i.id!==id; }); render(); embedState(); }
}
function aggiungiVersamento(){
  const msg = document.getElementById('caf-msg');
  if(msg) msg.style.display = 'none';
  const impRaw = document.getElementById('vc-importo').value;
  const imp = parseImporto(impRaw);
  const dat = document.getElementById('vc-data').value;
  const caus = document.getElementById('vc-causale').value.trim();
  if(!impRaw || !(imp > 0) || isNaN(imp)){
    if(msg){ msg.textContent = '⚠️ Inserisci un importo valido, es. 50,00'; msg.style.display = 'block'; }
    return;
  }
  const nuovoVers = { importo:imp, data:dat, causale:caus };
  document.getElementById('vc-importo').value='';
  document.getElementById('vc-data').value='';
  document.getElementById('vc-causale').value='';
  if(dbApi){
    dbApi.collection('versamenti').add(nuovoVers).catch(function(e){ console.error(e); });
  } else {
    nuovoVers.id = 'v'+Date.now();
    if(!state.versamenti) state.versamenti = [];
    state.versamenti.push(nuovoVers);
    render(); embedState();
  }
}
function rimuoviVersamento(id){
  if(dbApi){
    dbApi.doc('versamenti/'+id).delete().catch(function(e){ console.error(e); });
  } else {
    state.versamenti = (state.versamenti||[]).filter(function(v){ return v.id!==id; });
    render(); embedState();
  }
}

const aperti = {};
function gToggle(el){ aperti[el.dataset.k] = el.open; }
function initFiltroStato(){
  const sel = document.getElementById('filtro-stato');
  if(!sel || sel.options.length) return;
  sel.innerHTML = '<option value="">Tutti gli stati</option>' + Object.keys(STATI).map(function(k){
    return '<option value="'+k+'">'+STATI[k].e+' '+STATI[k].l+'</option>';
  }).join('');
}
function filtra(lista){
  initFiltroStato();
  const statoSel = (document.getElementById('filtro-stato')||{}).value || '';
  if(statoSel){ lista = lista.filter(function(p){ return p.stato === statoSel; }); }
  const q = ((document.getElementById('cerca')||{}).value||'').trim().toLowerCase();
  if(!q) return lista;
  return lista.filter(function(p){
    return [String(p.numero).padStart(4,'0'), p.nome, p.congiunta, p.congData, p.telefono, p.tipo, p.cf, p.data, p.note, statoLabel(p.stato), p.numFattura, p.inseritoDa].join(' ').toLowerCase().indexOf(q) >= 0;
  });
}

function render(){
  const list = document.getElementById('gruppi'); const oldList = document.getElementById('list'); if(oldList) oldList.innerHTML = '';
  const summary = document.getElementById('summary');
  initSelettoreAnno();
  const annoSel = annoAttivo();
  const pratAnno = state.pratiche.filter(function(p){ return annoPratica(p) === annoSel; });

  const contaOperatori = {};
  pratAnno.forEach(function(p){
    const chi = p.inseritoDa || 'NON INDICATO';
    const peso = (p.congCognome || p.congNome) ? 2 : 1;
    contaOperatori[chi] = (contaOperatori[chi]||0) + peso;
  });
  const lavorateEl = document.getElementById('badge-lavorate');
  if(lavorateEl){
    const lavorataPratiche = pratAnno.filter(function(p){ return p.stato === 'lavorata'; });
    const pesoCong = function(p){ return (p.congCognome || p.congNome) ? 2 : 1; };
    const lavAngelo = lavorataPratiche.filter(function(p){ return (p.inseritoDa||'').toUpperCase() === 'ANGELO'; }).reduce(function(a,p){ return a+pesoCong(p); }, 0);
    const lavFederica = lavorataPratiche.filter(function(p){ return (p.inseritoDa||'').toUpperCase() === 'FEDERICA'; }).reduce(function(a,p){ return a+pesoCong(p); }, 0);
    lavorateEl.innerHTML =
      '<span style="background:rgba(0,0,0,.25); color:#fff; font-size:11.5px; font-weight:700; padding:5px 10px; border-radius:999px">🔵 Angelo: '+lavAngelo+'</span>'
      + '<span style="background:rgba(0,0,0,.25); color:#fff; font-size:11.5px; font-weight:700; padding:5px 10px; border-radius:999px">🔵 Federica: '+lavFederica+'</span>';
  }
  const contEl = document.getElementById('conteggio-operatori');
  if(contEl){
    contEl.textContent = Object.keys(contaOperatori).length
      ? Object.keys(contaOperatori).sort().map(function(k){ return k+': '+contaOperatori[k]; }).join('  ·  ') + '  (anno '+annoSel+', le congiunte valgono 2)'
      : '';
  }
  const versAnno = (state.versamenti||[]).filter(function(v){ return annoDiData(v.data) === annoSel; });

  const tot = pratAnno.length;
  const DA_LAVORARE = ['arrivo','lavorazione','da_lavorare_scansionata'];
  const daLavorare = pratAnno.filter(p=>DA_LAVORARE.indexOf(p.stato)>=0).length;
  const rinunce = pratAnno.filter(p=>p.stato==='rinuncia_compilazione').length;
  const lavorate = tot - daLavorare - rinunce;
  const fattureEmesse = pratAnno.reduce((a,p)=>a+Number(p.compenso||0),0);
  const incassoLordo = pratAnno.reduce((a,p)=>a+Number(p.pagato||0),0);
  const versatoCaf = versAnno.reduce(function(a,v){ return a+Number(v.importo||0); }, 0);
  const incasso = incassoLordo - versatoCaf;
  const differenzaIncFatt = incasso - fattureEmesse;

  summary.innerHTML = `
    <div class="stat c3"><b>${tot}</b><span>Pratiche totali</span></div>
    <div class="stat c3"><b>${lavorate}</b><span>Lavorate</span></div>
    <div class="stat c3"><b>${daLavorare}</b><span>Da lavorare</span></div>
    <div class="stat c4 verde"><b>${fmtEuro(fattureEmesse)}</b><span>FATTURE EMESSE</span></div>
    <div class="stat c4 viola"><b>${fmtEuro(incasso)}</b><span>INCASSO</span></div>
    <div class="stat c4 blu"><b>${fmtEuro(versatoCaf)}</b><span>PAGAMENTI CAF</span></div>
    <div class="stat c4 gray"><b>${fmtEuro(differenzaIncFatt)}</b><span>INCASSO − FATTURE</span></div>
  `;

  const caf = document.getElementById('caf-card');
  const vlist = versAnno;
  caf.innerHTML = `
    <div class="raff-title">Versamenti al CAF Regionale</div>
    <div class="grid">
      <div><label>Importo (€)</label><input id="vc-importo" type="text" inputmode="decimal" placeholder="0,00"></div>
      <div><label>Data</label><input id="vc-data" placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"></div>
      <div class="full"><label>Causale</label><input id="vc-causale" placeholder="Facoltativo"></div>
    </div>
    <div style="text-align:left"><button class="btn-add" onclick="aggiungiVersamento()">+ Aggiungi versamento</button></div>
    <div id="caf-msg" style="color:#c0392b; font-size:12px; margin:4px 0 8px; display:none"></div>
    ${vlist.length ? vlist.map(v => `
      <div class="caf-row">
        <span>${v.data||'-'} ${v.causale ? '· '+esc(v.causale) : ''}</span>
        <span>${fmtEuro(v.importo)} <button onclick="rimuoviVersamento('${v.id}')" style="background:none;border:none;color:#c0392b;cursor:pointer;font-weight:700;margin-left:6px">✕</button></span>
      </div>`).join('') : '<div class="empty">Nessun versamento registrato</div>'}
    <div class="caf-tot"><span>Totale versato</span><span>${fmtEuro(versatoCaf)}</span></div>
  `;

  const raff = document.getElementById('raffronto');
  if(!document.getElementById('ch-stati')){
    raff.innerHTML = `
      <div class="raff-title">Andamento pratiche e incassi</div>
      <div class="charts">
        <div><div class="chart-cap">Pratiche per stato</div><div class="chart-wrap"><canvas id="ch-stati"></canvas></div></div>
        <div><div class="chart-cap">Fatture emesse e Incasso</div><div class="chart-wrap"><canvas id="ch-eur"></canvas></div></div>
      </div>
      <div class="raff-diff" id="raff-diff"></div>`;
  }
  document.getElementById('raff-diff').textContent = 'Ancora da incassare (fatture emesse − incasso): ' + fmtEuro(fattureEmesse - incasso);
  aggiornaGrafici(fattureEmesse, incasso);

  const tab = document.getElementById('tabella');
  const ordinate = filtra([...pratAnno].sort((a,b)=> a.numero - b.numero));
  tab.innerHTML = `
    <div class="raff-title">Registro di protocollo</div>
    <div class="tab-wrap">
      <table class="tab-proto">
        <thead><tr><th>N. protocollo</th><th>Data</th><th>Mittente</th><th>Tipo di pratica</th></tr></thead>
        <tbody>
          ${ordinate.length ? ordinate.map(p => `
            <tr>
              <td class="n">${formattaProtocollo(p)}</td>
              <td>${p.data||'-'}</td>
              <td>${(p.nome||'-').toUpperCase()}${p.congiunta ? '<div class="sub2">Congiunta: '+esc(p.congiunta)+'</div>' : ''}</td>
              <td>${p.tipo||'-'}</td>
              <td><select class="stato-tab-sel" onchange="cambiaStato('${p.id}', this.value)">${statoOptions(p.stato)}</select></td>
              <td>${formattaInserimento(p)}</td>
              <td><button type="button" style="background:var(--accent); color:var(--accent-ink); border:none; border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer" onclick="apriPraticaDaTabella('${p.id}')">Apri</button></td>
            </tr>`).join('') : '<tr><td colspan="7" class="empty">'+(pratAnno.length ? 'Nessun risultato' : 'Nessuna registrazione per l\'anno '+annoSel)+'</td></tr>'}
        </tbody>
      </table>
    </div>
  `;


  const sorted = [...pratAnno].sort((a,b)=> b.numero - a.numero);
  const cardHTML = (p) => `
    <div class="item" id="pratica-${p.id}">
      <div class="item-top">
        <div>
          <div class="num">#${formattaProtocollo(p)} — ${(p.nome||'(senza nome)').toUpperCase()}</div>
          <div class="name">${p.tipo||''} ${p.cf ? '· nato il '+p.cf : ''}</div>
          ${p.congiunta ? `<div class="name">Congiunta con <b>${esc(p.congiunta)}</b>${p.congData ? ' (nato il '+esc(p.congData)+')' : ''}</div>` : ''}
          ${p.telefono ? `<div class="name">Tel. <a href="tel:${esc(p.telefono)}" style="color:inherit">${esc(p.telefono)}</a></div>` : ''}
        </div>
        <div class="badges">
          <span class="badge stato">${pallino(p.stato)}${statoLabel(p.stato)}</span>
        </div>
      </div>
      <div class="meta">Aperta il ${p.data||'-'} ${p.note ? '· '+p.note : ''}</div>
      <div class="meta compenso">Fattura: ${fmtEuro(p.compenso)} · Pagato effettivo: ${fmtEuro(p.pagato)}</div>
      ${storicoClienteHTML(p)}
      ${p.numFattura ? `<div class="meta">Fattura n. ${esc(p.numFattura)} del ${esc(p.dataFattura)||'-'}</div>` : ''}
      ${p._editing ? `
        <div class="grid" style="margin-top:8px">
          <div class="full"><label>Cognome e Nome</label><input id="e-nome-${p.id}" value="${esc(p.nome)}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
          <div class="full"><label class="chk"><input type="checkbox" id="e-congon-${p.id}" ${p.congiunta ? 'checked' : ''} onchange="(function(){var on=document.getElementById('e-congon-${p.id}').checked; document.getElementById('e-congbox-${p.id}').style.display = on?'':'none';})()"> Congiunta</label>
            <div id="e-congbox-${p.id}" class="grid" style="${p.congiunta ? '' : 'display:none; '}margin-top:6px">
              <div><label>Cognome</label><input id="e-congcognome-${p.id}" value="${esc(p.congCognome)}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
              <div><label>Nome</label><input id="e-congnome-${p.id}" value="${esc(p.congNome)}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
              <div><label>Data di nascita</label><input id="e-congdata-${p.id}" value="${esc(p.congData)}" placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"></div>
            </div>
          </div>
          <div><label>Telefono</label><input id="e-tel-${p.id}" type="tel" inputmode="tel" value="${esc(p.telefono)}"></div>
          <div><label>Data di nascita</label><input id="e-cf-${p.id}" value="${esc(p.cf)}" inputmode="numeric" placeholder="GG/MM/AAAA" oninput="autoSlashData(this)"></div>
          <div><label>Tipo pratica</label><select id="e-tipo-${p.id}">${tipoOptions(p.tipo)}</select></div>
          <div><label>Fattura (€)</label><input id="e-comp-${p.id}" type="text" inputmode="decimal" value="${esc(p.compenso)}"></div>
          <div><label>Pagato effettivo (€)</label><input id="e-pag-${p.id}" type="text" inputmode="decimal" value="${esc(p.pagato)}"></div>
          <div><label>Numero fattura</label><input id="e-nf-${p.id}" value="${esc(p.numFattura)}"></div>
          <div><label>Data fattura</label><input id="e-df-${p.id}" value="${esc(p.dataFattura)}" inputmode="numeric" placeholder="GG/MM/AAAA" oninput="autoSlashData(this)"></div>
          <div class="full"><label>Note</label><input id="e-note-${p.id}" value="${esc(p.note)}"></div>
        </div>
        <div class="row-actions">
          <button onclick="salvaModifica('${p.id}')" style="background:var(--accent); color:var(--accent-ink)">Salva modifica</button>
          <button onclick="annullaModifica('${p.id}')">Annulla</button>
        </div>
      ` : `
      <div class="row-actions">
        <select onchange="cambiaStato('${p.id}', this.value)">${statoOptions(p.stato)}</select>
        <button onclick="modifica('${p.id}')">Modifica</button>
        <button onclick="rimuovi('${p.id}')" style="${p._confirmDelete?'background:#c0392b;color:#fff':''}">${p._confirmDelete?'Conferma eliminazione?':'Elimina'}</button>
      </div>
      `}
    </div>
  `;
  const visibili = filtra(sorted);
  const inRicerca = ((document.getElementById('cerca')||{}).value||'').trim() !== '';
  const nomiGruppi = getTipiList().slice();
  visibili.forEach(function(p){ const k = p.tipo || 'SENZA TIPO'; if(nomiGruppi.indexOf(k) < 0) nomiGruppi.push(k); });
  list.innerHTML = nomiGruppi.map(function(k){
    const items = visibili.filter(function(p){ return (p.tipo || 'SENZA TIPO') === k; });
    if(inRicerca && !items.length) return '';
    const fe = items.reduce(function(a,p){ return a + Number(p.compenso||0); }, 0);
    const inc = items.reduce(function(a,p){ return a + Number(p.pagato||0); }, 0);
    const open = aperti[k] === true;
    const col = coloreCollaboratore(k);
    return '<details class="grp" data-k="' + esc(k) + '" ' + (open ? 'open' : '') + ' ontoggle="gToggle(this)">'
      + '<summary style="background:' + col + '; background-image:none"><span class="grp-name">' + esc(k) + '</span><span class="grp-n">' + items.length + '</span></summary>'
      + '<div class="grp-b"><div class="grp-tot">Fatture ' + fmtEuro(fe) + ' · Incasso ' + fmtEuro(inc) + '</div>'
      + (items.length ? items.map(cardHTML).join('') : '<div class="empty">Nessuna pratica</div>') + '</div></details>';
  }).join('');
}

function autoSlashData(el){
  let v = el.value.replace(/[^0-9]/g,'').slice(0,8);
  if(v.length > 4) v = v.slice(0,2)+'/'+v.slice(2,4)+'/'+v.slice(4);
  else if(v.length > 2) v = v.slice(0,2)+'/'+v.slice(2);
  el.value = v;
}

let salvandoPratica = false;
async function addPratica(){
  if(salvandoPratica) return;
  salvandoPratica = true;
  const btnSalva = document.querySelector('.btn-salva-pratica');
  const btnTestoOriginale = btnSalva ? btnSalva.textContent : '';
  if(btnSalva){ btnSalva.disabled = true; btnSalva.textContent = 'Salvataggio...'; }
  try{
    await addPraticaInterna();
  } finally {
    salvandoPratica = false;
    if(btnSalva){ btnSalva.disabled = false; btnSalva.textContent = btnTestoOriginale || '💾 Salva pratica'; }
  }
}
async function addPraticaInterna(){
  const msg = document.getElementById('form-msg');
  msg.style.display = 'none';
  const cognome = document.getElementById('f-cognome').value.trim().toUpperCase();
  const nomeProprio = document.getElementById('f-nome').value.trim().toUpperCase();
  const nome = (cognome + ' ' + nomeProprio).trim();
  const cf = document.getElementById('f-cf').value.trim();
  const tipo = document.getElementById('f-tipo').value.trim();
  const compenso = parseImporto(document.getElementById('f-compenso').value) || '';
  const pagato = parseImporto(document.getElementById('f-pagato').value) || '';
  const congCognome = document.getElementById('f-cong-cognome').value.trim().toUpperCase();
  const congNome = document.getElementById('f-cong-nome').value.trim().toUpperCase();
  const congData = document.getElementById('f-cong-data').value.trim();
  const congiunta = [congCognome, congNome].filter(Boolean).join(' ');
  const telefono = document.getElementById('f-tel').value.trim();
  const data = todayIT();
  const note = document.getElementById('f-note').value.trim();

  if(!nome){
    msg.textContent = '⚠️ Inserisci almeno il cognome del contribuente prima di salvare.';
    msg.style.display = 'block';
    return;
  }

  const annoPr = annoDiData(data);
  registraClienteSeNuovo(cognome, nomeProprio, cf);
  if(congCognome || congNome){ registraClienteSeNuovo(congCognome, congNome, congData); }
  const numeroPr = await prossimoNumeroProtocollo(annoPr);
  const nuovaPratica = {
    numero: numeroPr,
    anno: annoPr,
    nome, congiunta, congCognome, congNome, congData, telefono, cf, tipo, compenso, pagato, data, note,
    stato: document.getElementById('f-stato').value || 'arrivo',
    fatt: 'dafatturare',
    numFattura: '',
    dataFattura: '',
    inseritoDa: (currentUser||'').toUpperCase(),
    inseritoIl: new Date().toISOString()
  };
  if(dbApi){
    try{ await dbApi.collection('pratiche').add(nuovaPratica); }
    catch(e){ console.error('salvataggio pratica', e); }
  } else {
    nuovaPratica.id = 'p'+Date.now();
    state.pratiche.push(nuovaPratica);
  }

  document.getElementById('f-cognome').value='';
  document.getElementById('f-nome').value='';
  document.getElementById('f-cf').value='';
  pickChip('f-tipo-btns','f-tipo', document.getElementById('f-tipo').value);
  document.getElementById('f-compenso').value='';
  document.getElementById('f-pagato').value='';
  document.getElementById('cli-cerca').value='';
  document.getElementById('cli-cerca-cong').value='';
  document.getElementById('f-congiunta-on').checked=false;
  toggleCongBox();
  pickChip('f-stato-btns','f-stato','arrivo');
  document.getElementById('f-tel').value='';
  document.getElementById('f-stato').value='arrivo';
  document.getElementById('f-note').value='';
  document.getElementById('f-data').value=todayIT();

  render();
  embedState();
}

function cambiaStato(id, stato){
  if(dbApi){ dbApi.doc('pratiche/'+id).update({ stato: stato }).catch(function(e){ console.error(e); }); return; }
  const p = state.pratiche.find(x=>x.id===id);
  if(p){ p.stato = stato; render(); embedState(); }
}

function apriPraticaDaTabella(id){
  const p = state.pratiche.find(function(x){ return x.id===id; });
  if(!p) return;
  const k = p.tipo || 'SENZA TIPO';
  aperti[k] = true;
  p._editing = true;
  render();
  setTimeout(function(){
    const el = document.getElementById('pratica-'+id);
    if(el) el.scrollIntoView({ behavior:'smooth', block:'center' });
  }, 50);
}
function modifica(id){
  const p = state.pratiche.find(x=>x.id===id);
  if(p){ p._editing = true; render(); }
}

function annullaModifica(id){
  const p = state.pratiche.find(x=>x.id===id);
  if(p){ delete p._editing; render(); }
}

function salvaModifica(id){
  const p = state.pratiche.find(x=>x.id===id);
  if(!p) return;
  const g = k => document.getElementById(k+'-'+id).value;
  var cc = g('e-congcognome').trim().toUpperCase();
  var cn = g('e-congnome').trim().toUpperCase();
  const numFattura = g('e-nf').trim();
  const dataFattura = g('e-df').trim();
  const campi = {
    nome: g('e-nome').trim().toUpperCase(),
    congCognome: cc, congNome: cn,
    congData: g('e-congdata').trim(),
    congiunta: [cc, cn].filter(Boolean).join(' '),
    telefono: g('e-tel').trim(),
    cf: g('e-cf').trim(),
    tipo: g('e-tipo'),
    compenso: parseImporto(g('e-comp')) || '',
    pagato: parseImporto(g('e-pag')) || '',
    numFattura: numFattura,
    dataFattura: dataFattura,
    note: g('e-note').trim(),
    fatt: (numFattura || dataFattura) ? 'fatturata' : 'dafatturare'
  };
  delete p._editing;
  if(dbApi){
    dbApi.doc('pratiche/'+id).update(campi).catch(function(e){ console.error(e); });
    render();
  } else {
    Object.assign(p, campi);
    render(); embedState();
  }
}

function rimuovi(id){
  const pr = state.pratiche.find(x=>x.id===id);
  if(!pr) return;
  if(!pr._confirmDelete){ pr._confirmDelete = true; render(); return; }
  if(dbApi){
    dbApi.doc('pratiche/'+id).delete().catch(function(e){ console.error(e); });
  } else {
    state.pratiche = state.pratiche.filter(x=>x.id!==id);
    embedState();
  }
  render();
}

function embedState(){
  let tag = document.getElementById('__state__');
  if(!tag){
    tag = document.createElement('script');
    tag.type = 'application/json';
    tag.id = '__state__';
    document.body.appendChild(tag);
  }
  tag.textContent = JSON.stringify(state, function(k,v){ return (k.charAt(0)==='_') ? undefined : v; });
}

function loadEmbeddedState(){
  const tag = document.getElementById('__state__');
  if(tag){
    try{ state = JSON.parse(tag.textContent); }catch(e){}
  }
}

document.addEventListener('DOMContentLoaded', function(){
  caricaArchivioClienti();
  initSelettoreAnno();
  renderLogin();
  try{
    const salvato = localStorage.getItem('protocollo-utente');
    if(salvato){ currentUser = salvato; document.getElementById('login-overlay').style.display = 'none'; }
  }catch(e){}
  initTipoBtns();
  initStatoBtns();
  var firstTab = document.querySelector('.navmenu button[data-tab="anagrafica"]'); if(firstTab) showTab(firstTab);
  applicaPermessi();
  loadEmbeddedState();
  render();
  const ultima = state.pratiche.slice().sort(function(a,b){ return b.numero - a.numero; })[0];
  if(ultima && ultima.tipo){ document.getElementById('f-tipo').value = ultima.tipo; pickChip('f-tipo-btns','f-tipo', ultima.tipo); }
  initDb();
});

