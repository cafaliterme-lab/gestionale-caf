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
  // Usa la nuova API data.js
  data.clienti.aggiungi(nuovo);
}
// DEPRECATED: subscribeClientiExtra è sostituito dalla sottoscrizione realtime di data.js
// MODIFICATO: caricaArchivioClienti ora usa i dati da Supabase
function caricaArchivioClienti(){
  // I clienti sono caricati da Supabase via data.caricaTutto()
  // Inizialmente vuoto, verrà popolato dopo il login
  ARCHIVIO_CLIENTI = [];
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
// DEPRECATED: La numerazione è gestita dal trigger del database.
// Questa funzione è usata solo per il fallback offline.
async function prossimoNumeroProtocollo(anno){
  if(!state.nextNumByYear) state.nextNumByYear = {};
  const n = state.nextNumByYear[anno] || 1;
  state.nextNumByYear[anno] = n + 1;
  return n;
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
// Login con Supabase Auth (email + password)
function renderLogin(){
  const wrap = document.getElementById('login-lista');
  if(!wrap) return;

  // Form di login con email/password
  wrap.innerHTML = `
    <div style="text-align: left">
      <label style="font-size:12px; color:var(--sub); display:block; margin-bottom:4px">Email</label>
      <input type="email" id="login-email" placeholder="tuo@email.com" style="width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); margin-bottom:10px; font-size:14px">

      <label style="font-size:12px; color:var(--sub); display:block; margin-bottom:4px">Password</label>
      <input type="password" id="login-pwd" placeholder="Password" style="width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); margin-bottom:10px; font-size:14px" onkeydown="if(event.key==='Enter') confermaLogin()">

      <button type="button" class="login-btn" style="background:var(--accent); color:var(--accent-ink); border:none; width:100%; margin-bottom:8px" onclick="confermaLogin()">🔓 Accedi</button>
      <button type="button" class="login-btn" style="background:var(--line); color:var(--ink); border:none; width:100%; margin-bottom:10px" onclick="toggleCreaAccount()">➕ Crea nuovo account</button>

      <div id="crea-account" style="display:none; border-top:1px solid var(--line); padding-top:12px; margin-top:12px">
        <label style="font-size:12px; color:var(--sub); display:block; margin-bottom:4px">Tuo nome</label>
        <input type="text" id="create-nome" placeholder="Es. Angelo Gugliotta" style="width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); margin-bottom:10px; font-size:14px">

        <label style="font-size:12px; color:var(--sub); display:block; margin-bottom:4px">Email (nuovo account)</label>
        <input type="email" id="create-email" placeholder="tuo@email.com" style="width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); margin-bottom:10px; font-size:14px">

        <label style="font-size:12px; color:var(--sub); display:block; margin-bottom:4px">Password</label>
        <input type="password" id="create-pwd" placeholder="Almeno 6 caratteri" style="width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); margin-bottom:10px; font-size:14px">

        <button type="button" class="login-btn" style="background:var(--accent); color:var(--accent-ink); border:none; width:100%; margin-bottom:6px" onclick="creaAccount()">✅ Crea account</button>
        <button type="button" class="login-btn" style="background:var(--line); color:var(--ink); border:none; width:100%" onclick="toggleCreaAccount()">❌ Annulla</button>
      </div>
    </div>
  `;

  // Focus su email se primo caricamento
  setTimeout(() => {
    const emailInput = document.getElementById('login-email');
    if(emailInput) emailInput.focus();
  }, 100);
}

function toggleCreaAccount(){
  const box = document.getElementById('crea-account');
  if(box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function confermaLogin(){
  const email = document.getElementById('login-email')?.value.trim();
  const pwd = document.getElementById('login-pwd')?.value;
  const msg = document.getElementById('login-msg');

  if(!email || !pwd){
    if(msg){ msg.textContent = '⚠️ Inserisci email e password.'; msg.style.display = 'block'; }
    return;
  }

  // Chiama login di auth.js
  login(email, pwd).then(function(result){
    if(result.error){
      if(msg){ msg.textContent = '❌ ' + result.error; msg.style.display = 'block'; }
    } else {
      // Login riuscito
      document.getElementById('login-overlay').style.display = 'none';
      applicaPermessi();
      initSupabase(); // Carica dati
    }
  }).catch(function(e){
    if(msg){ msg.textContent = '❌ Errore: ' + e.message; msg.style.display = 'block'; }
  });
}

async function creaAccount(){
  const nome = document.getElementById('create-nome')?.value.trim().toUpperCase();
  const email = document.getElementById('create-email')?.value.trim();
  const pwd = document.getElementById('create-pwd')?.value;
  const msg = document.getElementById('login-msg');

  if(!nome || !email || !pwd){
    if(msg){ msg.textContent = '⚠️ Compila tutti i campi.'; msg.style.display = 'block'; }
    return;
  }

  if(pwd.length < 6){
    if(msg){ msg.textContent = '⚠️ Password troppo corta (min 6 caratteri).'; msg.style.display = 'block'; }
    return;
  }

  try {
    // Usa la funzione signup() da auth.js che crea sia l'utente che il profilo
    const result = await signup(nome, email, pwd);

    if(result.error) throw new Error(result.error);

    if(msg){
      msg.textContent = '✅ Account creato! Accedi con le tue credenziali.';
      msg.style.color = 'var(--accent)';
      msg.style.display = 'block';
    }

    // Pulisci form creazione
    document.getElementById('create-nome').value = '';
    document.getElementById('create-email').value = '';
    document.getElementById('create-pwd').value = '';
    toggleCreaAccount();

    // Focus su email per accesso
    setTimeout(() => {
      document.getElementById('login-email').value = email;
      document.getElementById('login-pwd').focus();
    }, 500);
  } catch(e) {
    if(msg){
      msg.textContent = '❌ ' + e.message;
      msg.style.color = '#c0392b';
      msg.style.display = 'block';
    }
  }
}

// Deprecated: selezionaLogin non più usato
function selezionaLogin(id){
  // Non usato con Supabase Auth
}

function accedi(id){
  // Deprecated: usare login() di auth.js invece
}

function cambiaUtente(){
  // Logout e torna al login
  logout().then(function(){
    document.getElementById('login-overlay').style.display = 'flex';
    renderLogin();
    document.getElementById('login-msg').style.display = 'none';
  });
}

async function esciDalProgramma(){
  await logout();
  cambiaUtente();
}
function applicaPermessi(){
  const bar = document.getElementById('userbar');
  const u = auth.profilo; // Usa profilo da Supabase

  if(!u){
    // Non autenticato
    bar.innerHTML = '<span>Non autenticato</span>';
    document.getElementById('nav-permessi').style.display = 'none';
    Object.keys(TAB_LABELS).forEach(function(tab){
      const btn = document.querySelector('.navmenu button[data-tab="'+tab+'"]');
      if(btn) btn.style.display = 'none';
    });
    return;
  }

  const isAdmin = u.ruolo === 'admin';
  bar.innerHTML = '<span>Accesso come <b>'+esc(u.nome)+(isAdmin?' (amministratore)':'')+'</b></span><button type="button" onclick="cambiaUtente()">Cambia utente</button><button type="button" onclick="esciDalProgramma()">🚪 Esci dal programma</button>';
  document.getElementById('nav-permessi').style.display = isAdmin ? '' : 'none';

  const tabs = u.tabs || {};
  Object.keys(TAB_LABELS).forEach(function(tab){
    const btn = document.querySelector('.navmenu button[data-tab="'+tab+'"]');
    if(!btn) return;
    const visibile = isAdmin || tabs[tab];
    btn.style.display = visibile ? '' : 'none';
  });

  document.body.classList.toggle('sola-lettura', !isAdmin && u.sola_lettura);

  const attivo = document.querySelector('.navmenu button.active');
  if(!attivo || attivo.style.display === 'none'){
    const primo = Array.from(document.querySelectorAll('.navmenu button')).find(function(b){ return b.style.display !== 'none'; });
    if(primo) showTab(primo);
  }

  if(document.getElementById('tab-permessi').classList.contains('active')) renderPermessi();
}
// NUOVO: Funzioni per gestione utenti con Supabase Auth + Edge Function
async function aggiungiUtente(){
  const nome = document.getElementById('nu-nome')?.value.trim().toUpperCase();
  const email = document.getElementById('nu-email')?.value.trim();
  const pwd = document.getElementById('nu-pwd')?.value;

  if(!nome || !email){
    alert('⚠️ Inserisci nome e email');
    return;
  }

  if(!auth.session){
    alert('❌ Non autenticato');
    return;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-utenti/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.session.access_token}`,
      },
      body: JSON.stringify({
        email,
        password: pwd || Math.random().toString(36).slice(-8), // password temporanea
        nome,
      }),
    });

    if(!response.ok){
      const err = await response.json();
      throw new Error(err.error || 'Errore creazione utente');
    }

    const result = await response.json();
    alert('✅ ' + result.message);
    document.getElementById('nu-nome').value = '';
    document.getElementById('nu-email').value = '';
    document.getElementById('nu-pwd').value = '';
    renderPermessi();
  } catch(e){
    alert('❌ Errore: ' + e.message);
  }
}

async function rimuoviUtente(id){
  if(!confirm('Sei sicuro di voler eliminare questo utente?')) return;

  if(!auth.session){
    alert('❌ Non autenticato');
    return;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-utenti/delete-user`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.session.access_token}`,
      },
      body: JSON.stringify({ user_id: id }),
    });

    if(!response.ok){
      const err = await response.json();
      throw new Error(err.error || 'Errore eliminazione utente');
    }

    alert('✅ Utente eliminato');
    renderPermessi();
  } catch(e){
    alert('❌ Errore: ' + e.message);
  }
}

async function cambiaMiaPassword(){
  const pwd = document.getElementById('mia-pwd')?.value;
  if(!pwd){
    alert('⚠️ Inserisci la nuova password');
    return;
  }

  if(pwd.length < 6){
    alert('⚠️ Password troppo corta (min 6 caratteri)');
    return;
  }

  const result = await cambiaPassword(pwd);
  const msg = document.getElementById('mia-pwd-msg');

  if(result.error){
    msg.textContent = '❌ Errore: ' + result.error;
    msg.style.color = '#c0392b';
  } else {
    msg.textContent = '✅ Password cambiata';
    msg.style.color = 'var(--accent)';
    document.getElementById('mia-pwd').value = '';
  }

  msg.style.display = 'block';
  setTimeout(function(){ msg.style.display = 'none'; }, 3000);
}

async function cambiaPasswordUtente(id, pwd){
  if(!pwd){
    alert('⚠️ Inserisci la nuova password');
    return;
  }

  if(!auth.session){
    alert('❌ Non autenticato');
    return;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-utenti/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.session.access_token}`,
      },
      body: JSON.stringify({ user_id: id, password: pwd }),
    });

    if(!response.ok){
      const err = await response.json();
      throw new Error(err.error || 'Errore reset password');
    }

    alert('✅ Password resettata');
  } catch(e){
    alert('❌ Errore: ' + e.message);
  }
}

// DEPRECATED: salvaUtenti non più usato
function salvaUtenti(lista){}

// DEPRECATED: getUtenti, trovaUtente sostituiti da Supabase
function getUtenti(){ return []; }
function trovaUtente(id){ return null; }
function dataOraFile(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'_'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0');
}
function pulisciArray(arr){
  return (arr||[]).map(function(x){ var c=Object.assign({},x); delete c._editing; delete c._confirmDelete; delete c._editingFattura; return c; });
}
async function esportaBackupJSON(){
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
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-protocollo-' + dataOraFile() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    const blob = new Blob([buf], { type:'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'registro-protocollo-' + anno + '-' + dataOraFile() + '.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    // Usa la nuova API data.js
    const result = await data.admin.importa(dati);
    if(result.error) throw new Error(result.error);
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
  // Usa la nuova API data.js
  const result = await data.admin.svuota();
  if(result.error){ console.error('svuotamento registro', result.error); }
  if(btn){ btn.disabled = false; btn.textContent = 'Svuota registro (elimina tutte le pratiche)'; }
  render();
}
async function renderPermessi(){
  const wrap = document.getElementById('perm-lista');
  const allProfili = await caricaTuttiProfili();

  if(!allProfili){
    wrap.innerHTML = '<div class="empty">Errore nel caricamento dei profili</div>';
    return;
  }

  const operatori = allProfili.filter(function(u){ return u.ruolo !== 'admin'; });
  wrap.innerHTML = operatori.length ? operatori.map(function(u){
    const tabs = u.tabs || {};
    const righeTab = Object.keys(TAB_LABELS).map(function(tab){
      return '<div class="perm-row"><span>'+TAB_LABELS[tab]+'</span><label class="chk"><input type="checkbox" '+(tabs[tab]?'checked':'')+' onchange="togglePermTab(&quot;'+u.id+'&quot;,&quot;'+tab+'&quot;,this.checked)"> Visibile</label></div>';
    }).join('');
    return '<div class="card" style="margin-bottom:12px">'
      + '<div class="raff-title">'+esc(u.nome)+'</div>'
      + righeTab
      + '<div class="perm-row" style="margin-top:6px; border-top:2px solid var(--line); padding-top:12px"><span>Sola lettura</span><label class="chk"><input type="checkbox" '+(u.sola_lettura?'checked':'')+' onchange="togglePermSoloLettura(&quot;'+u.id+'&quot;,this.checked)"> Attiva</label></div>'
      + '<div class="perm-row"><span>Nuova password</span><span style="display:flex; gap:6px"><input type="password" id="pwd-'+u.id+'" placeholder="Lascia vuoto per non cambiarla" style="width:160px; padding:6px 8px; font-size:12.5px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--ink)"><button type="button" style="background:var(--line); color:var(--ink); border:none; border-radius:6px; padding:6px 10px; font-size:12px; cursor:pointer" onclick="cambiaPasswordUtente(&quot;'+u.id+'&quot;, document.getElementById(&quot;pwd-'+u.id+'&quot;).value); document.getElementById(&quot;pwd-'+u.id+'&quot;).value=&quot;&quot;">Salva</button></span></div>'
      + '<div class="perm-row"><span></span><button type="button" style="background:none; border:none; color:#c0392b; font-weight:700; cursor:pointer" onclick="rimuoviUtente(&quot;'+u.id+'&quot;)">Elimina utente</button></div>'
      + '</div>';
  }).join('') : '<div class="empty">Nessun operatore oltre all\'amministratore</div>';
}

async function togglePermTab(id, tab, val){
  try {
    const allProfili = await caricaTuttiProfili();
    if(!allProfili) return;

    const u = allProfili.find(p => p.id === id);
    if(!u) return;

    const tabs = u.tabs || {};
    tabs[tab] = val;

    const result = await aggiornaProfilo(id, { tabs });
    if(result.error){
      alert('❌ Errore: ' + result.error);
    }
  } catch(e){
    alert('❌ Errore: ' + e.message);
  }
}

async function togglePermSoloLettura(id, val){
  try {
    const result = await aggiornaProfilo(id, { sola_lettura: val });
    if(result.error){
      alert('❌ Errore: ' + result.error);
    }
  } catch(e){
    alert('❌ Errore: ' + e.message);
  }
}

// NUOVO: Inizializzazione con Supabase (sostituisce initDb)
async function initSupabase(){
  try {
    // Inizializza auth
    await initAuth();

    // Se non autenticato, non fare nulla (la pagina di login lo gestisce)
    if (!auth.session) return;

    // Carica tutti i dati
    const ok = await data.caricaTutto();
    if (!ok) {
      console.error('Errore nel caricamento dei dati');
      return;
    }

    // Sincronizza i dati dal modulo data.js al state locale di app.js
    syncDataFromSupabase();

    // Sottoscrivi ai cambiamenti realtime
    data.sottoscrivi('pratiche', () => {
      syncDataFromSupabase();
      render();
    });
    data.sottoscrivi('versamenti', () => {
      syncDataFromSupabase();
      render();
    });
    data.sottoscrivi('isee', () => {
      syncDataFromSupabase();
      render();
    });
    data.sottoscrivi('collaboratori', () => {
      syncDataFromSupabase();
      initTipoBtns();
      renderCollaboratori();
      render();
    });

  } catch (e) {
    console.error('Errore inizializzazione Supabase:', e);
  }
}

// Sincronizza i dati dal modulo data.js al state locale di app.js
function syncDataFromSupabase(){
  if (data && data.state) {
    state.pratiche = data.state.pratiche || [];
    state.versamenti = data.state.versamenti || [];
    state.isee = data.state.isee || [];
    state.collaboratori = data.state.collaboratori || [];
    ARCHIVIO_CLIENTI = data.state.clienti || [];
  }
}
// Queste funzioni sono sostituite da data.js e dalla sottoscrizione realtime di Supabase

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
  if(tab === 'permessi') renderPermessi(); // async, but fires in background
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
  // Usa la nuova API data.js
  data.collaboratori.salva(lista);
}
function rimuoviCollaboratore(v){
  const lista = ((state.collaboratori && state.collaboratori.length) ? state.collaboratori : TIPI_DEFAULT).filter(function(c){ return c!==v; });
  // Usa la nuova API data.js
  data.collaboratori.salva(lista);
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
  // Usa la nuova API data.js
  data.isee.aggiungi(nuovo);
}
function toggleIseePagato(id, val){
  // Usa la nuova API data.js
  data.isee.togglePagato(id, val);
}
function rimuoviIsee(id){
  // Usa la nuova API data.js
  data.isee.elimina(id);
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
  // Usa la nuova API data.js
  data.versamenti.aggiungi(nuovoVers);
}
function rimuoviVersamento(id){
  // Usa la nuova API data.js
  data.versamenti.elimina(id);
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

  // Il numero è assegnato dal trigger del database (non passare numero, il trigger lo genererà)
  const nuovaPratica = {
    anno: annoPr,
    nome, congiunta, congCognome, congNome, congData, telefono, cf, tipo, compenso, pagato, data, note,
    stato: document.getElementById('f-stato').value || 'arrivo',
    fatt: 'dafatturare',
    numFattura: '',
    dataFattura: '',
    inseritoDa: (currentUser||'').toUpperCase(),
    inseritoIl: new Date().toISOString()
  };

  // Usa la nuova API data.js
  const result = await data.pratiche.aggiungi(nuovaPratica);
  if(result.error){
    msg.textContent = '❌ Errore: ' + result.error;
    msg.style.display = 'block';
    return;
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
}

function cambiaStato(id, stato){
  // Usa la nuova API data.js
  data.pratiche.aggiorna(id, { stato: stato });
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
  // Usa la nuova API data.js
  data.pratiche.aggiorna(id, campi);
}

function rimuovi(id){
  const pr = state.pratiche.find(x=>x.id===id);
  if(!pr) return;
  if(!pr._confirmDelete){ pr._confirmDelete = true; render(); return; }
  // Usa la nuova API data.js
  data.pratiche.elimina(id);
}

// DEPRECATED: embedState e loadEmbeddedState non sono più necessari con Supabase
// Lo stato è gestito direttamente da data.js e Supabase realtime

document.addEventListener('DOMContentLoaded', async function(){
  caricaArchivioClienti();
  initSelettoreAnno();
  renderLogin();

  // Backward compatibility: se c'è un utente salvato in localStorage, usalo (ma Supabase Auth avrà precedenza)
  try{
    const salvato = localStorage.getItem('protocollo-utente');
    if(salvato){ currentUser = salvato; }
  }catch(e){}

  initTipoBtns();
  initStatoBtns();
  var firstTab = document.querySelector('.navmenu button[data-tab="anagrafica"]'); if(firstTab) showTab(firstTab);
  applicaPermessi();
  render();

  // Carica i dati da Supabase e sottoscrivi ai cambiamenti realtime
  await initSupabase();

  // Aggiorna l'interfaccia con il tipo di pratica dell'ultima pratica
  const ultima = state.pratiche.slice().sort(function(a,b){ return b.numero - a.numero; })[0];
  if(ultima && ultima.tipo){ document.getElementById('f-tipo').value = ultima.tipo; pickChip('f-tipo-btns','f-tipo', ultima.tipo); }
});

