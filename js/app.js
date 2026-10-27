// state è già dichiarato nell'HTML globalmente
Object.assign(state, { pratiche: [], versamenti: [], isee: [], collaboratori: [], nextNum: 1 });
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
  rinuncia_compilazione:{l:'Rinuncia alla compilazione', c:'#374151', e:'⚫'},
  pratica_attiva:{l:'Pratica attiva', c:'#1f8a70', e:'🟢'},
  pratica_cessata:{l:'Pratica cessata', c:'#6b7280', e:'⚫'}
};
// Stati che si vedono solo per i contratti colf e badanti
const STATI_SOLO_COLF = ['pratica_attiva','pratica_cessata'];
// Stati che per i contratti colf e badanti non servono e non si mostrano
const STATI_NON_COLF = ['da_lavorare_scansionata','filca_non_paga','fps_non_paga','lavorata','lavorata_da_fatturare','non_paga','rinuncia_compilazione','pagato_da_ritirare'];
// Stato proposto all'apertura di una nuova pratica di quel tipo (scelto dall'amministratore)
function statoInizialeTipo(tipo){
  const k = tipo ? tipoConfig(tipo).statoIniziale : '';
  return k && STATI[k] && statoVisibile(k, tipo) ? k : '';
}
function statoVisibilePredefinito(k, tipo){
  return eColf(tipo) ? STATI_NON_COLF.indexOf(k) < 0 : STATI_SOLO_COLF.indexOf(k) < 0;
}
// L'amministratore può scegliere gli stati di ogni tipo (Utenti e permessi → Tipi di pratica → 🏷️ Stati)
function statoVisibile(k, tipo, sel){
  if(k === sel) return true;
  const scelti = tipo ? tipoConfig(tipo).stati : null;
  if(Array.isArray(scelti)) return scelti.indexOf(k) >= 0;
  return statoVisibilePredefinito(k, tipo);
}
const TIPI_DEFAULT = ["730 SEDE","730 BRIGUGLIO ANTONIO","730 CAMINITI ANTONIO","730 CAMINITI LUIGI","730 RICCA AGATINO","730 FILCA","730 FPS IN CONVENZIONE","730 CRISAFULLI ROBERTO","730 FARAONE ARTURO","730 DECEDUTI","730 INTEGRATIVI/RETTIFICATIVI","730 TRIOLO CARMELA","730 DI BELLA SANTINO","CONTRATTI DI AFFITTO","CONTRATTI COLF E BADANTI","ISEE A PAGAMENTO","IMU","SUCCESSIONI","ISEE","SEND","MODELLI UNICO PF","RED","INVCIV","ADI","F24","RAI TV","ROTTAMAZIONE","ALTRE PRATICHE"];
let NOMI_OPERATORI = [];
function getTipiList(){ return (state.collaboratori && state.collaboratori.length) ? state.collaboratori : TIPI_DEFAULT; }
Object.defineProperty(window, 'TIPI', { get: function(){ return getTipiList(); } });
function statoLabel(s){ return (STATI[s]||{}).l || s; }
function pallino(s){ return '<span class="dot" style="background:'+((STATI[s]||{}).c||'#8a8f98')+'"></span>'; }
function statoOptions(sel, tipo){ return Object.keys(STATI).filter(k=>statoVisibile(k, tipo, sel)).map(k=>'<option value="'+k+'"'+(k===sel?' selected':'')+'>'+STATI[k].e+' '+STATI[k].l+'</option>').join(''); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function tipoOptions(sel){
  const list = (sel && TIPI.indexOf(sel)<0) ? [sel].concat(TIPI) : TIPI;
  return '<option value="">-</option>' + list.map(o=>'<option value="'+esc(o)+'"'+(o===sel?' selected':'')+' style="'+stileOpzioneTipo(o)+'">'+esc(o)+'</option>').join('');
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
  const dati = keys.map(function(k){ return sommaPeso(state.pratiche.filter(function(p){ return p.stato===k; })); });
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
  if(!on){ CONG_AUTO = null; if(typeof avvisoCongiuntaAutomatica === 'function') avvisoCongiuntaAutomatica(); ['f-cong-cognome','f-cong-nome','f-cong-data','f-cong-cf','f-cong-tel','f-cong-email','f-cong-comune','f-cong-sesso','f-cong-doc-scad','f-cong-doc-num','f-cong-doc-tipo'].forEach(function(id){ const el = document.getElementById(id); if(el){ el.value=''; el.dataset.auto=''; el.dataset.manuale=''; } }); document.getElementById('cli-cerca-cong').value='';
    if(typeof controllaCFConiuge === 'function') controllaCFConiuge(); if(typeof coloraScadenzaConiuge === 'function') coloraScadenzaConiuge(); }
  // importo convenzione: singola e congiunta possono avere importi predefiniti diversi
  const tipo = document.getElementById('f-tipo').value;
  applicaFatturaAutomatica(tipo);
  if(typeof mostraImportiFPSModulo === 'function') mostraImportiFPSModulo(tipo);
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
function registraClienteSeNuovo(cognome, nome, dataNascita, codiceFiscale, telefono, telefonoFisso, documentoScadenza, email){
  cognome = (cognome||'').trim().toUpperCase().replace(/\s+/g, ' ');
  nome = (nome||'').trim().toUpperCase().replace(/\s+/g, ' ');
  if(!cognome && !nome) return Promise.resolve();
  const nc = (cognome+' '+nome).trim();
  dataNascita = (dataNascita||'').trim();
  telefono = (telefono||'').trim(); telefonoFisso = (telefonoFisso||'').trim(); documentoScadenza = (documentoScadenza||'').trim(); email = (email||'').trim();
  // Il telefono resta nell'archivio clienti anche se la pratica viene poi cancellata
  const salvaTelefono = function(){
    if(!telefono && !telefonoFisso && !documentoScadenza && !email) return;
    const rec = trovaInArchivio(nc, dataNascita, codiceFiscale);
    if(rec){ if(telefono) rec.telefono = telefono; if(telefonoFisso) rec.telefonoFisso = telefonoFisso; if(documentoScadenza) rec.documentoScadenza = documentoScadenza; if(email) rec.email = email; }
    return data.clienti.salvaTelefono({ nomeCompleto: nc, cognome: cognome, nome: nome, dataNascita: dataNascita, codiceFiscale: codiceFiscale || '', telefono: telefono, telefonoFisso: telefonoFisso, documentoScadenza: documentoScadenza, email: email });
  };
  if(codiceFiscale){
    if(ARCHIVIO_CLIENTI.some(function(c){ return c.codiceFiscale === codiceFiscale; })) return Promise.resolve(salvaTelefono());
    const esistente = ARCHIVIO_CLIENTI.find(function(c){ return c.nomeCompleto.toUpperCase() === nc && ((c.dataNascita||'') === dataNascita || !c.dataNascita) && !c.codiceFiscale; });
    if(esistente) esistente.codiceFiscale = codiceFiscale;
    else ARCHIVIO_CLIENTI.push({ nomeCompleto: nc, cognome: cognome, nome: nome, dataNascita: dataNascita, codiceFiscale: codiceFiscale });
    return data.clienti.salvaCF({ nomeCompleto: nc, cognome: cognome, nome: nome, dataNascita: dataNascita, codiceFiscale: codiceFiscale }).then(salvaTelefono);
  }
  if(clienteEsiste(cognome, nome, dataNascita)) return Promise.resolve(salvaTelefono());
  const nuovo = { nomeCompleto: nc, cognome: cognome, nome: nome, dataNascita: dataNascita };
  if(telefono) nuovo.telefono = telefono;
  if(telefonoFisso) nuovo.telefonoFisso = telefonoFisso;
  if(documentoScadenza) nuovo.documentoScadenza = documentoScadenza;
  if(email) nuovo.email = email;
  ARCHIVIO_CLIENTI.push(nuovo);
  return data.clienti.aggiungi(nuovo);
}
// DEPRECATED: subscribeClientiExtra è sostituito dalla sottoscrizione realtime di data.js
// MODIFICATO: caricaArchivioClienti ora usa i dati da Supabase
function caricaArchivioClienti(){
  // I clienti sono caricati da Supabase via data.caricaTutto()
  // prende l'archivio già caricato (mai svuotarlo: la ricerca dei clienti non troverebbe più nessuno)
  ARCHIVIO_CLIENTI = (window.state && state.clienti) || [];
}
function boxRisultatiClienti(ctx){ return document.getElementById(ctx==='cong' ? 'cli-results-cong' : ctx==='lav' ? 'cli-results-lav' : ctx==='sc' ? 'cli-results-sc' : 'cli-results'); }
// Testo per le ricerche: senza apostrofi (' e ’), spazi, punti e accenti, così «D'ANDREA», «D’ANDREA», «D ANDREA» e «DANDREA» si trovano allo stesso modo
function chiaveRicerca(s){ return String(s||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,''); }
function cercaClienti(q, ctx){
  ctx = ctx || 'main';
  const box = boxRisultatiClienti(ctx);
  q = (q||'').trim().toLowerCase();
  if(!q){ box.classList.remove('open'); box.innerHTML=''; return; }
  const kq = chiaveRicerca(q);
  const match = ARCHIVIO_CLIENTI.filter(function(c){ const k = chiaveRicerca(c.nomeCompleto) + ' ' + chiaveRicerca(c.codiceFiscale); return (c.nomeCompleto||"").toLowerCase().indexOf(q) >= 0 || (kq && k.indexOf(kq) >= 0) || (kq && (chiaveRicerca(c.nome) + chiaveRicerca(c.cognome)).indexOf(kq) >= 0); })
    // i deceduti restano trovabili (es. 730 per il defunto) ma vanno in fondo, segnati
    .sort(function(a, b){ return (a.decedutoIl ? 1 : 0) - (b.decedutoIl ? 1 : 0); }).slice(0,8);
  // nelle Scadenze si può inserire subito un cliente nuovo nell'archivio
  const rigaNuovo = ctx === 'sc' ? '<div class="cli-row" style="color:#1a7f37; font-weight:800" onclick="document.getElementById(\'cli-results-sc\').classList.remove(\'open\'); nuovoClienteArchivio(document.getElementById(\'sc-cliente\').value)">➕ Nuovo cliente: inseriscilo in archivio (codice fiscale, telefono…)</div>'
    : ctx === 'main' ? '<div class="cli-row" style="color:#1a7f37; font-weight:800" onclick="document.getElementById(\'cli-results\').classList.remove(\'open\'); nuovoClienteAMano()">➕ Nuovo cliente</div>' : '';
  if(!match.length){ box.innerHTML = '<div class="cli-row" style="cursor:default">Nessun cliente trovato</div>' + rigaNuovo; box.classList.add('open'); return; }
  box.innerHTML = match.map(function(c,i){
    const cestino = (puoEliminareClienti() && c.id) ? '<button type="button" title="Elimina definitivamente dall\'archivio" style="float:right; background:none; border:none; padding:2px 6px; font-size:15px; cursor:pointer" onclick="event.stopPropagation(); eliminaClienteArchivio(&quot;'+esc(String(c.id))+'&quot;, &quot;'+ctx+'&quot;)">🗑</button>' : '';
    const matita = (c.id && typeof modificaClienteArchivio === 'function') ? '<button type="button" title="Modifica l\'anagrafica di questo cliente" style="float:right; background:none; border:none; padding:2px 6px; font-size:15px; cursor:pointer" onclick="event.stopPropagation(); boxRisultatiClienti(&quot;'+ctx+'&quot;).classList.remove(&quot;open&quot;); const c = ARCHIVIO_CLIENTI.find(function(x){ return String(x.id) === &quot;'+esc(String(c.id))+'&quot;; }); if(c) modificaClienteArchivio(c)">✏️</button>' : '';
    return '<div class="cli-row" onclick="scegliCliente('+i+', &quot;'+ctx+'&quot;)" data-idx="'+i+'">'+cestino+matita+'<b>'+esc(c.nomeCompleto)+'</b>'+badgeCollaboratore(c)+badgeRuolo(c)+(c.decedutoIl ? ' <span style="display:inline-block; background:#374151; color:#fff; border-radius:999px; padding:1px 7px; font-size:11px; font-weight:700">✝️ deceduto/a il '+esc(c.decedutoIl)+'</span>' : '')+'<span class="sub2 sub">Nato/a il '+esc(c.dataNascita)+(c.codiceFiscale ? ' · CF '+esc(c.codiceFiscale) : '')+(c.telefono || c.telefonoFisso ? ' · 📞 '+esc(c.telefono || c.telefonoFisso) : '')+(c.email ? ' · ✉️ '+esc(c.email) : '')+'</span></div>';
  }).join('') + rigaNuovo;
  box.dataset.match = JSON.stringify(match);
  box.classList.add('open');
}
// Collaboratore a cui appartiene un cliente (scelto dalla lista dei tipi di pratica)
function opzioniCollaboratore(sel){
  const l = getTipiList().slice(); if(sel && l.indexOf(sel) < 0) l.push(sel);
  return '<option value="">— nessuno —</option>' + l.map(function(t){ return '<option value="'+esc(t)+'"'+(t === sel ? ' selected' : '')+' style="'+stileOpzioneTipo(t)+'">'+esc(t)+'</option>'; }).join('');
}
// Ogni collaboratore / tipo di pratica col suo colore anche nelle tendine (le voci e la casella scelta)
function stileOpzioneTipo(t){ return 'background:' + coloreCollaboratore(t) + '; color:#fff; font-weight:700'; }
function coloraTendineCollaboratore(){
  document.querySelectorAll('#mc-collab, #nc-collab, #arc-collab, select[id^="e-tipo-"]').forEach(function(el){
    const v = el.value && el.value !== '-' ? el.value : '';
    if(el.dataset.colore === v) return;
    el.dataset.colore = v;
    if(v){ const c = coloreCollaboratore(v); el.style.background = c; el.style.color = '#fff'; el.style.fontWeight = '700'; el.style.borderColor = c; }
    else { el.style.background = ''; el.style.color = ''; el.style.fontWeight = ''; el.style.borderColor = ''; }
  });
}
document.addEventListener('change', function(e){ if(e.target && e.target.tagName === 'SELECT') coloraTendineCollaboratore(); });
setInterval(coloraTendineCollaboratore, 800);
function badgeCollaboratore(c){
  return c && c.collaboratore ? ' <span title="Collaboratore" style="display:inline-block; background:'+coloreCollaboratore(c.collaboratore)+'; color:#fff; border-radius:999px; padding:1px 8px; font-size:11px; font-weight:700">🤝 '+esc(c.collaboratore)+'</span>' : '';
}
// Ruolo nella dichiarazione: titolare (dichiarante) o coniuge dichiarante nella congiunta
const RUOLI_DICHIARAZIONE = { dichiarante: '👤 Dichiarante', coniuge: '💑 Coniuge dichiarante' };
function opzioniRuoloDichiarazione(sel){
  return '<option value="">— non indicato —</option>' + Object.keys(RUOLI_DICHIARAZIONE).map(function(k){ return '<option value="'+k+'"'+(k === sel ? ' selected' : '')+'>'+RUOLI_DICHIARAZIONE[k]+'</option>'; }).join('');
}
// Di chi è coniuge (dall'ultima pratica congiunta in cui compare come coniuge)
function coniugeDiCliente(c){
  if(!c) return '';
  if(c.dichiaranteNome) return c.dichiaranteNome;
  const nome = String(c.nomeCompleto || '').trim().toUpperCase(), cf = String(c.codiceFiscale || '').toUpperCase();
  const l = (state.pratiche || []).filter(function(p){
    if(p.annullata) return false;
    const con = (((p.congCognome || '') + ' ' + (p.congNome || '')).trim() || p.congiunta || '').toUpperCase();
    return (cf && String(p.congCodiceFiscale || '').toUpperCase() === cf) || (con && con === nome);
  }).sort(function(a, b){ return annoPratica(b) - annoPratica(a); });
  return l.length ? l[0].nome || '' : '';
}
// Data di nascita del dichiarante (scritta nella scheda, altrimenti dall'ultima pratica congiunta)
function nascitaDichiaranteCliente(c){
  if(!c) return '';
  if(c.dichiaranteNascita) return c.dichiaranteNascita;
  const nome = String(c.nomeCompleto || '').trim().toUpperCase(), cf = String(c.codiceFiscale || '').toUpperCase();
  const p = (state.pratiche || []).filter(function(p){
    if(p.annullata) return false;
    const con = (((p.congCognome || '') + ' ' + (p.congNome || '')).trim() || p.congiunta || '').toUpperCase();
    return (cf && String(p.congCodiceFiscale || '').toUpperCase() === cf) || (con && con === nome);
  }).sort(function(a, b){ return annoPratica(b) - annoPratica(a); })[0];
  return p && (!c.dichiaranteNome || String(p.nome || '').toUpperCase() === String(c.dichiaranteNome).toUpperCase()) ? (p.cf || '') : '';
}
// Caselle del dichiarante (per il coniuge): cognome e nome + data di nascita, con i nomi dell'archivio proposti
function campiDichiaranteHTML(prefisso, nome, nascita){
  return '<div style="display:flex; gap:8px; flex-wrap:wrap">'
    + '<input id="'+prefisso+'dichiarante" list="lista-nomi-archivio" autocomplete="off" value="'+esc(nome || '')+'" placeholder="Cognome e nome, es. ROSSI MARIO" style="flex:2 1 220px; text-transform:uppercase" oninput="this.value=this.value.toUpperCase(); nascitaDichiaranteDaArchivio(\''+prefisso+'\')">'
    + '<input id="'+prefisso+'dichiarante-nascita" value="'+esc(nascita || '')+'" placeholder="Nato/a il GG/MM/AAAA" inputmode="numeric" title="Data di nascita del dichiarante" style="flex:1 1 140px" oninput="autoSlashData(this)">'
    + '</div>' + (typeof datalistNomiArchivio === 'function' ? datalistNomiArchivio() : '');
}
// scelto un nome dell'archivio, la data di nascita si compila da sola (se c'è un solo cliente con quel nome)
function nascitaDichiaranteDaArchivio(prefisso){
  const n = document.getElementById(prefisso + 'dichiarante'), d = document.getElementById(prefisso + 'dichiarante-nascita');
  if(!n || !d || d.value.trim()) return;
  const v = n.value.trim().toUpperCase();
  const l = ARCHIVIO_CLIENTI.filter(function(c){ return String(c.nomeCompleto || '').toUpperCase() === v && c.dataNascita; });
  if(l.length === 1) d.value = l[0].dataNascita;
}
function badgeLavoratore(c){ return (c && c.inquilino ? ' <span title="Inquilino di un contratto di affitto" style="display:inline-block; background:#a0522d; color:#fff; border-radius:999px; padding:1px 8px; font-size:11px; font-weight:700">🏠 inquilino</span>' : '') + (c && c.lavoratoreColf ? ' <span title="Lavoratore di un contratto colf e badanti" style="display:inline-block; background:#8e44ad; color:#fff; border-radius:999px; padding:1px 8px; font-size:11px; font-weight:700">👷 lavoratore colf</span>' : ''); }
function badgeRuolo(c){
  if(!c) return '';
  if(!c.ruoloDichiarazione || !RUOLI_DICHIARAZIONE[c.ruoloDichiarazione]) return badgeLavoratore(c);
  const di = c.ruoloDichiarazione === 'coniuge' ? coniugeDiCliente(c) : '';
  const nato = di ? nascitaDichiaranteCliente(c) : '';
  return ' <span title="Ruolo nella dichiarazione" style="display:inline-block; background:'+(c.ruoloDichiarazione === 'coniuge' ? '#b0306a' : '#1d4f91')+'; color:#fff; border-radius:999px; padding:1px 8px; font-size:11px; font-weight:700">'+RUOLI_DICHIARAZIONE[c.ruoloDichiarazione]+(di ? ' di '+esc(di)+(nato ? ' (nato/a il '+esc(nato)+')' : '') : '')+'</span>' + badgeLavoratore(c);
}
// Ruolo nella scheda del cliente; soloSeVuoto: non cambia un ruolo già scelto (es. salvando una pratica)
async function salvaRuoloCliente(nomeCompleto, dataNascita, codiceFiscale, ruolo, soloSeVuoto, dichiarante, dichiaranteNascita){
  if(!ruolo) return;
  try{
    // coniuge: anche il nome del dichiarante (solo se non c'è già)
    if(ruolo === 'coniuge' && dichiarante){
      let qd = supabase.from('clienti').update(Object.assign({ dichiarante_nome: dichiarante }, dichiaranteNascita ? { dichiarante_nascita: dichiaranteNascita } : {}));
      qd = codiceFiscale ? qd.eq('codice_fiscale', codiceFiscale) : qd.eq('nome_completo', nomeCompleto).eq('data_nascita', dataNascita || '');
      await qd.is('dichiarante_nome', null);
      const r0 = trovaInArchivio(nomeCompleto, dataNascita, codiceFiscale); if(r0 && !r0.dichiaranteNome){ r0.dichiaranteNome = dichiarante; if(dichiaranteNascita) r0.dichiaranteNascita = dichiaranteNascita; }
    }
    let q = supabase.from('clienti').update({ ruolo_dichiarazione: ruolo });
    q = codiceFiscale ? q.eq('codice_fiscale', codiceFiscale) : q.eq('nome_completo', nomeCompleto).eq('data_nascita', dataNascita || '');
    if(soloSeVuoto) q = q.is('ruolo_dichiarazione', null);
    const { error } = await q;
    if(error) throw new Error(error.message);
    const rec = trovaInArchivio(nomeCompleto, dataNascita, codiceFiscale); if(rec && (!soloSeVuoto || !rec.ruoloDichiarazione)) rec.ruoloDichiarazione = ruolo;
  }catch(e){ console.error('ruolo cliente', e); }
}
// Salva il collaboratore nella scheda del cliente (cercata per codice fiscale, altrimenti per nome e data di nascita)
// soloSeVuoto: non cambia un collaboratore già indicato (es. salvando una pratica)
async function salvaCollaboratoreCliente(nomeCompleto, dataNascita, codiceFiscale, collaboratore, soloSeVuoto){
  try{
    let q = supabase.from('clienti').update({ collaboratore: collaboratore || null });
    q = codiceFiscale ? q.eq('codice_fiscale', codiceFiscale) : q.eq('nome_completo', nomeCompleto).eq('data_nascita', dataNascita || '');
    if(soloSeVuoto) q = q.is('collaboratore', null);
    const { error } = await q;
    if(error) throw new Error(error.message);
    const rec = trovaInArchivio(nomeCompleto, dataNascita, codiceFiscale); if(rec && (!soloSeVuoto || !rec.collaboratore)) rec.collaboratore = collaboratore || null;
  }catch(e){ console.error('collaboratore cliente', e); }
}
// Riferimento (la persona che ha portato il cliente) e note nella scheda del cliente
async function salvaRiferimentoCliente(nomeCompleto, dataNascita, codiceFiscale, campi){
  try{
    let q = supabase.from('clienti').update({ riferimento: campi.riferimento != null ? (campi.riferimento || null) : undefined, note: campi.note != null ? (campi.note || null) : undefined });
    q = codiceFiscale ? q.eq('codice_fiscale', codiceFiscale) : q.eq('nome_completo', nomeCompleto).eq('data_nascita', dataNascita || '');
    const { error } = await q;
    if(error) throw new Error(error.message);
    const rec = trovaInArchivio(nomeCompleto, dataNascita, codiceFiscale);
    if(rec){ if(campi.riferimento != null) rec.riferimento = campi.riferimento || null; if(campi.note != null) rec.note = campi.note || null; }
  }catch(e){ console.error('riferimento cliente', e); }
}
// Elenco dei nomi dell'archivio per la casella del riferimento (si crea una volta)
function preparaNomiRiferimento(){
  if(typeof datalistNomiArchivio !== 'function') return;
  const d = document.createElement('div'); d.innerHTML = datalistNomiArchivio(); document.body.appendChild(d.firstChild);
}
function badgeRiferimento(c){ return c && c.riferimento ? ' <span style="font-size:11.5px; font-weight:800; color:#6d3fa0" title="Persona che ha portato il cliente">👤 rif. ' + esc(c.riferimento) + '</span>' : ''; }
// Clienti portati da una persona (per la scheda della persona)
function clientiPortatiDa(nome){
  nome = String(nome || '').trim().toUpperCase(); if(!nome) return [];
  return (ARCHIVIO_CLIENTI || []).filter(function(c){ return String(c.riferimento || '').trim().toUpperCase() === nome; });
}
// Collaboratore della scheda dopo una nuova pratica 730: quello della pratica dell'anno più recente
function aggiornaCollaboratoreDaPratica(nomeCompleto, dataNascita, codiceFiscale, tipo, anno){
  const rec = trovaInArchivio(nomeCompleto, dataNascita, codiceFiscale);
  const nome = String(nomeCompleto || '').toUpperCase(), cf = String(codiceFiscale || '').toUpperCase();
  const piuRecente = (state.pratiche || []).filter(function(p){ return !p.annullata && e730(p) && ((cf && String(p.codiceFiscale || '').toUpperCase() === cf) || String(p.nome || '').toUpperCase() === nome); })
    .reduce(function(m, p){ return Math.max(m, annoPratica(p)); }, 0);
  if(rec && rec.collaboratore && rec.collaboratore !== tipo){
    if(anno < piuRecente) return; // pratica di un anno passato: la scheda resta con il collaboratore attuale
    salvaCollaboratoreCliente(nomeCompleto, dataNascita, codiceFiscale, tipo, false);
    avviso('🤝 ' + nomeCompleto + ': collaboratore cambiato da ' + rec.collaboratore + ' a ' + tipo + ' (gli anni prima restano nello storico)');
    return;
  }
  salvaCollaboratoreCliente(nomeCompleto, dataNascita, codiceFiscale, tipo, true);
}
// 🤝 Collaboratore negli anni (dalle pratiche 730): es. 2026 730 SEDE → 2027 730 RICCA AGATINO
function percorsoCollaboratoreHTML(pratiche){
  const perAnno = {};
  (pratiche || []).filter(function(p){ return !p.annullata && e730(p) && p.tipo; }).forEach(function(p){
    const a = annoPratica(p); (perAnno[a] = perAnno[a] || []); if(perAnno[a].indexOf(p.tipo) < 0) perAnno[a].push(p.tipo);
  });
  const anni = Object.keys(perAnno).map(Number).sort(function(a, b){ return a - b; });
  if(!anni.length) return '';
  let prima = null, cambi = 0;
  const pezzi = anni.map(function(a){
    const t = perAnno[a].join(' + '), cambiato = prima !== null && prima !== t; if(cambiato) cambi++; prima = t;
    return '<span style="white-space:nowrap">' + (cambiato ? '<b style="color:#b35f0c">🔄</b> ' : '') + '<b>' + a + '</b> ' + perAnno[a].map(function(x){ return '<span style="display:inline-block; background:' + coloreCollaboratore(x) + '; color:#fff; border-radius:999px; padding:1px 9px; font-size:12px; font-weight:700">' + esc(x) + '</span>'; }).join(' ') + '</span>';
  });
  return '<div style="margin:0 0 8px; padding:7px 12px; border-radius:10px; border:1.5px solid var(--line); font-size:13px; display:flex; gap:8px; flex-wrap:wrap; align-items:center"><b>🤝 Collaboratore negli anni:</b> ' + pezzi.join(' <span style="color:var(--sub)">→</span> ')
    + (cambi ? ' <span class="sub2">(' + cambi + (cambi === 1 ? ' cambio' : ' cambi') + ' di collaboratore)</span>' : '') + '</div>';
}
// Nuovo cliente scritto a mano: va in archivio e poi si ritrova subito nella ricerca, pronto da scegliere per la pratica
function nuovoClienteAMano(){
  const cerca = document.getElementById('cli-cerca');
  nuovoClienteArchivio(cerca ? cerca.value : '', function(nome){ if(cerca){ cerca.value = nome; cercaClienti(nome); cerca.focus(); } });
}
function scegliCliente(i, ctx){
  ctx = ctx || 'main';
  const box = boxRisultatiClienti(ctx);
  const match = JSON.parse(box.dataset.match || '[]');
  const c = match[i];
  if(!c) return;
  if(c.decedutoIl && !confirm(c.nomeCompleto + ' risulta deceduto/a il ' + c.decedutoIl + '.\n\nVuoi usarlo lo stesso (per esempio per il 730 del defunto)?')) return;
  // coniuge dichiarante scelto come titolare: si propone di mettere il dichiarante come titolare e lui/lei come coniuge
  if(ctx === 'main'){
    const dich = c.ruoloDichiarazione === 'coniuge' && c.dichiaranteNome ? trovaInArchivio(c.dichiaranteNome, c.dichiaranteNascita || '', '') : null;
    if(dich && !dich.decedutoIl && confirm(c.nomeCompleto + ' è coniuge dichiarante di ' + dich.nomeCompleto + '.\n\nPreparo la congiunta con ' + dich.nomeCompleto + ' come dichiarante e ' + c.nomeCompleto + ' come coniuge?')){
      usaCliente(dich, 'main');
      compilaConiugeCongiunta(c, dich);
      box.classList.remove('open');
      return;
    }
  }
  usaCliente(c, ctx);
  // dichiarante con il coniuge collegato in archivio: la congiunta si compila da sola
  if(ctx === 'main'){ const con = coniugeCollegato(c); if(con) compilaConiugeCongiunta(con, c); }
  box.classList.remove('open');
}
// Coniuge collegato al dichiarante: la scheda del coniuge in archivio (ruolo «coniuge dichiarante» con questo dichiarante),
// altrimenti il coniuge dell'ultima pratica congiunta del dichiarante
function coniugeCollegato(c){
  const nome = String(c.nomeCompleto || '').trim().toUpperCase();
  if(!nome) return null;
  const perArchivio = (ARCHIVIO_CLIENTI || []).find(function(x){
    return x !== c && !x.decedutoIl && x.ruoloDichiarazione === 'coniuge' && String(x.dichiaranteNome || '').trim().toUpperCase() === nome
      && (!x.dichiaranteNascita || !c.dataNascita || x.dichiaranteNascita === c.dataNascita);
  });
  if(perArchivio) return perArchivio;
  const cf = String(c.codiceFiscale || '').toUpperCase();
  const p = (state.pratiche || []).filter(function(p){ return !p.annullata && (p.congCognome || p.congNome || p.congiunta) && ((cf && String(p.codiceFiscale || '').toUpperCase() === cf) || String(p.nome || '').toUpperCase() === nome); })
    .sort(function(a, b){ return annoPratica(b) - annoPratica(a); })[0];
  if(!p) return null;
  const con = trovaInArchivio(((p.congCognome || '') + ' ' + (p.congNome || '')).trim() || p.congiunta, p.congData, p.congCodiceFiscale);
  return con && !con.decedutoIl ? con : null;
}
// Mette il coniuge nella parte «congiunta» del modulo (se non è già compilata a mano)
// dich: il dichiarante (titolare); resta un riquadro fisso nella congiunta, con il tasto per scambiarli
let CONG_AUTO = null;
function compilaConiugeCongiunta(con, dich){
  const chk = document.getElementById('f-congiunta-on'); if(!chk) return;
  if(!tipoAmmetteCongiunta((document.getElementById('f-tipo')||{}).value)) return; // solo per i 730
  const gia = ((document.getElementById('f-cong-cognome') || {}).value || '').trim();
  if(gia && gia.toUpperCase() !== String(con.cognome || '').toUpperCase()) return;
  if(!chk.checked){ chk.checked = true; toggleCongBox(); }
  usaCliente(con, 'cong');
  CONG_AUTO = { dich: dich || null, con: con };
  avvisoCongiuntaAutomatica();
}
function avvisoCongiuntaAutomatica(){
  const boxC = document.getElementById('f-cong-box'); if(!boxC) return;
  let el = document.getElementById('cong-auto-avviso');
  if(!CONG_AUTO){ if(el) el.remove(); return; }
  if(!el){ el = document.createElement('div'); el.id = 'cong-auto-avviso'; boxC.insertBefore(el, boxC.firstChild); }
  el.style.cssText = 'grid-column:1/-1; margin-bottom:8px; padding:9px 12px; border-radius:10px; border:2px solid #6d3fa0; background:color-mix(in srgb, #6d3fa0 8%, var(--card)); font-size:13px; display:flex; gap:8px; flex-wrap:wrap; align-items:center';
  el.innerHTML = '<span style="flex:1 1 260px">💑 <b>Congiunta compilata dall\'archivio</b>: dichiarante <b>' + esc(CONG_AUTO.dich ? CONG_AUTO.dich.nomeCompleto : ((document.getElementById('f-cognome').value + ' ' + document.getElementById('f-nome').value).trim())) + '</b>, coniuge <b>' + esc(CONG_AUTO.con.nomeCompleto) + '</b>. Se quest\'anno è singola, togli la spunta «Congiunta».</span>'
    + (CONG_AUTO.dich ? '<button type="button" onclick="invertiDichiaranteConiuge()" style="background:#6d3fa0; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">🔄 Inverti dichiarante e coniuge</button>' : '')
    + '<button type="button" onclick="CONG_AUTO = null; avvisoCongiuntaAutomatica()" title="Chiudi l\'avviso" style="background:none; border:1px solid var(--line); color:var(--ink); border-radius:999px; padding:5px 10px; cursor:pointer">✕</button>';
}
// Scambia: il coniuge diventa titolare (dichiarante) e il dichiarante va nella congiunta
function invertiDichiaranteConiuge(){
  if(!CONG_AUTO || !CONG_AUTO.dich) return;
  const nuovoDich = CONG_AUTO.con, nuovoCon = CONG_AUTO.dich;
  ['f-cong-cognome','f-cong-nome','f-cong-data','f-cong-cf','f-cong-tel','f-cong-email','f-cong-comune','f-cong-sesso','f-cong-doc-scad','f-cong-doc-num'].forEach(function(id){ const e = document.getElementById(id); if(e){ e.value = ''; e.dataset.auto = ''; e.dataset.manuale = ''; } });
  ['f-tel','f-tel-fisso','f-email','f-doc-scad','f-doc-num','f-comune','f-riferimento'].forEach(function(id){ const e = document.getElementById(id); if(e) e.value = ''; });
  usaCliente(nuovoDich, 'main');
  usaCliente(nuovoCon, 'cong');
  CONG_AUTO = { dich: nuovoDich, con: nuovoCon };
  avvisoCongiuntaAutomatica();
  // anche nell'archivio: chi dichiara e chi è il coniuge dichiarante
  const ruoloD = { ruoloDichiarazione: 'dichiarante', dichiaranteNome: null, dichiaranteNascita: null };
  const ruoloC = { ruoloDichiarazione: 'coniuge', dichiaranteNome: nuovoDich.nomeCompleto, dichiaranteNascita: nuovoDich.dataNascita || null };
  if(nuovoDich.id){ Object.assign(nuovoDich, ruoloD); data.clienti.aggiorna(nuovoDich.id, ruoloD); }
  if(nuovoCon.id){ Object.assign(nuovoCon, ruoloC); data.clienti.aggiorna(nuovoCon.id, ruoloC); }
  avviso('🔄 Ora il dichiarante è ' + nuovoDich.nomeCompleto + ' e il coniuge ' + nuovoCon.nomeCompleto + ' (aggiornato anche nell\'archivio)');
}
function usaCliente(c, ctx){
  const box = boxRisultatiClienti(ctx);
  // cliente di un collaboratore: il tipo di pratica si propone da solo
  if(ctx === 'main' && c.collaboratore && getTipiList().indexOf(c.collaboratore) >= 0) pickChip('f-tipo-btns','f-tipo', c.collaboratore);
  if(ctx==='sc'){
    document.getElementById('sc-cliente').value = c.nomeCompleto.toUpperCase();
  } else if(ctx==='lav'){
    usaLavoratore(c);
  } else if(ctx==='cong'){
    document.getElementById('f-cong-cognome').value = c.cognome.toUpperCase();
    document.getElementById('f-cong-nome').value = c.nome.toUpperCase();
    document.getElementById('f-cong-data').value = c.dataNascita;
    document.getElementById('cli-cerca-cong').value = c.nomeCompleto;
    document.getElementById('f-cong-cf').value = c.codiceFiscale || '';
    document.getElementById('f-cong-cf').dataset.auto = '';
    if(c.comuneNascita){ document.getElementById('f-cong-comune').value = c.comuneNascita; document.getElementById('f-cong-comune').dataset.auto = ''; }
    comuneNelCampo('f-cong-cf', 'f-cong-comune');
    document.getElementById('f-cong-tel').value = c.telefono || '';
    if(document.getElementById('f-cong-email')) document.getElementById('f-cong-email').value = c.email || '';
    if(document.getElementById('f-cong-doc-scad')) document.getElementById('f-cong-doc-scad').value = c.documentoScadenza || '';
    if(document.getElementById('f-cong-doc-num')) document.getElementById('f-cong-doc-num').value = c.documentoNumero || '';
    if(document.getElementById('f-cong-doc-tipo') && c.documentoTipo){ document.getElementById('f-cong-doc-tipo').innerHTML = opzioniTipoDoc(c.documentoTipo); }
    if(typeof controllaCFConiuge === 'function') controllaCFConiuge();
    if(typeof coloraScadenzaConiuge === 'function') coloraScadenzaConiuge();
  } else {
    document.getElementById('f-cognome').value = c.cognome.toUpperCase();
    document.getElementById('f-nome').value = c.nome.toUpperCase();
    document.getElementById('f-cf').value = c.dataNascita;
    document.getElementById('cli-cerca').value = c.nomeCompleto;
    document.getElementById('f-codfisc').value = c.codiceFiscale || '';
    if(c.telefono) document.getElementById('f-tel').value = c.telefono;
    if(c.telefonoFisso) document.getElementById('f-tel-fisso').value = c.telefonoFisso;
    if(c.email) document.getElementById('f-email').value = c.email;
    if(c.documentoScadenza){ document.getElementById('f-doc-scad').value = c.documentoScadenza; coloraScadenzaDocumento(); }
    if(document.getElementById('f-doc-num')) document.getElementById('f-doc-num').value = c.documentoNumero || '';
    if(document.getElementById('f-doc-tipo') && c.documentoTipo){ document.getElementById('f-doc-tipo').innerHTML = opzioniTipoDoc(c.documentoTipo); }
    if(c.comuneNascita && document.getElementById('f-comune')){ document.getElementById('f-comune').value = c.comuneNascita; document.getElementById('f-comune').dataset.auto = ''; }
    if(document.getElementById('f-riferimento')) document.getElementById('f-riferimento').value = c.riferimento || '';
    document.getElementById('f-codfisc').dataset.auto = '';
    controllaCampoCF();
    aggiornaStoricoForm();
  }
  box.classList.remove('open');
}
document.addEventListener('click', function(e){
  [['cli-cerca','cli-results'], ['cli-cerca-cong','cli-results-cong'], ['sc-cliente','cli-results-sc']].forEach(function(pair){
    const wrap = document.getElementById(pair[0]);
    const box = document.getElementById(pair[1]);
    if(wrap && box && !wrap.contains(e.target) && !box.contains(e.target)) box.classList.remove('open');
  });
});

const ANNO_INIZIO_PROTOCOLLO = 2027;
function parseDataIT(s){
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s||'').trim());
  // date impossibili o anni sbagliati (es. 10/11/0202) non sono valide
  if(!m || +m[1] < 1 || +m[1] > 31 || +m[2] < 1 || +m[2] > 12 || +m[3] < 1900 || +m[3] > 2100) return null;
  return {g:+m[1], m:+m[2], a:+m[3]};
}
// Anno a cui conta un versamento al CAF: quello delle fatture che paga (scelto nel modulo), altrimenti l'anno della data
function annoVersamento(v){ return Number(v && v.anno) || annoDiData(v && v.data); }
function annoDiData(s){
  const d = parseDataIT(s);
  return d ? d.a : (new Date()).getFullYear();
}
// Una pratica congiunta vale 2, una singola 1
// conteggio delle pratiche: la congiunta vale 2; un contratto colf in continuazione (trasferito o rinnovato) non è una pratica nuova e vale 0
// (i suoi incassi restano in contabilità dell'anno in cui si riscuotono)
function pesoPratica(p){ return eContinuazione(p) ? 0 : (p.congCognome || p.congNome) ? 2 : 1; }
function sommaPeso(lista){ return lista.reduce(function(t,p){ return t + pesoPratica(p); }, 0); }
// Quante congiunte ci sono in un elenco (per spiegare il conteggio: 7 pratiche di cui 1 congiunta = 8)
function numeroCongiunte(lista){ return (lista||[]).filter(function(p){ return pesoPratica(p) === 2; }).length; }
function notaCongiunte(lista){ const c = numeroCongiunte(lista); return '<br><small style="font-weight:600; opacity:.95">' + (lista||[]).length + ' pratiche, di cui ' + c + ' congiunt' + (c === 1 ? 'a, che conta 2' : 'e, che contano 2') + '</small>'; }
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
  const somma = function(l, k){ return l.reduce(function(a,x){ return a+Number(x[k]||0); }, 0); };
  const perAnno = {};
  altre.forEach(function(x){ (perAnno[annoPratica(x)] = perAnno[annoPratica(x)] || []).push(x); });
  const anni = Object.keys(perAnno).sort(function(a,b){ return b-a; });
  const cella = 'padding:3px 6px; border-bottom:1px solid var(--line)';
  const num = cella + '; text-align:right; white-space:nowrap';
  return '<div class="meta" style="margin-top:6px; padding-top:6px; border-top:1px dashed var(--line)">'
    + '<b>Storico cliente</b> · ' + altre.length + ' pratiche · Fatturato totale: <b>' + fmtEuro(somma(altre,'compenso')) + '</b> · Incassato totale: <b>' + fmtEuro(somma(altre,'pagato')) + '</b>'
    + '<div style="overflow-x:auto; margin-top:6px"><table style="width:100%; border-collapse:collapse; font-size:12px">'
    + '<thead><tr><th style="'+cella+'; text-align:left">N.</th><th style="'+cella+'; text-align:left">Tipo di pratica</th><th style="'+num+'">Fattura</th><th style="'+num+'">Incasso</th></tr></thead><tbody>'
    + anni.map(function(anno){
      const lista = perAnno[anno].slice().sort(function(a,b){ return a.numero - b.numero; });
      return '<tr><td colspan="2" style="'+cella+'; font-weight:700; background:var(--bg)">Anno ' + esc(anno) + '</td>'
        + '<td style="'+num+'; font-weight:700; background:var(--bg)">' + fmtEuro(somma(lista,'compenso')) + '</td>'
        + '<td style="'+num+'; font-weight:700; background:var(--bg)">' + fmtEuro(somma(lista,'pagato')) + '</td></tr>'
        + lista.map(function(x){
          const col = coloreCollaboratore(x.tipo || 'SENZA TIPO');
          const questa = x.id === p.id;
          return '<tr' + (questa ? ' style="font-weight:700"' : '') + '>'
            + '<td style="'+cella+'">' + esc(formattaProtocollo(x)) + (questa ? ' (questa)' : '') + '</td>'
            + '<td style="'+cella+'"><span style="display:inline-block; background:'+col+'; color:#fff; font-weight:600; border-radius:999px; padding:1px 8px">' + esc(x.tipo || 'SENZA TIPO') + '</span></td>'
            + '<td style="'+num+'">' + fmtEuro(Number(x.compenso||0)) + '</td>'
            + '<td style="'+num+'">' + fmtEuro(Number(x.pagato||0)) + '</td></tr>';
        }).join('');
    }).join('')
    + '</tbody></table></div></div>';
}
// Storico del cliente nel modulo di inserimento: tutte le pratiche passate (anche come congiunto).
// Se la data di nascita e' nota da entrambe le parti deve coincidere, per non confondere gli omonimi.
function praticheDelCliente(nomeCompleto, dataNascita, codiceFiscale){
  const stessaData = function(d){ return !dataNascita || !d || d === dataNascita; };
  return (state.pratiche||[]).filter(function(p){
    if(codiceFiscale && p.codiceFiscale) return p.codiceFiscale === codiceFiscale;
    const comeTitolare = (p.nome||'').toUpperCase() === nomeCompleto && stessaData(p.cf);
    const comeCongiunto = ((p.congCognome||'')+' '+(p.congNome||'')).trim().toUpperCase() === nomeCompleto && stessaData(p.congData);
    return comeTitolare || comeCongiunto;
  }).sort(function(a,b){ return (annoPratica(b)-annoPratica(a)) || (b.numero-a.numero); });
}
// Spunta "Iscritto CISL" in evidenza nell'inserimento; si ripropone da sola se il cliente era iscritto nelle pratiche precedenti
function aspettoIscrittoCisl(){
  const c = document.getElementById('f-iscritto-cisl'), box = document.getElementById('f-cisl-box');
  if(!c || !box) return;
  box.style.background = c.checked ? '#c0392b' : 'transparent';
  box.style.color = c.checked ? '#fff' : '#c0392b';
  const nota = document.getElementById('f-cisl-nota');
  if(nota && !c.checked) nota.textContent = '';
}
function proponiIscrittoCisl(lista){
  const c = document.getElementById('f-iscritto-cisl'), nota = document.getElementById('f-cisl-nota');
  if(!c || c.dataset.manuale) return;
  const prec = (lista||[]).find(function(p){ return p.iscrittoCisl; });
  c.checked = !!prec;
  if(nota) nota.textContent = prec ? '✓ già iscritto: risulta dalla pratica ' + formattaProtocollo(prec) + ' (' + annoPratica(prec) + ')' : '';
  aspettoIscrittoCisl();
}
function aggiornaStoricoForm(){
  const box = document.getElementById('storico-cliente');
  if(!box) return;
  const cognome = document.getElementById('f-cognome').value.trim().toUpperCase();
  const nome = document.getElementById('f-nome').value.trim().toUpperCase();
  const nomeCompleto = (cognome+' '+nome).trim();
  const dataNascita = document.getElementById('f-cf').value.trim();
  const cfForm = document.getElementById('f-codfisc').value;
  const lista = cognome ? praticheDelCliente(nomeCompleto, /^\d{2}\/\d{2}\/\d{4}$/.test(dataNascita) ? dataNascita : '', cfValido(cfForm) ? cfForm : '') : [];
  proponiIscrittoCisl(lista);
  if(!cognome){ box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = 'block';
  if(!lista.length){
    box.innerHTML = '<div class="raff-title">Storico pratiche di '+esc(nomeCompleto)+'</div><div class="empty">Nessuna pratica precedente per questo cliente.</div>';
    return;
  }
  const totFatt = lista.reduce(function(a,p){ return a+Number(p.compenso||0); }, 0);
  const totPag = lista.reduce(function(a,p){ return a+Number(p.pagato||0); }, 0);
  const totRic = lista.reduce(function(a,p){ return a+Number(p.richiesto||0); }, 0);
  const totManca = lista.reduce(function(a,p){ return a+(typeof residuoPratica === 'function' && !p.annullata && p.stato !== 'rinuncia_compilazione' ? residuoPratica(p) : 0); }, 0);
  const euro = function(v){ return v!=null && v!=='' && Number(v) ? fmtEuro(v) : '-'; };
  box.innerHTML = (typeof avvisoMorosoHTML === 'function' ? avvisoMorosoHTML(lista) : '') + '<div class="raff-title">Storico pratiche di '+esc(nomeCompleto)+(dataNascita ? ' <span class="sub2">nato/a il '+esc(dataNascita)+'</span>' : '')+'</div>'
    + '<div class="meta" style="margin:0 0 8px">'+lista.length+' pratiche · Fatture: <b>'+fmtEuro(totFatt)+'</b> · Richiesto: <b>'+fmtEuro(totRic)+'</b> · Pagato: <b>'+fmtEuro(totPag)+'</b>'+(totManca > 0.004 ? ' · <b style="color:#c0392b">Deve ancora '+fmtEuro(totManca)+'</b>' : '')+'</div>'
    + '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>N. protocollo</th><th>Data</th><th>Tipo</th><th>Stato</th><th style="text-align:right">Fattura</th><th style="text-align:right">Richiesto</th><th style="text-align:right">Pagato</th><th style="text-align:right">Manca</th><th>Inserita da</th></tr></thead><tbody>'
    + lista.map(function(p){
        const congiunto = (p.nome||'').toUpperCase() !== nomeCompleto;
        return '<tr><td class="n">'+formattaProtocollo(p)+'</td><td>'+esc(p.data)+'</td><td>'+esc(p.tipo)+(congiunto ? ' <span class="sub2">(congiunto di '+esc(p.nome)+')</span>' : '')+'</td>'
          + '<td>'+esc(statoLabel(p.stato))+(p.consegnataIl ? '<div class="sub2">📦 '+esc(p.consegnataIl)+'</div>' : '')+'</td><td style="text-align:right">'+euro(p.compenso)+'</td><td style="text-align:right">'+euro(p.richiesto)+'</td><td style="text-align:right">'+euro(p.pagato)+'</td>'
          + (function(){ const m = typeof residuoPratica === 'function' ? residuoPratica(p) : 0; return '<td style="text-align:right; font-weight:800; color:'+(m > 0.004 ? '#c0392b' : '#1a7f37')+'">'+(m > 0.004 ? fmtEuro(m) : '✓')+'</td>'; })()
          + '<td>'+esc(p.inseritoDa||'-')+'</td></tr>';
      }).join('')
    + '</tbody></table></div>';
}
// Messaggio sotto il campo codice fiscale: validita', dati ricavati e coerenza con il modulo
// Comune di nascita ricavato dal codice fiscale: si scrive se il campo è vuoto o era già stato compilato in automatico
function comuneNelCampo(idCF, idComune){
  const c = document.getElementById(idComune), cfEl = document.getElementById(idCF);
  if(!c || !cfEl || typeof comuneDaCF !== 'function') return;
  const cf = normalizzaCF(cfEl.value);
  const auto = !c.value.trim() || c.dataset.auto === '1';
  if(!auto) return;
  const comune = cf.length === 16 && cfValido(cf) ? comuneDaCF(cf) : '';
  c.value = comune; c.dataset.auto = comune ? '1' : '';
}
function controllaCampoCF(){
  if(typeof proponiCFCalcolato === 'function') proponiCFCalcolato();
  comuneNelCampo('f-codfisc', 'f-comune');
  const el = document.getElementById('f-codfisc-msg');
  const cf = document.getElementById('f-codfisc').value;
  if(!cf){ el.style.display = 'none'; return; }
  el.style.display = 'block';
  if(cf.length < 16){ el.style.color = 'var(--sub)'; el.textContent = cf.length + '/16 caratteri'; return; }
  if(!cfValido(cf)){ el.style.color = '#c0392b'; el.textContent = '❌ Codice fiscale non valido (controlla i caratteri)'; return; }
  riempiDaArchivioPerCF(cf);
  const dati = datiDaCF(cf);
  // data di nascita vuota: si prende dal codice fiscale
  const dn = document.getElementById('f-cf'); if(dn && !dn.value.trim() && dati.dataNascita) dn.value = dati.dataNascita;
  const avvisi = controllaCoerenzaCF(cf, document.getElementById('f-cognome').value, document.getElementById('f-nome').value, document.getElementById('f-cf').value);
  if(avvisi.length){ el.style.color = '#b5842a'; el.textContent = '⚠️ Attenzione: ' + avvisi.join('; ') + '.'; return; }
  el.style.color = 'var(--accent)';
  el.textContent = '✓ Codice valido · ' + (dati.sesso === 'F' ? 'Donna nata il ' : 'Uomo nato il ') + dati.dataNascita + (typeof comuneDaCF === 'function' && comuneDaCF(cf) ? ' a ' + comuneDaCF(cf) : '');
  if(document.getElementById('f-codfisc').dataset.auto === '1') el.textContent += ' · 🧮 calcolato in automatico: controllalo sulla tessera sanitaria';
  else if(typeof aggiornaSessoModulo === 'function') aggiornaSessoModulo();
}
// Codice fiscale scritto a mano: se il cliente e' in archivio si compilano i campi ancora vuoti
let ULTIMO_CF_RIEMPITO = '';
function riempiDaArchivioPerCF(cf){
  const c = ARCHIVIO_CLIENTI.find(function(x){ return x.codiceFiscale === cf; });
  if(!c) return;
  const campo = function(id, valore){ const el = document.getElementById(id); if(el && !el.value.trim() && valore){ el.value = valore; return 1; } return 0; };
  const n = campo('f-cognome', (c.cognome||'').toUpperCase()) + campo('f-nome', (c.nome||'').toUpperCase()) + campo('f-cf', c.dataNascita)
    + campo('f-tel', c.telefono) + campo('f-tel-fisso', c.telefonoFisso) + campo('f-email', c.email) + campo('f-doc-scad', c.documentoScadenza) + campo('f-doc-num', c.documentoNumero);
  if(n){
    if(typeof coloraScadenzaDocumento === 'function') coloraScadenzaDocumento();
    const cerca = document.getElementById('cli-cerca'); if(cerca && !cerca.value.trim()) cerca.value = c.nomeCompleto;
    if(ULTIMO_CF_RIEMPITO !== cf) avviso('📇 ' + c.nomeCompleto + ' è già in archivio: dati compilati');
  }
  ULTIMO_CF_RIEMPITO = cf;
}
// Codice letto dalla tessera: compila i campi vuoti, usando l'archivio se il cliente c'e' gia'
function onCFLetto(cf){
  document.getElementById('f-codfisc').value = cf;
  let archiviato = ARCHIVIO_CLIENTI.find(function(c){ return c.codiceFiscale === cf; });
  if(!archiviato){
    // Clienti importati senza CF: riconoscibili se cognome, nome e data di nascita corrispondono al codice
    const candidati = ARCHIVIO_CLIENTI.filter(function(c){ return !c.codiceFiscale && c.dataNascita && controllaCoerenzaCF(cf, c.cognome, c.nome, c.dataNascita).length === 0; });
    if(candidati.length === 1) archiviato = candidati[0];
  }
  const campo = function(id, valore){ const el = document.getElementById(id); if(!el.value.trim() && valore) el.value = valore; };
  if(archiviato){
    campo('f-cognome', (archiviato.cognome||'').toUpperCase());
    campo('f-nome', (archiviato.nome||'').toUpperCase());
    campo('f-cf', archiviato.dataNascita);
    campo('f-tel', archiviato.telefono);
    campo('f-tel-fisso', archiviato.telefonoFisso);
    campo('f-email', archiviato.email);
    campo('f-doc-scad', archiviato.documentoScadenza);
    campo('f-doc-num', archiviato.documentoNumero);
    coloraScadenzaDocumento();
    document.getElementById('cli-cerca').value = archiviato.nomeCompleto;
  }
  campo('f-cf', datiDaCF(cf).dataNascita);
  controllaCampoCF();
  aggiornaStoricoForm();
  avviso(archiviato ? '✓ Cliente gia\' in archivio: ' + archiviato.nomeCompleto : '✓ Codice fiscale letto: ' + cf);
}
// Ultima modifica (chi e quando): si sovrascrive a ogni modifica
function ultimaModifica(p){
  if(!p.modificatoDa || !p.aggiornatoIl) return '';
  const d = new Date(p.aggiornatoIl);
  if(isNaN(d.getTime())) return '';
  return esc(p.modificatoDa) + ' il ' + String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + ' alle ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function formattaInserimento(p){
  if(!p.inseritoDa && !p.inseritoIl) return '-';
  let quando = '';
  if(p.inseritoIl){
    const d = new Date(p.inseritoIl);
    if(!isNaN(d.getTime())){
      quando = String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    }
  }
  return '<span style="font-size:9.5px; color:var(--sub); line-height:1.15">' + esc(p.inseritoDa||'-') + (quando ? '<br>'+quando : '') + '</span>';
}
// Serie del protocollo: "730" per le dichiarazioni 730, "AP" per le altre pratiche
function serieDi(p){ return (p && p.serie) || (String((p && p.tipo) || '').toUpperCase().indexOf('730') === 0 ? '730' : 'AP'); }
// Contratto colf in continuazione (trasferito nell'anno nuovo o rinnovato): si vede con il protocollo d'origine
function eContinuazione(p){ return !!(p && p.continuazione); }
// protocollo d'origine di un contratto, sempre con l'anno (es. AP-0002/2026)
function protocolloOrigineDi(p){ return p && p.continuazione && p.protocolloOrigine ? p.protocolloOrigine : serieDi(p) + '-' + String(p.numero).padStart(4,'0') + '/' + annoPratica(p); }
function formattaProtocollo(p){
  if(p && p.continuazione && p.protocolloOrigine) return p.protocolloOrigine;
  const anno = annoPratica(p);
  const num = serieDi(p) + '-' + String(p.numero).padStart(4,'0');
  return anno >= ANNO_INIZIO_PROTOCOLLO ? (num + '/' + anno) : num;
}
function elencoAnniDisponibili(){
  const anni = new Set();
  anni.add(ANNO_INIZIO_PROTOCOLLO);
  anni.add((new Date()).getFullYear());
  state.pratiche.forEach(function(p){ anni.add(annoPratica(p)); });
  (state.versamenti||[]).forEach(function(v){ anni.add(annoVersamento(v)); });
  return Array.from(anni).sort(function(a,b){ return a-b; });
}
let annoAttivoLocale = null;
function annoAttivo(){
  if(!annoAttivoLocale){
    let salvato = null, sceltoNel = null;
    try{ salvato = parseInt(localStorage.getItem('protocollo-anno'), 10); sceltoNel = parseInt(localStorage.getItem('protocollo-anno-scelto-nel'), 10); }catch(e){}
    const oggi = (new Date()).getFullYear(), predefinito = Math.max(ANNO_INIZIO_PROTOCOLLO, oggi);
    // a capodanno il registro passa da solo al nuovo anno (l'anno scelto prima vale fino al 31/12)
    if(salvato && sceltoNel && sceltoNel < oggi && salvato < predefinito) salvato = null;
    annoAttivoLocale = salvato || predefinito;
  }
  return annoAttivoLocale;
}
function initSelettoreAnno(){
  const sel = document.getElementById('anno-attivo');
  if(!sel) return;
  const anni = elencoAnniDisponibili();
  const cur = annoAttivo();
  sel.innerHTML = anni.map(function(a){ const c = coloreAnno(a); return '<option value="'+a+'"'+(a===cur?' selected':'')+' style="background:'+c+'; color:#fff; font-weight:700">'+a+(a<ANNO_INIZIO_PROTOCOLLO?' (storico)':'')+'</option>'; }).join('');
  coloraSelettoreAnno();
}
const COLORI_ANNI = ['#1d4f91','#2f9e5f','#8e5bd6','#d98b1e','#c0392b','#2f9e9e','#b5486b','#5a6b3b','#3b6fa0','#a0522d'];
function coloreAnno(a){ return COLORI_ANNI[((Number(a) % COLORI_ANNI.length) + COLORI_ANNI.length) % COLORI_ANNI.length]; }
function coloraSelettoreAnno(){
  const sel = document.getElementById('anno-attivo');
  if(!sel) return;
  const c = coloreAnno(annoAttivo());
  sel.style.background = c;
  sel.style.borderColor = c;
  sel.style.color = '#fff';
  sel.style.fontWeight = '700';
}
function cambiaAnnoAttivo(v){
  annoAttivoLocale = parseInt(v,10);
  coloraSelettoreAnno();
  try{ localStorage.setItem('protocollo-anno', v); localStorage.setItem('protocollo-anno-scelto-nel', String((new Date()).getFullYear())); }catch(e){}
  render();
}

const TAB_LABELS = {
  anagrafica: 'INSERIMENTO PRATICA',
  registro: 'REGISTRO DI PROTOCOLLO',
  contabilita: "CONTABILITA'",
  grafici: 'GRAFICI',
  caf: 'VERSAMENTI CAF',
  spese: 'SPESE GESTIONE SEDE',
  collaboratori: 'COLLABORATORI',
  scadenze: 'SCADENZE',
  messaggi: 'MESSAGGI WHATSAPP'
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
// Recupero password: codice di 6 cifre mandato per e-mail dalla casella del CAF (funzione "recupera-password" sul server)
function apriRecuperoPassword(){
  const box = document.getElementById('recupero-pwd');
  if(!box) return;
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
  const e = document.getElementById('login-email'), r = document.getElementById('rec-email');
  if(e && r && !r.value) r.value = e.value.trim();
}
async function chiamaRecupero(corpo){
  const res = await fetch(SUPABASE_URL + '/functions/v1/recupera-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
    body: JSON.stringify(corpo)
  });
  let dati = {};
  try{ dati = await res.json(); }catch(e){}
  if(!res.ok || dati.error) throw new Error(dati.error || ('Errore ' + res.status));
  return dati;
}
async function inviaCodiceRecupero(){
  const email = document.getElementById('rec-email').value.trim().toLowerCase();
  const msg = document.getElementById('rec-msg'), btn = document.getElementById('rec-invia');
  if(!emailValida(email)){ msg.innerHTML = '<b style="color:#c0392b">Scrivi la tua e-mail</b>'; return; }
  btn.disabled = true; msg.textContent = 'Invio del codice…';
  try{
    await chiamaRecupero({ azione: 'invia', email: email });
    msg.innerHTML = '<b style="color:#2f9e5f">✓ Se l\'e-mail è registrata nel programma, tra poco ti arriva il codice (controlla anche lo spam).</b>';
    document.getElementById('rec-passo2').style.display = 'block';
    setTimeout(function(){ const c = document.getElementById('rec-codice'); if(c) c.focus(); }, 50);
  }catch(e){ msg.innerHTML = '<b style="color:#c0392b">❌ ' + esc(e.message) + '</b>'; }
  btn.disabled = false;
}
async function cambiaPasswordRecupero(){
  const email = document.getElementById('rec-email').value.trim().toLowerCase();
  const codice = document.getElementById('rec-codice').value.replace(/\D/g,'');
  const p1 = document.getElementById('rec-pwd1').value, p2 = document.getElementById('rec-pwd2').value;
  const msg = document.getElementById('rec-msg');
  if(codice.length !== 6){ msg.innerHTML = '<b style="color:#c0392b">Il codice ha 6 cifre</b>'; return; }
  if(p1.length < 6){ msg.innerHTML = '<b style="color:#c0392b">La nuova password deve avere almeno 6 caratteri</b>'; return; }
  if(p1 !== p2){ msg.innerHTML = '<b style="color:#c0392b">Le due password non sono uguali</b>'; return; }
  msg.textContent = 'Salvataggio…';
  try{
    await chiamaRecupero({ azione: 'cambia', email: email, codice: codice, password: p1 });
    document.getElementById('recupero-pwd').style.display = 'none';
    const e = document.getElementById('login-email'), pw = document.getElementById('login-pwd');
    if(e) e.value = email;
    if(pw){ pw.value = ''; pw.focus(); }
    const lm = document.getElementById('login-msg');
    if(lm){ lm.style.display = 'block'; lm.style.color = '#2f9e5f'; lm.textContent = '✓ Password cambiata: ora accedi con la nuova password.'; }
  }catch(e){ msg.innerHTML = '<b style="color:#c0392b">❌ ' + esc(e.message) + '</b>'; }
}
function renderLogin(){
  const wrap = document.getElementById('login-lista');
  if(!wrap) return;

  // Form di login con email/password
  wrap.innerHTML = `
    <div style="text-align: left">
      <!-- modulo vero (con nome utente e password) così il browser propone di ricordare la password -->
      <form id="login-form" autocomplete="on" onsubmit="event.preventDefault(); confermaLogin();" style="margin:0">
      <label for="login-email" style="font-size:12px; color:var(--sub); display:block; margin-bottom:4px">Email</label>
      <input type="email" id="login-email" name="email" autocomplete="username" inputmode="email" placeholder="tuo@email.com" style="width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); margin-bottom:10px; font-size:14px">

      <label style="font-size:12px; color:var(--sub); display:block; margin-bottom:4px">Password</label>
      <input type="password" id="login-pwd" name="password" autocomplete="current-password" placeholder="Password" style="width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); margin-bottom:10px; font-size:14px">

      <button type="submit" class="login-btn" style="background:var(--accent); color:var(--accent-ink); border:none; width:100%; margin-bottom:8px">🔓 Accedi</button>
      </form>
      <div style="text-align:center; margin:-2px 0 10px"><a href="#" onclick="apriRecuperoPassword(); return false" style="font-size:13px; font-weight:700; color:#1d4f91">🔑 Password dimenticata?</a></div>
      <div id="recupero-pwd" style="display:none; border:2px solid #1d4f91; border-radius:12px; padding:12px; margin-bottom:12px; background:color-mix(in srgb, #1d4f91 6%, var(--card))">
        <div style="font-weight:800; color:#1d4f91; margin-bottom:6px">🔑 Recupero password</div>
        <div style="font-size:12.5px; color:var(--sub); margin-bottom:8px">1) Scrivi la tua e-mail e premi <b>Mandami il codice</b>. 2) Scrivi il codice di 6 cifre arrivato per e-mail e la nuova password.</div>
        <input type="email" id="rec-email" placeholder="tuo@email.com" style="width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); margin-bottom:8px; font-size:14px">
        <button type="button" class="login-btn" id="rec-invia" style="background:#1d4f91; color:#fff; border:none; width:100%; margin-bottom:8px" onclick="inviaCodiceRecupero()">📧 Mandami il codice</button>
        <div id="rec-passo2" style="display:none">
          <input type="text" id="rec-codice" inputmode="numeric" maxlength="6" placeholder="Codice di 6 cifre" style="width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); margin-bottom:8px; font-size:18px; letter-spacing:4px; text-align:center">
          <input type="password" id="rec-pwd1" placeholder="Nuova password (almeno 6 caratteri)" style="width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); margin-bottom:8px; font-size:14px">
          <input type="password" id="rec-pwd2" placeholder="Ripeti la nuova password" style="width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); margin-bottom:8px; font-size:14px">
          <button type="button" class="login-btn" style="background:#2f9e5f; color:#fff; border:none; width:100%; margin-bottom:6px" onclick="cambiaPasswordRecupero()">💾 Cambia password</button>
        </div>
        <div id="rec-msg" style="font-size:13px; margin-top:4px"></div>
        <div style="font-size:12px; color:var(--sub); margin-top:6px">Se il codice non arriva (controlla anche lo spam), chiedi all'amministratore di cambiarti la password.</div>
      </div>
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
// Uscita automatica dopo 60 minuti senza usare il programma (PC condivisi, telefono dimenticato aperto);
// sul PC dell'ufficio (segnato dall'amministratore in Utenti e permessi) dopo 4 ore.
// L'ultima attività è condivisa tra le schede aperte dello stesso browser.
function ePcUfficio(){ try{ return localStorage.getItem('pc-ufficio') === '1'; }catch(e){ return false; } }
function minutiUscitaAutomatica(){ return ePcUfficio() ? 240 : 60; }
function impostaPcUfficio(si){
  if(!(auth && auth.profilo && auth.profilo.ruolo === 'admin')){ aggiornaPcUfficio(); return; }
  try{ if(si) localStorage.setItem('pc-ufficio', '1'); else localStorage.removeItem('pc-ufficio'); }catch(e){}
  aggiornaPcUfficio();
  avviso(si ? '🏢 PC dell\'ufficio: su questo computer esci da solo dopo 4 ore senza uso.' : '🔒 Su questo computer esci di nuovo dopo 60 minuti senza uso.');
}
function aggiornaPcUfficio(){
  const el = document.getElementById('pc-ufficio'); if(!el) return;
  el.checked = ePcUfficio();
  el.disabled = !(auth && auth.profilo && auth.profilo.ruolo === 'admin');
}
let ULTIMA_ATTIVITA = Date.now(), AVVISO_USCITA_DATO = false;
function segnaAttivita(){
  const ora = Date.now();
  if(ora - ULTIMA_ATTIVITA < 15000) return; // al massimo una volta ogni 15 secondi
  ULTIMA_ATTIVITA = ora; AVVISO_USCITA_DATO = false;
  try{ localStorage.setItem('ultima-attivita', String(ora)); }catch(e){}
}
['click','keydown','touchstart','scroll','mousemove'].forEach(function(ev){ document.addEventListener(ev, segnaAttivita, { passive: true, capture: true }); });
async function controllaUscitaAutomatica(){
  if(!auth || !auth.profilo) return;
  let ultima = ULTIMA_ATTIVITA;
  try{ ultima = Math.max(ultima, Number(localStorage.getItem('ultima-attivita') || 0)); }catch(e){}
  const minuti = minutiUscitaAutomatica(), ferma = Date.now() - ultima, limite = minuti * 60000;
  if(ferma >= limite){
    AVVISO_USCITA_DATO = false;
    await esciDalProgramma();
    // il messaggio si vede nella schermata di accesso
    setTimeout(function(){ const m = document.getElementById('login-msg'); if(m){ m.textContent = '🔒 Sei uscito dal programma perché non è stato usato per ' + (minuti === 60 ? 'un\'ora' : minuti > 60 ? (minuti / 60) + ' ore' : minuti + ' minuti') + '. Rientra con la tua password.'; m.style.display = 'block'; } }, 1200);
  } else if(ferma >= limite - 60000 && !AVVISO_USCITA_DATO){
    AVVISO_USCITA_DATO = true;
    avviso('⏳ Tra 1 minuto esci dal programma perché non lo stai usando: tocca lo schermo per restare dentro.');
  }
}
setInterval(controllaUscitaAutomatica, 20000);
// telefono o PC che si riaccende: si controlla subito
document.addEventListener('visibilitychange', function(){ if(!document.hidden) controllaUscitaAutomatica(); });
function applicaPermessi(){
  const bar = document.getElementById('userbar');
  aggiornaPcUfficio();
  const u = auth.profilo; // Usa profilo da Supabase

  if(!u){
    // Non autenticato
    bar.innerHTML = '<span>Non autenticato</span>';
    document.getElementById('nav-permessi').style.display = 'none';
    const ns0 = document.getElementById('nav-storico'); if(ns0) ns0.style.display = 'none';
    ['nav-oggi','nav-agenda','ricerca-unica'].forEach(function(id){ const el = document.getElementById(id); if(el) el.style.display = 'none'; });
    Object.keys(TAB_LABELS).forEach(function(tab){
      const btn = document.querySelector('.navmenu button[data-tab="'+tab+'"]');
      if(btn) btn.style.display = 'none';
    });
    return;
  }

  const isAdmin = u.ruolo === 'admin';
  bar.innerHTML = '<span>Accesso come <b>'+esc(u.nome)+(isAdmin?' (amministratore)':'')+'</b></span><button type="button" onclick="apriGuida()" style="background:#1d4f91; color:#fff; border-color:#1d4f91; font-weight:700" title="Guida del programma con ricerca">📖 GUIDA DEL PROGRAMMA</button><button type="button" onclick="apriLettoreQR()" title="Inquadra il QR sulla schermata di accesso di un PC per farlo entrare con il tuo utente">📷 Fai entrare un PC</button><button type="button" onclick="cambiaUtente()">Cambia utente</button><button type="button" onclick="esciDalProgramma()">🚪 Esci dal programma</button>';
  document.getElementById('nav-permessi').style.display = isAdmin ? '' : 'none';

  const tabs = u.tabs || {};
  Object.keys(TAB_LABELS).forEach(function(tab){
    const btn = document.querySelector('.navmenu button[data-tab="'+tab+'"]');
    if(!btn) return;
    const visibile = isAdmin || tabs[tab];
    btn.style.display = visibile ? '' : 'none';
  });
  // Storico contribuente: per chi vede l'inserimento o il registro (solo consultazione)
  const ns = document.getElementById('nav-storico');
  if(ns) ns.style.display = (isAdmin || tabs.registro || tabs.anagrafica) ? '' : 'none';
  // Oggi: per chi vede l'inserimento o il registro (riepilogo di cosa c'è da fare)
  // Oggi, Agenda e ricerca unica: per chi vede l'inserimento o il registro
  const lavoro = isAdmin || tabs.registro || tabs.anagrafica;
  if(lavoro && typeof caricaComunicazioni === 'function' && !COMUNICAZIONI.caricato) caricaComunicazioni();
  ['nav-oggi','nav-agenda'].forEach(function(id){ const el = document.getElementById(id); if(el) el.style.display = lavoro ? '' : 'none'; });
  const ru = document.getElementById('ricerca-unica'); if(ru) ru.style.display = lavoro ? 'flex' : 'none';
  if(lavoro && typeof caricaAppuntamenti === 'function' && !AGENDA.caricato) caricaAppuntamenti();

  document.body.classList.toggle('sola-lettura', !isAdmin && u.sola_lettura);
  if(typeof mostraStatoSync === 'function') setTimeout(mostraStatoSync, 0);

  const attivo = document.querySelector('.navmenu button.active');
  if(!attivo || attivo.style.display === 'none'){
    const primo = Array.from(document.querySelectorAll('.navmenu button')).find(function(b){ return b.style.display !== 'none'; });
    if(primo) showTab(primo);
  }

  if(document.getElementById('tab-permessi').classList.contains('active')) renderPermessi();
}
// NUOVO: Funzioni per gestione utenti con Supabase Auth + Edge Function
// Chiamata alla funzione del server che gestisce gli utenti, sempre con l'accesso aggiornato
async function chiamaAdminUtenti(azione, metodo, corpo){
  const invia = function(){
    return fetch(SUPABASE_URL + '/functions/v1/admin-utenti/' + azione, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '') },
      body: JSON.stringify(corpo),
    });
  };
  let response;
  try{
    await rinnovaToken(); // il codice d'accesso dura un'ora: si rinnova prima di usarlo
    response = await invia();
    if(response.status === 401 && await rinnovaToken()) response = await invia();
  }catch(e){
    throw new Error('il server non risponde, controlla la connessione e riprova');
  }
  let dati = {};
  try{ dati = await response.json(); }catch(e){}
  if(!response.ok) throw new Error(dati.error || dati.message || dati.msg || ('errore ' + response.status));
  return dati;
}

async function aggiungiUtente(){
  const nome = document.getElementById('nu-nome')?.value.trim().toUpperCase();
  const email = document.getElementById('nu-email')?.value.trim();
  const pwd = document.getElementById('nu-pwd')?.value;

  if(!nome || !email){
    alert('⚠️ Inserisci nome e email');
    return;
  }
  if(!pwd || pwd.length < 6){
    alert('⚠️ Inserisci una password di almeno 6 caratteri: servira\' al nuovo utente per accedere.');
    return;
  }

  if(!localStorage.getItem('auth_token')){
    alert('❌ Accesso scaduto: esci e rientra nel programma');
    return;
  }

  try {
    const ruolo = (document.getElementById('nu-ruolo') || {}).value || 'operatore';
    const tel = ((document.getElementById('nu-tel') || {}).value || '').trim();
    await chiamaAdminUtenti('create-user', 'POST', { email, password: pwd, nome, ruolo });
    document.getElementById('nu-nome').value = '';
    document.getElementById('nu-email').value = '';
    document.getElementById('nu-pwd').value = '';
    if(document.getElementById('nu-tel')) document.getElementById('nu-tel').value = '';
    if(document.getElementById('nu-ruolo')) document.getElementById('nu-ruolo').value = 'operatore';
    inviaAccessoUtente({ nome: nome, email: email, password: pwd, ruolo: ruolo, telefono: tel, nuovo: true });
    renderPermessi();
  } catch(e){
    alert('❌ Errore: ' + e.message);
  }
}

async function rimuoviUtente(id){
  if(!confirm('Sei sicuro di voler eliminare questo utente?')) return;

  if(!localStorage.getItem('auth_token')){
    alert('❌ Accesso scaduto: esci e rientra nel programma');
    return;
  }

  try {
    await chiamaAdminUtenti('delete-user', 'DELETE', { user_id: id });

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

// Ultima password impostata per ogni utente in questa sessione: serve per inviargli l'accesso
const PASSWORD_IMPOSTATE = {};
async function cambiaPasswordUtente(id, pwd, utente){
  if(!pwd){
    alert('⚠️ Inserisci la nuova password');
    return;
  }
  if(pwd.length < 6){
    alert('⚠️ Password troppo corta: almeno 6 caratteri');
    return;
  }

  if(!localStorage.getItem('auth_token')){
    alert('❌ Accesso scaduto: esci e rientra nel programma');
    return;
  }

  try {
    await chiamaAdminUtenti('reset-password', 'POST', { user_id: id, password: pwd });
    PASSWORD_IMPOSTATE[id] = pwd;
    const campo = document.getElementById('pwd-' + id);
    if(campo) campo.value = '';
    // subito la finestra per mandargli la nuova password
    if(utente) inviaAccessoUtente(Object.assign({}, utente, { password: pwd, passwordCambiata: true }));
    else alert('✅ Password cambiata');
  } catch(e){
    alert('❌ Errore: ' + e.message);
  }
}

// DEPRECATED: salvaUtenti non più usato
function salvaUtenti(lista){}

function dataOraFile(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'_'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0');
}
function pulisciArray(arr){
  return (arr||[]).map(function(x){ var c=Object.assign({},x); delete c._editing; delete c._confirmDelete; delete c._editingFattura; return c; });
}
async function esportaBackupJSON(){
  // backup completo (tutti gli anni, tutte le tabelle) fatto dal server e scaricato subito
  try{
    if(typeof preparaBackup === 'function' && typeof isAdmin === 'function' && isAdmin()){
      const { data: id, error } = await supabase.rpc('crea_backup', { p_tipo: 'manuale' });
      if(!error && id){
        const f = await preparaBackup(id);
        if(f){ const u = URL.createObjectURL(new Blob([f.testo], { type: 'application/json' })); const l = document.createElement('a'); l.href = u; l.download = 'backup-completo-' + dataOraFile() + '.json'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function(){ URL.revokeObjectURL(u); }, 2000); avviso('✓ Backup completo scaricato'); return; }
      }
    }
  }catch(e){ console.error('backup completo', e); }
  const payload = {
    versione: 1,
    esportatoIl: new Date().toISOString(),
    pratiche: pulisciArray((state.pratiche||[]).concat(state.annullate||[])),
    versamenti: pulisciArray(state.versamenti),
    isee: pulisciArray(state.isee),
    clienti: pulisciArray(state.clienti),
    scadenze: pulisciArray(state.scadenze),
    collaboratori: state.collaboratori || TIPI_DEFAULT.slice()
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
// Impostazioni dei tipi di pratica decise dall'amministratore (colore, acconto, fatture/incasso)
let _tipiCfgTesto = null, _tipiCfg = {};
function tipiConfig(){
  const t = (typeof IMPOSTAZIONI !== 'undefined' && IMPOSTAZIONI.tipi_config) || '{}';
  if(t !== _tipiCfgTesto){ _tipiCfgTesto = t; try{ _tipiCfg = JSON.parse(t) || {}; }catch(e){ _tipiCfg = {}; } }
  return _tipiCfg;
}
function tipoConfig(k){ return tipiConfig()[String(k||'').toUpperCase().trim()] || {}; }
function coloreCollaboratore(nome){
  const cfg = tipoConfig(nome);
  if(cfg.colore) return cfg.colore;
  // tipo senza colore scelto: un colore libero (non usato dagli altri tipi), sempre lo stesso per quel tipo
  const usati = {}; getTipiList().forEach(function(t){ const c = tipoConfig(t).colore; if(c) usati[String(c).toLowerCase()] = true; });
  const liberi = PALETTE_EXTRA.concat(PALETTE_COLLABORATORI).filter(function(c){ return !usati[c.toLowerCase()]; });
  const senza = getTipiList().filter(function(t){ return !tipoConfig(t).colore; });
  const i = senza.indexOf(nome);
  if(i >= 0 && liberi.length) return liberi[i % liberi.length];
  let h = 0;
  const s = String(nome||'');
  for(let k=0;k<s.length;k++){ h = (h*31 + s.charCodeAt(k)) >>> 0; }
  return (liberi.length ? liberi : PALETTE_COLLABORATORI)[h % (liberi.length || PALETTE_COLLABORATORI.length)];
}
const PALETTE_EXTRA = ['#a16207','#525252','#e11d48','#65a30d','#1e40af','#7c2d12','#047857','#9333ea'];
function nomeFoglio(s){
  return String(s||'Senza tipo').replace(/[\\\/\?\*\[\]:]/g,' ').slice(0,31) || 'Foglio';
}
function rigaPratica(p){
  return {
    'N. Protocollo': formattaProtocolloTesto(p),
    'Data': p.data||'',
    'Fine lavorazione': eColf(p.tipo) ? '' : (p.dataFine||''),
    'Scadenza assistenza': p.scadenzaAssistenza||'',
    'Cognome e Nome': p.nome||'',
    'Congiunta': p.congiunta||'',
    'Data nascita': p.cf||'',
    'Cellulare': p.telefono||'',
    'Telefono fisso': p.telefonoFisso||'',
    'E-mail': p.email||'',
    'Descrizione pratica': p.descrizioneTipo||'',
    'Stato': statoLabel(p.stato),
    'Fattura (€)': Number(p.compenso)||0,
    'Pagato (€)': Number(p.pagato)||0,
    'Pagamento': p.metodoPagamento||'',
    'N. Fattura': p.numFattura||'',
    'Data fattura': p.dataFattura||'',
    'Inserito da': p.inseritoDa||'',
    'Riferimento': riferimentoPratica(p),
    'Cessazione colf/badanti': p.cessazioneMotivo ? (p.cessazioneData ? p.cessazioneData + ' – ' : '') + p.cessazioneMotivo : '',
    'Note': p.note||''
  };
}
function formattaProtocolloTesto(p){ return formattaProtocollo(p); }
async function esportaRegistroExcel(){
  if(!window.XLSX){ alert('La libreria per generare il file Excel non si è caricata. Riprova tra poco.'); return; }

  const anno = annoAttivo();
  const tutte = (state.pratiche||[]).filter(function(p){ return annoPratica(p) === anno; });
  const annFatt = typeof fattureAnnullateAperte === 'function' ? fattureAnnullateAperte(anno) : [];
  const gruppi = {};
  tutte.forEach(function(p){ const k = p.tipo || 'SENZA TIPO'; if(!gruppi[k]) gruppi[k] = []; gruppi[k].push(p); });
  const nomiGruppi = getTipiList().concat(Object.keys(gruppi).filter(function(k){ return getTipiList().indexOf(k) < 0; }));

  const fattureEmesse = praticheContabili(tutte).concat(annFatt).reduce(function(a,p){ return a+Number(p.compenso||0); }, 0);
  const incassoLordo = tutte.reduce(function(a,p){ return a+Number(p.pagato||0); }, 0);
  const versAnno = (state.versamenti||[]).filter(function(v){ return annoVersamento(v) === anno; });
  const versatoCaf = versAnno.reduce(function(a,v){ return a+Number(v.importo||0); }, 0);
  const incasso = incassoLordo - versatoCaf;
  const DA_LAVORARE = STATI_DA_LAVORARE;
  const daLavorare = sommaPeso(tutte.filter(function(p){ return DA_LAVORARE.indexOf(p.stato)>=0; }));
  const rinunce = sommaPeso(tutte.filter(eRinuncia));
  const lavorate = sommaPeso(tutte) - daLavorare - rinunce;
  const annullate = sommaPeso(annullateAnno(anno));

  const contabRighe = [
    { 'Voce':'Anno di protocollo', 'Valore': anno },
    { 'Voce':'Pratiche totali, senza rinunce e annullate (congiunte valgono 2)', 'Valore': sommaPeso(tutte) - rinunce },
    { 'Voce':'Lavorate', 'Valore': lavorate },
    { 'Voce':'Da lavorare', 'Valore': daLavorare },
    { 'Voce':'Rinuncia alla compilazione (a parte)', 'Valore': rinunce },
    { 'Voce':'Pratiche annullate (a parte)', 'Valore': annullate },
    { 'Voce':'Fatture emesse (€)' + (annFatt.length ? ' – comprese ' + annFatt.length + ' di pratiche annullate (nota di credito da fare)' : ''), 'Valore': fattureEmesse },
    { 'Voce':'Incasso totale (€)', 'Valore': incassoLordo },
    { 'Voce':'Versamenti CAF (€)', 'Valore': versatoCaf },
    { 'Voce':'Soldi in cassa: incasso − versamenti CAF − spese sede (€)', 'Valore': incasso - (typeof totaleSpeseSede === 'function' ? totaleSpeseSede(anno) : 0) + (typeof angeloInSospesoAnno === 'function' ? angeloInSospesoAnno(anno) : 0) },
    { 'Voce':'Spese sede non detratte al CAF (€)', 'Valore': (typeof totaleSpeseSede === 'function' ? totaleSpeseSede(anno) : 0) },
    { 'Voce':'Guadagno netto: incasso − fatture − spese sede (€)', 'Valore': incassoLordo - fattureEmesse - (typeof totaleSpeseSede === 'function' ? totaleSpeseSede(anno) : 0) },
    { 'Voce':'', 'Valore':'' },
    { 'Voce':'Dettaglio per collaboratore / tipo pratica', 'Valore':'' }
  ];
  nomiGruppi.forEach(function(k){
    const items = praticheContabili(gruppi[k] || []);
    if(!items.length) return;
    const fe = items.reduce(function(a,p){ return a+Number(p.compenso||0); }, 0);
    const inc = items.reduce(function(a,p){ return a+Number(p.pagato||0); }, 0);
    const accK = totaleAcconti(anno, function(t){ return t === k; });
    contabRighe.push({ 'Voce': k + ' (' + items.length + ' pratiche)', 'Valore': 'Fatture ' + fe.toFixed(2) + ' € · Incasso ' + inc.toFixed(2) + ' €' + (accK ? ' · Pagamenti effettuati ' + accK.toFixed(2) + ' € · Da incassare (incasso − pagamenti) ' + (inc - accK).toFixed(2) + ' €' : '') });
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
    msg.textContent = '⚠️ Scegli prima un file .json o .csv da importare.'; msg.style.display='block'; return;
  }
  if(/\.csv$/i.test(inp.files[0].name)){
    await elaboraImportazione(inp.files[0], msg, document.getElementById('btn-importa'));
    return;
  }
  if(!confirm('Importando questo file, tutti i dati attuali (pratiche, versamenti, collaboratori, utenti) verranno sostituiti. Prima il programma salva una copia di sicurezza in "Backup automatici". Continuare?')) return;
  const btn = document.getElementById('btn-importa');
  btn.disabled = true; btn.textContent = 'Importazione in corso...';
  try{
    // copia settimanale arrivata per e-mail: file compresso .json.gz
    const f = inp.files[0];
    const testo = /\.gz$/i.test(f.name) && typeof DecompressionStream !== 'undefined'
      ? await new Response(f.stream().pipeThrough(new DecompressionStream('gzip'))).text()
      : await f.text();
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

async function svuotaRegistro(){
  const btn = document.getElementById('btn-svuota');
  const ok = await chiediConfermaScritta('Svuota registro', 'Verranno eliminate DEFINITIVAMENTE tutte le pratiche di tutti gli anni. Prima di cancellare il programma salva da solo una copia di sicurezza (la trovi in "Backup automatici").', 'SVUOTA');
  if(!ok) return;
  if(btn){ btn.disabled = true; btn.textContent = 'Backup e eliminazione in corso...'; }
  const result = await data.admin.svuota();
  if(result.error){ console.error('svuotamento registro', result.error); }
  else avviso('✓ Registro svuotato. La copia di sicurezza e\' in "Backup automatici".');
  if(btn){ btn.disabled = false; btn.textContent = 'Svuota registro (elimina tutte le pratiche)'; }
  render();
  if(typeof renderBackupEStorico === 'function') renderBackupEStorico();
}
async function renderPermessi(){
  const wrap = document.getElementById('perm-lista');
  const allProfili = await caricaTuttiProfili();

  if(!allProfili){
    wrap.innerHTML = '<div class="empty">Errore nel caricamento dei profili</div>';
    return;
  }

  const io = auth.profilo && auth.profilo.id;
  const operatori = allProfili.filter(function(u){ return u.id !== io; });

  if(!operatori.length) {
    wrap.innerHTML = (typeof rigaImpostazioneColfHTML === 'function' ? rigaImpostazioneColfHTML() : '') + '<div class="empty">Nessun altro utente oltre a te</div>';
    return;
  }

  const cardsHtml = operatori.map(function(u){
    const tabs = u.tabs || {};
    const righeTab = Object.keys(TAB_LABELS).map(function(tab){
      let riga = '<div class="perm-row"><span>'+TAB_LABELS[tab]+'</span><label class="chk"><input type="checkbox" class="perm-check" data-user-id="'+u.id+'" data-tab="'+tab+'" '+(tabs[tab]?'checked':'')+' id="perm-'+u.id+'-'+tab+'"> Visibile</label></div>';
      if(tab === 'contabilita'){
        riga += Object.keys(SEZIONI_CONTABILITA).map(function(k){
          return '<div class="perm-row" style="padding-left:22px; font-size:12.5px"><span style="color:var(--sub)">↳ '+SEZIONI_CONTABILITA[k]+'</span><label class="chk"><input type="checkbox" class="perm-check" data-user-id="'+u.id+'" data-tab="'+k+'" '+(tabs[k]!==false?'checked':'')+' id="perm-'+u.id+'-'+k+'"> Visibile</label></div>';
        }).join('')
        + '<div class="perm-row" style="padding-left:22px; font-size:12.5px"><span style="color:#c0392b; font-weight:600">↳ 🔒 Guadagno netto e proventi (solo se autorizzato)</span><label class="chk"><input type="checkbox" class="perm-check" data-user-id="'+u.id+'" data-tab="cont_guadagni" '+(tabs.cont_guadagni===true?'checked':'')+' id="perm-'+u.id+'-cont_guadagni"> Autorizzato</label></div>';
      }
      return riga;
    }).join('');
    const ruoloAttuale = u.ruolo === 'admin' ? 'admin' : (u.sola_lettura ? 'consultazione' : 'operatore');
    const selRuolo = '<select class="perm-ruolo" data-user-id="'+u.id+'" data-prima="'+ruoloAttuale+'" style="padding:6px 8px; font-size:13px; max-width:260px" onchange="var c=document.getElementById(\'perm-'+u.id+'-tabs\'); if(c) c.style.display = this.value===\'admin\' ? \'none\' : \'\';">'
      + [['operatore','Operatore'],['consultazione','Sola consultazione'],['admin','Amministratore']].map(function(o){ return '<option value="'+o[0]+'"'+(o[0]===ruoloAttuale?' selected':'')+'>'+o[1]+'</option>'; }).join('') + '</select>';
    return '<div class="card" style="margin-bottom:12px">'
      + '<div class="raff-title" style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap"><span>'+esc(u.nome)+(u.email ? ' <span style="font-size:12px; font-weight:400; color:var(--sub)">'+esc(u.email)+'</span>' : '')+'</span>'
      + '<button type="button" style="background:#25d366; color:#fff; border:none; border-radius:999px; padding:6px 12px; font-size:12.5px; font-weight:700; cursor:pointer" onclick="inviaAccessoUtente({ nome: &quot;'+esc(u.nome)+'&quot;, email: &quot;'+esc(u.email||'')+'&quot;, ruolo: &quot;'+ruoloAttuale+'&quot;, password: PASSWORD_IMPOSTATE[&quot;'+u.id+'&quot;] || &quot;&quot; })">📨 Invia accesso</button></div>'
      + '<div class="perm-row" style="border-bottom:2px solid var(--line); padding-bottom:10px; margin-bottom:6px"><span><b>Ruolo</b></span>'+selRuolo+'</div>'
      + '<div id="perm-'+u.id+'-tabs"'+(ruoloAttuale==='admin' ? ' style="display:none"' : '')+'>'
      + righeTab
      + '<div class="perm-row" style="margin-top:6px; border-top:2px solid var(--line); padding-top:12px"><span>🗑 Elimina clienti dall\'archivio</span><label class="chk"><input type="checkbox" class="perm-check" data-user-id="'+u.id+'" data-tab="elimina_clienti" '+(tabs.elimina_clienti?'checked':'')+' id="perm-'+u.id+'-elimcli"> Consentito</label></div>'
      + '<div class="perm-row"><span>💬 Chat interna e compiti</span><label class="chk"><input type="checkbox" class="perm-check" data-user-id="'+u.id+'" data-tab="chat" '+(tabs.chat!==false?'checked':'')+' id="perm-'+u.id+'-chat"> Abilitata</label></div>'
      + '</div>'
      + '<div class="perm-row"><span>Nuova password</span><span style="display:flex; gap:6px"><input type="password" id="pwd-'+u.id+'" placeholder="Lascia vuoto per non cambiarla" style="width:160px; padding:6px 8px; font-size:12.5px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--ink)"><button type="button" style="background:var(--line); color:var(--ink); border:none; border-radius:6px; padding:6px 10px; font-size:12px; cursor:pointer" onclick="cambiaPasswordUtente(&quot;'+u.id+'&quot;, document.getElementById(&quot;pwd-'+u.id+'&quot;).value, { nome: &quot;'+esc(u.nome)+'&quot;, email: &quot;'+esc(u.email||'')+'&quot;, ruolo: &quot;'+ruoloAttuale+'&quot; })">Salva</button></span></div>'
      + '<div class="perm-row"><span></span><button type="button" style="background:none; border:none; color:#c0392b; font-weight:700; cursor:pointer" onclick="rimuoviUtente(&quot;'+u.id+'&quot;)">Elimina utente</button></div>'
      + '</div>';
  }).join('');

  const buttonHtml = '<div style="margin-top:12px; text-align:left"><button type="button" class="btn-add" onclick="salvaPermessi()">💾 Salva permessi</button></div>';
  const chatHtml = '<div class="perm-row" style="margin-bottom:12px; padding:10px 12px; border-radius:12px; background:var(--bg); border:1px solid var(--line)"><span><b>💬 Chat interna</b> <span style="font-size:12px; color:var(--sub)">(il tasto in basso a destra; per ogni utente si può togliere qui sotto)</span></span>'
    + '<label class="chk"><input type="checkbox" ' + (IMPOSTAZIONI.chat_attiva !== 'no' ? 'checked' : '') + ' onchange="impostaChatAttiva(this.checked)"> Attiva per tutti</label></div>';
  wrap.innerHTML = chatHtml + (typeof rigaImpostazioneColfHTML === 'function' ? rigaImpostazioneColfHTML() : '') + cardsHtml + buttonHtml;
}

async function impostaChatAttiva(si){
  const valore = si ? 'si' : 'no';
  const { data: righe, error } = await supabase.from('impostazioni').update({ valore: valore, aggiornato_il: new Date().toISOString() }).eq('chiave', 'chat_attiva').select('chiave');
  if(error || !righe || !righe.length){ avviso('❌ Non salvato' + (error ? ': ' + error.message : ''), true); return; }
  IMPOSTAZIONI.chat_attiva = valore;
  avviso(si ? '✓ Chat interna attiva' : '✓ Chat interna disattivata per gli operatori (l\'amministratore la vede sempre)');
  if(typeof caricaChat === 'function') caricaChat();
}
async function salvaPermessi(){
  try {
    const checks = document.querySelectorAll('.perm-check');
    const changes = {};

    checks.forEach(function(check){
      const userId = check.dataset.userId;
      const tab = check.dataset.tab;
      const type = check.dataset.type;

      if(!changes[userId]) changes[userId] = { tabs: {} };

      if(tab) {
        changes[userId].tabs[tab] = check.checked;
      } else if(type === 'sola_lettura') {
        changes[userId].sola_lettura = check.checked;
      }
    });

    document.querySelectorAll('.perm-ruolo').forEach(function(sel){
      const userId = sel.dataset.userId;
      if(!changes[userId]) changes[userId] = { tabs: {} };
      changes[userId].ruolo = sel.value === 'admin' ? 'admin' : 'operatore';
      changes[userId].sola_lettura = sel.value === 'consultazione';
    });
    const nuoviAdmin = Array.from(document.querySelectorAll('.perm-ruolo')).filter(function(sel){ return sel.value === 'admin' && sel.dataset.prima !== 'admin'; });
    if(nuoviAdmin.length && !confirm('Stai rendendo AMMINISTRATORE un altro utente: potrà vedere e modificare tutto, compresi utenti, permessi e backup. Confermi?')) return;
    for(const userId in changes) {
      if(changes[userId].tabs && !Object.keys(changes[userId].tabs).length) delete changes[userId].tabs;
      const result = await aggiornaProfilo(userId, changes[userId]);
      if(result.error) {
        alert('❌ Errore: ' + result.error);
        return;
      }
    }

    alert('✅ Permessi salvati con successo!');
    await renderPermessi();
  } catch(e){
    alert('❌ Errore: ' + e.message);
  }
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
    // Sessione salvata ancora valida: salta la schermata di accesso
    if (!auth.profilo) return;
    document.getElementById('login-overlay').style.display = 'none';
    applicaPermessi();

    // Carica tutti i dati
    const ok = await data.caricaTutto();
    if (!ok) {
      console.error('Errore nel caricamento dei dati');
      return;
    }

    // Sincronizza i dati dal modulo data.js al state locale di app.js
    onDatiAggiornati();
    caricaNomiOperatori();
    caricaImpostazioni();

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
let ultimiTipi = '';
// Chiamata da data.js dopo ogni caricamento dei dati (anche dopo ogni salvataggio)
function onDatiAggiornati(){
  syncDataFromSupabase();
  { const st = document.getElementById('tab-storico'); if(st && st.classList.contains('active') && typeof aggiornaStorico === 'function') aggiornaStorico(); }
  const tipi = JSON.stringify(getTipiList());
  if(tipi !== ultimiTipi){
    ultimiTipi = tipi;
    const scelto = document.getElementById('f-tipo').value;
    initTipoBtns();
    if(scelto && getTipiList().indexOf(scelto) >= 0) pickChip('f-tipo-btns','f-tipo', scelto);
    renderCollaboratori();
  }
  initSelettoreAnno();
  render();
  renderScadenze();
  aggiornaAvvisiScadenze();
}
// Aggiornamento automatico: le pratiche inserite da un altro dispositivo (es. il telefono)
// compaiono da sole, senza ricaricare la pagina. Si salta mentre si sta scrivendo o modificando.
let AGGIORNAMENTO_IN_CORSO = false;
let ULTIMA_FIRMA_SERVER = '';
function firmaDati(){
  return JSON.stringify([state.pratiche, state.versamenti, state.isee, state.clienti, state.collaboratori, state.scadenze, state.speseSede, state.acconti], function(k, v){ return k.charAt(0) === '_' ? undefined : v; });
}
// Campi di ricerca e filtro: scriverci non deve fermare la sincronizzazione
function eCampoRicerca(el){
  if(!el) return false;
  if(el.type === 'search') return true;
  return ['cerca','filtro-contribuente','filtro-stato','anno-attivo','storico-cerca','rf-testo','rf-da','rf-a','rf-rif','rf-pag'].indexOf(el.id) >= 0 || !!(el.closest && el.closest('#morosi-box summary, .navmenu'));
}
// Si sta scrivendo in un campo che il ridisegno cancellerebbe (schede in modifica, finestre aperte)
function staModificando(){
  const a = document.activeElement;
  if(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'button' && !eCampoRicerca(a)) return true;
  if(document.querySelector('.scanner-overlay.open, #invio-multiplo, #finestra-stampa, #editor-documenti, .conferma-scritta, #popup-nuovo-contribuente, #popup-dettaglio-contab')) return true;
  return false;
}
// Le schede aperte in modifica restano aperte dopo l'aggiornamento, con quello che si stava scrivendo
function salvaStatoSchede(){
  const flag = {};
  [state.pratiche, state.annullate, state.versamenti, state.isee].forEach(function(l){ (l||[]).forEach(function(x){ if(x._editing || x._confirmDelete || x._editingFattura) flag[x.id] = { _editing: x._editing, _confirmDelete: x._confirmDelete, _editingFattura: x._editingFattura, _apertaIl: x._apertaIl }; }); });
  const campi = {};
  document.querySelectorAll('#tab-registro .item input[id], #tab-registro .item select[id], #tab-registro .item textarea[id], #tab-caf input[id], #tab-caf select[id]').forEach(function(el){ campi[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? { c: el.checked } : { v: el.value }; });
  return { flag: flag, campi: campi };
}
function ripristinaFlagSchede(st){
  [state.pratiche, state.annullate, state.versamenti, state.isee].forEach(function(l){ (l||[]).forEach(function(x){ const f = st.flag[x.id]; if(f) Object.assign(x, f); }); });
}
function ripristinaCampiSchede(st){
  Object.keys(st.campi).forEach(function(id){ const el = document.getElementById(id); const c = st.campi[id]; if(!el) return; if('c' in c) el.checked = c.c; else if(el.value !== c.v) el.value = c.v; });
}
// Stato della sincronizzazione mostrato in alto (🟢 aggiornato / ⏸ in pausa / 🔴 non collegato)
let SYNC_ULTIMO_OK = 0, SYNC_ERRORE = false, DA_RIDISEGNARE = false, IMPOSTAZIONI_DA_RICARICARE = false;
function mostraStatoSync(){
  let el = document.getElementById('stato-sync');
  const bar = document.getElementById('userbar');
  if(!bar || !auth.profilo) return;
  if(!el || !bar.contains(el)){ el = document.createElement('span'); el.id = 'stato-sync'; el.style.cssText = 'font-size:12px; font-weight:700; padding:3px 10px; border-radius:999px; cursor:pointer'; el.title = 'Tocca per aggiornare adesso'; el.onclick = function(){ ULTIMA_FIRMA_SERVER = null; aggiornaDaServer(true); }; bar.insertBefore(el, bar.firstChild ? bar.firstChild.nextSibling : null); }
  const ora = SYNC_ULTIMO_OK ? new Date(SYNC_ULTIMO_OK).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) : '';
  if(SYNC_ERRORE || !navigator.onLine){ el.textContent = '🔴 Non collegato: riprovo da solo'; el.style.background = '#fdecea'; el.style.color = '#c0392b'; }
  else if(DA_RIDISEGNARE){ el.textContent = '⏸ Dati nuovi: si aggiornano appena finisci di scrivere'; el.style.background = '#fff4e5'; el.style.color = '#b35f0c'; }
  else { el.textContent = '🟢 Sincronizzato' + (ora ? ' alle ' + ora : ''); el.style.background = '#e8f6ee'; el.style.color = '#1a7f37'; }
}
async function aggiornaDaServer(forza){
  if(AGGIORNAMENTO_IN_CORSO || (document.hidden && !forza) || !auth.profilo || !localStorage.getItem('auth_token')) return;
  // dati già arrivati ma non ancora mostrati perché si stava scrivendo
  if((DA_RIDISEGNARE || IMPOSTAZIONI_DA_RICARICARE) && !staModificando() && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#tab-messaggi, #tab-permessi'))){
    const st = salvaStatoSchede();
    if(IMPOSTAZIONI_DA_RICARICARE){ IMPOSTAZIONI_DA_RICARICARE = false; try{ await caricaImpostazioni(); }catch(e){} }
    DA_RIDISEGNARE = false; onDatiAggiornati(); ripristinaCampiSchede(st); mostraStatoSync();
  }
  AGGIORNAMENTO_IN_CORSO = true;
  try{
    // Prima si chiede al server solo una "impronta" dei dati (pochi byte): si ricarica tutto solo se e' cambiata
    const { data: firma, error } = await supabase.rpc('firma_dati', {});
    if(error) throw error;
    SYNC_ERRORE = false; SYNC_ULTIMO_OK = Date.now();
    if(firma && firma === ULTIMA_FIRMA_SERVER) return;
    // quello che si sta scrivendo nelle schede aperte (il ridisegno lo rimette al suo posto)
    const st = salvaStatoSchede();
    // impostazioni (dati CAF, telefoni CUD, importi convenzioni) e modulistica cambiate da un altro utente
    const inModifica = staModificando() || (document.activeElement && document.activeElement.closest && document.activeElement.closest('#tab-messaggi, #tab-permessi'));
    if(!inModifica){ await caricaImpostazioni(); ripristinaCampiSchede(st); IMPOSTAZIONI_DA_RICARICARE = false; }
    else IMPOSTAZIONI_DA_RICARICARE = true;
    if(typeof MODULI_CARICATI !== 'undefined'){
      MODULI_CARICATI = false;
      const sm = document.getElementById('tab-modulistica');
      if(sm && sm.classList.contains('active') && typeof renderModulistica === 'function') renderModulistica();
    }
    const prima = firmaDati();
    const ok = await data.caricaTutto({ silenzioso: true });
    if(!ok) throw new Error('caricamento non riuscito');
    ripristinaFlagSchede(st);
    ULTIMA_FIRMA_SERVER = firma || null;
    if(firmaDati() !== prima){
      if(staModificando()) DA_RIDISEGNARE = true;
      else { DA_RIDISEGNARE = false; onDatiAggiornati(); ripristinaCampiSchede(st); }
    }
  }catch(e){ SYNC_ERRORE = true; console.error('aggiornamento automatico', e); }
  finally{ AGGIORNAMENTO_IN_CORSO = false; mostraStatoSync(); }
}

setInterval(aggiornaDaServer, 15000);
window.addEventListener('focus', aggiornaDaServer);
// finito di scrivere: se nel frattempo sono arrivati dati nuovi si mostrano subito
document.addEventListener('focusout', function(){ setTimeout(function(){ if((DA_RIDISEGNARE || IMPOSTAZIONI_DA_RICARICARE) && !staModificando()) aggiornaDaServer(true); }, 400); });
window.addEventListener('online', function(){ SYNC_ERRORE = false; aggiornaDaServer(true); });
window.addEventListener('offline', mostraStatoSync);
document.addEventListener('visibilitychange', function(){ if(!document.hidden) aggiornaDaServer(); });

function syncDataFromSupabase(){
  // data.js scrive direttamente nel `state` globale; qui serve solo l'archivio clienti
  ARCHIVIO_CLIENTI = state.clienti || [];
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
  if(containerId === 'f-tipo-btns'){ aggiornaDescTipoForm(); coloraTriggerTipo(); aggiornaCampoFineForm(); const si = statoInizialeTipo(val); if(si) pickChip('f-stato-btns','f-stato', si); applicaFatturaAutomatica(val); if(typeof mostraImportiFPSModulo === 'function') mostraImportiFPSModulo(val); }
  if(containerId === 'f-stato-btns'){ coloraTriggerStato(); const df = document.getElementById('f-data-fine'); if(df && !eColf(document.getElementById('f-tipo').value)) df.value = val === 'lavorata' ? todayIT() : ''; }
}
function showTab(btn){
  const tab = btn.dataset.tab;
  document.querySelectorAll('.tabsec').forEach(function(s){ s.classList.remove('active'); });
  document.querySelectorAll('.navmenu button').forEach(function(b){ b.classList.remove('active'); });
  const sec = document.getElementById('tab-'+tab);
  if(sec) sec.classList.add('active');
  btn.classList.add('active');
  // telefono: il menu scorre col dito, la scheda scelta resta al centro
  const nav = btn.parentElement; if(nav && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = btn.offsetLeft - nav.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2;
  if(tab === 'collaboratori') renderCollaboratori();
  if(tab === 'scadenze') renderScadenze();
  if(tab === 'messaggi') mostraDatiCaf();
  if(tab === 'grafici') renderGrafici();
  if(tab === 'oggi' && typeof renderOggi === 'function') renderOggi();
  if(tab === 'agenda' && typeof renderAgenda === 'function') renderAgenda();
  if(tab === 'spese' && typeof renderSpese === 'function') renderSpese();
  if(tab === 'modulistica' && typeof renderModulistica === 'function') renderModulistica();
  if(tab === 'storico' && typeof renderStorico === 'function'){ renderStorico(); setTimeout(function(){ const i = document.getElementById('storico-cerca'); if(i && !STORICO.scelto) i.focus(); }, 50); }
  if(tab === 'permessi'){ renderPermessi(); if(typeof renderPresenze === 'function') renderPresenze(); if(typeof renderTipiPratica === 'function'){ renderTipiPratica(true); renderEtichetteMenu(true); renderStatiPratica(true); } if(typeof renderBackupEStorico === 'function') renderBackupEStorico(); }
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
  Array.from(document.getElementById('f-tipo-btns').children).forEach(function(b, i){
    const col = coloreCollaboratore(TIPI[i]);
    b.classList.add('chip-tipo');
    b.style.background = col;
    b.style.borderColor = col;
  });
  const lbl = document.getElementById('f-tipo-dd-label');
  if(lbl && sel.value){ lbl.textContent = sel.value; }
  coloraTriggerTipo();
}
function coloraTriggerTipo(){
  const trig = document.querySelector('#f-tipo-dd .chip-dd-trigger');
  const val = document.getElementById('f-tipo').value;
  if(!trig) return;
  if(!val){ trig.style.background = ''; trig.style.borderColor = ''; trig.style.color = ''; return; }
  const col = coloreCollaboratore(val);
  trig.style.background = col;
  trig.style.borderColor = col;
  trig.style.color = '#fff';
}
function initStatoBtns(){
  const sel = document.getElementById('f-stato');
  // tutti gli stati: i chip non validi per il tipo scelto si nascondono
  sel.innerHTML = Object.keys(STATI).map(function(k){ return '<option value="'+k+'"'+(k==='arrivo'?' selected':'')+'>'+STATI[k].e+' '+STATI[k].l+'</option>'; }).join('');
  renderChips('f-stato-btns','f-stato', Object.keys(STATI), function(k){ return STATI[k].l; }, function(k){ return k; }, null, function(k){ return STATI[k].c; });
  Array.from(document.getElementById('f-stato-btns').children).forEach(function(b, i){
    const col = STATI[Object.keys(STATI)[i]].c;
    b.classList.add('chip-tipo');
    b.style.background = col;
    b.style.borderColor = col;
    b.style.color = '#fff';
  });
  const chip = document.getElementById('f-stato-btns').querySelector('.active');
  const lbl = document.getElementById('f-stato-dd-label');
  if(lbl && chip){ lbl.innerHTML = chip.innerHTML; }
  coloraTriggerStato();
  aggiornaStatiColfForm();
}
function coloraTriggerStato(){
  const trig = document.querySelector('#f-stato-dd .chip-dd-trigger');
  const st = STATI[document.getElementById('f-stato').value];
  if(!trig || !st) return;
  trig.style.background = st.c;
  trig.style.borderColor = st.c;
  trig.style.color = '#fff';
}
document.addEventListener('click', function(e){
  document.querySelectorAll('.chip-dd.open').forEach(function(dd){
    if(!dd.contains(e.target)) dd.classList.remove('open');
  });
});

function totCaf(){ return (state.versamenti||[]).reduce(function(a,v){ return a+Number(v.importo||0); }, 0); }

// Accetta "25,50", "25.50", "1.250,00" e "1250": la virgola e' sempre il decimale
function parseImporto(v){
  let s = String(v==null?'':v).trim().replace(/[€\s]/g, '');
  if(!s) return NaN;
  if(s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else if(/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return Number(s);
}
// Fatturazione automatica per tipo di pratica (es. 730 FILCA: 25 €)
// Pratiche in convenzione (FPS, FILCA): importo predefinito impostato in Utenti e permessi, altrimenti 0 €
function fatturaAutomatica(tipo){ return typeof importoAutomaticoConvenzione === 'function' ? importoAutomaticoConvenzione(tipo) : undefined; }
function applicaFatturaAutomatica(tipo, idCampo){
  const el = document.getElementById(idCampo || 'f-compenso');
  if(!el) return;
  const importo = fatturaAutomatica(tipo);
  if(importo !== undefined){
    if(!el.value.trim() || el.dataset.auto === '1'){ el.value = importoInCampo(importo); el.dataset.auto = '1'; }
  } else if(el.dataset.auto === '1'){
    el.value = ''; el.dataset.auto = '';
  }
}
function importoInCampo(n){
  if(n === '' || n == null || isNaN(Number(n))) return '';
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits:2, maximumFractionDigits:2, useGrouping:false });
}
// Come un registratore di cassa: si scrivono solo cifre e le ultime due sono i centesimi (3550 -> 35,50)
function importoCassa(el){
  const cifre = el.value.replace(/\D/g, '').replace(/^0+/, '');
  el.value = cifre ? importoInCampo(Number(cifre) / 100) : '';
}
function filtraImporto(el){
  const pulito = el.value.replace(/[^0-9,.]/g, '');
  if(pulito !== el.value) el.value = pulito;
}
function formattaCampoImporto(el){
  const n = parseImporto(el.value);
  el.value = isNaN(n) ? '' : importoInCampo(n);
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
// Con "dalla fattura n. … alla n. …" si vede quanto fanno quelle fatture (anno di protocollo), da usare come importo
function numeroFatturaPratica(p){ const m = /\d+/.exec(String(p.numFattura || '')); return m ? Number(m[0]) : null; }
// Totale delle fatture dal n. … al n. … dell'anno (per controllare l'importo del versamento)
function totaleFattureIntervallo(dal, al, anno){
  if(!(dal > 0) || !(al > 0) || dal > al) return null;
  return (state.pratiche || []).filter(function(p){ const n = numeroFatturaPratica(p); return !p.annullata && annoPratica(p) === anno && n != null && n >= dal && n <= al; })
    .reduce(function(t, p){ return t + Number(p.compenso || 0); }, 0);
}
function suggerimentoVersamento(){
  const box = document.getElementById('vc-suggerimento');
  if(!box) return;
  // l'importo del versamento lo decide l'operatore: nessun calcolo automatico dalle fatture
  box.innerHTML = ''; return;
  const dal = parseInt(document.getElementById('vc-dal').value, 10), al = parseInt(document.getElementById('vc-al').value, 10);
  if(!(dal > 0) || !(al > 0) || dal > al){ box.innerHTML = ''; return; }
  const anno = annoAttivo();
  const lista = (state.pratiche || []).filter(function(p){ const n = numeroFatturaPratica(p); return !p.annullata && annoPratica(p) === anno && n != null && n >= dal && n <= al; });
  const tot = lista.reduce(function(t, p){ return t + Number(p.compenso || 0); }, 0);
  const pagate = lista.filter(function(p){ return Number(p.pagato || 0) > 0; });
  const totPag = pagate.reduce(function(t, p){ return t + Number(p.compenso || 0); }, 0);
  const attese = al - dal + 1;
  // Se l'importo è vuoto lo metto io: è il totale delle fatture (il bollettino si calcola da solo)
  const campoImp = document.getElementById('vc-importo');
  if(campoImp && tot > 0 && !campoImp.value.trim()){ campoImp.value = tot.toFixed(2).replace('.', ','); if(typeof totaleVersamentoForm === 'function') setTimeout(totaleVersamentoForm, 0); }
  box.innerHTML = '🧾 Fatture dal n. ' + dal + ' al n. ' + al + ' (' + anno + '): <b>' + lista.length + '</b> trovate' + (lista.length < attese ? ' su ' + attese + ' <span style="color:#c0392b">(alcuni numeri non sono nel registro)</span>' : '') + ' · totale <b>' + fmtEuro(tot) + '</b>'
    + (pagate.length !== lista.length ? ' · di cui pagate ' + pagate.length + ' per ' + fmtEuro(totPag) : '')
    + (tot ? ' <button type="button" onclick="document.getElementById(\'vc-importo\').value=\'' + tot.toFixed(2).replace('.', ',') + '\'; if(typeof totaleVersamentoForm===\'function\') totaleVersamentoForm();" style="padding:3px 10px; font-size:12px; margin-left:6px">Usa come importo</button>' : '');
}

const aperti = {};
function gToggle(el){ aperti[el.dataset.k] = el.open; }
function initFiltroStato(){
  const sel = document.getElementById('filtro-stato');
  if(!sel) return;
  // si ridisegna quando cambiano gli stati (es. stati aggiunti dall'amministratore, caricati dopo l'avvio)
  const firma = Object.keys(STATI).map(function(k){ return k + ':' + STATI[k].l; }).join('|');
  if(sel.dataset.firma === firma && sel.options.length) return;
  const val = sel.value;
  sel.dataset.firma = firma;
  sel.innerHTML = '<option value="">Tutti gli stati</option>' + Object.keys(STATI).map(function(k){
    return '<option value="'+k+'">'+STATI[k].e+' '+STATI[k].l+'</option>';
  }).join('');
  if(val && STATI[val]) sel.value = val;
}
function filtraTesto(lista){
  const q = ((document.getElementById('cerca')||{}).value||'').trim().toLowerCase();
  if(!q) return lista;
  return lista.filter(function(p){ return [String(p.numero).padStart(4,'0'), formattaProtocollo(p), p.nome, p.congiunta, p.tipo, p.data, p.annullataMotivo, 'annullata'].join(' ').toLowerCase().indexOf(q) >= 0; });
}
function rigaAnnullataHTML(p){
  const quando = p.annullataIl ? new Date(p.annullataIl).toLocaleDateString('it-IT') : '';
  return '<tr style="background:color-mix(in srgb, #8a8f98 12%, var(--card)); color:var(--sub)">'
    + '<td class="n" style="text-decoration:line-through">' + formattaProtocollo(p) + '</td>'
    + '<td>' + esc(p.data||'-') + '</td><td>-</td>'
    + '<td class="wrap"><span style="text-decoration:line-through">' + esc((p.nome||'-').toUpperCase()) + '</span>'
    + '<div class="sub2" style="color:#c0392b; font-weight:700">🚫 ANNULLATA' + (quando ? ' il ' + esc(quando) : '') + (p.annullataDa ? ' da ' + esc(p.annullataDa) : '') + (p.annullataMotivo ? ' – ' + esc(p.annullataMotivo) : '') + '</div></td>'
    + '<td class="wrap" style="text-decoration:line-through">' + esc(p.tipo||'-') + '</td>'
    + '<td><span style="display:inline-block; background:#8a8f98; color:#fff; border-radius:999px; padding:3px 10px; font-size:12px; font-weight:700">ANNULLATA</span>'
    + (haFatturaEmessa(p) ? (String(p.notaCredito||'').trim()
        ? '<div class="sub2" style="color:#1a7f37; font-weight:700">✓ Fattura n. ' + esc(p.numFattura||'') + ' stornata: nota di credito n. ' + esc(p.notaCredito) + (p.notaCreditoData ? ' del ' + esc(p.notaCreditoData) : '') + (puoAnnullare() ? ' <a href="#" onclick="togliNotaCredito(\'' + p.id + '\'); return false" style="color:var(--sub)">togli</a>' : '') + '</div>'
        : '<div class="sub2" style="color:#b35f0c; font-weight:700">⚠️ Fattura n. ' + esc(p.numFattura||'') + ' (' + fmtEuro(p.compenso) + ') ancora in contabilità: nota di credito da fare</div>'
          + (puoAnnullare() ? '<button type="button" style="margin-top:3px; background:#b35f0c; color:#fff; border:none; border-radius:6px; padding:4px 10px; font-size:12px; font-weight:700; cursor:pointer" onclick="segnaNotaCredito(\'' + p.id + '\')">📝 Nota di credito emessa</button>' : '')) : '')
    + '</td>'
    + '<td>' + formattaInserimento(p) + '</td>'
    + '<td>' + (puoAnnullare() ? '<button type="button" style="background:var(--line); color:var(--ink); border:none; border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer" onclick="ripristinaPratica(\'' + p.id + '\')" title="Toglie l\'annullamento">↩️ Ripristina</button>' : '') + '</td></tr>';
}
function puoAnnullare(){ return (typeof isAdmin === 'function' && isAdmin()) || (typeof puo === 'function' && puo('registro', true)); }
// Annulla: la pratica resta nel registro con il suo numero, fuori da conteggi e contabilità
function annullaPratica(id){
  const p = state.pratiche.find(function(x){ return x.id === id; });
  if(!p) return;
  const vecchio = document.getElementById('popup-annulla'); if(vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-annulla';
  ov.style.cssText = 'position:fixed; inset:0; z-index:450; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #c0392b; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:22px 24px; max-width:440px; width:100%">'
    + '<div style="font-size:20px; font-weight:800; color:#c0392b; text-align:center">🚫 Annulla pratica ' + esc(formattaProtocollo(p)) + '</div>'
    + '<div style="font-size:14px; margin:8px 0 12px; text-align:center"><b>' + esc(p.nome||'') + '</b> · ' + esc(p.tipo||'') + '</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:10px">La pratica <b>resta nel registro con il numero ' + esc(formattaProtocollo(p)) + '</b>, barrata e segnata ANNULLATA. Non conta più nei totali, nei contatori e nella contabilità. Si può ripristinare.</div>'
    + (String(p.numFattura||'').trim() ? '<div style="font-size:13px; margin-bottom:12px; padding:10px 12px; border-radius:10px; background:#fff4e5; border:2px solid #f08a24; color:#7a3e00"><b>⚠️ Questa pratica ha la fattura n. ' + esc(p.numFattura) + (p.dataFattura ? ' del ' + esc(p.dataFattura) : '') + (Number(p.compenso) ? ' (' + fmtEuro(p.compenso) + ')' : '') + '.</b><br>Una fattura emessa non si cancella: ricordati della <b>nota di credito</b>. Il numero ' + esc(p.numFattura) + ' resta occupato e non verrà dato a un\'altra pratica.</div>' : '')
    + '<label style="font-size:12.5px">Motivo (facoltativo)</label><input id="annulla-motivo" placeholder="Es. inserita per errore, doppione, rinuncia del cliente" style="margin-bottom:14px">'
    + '<div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap"><button type="button" data-azione="no" style="background:var(--line); color:var(--ink)">Indietro</button>'
    + '<button type="button" data-azione="si" style="background:#c0392b; color:#fff">🚫 Conferma annullamento</button></div></div>';
  document.body.appendChild(ov);
  setTimeout(function(){ const i = document.getElementById('annulla-motivo'); if(i) i.focus(); }, 50);
  ov.addEventListener('click', async function(e){
    const b = e.target.closest('button[data-azione]');
    if(!b && e.target !== ov) return;
    if(!b || b.dataset.azione === 'no'){ ov.remove(); return; }
    const motivo = document.getElementById('annulla-motivo').value.trim();
    ov.remove();
    const esito = await data.pratiche.aggiorna(id, { annullata: true, annullataMotivo: motivo });
    if(!(esito && esito.error)) avviso('🚫 Pratica ' + formattaProtocollo(p) + ' annullata: resta nel registro con il suo numero');
  });
}
async function ripristinaPratica(id){
  const p = (state.annullate||[]).find(function(x){ return x.id === id; });
  if(!p || !confirm('Ripristinare la pratica ' + formattaProtocollo(p) + ' di ' + (p.nome||'') + '?\nTornerà a contare nei totali e nella contabilità.')) return;
  const esito = await data.pratiche.aggiorna(id, { annullata: false });
  if(!(esito && esito.error)) avviso('↩️ Pratica ' + formattaProtocollo(p) + ' ripristinata');
}
// Filtri del registro. Tre gruppi indipendenti che si sommano:
//  1) ARCHIVIO: da consegnare/definire (normale) · tutte · solo consegnate/definite
//  2) STATO della pratica
//  3) CISL (iscritti, FPS, FILCA, tutti insieme) e pervenute via e-mail
// Ogni numero sui tasti conta le pratiche che si vedrebbero toccandolo, con gli altri filtri già scelti.
let SOLO_VIA_EMAIL = false, VEDI_TUTTE = false, FILTRO_CISL = '';
// 4) importo della fattura: da € … a € … (vuoto = nessun limite; da 10 a 10 = solo le fatture da 10 €)
let FATT_DA = NaN, FATT_A = NaN;
// 5) tipo di pratica (730 SEDE, IMU, ISEE…): un tipo alla volta
let FILTRO_TIPO = '';
// Riferimento (persona che ha portato il cliente): quello della pratica, altrimenti quello della scheda del cliente
let FILTRO_RIF = '';
function riferimentoPratica(p){
  if(p.riferimento) return String(p.riferimento).toUpperCase();
  const c = typeof trovaInArchivio === 'function' ? trovaInArchivio(p.nome, p.cf, p.codiceFiscale) : null;
  return c && c.riferimento ? String(c.riferimento).toUpperCase() : '';
}
// 📜 Registro: solo le pratiche ancora da fare (prima di «Lavorata»), dalla più vecchia
let SOLO_DA_FARE = false;
function scegliSoloDaFare(){ SOLO_DA_FARE = !SOLO_DA_FARE; if(SOLO_DA_FARE){ MOSTRA_CONSEGNATE = false; VEDI_TUTTE = false; } render(); const t = document.getElementById('tabella'); if(SOLO_DA_FARE && t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function scegliFiltroRif(v){ FILTRO_RIF = v || ''; if(FILTRO_RIF) allargaArchivio(); render(); }
function scegliFiltroTipo(t){ FILTRO_TIPO = FILTRO_TIPO === t ? '' : t; if(FILTRO_TIPO) allargaArchivio(); render(); }
function filtroFatturaAttivo(){ return !isNaN(FATT_DA) || !isNaN(FATT_A); }
function passaFiltroFattura(p, da, a){
  da = da === undefined ? FATT_DA : da; a = a === undefined ? FATT_A : a;
  const v = Math.round(Number(p.compenso || 0) * 100);
  if(!isNaN(da) && v < Math.round(da * 100)) return false;
  if(!isNaN(a) && v > Math.round(a * 100)) return false;
  return true;
}
function impostaFiltroFattura(){
  const n = function(id){ const el = document.getElementById(id); return el ? parseImporto(el.value) : NaN; };
  FATT_DA = n('reg-fatt-da'); FATT_A = n('reg-fatt-a');
  if(!isNaN(FATT_DA) && !isNaN(FATT_A) && FATT_DA > FATT_A){ const t = FATT_DA; FATT_DA = FATT_A; FATT_A = t; }
  if(filtroFatturaAttivo()) allargaArchivio();
  render();
}
function scegliImportoFattura(v){ if(FATT_DA === v && FATT_A === v){ FATT_DA = NaN; FATT_A = NaN; } else { FATT_DA = v; FATT_A = v; allargaArchivio(); } render(); }
function eConvenzioneCisl(p){ return typeof convenzioneDi === 'function' && !!convenzioneDi(p.tipo); }
// 'iscritti' = iscritti CISL senza FPS e FILCA · 'fps' = 730 CISL FPS · 'filca' = 730 CISL FILCA · 'tutti' = iscritti + FPS + FILCA
function passaFiltroCisl(p, f){
  f = f === undefined ? FILTRO_CISL : f;
  const c = typeof convenzioneDi === 'function' ? convenzioneDi(p.tipo) : null;
  if(f === 'iscritti') return !!p.iscrittoCisl && !c;
  if(f === 'fps') return !!c && c.chiave === 'fps';
  if(f === 'filca') return !!c && c.chiave === 'filca';
  if(f === 'tutti') return !!p.iscrittoCisl || !!c;
  return true;
}
function modoArchivio(){ return MOSTRA_CONSEGNATE ? 'consegnate' : (VEDI_TUTTE ? 'tutte' : 'aperte'); }
function impostaArchivio(m){ MOSTRA_CONSEGNATE = m === 'consegnate'; VEDI_TUTTE = m === 'tutte'; render(); }
function ricercaAttiva(){ return !!filtroContribuente() || !!((document.getElementById('cerca')||{}).value||'').trim(); }
// cercando un nome o un testo, nella vista normale si vedono anche le consegnate
function passaArchivio(p, m){ m = m || modoArchivio(); if(m === 'consegnate') return eConsegnata(p); if(m === 'tutte') return true; return !eConsegnata(p) || ricercaAttiva(); }
// scegliere uno stato o un filtro CISL / e-mail cerca in tutti e due gli archivi (se non si guardano solo le consegnate)
function allargaArchivio(){ if(!MOSTRA_CONSEGNATE) VEDI_TUTTE = true; }
function scegliStatoRegistro(k){ const sel = document.getElementById('filtro-stato'); if(sel) sel.value = k; if(k) allargaArchivio(); render(); }
function scegliFiltroCisl(k){ FILTRO_CISL = FILTRO_CISL === k ? '' : k; if(FILTRO_CISL) allargaArchivio(); render(); }
function scegliViaEmail(){ SOLO_VIA_EMAIL = !SOLO_VIA_EMAIL; if(SOLO_VIA_EMAIL) allargaArchivio(); render(); }
function azzeraFiltriRegistro(){ const sel = document.getElementById('filtro-stato'); if(sel) sel.value = ''; FILTRO_CISL = ''; SOLO_VIA_EMAIL = false; VEDI_TUTTE = false; MOSTRA_CONSEGNATE = false; FATT_DA = NaN; FATT_A = NaN; FILTRO_TIPO = ''; FILTRO_RIF = ''; SOLO_DA_FARE = false;
  ['cerca','filtro-contribuente'].forEach(function(id){ const el = document.getElementById(id); if(el) el.value = ''; }); render(); }
function disegnaChipStati(pratiche){
  const box = document.getElementById('chip-stati');
  if(!box) return;
  pratiche = pratiche || [];
  const sel = (document.getElementById('filtro-stato')||{}).value || '';
  const modo = modoArchivio();
  const tasto = function(attivo, col, onclick, testo, n, titolo, tratteggio){
    return '<button type="button" onclick="' + onclick + '"' + (titolo ? ' title="' + titolo + '"' : '') + ' style="padding:5px 12px; border-radius:999px; cursor:pointer; font-size:12.5px; font-weight:700; border:2px ' + (tratteggio ? 'dashed ' : 'solid ') + col + '; background:' + (attivo ? col : 'transparent') + '; color:' + (attivo ? '#fff' : col) + '">' + testo + ' <b>' + n + '</b></button>';
  };
  const riga = function(etichetta, contenuto){ return '<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; width:100%"><span style="font-size:12px; font-weight:800; color:var(--sub); min-width:74px">' + etichetta + '</span>' + contenuto + '</div>'; };
  // 1) archivio: con stato, CISL, e-mail, contribuente e testo già scelti
  const perArch = filtra(pratiche);
  const nArch = function(m){ return perArch.filter(function(p){ return passaArchivio(p, m); }).length; };
  let html = riga('Archivio', tasto(modo === 'aperte', '#8d5a3b', "impostaArchivio('aperte')", '📋 Da consegnare / definire', nArch('aperte'))
    + tasto(modo === 'tutte', '#374151', "impostaArchivio('tutte')", '🗂️ Tutte', nArch('tutte'), 'Da consegnare e consegnate insieme')
    + tasto(modo === 'consegnate', '#1a7f37', "impostaArchivio('consegnate')", '📦 Solo consegnate / definite', nArch('consegnate')));
  // 2) stato: nell'archivio scelto, con CISL / e-mail / ricerca
  const perStato = filtra(pratiche, { stato: true }).filter(function(p){ return passaArchivio(p); });
  const conta = {};
  perStato.forEach(function(p){ conta[p.stato] = (conta[p.stato]||0) + 1; });
  html += riga('Stato', tasto(!sel, '#374151', "scegliStatoRegistro('')", 'Tutti gli stati', perStato.length)
    + Object.keys(STATI).filter(function(k){ return conta[k] || sel === k; }).map(function(k){ return tasto(sel === k, STATI[k].c || '#1d4f91', "scegliStatoRegistro('" + k + "')", STATI[k].e + ' ' + STATI[k].l, conta[k] || 0); }).join(''));
  // 3) CISL ed e-mail
  const perCisl = filtra(pratiche, { cisl: true }).filter(function(p){ return passaArchivio(p); });
  const nC = function(k){ return perCisl.filter(function(p){ return passaFiltroCisl(p, k); }).length; };
  const perEmail = filtra(pratiche, { email: true }).filter(function(p){ return passaArchivio(p); });
  const nEmail = perEmail.filter(function(p){ return p.viaEmail; }).length;
  html += riga('CISL', tasto(FILTRO_CISL === 'iscritti', '#c0392b', "scegliFiltroCisl('iscritti')", '👤 Iscritti CISL', nC('iscritti'), 'Solo gli iscritti CISL (pensionati e dipendenti), senza 730 FPS e 730 FILCA', true)
    + tasto(FILTRO_CISL === 'fps', '#7b3fa0', "scegliFiltroCisl('fps')", '🏛️ CISL FPS', nC('fps'), 'Solo le pratiche 730 CISL FPS', true)
    + tasto(FILTRO_CISL === 'filca', '#b35f0c', "scegliFiltroCisl('filca')", '🏗️ CISL FILCA', nC('filca'), 'Solo le pratiche 730 CISL FILCA', true)
    + tasto(FILTRO_CISL === 'tutti', '#c0392b', "scegliFiltroCisl('tutti')", '👤 Iscritti + FPS + FILCA', nC('tutti'), 'Iscritti CISL insieme alle pratiche 730 FPS e 730 FILCA', true)
    + ((nEmail || SOLO_VIA_EMAIL) ? tasto(SOLO_VIA_EMAIL, '#1d4f91', 'scegliViaEmail()', '📧 Via e-mail', nEmail, 'Solo le pratiche pervenute via e-mail', true) : ''));
  // tipo di pratica: solo i tipi che hanno pratiche (con gli altri filtri già scelti)
  const perTipo = filtra(pratiche, { tipo: true }).filter(function(p){ return passaArchivio(p); });
  const nTipo = {};
  perTipo.forEach(function(p){ const t = p.tipo || 'SENZA TIPO'; nTipo[t] = (nTipo[t] || 0) + 1; });
  if(FILTRO_TIPO && !nTipo[FILTRO_TIPO]) nTipo[FILTRO_TIPO] = 0;
  const tipiOrdine = getTipiList().filter(function(t){ return nTipo[t] !== undefined; });
  Object.keys(nTipo).forEach(function(t){ if(tipiOrdine.indexOf(t) < 0) tipiOrdine.push(t); });
  if(tipiOrdine.length) html += riga('📂 Tipo', tipiOrdine.map(function(t){ return tasto(FILTRO_TIPO === t, coloreCollaboratore(t), 'scegliFiltroTipo(' + esc(JSON.stringify(t)) + ')', esc(t), nTipo[t], 'Solo le pratiche ' + esc(t), true); }).join(''));
  // riferimento: chi ha portato il cliente (solo se qualche pratica ce l'ha)
  const perRif = filtra(pratiche, { rif: true }).filter(function(p){ return passaArchivio(p); });
  const nRif = {};
  perRif.forEach(function(p){ const r = riferimentoPratica(p); if(r) nRif[r] = (nRif[r] || 0) + 1; });
  if(FILTRO_RIF && !nRif[FILTRO_RIF]) nRif[FILTRO_RIF] = 0;
  const rifOrdine = Object.keys(nRif).sort(function(a, b){ return (nRif[b] - nRif[a]) || a.localeCompare(b); });
  if(rifOrdine.length) html += riga('👤 Riferimento', '<select onchange="scegliFiltroRif(this.value)" title="Solo le pratiche dei clienti portati da questa persona" style="width:auto; max-width:100%; padding:5px 10px; font-size:13px; font-weight:700' + (FILTRO_RIF ? '; border:2px solid #6d3fa0; color:#6d3fa0' : '') + '"><option value="">Tutti i riferimenti</option>'
    + rifOrdine.map(function(r){ return '<option value="' + esc(r) + '"' + (FILTRO_RIF === r ? ' selected' : '') + '>' + esc(r) + ' (' + nRif[r] + ')</option>'; }).join('') + '</select>'
    + (FILTRO_RIF ? ' <span style="font-size:12.5px; font-weight:800; color:#6d3fa0">' + filtra(pratiche).filter(function(p){ return passaArchivio(p); }).length + ' pratiche portate da ' + esc(FILTRO_RIF) + '</span>' : ''));
  // 4) importo della fattura
  const perFatt = filtra(pratiche, { fattura: true }).filter(function(p){ return passaArchivio(p); });
  const trovate = perFatt.filter(function(p){ return passaFiltroFattura(p); });
  const importi = {};
  perFatt.forEach(function(p){ const v = Math.round(Number(p.compenso || 0) * 100) / 100; importi[v] = (importi[v] || 0) + 1; });
  const campo = function(id, v, ph){ return '<input id="' + id + '" type="text" inputmode="decimal" placeholder="' + ph + '" value="' + (isNaN(v) ? '' : importoInCampo(v)) + '" oninput="filtraImporto(this)" onkeydown="if(event.key===\'Enter\'){event.preventDefault(); impostaFiltroFattura();}" style="width:78px; padding:4px 8px; border-radius:8px; font-size:13px">'; };
  html += riga('💶 Fattura', '<span style="font-size:12.5px; font-weight:700">da €</span>' + campo('reg-fatt-da', FATT_DA, 'min') + '<span style="font-size:12.5px; font-weight:700">a €</span>' + campo('reg-fatt-a', FATT_A, 'max')
    + '<button type="button" onclick="impostaFiltroFattura()" style="padding:5px 12px; border-radius:999px; cursor:pointer; font-size:12.5px; font-weight:700; border:2px solid #1d4f91; background:#1d4f91; color:#fff">🔎 Cerca</button>'
    + (filtroFatturaAttivo() ? '<span style="font-size:12.5px; font-weight:800; color:#1d4f91">' + trovate.length + ' pratiche · totale fatture ' + fmtEuro(trovate.reduce(function(t, p){ return t + Number(p.compenso || 0); }, 0)) + '</span>' : '')
    + Object.keys(importi).map(Number).sort(function(a, b){ return a - b; }).slice(0, 15).map(function(v){ return tasto(FATT_DA === v && FATT_A === v, '#0f766e', 'scegliImportoFattura(' + v + ')', v ? fmtEuro(v) : 'Senza fattura', importi[v], v ? 'Solo le fatture da ' + fmtEuro(v) : 'Solo le pratiche senza importo di fattura', true); }).join(''));
  const filtriAttivi = sel || FILTRO_CISL || FILTRO_TIPO || FILTRO_RIF || SOLO_DA_FARE || SOLO_VIA_EMAIL || filtroFatturaAttivo() || modo !== 'aperte' || ricercaAttiva();
  // stampa di quello che si vede con i filtri scelti
  const visibili = filtra(pratiche).filter(function(p){ return passaArchivio(p); }).length;
  html += '<div style="width:100%; display:flex; gap:8px; flex-wrap:wrap; align-items:center">'
    + '<button type="button" onclick="scegliSoloDaFare()" title="Nel registro solo le pratiche dell\'anno non ancora lavorate (in arrivo, da lavorare scansionata, in lavorazione), dalla più vecchia alla più nuova" style="padding:6px 14px; border-radius:999px; cursor:pointer; font-size:13px; font-weight:800; border:2px solid #6d3fa0; background:' + (SOLO_DA_FARE ? '#6d3fa0' : 'transparent') + '; color:' + (SOLO_DA_FARE ? '#fff' : '#6d3fa0') + '">📜 ' + (SOLO_DA_FARE ? '✓ ' : '') + 'Solo da fare, dalla più vecchia' + (typeof praticaDaFare === 'function' ? ' (' + pratiche.filter(praticaDaFare).length + ')' : '') + '</button>'
    + '<button type="button" onclick="stampaReportStato()" title="Stampa (PDF o Excel) solo le pratiche che vedi con i filtri scelti" style="padding:6px 14px; border-radius:999px; cursor:pointer; font-size:13px; font-weight:800; border:none; background:#1d4f91; color:#fff">🖨️ Stampa queste ' + visibili + ' pratiche</button>'
    + (filtriAttivi ? '<button type="button" onclick="azzeraFiltriRegistro()" style="padding:4px 12px; border-radius:999px; cursor:pointer; font-size:12px; font-weight:700; border:1px solid var(--sub); background:none; color:var(--sub)">✕ Togli tutti i filtri</button>' : '') + '</div>';
  box.innerHTML = html;
}
// Ricerca per stato dentro ogni riquadro di tipo pratica, con la stampa del report di quel tipo
const STATO_GRUPPO = {};
function filtroStatoGruppoHTML(k, pratiche){
  if(!(pratiche||[]).length) return '';
  const sel = STATO_GRUPPO[k] || '';
  const conta = {};
  pratiche.forEach(function(p){ conta[p.stato] = (conta[p.stato]||0) + 1; });
  const kq = esc(k).replace(/'/g, "\\'");
  const chip = function(st, testo, n, col){
    const attivo = sel === st;
    return '<button type="button" onclick="STATO_GRUPPO[\''+kq+'\']=\''+st+'\'; render()" style="padding:4px 11px; border-radius:999px; cursor:pointer; font-size:12px; font-weight:700; border:2px solid '+col+'; background:'+(attivo?col:'var(--card)')+'; color:'+(attivo?'#fff':col)+'">'+testo+' <b>'+n+'</b></button>';
  };
  return '<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin:2px 0 10px; padding:8px; border-radius:10px; background:var(--bg)">'
    + '<span style="font-size:12.5px; font-weight:800; color:var(--sub)">🔎 Stato:</span>'
    + chip('', 'Tutte', pratiche.length, '#374151')
    + Object.keys(STATI).filter(function(st){ return conta[st]; }).map(function(st){ return chip(st, STATI[st].e+' '+STATI[st].l, conta[st], STATI[st].c || '#1d4f91'); }).join('')
    + '<button type="button" onclick="apriStampa(\'registro\', { tipo: \''+kq+'\', stato: STATO_GRUPPO[\''+kq+'\'] || \'\', consegna: STATO_GRUPPO[\''+kq+'\'] ? \'\' : (MOSTRA_CONSEGNATE ? \'solo\' : \'escludi\') })" style="margin-left:auto; padding:5px 13px; border:none; border-radius:999px; background:#1d4f91; color:#fff; font-size:12.5px; font-weight:800; cursor:pointer">🖨️ Stampa report</button></div>';
}
function stampaReportStato(){
  const sel = (document.getElementById('filtro-stato')||{}).value || '';
  const cli = filtroContribuente();
  // la stampa segue esattamente la lista che stai guardando (tutti i filtri e la ricerca)
  const modo = modoArchivio();
  const anno = annoAttivo();
  const ids = filtra(state.pratiche.filter(function(p){ return annoPratica(p) === anno; })).filter(vediNelRegistro).map(function(p){ return p.id; });
  apriStampa('registro', { stato: sel, cliente: cli, cisl: FILTRO_CISL, tipo: FILTRO_TIPO || undefined, fattDa: FATT_DA, fattA: FATT_A, consegna: modo === 'consegnate' ? 'solo' : (modo === 'tutte' || ricercaAttiva() ? '' : 'escludi'), ids: ids, filtriRegistro: descrizioneFiltriRegistro() });
}
// I filtri del registro in parole, per l'intestazione della stampa
function descrizioneFiltriRegistro(){
  const r = [];
  const modo = modoArchivio();
  r.push(modo === 'consegnate' ? 'solo consegnate / definite' : (modo === 'tutte' ? 'tutte' : 'da consegnare / definire'));
  const sel = (document.getElementById('filtro-stato')||{}).value || '';
  if(sel) r.push('stato ' + statoLabel(sel));
  if(FILTRO_CISL) r.push({ iscritti: 'iscritti CISL', fps: '730 CISL FPS', filca: '730 CISL FILCA', tutti: 'iscritti + FPS + FILCA' }[FILTRO_CISL] || FILTRO_CISL);
  if(FILTRO_TIPO) r.push('tipo ' + FILTRO_TIPO);
  if(FILTRO_RIF) r.push('riferimento ' + FILTRO_RIF);
  if(SOLO_DA_FARE) r.push('solo da fare, dalla più vecchia');
  if(SOLO_VIA_EMAIL) r.push('via e-mail');
  if(filtroFatturaAttivo()) r.push('fattura ' + (!isNaN(FATT_DA) && FATT_DA === FATT_A ? fmtEuro(FATT_DA) : (!isNaN(FATT_DA) ? 'da ' + fmtEuro(FATT_DA) : '') + (!isNaN(FATT_A) ? ' fino a ' + fmtEuro(FATT_A) : ' in su')));
  const cli = filtroContribuente(); if(cli) r.push('contribuente «' + cli + '»');
  const q = ((document.getElementById('cerca')||{}).value||'').trim(); if(q) r.push('ricerca «' + q + '»');
  return r.join(' · ');
}
function filtroContribuente(){ return ((document.getElementById('filtro-contribuente')||{}).value||'').trim().toUpperCase(); }
// escludi: { stato, cisl, email } per contare quante pratiche darebbe ogni tasto
function filtra(lista, escludi){
  escludi = escludi || {};
  initFiltroStato();
  const statoSel = (document.getElementById('filtro-stato')||{}).value || '';
  if(statoSel && !escludi.stato){ lista = lista.filter(function(p){ return p.stato === statoSel; }); }
  if(SOLO_VIA_EMAIL && !escludi.email){ lista = lista.filter(function(p){ return !!p.viaEmail; }); }
  if(FILTRO_CISL && !escludi.cisl){ lista = lista.filter(function(p){ return passaFiltroCisl(p); }); }
  if(filtroFatturaAttivo() && !escludi.fattura){ lista = lista.filter(function(p){ return passaFiltroFattura(p); }); }
  if(FILTRO_TIPO && !escludi.tipo){ lista = lista.filter(function(p){ return (p.tipo || 'SENZA TIPO') === FILTRO_TIPO; }); }
  if(SOLO_DA_FARE && !escludi.dafare && typeof praticaDaFare === 'function'){ lista = lista.filter(praticaDaFare); }
  if(FILTRO_RIF && !escludi.rif){ lista = lista.filter(function(p){ return riferimentoPratica(p) === FILTRO_RIF; }); }
  // contribuente: titolare o coniuge, per nome o codice fiscale (apostrofi, spazi e accenti non contano)
  const cli = filtroContribuente();
  if(cli){ const kc = chiaveRicerca(cli); lista = lista.filter(function(p){ const t = [p.nome, p.congiunta, ((p.congCognome||'') + ' ' + (p.congNome||'')), p.codiceFiscale, p.congCodiceFiscale, ((p.lavCognome||'') + ' ' + (p.lavNome||'')), p.lavCodiceFiscale, (typeof nomiInquilini === 'function' ? nomiInquilini(p).join(' ') : '')].join(' ').toUpperCase(); return t.indexOf(cli) >= 0 || (!!kc && chiaveRicerca(t).indexOf(kc) >= 0); }); }
  const q = ((document.getElementById('cerca')||{}).value||'').trim().toLowerCase();
  if(!q) return lista;
  return lista.filter(function(p){
    return [String(p.numero).padStart(4,'0'), formattaProtocollo(p), p.nome, p.congiunta, p.congData, ((p.lavCognome||'') + ' ' + (p.lavNome||'')), p.lavCodiceFiscale, (typeof nomiInquilini === 'function' ? nomiInquilini(p).join(' ') : ''), p.telefono, p.telefonoFisso, p.tipo, p.cf, p.data, p.consegnataIl, p.note, statoLabel(p.stato), p.numFattura, p.inseritoDa].join(' ').toLowerCase().indexOf(q) >= 0;
  });
}

function render(){
  if(typeof renderGrafici === 'function') renderGrafici();
  if(typeof renderMorosi === 'function') renderMorosi();
  if(typeof renderOggi === 'function') renderOggi();
  const list = document.getElementById('gruppi'); const oldList = document.getElementById('list'); if(oldList) oldList.innerHTML = '';
  const summary = document.getElementById('summary');
  initSelettoreAnno();
  const annoSel = annoAttivo();
  const pratAnno = state.pratiche.filter(function(p){ return annoPratica(p) === annoSel; });

  const lavorateEl = document.getElementById('badge-lavorate');
  if(lavorateEl){
    // Contatori in alto: solo le pratiche 730 (e tutti i loro tipi), congiunte valgono 2
    const c = conteggi730(pratAnno);
    const perOperatore = {};
    const io = ((auth.profilo && auth.profilo.nome) || '').toUpperCase();
    if(io) perOperatore[io] = 0;
    NOMI_OPERATORI.forEach(function(n){ perOperatore[String(n).toUpperCase()] = 0; });
    pratAnno.forEach(function(p){
      const chi = (p.inseritoDa||'').toUpperCase();
      if(!chi) return;
      if(!(chi in perOperatore)) perOperatore[chi] = 0;
      if(e730(p) && eLavorata(p)) perOperatore[chi] += pesoPratica(p);
    });
    const badge = function(testo, numero, colore, titolo, chiave){
      return '<span title="' + esc(titolo) + ' Tocca per vedere l\'elenco." onclick="apriElencoContatore(' + esc(JSON.stringify(chiave || '')) + ')" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:8px; background:' + colore + '; color:#fff; font-size:13.5px; font-weight:700; padding:5px 6px 5px 12px; border-radius:999px; box-shadow:0 2px 8px rgba(0,0,0,.2); white-space:nowrap">' + testo
        + ' <span style="background:#fff; color:' + colore + '; font-size:16px; font-weight:800; min-width:30px; text-align:center; padding:1px 8px; border-radius:999px">' + numero + '</span></span>';
    };
    const nota = ' del ' + annoSel + ': solo 730, le congiunte valgono 2.';
    lavorateEl.innerHTML = '<div style="display:flex; flex-direction:column; align-items:stretch; gap:5px; min-width:210px">'
      + badge('TOTALE PRATICHE', c.tot, '#374151', 'Pratiche lavorate e da lavorare' + nota + ' Le rinunce e le annullate sono a parte.', 'tot')
      + badge('DA LAVORARE', c.daFare, c.daFare ? '#c0392b' : '#2f9e5f', 'In arrivo, in lavorazione o da lavorare scansionata' + nota, 'dafare')
      + badge('TOTALE LAVORATE', c.lav, '#2f9e5f', 'Lavorate, da fatturare, da pagare, pagate o non pagate' + nota, 'lav')
      + (c.rinunce ? badge('RINUNCE', c.rinunce, '#6b7280', 'Rinunce alla compilazione' + nota + ' Non contano tra le pratiche.', 'rinunce') : '')
      + Object.keys(perOperatore).sort().map(function(chi){ return badge(esc(chi), perOperatore[chi], '#1d4f91', 'Pratiche 730 lavorate da ' + chi + nota, 'op:' + chi); }).join('')
      + '</div>';
    if(typeof posizionaPannelloScadenze === 'function') posizionaPannelloScadenze();
  }
  const versAnno = (state.versamenti||[]).filter(function(v){ return annoVersamento(v) === annoSel; });

  const conti = conteggi730(pratAnno);
  const tot = conti.tot, daLavorare = conti.daFare, lavorate = conti.lav;
  // per i conti: anche le fatture delle pratiche annullate senza nota di credito
  const pratC = praticheContabili(pratAnno);
  const pratCont = pratC.concat(fattureAnnullateAperte(annoSel));
  const fattAttesa = totaleFattureInAttesa(pratAnno);
  const fattureEmesse = pratCont.reduce((a,p)=>a+Number(p.compenso||0),0);
  const incassoLordo = pratAnno.reduce((a,p)=>a+Number(p.pagato||0),0);
  const versatoCaf = versAnno.reduce(function(a,v){ return a+Number(v.importo||0); }, 0);
  const incasso = incassoLordo - versatoCaf;
  const speseSede = typeof totaleSpeseSede === 'function' ? totaleSpeseSede(annoSel) : 0;
  // guadagno netto = incasso totale − fatture emesse − spese sede (= guadagno 730 + guadagno altre pratiche − spese).
  // I versamenti CAF non si tolgono: pagano le fatture già tolte (il netto in cassa è incasso − versamenti)
  const differenzaIncFatt = incassoLordo - fattureEmesse - speseSede;

  // Cassa: incasso − quello che è uscito per il CAF (bollettini e bonifici) − tutte le spese sede (anche quelle detratte al CAF)
  const CC = (function(){ const d = typeof cassaDivisa === 'function' ? cassaDivisa(annoSel) : { detrContanti:0, detrBanca:0, bonifici:0, contanti:0, banca:0 };
    const detr = d.detrContanti + d.detrBanca, speseTutte = typeof totaleSpeseSedeLordo === 'function' ? totaleSpeseSedeLordo(annoSel) : speseSede;
    return { d: d, detr: detr, bonifici: d.bonifici, usciteCaf: versatoCaf - detr, speseTutte: speseTutte, cassa: incassoLordo - (versatoCaf - detr) - speseTutte }; })();
  const vPrat = vedeSezioneContabilita('cont_pratiche'), vEco = vedeSezioneContabilita('cont_economici'), vBlocchi = vedeSezioneContabilita('cont_blocchi'), vGrafici = vedeSezioneContabilita('cont_grafici');
  const contExcel = document.getElementById('cont-excel');
  if(contExcel) contExcel.style.display = (vPrat && vEco && vBlocchi && vGrafici) ? '' : 'none';
  const raffBox = document.getElementById('raffronto');
  if(raffBox) raffBox.style.display = vGrafici ? '' : 'none';
  summary.innerHTML = ((vPrat || vEco) ? '<div class="cont-gruppo" style="--cg:#374151"><div class="cont-gruppo-tit">📒 CONTABILITÀ GENERALE</div>' : '') + (vPrat ? `
    <div class="stat c4" data-dett="p730" style="background:#1d4f91; border-color:#1d4f91; color:#fff"><b>${tot}</b><span style="color:rgba(255,255,255,.92); font-weight:600">PRATICHE 730 TOTALI${notaCongiunte(conti.listaTot)}</span></div>
    <div class="stat c4" data-dett="p730lav" style="background:#2f9e5f; border-color:#2f9e5f; color:#fff"><b>${lavorate}</b><span style="color:rgba(255,255,255,.92); font-weight:600">730 LAVORATE${notaCongiunte(conti.listaLav)}</span></div>
    <div class="stat c4" data-dett="p730dalav" style="background:#e57373; border-color:#e57373; color:#fff"><b>${daLavorare}</b><span style="color:rgba(255,255,255,.95); font-weight:600">730 DA LAVORARE${notaCongiunte(conti.listaDaFare)}</span></div>
    <div class="stat c4" data-dett="paltre" style="background:#0e8a8a; border-color:#0e8a8a; color:#fff"><b>${sommaPeso(pratAnno.filter(eAltraConta))}</b><span style="color:rgba(255,255,255,.92); font-weight:600">ALTRE PRATICHE</span></div>` : '') + (vEco ? `
    <div class="stat c5 verde" data-dett="fatture"><b>${fmtEuro(fattureEmesse)}</b><span>FATTURE EMESSE${fattAttesa > 0.004 ? '<br><small style="font-weight:600">⏳ in attesa di consegna ' + fmtEuro(fattAttesa) + '</small>' : ''}</span></div>
    <div class="stat c5 viola" data-dett="incasso"><b>${fmtEuro(incassoLordo)}</b><span>INCASSO TOTALE</span></div>
    ${(function(){ const p730 = pratAnno.filter(e730Conta), cons = p730.filter(eConsegnata), daC = p730.filter(function(p){ return !eConsegnata(p); });
      const som = function(l, c){ return l.reduce(function(t,p){ return t + Number(p[c]||0); }, 0); };
      return '<div class="stat c5" data-dett="consegnate" style="background:#8d5a3b; border-color:#8d5a3b; color:#fff"><b>' + sommaPeso(cons) + ' / ' + sommaPeso(p730) + '</b><span style="color:rgba(255,255,255,.92); font-weight:600">📦 730 CONSEGNATI'
        + '<br><span style="display:inline-block; margin-top:3px; padding:1px 8px; border-radius:999px; background:#1a7f37; color:#fff">✅ consegnati ' + sommaPeso(cons) + '</span> incasso ' + fmtEuro(som(cons,'pagato')) + ' · fatture ' + fmtEuro(som(cons,'compenso'))
        + '<br><span style="display:inline-block; margin-top:3px; padding:1px 8px; border-radius:999px; background:#fff; color:#8d5a3b">📦 da consegnare ' + sommaPeso(daC) + '</span> incasso ' + fmtEuro(som(daC,'pagato')) + ' · fatture ' + fmtEuro(som(daC,'compenso'))
        + '</span></div>'; })()}
    <div class="stat c5 blu" data-dett="versamenti"><b>${fmtEuro(CC.usciteCaf)}</b><span>VERSAMENTI CAF (bollettini${CC.bonifici > 0.004 ? ' + bonifici' : ''})<br>fatture coperte ${fmtEuro(versatoCaf)}${CC.detr > 0.004 ? ' (comprese ' + fmtEuro(CC.detr) + ' di spese sede detratte)' : ''}</span></div>
    <div class="stat c5" data-dett="cassa" style="background:#1d4f91; border-color:#1d4f91; color:#fff"><b>${fmtEuro(CC.cassa)}</b><span style="color:rgba(255,255,255,.92); font-weight:600">SOLDI IN CASSA<br>incasso − versamenti CAF − spese sede<br>💶 contanti ${fmtEuro(CC.d.contanti)} · 🏦 banca ${fmtEuro(CC.d.banca)}</span></div>
    ${vedeGuadagni() ? `<div class="stat c5" data-dett="spese" style="background:#b35f0c; border-color:#b35f0c; color:#fff"><b>${fmtEuro(CC.speseTutte)}</b><span style="color:rgba(255,255,255,.92); font-weight:600">SPESE SEDE${CC.detr > 0.004 ? '<br>di cui ' + fmtEuro(CC.detr) + ' detratte al CAF' : ''}</span></div>${typeof debitoAngelo === 'function' && debitoAngelo().totale ? `<div class="stat c5" data-dett="angelo" style="background:#8e5bd6; border-color:#8e5bd6; color:#fff"><b>${fmtEuro(debitoAngelo().totale)}</b><span style="color:rgba(255,255,255,.92); font-weight:600">DA RESTITUIRE AD ANGELO</span></div>` : ''}<div class="stat c5 gray" data-dett="guadagno"><b>${fmtEuro(differenzaIncFatt)}</b><span>GUADAGNO NETTO<br>incasso − fatture − spese sede non detratte al CAF</span></div>` : ''}` : '') + ((vPrat || vEco) ? '</div>' : '') + (vBlocchi ? `
    ${bloccoIntroito('SOLO 730', '#1d4f91', pratC.filter(e730Conta), true, 'GUADAGNO NETTO 730')}
    ${bloccoIntroito('ALTRE PRATICHE (IMU, ISEE, contratti di affitto, colf e badanti)', '#0e8a8a', pratC.filter(eAltraConta), false, 'GUADAGNO NETTO ALTRE PRATICHE')}
    ${bloccoRinunce(pratCont, annoSel)}
    ${vedeGuadagni() ? sommaGuadagniHTML(pratCont) : ''}` : '') + (vEco && vBlocchi && vedeGuadagni() ? riepilogoGuadagno(pratCont, versatoCaf, speseSede) : '');
  if(typeof renderSpese === 'function') renderSpese();

  if(typeof renderVersamentiCaf === 'function') renderVersamentiCaf(versAnno, versatoCaf);

  const raff = document.getElementById('raffronto');
  if(!document.getElementById('ch-stati')){
    raff.innerHTML = `
      <div class="raff-title">Andamento pratiche e incassi</div>
      <div class="charts">
        <div><div class="chart-cap">Pratiche per stato</div><div class="chart-wrap"><canvas id="ch-stati"></canvas></div></div>
        <div><div class="chart-cap">Fatture emesse e Incasso</div><div class="chart-wrap"><canvas id="ch-eur"></canvas></div></div>
      </div>
      <div class="raff-diff" id="raff-diff"></div>
      <div id="box-ch-tipi" style="margin-top:14px"><div class="chart-cap">Fatture emesse, incasso e guadagno netto per tipo di pratica</div><div class="chart-wrap"><canvas id="ch-tipi"></canvas></div></div>
      <div id="raff-tipi" style="margin-top:14px"></div>`;
  }
  { const br = document.getElementById('btn-resoconto'); if(br) br.style.display = (auth.profilo && auth.profilo.ruolo === 'admin') ? 'inline-flex' : 'none'; }
  document.getElementById('raff-diff').textContent = vedeGuadagni() ? 'Guadagno netto (incasso totale − fatture emesse − spese sede): ' + fmtEuro(incassoLordo - fattureEmesse - speseSede) : '';
  aggiornaGrafici(fattureEmesse, incassoLordo);
  aggiornaGraficoTipi(pratC);
  document.getElementById('raff-tipi').innerHTML = riepilogoPerTipo(pratC) + riepilogoPerPagamento(pratC);
  if(typeof renderElencoFPS === 'function') renderElencoFPS(pratAnno);
  if(typeof renderSituazioneData === 'function') renderSituazioneData();
  if(typeof renderRicercaFatture === 'function') renderRicercaFatture();
  if(typeof aggiornaPulsanteCUD === 'function'){ aggiornaPulsanteCUD(); if(document.getElementById('richieste-cud')) disegnaRichiesteCUD(); }

  const tab = document.getElementById('tabella');
  const annAnno = (state.annullate||[]).filter(function(p){ return annoPratica(p) === annoSel; });
  const ordinate = filtra([...pratAnno].sort((a,b)=> a.numero - b.numero)).filter(vediNelRegistro);
  aggiornaTastoConsegnate(pratAnno);
  disegnaChipStati(pratAnno);
  // le annullate compaiono nel registro (barrate) solo senza filtro per stato
  const statoFiltro = (document.getElementById('filtro-stato')||{}).value || '';
  // (e senza filtri CISL / e-mail, né guardando solo le consegnate)
  if(!statoFiltro && !FILTRO_CISL && !FILTRO_TIPO && !FILTRO_RIF && !SOLO_DA_FARE && !SOLO_VIA_EMAIL && !filtroFatturaAttivo() && modoArchivio() !== 'consegnate'){
    const cliA = filtroContribuente(), kA = chiaveRicerca(cliA);
    filtraTesto(annAnno).filter(function(p){ return !cliA || chiaveRicerca([p.nome, p.congiunta, p.codiceFiscale].join(' ')).indexOf(kA) >= 0; }).forEach(function(p){ ordinate.push(p); });
    ordinate.sort((a,b)=> a.numero - b.numero);
  }
  // solo da fare: dalla più vecchia alla più nuova
  if(SOLO_DA_FARE && typeof giorniDaApertura === 'function') ordinate.sort(function(a, b){ return (giorniDaApertura(b) - giorniDaApertura(a)) || (a.numero - b.numero); });
  const rigaRegistro = (p) => p.annullata ? rigaAnnullataHTML(p) : `
            <tr>
              <td class="n">${formattaProtocollo(p)}</td>
              <td>${p.data||'-'}${SOLO_DA_FARE && typeof giorniDaApertura === 'function' ? (function(){ const g = giorniDaApertura(p); return '<div class="sub2" style="font-weight:800; color:' + (g > GIORNI_PRATICA_FERMA ? '#c0392b' : 'var(--sub)') + '">da ' + g + ' gg</div>'; })() : ''}</td>
              <td>${eColf(p.tipo) ? (p.scadenzaAssistenza ? '<span title="Scadenza assistenza" style="color:#c0392b; font-weight:700">⏰ '+esc(p.scadenzaAssistenza)+'</span>' : '-') : (esc(p.dataFine)||'-')}</td>
              <td class="wrap">${(p.nome||'-').toUpperCase()}${p.iscrittoCisl ? ' <span title="Iscritto CISL" style="display:inline-block; background:#c0392b; color:#fff; border-radius:999px; padding:1px 7px; font-size:11px; font-weight:700">👤 CISL</span>' : ''}${p.viaEmail ? ' <span title="Pratica pervenuta via e-mail" style="display:inline-block; background:#1d4f91; color:#fff; border-radius:999px; padding:1px 7px; font-size:11px; font-weight:700">📧 e-mail</span>' : ''}${p.congiunta ? '<div class="sub2">Congiunta: '+esc(p.congiunta)+'</div>' : ''}${typeof segnaliDocumentiHTML === 'function' ? segnaliDocumentiHTML(p) : ''}</td>
              <td class="wrap">${p.tipo ? esc(p.tipo) + (eAltrePratiche(p.tipo) && p.descrizioneTipo ? '<div class="sub2">' + esc(p.descrizioneTipo) + '</div>' : '') + (p.stato === 'pratica_cessata' && p.cessazioneMotivo ? '<div class="sub2" title="' + esc(p.cessazioneMotivo) + '">⚫ ' + esc(p.cessazioneMotivo) + (p.cessazioneData ? ' (' + esc(p.cessazioneData) + ')' : '') + '</div>' : '') : '-'}</td>
              <td><select class="stato-tab-sel" style="border-left:6px solid ${(STATI[p.stato]||{}).c||'#8a8f98'}" onchange="cambiaStato('${p.id}', this.value)">${statoOptions(p.stato, p.tipo)}</select></td>
              <td>${formattaInserimento(p)}${ultimaModifica(p) ? '<div class="sub2" title="Ultima modifica">✏️ ' + ultimaModifica(p) + '</div>' : ''}</td>
              <td>${bottoneAvanti(p)} ${bottoneConsegna(p)} <button type="button" style="background:var(--accent); color:var(--accent-ink); border:none; border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer" onclick="apriPraticaDaTabella('${p.id}')">Apri</button> ${bottoneWhatsApp(p, 'border:none; border-radius:6px; padding:5px 8px; font-size:12px; cursor:pointer', true)} <button type="button" title="Ricevuta da consegnare al cliente" style="background:var(--line); color:var(--ink); border:none; border-radius:6px; padding:5px 8px; font-size:12px; cursor:pointer" onclick="stampaRicevuta('${p.id}')">🧾</button></td>
            </tr>`;
  // Due registri con numerazioni separate: 730 e altre pratiche (AP)
  // registro vuoto: si indica dove sono le pratiche (consegnate nascoste, o un altro anno)
  const suggerimentoRegistroVuoto = function(serie, ciSono){
    const diSerie = function(p){ return serie === '730' ? serieDi(p) === '730' : serieDi(p) !== '730'; };
    const tasto = function(onclick, testo){ return ' <button type="button" onclick="' + onclick + '" style="margin-left:6px; padding:5px 12px; border:none; border-radius:999px; background:#1d4f91; color:#fff; font-weight:800; cursor:pointer">' + testo + '</button>'; };
    if(ciSono){
      const nCons = pratAnno.filter(function(p){ return diSerie(p) && eConsegnata(p); }).length;
      return (modoArchivio() === 'aperte' && nCons && !ricercaAttiva() && !((document.getElementById('filtro-stato')||{}).value) && !FILTRO_CISL && !FILTRO_TIPO && !FILTRO_RIF && !SOLO_DA_FARE && !SOLO_VIA_EMAIL && !filtroFatturaAttivo())
        ? '<div style="margin-top:6px">Ci sono <b>' + nCons + '</b> pratiche già consegnate / definite.' + tasto("impostaArchivio('consegnate')", '📦 Vedi le consegnate') + '</div>' : '';
    }
    const altri = {};
    (state.pratiche || []).forEach(function(p){ const a = annoPratica(p); if(a !== annoSel && diSerie(p)) altri[a] = (altri[a] || 0) + 1; });
    const anni = Object.keys(altri).map(Number).sort(function(a, b){ return b - a; });
    return anni.length ? '<div style="margin-top:6px">Le pratiche sono in un altro anno:' + anni.slice(0, 3).map(function(a){ return tasto('cambiaAnnoAttivo(' + a + ')', '📅 ' + a + ' (' + altri[a] + ')'); }).join('') + '</div>' : '';
  };
  const tabellaRegistro = function(titolo, colore, lista, totale, serie){
    const nVis = lista.filter(function(p){ return !p.annullata; }).length;
    return `<div class="raff-title" style="margin-top:14px; color:${colore}">${titolo} <span style="color:var(--sub); font-weight:600">(${nVis === totale ? totale : 'ne vedi ' + nVis + ' su ' + totale})</span></div>
    <div class="tab-wrap">
      <table class="tab-proto tab-registro">
        <thead><tr><th>N.</th><th>Apertura</th><th>Fine lav.</th><th>Mittente</th><th>Tipo</th><th>Stato</th><th>Inserito da</th><th></th></tr></thead>
        <tbody>
          ${lista.length ? lista.map(rigaRegistro).join('') : '<tr><td colspan="8" class="empty">'+(totale ? 'Nessun risultato' + suggerimentoRegistroVuoto(serie, true) : 'Nessuna registrazione per l\'anno '+annoSel + suggerimentoRegistroVuoto(serie, false))+'</td></tr>'}
        </tbody>
      </table>
    </div>`;
  };
  const di730 = ordinate.filter(function(p){ return serieDi(p) === '730'; }), diAP = ordinate.filter(function(p){ return serieDi(p) !== '730'; });
  tab.innerHTML = (typeof avvisoRitiriHTML === 'function' ? avvisoRitiriHTML(pratAnno) : '')
    + tabellaRegistro('📘 Registro di protocollo 730', '#1d4f91', di730, pratAnno.filter(function(p){ return serieDi(p) === '730'; }).length, '730')
    + tabellaRegistro('📗 Registro di protocollo altre pratiche (AP)', '#2f9e5f', diAP, pratAnno.filter(function(p){ return serieDi(p) !== '730'; }).length, 'AP');


  const sorted = [...pratAnno].sort((a,b)=> b.numero - a.numero);
  const cardHTML = (p) => `
    <div class="item" id="pratica-${p.id}">
      <div class="item-top">
        <div>
          <div class="num">#${formattaProtocollo(p)} — ${(p.nome||'(senza nome)').toUpperCase()}${p.viaEmail ? ' <span style="display:inline-block; background:#1d4f91; color:#fff; border-radius:999px; padding:1px 8px; font-size:12px; font-weight:700; vertical-align:middle">📧 pervenuta via e-mail</span>' : ''}${p.iscrittoCisl ? ' <span style="display:inline-block; background:#c0392b; color:#fff; border-radius:999px; padding:1px 8px; font-size:12px; font-weight:700; vertical-align:middle">👤 Iscritto CISL</span>' : ''}</div>
          <div class="name">${esc(tipoConDescrizione(p))} ${p.cf ? '· nato il '+p.cf : ''}</div>
          ${p.congiunta ? `<div class="name">Congiunta con <b>${esc(p.congiunta)}</b>${p.congData ? ' (nato il '+esc(p.congData)+')' : ''}${p.congCodiceFiscale ? ' · CF '+esc(p.congCodiceFiscale) : ''}${p.congTelefono ? ' · Cell. <a href="tel:'+esc(p.congTelefono)+'" style="color:inherit">'+esc(p.congTelefono)+'</a>' : ''}${p.congEmail ? ' · ✉️ <a href="mailto:'+esc(p.congEmail)+'" style="color:inherit">'+esc(p.congEmail)+'</a>' : ''}</div>` : ''}
          ${p.telefono ? `<div class="name">Cell. <a href="tel:${esc(p.telefono)}" style="color:inherit">${esc(p.telefono)}</a></div>` : ''}
          ${p.email ? `<div class="name">📧 <a href="mailto:${esc(p.email)}" style="color:inherit">${esc(p.email)}</a></div>` : ''}
          ${p.telefonoFisso ? `<div class="name">Tel. fisso <a href="tel:${esc(p.telefonoFisso)}" style="color:inherit">${esc(p.telefonoFisso)}</a></div>` : ''}
        </div>
        <div class="badges">
          <span class="badge stato">${pallino(p.stato)}${statoLabel(p.stato)}</span>
        </div>
      </div>
      <div class="meta">Aperta il ${p.data||'-'}${eColf(p.tipo) ? (p.scadenzaAssistenza ? ' · <b style="color:#c0392b">⏰ Scadenza assistenza il '+esc(p.scadenzaAssistenza)+'</b>' : '') : (p.dataFine ? ' · <b>Fine lavorazione il '+esc(p.dataFine)+'</b>' : '')} ${p.stato === 'pratica_cessata' && p.cessazioneMotivo ? '· <b style="color:#374151">⚫ Cessata' + (p.cessazioneData ? ' il ' + esc(p.cessazioneData) : '') + ': ' + esc(p.cessazioneMotivo) + '</b> <button type="button" onclick="modificaCessazione(\'' + p.id + '\')" style="padding:1px 8px; font-size:11px">✏️</button> ' : ''}${p.riferimento ? '· <b style="color:#6d3fa0">👤 rif. '+esc(p.riferimento)+'</b> ' : ''}${p.note ? '· '+esc(p.note) : ''}</div>
      <div class="meta compenso">Fattura: ${fmtEuro(p.compenso)} · Pagato effettivo: ${fmtEuro(p.pagato)}${p.metodoPagamento ? ' (' + esc(p.metodoPagamento) + ')' : ''}</div>
      ${typeof documentoCardHTML === 'function' ? documentoCardHTML(p) : ''}
      ${typeof continuazioneCardHTML === 'function' ? continuazioneCardHTML(p) : ''}
      ${typeof affittoCardHTML === 'function' ? affittoCardHTML(p) : ''}
      ${typeof lavoratoreCardHTML === 'function' ? lavoratoreCardHTML(p) : ''}
      ${typeof documentiCardHTML === 'function' ? documentiCardHTML(p) : ''}
      ${storicoClienteHTML(p)}
      ${p.numFattura || p.dataFattura ? `<div class="meta">Fattura${p.numFattura ? ' n. ' + esc(p.numFattura) : ''}${p.dataFattura ? ' del ' + esc(p.dataFattura) : ''}</div>` : ''}
      ${p.emailInviata ? `<div class="meta" style="color:#1d4f91">📧 E-mail inviata: ${esc(p.emailInviata)}</div>` : ''}
      ${ultimaModifica(p) ? `<div class="meta" style="color:var(--sub)">✏️ Ultima modifica: <b>${ultimaModifica(p)}</b></div>` : ''}
      ${p.whatsappInviato ? `<div class="meta" style="color:#1a9e4b">💬 Avvisato su WhatsApp il ${esc(p.whatsappInviato)}</div>` : ''}
      <div class="meta">${(Number(p.compenso||0) || Number(p.richiesto||0) || Number(p.pagato||0)) ? `<span style="font-weight:700">💶 Fattura ${Number(p.compenso||0) ? fmtEuro(p.compenso) : '-'}${praticaContabile(p)._fattAttesa ? ' <span style="color:#b35f0c">(⏳ in attesa di consegna: non ancora in contabilità)</span>' : ''} · Richiesto ${Number(p.richiesto||0) ? fmtEuro(p.richiesto) : '-'} · Pagato ${Number(p.pagato||0) ? fmtEuro(p.pagato) : '-'}${typeof residuoPratica === 'function' && residuoPratica(p) > 0.004 ? ' · <span style="color:#c0392b">manca ' + fmtEuro(residuoPratica(p)) + '</span>' : ''}</span> ` : ''}${bottoneAvanti(p)} ${p.consegnataIl ? `<span style="color:#8d5a3b; font-weight:700">${parolaConsegna(p).icona} ${parolaConsegna(p).fatta} il ${esc(p.consegnataIl)}${p.consegnataDa ? ' da ' + esc(p.consegnataDa) : ''}</span> ` : ''}${bottoneConsegna(p)}</div>
      ${p._editing ? `
        <div class="grid" style="margin-top:8px">
          <div><label>Cognome</label><input id="e-cognome-${p.id}" value="${esc(dividiNominativo(p).cognome)}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
          <div><label>Nome</label><input id="e-nomeproprio-${p.id}" value="${esc(dividiNominativo(p).nome)}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
          <div class="full" id="e-congwrap-${p.id}" style="${tipoAmmetteCongiunta(p.tipo) || p.congiunta ? '' : 'display:none'}"><label class="chk"><input type="checkbox" id="e-congon-${p.id}" ${p.congiunta ? 'checked' : ''} onchange="(function(){var on=document.getElementById('e-congon-${p.id}').checked; document.getElementById('e-congbox-${p.id}').style.display = on?'':'none';})()"> Congiunta</label>
            <div id="e-congbox-${p.id}" class="grid" style="${p.congiunta ? '' : 'display:none; '}margin-top:6px">
              <div><label>Cognome</label><input id="e-congcognome-${p.id}" value="${esc(p.congCognome)}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
              <div><label>Nome</label><input id="e-congnome-${p.id}" value="${esc(p.congNome)}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
              <div><label>Data di nascita</label><input id="e-congdata-${p.id}" value="${esc(p.congData)}" placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"></div>
              <div><label>Codice fiscale coniuge</label><input id="e-congcf-${p.id}" value="${esc(p.congCodiceFiscale)}" maxlength="16" style="text-transform:uppercase; font-family:monospace" oninput="this.value=normalizzaCF(this.value)"></div>
              <div><label>Cellulare coniuge</label><input id="e-congtel-${p.id}" type="tel" inputmode="tel" value="${esc(p.congTelefono)}"></div>
              <div><label>E-mail coniuge</label><input id="e-congemail-${p.id}" type="email" inputmode="email" placeholder="Facoltativa" value="${esc(p.congEmail||'')}" style="text-transform:lowercase" oninput="this.value=this.value.toLowerCase()"></div>
              <div><label>Scadenza documento coniuge</label><input id="e-congdocscad-${p.id}" value="${esc(p.congDocumentoScadenza||'')}" inputmode="numeric" placeholder="GG/MM/AAAA" oninput="autoSlashData(this)"></div>
              <div><label>N. documento coniuge</label><input id="e-congdocnum-${p.id}" value="${esc(p.congDocumentoNumero||'')}" style="text-transform:uppercase; font-family:monospace"></div>
              <div><label>Tipo documento coniuge</label><select id="e-congdoctipo-${p.id}">${opzioniTipoDoc(p.congDocumentoTipo)}</select></div>
            </div>
          </div>
          <div><label>Cellulare *</label><input id="e-tel-${p.id}" type="tel" inputmode="tel" value="${esc(p.telefono)}"></div>
          <div><label>Telefono fisso *</label><input id="e-telfisso-${p.id}" type="tel" inputmode="tel" value="${esc(p.telefonoFisso)}"></div>
          <div><label>📧 E-mail</label><input id="e-email-${p.id}" type="email" inputmode="email" value="${esc(p.email)}" style="text-transform:lowercase"></div>
          <div><label>Data di nascita</label><input id="e-cf-${p.id}" value="${esc(p.cf)}" inputmode="numeric" placeholder="GG/MM/AAAA" oninput="autoSlashData(this)"></div>
          <div><label>Scadenza documento</label><input id="e-docscad-${p.id}" value="${esc(p.documentoScadenza)}" inputmode="numeric" placeholder="GG/MM/AAAA" oninput="autoSlashData(this)"></div>
          <div><label>N. documento</label><input id="e-docnum-${p.id}" value="${esc(p.documentoNumero||'')}" style="text-transform:uppercase; font-family:monospace"></div>
          <div><label>Tipo documento</label><select id="e-doctipo-${p.id}">${opzioniTipoDoc(p.documentoTipo)}</select></div>
          <div><label>Tipo pratica</label><select id="e-tipo-${p.id}" onchange="aggiornaCongiuntaEdit('${p.id}', this.value); if(typeof mostraLavoratoreEdit === 'function') mostraLavoratoreEdit('${p.id}', this.value); if(typeof mostraAffittoEdit === 'function') mostraAffittoEdit('${p.id}', this.value); document.getElementById('e-desctipo-box-${p.id}').style.display = eAltrePratiche(this.value) ? '' : 'none'; document.getElementById('e-scadass-box-${p.id}').style.display = eColf(this.value) ? '' : 'none'; applicaFatturaAutomatica(this.value, 'e-comp-${p.id}')">${tipoOptions(p.tipo)}</select></div>
          <div id="e-desctipo-box-${p.id}" style="${eAltrePratiche(p.tipo) ? '' : 'display:none'}"><label>Descrizione della pratica *</label><input id="e-desctipo-${p.id}" value="${esc(p.descrizioneTipo)}" maxlength="120"></div>
          <div id="e-scadass-box-${p.id}" style="${eColf(p.tipo) ? '' : 'display:none'}"><label>Scadenza assistenza</label><input id="e-scadass-${p.id}" value="${esc(p.scadenzaAssistenza)}" inputmode="numeric" placeholder="GG/MM/AAAA" oninput="autoSlashData(this)"></div>
          ${typeof lavoratoreEditHTML === 'function' ? lavoratoreEditHTML(p) : ''}
          ${typeof affittoEditHTML === 'function' ? affittoEditHTML(p) : ''}
          <div><label>Fattura (€)</label><input id="e-comp-${p.id}" type="text" inputmode="decimal" placeholder="0,00" value="${importoInCampo(p.compenso)}" oninput="filtraImporto(this)" onblur="formattaCampoImporto(this)"></div>
          <div><label title="Solo promemoria: non entra in contabilità">Pagamento richiesto (€)</label><input id="e-ric-${p.id}" type="text" inputmode="decimal" placeholder="0,00" value="${importoInCampo(p.richiesto)}" oninput="filtraImporto(this)" onblur="formattaCampoImporto(this)"></div><div class="full" id="e-ric-cisl-${p.id}" style="${p.iscrittoCisl ? '' : 'display:none'}">${typeof selectPrezziCisl === 'function' ? selectPrezziCisl('e-ric-' + p.id, 'e-comp-' + p.id) : ''}</div>
          <div><label>Pagato effettivo (€)</label><div style="display:flex; gap:6px"><input id="e-pag-${p.id}" type="text" inputmode="decimal" placeholder="0,00" value="${importoInCampo(p.pagato)}" oninput="filtraImporto(this)" onblur="formattaCampoImporto(this)" style="flex:1; min-width:0"><select id="e-met-${p.id}" title="Tipo di pagamento" style="width:auto; flex:0 0 auto">${metodoOptions(p.metodoPagamento)}</select></div></div>
          <div><label>Numero fattura</label><input id="e-nf-${p.id}" value="${esc(p.numFattura)}" oninput="var d=document.getElementById('e-df-${p.id}'); if(this.value.trim() && d && !d.value.trim()) d.value=todayIT();"></div>
          <div><label>Data fattura</label><input id="e-df-${p.id}" value="${esc(p.dataFattura)}" placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"></div>
          <div class="full"><label>👤 Riferimento (chi ha portato il cliente)</label><input id="e-rif-${p.id}" list="lista-nomi-archivio" onfocus="preparaNomiRiferimento()" value="${esc(p.riferimento || '')}" placeholder="Facoltativo: cognome e nome" style="text-transform:uppercase"></div>
          <div class="full"><label>Note</label><input id="e-note-${p.id}" value="${esc(p.note)}">
            <label class="chk" style="margin-top:6px; display:inline-flex; align-items:center; gap:6px; font-weight:700; color:#1d4f91"><input type="checkbox" id="e-viaemail-${p.id}" ${p.viaEmail ? 'checked' : ''} style="width:auto; margin:0"> 📧 Pratica pervenuta via e-mail</label>
            <label class="chk" style="margin-top:6px; margin-left:12px; display:inline-flex; align-items:center; gap:6px; font-weight:700; color:#c0392b"><input type="checkbox" id="e-cisl-${p.id}" ${p.iscrittoCisl ? 'checked' : ''} onchange="var b=document.getElementById('e-ric-cisl-${p.id}'); if(b) b.style.display=this.checked?'':'none'" style="width:auto; margin:0"> 👤 Iscritto CISL</label></div>
        </div>
        <div class="row-actions">
          <button onclick="salvaModifica('${p.id}')" style="background:var(--accent); color:var(--accent-ink)">Salva modifica</button>
          <button onclick="annullaModifica('${p.id}')">Annulla</button>
        </div>
      ` : `
      <div class="row-actions" style="align-items:center">
        <select class="stato-tab-sel" onchange="cambiaStato('${p.id}', this.value)">${statoOptions(p.stato, p.tipo)}</select>
        ${bottoneWhatsApp(p)}
        <button onclick="modifica('${p.id}')">✏️ Modifica</button>
      </div>
      <div class="row-actions" style="align-items:center; padding-top:6px; border-top:1px dashed var(--line)">
        <span style="font-size:11.5px; font-weight:800; color:var(--sub)">🖨️ Stampe:</span>
        <button onclick="stampaRicevuta('${p.id}')" title="Ricevuta di presa in carico da consegnare al cliente">🧾 Presa in carico</button>
        ${eConsegnata(p) ? `<button onclick="stampaRicevutaConsegna('${p.id}')" title="Ricevuta di consegna da far firmare a chi ritira la pratica" style="background:#8d5a3b; color:#fff">📦 Ricevuta consegna</button>` : ''}
        ${e730(p) && Number(p.pagato||0) > 0 ? `<button onclick="stampaRicevutaPagamento('${p.id}')" title="Ricevuta di pagamento da dare al cliente quando la chiede" style="background:${p.ricevutaUfficiale ? '#1a7f37' : 'var(--line)'}; color:${p.ricevutaUfficiale ? '#fff' : 'var(--ink)'}">💶 Ricevuta pagamento${p.ricevutaUfficiale ? ' ⭐' : ''}</button>` : ''}
        <button onclick="emailRicevuta('${p.id}')" title="Invia la ricevuta al cliente per e-mail" style="background:#1d4f91; color:#fff">📧 Ricevuta</button>
        ${typeof bottoniPrivacyHTML === 'function' ? bottoniPrivacyHTML(p) : ''}
      </div>
      <div class="row-actions" style="justify-content:flex-end; margin-top:10px">
        <button onclick="annullaPratica('${p.id}')" title="La pratica resta nel registro con il suo numero, segnata ANNULLATA" style="background:none; color:#c0392b; border:1px solid #c0392b; font-size:12px; padding:5px 10px">🚫 Annulla pratica</button>
      </div>
      `}
    </div>
  `;
  // i riquadri non seguono «Solo da fare» (è una vista del registro): contano tutte le pratiche del tipo
  const visibili = filtra(sorted, { dafare: true });
  const inRicerca = ((document.getElementById('cerca')||{}).value||'').trim() !== '' || !!filtroContribuente();
  // con un filtro del registro acceso i riquadri contano solo le pratiche filtrate: si dice chiaramente
  const filtriRiq = [];
  { const st = (document.getElementById('filtro-stato')||{}).value || ''; if(st) filtriRiq.push('stato ' + statoLabel(st)); }
  if(FILTRO_CISL) filtriRiq.push('CISL'); if(FILTRO_TIPO) filtriRiq.push('tipo ' + FILTRO_TIPO); if(FILTRO_RIF) filtriRiq.push('riferimento ' + FILTRO_RIF);
  if(SOLO_VIA_EMAIL) filtriRiq.push('via e-mail'); if(filtroFatturaAttivo()) filtriRiq.push('importo fattura'); if(inRicerca) filtriRiq.push('ricerca');
  const avvisoFiltri = filtriRiq.length ? '<div style="grid-column:1/-1; margin:0 0 10px; padding:8px 12px; border-radius:10px; border:2px solid #b35f0c; background:color-mix(in srgb, #b35f0c 8%, var(--card)); font-size:13px; display:flex; gap:8px; flex-wrap:wrap; align-items:center"><span style="flex:1 1 260px">⚠️ <b>Filtri del registro accesi</b> (' + esc(filtriRiq.join(', ')) + '): i riquadri contano solo le pratiche filtrate.</span><button type="button" onclick="azzeraFiltriRegistro()" style="background:#b35f0c; color:#fff; border:none; border-radius:999px; padding:5px 12px; font-weight:700; cursor:pointer">✕ Togli i filtri</button></div>' : '';
  const nomiGruppi = getTipiList().slice();
  visibili.forEach(function(p){ const k = p.tipo || 'SENZA TIPO'; if(nomiGruppi.indexOf(k) < 0) nomiGruppi.push(k); });
  const TOT_RIQ = { n: 0, fe: 0, inc: 0, acc: 0, g: 0 }, TOT_730 = { n: 0, fe: 0, inc: 0, acc: 0, g: 0, tipi: 0 };
  list.innerHTML = avvisoFiltri + nomiGruppi.map(function(k){
    const tuttiTipo = visibili.filter(function(p){ return (p.tipo || 'SENZA TIPO') === k; });
    if(inRicerca && !tuttiTipo.length) return '';
    // stato scelto dentro questo riquadro (oltre al filtro generale del registro)
    const statoGr = STATO_GRUPPO[k] || '';
    const items = statoGr ? tuttiTipo.filter(function(p){ return p.stato === statoGr; }) : tuttiTipo;
    // fatture di pratiche annullate di questo tipo senza nota di credito (restano tra le fatture)
    const annK = (inRicerca || statoGr || typeof fattureAnnullateAperte !== 'function') ? [] : fattureAnnullateAperte(annoAttivo()).filter(function(p){ return (p.tipo || 'SENZA TIPO') === k; });
    const feAnn = annK.reduce(function(a,p){ return a + Number(p.compenso||0); }, 0);
    const fe = praticheContabili(items).reduce(function(a,p){ return a + Number(p.compenso||0); }, 0) + feAnn;
    const feAtt = totaleFattureInAttesa(items);
    const inc = items.reduce(function(a,p){ return a + Number(p.pagato||0); }, 0);
    const accK = inRicerca ? 0 : totaleAcconti(annoAttivo(), function(t){ return t === k; });
    // guadagno del tipo: come in Contabilità (incasso − fatture delle pratiche che contano, più le fatture annullate da stornare)
    const gK = praticheContabili(items).concat(annK).reduce(function(a,p){ return a + Number(p.pagato||0) - Number(p.compenso||0); }, 0);
    TOT_RIQ.n += sommaPeso(items.filter(function(p){ return !eRinuncia(p); })); TOT_RIQ.fe += fe; TOT_RIQ.inc += inc; TOT_RIQ.acc += accK; TOT_RIQ.g += gK;
    if(e730({ tipo: k })){ TOT_730.n += sommaPeso(items.filter(function(p){ return !eRinuncia(p); })); TOT_730.fe += fe; TOT_730.inc += inc; TOT_730.acc += accK; TOT_730.g += gK; if(items.length) TOT_730.tipi++; }
    const open = aperti[k] === true;
    const col = coloreCollaboratore(k);
    const schedeAperte = aperti[k + '|schede'] === true || items.some(function(p){ return p._editing || p._confirmDelete || p._editingFattura; });
    // aperta una sola pratica dal registro: si mostra solo la sua scheda (le altre con "Mostra tutte")
    const sola = SCHEDA_SOLA[k] && items.find(function(p){ return p.id === SCHEDA_SOLA[k]; });
    const schede = sola ? [sola] : items.filter(vediNelGruppo(statoGr));
    return '<details class="grp" data-k="' + esc(k) + '" style="--gc:' + col + '" ' + (open ? 'open' : '') + ' ontoggle="gToggle(this)">'
      + '<summary style="background:' + col + '; background-image:none"><span class="grp-name">' + esc(k) + '</span><span class="grp-n">' + sommaPeso(items) + '</span>' + (items.filter(eContinuazione).length ? '<span class="grp-n" title="Contratti in continuazione dagli anni prima o rinnovati: non contano tra le pratiche nuove" style="background:#1f8a70; color:#fff">🔁 ' + items.filter(eContinuazione).length + ' in continuazione</span>' : '')
      + ('<span class="grp-soldi">Fatture ' + fmtEuro(fe) + (feAnn ? '<br><small>di cui ' + fmtEuro(feAnn) + ' annullate</small>' : '') + (feAtt ? '<br><small>⏳ in attesa ' + fmtEuro(feAtt) + '</small>' : '') + '<br>Incasso ' + fmtEuro(inc) + (accK ? '<br>Pagamenti ' + fmtEuro(accK) : '') + (vedeGuadagni() && (fe || inc) ? '<br><b>Guadagno ' + fmtEuro(gK) + '</b>' : '') + '</span>') + '</summary>'
      + '<div class="grp-b">' + filtroStatoGruppoHTML(k, tuttiTipo) + contabilitaCollaboratoreHTML(k, items, gK) + tabellaPraticheGruppoHTML(items.filter(vediNelGruppo(statoGr)), k)
      + (items.length ? '<details class="grp-schede" data-k="' + esc(k) + '|schede" ' + (schedeAperte ? 'open' : '') + ' ontoggle="aperti[this.dataset.k]=this.open; if(!this.open) delete SCHEDA_SOLA[this.dataset.k.replace(/\|schede$/, \'\')]" style="margin-top:10px"><summary style="cursor:pointer; font-weight:700; color:var(--sub); padding:6px 0">📋 ' + (sola ? 'Scheda della pratica ' + esc(formattaProtocollo(sola)) + ' – ' + esc(sola.nome || '') : 'Schede complete delle pratiche (' + items.length + ')') + ' – per modificare, ricevuta, WhatsApp…</summary>'
        + (sola && items.length > 1 ? '<button type="button" onclick="mostraTutteSchede(this.dataset.k)" data-k="' + esc(k) + '" style="margin:0 0 8px; padding:5px 14px; border-radius:999px; border:1px dashed var(--sub); background:none; color:var(--sub); font-weight:700; cursor:pointer">📋 Mostra tutte le schede del gruppo (' + items.length + ')</button>' : '')
        + schede.map(cardHTML).join('') + '</details>' : '') + '</div></details>';
  }).join('') + totale730RiquadriHTML(TOT_730, filtriRiq.length > 0) + riepilogoRiquadriHTML(TOT_RIQ, filtriRiq.length > 0, {
    n: conti.tot + sommaPeso(pratAnno.filter(eAltraConta)), fe: fattureEmesse, inc: incassoLordo, acc: totaleAcconti(annoSel, function(){ return true; }),
    g: pratCont.reduce(function(a,p){ return a + Number(p.pagato||0) - Number(p.compenso||0); }, 0), spese: speseSede
  });
}
// 📘 Totale 730: la somma di tutti i riquadri dei 730 (730 SEDE, dei collaboratori, FPS, FILCA…)
function totale730RiquadriHTML(t, conFiltri){
  if(!t.n && !t.fe && !t.inc) return '';
  const voce = function(etichetta, valore, colore){ return '<div style="flex:1 1 140px; padding:8px 10px; border-radius:10px; background:' + colore + '; color:#fff; text-align:center"><div style="font-size:17px; font-weight:800">' + valore + '</div><div style="font-size:10.5px; font-weight:700; text-transform:uppercase">' + etichetta + '</div></div>'; };
  return '<div style="grid-column:1/-1; margin-top:12px; padding:10px 12px; border-radius:12px; border:2px solid #1d4f91; background:var(--card)">'
    + '<b style="font-size:15px; color:#1d4f91">📘 Totale 730 – ' + annoAttivo() + '</b> <span class="sub2">' + (conFiltri ? '(solo le pratiche filtrate)' : '(la somma di tutti i riquadri dei 730' + (t.tipi ? ': ' + t.tipi + ' tipi' : '') + '; la congiunta conta 2)') + '</span>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px">'
    + voce('730 (senza rinunce)', t.n, '#1d4f91')
    + voce('Fatture emesse', fmtEuro(t.fe), '#2f9e5f')
    + voce('Incasso', fmtEuro(t.inc), '#8e5bd6')
    + voce('Pagamenti dei collaboratori', fmtEuro(t.acc), '#0e7c86')
    + voce('Incasso − pagamenti', fmtEuro(t.inc - t.acc), '#374151')
    + (vedeGuadagni() ? voce('💰 Guadagno 730', fmtEuro(t.g), '#c2185b') : '')
    + '</div></div>';
}
// 🧮 Totale di tutti i riquadri, confrontato con la Contabilità generale (devono combaciare)
function riepilogoRiquadriHTML(t, conFiltri, cont){
  const uguale = function(a, b){ return Math.abs(Number(a||0) - Number(b||0)) < 0.005; };
  const voce = function(etichetta, valore, confronto, soldi, colore){
    const ok = conFiltri || uguale(valore, confronto);
    return '<div style="flex:1 1 150px; padding:8px 10px; border-radius:10px; background:' + colore + '; color:#fff; text-align:center"><div style="font-size:17px; font-weight:800">' + (soldi ? fmtEuro(valore) : valore) + '</div><div style="font-size:10.5px; font-weight:700; text-transform:uppercase; opacity:.92">' + etichetta + '</div>'
      + (conFiltri ? '' : '<div style="font-size:11px; margin-top:3px; font-weight:800">' + (ok ? '✓ come in Contabilità' : '⚠️ Contabilità: ' + (soldi ? fmtEuro(confronto) : confronto)) + '</div>') + '</div>';
  };
  return '<div style="grid-column:1/-1; margin-top:12px; padding:10px 12px; border-radius:12px; border:2px dashed #374151; background:var(--card)">'
    + '<b style="font-size:15px">🧮 Totale di tutti i riquadri – ' + annoAttivo() + '</b> <span class="sub2">' + (conFiltri ? '(solo le pratiche filtrate: togli i filtri per il confronto con la Contabilità)' : '(la somma dei singoli tipi: deve combaciare con la Contabilità generale)') + '</span>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px">'
    + voce('Pratiche (senza rinunce)', t.n, cont.n, false, '#1d4f91')
    + voce('Fatture emesse', t.fe, cont.fe, true, '#2f9e5f')
    + voce('Incasso', t.inc, cont.inc, true, '#8e5bd6')
    + voce('Pagamenti dei collaboratori', t.acc, cont.acc, true, '#0e7c86')
    + '<div style="flex:1 1 150px; padding:8px 10px; border-radius:10px; background:#374151; color:#fff; text-align:center"><div style="font-size:17px; font-weight:800">' + fmtEuro(t.inc - t.acc) + '</div><div style="font-size:10.5px; font-weight:700; text-transform:uppercase; opacity:.92">Da incassare (incasso − pagamenti)</div></div>'
    + '</div>'
    // guadagno: somma dei riquadri, meno le spese della sede (che non sono di nessun tipo) = guadagno netto della Contabilità
    + (vedeGuadagni() ? '<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:stretch; margin-top:6px">'
      + voce('💰 Guadagno dei riquadri', t.g, cont.g, true, '#c2185b')
      + '<div style="flex:0 0 auto; align-self:center; font-size:20px; font-weight:800">−</div>'
      + '<div style="flex:1 1 150px; padding:8px 10px; border-radius:10px; background:#b35f0c; color:#fff; text-align:center"><div style="font-size:17px; font-weight:800">' + fmtEuro(cont.spese) + '</div><div style="font-size:10.5px; font-weight:700; text-transform:uppercase; opacity:.92">Spese sede</div></div>'
      + '<div style="flex:0 0 auto; align-self:center; font-size:20px; font-weight:800">=</div>'
      + voce('Guadagno netto', t.g - cont.spese, cont.g - cont.spese, true, '#7a1250')
      + '</div>' : '')
    + '</div>';
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
// Finestra di errore al centro: evidenzia il campo e ci porta il cursore
function popupErroreCampo(titolo, testo, idCampo){
  const vecchio = document.getElementById('popup-errore'); if(vecchio) vecchio.remove();
  const campo = idCampo ? document.getElementById(idCampo) : null;
  if(campo){ campo.style.borderColor = '#c0392b'; campo.style.boxShadow = '0 0 0 3px rgba(192,57,43,.25)'; campo.addEventListener('input', function pulisci(){ campo.style.borderColor = ''; campo.style.boxShadow = ''; campo.removeEventListener('input', pulisci); }); }
  const ov = document.createElement('div');
  ov.id = 'popup-errore';
  ov.style.cssText = 'position:fixed; inset:0; z-index:490; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #c0392b; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:22px 24px; max-width:420px; width:100%; text-align:center">'
    + '<div style="width:60px; height:60px; margin:0 auto 8px; border-radius:50%; background:#c0392b; color:#fff; font-size:34px; line-height:60px">!</div>'
    + '<div style="font-size:20px; font-weight:800; color:#c0392b">' + esc(titolo) + '</div>'
    + '<div style="font-size:14px; margin:8px 0 16px">' + testo + '</div>'
    + '<button type="button" style="background:#c0392b; color:#fff; min-width:110px">OK</button></div>';
  ov.addEventListener('click', function(e){
    if(e.target !== ov && e.target.tagName !== 'BUTTON') return;
    ov.remove();
    if(campo){ campo.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function(){ campo.focus(); }, 300); }
  });
  document.body.appendChild(ov);
  setTimeout(function(){ const b = ov.querySelector('button'); if(b) b.focus(); }, 50);
}
async function addPraticaInterna(){
  const msg = document.getElementById('form-msg');
  // la congiunta esiste solo per i 730: per gli altri tipi si toglie (anche se compilata in automatico dall'archivio)
  if(!tipoAmmetteCongiunta(document.getElementById('f-tipo').value)){ const chk = document.getElementById('f-congiunta-on'); if(chk){ chk.checked = false; toggleCongBox(); } }
  msg.style.display = 'none';
  const cognome = document.getElementById('f-cognome').value.trim().toUpperCase();
  const nomeProprio = document.getElementById('f-nome').value.trim().toUpperCase();
  const nome = (cognome + ' ' + nomeProprio).trim();
  const cf = document.getElementById('f-cf').value.trim();
  const tipo = document.getElementById('f-tipo').value.trim();
  const descrizioneTipo = eAltrePratiche(tipo) ? (document.getElementById('f-desctipo').value || '').trim() : '';
  const compensoScritto = parseImporto(document.getElementById('f-compenso').value);
  const compensoAuto = fatturaAutomatica(document.getElementById('f-tipo').value);
  const compenso = compensoScritto || (compensoAuto !== undefined ? compensoAuto : '');
  const pagato = parseImporto(document.getElementById('f-pagato').value) || '';
  const richiesto = parseImporto((document.getElementById('f-richiesto')||{}).value || '') || '';
  const metodoPagamento = document.getElementById('f-metodo').value;
  const congCognome = document.getElementById('f-cong-cognome').value.trim().toUpperCase();
  const congNome = document.getElementById('f-cong-nome').value.trim().toUpperCase();
  const congData = document.getElementById('f-cong-data').value.trim();
  const congCodiceFiscale = (congCognome || congNome) ? normalizzaCF(document.getElementById('f-cong-cf').value) : '';
  const congTelefono = (congCognome || congNome) ? document.getElementById('f-cong-tel').value.trim() : '';
  const congEmail = (congCognome || congNome) ? ((document.getElementById('f-cong-email')||{}).value || '').trim().toLowerCase() : '';
  const congComuneNascita = (congCognome || congNome) ? (document.getElementById('f-cong-comune')||{value:''}).value.trim().toUpperCase() : '';
  const congDocumentoScadenza = (congCognome || congNome) ? ((document.getElementById('f-cong-doc-scad')||{}).value || '').trim() : '';
  const congDocumentoNumero = (congCognome || congNome) ? ((document.getElementById('f-cong-doc-num')||{}).value || '').trim().toUpperCase() : '';
  const congDocumentoTipo = (congCognome || congNome) ? ((document.getElementById('f-cong-doc-tipo')||{}).value || '').trim() : '';
  const comuneNascita = (document.getElementById('f-comune')||{value:''}).value.trim().toUpperCase();
  const congiunta = [congCognome, congNome].filter(Boolean).join(' ');
  const telefono = document.getElementById('f-tel').value.trim();
  const telefonoFisso = document.getElementById('f-tel-fisso').value.trim();
  const email = document.getElementById('f-email').value.trim().toLowerCase();
  const dataPratica = todayIT();
  const note = document.getElementById('f-note').value.trim();
  const riferimento = ((document.getElementById('f-riferimento') || {}).value || '').trim().toUpperCase();
  const viaEmail = !!(document.getElementById('f-via-email')||{}).checked;
  const iscrittoCisl = !!(document.getElementById('f-iscritto-cisl')||{}).checked;

  if(!nome){
    msg.textContent = '⚠️ Inserisci almeno il cognome del contribuente prima di salvare.';
    msg.style.display = 'block';
    return;
  }
  if(!telefono && !telefonoFisso){
    msg.textContent = '⚠️ Inserisci almeno un numero di telefono: cellulare o telefono fisso.';
    msg.style.display = 'block';
    document.getElementById('f-tel').focus();
    return;
  }
  if(telefono && cellulareSospetto(telefono) && !confirm(cellulareSospetto(telefono) + '\n\nSalvo lo stesso? (Annulla per correggerlo)')){
    document.getElementById('f-tel').focus();
    return;
  }
  if(!email && !((document.getElementById('f-email-no')||{}).checked)){
    popupErroreCampo('E-mail obbligatoria', 'Scrivi l\'<b>e-mail</b> del cliente (es. nome@esempio.it). Se il cliente non ce l\'ha, spunta <b>«Il cliente non ha l\'e-mail»</b>.', 'f-email');
    return;
  }
  if(email && !emailValida(email)){
    popupErroreCampo('E-mail non valida', 'L\'indirizzo <b>' + esc(email) + '</b> non è corretto: controllalo (es. nome@esempio.it).', 'f-email');
    return;
  }
  if(congEmail && !emailValida(congEmail)){
    popupErroreCampo('E-mail del coniuge non valida', 'L\'indirizzo <b>' + esc(congEmail) + '</b> non è corretto: controllalo (es. nome@esempio.it) o lascia vuoto il campo, è facoltativo.', 'f-cong-email');
    return;
  }
  const scadAss = document.getElementById('f-data-fine').value.trim();
  if(eColf(tipo) && scadAss && !parseDataIT(scadAss)){
    msg.textContent = '⚠️ La scadenza assistenza deve essere nel formato GG/MM/AAAA.';
    msg.style.display = 'block';
    return;
  }
  const documentoScadenza = document.getElementById('f-doc-scad').value.trim();
  const documentoNumero = ((document.getElementById('f-doc-num')||{}).value || '').trim().toUpperCase();
  const documentoTipo = ((document.getElementById('f-doc-tipo')||{}).value || '').trim();
  if(congDocumentoScadenza && !parseDataIT(congDocumentoScadenza)){
    msg.textContent = '⚠️ La scadenza del documento del coniuge deve essere nel formato GG/MM/AAAA.';
    msg.style.display = 'block';
    return;
  }
  if(documentoScadenza && !parseDataIT(documentoScadenza)){
    msg.textContent = '⚠️ La scadenza del documento deve essere nel formato GG/MM/AAAA.';
    msg.style.display = 'block';
    return;
  }
  const documenti = documentiDalModulo();
  if(documenti.mancanti.length && (document.getElementById('f-stato').value || 'arrivo') !== 'arrivo'){
    pickChip('f-stato-btns','f-stato','arrivo');
  }
  if(eAltrePratiche(tipo) && !descrizioneTipo){
    popupErroreCampo('Descrizione della pratica', 'Hai scelto <b>ALTRE PRATICHE</b>: scrivi di che pratica si tratta nella casella <b>Descrizione della pratica</b>.', 'f-desctipo');
    return;
  }
  const codiceFiscale = document.getElementById('f-codfisc').value.trim();
  if(!codiceFiscale){
    popupErroreCampo('Codice fiscale obbligatorio', 'Per salvare la pratica inserisci il <b>codice fiscale</b> del contribuente (puoi anche leggerlo con "📄 Leggi documento").', 'f-codfisc');
    return;
  }
  if(!cfValido(codiceFiscale)){
    popupErroreCampo('Codice fiscale non valido', 'Il codice fiscale <b>' + esc(codiceFiscale) + '</b> non è corretto: controllalo (16 caratteri) e correggilo.', 'f-codfisc');
    return;
  }
  const congiuntaOn = (document.getElementById('f-congiunta-on') || {}).checked || congCognome || congNome;
  if(congiuntaOn && !congCodiceFiscale){
    popupErroreCampo('Codice fiscale del coniuge obbligatorio', 'È una dichiarazione <b>congiunta</b>: per salvare la pratica inserisci anche il <b>codice fiscale del coniuge</b> (puoi leggerlo con "📄 Leggi documento" del coniuge).', 'f-cong-cf');
    return;
  }
  if(congCodiceFiscale && !cfValido(congCodiceFiscale)){
    popupErroreCampo('Codice fiscale del coniuge non valido', 'Il codice fiscale del coniuge <b>' + esc(congCodiceFiscale) + '</b> non è corretto: controllalo (16 caratteri) e correggilo.', 'f-cong-cf');
    return;
  }

  const annoPr = annoDiData(dataPratica);
  // rinnovo di un contratto colf (🔁 Rinnova dalla scadenza): è la continuazione dello stesso contratto, con il protocollo d'origine
  const rinnovo = eColf(tipo) && typeof praticaInRinnovo === 'function' ? praticaInRinnovo(nome) : null;
  // contratto di affitto: regime, date e inquilini (un proprietario può registrare più contratti nello stesso anno: niente controllo doppioni)
  const affitto = typeof datiAffitto === 'function' ? datiAffitto('f', tipo) : {};
  if(typeof eAffitto === 'function' && eAffitto(tipo)){ const errA = erroreAffitto(affitto); if(errA){ msg.textContent = '⚠️ ' + errA; msg.style.display = 'block'; msg.scrollIntoView({ behavior:'smooth', block:'center' }); return; } }
  const doppione = (eAltrePratiche(tipo) || rinnovo || (typeof eAffitto === 'function' && eAffitto(tipo))) ? null : await cercaDoppione(annoPr, nome, tipo, codiceFiscale, null);
  if(doppione){
    msg.textContent = '⚠️ ' + nome + ' ha gia\' una pratica ' + tipo + ' nel ' + annoPr + ' (protocollo ' + doppione + '). Non e\' possibile inserire un doppione.';
    msg.style.display = 'block';
    return;
  }
  // Contribuente non presente nell'archivio: si chiede conferma prima di inserirlo in anagrafica
  if(!trovaInArchivio(nome, cf, codiceFiscale)){
    const conferma = await chiediNuovoContribuente(nome, cf, codiceFiscale);
    if(!conferma) return;
  }
  // prima si salva il cliente in archivio (cognome e nome separati bene), poi la pratica
  try{ await registraClienteSeNuovo(cognome, nomeProprio, cf, codiceFiscale, telefono, telefonoFisso, documentoScadenza, email); }catch(e){ console.error('archivio clienti', e); }
  if(documentoNumero || comuneNascita || documentoTipo){ try{ await data.clienti.salvaDocumento({ codiceFiscale: codiceFiscale, nomeCompleto: (cognome + ' ' + nomeProprio).trim(), dataNascita: cf, documentoNumero: documentoNumero, comuneNascita: comuneNascita, documentoTipo: documentoTipo }); }catch(e){ console.error('numero documento', e); } }
  // ruolo nella dichiarazione nell'archivio (solo se non è già indicato)
  salvaRuoloCliente((cognome + ' ' + nomeProprio).trim(), cf, codiceFiscale, 'dichiarante', true);
  // riferimento scritto nel modulo: va anche nella scheda del cliente
  if(riferimento){ const rc = trovaInArchivio((cognome + ' ' + nomeProprio).trim(), cf, codiceFiscale); if(!rc || String(rc.riferimento || '').toUpperCase() !== riferimento) salvaRiferimentoCliente((cognome + ' ' + nomeProprio).trim(), cf, codiceFiscale, { riferimento: riferimento }); }
  // pratica 730: il collaboratore (tipo di pratica) va nella scheda del cliente e del coniuge.
  // Se quest'anno è passato a un altro collaboratore, la scheda prende quello nuovo (gli anni prima restano nelle pratiche)
  if(e730({ tipo: tipo })){
    aggiornaCollaboratoreDaPratica((cognome + ' ' + nomeProprio).trim(), cf, codiceFiscale, tipo, annoPr);
    if(congCognome || congNome) aggiornaCollaboratoreDaPratica((congCognome + ' ' + congNome).trim(), congData, congCodiceFiscale, tipo, annoPr);
  }
  if(congCognome || congNome) salvaRuoloCliente((congCognome + ' ' + congNome).trim(), congData, congCodiceFiscale, 'coniuge', true, (cognome + ' ' + nomeProprio).trim(), cf);
  if(congCognome || congNome){ try{ await registraClienteSeNuovo(congCognome, congNome, congData, congCodiceFiscale, congTelefono, '', congDocumentoScadenza, congEmail); }catch(e){ console.error('archivio clienti coniuge', e); }
    if(congDocumentoNumero || congComuneNascita || congDocumentoTipo){ try{ await data.clienti.salvaDocumento({ codiceFiscale: congCodiceFiscale, nomeCompleto: (congCognome + ' ' + congNome).trim(), dataNascita: congData, documentoNumero: congDocumentoNumero, comuneNascita: congComuneNascita, documentoTipo: congDocumentoTipo }); }catch(e){ console.error('numero documento coniuge', e); } } }

  // Il numero è assegnato dal trigger del database (non passare numero, il trigger lo genererà)
  let statoNuovo = documenti.mancanti.length ? 'arrivo' : (document.getElementById('f-stato').value || 'arrivo');
  if(propostaStatoPagato(tipo, statoNuovo, compenso, pagato) && confirm('Il cliente ha pagato tutto (' + fmtEuro(pagato) + ').\n\nSalvo la pratica con lo stato "Pagato" invece di "' + statoLabel(statoNuovo) + '"?')) statoNuovo = 'pagato';
  else if(!documenti.mancanti.length && documenti.presentati.length && statoNuovo === 'arrivo' && !eColf(tipo) && statoVisibile('da_lavorare_scansionata', tipo) && confirm('Ci sono tutti i documenti.\n\nSalvo la pratica come "' + statoLabel('da_lavorare_scansionata') + '" invece di "In arrivo"?')) statoNuovo = 'da_lavorare_scansionata';
  const lavoratore = typeof datiLavoratoreModulo === 'function' ? datiLavoratoreModulo(tipo) : {};
  if(lavoratore.lavCognome || lavoratore.lavNome){ try{ await registraLavoratoreArchivio(lavoratore); }catch(e){ console.error('archivio lavoratore', e); } }
  if(affitto.inquilini && affitto.inquilini.length){ try{ await registraInquiliniArchivio(affitto.inquilini); }catch(e){ console.error('archivio inquilini', e); } }
  const nuovaPratica = {
    anno: annoPr,
    ...lavoratore,
    ...affitto,
    nome, congiunta, congCognome, congNome, congData, congCodiceFiscale, congTelefono, congEmail, comuneNascita, congComuneNascita, congDocumentoScadenza, congDocumentoNumero, congDocumentoTipo, documentoTipo, telefono, telefonoFisso, email, cf, codiceFiscale, documentoScadenza, documentoNumero, documenti, tipo, compenso, pagato, richiesto, metodoPagamento, data: dataPratica, note, viaEmail, iscrittoCisl,
    stato: statoNuovo,
    dataFine: (!eColf(tipo) && document.getElementById('f-stato').value === 'lavorata') ? todayIT() : '',
    scadenzaAssistenza: eColf(tipo) ? document.getElementById('f-data-fine').value.trim() : '',
    descrizioneTipo: descrizioneTipo,
    fatt: 'dafatturare',
    numFattura: '',
    dataFattura: '',
    inseritoDa: ((auth.profilo && auth.profilo.nome) || currentUser || '').toUpperCase(),
    inseritoIl: new Date().toISOString(),
    riferimento: riferimento || null
  };
  if(rinnovo){ nuovaPratica.continuazione = true; nuovaPratica.protocolloOrigine = protocolloOrigineDi(rinnovo); }

  // Usa la nuova API data.js
  const result = await data.pratiche.aggiungi(nuovaPratica);
  if(result.error){
    msg.textContent = '❌ Errore: ' + result.error;
    msg.style.display = 'block';
    return;
  }
  if(eColf(tipo) && typeof concludiRinnovoScadenza === 'function') await concludiRinnovoScadenza(rinnovo, nuovaPratica.protocolloOrigine);
  confermaPraticaSalvata(result.id, nome, tipo, documenti.mancanti);

  document.getElementById('f-cognome').value='';
  document.getElementById('f-nome').value='';
  document.getElementById('f-cf').value='';
  document.getElementById('f-codfisc').value='';
  if(document.getElementById('f-comune')){ document.getElementById('f-comune').value=''; document.getElementById('f-comune').dataset.auto=''; }
  ['f-doc-num','f-doc-tipo'].forEach(function(id){ const el = document.getElementById(id); if(el) el.value = ''; });
  { const en = document.getElementById('f-email-no'); if(en) en.checked = false; }
  { const se = document.getElementById('f-sesso'); if(se){ se.value = ''; se.dataset.manuale = ''; } document.getElementById('f-codfisc').dataset.auto = ''; }
  controllaCampoCF();
  impostaTipoPredefinito();
  document.getElementById('f-compenso').value=''; document.getElementById('f-compenso').dataset.auto='';
  document.getElementById('f-pagato').value=''; if(document.getElementById('f-richiesto')) document.getElementById('f-richiesto').value='';
  document.getElementById('f-metodo').value='CONTANTI';
  document.getElementById('cli-cerca').value='';
  document.getElementById('cli-cerca-cong').value='';
  document.getElementById('f-congiunta-on').checked=false;
  if(typeof pulisciLavoratoreModulo === 'function') pulisciLavoratoreModulo();
  if(typeof pulisciAffittoModulo === 'function') pulisciAffittoModulo();
  toggleCongBox();
  pickChip('f-stato-btns','f-stato','arrivo');
  document.getElementById('f-tel').value='';
  document.getElementById('f-tel-fisso').value='';
  document.getElementById('f-email').value='';
  document.getElementById('f-doc-scad').value=''; coloraScadenzaDocumento();
  azzeraDocumentiModulo();
  document.getElementById('f-data-fine').value='';
  document.getElementById('f-stato').value='arrivo';
  document.getElementById('f-note').value='';
  if(document.getElementById('f-riferimento')) document.getElementById('f-riferimento').value='';
  { const ve = document.getElementById('f-via-email'); if(ve) ve.checked = false; const ic = document.getElementById('f-iscritto-cisl'); if(ic){ ic.checked = false; delete ic.dataset.manuale; aspettoIscrittoCisl(); } }
  if(document.getElementById('f-desctipo')) document.getElementById('f-desctipo').value='';
  aggiornaDescTipoForm();
  document.getElementById('f-data').value=todayIT();
  aggiornaStoricoForm();

  render();
}

function avviso(testo, errore){
  let el = document.getElementById('avviso-toast');
  if(!el){
    el = document.createElement('div');
    el.id = 'avviso-toast';
    el.style.cssText = 'position:fixed; left:50%; bottom:24px; transform:translateX(-50%); z-index:300; padding:10px 18px; border-radius:999px; font-size:13.5px; font-weight:600; color:#fff; box-shadow:0 6px 20px rgba(0,0,0,.25); transition:opacity .3s';
    document.body.appendChild(el);
  }
  el.textContent = testo;
  el.style.background = errore ? '#c0392b' : '#2f9e5f';
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.style.opacity = '0'; }, errore ? 5000 : 2000);
}
// ---- WhatsApp: avviso di ritiro per le pratiche lavorate ----
function numeroWhatsApp(tel){
  let n = String(tel||'').replace(/[^\d+]/g, '');
  if(n.startsWith('+')) n = n.slice(1);
  else if(n.startsWith('00')) n = n.slice(2);
  else if(n) n = '39' + n;
  // numero italiano: per WhatsApp serve un cellulare completo (3 + 9 cifre, es. 333 1234567)
  if(n.startsWith('39')) return /^393\d{9}$/.test(n) ? n : '';
  return /^\d{10,15}$/.test(n) ? n : '';
}
// Cellulare italiano scritto male (cifre mancanti o in più): serve per avvisare prima di salvare
function cellulareSospetto(tel){
  const n = String(tel||'').replace(/[^\d+]/g, '').replace(/^(\+|00)39/, '');
  if(!n || /^(\+|00)/.test(n)) return '';
  if(/^3/.test(n) && n.length !== 10) return 'Il cellulare ' + tel + ' ha ' + n.length + ' cifre: un cellulare italiano ne ha 10 (es. 333 1234567). Così WhatsApp non lo trova.';
  if(!/^3/.test(n)) return 'Il numero ' + tel + ' non sembra un cellulare (i cellulari iniziano con 3): WhatsApp non lo troverà.';
  return '';
}
function messaggioNumeroWhatsApp(nome, tel){
  const s = tel ? cellulareSospetto(tel) : '';
  return (s ? s + '\n\n' : '') + 'Scrivi il numero di cellulare giusto di ' + (nome || 'cliente') + ' (verra\' salvato):';
}
// Apre WhatsApp: sul telefono l'app, sul PC sempre la STESSA scheda di WhatsApp Web (niente nuove aperture a ogni invio)
function eDispositivoMobile(){
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
// Sul PC il browser non puo' usare la scheda di WhatsApp Web gia' aperta: si sceglie (una volta, per questo PC) come inviare
//  app  = app WhatsApp per PC (nessuna scheda nuova)  ·  copia = copia il messaggio da incollare in WhatsApp Web gia' aperto  ·  web = nuova scheda
function modoWhatsAppPC(){ try{ return localStorage.getItem('whatsapp-pc-modo') || ''; }catch(e){ return ''; } }
function impostaModoWhatsAppPC(m){ try{ localStorage.setItem('whatsapp-pc-modo', m); }catch(e){} }
function apriChatWhatsApp(num, testo, dopo){
  const t = testo ? encodeURIComponent(testo) : '';
  // traccia nel registro delle comunicazioni (una volta, quando il messaggio parte davvero)
  const registra = function(){ if(testo && typeof registraComunicazione === 'function'){ if(typeof iniziaInvioWhatsApp === 'function') iniziaInvioWhatsApp(num, testo); registraComunicazione({ canale: 'whatsapp', telefono: num, testo: testo }); } };
  // numero segnato «senza WhatsApp»: si propongono e-mail, SMS o chiamata (o di provare lo stesso)
  const senza = testo && !dopo && !apriChatWhatsApp._forza && typeof numeroSenzaWhatsApp === 'function' ? numeroSenzaWhatsApp(num) : null;
  apriChatWhatsApp._forza = false;
  if(senza){
    const ctx = typeof CONTESTO_COMUNICAZIONE !== 'undefined' ? CONTESTO_COMUNICAZIONE : null;
    altriModiMessaggio({ num: numeroWA(num), testo: testo, email: senza.email || '', persone: [{ nome: (ctx && ctx.nome) || senza.nomeCompleto, cf: (ctx && ctx.cf) || senza.codiceFiscale, motivo: ctx && ctx.motivo, praticaId: ctx && ctx.praticaId }] },
      function(){ if(ctx) contestoComunicazione(ctx); apriChatWhatsApp._forza = true; apriChatWhatsApp(num, testo, dopo); });
    return;
  }
  if(eDispositivoMobile()){
    registra();
    window.open('https://wa.me/' + (num || '') + (t ? '?text=' + t : ''), '_blank');
    if(testo && !dopo && typeof mostraBarraNoWhatsApp === 'function') mostraBarraNoWhatsApp();
    if(dopo) dopo('telefono');
    return;
  }
  const modo = modoWhatsAppPC();
  if(!modo){ scegliModoWhatsAppPC(function(){ apriChatWhatsApp(num, testo, dopo); }); return; }
  registra();
  if(modo === 'app'){
    // se l'app WhatsApp per PC non c'e' il clic non fa nulla: dopo 6 secondi senza che si apra niente si avvisa (c'e' il tempo di rispondere ad "Apri WhatsApp?" del browser)
    let partita = false;
    const segna = function(){ partita = true; };
    window.addEventListener('blur', segna, { once: true });
    const a = document.createElement('a');
    a.href = 'whatsapp://send?' + (num ? 'phone=' + num + (t ? '&' : '') : '') + (t ? 'text=' + t : '');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){
      window.removeEventListener('blur', segna);
      if(!partita && document.visibilityState === 'visible' && document.hasFocus()) popupAppWhatsAppNonAperta(num, testo);
    }, 6000);
  } else if(modo === 'copia'){
    copiaTestoWhatsApp(testo);
    if(!dopo) popupMessaggioCopiato(num);
  } else {
    // sempre la stessa scheda di WhatsApp Web aperta dal programma (non una nuova a ogni messaggio)
    window.open('https://web.whatsapp.com/send?' + (num ? 'phone=' + num + (t ? '&' : '') : '') + (t ? 'text=' + t : ''), 'whatsapp_caf');
  }
  if(testo && !dopo && typeof mostraBarraNoWhatsApp === 'function') mostraBarraNoWhatsApp();
  if(dopo) dopo(modo);
}
function popupAppWhatsAppNonAperta(num, testo){
  const vecchio = document.getElementById('popup-wa-app'); if(vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-wa-app';
  ov.style.cssText = 'position:fixed; inset:0; z-index:490; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #d4881c; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:20px 22px; max-width:460px; width:100%">'
    + '<div style="font-size:19px; font-weight:800; color:#b35f0c; margin-bottom:6px">⚠️ L\'app WhatsApp per PC non si è aperta</div>'
    + '<div style="font-size:13.5px; margin-bottom:12px">Su questo computer è scelto l\'invio con l\'<b>app WhatsApp per PC</b>, ma l\'app non risponde (forse non è installata). Scegli come mandare il messaggio:</div>'
    + '<button type="button" data-m="web" style="display:block; width:100%; margin-bottom:8px; background:#25d366; color:#fff; font-weight:800">🌐 Usa WhatsApp Web (scheda del browser)</button>'
    + '<button type="button" data-m="copia" style="display:block; width:100%; margin-bottom:8px; background:#1d4f91; color:#fff; font-weight:800">📋 Copia il messaggio e lo incollo io</button>'
    + '<div style="font-size:12px; color:var(--sub); margin:4px 0 10px">La scelta resta per questo PC; si cambia dal tasto ⚙️ accanto ai messaggi WhatsApp.</div>'
    + '<div style="text-align:right"><button type="button" data-m="" style="background:var(--line); color:var(--ink)">Chiudi</button></div></div>';
  ov.addEventListener('click', function(e){
    const b = e.target.closest('button[data-m]');
    if(!b && e.target !== ov) return;
    ov.remove();
    if(b && b.dataset.m){ impostaModoWhatsAppPC(b.dataset.m); apriChatWhatsApp(num, testo); if(typeof disegnaInvioMultiplo === 'function') disegnaInvioMultiplo(); }
  });
  document.body.appendChild(ov);
}
function rigaModoWhatsAppPC(){
  if(eDispositivoMobile()) return '';
  const nomi = { copia: '📋 copia il messaggio', app: '💻 app WhatsApp per PC', web: '🌐 WhatsApp Web' };
  return '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; font-size:12.5px; padding:6px 10px; border-radius:10px; background:var(--bg); margin-bottom:10px">'
    + '<span>Invio da questo PC: <b>' + (nomi[modoWhatsAppPC()] || 'da scegliere') + '</b></span>'
    + '<button type="button" onclick="scegliModoWhatsAppPC(function(){ if(typeof disegnaInvioMultiplo === \'function\') disegnaInvioMultiplo(); })" style="padding:4px 10px; font-size:12px">⚙️ Cambia</button></div>';
}
function copiaTestoWhatsApp(testo){
  const ripiego = function(){ const ta = document.createElement('textarea'); ta.value = testo || ''; ta.style.cssText = 'position:fixed; opacity:0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e){} ta.remove(); };
  try{ navigator.clipboard.writeText(testo || '').catch(ripiego); }catch(e){ ripiego(); }
}
function numeroLeggibile(num){ const n = String(num||''); return n.indexOf('39') === 0 ? n.slice(2).replace(/^(\d{3})(\d+)$/, '$1 $2') : '+' + n; }
function testoIstruzioniCopia(num){
  return 'Il messaggio è stato <b>copiato</b>. Vai sulla scheda di <b>WhatsApp Web già aperta</b>'
    + (num ? ', apri la chat del numero <b>' + esc(numeroLeggibile(num)) + '</b>' : ', apri la chat giusta')
    + ' e premi <b>Ctrl+V</b> (incolla), poi <b>Invio</b>.';
}
function popupMessaggioCopiato(num){
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed; inset:0; z-index:470; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #25d366; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:22px 24px; max-width:420px; width:100%; text-align:center">'
    + '<div style="font-size:34px">📋</div><div style="font-size:19px; font-weight:800; color:#1a7f37; margin-bottom:6px">Messaggio copiato</div>'
    + '<div style="font-size:14px; margin-bottom:14px">' + testoIstruzioniCopia(num) + '</div>'
    + '<button type="button" style="background:#1a7f37; color:#fff; min-width:110px">OK</button></div>';
  ov.addEventListener('click', function(e){ if(e.target === ov || e.target.tagName === 'BUTTON') ov.remove(); });
  document.body.appendChild(ov);
}
function scegliModoWhatsAppPC(poi){
  const vecchio = document.getElementById('popup-modo-wa'); if(vecchio) vecchio.remove();
  const attuale = modoWhatsAppPC();
  const ov = document.createElement('div');
  ov.id = 'popup-modo-wa';
  ov.style.cssText = 'position:fixed; inset:0; z-index:480; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  const voce = function(m, titolo, testo){
    return '<button type="button" data-modo="' + m + '" style="display:block; width:100%; text-align:left; margin:0 0 8px; padding:10px 12px; border-radius:12px; border:2px solid ' + (m === attuale ? '#1a7f37' : 'var(--line)') + '; background:var(--card); color:var(--ink); cursor:pointer">'
      + '<div style="font-weight:800">' + titolo + (m === attuale ? ' ✓' : '') + '</div><div style="font-size:12.5px; color:var(--sub); font-weight:400">' + testo + '</div></button>';
  };
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:20px 22px; max-width:480px; width:100%">'
    + '<div style="font-size:19px; font-weight:800; margin-bottom:4px">💬 Come invio i messaggi WhatsApp da questo PC?</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:12px">Il browser non permette di usare la scheda di WhatsApp Web che hai già aperto: scegli come preferisci. Vale solo per questo PC e puoi cambiarlo quando vuoi.</div>'
    + voce('copia', '📋 Copia il messaggio (consigliato con WhatsApp Web)', 'Nessuna nuova scheda: il messaggio viene copiato, lo incolli tu (Ctrl+V) nella chat di WhatsApp Web già aperta.')
    + voce('app', '💻 App WhatsApp per PC', 'Si apre l\'app WhatsApp installata sul computer con il messaggio già scritto. Serve l\'app (gratis dal Microsoft Store).')
    + voce('web', '🌐 Nuova scheda di WhatsApp Web', 'Come prima: si apre ogni volta una nuova scheda (WhatsApp chiede "Usa qui").')
    + '<div style="text-align:right; margin-top:6px"><button type="button" data-modo="" style="background:var(--line); color:var(--ink)">Annulla</button></div></div>';
  ov.addEventListener('click', function(e){
    const b = e.target.closest('button[data-modo]');
    if(!b && e.target !== ov) return;
    ov.remove();
    if(b && b.dataset.modo){ impostaModoWhatsAppPC(b.dataset.modo); avviso('✓ WhatsApp su questo PC: ' + ({ copia: 'copia il messaggio', app: 'app per PC', web: 'nuova scheda' })[b.dataset.modo]); if(poi) poi(); }
  });
  document.body.appendChild(ov);
}
const METODI_PAGAMENTO = ['CONTANTI', 'POS', 'BONIFICO'];
function metodoOptions(v){ return '<option value="">Pagamento…</option>' + METODI_PAGAMENTO.map(function(m){ return '<option' + (m === v ? ' selected' : '') + '>' + m + '</option>'; }).join(''); }
function emailValida(e){ return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(e||'').trim()); }
function nomeProprio(s){ return String(s||'').toLowerCase().replace(/(^|[\s'-])\S/g, function(c){ return c.toUpperCase(); }); }
const MODELLO_WHATSAPP_BASE = 'Gentile {nome}, la informiamo che la Sua {pratica} (protocollo n. {protocollo}) è pronta. Può passare a ritirarla presso il CAF CISL di Alì Terme, in {indirizzo}. Per informazioni può chiamare il {telefono}. Orari di apertura: {orari}. Cordiali saluti.';
function modelliWhatsApp(){
  try{
    const l = JSON.parse(IMPOSTAZIONI.whatsapp_modelli || '[]');
    if(Array.isArray(l) && l.length) return l.map(String);
  }catch(e){}
  return [MODELLO_WHATSAPP_BASE];
}
function indiceModelloPredefinito(){
  const i = parseInt(IMPOSTAZIONI.whatsapp_predefinito, 10);
  return (i >= 0 && i < modelliWhatsApp().length) ? i : 0;
}
function compilaMessaggio(modello, p){
  const valori = {
    nome: nomeProprio(p.nome),
    pratica: /^730/.test(p.tipo||'') ? 'dichiarazione 730' : 'pratica',
    tipo: p.tipo || '',
    protocollo: formattaProtocollo(p),
    indirizzo: IMPOSTAZIONI.caf_indirizzo || '',
    telefono: IMPOSTAZIONI.caf_telefono || '',
    email: IMPOSTAZIONI.caf_email || (typeof emailCaf === 'function' ? emailCaf() : ''),
    orari: IMPOSTAZIONI.caf_orari || ''
  };
  return String(modello).replace(/\{(nome|pratica|tipo|protocollo|indirizzo|telefono|email|orari)\}/gi, function(_, k){ return valori[k.toLowerCase()]; })
    .replace(/orari di apertura:\s*\.\s*/gi, '')
    .replace(/[ \t]+([.,;:])/g, '$1').replace(/,\s*in\s*\./g, '.').replace(/[ \t]{2,}/g, ' ').trim();
}
function messaggioRitiro(p, indice){
  const l = modelliWhatsApp();
  return compilaMessaggio(l[indice == null ? indiceModelloPredefinito() : indice] || l[0], p);
}
function inviaWhatsApp(id){
  const p = state.pratiche.find(function(x){ return x.id === id; });
  if(!p) return;
  let num = numeroWhatsApp(p.telefono);
  let nuovoTel = '';
  if(!num){
    const t = prompt(messaggioNumeroWhatsApp(p.nome, p.telefono), p.telefono || '');
    if(!t) return;
    num = numeroWhatsApp(t);
    if(!num){ avviso('❌ Numero di telefono non valido', true); return; }
    nuovoTel = t.trim();
  }
  if(nuovoTel) data.pratiche.aggiorna(id, { telefono: nuovoTel });
  const modelli = modelliWhatsApp();
  // Apertura immediata dal clic: dopo un'attesa il browser bloccherebbe la nuova finestra
  if(modelli.length < 2){ apriWhatsApp(num, messaggioRitiro(p), p); return; }
  scegliMessaggioWhatsApp(p, num);
}
function apriWhatsApp(num, testo, p){
  if(p && typeof contestoComunicazione === 'function') contestoComunicazione({ nome: p.nome, cf: p.codiceFiscale || '', nascita: p.cf || '', praticaId: p.id, motivo: 'Pratica pronta' });
  apriChatWhatsApp(num, testo);
  if(p && p.id){ p.whatsappInviato = todayIT(); data.pratiche.aggiorna(p.id, { whatsappInviato: p.whatsappInviato }); }
}
function scegliMessaggioWhatsApp(p, num){
  const modelli = modelliWhatsApp();
  const pred = indiceModelloPredefinito();
  const ordine = [pred].concat(modelli.map(function(_, i){ return i; }).filter(function(i){ return i !== pred; }));
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed; inset:0; z-index:400; background:rgba(15,27,45,.4); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; max-width:560px; width:100%; max-height:85vh; overflow:auto; padding:18px 20px; box-shadow:0 20px 50px rgba(0,0,0,.3)">'
    + '<div style="font-size:17px; font-weight:800; margin-bottom:4px">💬 Quale messaggio invio a ' + esc(nomeProprio(p.nome)) + '?</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:10px">Clicca sul messaggio da inviare.</div>'
    + ordine.map(function(i){
        return '<button type="button" data-i="' + i + '" style="display:block; width:100%; text-align:left; margin-bottom:8px; padding:10px 12px; border-radius:10px; border:2px solid ' + (i === pred ? '#25d366' : 'var(--line)') + '; background:var(--bg); color:var(--ink); font-weight:400; font-size:13px; white-space:pre-wrap">'
          + '<b>' + (i + 1) + '.' + (i === pred ? ' ⭐ Predefinito' : '') + '</b><br>' + esc(messaggioRitiro(p, i)) + '</button>';
      }).join('')
    + '<div style="text-align:right"><button type="button" data-annulla="1" style="background:var(--line); color:var(--ink)">Annulla</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){
    const b = e.target.closest('button');
    if(e.target === ov || (b && b.dataset.annulla)){ ov.remove(); return; }
    if(b && b.dataset.i != null){ apriWhatsApp(num, messaggioRitiro(p, parseInt(b.dataset.i, 10)), p); ov.remove(); }
  });
}
function bottoneWhatsApp(p, stile, soloIcona){
  if(p.stato !== 'lavorata') return '';
  return '<button type="button" class="btn-wa" style="' + (stile||'') + '" onclick="inviaWhatsApp(\'' + p.id + '\')" title="' + (p.telefono ? 'Invia a ' + esc(p.telefono) : 'Telefono mancante: verra\' chiesto') + '">' + (soloIcona ? '💬' : '💬 WhatsApp') + '</button>'
    + ' <button type="button" style="' + (stile||'') + '; background:#1d4f91; color:#fff; border:none" onclick="emailRitiro(\'' + p.id + '\')" title="Avvisa per e-mail che la pratica è pronta">' + (soloIcona ? '📧' : '📧 E-mail') + '</button>';
}

const STATI_IN_LAVORAZIONE = ['arrivo','lavorazione','da_lavorare_scansionata'];
// Finestrella "quanto ha pagato?" (proposto: richiesto, altrimenti la fattura)
function chiediImportoPagato(p, stato){
  return new Promise(function(fine){
    const v = document.getElementById('popup-importo-pagato'); if(v) v.remove();
    const ov = document.createElement('div');
    ov.id = 'popup-importo-pagato';
    ov.style.cssText = 'position:fixed; inset:0; z-index:480; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:14px';
    const prop = Number(p.richiesto || 0) || Number(p.compenso || 0);
    ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid #2f9e5f; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:16px 18px; max-width:440px; width:100%">'
      + '<div style="font-size:18px; font-weight:800; color:#2f9e5f">🟢 ' + esc(statoLabel(stato)) + ': quanto ha pagato?</div>'
      + '<div style="font-size:13px; color:var(--sub); margin-bottom:10px">' + esc(formattaProtocollo(p)) + ' · ' + esc(p.nome || '') + (Number(p.compenso||0) ? ' · fattura ' + fmtEuro(p.compenso) : '') + (Number(p.richiesto||0) ? ' · richiesto ' + fmtEuro(p.richiesto) : '') + '</div>'
      + '<div class="grid"><div><label>Importo pagato (€)</label><input id="ip-imp" type="text" inputmode="decimal" value="' + (prop ? importoInCampo(prop) : '') + '" oninput="filtraImporto(this)" onblur="formattaCampoImporto(this)" style="font-weight:800; font-size:16px"></div>'
      + '<div><label>Pagamento</label><select id="ip-met">' + metodoOptions(p.metodoPagamento || 'CONTANTI') + '</select></div></div>'
      + '<div id="ip-msg" style="color:#c0392b; font-size:12.5px; font-weight:700; margin-top:6px"></div>'
      + '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px"><button type="button" data-az="no" style="background:var(--line); color:var(--ink)">Annulla</button>'
      + '<button type="button" data-az="si" style="background:#2f9e5f; color:#fff; font-weight:800">✓ Salva</button></div></div>';
    document.body.appendChild(ov);
    const imp = document.getElementById('ip-imp'); if(imp){ imp.focus(); imp.select(); }
    ov.addEventListener('click', function(e){
      const b = e.target.closest('button[data-az]');
      if(e.target === ov || (b && b.dataset.az === 'no')){ ov.remove(); fine(null); return; }
      if(!b) return;
      const x = parseImporto(document.getElementById('ip-imp').value);
      if(!(x > 0)){ document.getElementById('ip-msg').textContent = 'Scrivi quanto ha pagato.'; return; }
      const met = document.getElementById('ip-met').value;
      ov.remove(); fine({ importo: x, metodo: met });
    });
  });
}
// Colf e badanti: motivo e data della cessazione del rapporto di lavoro
const MOTIVI_CESSAZIONE = [
  'Licenziamento da parte del datore di lavoro',
  'Dimissioni del lavoratore',
  'Decesso della persona assistita / del datore di lavoro',
  'Decesso del lavoratore',
  'Fine del contratto a termine',
  'Risoluzione consensuale (accordo tra le parti)',
  'Licenziamento per giusta causa',
  'Trasferimento ad altro CAF / consulente'
];
function chiediCessazione(p){
  return new Promise(function(fine){
    const v = document.getElementById('popup-cessazione'); if(v) v.remove();
    const ov = document.createElement('div');
    ov.id = 'popup-cessazione';
    ov.style.cssText = 'position:fixed; inset:0; z-index:480; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:14px';
    const gia = p.cessazioneMotivo || '', altro = gia && MOTIVI_CESSAZIONE.indexOf(gia) < 0;
    ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid #6b7280; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:16px 18px; max-width:480px; width:100%">'
      + '<div style="font-size:18px; font-weight:800; color:#374151">⚫ Cessazione del rapporto di lavoro</div>'
      + '<div style="font-size:13px; color:var(--sub); margin-bottom:10px">' + esc(formattaProtocollo(p)) + ' · ' + esc(p.nome || '') + '. Da questo momento il contratto non chiede più buste paga e non passa all\'anno nuovo.</div>'
      + '<label>Motivo della cessazione</label><select id="ce-motivo" onchange="document.getElementById(\'ce-altro-box\').style.display = this.value === \'*altro\' ? \'\' : \'none\'">'
      + '<option value="">— scegli il motivo —</option>' + MOTIVI_CESSAZIONE.map(function(m){ return '<option' + (m === gia ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '<option value="*altro"' + (altro ? ' selected' : '') + '>Altro motivo…</option></select>'
      + '<div id="ce-altro-box" style="margin-top:6px; ' + (altro ? '' : 'display:none') + '"><label>Scrivi il motivo</label><input id="ce-altro" value="' + esc(altro ? gia : '') + '" placeholder="Es. ricovero in struttura"></div>'
      + '<div style="margin-top:8px"><label>Data di cessazione</label><input id="ce-data" value="' + esc(p.cessazioneData || todayIT()) + '" placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)" style="max-width:180px"></div>'
      + '<div id="ce-msg" style="color:#c0392b; font-size:12.5px; font-weight:700; margin-top:6px"></div>'
      + '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px"><button type="button" data-az="no" style="background:var(--line); color:var(--ink)">Annulla</button>'
      + '<button type="button" data-az="si" style="background:#374151; color:#fff; font-weight:800">⚫ Segna come cessata</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){
      const b = e.target.closest('button[data-az]');
      if(e.target === ov || (b && b.dataset.az === 'no')){ ov.remove(); fine(null); return; }
      if(!b) return;
      const sel = document.getElementById('ce-motivo').value, msg = document.getElementById('ce-msg');
      const motivo = sel === '*altro' ? document.getElementById('ce-altro').value.trim() : sel;
      const dataC = document.getElementById('ce-data').value.trim();
      if(!motivo){ msg.textContent = 'Scegli o scrivi il motivo della cessazione.'; return; }
      if(!parseDataIT(dataC)){ msg.textContent = 'La data deve essere GG/MM/AAAA.'; return; }
      ov.remove(); fine({ motivo: motivo, data: dataC });
    });
  });
}
async function modificaCessazione(id){
  const p = (state.pratiche||[]).find(function(x){ return x.id === id; }); if(!p) return;
  const c = await chiediCessazione(p); if(!c) return;
  const r = await data.pratiche.aggiorna(id, { cessazioneMotivo: c.motivo, cessazioneData: c.data });
  if(r && r.error){ avviso('❌ Non salvato: ' + r.error, true); return; }
  avviso('✓ Motivo della cessazione aggiornato'); render();
}
async function cambiaStato(id, stato){
  const p = (state.pratiche||[]).find(function(x){ return x.id===id; });
  // con documenti mancanti la pratica resta "In arrivo"
  if(p && stato !== 'arrivo' && typeof documentiPratica === 'function' && documentiPratica(p).mancanti.length){
    render();
    popupDocumentiMancanti(p, statoLabel(stato));
    return;
  }
  const campi = { stato: stato };
  // colf e badanti: chiudendo il contratto si chiede il motivo; riaprendolo il motivo si toglie
  if(p && eColf(p.tipo) && stato === 'pratica_cessata'){
    const c = await chiediCessazione(p);
    if(!c){ render(); return; }
    campi.cessazioneMotivo = c.motivo; campi.cessazioneData = c.data;
  } else if(p && p.cessazioneMotivo && stato !== 'pratica_cessata'){ campi.cessazioneMotivo = null; campi.cessazioneData = null; }
  // passando a "Pagato" senza l'importo pagato, si chiede quanto ha pagato (altrimenti la contabilità non lo vede)
  if(p && (stato === 'pagato' || stato === 'pagato_da_ritirare') && !(Number(p.pagato || 0) > 0)){
    const pg = await chiediImportoPagato(p, stato);
    if(!pg){ render(); return; }
    campi.pagato = pg.importo; campi.metodoPagamento = pg.metodo;
  }
  if(p && eColf(p.tipo)) { /* per colf e badanti c'e' la scadenza assistenza al posto della fine lavorazione */ }
  else if(STATI_IN_LAVORAZIONE.indexOf(stato) >= 0) campi.dataFine = '';
  else if(stato === 'lavorata' && !(p && p.dataFine)) campi.dataFine = todayIT();
  const result = await data.pratiche.aggiorna(id, campi);
  if(result && result.error){ avviso('❌ Stato non salvato: ' + result.error, true); return; }
  avviso('✓ Stato salvato: ' + statoLabel(stato));
  render();
}

// Acconti dei collaboratori: entrano nell'incasso del collaboratore e in quello generale (anno della data dell'acconto)
function accontiDi(anno, filtroTipo){
  return (state.acconti || []).filter(function(a){ return annoDiData(a.data) === anno && (!filtroTipo || filtroTipo(a.tipo)); });
}
function totaleAcconti(anno, filtroTipo){ return accontiDi(anno, filtroTipo).reduce(function(t,a){ return t + Number(a.importo||0); }, 0); }
// Tipi di pratica senza il tasto Acconto (non sono collaboratori che versano)
const TIPI_SENZA_ACCONTO = ['730 SEDE','730 FILCA','730 FPS IN CONVENZIONE','730 DECEDUTI','730 INTEGRATIVI/RETTIFICATIVI','CONTRATTI DI AFFITTO','CONTRATTI COLF E BADANTI','ISEE A PAGAMENTO','IMU','ISEE','RED','SEND','MODELLI UNICO PF','INVCIV','ADI','F24','RAI TV','ROTTAMAZIONE'];
function haAccontiPredefinito(k){ return TIPI_SENZA_ACCONTO.indexOf(String(k||'').toUpperCase().trim()) < 0; }
function haAcconti(k){ const c = tipoConfig(k); return typeof c.acconto === 'boolean' ? c.acconto : haAccontiPredefinito(k); }
function puoScrivereAcconti(){ return typeof puo === 'function' && puo('registro', true); }
function nuovoAcconto(tipo){
  const vecchio = document.getElementById('popup-acconto'); if(vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-acconto';
  ov.style.cssText = 'position:fixed; inset:0; z-index:470; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #8e5bd6; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:20px 22px; max-width:440px; width:100%">'
    + '<div style="font-size:19px; font-weight:800; color:#8e5bd6">💰 Nuovo acconto</div><div style="font-size:13px; color:var(--sub); margin:2px 0 12px">' + esc(tipo) + '</div>'
    + '<div class="grid" style="gap:8px"><div><label>Data</label><input id="ac-data" value="' + todayIT() + '" placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"></div>'
    + '<div><label>Importo (€)</label><input id="ac-importo" type="text" inputmode="decimal" placeholder="0,00" oninput="filtraImporto(this)" onblur="formattaCampoImporto(this)" style="font-weight:800"></div>'
    + '<div><label>Pagamento</label><select id="ac-metodo">' + METODI_PAGAMENTO.map(function(m){ return '<option' + (m === 'CONTANTI' ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></div>'
    + '<div><label>Note</label><input id="ac-note" placeholder="Facoltative"></div></div>'
    + '<div id="ac-esito" style="font-size:13px; margin-top:6px"></div>'
    + '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px"><button type="button" data-azione="no" style="background:var(--line); color:var(--ink)">Annulla</button><button type="button" data-azione="si" style="background:#8e5bd6; color:#fff; font-weight:800">💾 Registra acconto</button></div></div>';
  document.body.appendChild(ov);
  setTimeout(function(){ const i = document.getElementById('ac-importo'); if(i) i.focus(); }, 50);
  ov.addEventListener('click', async function(e){
    const b = e.target.closest('button[data-azione]');
    if(!b && e.target !== ov) return;
    if(!b || b.dataset.azione === 'no'){ ov.remove(); return; }
    const dataA = document.getElementById('ac-data').value.trim(), imp = parseImporto(document.getElementById('ac-importo').value);
    const esito = document.getElementById('ac-esito');
    if(!parseDataIT(dataA)){ esito.innerHTML = '<b style="color:#c0392b">Data nel formato GG/MM/AAAA</b>'; return; }
    if(!imp || imp <= 0){ esito.innerHTML = '<b style="color:#c0392b">Scrivi l\'importo dell\'acconto</b>'; return; }
    b.disabled = true;
    const r = await data.acconti.aggiungi({ tipo: tipo, data: dataA, importo: imp, metodoPagamento: document.getElementById('ac-metodo').value, note: document.getElementById('ac-note').value.trim() });
    if(r.error){ b.disabled = false; esito.innerHTML = '<b style="color:#c0392b">❌ ' + esc(r.error) + '</b>'; return; }
    ov.remove();
    aperti[tipo] = true;
    avviso('💰 Acconto di ' + fmtEuro(imp) + ' registrato per ' + tipo);
    render();
  });
}
async function rimuoviAcconto(id){
  const a = (state.acconti||[]).find(function(x){ return x.id === id; });
  if(!a || !confirm('Eliminare l\'acconto di ' + fmtEuro(a.importo) + ' del ' + a.data + ' (' + a.tipo + ')?')) return;
  const r = await data.acconti.elimina(id);
  if(r.error){ avviso('❌ ' + r.error, true); return; }
  avviso('✓ Acconto eliminato');
  render();
}
// Contabilita' del singolo collaboratore / tipo di pratica (dentro il suo gruppo nel registro)
// Tipi di pratica gratuiti: niente fatture/incasso (a meno che non ci siano importi inseriti)
const TIPI_SENZA_SOLDI = ['ADI','INVCIV','RED','ISEE'];
function soldiPredefinito(k){ return TIPI_SENZA_SOLDI.indexOf(String(k||'').toUpperCase().trim()) < 0; }
function conSoldi(k){ const c = tipoConfig(k); return typeof c.soldi === 'boolean' ? c.soldi : soldiPredefinito(k); }
function senzaSoldi(k, fatt, inc){
  return !conSoldi(k) && !Number(fatt) && !Number(inc)
    && !accontiDi(annoAttivo(), function(t){ return t === k; }).length;
}
function bottoneStampaCollaboratore(k){
  const kk = k.replace(/'/g, "\\'");
  return (eColf(k) && typeof apriBustePaga === 'function' ? '<button type="button" onclick="apriBustePaga()" style="background:#0e7c86; color:#fff; border:none; border-radius:999px; padding:5px 14px; font-weight:800; cursor:pointer; margin-right:6px">💼 Buste paga del mese</button>' : '') + (typeof bottoneTrasferimentoColf === 'function' ? bottoneTrasferimentoColf(k) : '') + (haAcconti(k) && puoScrivereAcconti() ? '<button type="button" onclick="pagamentoCumulativo(\'' + kk + '\')" style="background:#2f9e5f; color:#fff; border:none; border-radius:999px; padding:5px 14px; font-weight:800; cursor:pointer; margin-right:6px">✓ Togli dai morosi</button>' : '')
    + '<button type="button" onclick="stampaCollaboratore(\'' + k.replace(/'/g, "\\'") + '\')" style="background:#374151; color:#fff; border:none; border-radius:999px; padding:5px 14px; font-weight:800; cursor:pointer">🖨️ Stampa</button>';
}
function contabilitaCollaboratoreHTML(k, items, guadagno){
  items = praticheContabili(items); // la fattura conta solo dalla consegna
  const fatt0 = items.reduce(function(a,p){ return a+Number(p.compenso||0); }, 0);
  const inc0 = items.reduce(function(a,p){ return a+Number(p.pagato||0); }, 0);
  // la contabilità completa si vede in tutti i tipi di pratica (anche senza pratiche o senza importi)
  const fatt = items.reduce(function(a,p){ return a+Number(p.compenso||0); }, 0);
  const accLista = accontiDi(annoAttivo(), function(t){ return t === k; });
  const acc = accLista.reduce(function(t,a){ return t + Number(a.importo||0); }, 0);
  const conAcc = true;
  const inc = items.reduce(function(a,p){ return a+Number(p.pagato||0); }, 0);
  const n = sommaPeso(items);
  const lav = sommaPeso(items.filter(eLavorata)), daFare = sommaPeso(items.filter(eDaLavorare));
  const pag = datiPerPagamento(items);
  const col = coloreCollaboratore(k);
  // pratiche usate per i riquadri: servono al dettaglio che si apre toccando un riquadro
  DETTAGLIO_CONTAB[k] = items;
  const kAttr = esc(String(k).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
  const clic = function(voce){ return ' onclick="dettaglioContab(\'' + kAttr + '\',\'' + voce + '\')" title="Tocca per vedere il dettaglio"'; };
  const tile = function(colore, valore, etichetta, voce){
    return '<div class="tile-dett"' + clic(voce) + ' style="flex:1; min-width:110px; padding:8px 10px; border-radius:10px; background:' + colore + '; color:#fff; text-align:center; cursor:pointer"><div style="font-size:17px; font-weight:800">' + valore + '</div><div style="font-size:10.5px; font-weight:700; opacity:.92; text-transform:uppercase">' + etichetta + '</div><div style="font-size:9.5px; opacity:.75; margin-top:2px">🔍 dettaglio</div></div>';
  };
  return '<div style="margin-bottom:10px; padding:10px; border-radius:12px; border:2px solid ' + col + '">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px"><b style="color:' + col + '">📊 Contabilità ' + esc(k) + ' – ' + annoAttivo() + '</b>' + bottoneStampaCollaboratore(k) + '</div>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap">'
    + tile('#1d4f91', n, 'Pratiche', 'pratiche')
    + tile('#2f9e5f', lav, 'Lavorate', 'lavorate')
    + tile(daFare ? '#e57373' : '#8a8f98', daFare, 'Da lavorare', 'dalavorare')
    + tile('#2f9e5f', fmtEuro(fatt), 'Fatture emesse', 'fatture')
    + tile('#8e5bd6', fmtEuro(inc), 'Incasso', 'incasso')
    + (conAcc ? tile('#0e7c86', fmtEuro(acc), 'Pagamenti effettuati', 'pagamenti')
    + tile((inc - acc) > 0 ? '#c0392b' : '#374151', fmtEuro(inc - acc), 'Da incassare (incasso − pagamenti)', 'daincassare') : '')
    + tile('#d98b1e', n ? fmtEuro(fatt / n) : '—', 'Prezzo medio (fatture ÷ pratiche)', 'prezzomedio')
    + tile('#b8860b', n ? fmtEuro(inc / n) : '—', 'Incasso medio (incasso ÷ pratiche)', 'incassomedio')
    + (vedeGuadagni() ? (function(){ const g = guadagno != null ? guadagno : inc - fatt; return '<div style="flex:1; min-width:110px; padding:8px 10px; border-radius:10px; background:' + (g >= 0 ? '#c2185b' : '#7f1d1d') + '; color:#fff; text-align:center"><div style="font-size:17px; font-weight:800">' + fmtEuro(g) + '</div><div style="font-size:10.5px; font-weight:700; opacity:.92; text-transform:uppercase">💰 Guadagno (incasso − fatture)</div></div>'; })() : '')
    + '</div>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; font-size:12.5px">'
    + METODI_PAGAMENTO.concat(pag[''].n ? [''] : []).map(function(m){ return '<span' + clic('metodo:' + m) + ' style="padding:3px 10px; border-radius:999px; background:var(--line); cursor:pointer">' + ({ CONTANTI:'💶 Contanti', POS:'💳 POS', BONIFICO:'🏦 Bonifico' }[m] || '❔ Non indicato') + ': <b>' + fmtEuro(pag[m].inc) + '</b> (' + pag[m].n + ')</span>'; }).join('')
    + '</div>'
    + (!conAcc ? '</div>' : '<div style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--line)">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap"><b style="color:#0e7c86">💰 Pagamenti effettuati (acconti) ' + annoAttivo() + ': ' + fmtEuro(acc) + '</b>'
    + (puoScrivereAcconti() ? '<button type="button" onclick="nuovoAcconto(\'' + k.replace(/'/g, "\\'") + '\')" style="background:#8e5bd6; color:#fff; border:none; border-radius:999px; padding:5px 14px; font-weight:800; cursor:pointer">+ 💰 Acconto</button>' : '') + '</div>'
    + (accLista.length ? accLista.map(function(a){ return '<div style="display:flex; justify-content:space-between; gap:8px; font-size:13px; padding:4px 0; border-bottom:1px solid var(--line)"><span>' + esc(a.data) + (a.metodoPagamento ? ' · ' + esc(a.metodoPagamento) : '') + (a.note ? ' · ' + esc(a.note) : '') + (a.creatoDa ? ' <span style="color:var(--sub)">(' + esc(a.creatoDa) + ')</span>' : '') + '</span><span><b>' + fmtEuro(a.importo) + '</b>' + (puoScrivereAcconti() ? ' <button onclick="rimuoviAcconto(\'' + a.id + '\')" style="background:none;border:none;color:#c0392b;cursor:pointer;font-weight:700" title="Elimina">✕</button>' : '') + '</span></div>'; }).join('') : '<div style="font-size:12.5px; color:var(--sub)">Nessun acconto registrato</div>')
    + '</div></div>');
}
// Elenco compatto di tutte le pratiche del collaboratore
function tabellaPraticheGruppoHTML(items, k){
  if(!items.length) return '<div class="empty">Nessuna pratica</div>';
  const ord = items.slice().sort(function(a,b){ return a.numero - b.numero; });
  const soldi = !senzaSoldi(k || (items[0] && items[0].tipo), items.reduce(function(a,p){ return a+Number(p.compenso||0); }, 0), items.reduce(function(a,p){ return a+Number(p.pagato||0); }, 0));
  return '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>N.</th><th>Data</th><th>Cliente</th><th>Stato</th>' + (soldi ? '<th>Fattura</th><th>Pagato</th><th>Pagamento</th>' : '') + '<th></th></tr></thead><tbody>'
    + ord.map(function(p){
      return '<tr><td class="n">' + formattaProtocollo(p) + '</td><td>' + esc(p.data || '-') + '</td><td class="wrap">' + esc((p.nome || '-').toUpperCase()) + (p.congiunta ? '<div class="sub2">+ ' + esc(p.congiunta) + '</div>' : '') + '</td>'
        + '<td><span style="white-space:nowrap">' + pallino(p.stato) + esc(statoLabel(p.stato)) + '</span>' + (p.trasferitaIn ? '<div class="sub2" style="color:#1f8a70">➡️ Trasferita: ' + esc(p.trasferitaIn) + '</div>' : '') + '</td>' + (soldi ? '<td>' + fmtEuro(p.compenso) + '</td><td><b>' + fmtEuro(p.pagato) + '</b>' + (p.saldataCollaboratore ? '<div class="sub2" style="color:#2f9e5f" title="Tolta dai morosi: saldata tramite il collaboratore">✓ fuori dai morosi</div>' : '') + '</td><td>' + esc(p.metodoPagamento || '-') + '</td>' : '')
        + '<td style="white-space:nowrap">' + bottoneAvanti(p) + ' ' + bottoneConsegna(p) + ' <button type="button" style="background:var(--accent); color:var(--accent-ink); border:none; border-radius:6px; padding:4px 10px; font-size:12px; cursor:pointer" onclick="apriPraticaDaTabella(\'' + p.id + '\')">Apri</button></td></tr>';
    }).join('') + '</tbody></table></div>';
}
// Stampa della contabilita' e delle pratiche di un solo collaboratore / tipo (anno scelto)
function stampaCollaboratore(k){
  const anno = annoAttivo();
  const items = state.pratiche.filter(function(p){ return (p.tipo || 'SENZA TIPO') === k && annoPratica(p) === anno; });
  const w = window.open('', '_blank');
  if(!w){ alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
  const primaDett = DETTAGLIO_CONTAB[k];
  const riquadro = contabilitaCollaboratoreHTML(k, items).replace(/<button[\s\S]*?<\/button>/g, '')
    .replace(/ onclick="dettaglioContab\([^"]*\)"/g, '').replace(/<div style="font-size:9\.5px; opacity:\.75; margin-top:2px">🔍 dettaglio<\/div>/g, '');
  if(primaDett) DETTAGLIO_CONTAB[k] = primaDett; // il dettaglio a video resta quello del registro (con i filtri)
  const tabella = tabellaPraticheGruppoHTML(items, k).replace(/<td><button[\s\S]*?<\/button><\/td>/g, '<td></td>');
  w.document.open();
  w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>' + esc(k) + ' ' + anno + '</title><style>@page{size:A4 landscape; margin:10mm} body{font-family:Arial,Helvetica,sans-serif; font-size:11.5px; color:#0f1b2d; --sub:#5b6b82; --line:#e3e8ef; -webkit-print-color-adjust:exact; print-color-adjust:exact} h1{font-size:16px; color:#1d4f91; margin:0 0 6px} table{width:100%; border-collapse:collapse; margin-top:8px} th,td{border:1px solid #cfd8e3; padding:4px 6px; text-align:left} th{background:#1d4f91; color:#fff} th:last-child,td:last-child{display:none} .sub2{font-size:10px; color:#5b6b82} .barra button{padding:8px 16px; margin:0 6px 10px 0} @media print{.barra{display:none}}</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button><button onclick="window.close()">Chiudi</button></div>'
    + '<h1>CAF CISL Alì Terme – ' + esc(k) + ' – anno ' + anno + '</h1><div style="margin-bottom:8px; color:#5b6b82">Stampato il ' + new Date().toLocaleDateString('it-IT') + ' · ' + sommaPeso(items) + ' pratiche (le congiunte valgono 2)</div>'
    + riquadro + tabella + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
  w.document.close();
}
// Dettaglio di un riquadro della contabilita' del collaboratore: si apre toccando il riquadro
var DETTAGLIO_CONTAB = {};
function dettaglioContab(k, voce){
  const items = praticheContabili(DETTAGLIO_CONTAB[k] || []).sort(function(a,b){ return a.numero - b.numero; });
  const accLista = accontiDi(annoAttivo(), function(t){ return t === k; }).slice().sort(function(a,b){
    const da = parseDataIT(a.data), db = parseDataIT(b.data);
    return (da ? da.a*10000 + da.m*100 + da.g : 0) - (db ? db.a*10000 + db.m*100 + db.g : 0);
  });
  const n = sommaPeso(items);
  const fatt = items.reduce(function(t,p){ return t + Number(p.compenso||0); }, 0);
  const inc = items.reduce(function(t,p){ return t + Number(p.pagato||0); }, 0);
  const acc = accLista.reduce(function(t,a){ return t + Number(a.importo||0); }, 0);
  const nomeMetodo = { CONTANTI:'💶 Contanti', POS:'💳 POS', BONIFICO:'🏦 Bonifico', '':'❔ Non indicato' };
  const box = 'padding:10px 12px; border-radius:12px; background:var(--line); font-size:14px; margin-bottom:10px; line-height:1.5';
  const titoloSez = function(t){ return '<div style="font-weight:800; margin:12px 0 4px">' + t + '</div>'; };
  const vuoto = function(t){ return '<div style="font-size:13px; color:var(--sub); padding:6px 0">' + t + '</div>'; };
  // una riga per pratica: protocollo, data, cliente, stato e (se serve) un importo a destra
  const rigaPratica = function(p, importo, extra){
    return '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:7px 0; border-bottom:1px solid var(--line); font-size:13.5px">'
      + '<div style="min-width:0"><b>' + esc(formattaProtocollo(p)) + '</b> · ' + esc(p.data || '-') + '<br>' + esc((p.nome || '-').toUpperCase())
      + (p.congiunta || p.congCognome || p.congNome ? ' <span style="color:var(--sub)">(congiunta, vale 2)</span>' : '')
      + '<div style="font-size:12px; color:var(--sub)">' + pallino(p.stato) + esc(statoLabel(p.stato)) + (extra ? ' · ' + extra : '') + '</div></div>'
      + '<div style="display:flex; align-items:center; gap:8px; flex-shrink:0">' + (importo !== undefined ? '<b>' + fmtEuro(importo) + '</b>' : '')
      + '<button type="button" data-apri="' + esc(p.id) + '" style="background:var(--accent); color:var(--accent-ink); border:none; border-radius:6px; padding:4px 10px; font-size:12px; cursor:pointer">Apri</button></div></div>';
  };
  const rigaAcconto = function(a){
    return '<div style="display:flex; justify-content:space-between; gap:8px; padding:7px 0; border-bottom:1px solid var(--line); font-size:13.5px"><span>' + esc(a.data)
      + (a.metodoPagamento ? ' · ' + esc(a.metodoPagamento) : '') + (a.note ? ' · ' + esc(a.note) : '') + (a.creatoDa ? ' <span style="color:var(--sub)">(' + esc(a.creatoDa) + ')</span>' : '')
      + '</span><b>' + fmtEuro(a.importo) + '</b></div>';
  };
  const totale = function(etichetta, valore){ return '<div style="display:flex; justify-content:space-between; padding:8px 0 0; font-size:15px; font-weight:800"><span>' + etichetta + '</span><span>' + valore + '</span></div>'; };
  const elencoPratiche = function(lista){ return lista.length ? lista.map(function(p){ return rigaPratica(p); }).join('') + totale('Totale', sommaPeso(lista) + ' pratiche') : vuoto('Nessuna pratica'); };
  const elencoFatture = function(){
    return items.length ? items.map(function(p){ return rigaPratica(p, Number(p.compenso||0), Number(p.compenso||0) ? '' : '<span style="color:#c0392b">fattura da inserire</span>'); }).join('') + totale('Totale fatture', fmtEuro(fatt)) : vuoto('Nessuna pratica');
  };
  const pagate = items.filter(function(p){ return Number(p.pagato||0) > 0; });
  const elencoIncassi = function(lista){
    return lista.length ? lista.map(function(p){ return rigaPratica(p, Number(p.pagato||0), esc(nomeMetodo[METODI_PAGAMENTO.indexOf(p.metodoPagamento) >= 0 ? p.metodoPagamento : ''])); }).join('')
      + totale('Totale incassato', fmtEuro(lista.reduce(function(t,p){ return t + Number(p.pagato||0); }, 0))) : vuoto('Nessun incasso');
  };
  const elencoAcconti = function(){ return accLista.length ? accLista.map(rigaAcconto).join('') + totale('Totale pagamenti', fmtEuro(acc)) : vuoto('Nessun acconto registrato nel ' + annoAttivo()); };
  const nonPagate = items.filter(function(p){ return !Number(p.pagato||0); });

  let titolo = '', corpo = '';
  if(voce === 'pratiche'){
    titolo = 'Pratiche (' + n + ')';
    corpo = '<div style="' + box + '">Tutte le pratiche di ' + esc(k) + ' del ' + annoAttivo() + '. Le congiunte valgono 2.</div>' + elencoPratiche(items);
  } else if(voce === 'lavorate'){
    const l = items.filter(eLavorata);
    titolo = 'Lavorate (' + sommaPeso(l) + ')';
    corpo = elencoPratiche(l);
  } else if(voce === 'dalavorare'){
    const l = items.filter(eDaLavorare);
    titolo = 'Da lavorare (' + sommaPeso(l) + ')';
    corpo = elencoPratiche(l);
  } else if(voce === 'fatture'){
    titolo = 'Fatture emesse: ' + fmtEuro(fatt);
    corpo = elencoFatture();
  } else if(voce === 'incasso'){
    titolo = 'Incasso: ' + fmtEuro(inc);
    corpo = elencoIncassi(pagate) + (nonPagate.length ? titoloSez('Non ancora pagate (' + sommaPeso(nonPagate) + ')') + nonPagate.map(function(p){ return rigaPratica(p, 0, Number(p.compenso||0) ? 'fattura ' + fmtEuro(p.compenso) : ''); }).join('') : '');
  } else if(voce === 'pagamenti'){
    titolo = 'Pagamenti effettuati: ' + fmtEuro(acc);
    corpo = '<div style="' + box + '">Acconti che il collaboratore ha versato nel ' + annoAttivo() + '.</div>' + elencoAcconti();
  } else if(voce === 'daincassare'){
    titolo = 'Da incassare: ' + fmtEuro(inc - acc);
    corpo = '<div style="' + box + '">Incasso <b>' + fmtEuro(inc) + '</b> − Pagamenti effettuati <b>' + fmtEuro(acc) + '</b> = <b>' + fmtEuro(inc - acc) + '</b></div>'
      + titoloSez('➕ Incasso delle pratiche') + elencoIncassi(pagate)
      + titoloSez('➖ Pagamenti effettuati (acconti)') + elencoAcconti();
  } else if(voce === 'prezzomedio'){
    titolo = 'Prezzo medio: ' + (n ? fmtEuro(fatt / n) : '—');
    corpo = '<div style="' + box + '">Fatture emesse <b>' + fmtEuro(fatt) + '</b> ÷ <b>' + n + '</b> pratiche = <b>' + (n ? fmtEuro(fatt / n) : '—') + '</b><br><span style="font-size:12.5px; color:var(--sub)">Le congiunte valgono 2 pratiche.</span></div>' + elencoFatture();
  } else if(voce === 'incassomedio'){
    titolo = 'Incasso medio: ' + (n ? fmtEuro(inc / n) : '—');
    corpo = '<div style="' + box + '">Incasso <b>' + fmtEuro(inc) + '</b> ÷ <b>' + n + '</b> pratiche = <b>' + (n ? fmtEuro(inc / n) : '—') + '</b><br><span style="font-size:12.5px; color:var(--sub)">Le congiunte valgono 2 pratiche; nel conteggio entrano anche quelle non pagate.</span></div>' + elencoIncassi(pagate);
  } else if(voce.indexOf('metodo:') === 0){
    const m = voce.slice(7);
    const l = pagate.filter(function(p){ return (METODI_PAGAMENTO.indexOf(p.metodoPagamento) >= 0 ? p.metodoPagamento : '') === m; });
    titolo = (nomeMetodo[m] || m) + ': ' + fmtEuro(l.reduce(function(t,p){ return t + Number(p.pagato||0); }, 0));
    corpo = elencoIncassi(l);
  } else return;

  const vecchio = document.getElementById('popup-dettaglio-contab');
  if(vecchio) vecchio.remove();
  const col = coloreCollaboratore(k);
  const ov = document.createElement('div');
  ov.id = 'popup-dettaglio-contab';
  ov.style.cssText = 'position:fixed; inset:0; z-index:400; background:rgba(15,27,45,.45); display:flex; align-items:center; justify-content:center; padding:12px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border:3px solid ' + col + '; box-shadow:0 20px 50px rgba(0,0,0,.3); max-width:560px; width:100%; max-height:88vh; display:flex; flex-direction:column">'
    + '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; padding:14px 16px 10px; border-bottom:1px solid var(--line)">'
    + '<div><div style="font-size:12px; font-weight:700; color:' + col + '; text-transform:uppercase">' + esc(k) + ' – ' + annoAttivo() + '</div><div style="font-size:18px; font-weight:800">' + titolo + '</div></div>'
    + '<button type="button" data-chiudi="1" style="background:var(--line); color:var(--ink); border:none; border-radius:999px; width:34px; height:34px; font-size:16px; cursor:pointer; flex-shrink:0" title="Chiudi">✕</button></div>'
    + '<div style="padding:10px 16px 16px; overflow:auto">' + corpo + '</div></div>';
  document.body.appendChild(ov);
  const fine = function(){ ov.remove(); document.removeEventListener('keydown', tasto); };
  const tasto = function(e){ if(e.key === 'Escape') fine(); };
  document.addEventListener('keydown', tasto);
  ov.addEventListener('click', function(e){
    const apri = e.target.closest('button[data-apri]');
    if(apri){ fine(); apriPraticaDaTabella(apri.dataset.apri); return; }
    if(e.target === ov || e.target.closest('button[data-chiudi]')) fine();
  });
}
/* ---------- Consegna della pratica al cliente ----------
   Spunta "Consegnata": chiede se il cliente ha pagato (Pagato con l'importo) o no (Non paga).
   Le consegnate non si vedono nel registro di lavoro: tasto "Mostra consegnate". */
let MOSTRA_CONSEGNATE = false;
function eConsegnata(p){ return !!(p && p.consegnataIl); }
// nel registro si vedono le consegnate solo col tasto, o se si cerca un contribuente / un testo
// Registro: due liste separate. Normale = pratiche da consegnare/definire; con il tasto = SOLO consegnate/definite
function vediNelRegistro(p){ return passaArchivio(p); }
// dentro un riquadro di tipo: con lo stato scelto nel riquadro si vedono anche le consegnate/definite
function vediNelGruppo(statoGr){ return function(p){ return !!statoGr || vediNelRegistro(p); }; }
// I 730 si "consegnano"; le altre pratiche si "definiscono" (stessa spunta, altra parola)
function parolaConsegna(p){ return e730(p) ? { fai: 'Consegna', fatta: 'Consegnata', fatta_m: 'consegnata', icona: '📦' } : { fai: 'Definisci', fatta: 'Definita', fatta_m: 'definita', icona: '✔️' }; }
function aggiornaTastoConsegnate(pratAnno){
  const b = document.getElementById('btn-consegnate'); if(!b) return;
  const n = pratAnno.filter(eConsegnata).length;
  b.textContent = MOSTRA_CONSEGNATE ? '↩️ Torna alle pratiche da consegnare / definire' : '📦 Vedi solo le consegnate / definite (' + n + ')';
  b.style.background = MOSTRA_CONSEGNATE ? '#6b7280' : '#8d5a3b';
}
// Si consegna solo una pratica già lavorata (non In arrivo, In lavorazione o Da lavorare scansionata)
function puoConsegnare(p){ return !!p && (eColf(p.tipo) || eConsegnata(p) || !eDaLavorare(p)); }
function bottoneConsegna(p){
  if(!p || p.annullata) return '';
  if(!puoConsegnare(p)) return '';
  const w = parolaConsegna(p);
  if(eConsegnata(p)) return '<button type="button" title="' + w.fatta + ' il ' + esc(p.consegnataIl) + (p.consegnataDa ? ' da ' + esc(p.consegnataDa) : '') + ' – tocca per riaprire la pratica (solo amministratore)" onclick="annullaConsegna(\'' + p.id + '\')" style="background:#e8f6ee; color:#1a7f37; border:1px solid #1a7f37; border-radius:6px; padding:4px 8px; font-size:11.5px; font-weight:700; cursor:pointer">' + w.icona + ' ' + esc(p.consegnataIl) + (auth.profilo && auth.profilo.ruolo === 'admin' ? ' · ↩️' : '') + '</button>';
  return '<button type="button" title="Segna la pratica come ' + w.fatta_m + '" onclick="consegnaPratica(\'' + p.id + '\')" style="background:#8d5a3b; color:#fff; border:none; border-radius:6px; padding:4px 8px; font-size:12px; font-weight:700; cursor:pointer">' + w.icona + ' ' + w.fai + '</button>';
}
/* ---------- ▶ Avanti: la pratica passa al passo successivo con un clic ----------
   In arrivo / Scansionata → In lavorazione → Lavorata (fattura + avviso al cliente) → Consegna */
function bottoneAvanti(p){
  if(!p || p.annullata || eConsegnata(p) || eColf(p.tipo) || (typeof eRinuncia === 'function' && eRinuncia(p))) return '';
  // colori diversi per ogni passo: In lavorazione giallo, Lavorata verde, Fattura blu
  const stile = function(bg, fg){ return 'background:' + bg + '; color:' + fg + '; border:none; border-radius:6px; padding:4px 8px; font-size:12px; font-weight:800; cursor:pointer; white-space:nowrap'; };
  if(['arrivo','da_lavorare_scansionata'].indexOf(p.stato) >= 0 && statoVisibile('lavorazione', p.tipo))
    return '<button type="button" title="Inizia a lavorare la pratica" onclick="avantiPratica(\'' + p.id + '\')" style="' + stile('#f2c200', '#3a2e00') + '">▶ Inizia lavorazione</button>';
  if(p.stato === 'lavorazione') return '<button type="button" title="Pratica finita: fattura e avviso al cliente" onclick="avantiPratica(\'' + p.id + '\')" style="' + stile('#1a7f37', '#fff') + '">✓ Segna come lavorata</button>';
  if(e730(p) && (p.stato === 'lavorata_da_fatturare' || (['lavorata','da_pagare','pagato','pagato_da_ritirare'].indexOf(p.stato) >= 0 && !String(p.numFattura||'').trim()))) return '<button type="button" title="Emetti la fattura" onclick="avantiPratica(\'' + p.id + '\')" style="' + stile('#2f7de1', '#fff') + '">🧾 Emetti fattura</button>';
  return '';
}
function avantiPratica(id){
  const p = (state.pratiche||[]).find(function(x){ return x.id === id; }); if(!p) return;
  if(p.stato === 'lavorazione' || p.stato === 'lavorata_da_fatturare' || (e730(p) && !String(p.numFattura||'').trim() && ['lavorata','da_pagare','pagato','pagato_da_ritirare'].indexOf(p.stato) >= 0)) return popupLavorata(p);
  cambiaStato(id, 'lavorazione');
}
// Pratiche che occupano un numero di fattura: anche le annullate (una fattura emessa non si riusa)
function praticheConFattura(){ return (state.pratiche||[]).concat(state.annullate||[]); }
function prossimoNumeroFattura(anno){
  let max = 0;
  // la numerazione delle fatture riguarda solo i 730
  praticheConFattura().forEach(function(x){ if(e730(x) && annoPratica(x) === anno){ const n = numeroFatturaPratica(x); if(n != null && n > max) max = n; } });
  return max + 1;
}
// Pratica dello stesso contribuente nell'anno precedente (stesso codice fiscale, o stesso nome e data di nascita) e dello stesso tipo
function praticaAnnoPrecedente(p){
  if(!p) return null;
  const prec = annoPratica(p) - 1;
  const cf = String(p.codiceFiscale || '').toUpperCase(), nome = String(p.nome || '').trim().toUpperCase();
  const stessoTipo = function(q){ return e730(p) ? e730(q) : String(q.tipo || '') === String(p.tipo || ''); };
  const cand = (state.pratiche || []).filter(function(q){
    if(q.id === p.id || q.annullata || annoPratica(q) !== prec || !stessoTipo(q)) return false;
    const qcf = String(q.codiceFiscale || '').toUpperCase();
    if(cf && qcf) return cf === qcf;
    return String(q.nome || '').trim().toUpperCase() === nome && (!p.cf || !q.cf || p.cf === q.cf);
  });
  return cand.sort(function(a, b){ return Number(b.compenso || 0) - Number(a.compenso || 0); })[0] || null;
}
// Riquadro con gli importi dell'anno precedente e tasto per riportarli nei campi
function importiAnnoPrecHTML(p, idFatt, idRic){
  const q = praticaAnnoPrecedente(p);
  if(!q) return '<div style="margin-top:8px; padding:6px 10px; border-radius:8px; background:var(--bg); color:var(--sub); font-size:12.5px">📅 ' + (annoPratica(p) - 1) + ': nessuna pratica ' + esc(e730(p) ? '730' : (p.tipo || '')) + ' di questo cliente.</div>';
  const f = Number(q.compenso || 0), r = Number(q.richiesto || 0), g = Number(q.pagato || 0);
  return '<div style="margin-top:8px; padding:7px 10px; border-radius:8px; background:#eef3fa; border:1px solid #1d4f91; font-size:13px; display:flex; gap:8px; align-items:center; justify-content:space-between; flex-wrap:wrap">'
    + '<span>📅 <b>Anno ' + (annoPratica(p) - 1) + '</b> (' + esc(formattaProtocollo(q)) + '): fattura <b>' + (f ? fmtEuro(f) : '—') + '</b> · richiesto <b>' + (r ? fmtEuro(r) : '—') + '</b> · pagato <b style="color:#1a7f37">' + (g ? fmtEuro(g) : '—') + '</b></span>'
    + ((f || r) ? '<button type="button" onclick="usaImportiAnnoPrec(\'' + p.id + '\', \'' + idFatt + '\', \'' + idRic + '\', true)" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:5px 12px; font-size:12.5px; font-weight:800; cursor:pointer">↙ Usa questi importi</button>' : '')
    + '</div>';
}
// Riporta fattura e richiesto dell'anno precedente: con tutti=false solo nei campi vuoti (proposta automatica, in giallo)
function usaImportiAnnoPrec(id, idFatt, idRic, tutti){
  const p = (state.pratiche || []).find(function(x){ return x.id === id; });
  const q = praticaAnnoPrecedente(p); if(!q) return;
  const metti = function(idc, v){
    const el = document.getElementById(idc); if(!el || !(Number(v) > 0)) return;
    if(!tutti && el.value.trim()) return;
    el.value = importoInCampo(Number(v)); el.style.background = '#fff6d6'; el.title = 'Proposto dall\'anno ' + annoPratica(q) + ': controlla';
    el.dispatchEvent(new Event('input'));
  };
  metti(idFatt, q.compenso); metti(idRic, q.richiesto || q.pagato);
}
function popupLavorata(p){
  const v = document.getElementById('popup-lavorata'); if(v) v.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-lavorata';
  ov.style.cssText = 'position:fixed; inset:0; z-index:470; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:14px';
  const auto = typeof fatturaAutomatica === 'function' ? fatturaAutomatica(p.tipo) : undefined;
  const imp = Number(p.compenso || 0) || (auto !== undefined && auto !== '' ? Number(auto) : 0);
  const giaNF = String(p.numFattura || '').trim();
  // numero proposto: quello del protocollo, se libero; altrimenti il successivo all'ultima fattura
  const usato = function(n){ return praticheConFattura().some(function(x){ return x.id !== p.id && e730(x) && annoPratica(x) === annoPratica(p) && String(x.numFattura||'').trim() === String(n); }); };
  const conNumero = e730(p); // solo i 730 hanno il numero di fattura
  const nfProposto = giaNF || (p.numero && !usato(p.numero) ? String(p.numero) : String(prossimoNumeroFattura(annoPratica(p))));
  const tel = !!numeroWhatsApp(p.telefono);
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid #2f7de1; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:16px 18px; max-width:500px; width:100%">'
    + '<div style="font-size:19px; font-weight:800; color:#2f7de1">🔵 Pratica lavorata</div>'
    + '<div style="font-size:13px; color:var(--sub); margin-bottom:10px">' + esc(formattaProtocollo(p)) + ' · ' + esc(p.nome || '') + ' · ' + esc(p.tipo || '') + (Number(p.richiesto||0) ? ' · richiesto ' + fmtEuro(p.richiesto) : '') + '</div>'
    + '<div class="grid">' + (conNumero ? '<div><label>N. fattura <b style="color:#c0392b">*</b></label><input id="lv-nf" value="' + esc(nfProposto) + '" inputmode="numeric" style="font-weight:800"><div style="font-size:11.5px; color:var(--sub)">' + (!giaNF && String(p.numero) === nfProposto ? 'come il protocollo n. ' + p.numero : '') + '</div></div>'
    + '<div><label>Data fattura <b style="color:#c0392b">*</b></label><input id="lv-df" value="' + esc(p.dataFattura || todayIT()) + '" inputmode="numeric" placeholder="GG/MM/AAAA" oninput="autoSlashData(this)"></div>' : '')
    + '<div><label>Importo fattura (€)</label><input id="lv-imp" type="text" inputmode="decimal" value="' + (imp ? importoInCampo(imp) : '') + '" placeholder="0,00" oninput="filtraImporto(this)" onblur="formattaCampoImporto(this)" style="font-weight:800"></div>'
    + '<div><label title="Quanto chiedi al cliente: promemoria, non entra in contabilità">Importo richiesto (€) <b style="color:#c0392b">*</b></label><input id="lv-ric" type="text" inputmode="decimal" value="' + (Number(p.richiesto||0) ? importoInCampo(p.richiesto) : '') + '" placeholder="0,00" oninput="filtraImporto(this)" onblur="formattaCampoImporto(this)">' + '</div>'
    + '</div>'
    + importiAnnoPrecHTML(p, 'lv-imp', 'lv-ric')
    + '<div style="margin-top:8px; padding:7px 10px; border-radius:8px; background:#fff4e5; color:#7a3e00; font-size:12.5px">ℹ️ La fattura resta scritta nella pratica ma <b>entra in contabilità solo alla 📦 Consegna</b>, dove ritrovi questi importi da confermare. L\'importo della fattura si può lasciare vuoto e scriverlo alla consegna.</div>'
    + '<label class="chk" style="display:flex; gap:8px; align-items:center; margin-top:10px"><input type="checkbox" id="lv-wa" style="width:auto"> <span>💬 Avvisa il cliente su WhatsApp che la pratica è pronta' + (tel ? '' : ' <span style="color:#c0392b; font-size:12px">(manca il cellulare: te lo chiederà)</span>') + '</span></label>'
    + '<div id="lv-msg" style="color:#c0392b; font-size:12.5px; font-weight:700; margin-top:8px"></div>'
    + '<div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; margin-top:12px">'
    + '<button type="button" data-az="no" style="background:var(--line); color:var(--ink)">Annulla</button>'
    + (conNumero ? '<button type="button" data-az="senza" style="background:none; border:1px solid #2f7de1; color:#2f7de1">Lavorata senza fattura</button>'
      + '<button type="button" data-az="si" style="background:#2f7de1; color:#fff; font-weight:800">✓ Lavorata con fattura</button>'
      : '<button type="button" data-az="si" style="background:#2f7de1; color:#fff; font-weight:800">✓ Lavorata</button>') + '</div></div>';
  document.body.appendChild(ov);
  usaImportiAnnoPrec(p.id, 'lv-imp', 'lv-ric', false);
  ov.addEventListener('click', async function(e){
    const b = e.target.closest('button[data-az]');
    if(e.target === ov || (b && b.dataset.az === 'no')){ ov.remove(); return; }
    if(!b) return;
    const msg = document.getElementById('lv-msg');
    const segna = function(id, txt){ const el = document.getElementById(id); if(el){ el.style.outline = '3px solid #c0392b'; el.focus(); } msg.textContent = txt; };
    ['lv-nf','lv-df','lv-imp','lv-ric'].forEach(function(id){ const el = document.getElementById(id); if(el) el.style.outline = ''; });
    if(!document.getElementById('lv-ric').value.trim() || !(parseImporto(document.getElementById('lv-ric').value) >= 0)) return segna('lv-ric', 'Scrivi l\'importo richiesto al cliente (obbligatorio; 0 se la pratica è gratuita).');
    const campi = { stato: ['lavorazione','lavorata_da_fatturare','arrivo','da_lavorare_scansionata'].indexOf(p.stato) >= 0 ? 'lavorata' : p.stato };
    if(!p.dataFine) campi.dataFine = todayIT();
    if(b.dataset.az === 'si' && !conNumero){
      // altre pratiche: solo l'importo della fattura (0 se gratuita), senza numero
      const imv = document.getElementById('lv-imp').value.trim(), im = parseImporto(imv);
      if(imv && !(im >= 0)) return segna('lv-imp', 'Importo della fattura non valido.');
      if(imv) campi.compenso = im > 0 ? im : '';
    } else if(b.dataset.az === 'si'){
      const nf = document.getElementById('lv-nf').value.trim(), df = document.getElementById('lv-df').value.trim(), im = parseImporto(document.getElementById('lv-imp').value);
      if(!nf) return segna('lv-nf', 'Scrivi il numero della fattura (obbligatorio).');
      if(!parseDataIT(df)) return segna('lv-df', 'La data della fattura deve essere GG/MM/AAAA.');
      if(document.getElementById('lv-imp').value.trim() && !(im >= 0)) return segna('lv-imp', 'Importo della fattura non valido.');
      const doppia = praticheConFattura().find(function(x){ return x.id !== p.id && e730(x) && annoPratica(x) === annoPratica(p) && String(x.numFattura||'').trim() === nf; });
      if(doppia && !confirm('La fattura n. ' + nf + ' c\'è già (' + formattaProtocollo(doppia) + ' – ' + (doppia.nome||'') + (doppia.annullata ? ', pratica ANNULLATA: il numero resta occupato' : '') + ').\n\nUso lo stesso il numero ' + nf + '?')) return;
      campi.numFattura = nf; campi.dataFattura = df; campi.fatt = 'fatturata';
      if(im > 0) campi.compenso = im;
    }
    // il richiesto si salva in tutti e due i casi; il pagato si scrive alla consegna
    const ric = parseImporto(document.getElementById('lv-ric').value);
    campi.richiesto = ric > 0 ? ric : '';
    const avvisa = document.getElementById('lv-wa').checked;
    b.disabled = true;
    const r = await data.pratiche.aggiorna(p.id, campi);
    if(r && r.error){ b.disabled = false; msg.textContent = 'Non salvato: ' + r.error; return; }
    ov.remove();
    avviso('🔵 ' + formattaProtocollo(p) + ' lavorata' + (campi.numFattura ? ' · fattura n. ' + campi.numFattura + ' ' + fmtEuro(campi.compenso) : '') + (Number(campi.pagato||0) ? ' · pagato ' + fmtEuro(campi.pagato) : ''));
    render();
    if(avvisa) setTimeout(function(){ const q = (state.pratiche||[]).find(function(x){ return x.id === p.id; }); if(q){ q.stato = 'lavorata'; inviaWhatsApp(p.id); } }, 300);
  });
}
// Stati di "non pagato": Non paga + quelli aggiunti dall'amministratore con "non … pag" nel nome (es. "Non ha pagato")
function eStatoNonPagato(k){
  if(k === 'non_paga') return true;
  const l = ((STATI[k]||{}).l || '').toLowerCase();
  return !!STATI[k] && /\bnon\b.*\bpag/.test(l);
}
function statiNonPagato(tipo){
  return Object.keys(STATI).filter(function(k){
    if(!eStatoNonPagato(k)) return false;
    const nuovo = typeof STATI_PREDEFINITI !== 'undefined' && !STATI_PREDEFINITI[k];
    if(k === 'non_paga' || nuovo) return true;
    // FILCA / FPS non paga: solo per le pratiche di quel tipo
    const T = String(tipo||'').toUpperCase();
    if(k === 'filca_non_paga') return T.indexOf('FILCA') >= 0;
    if(k === 'fps_non_paga') return T.indexOf('FPS') >= 0;
    return statoVisibile(k, tipo);
  });
}
// Nella consegna: quanto manca rispetto al richiesto (o alla fattura)
function restoConsegna(){
  const box = document.getElementById('cs-resto'); if(!box) return;
  const ri = parseImporto((document.getElementById('cs-ric')||{}).value || ''), fa = parseImporto((document.getElementById('cs-fatt')||{}).value || ''), pg = parseImporto((document.getElementById('cs-imp')||{}).value || '');
  const dovuto = ri > 0 ? ri : fa;
  if(!(dovuto > 0) || !(pg > 0)){ box.innerHTML = ''; return; }
  const manca = Math.round((dovuto - pg) * 100) / 100;
  box.innerHTML = manca > 0.004 ? '<span style="color:#c0392b">⚠️ Mancano ' + fmtEuro(manca) + ' (' + (ri > 0 ? 'richiesto' : 'fattura') + ' ' + fmtEuro(dovuto) + ')</span>' : '<span style="color:#1a7f37">✓ Pagato tutto</span>';
}
function consegnaPratica(id){
  const p = (state.pratiche||[]).find(function(x){ return x.id === id; }); if(!p) return;
  if(!puoConsegnare(p)){ alert('La pratica è ancora «' + statoLabel(p.stato) + '».\n\nPrima di consegnarla passala a «Lavorata» (tasto ✓ Segna come lavorata).'); return; }
  const colfC = eColf(p.tipo);
  const nonPag = colfC ? [] : statiNonPagato(p.tipo);
  const tastiNonPag = nonPag.length
    ? nonPag.map(function(k){ return '<button type="button" data-az="nonpaga" data-stato="' + k + '" style="background:' + ((STATI[k]||{}).c || '#d63b3b') + '; color:#fff; font-weight:800">✗ ' + esc(STATI[k].l) + '</button>'; }).join('')
    : '<button type="button" data-az="nonpaga" style="background:#d63b3b; color:#fff; font-weight:800">✗ Non ha pagato</button>';
  const v = document.getElementById('popup-consegna'); if(v) v.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-consegna';
  ov.style.cssText = 'position:fixed; inset:0; z-index:470; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:14px';
  const imp = Number(p.pagato || 0) || Number(p.richiesto || 0) || Number(p.compenso || 0);
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid #8d5a3b; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:16px 18px; max-width:500px; width:100%">'
    + '<div style="font-size:19px; font-weight:800; color:#8d5a3b">' + parolaConsegna(p).icona + ' ' + (e730(p) ? 'Consegna della pratica' : 'Pratica definita') + '</div>'
    + '<div style="font-size:13px; color:var(--sub); margin-bottom:10px">' + esc(formattaProtocollo(p)) + ' · ' + esc(p.nome || '') + ' · ' + esc(p.tipo || '') + (Number(p.compenso || 0) ? ' · fattura ' + fmtEuro(p.compenso) : '') + (Number(p.richiesto || 0) ? ' · <b>richiesto ' + fmtEuro(p.richiesto) + '</b>' : '') + '</div>'
    + '<div style="font-size:15px; font-weight:800; margin-bottom:8px">Il cliente ha pagato?</div>'
    + '<div class="grid"><div><label>Importo fattura (€) <b style="color:#c0392b">*</b></label><input id="cs-fatt" type="text" inputmode="decimal" value="' + (Number(p.compenso||0) ? importoInCampo(p.compenso) : '') + '" placeholder="0,00" oninput="filtraImporto(this); restoConsegna()" onblur="formattaCampoImporto(this)"></div>'
    + '<div><label title="Promemoria: non entra in contabilità">Importo richiesto (€) <b style="color:#c0392b">*</b> <span style="font-weight:400; font-size:11px; color:var(--sub)">(se non paga: libero)</span></label><input id="cs-ric" type="text" inputmode="decimal" value="' + (Number(p.richiesto||0) ? importoInCampo(p.richiesto) : '') + '" placeholder="0,00" oninput="filtraImporto(this); restoConsegna()" onblur="formattaCampoImporto(this)"></div>'
    + '<div><label>Importo pagato (€) <b style="color:#c0392b">*</b> <span style="font-weight:400; font-size:11px; color:var(--sub)">(solo se ha pagato)</span></label><input id="cs-imp" type="text" inputmode="decimal" value="' + (imp ? importoInCampo(imp) : '') + '" placeholder="0,00" oninput="filtraImporto(this); restoConsegna()" onblur="formattaCampoImporto(this)" style="font-weight:800; font-size:16px"></div>'
    + '<div><label>Pagamento</label><select id="cs-met">' + metodoOptions(p.metodoPagamento || 'CONTANTI') + '</select></div>'
    + '<div><label>' + (e730(p) ? 'Data di consegna' : 'Data') + ' <b style="color:#c0392b">*</b></label><input id="cs-data" value="' + todayIT() + '" inputmode="numeric" placeholder="GG/MM/AAAA" oninput="autoSlashData(this)"></div></div>'
    + (e730(p) ? '<label class="chk" style="display:flex; gap:8px; align-items:center; margin-top:8px"><input type="checkbox" id="cs-ricpag"' + (p.ricevutaUfficiale ? ' checked' : '') + ' style="width:auto"> <span>💶 Serve la <b>ricevuta di pagamento</b> (solo se il cliente la chiede)</span></label>' : '')
    + '<div style="margin-top:8px"><label>🙋 Ritirata da</label><input id="cs-ritira" value="' + esc(p.ritirataDa || '') + '" placeholder="Vuoto = il contribuente · se è un\'altra persona scrivi nome e cognome" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>'
    + '<div style="margin-top:8px"><label>📝 Note</label><textarea id="cs-note" rows="2" placeholder="Facoltative: es. paga la prossima settimana…" style="width:100%; resize:vertical">' + esc(p.note || '') + '</textarea></div>'
    + (eColf(p.tipo) ? '' : importiAnnoPrecHTML(p, 'cs-fatt', 'cs-ric'))
    + (p.iscrittoCisl && typeof selectPrezziCisl === 'function' ? selectPrezziCisl('cs-ric', 'cs-fatt') : '')
    + '<div style="margin-top:8px; padding:7px 10px; border-radius:8px; background:#e8f6ee; color:#1a7f37; font-size:12.5px">✓ Controlla gli importi: confermando la consegna, <b>fattura e incasso entrano in contabilità</b>. Se <b>non paga</b> basta la fattura: entra tra le fatture emesse, ma in cassa non entra niente.</div>'
    + '<div id="cs-resto" style="font-size:13.5px; font-weight:800; margin-top:6px"></div>'
    + '<div id="cs-msg" style="color:#c0392b; font-size:12.5px; font-weight:700; margin-top:8px"></div>'
    + '<div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; margin-top:12px">'
    + '<button type="button" data-az="no" style="background:var(--line); color:var(--ink)">Annulla</button>'
    + tastiNonPag
    + '<button type="button" data-az="pagato" style="background:#2f9e5f; color:#fff; font-weight:800">✓ Ha pagato</button></div></div>';
  document.body.appendChild(ov);
  if(!eColf(p.tipo)) usaImportiAnnoPrec(p.id, 'cs-fatt', 'cs-ric', false);
  restoConsegna();
  ov.addEventListener('click', async function(e){
    const b = e.target.closest('button[data-az]');
    if(e.target === ov || (b && b.dataset.az === 'no')){ ov.remove(); return; }
    if(!b) return;
    const msg = document.getElementById('cs-msg');
    const segnaC = function(id, txt){ const el = document.getElementById(id); if(el){ el.style.outline = '3px solid #c0392b'; el.focus(); } msg.textContent = txt; };
    ['cs-fatt','cs-ric','cs-imp','cs-data'].forEach(function(id){ const el = document.getElementById(id); if(el) el.style.outline = ''; });
    const dataC = document.getElementById('cs-data').value.trim();
    if(!parseDataIT(dataC)) return segnaC('cs-data', 'Scrivi la data di consegna (GG/MM/AAAA).');
    if(!eColf(p.tipo)){
      const vuoto = function(id){ const v = document.getElementById(id).value.trim(); return !v || !(parseImporto(v) >= 0); };
      if(vuoto('cs-fatt')) return segnaC('cs-fatt', 'Scrivi l\'importo della fattura (obbligatorio; 0 se gratuita).');
      // se non paga, il richiesto può restare vuoto: conta solo la fattura
      if(b.dataset.az === 'pagato' && vuoto('cs-ric')) return segnaC('cs-ric', 'Scrivi l\'importo richiesto (obbligatorio; 0 se gratuita).');
    }
    const campi = { consegnataIl: dataC, consegnataDa: ((auth.profilo && auth.profilo.nome) || '').toUpperCase() };
    const ritira = ((document.getElementById('cs-ritira') || {}).value || '').trim().toUpperCase().slice(0, 120);
    if(ritira !== String(p.ritirataDa || '')) campi.ritirataDa = ritira;
    const ricPag = document.getElementById('cs-ricpag');
    if(ricPag && ricPag.checked !== !!p.ricevutaUfficiale) campi.ricevutaUfficiale = ricPag.checked;
    // note scritte nella finestra di consegna (sostituiscono quelle della pratica)
    const noteCs = (document.getElementById('cs-note') || {}).value;
    if(noteCs != null && noteCs.trim() !== String(p.note || '').trim()) campi.note = noteCs.trim().slice(0, 1000);
    // fattura e richiesto si confermano (o correggono) alla consegna
    const fa = parseImporto(document.getElementById('cs-fatt').value), ri = parseImporto(document.getElementById('cs-ric').value);
    if(fa > 0 && fa !== Number(p.compenso || 0)) campi.compenso = fa;
    if(!(fa > 0) && Number(p.compenso || 0)) campi.compenso = '';
    if((ri > 0 ? ri : 0) !== Number(p.richiesto || 0)) campi.richiesto = ri > 0 ? ri : '';
    const colf = eColf(p.tipo);
    if(b.dataset.az === 'pagato'){
      const v = parseImporto(document.getElementById('cs-imp').value);
      const gratuita = !(parseImporto(document.getElementById('cs-ric').value) > 0) && !(parseImporto(document.getElementById('cs-fatt').value) > 0);
      if(!(v > 0) && !gratuita) return segnaC('cs-imp', 'Scrivi quanto ha pagato (obbligatorio).');
      campi.pagato = v; campi.metodoPagamento = document.getElementById('cs-met').value;
      if(!colf) campi.stato = 'pagato';
      // pagamento non completo: resta tra i morosi con la nota di quanto manca
      const dovuto = ri > 0 ? ri : (fa > 0 ? fa : Number(p.compenso || 0));
      const manca = Math.round((dovuto - v) * 100) / 100;
      if(manca > 0.004 && confirm('Ha pagato ' + fmtEuro(v) + ' su ' + fmtEuro(dovuto) + ': deve ancora ' + fmtEuro(manca) + '.\n\nOK = la pratica resta tra i morosi («Da pagare») con la nota «Deve ancora ' + fmtEuro(manca) + '»\nAnnulla = considero saldato così')){
        if(!colf) campi.stato = statoVisibile('da_pagare', p.tipo) ? 'da_pagare' : 'non_paga';
        campi.note = (((campi.note != null ? campi.note : p.note) ? (campi.note != null ? campi.note : p.note) + ' · ' : '') + 'Deve ancora ' + fmtEuro(manca) + ' (pagati ' + fmtEuro(v) + ' su ' + fmtEuro(dovuto) + ' alla consegna del ' + dataC + ')').slice(0, 1000);
      } else if(manca > 0.004){ campi.richiesto = v; }
    } else if(!colf){
      campi.stato = (b.dataset.stato && STATI[b.dataset.stato]) ? b.dataset.stato : 'non_paga';
      // non paga: la fattura entra in contabilità, ma in cassa non entra niente
      if(Number(p.pagato || 0)) campi.pagato = '';
    }
    // contratto colf definito: da «In arrivo» (o un altro stato di lavoro) passa a «Pratica attiva»; se è cessato resta cessato
    if(colf && p.stato !== 'pratica_cessata' && p.stato !== 'pratica_attiva') campi.stato = 'pratica_attiva';
    b.disabled = true;
    const r = await data.pratiche.aggiorna(p.id, campi);
    if(r && r.error){ b.disabled = false; msg.textContent = 'Non salvato: ' + r.error; return; }
    ov.remove();
    avviso(parolaConsegna(p).icona + ' ' + formattaProtocollo(p) + ' ' + parolaConsegna(p).fatta_m + (campi.stato ? ' · ' + statoLabel(campi.stato) : ''));
    render();
    proponiRicevutaConsegna(Object.assign({}, p, campi));
  });
}
// Dopo la consegna: stampa della ricevuta da far firmare a chi ritira
function proponiRicevutaConsegna(p){
  if(typeof stampaRicevutaConsegna !== 'function') return;
  const v = document.getElementById('popup-ric-consegna'); if(v) v.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-ric-consegna';
  ov.style.cssText = 'position:fixed; inset:0; z-index:470; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:14px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid #8d5a3b; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:16px 18px; max-width:420px; width:100%; text-align:center">'
    + '<div style="font-size:30px">🧾</div><div style="font-size:17px; font-weight:800; margin:4px 0">Ricevuta di consegna</div>'
    + '<div style="font-size:13px; color:var(--sub); margin-bottom:14px">' + esc(formattaProtocollo(p)) + ' · ' + esc(p.nome || '') + (p.ritirataDa ? '<br>ritirata da <b>' + esc(p.ritirataDa) + '</b>' : '') + '<br>Stampala e falla firmare a chi ritira: la copia firmata resta al CAF.</div>'
    + '<div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap"><button type="button" data-az="no" style="background:var(--line); color:var(--ink)">Non ora</button>'
    + '<button type="button" data-az="si" style="background:#8d5a3b; color:#fff; font-weight:800">🖨️ Stampa ricevuta</button>'
    + (p.ricevutaUfficiale && Number(p.pagato || 0) > 0 ? '<button type="button" data-az="pag" style="background:#1a7f37; color:#fff; font-weight:800">💶 Ricevuta di pagamento</button>' : '') + '</div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){
    const b = e.target.closest('button[data-az]');
    if(e.target === ov || (b && b.dataset.az === 'no')){ ov.remove(); return; }
    if(b && b.dataset.az === 'si'){ ov.remove(); stampaRicevutaConsegna(p.id, p); }
    if(b && b.dataset.az === 'pag'){ ov.remove(); stampaRicevutaPagamento(p.id, p); }
  });
}
// Riaprire una pratica consegnata/definita (es. per riportarla a "Lavorata"): solo l'amministratore
function annullaConsegna(id){
  const p = (state.pratiche||[]).find(function(x){ return x.id === id; }); if(!p) return;
  const w = parolaConsegna(p);
  if(!(auth.profilo && auth.profilo.ruolo === 'admin')){ alert('Solo l\'amministratore può riaprire una pratica ' + w.fatta_m + '.\n\nChiedi ad Angelo.'); return; }
  const v = document.getElementById('popup-riapri'); if(v) v.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-riapri';
  ov.style.cssText = 'position:fixed; inset:0; z-index:470; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:14px';
  const pag = Number(p.pagato || 0);
  const statoDef = eColf(p.tipo) ? p.stato : (statoVisibile('lavorata', p.tipo) ? 'lavorata' : p.stato);
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid #1d4f91; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:16px 18px; max-width:480px; width:100%">'
    + '<div style="font-size:19px; font-weight:800; color:#1d4f91">↩️ Riapri la pratica</div>'
    + '<div style="font-size:13px; color:var(--sub); margin-bottom:10px">' + esc(formattaProtocollo(p)) + ' · ' + esc(p.nome || '') + ' · ' + w.fatta + ' il ' + esc(p.consegnataIl || '') + ' · stato ' + esc(statoLabel(p.stato)) + '</div>'
    + '<div style="font-size:13.5px; margin-bottom:8px">La pratica torna nel registro di lavoro (tolta la spunta «' + w.fatta + '»)' + (eColf(p.tipo) ? '' : ' e la sua <b>fattura esce dalla contabilità</b> (resta «in attesa di consegna» finché non la riconsegni)') + '.</div>'
    + '<label>Nuovo stato</label><select id="rp-stato">' + statoOptions(statoDef, p.tipo) + '</select>'
    + (pag > 0 ? '<label class="chk" style="display:flex; gap:8px; align-items:flex-start; margin-top:10px"><input type="checkbox" id="rp-pagato" style="width:auto; margin-top:3px"> <span>Togli anche il pagato di <b>' + fmtEuro(pag) + '</b> (esce dalla contabilità). Se non lo spunti, il pagato resta.</span></label>' : '')
    + (String(p.numFattura||'').trim() || Number(p.compenso||0) ? '<label class="chk" style="display:flex; gap:8px; align-items:flex-start; margin-top:10px"><input type="checkbox" id="rp-fattura" style="width:auto; margin-top:3px"> <span>Togli anche la <b>fattura' + (p.numFattura ? ' n. ' + esc(p.numFattura) : '') + (Number(p.compenso||0) ? ' (' + fmtEuro(p.compenso) + ')' : '') + '</b> per rifarla diversa: numero, data e importo si riscrivono a «Segna come lavorata» o alla consegna. <span style="color:#b35f0c">Se era già stata emessa, ricordati della nota di credito.</span></span></label>' : '')
    + '<div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; margin-top:14px"><button type="button" data-az="no" style="background:var(--line); color:var(--ink)">Annulla</button>'
    + '<button type="button" data-az="annulla" style="background:#fdecea; color:#c0392b; border:1px solid #c0392b">🚫 Annulla la pratica</button>'
    + '<button type="button" data-az="si" style="background:#1d4f91; color:#fff; font-weight:800">↩️ Riapri</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', async function(e){
    const b = e.target.closest('button[data-az]');
    if(e.target === ov || (b && b.dataset.az === 'no')){ ov.remove(); return; }
    if(!b) return;
    if(b.dataset.az === 'annulla'){ ov.remove(); annullaPratica(p.id); return; }
    const stato = document.getElementById('rp-stato').value;
    const campi = { consegnataIl: '', consegnataDa: '', stato: stato };
    const tp = document.getElementById('rp-pagato');
    if(tp && tp.checked) campi.pagato = '';
    const tf = document.getElementById('rp-fattura');
    if(tf && tf.checked){ campi.numFattura = ''; campi.dataFattura = ''; campi.compenso = ''; campi.fatt = 'dafatturare'; }
    if(!eColf(p.tipo)){ if(STATI_IN_LAVORAZIONE.indexOf(stato) >= 0) campi.dataFine = ''; else if(stato === 'lavorata' && !p.dataFine) campi.dataFine = todayIT(); }
    b.disabled = true;
    const r = await data.pratiche.aggiorna(p.id, campi);
    if(r && r.error){ b.disabled = false; avviso('❌ ' + r.error, true); return; }
    ov.remove();
    avviso('↩️ ' + formattaProtocollo(p) + ' riaperta · ' + statoLabel(stato) + (campi.pagato === '' ? ' · pagato tolto' : '') + (campi.numFattura === '' ? ' · fattura tolta, da rifare' : ''));
    render();
  });
}
function mostraConsegnate(){ MOSTRA_CONSEGNATE = !MOSTRA_CONSEGNATE; VEDI_TUTTE = false; render(); }

// Gruppo -> id della sola pratica aperta dal registro (si vede solo la sua scheda)
const SCHEDA_SOLA = {};
function mostraTutteSchede(k){ delete SCHEDA_SOLA[k]; render(); }
function apriPraticaDaTabella(id){
  const p = state.pratiche.find(function(x){ return x.id===id; });
  if(!p) return;
  const k = p.tipo || 'SENZA TIPO';
  // la scheda della pratica è dentro «Riquadri per tipo di pratica»: la sezione si apre da sola
  const sezTipi = document.getElementById('sez-tipi'); if(sezTipi) sezTipi.open = true;
  aperti[k] = true;
  aperti[k + '|schede'] = true;
  SCHEDA_SOLA[k] = id;
  if(eConsegnata(p)) MOSTRA_CONSEGNATE = true;
  p._editing = true; p._apertaIl = p.aggiornatoIl || '';
  render();
  proponiInLavorazione(p);
  setTimeout(function(){
    const el = document.getElementById('pratica-'+id);
    if(el) el.scrollIntoView({ behavior:'smooth', block:'center' });
  }, 50);
}
function modifica(id){
  const p = state.pratiche.find(x=>x.id===id);
  if(p){ p._editing = true; p._apertaIl = p.aggiornatoIl || ''; render(); proponiInLavorazione(p); }
}
// Aprendo una pratica "In arrivo" o "Scansionata" (con tutti i documenti) si propone "In lavorazione"
function proponiInLavorazione(p){
  if(!p || eColf(p.tipo) || ['arrivo','da_lavorare_scansionata'].indexOf(p.stato) < 0) return;
  if(typeof documentiPratica === 'function' && documentiPratica(p).mancanti.length) return;
  setTimeout(function(){ proponiStato(p, 'lavorazione', 'Stai aprendo la pratica di ' + (p.nome || '') + ' per lavorarla.'); }, 300);
}

function annullaModifica(id){
  const p = state.pratiche.find(x=>x.id===id);
  if(p){ delete p._editing; render(); }
}

async function salvaModifica(id){
  const p = state.pratiche.find(x=>x.id===id);
  if(!p) return;
  // un altro utente ha salvato questa pratica mentre era aperta qui
  const io = ((auth.profilo && auth.profilo.nome) || '').toUpperCase();
  if(p._apertaIl && p.aggiornatoIl && p.aggiornatoIl !== p._apertaIl && String(p.modificatoDa || '').toUpperCase() !== io){
    const chi = p.modificatoDa || 'un altro utente', quando = new Date(p.aggiornatoIl);
    if(!confirm('⚠️ Mentre avevi aperta questa pratica l\'ha modificata ' + chi + (isNaN(quando) ? '' : ' alle ' + quando.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })) + '.\n\nSe salvi, i dati che vedi nella scheda sostituiscono i suoi.\n\nOK = salvo lo stesso\nAnnulla = non salvo (chiudi la modifica e riaprila per vedere i dati aggiornati)')) return;
  }
  const g = k => document.getElementById(k+'-'+id).value;
  var cc = g('e-congcognome').trim().toUpperCase();
  var cn = g('e-congnome').trim().toUpperCase();
  // la congiunta esiste solo per i 730: per gli altri tipi i dati del coniuge non si salvano
  if(!tipoAmmetteCongiunta(g('e-tipo'))){ cc = ''; cn = ''; }
  const numFattura = g('e-nf').trim();
  const dataFattura = g('e-df').trim();
  const cognomeTit = g('e-cognome').trim().toUpperCase();
  const nomeTit = g('e-nomeproprio').trim().toUpperCase();
  if(!cognomeTit && !nomeTit){ avviso('❌ Inserisci il cognome del contribuente.', true); return; }
  const campi = {
    nome: (cognomeTit + ' ' + nomeTit).trim(),
    congCognome: cc, congNome: cn,
    congData: (cc || cn) ? g('e-congdata').trim() : '',
    congCodiceFiscale: (cc || cn) ? normalizzaCF(g('e-congcf')) : '',
    congTelefono: (cc || cn) ? g('e-congtel').trim() : '',
    congEmail: (cc || cn) ? g('e-congemail').trim().toLowerCase() : '',
    congDocumentoScadenza: (cc || cn) ? g('e-congdocscad').trim() : '',
    congDocumentoNumero: (cc || cn) ? g('e-congdocnum').trim().toUpperCase().replace(/\s+/g, '') : '',
    congDocumentoTipo: (cc || cn) ? g('e-congdoctipo') : '',
    congiunta: [cc, cn].filter(Boolean).join(' '),
    ...(typeof datiLavoratoreEdit === 'function' ? datiLavoratoreEdit(id, g('e-tipo')) : {}),
    ...(typeof datiAffitto === 'function' ? datiAffitto(id, g('e-tipo'), p) : {}),
    telefono: g('e-tel').trim(),
    telefonoFisso: g('e-telfisso').trim(),
    email: g('e-email').trim().toLowerCase(),
    cf: g('e-cf').trim(),
    tipo: g('e-tipo'),
    descrizioneTipo: eAltrePratiche(g('e-tipo')) ? g('e-desctipo').trim() : '',
    scadenzaAssistenza: eColf(g('e-tipo')) ? g('e-scadass').trim() : '',
    compenso: parseImporto(g('e-comp')) || '',
    pagato: parseImporto(g('e-pag')) || '',
    richiesto: parseImporto(g('e-ric')) || '',
    metodoPagamento: g('e-met'),
    numFattura: numFattura,
    dataFattura: dataFattura,
    documentoScadenza: g('e-docscad').trim(),
    documentoNumero: g('e-docnum').trim().toUpperCase().replace(/\s+/g, ''),
    documentoTipo: g('e-doctipo'),
    note: g('e-note').trim(),
    riferimento: g('e-rif').trim().toUpperCase() || null,
    viaEmail: !!(document.getElementById('e-viaemail-'+id)||{}).checked,
    iscrittoCisl: !!(document.getElementById('e-cisl-'+id)||{}).checked,
    fatt: (numFattura || dataFattura) ? 'fatturata' : 'dafatturare'
  };
  if(campi.email && !emailValida(campi.email)){ popupErroreCampo('E-mail non valida', 'L\'indirizzo <b>' + esc(campi.email) + '</b> non è corretto.', 'e-email-' + id); return; }
  if(campi.congEmail && !emailValida(campi.congEmail)){ popupErroreCampo('E-mail del coniuge non valida', 'L\'indirizzo <b>' + esc(campi.congEmail) + '</b> non è corretto.', 'e-congemail-' + id); return; }
  if(!campi.telefono && !campi.telefonoFisso){
    avviso('❌ Inserisci almeno un numero di telefono: cellulare o telefono fisso.', true);
    return;
  }
  if(campi.telefono && campi.telefono !== p.telefono && cellulareSospetto(campi.telefono) && !confirm(cellulareSospetto(campi.telefono) + '\n\nSalvo lo stesso? (Annulla per correggerlo)')) return;
  if(eAltrePratiche(campi.tipo) && !campi.descrizioneTipo){
    avviso('❌ Hai scelto ALTRE PRATICHE: scrivi la descrizione della pratica.', true);
    return;
  }
  if(campi.dataFattura && !parseDataIT(campi.dataFattura)){
    avviso('❌ La data della fattura deve essere nel formato GG/MM/AAAA.', true);
    return;
  }
  if(campi.dataFattura && typeof dataNum === 'function' && dataNum(campi.dataFattura) > dataNum(todayIT()) && !confirm('La data della fattura (' + campi.dataFattura + ') è dopo oggi. Salvo lo stesso?')) return;
  if(campi.congDocumentoScadenza && !parseDataIT(campi.congDocumentoScadenza)){ alert('La scadenza del documento del coniuge deve essere nel formato GG/MM/AAAA.'); return; }
  if(campi.documentoScadenza && !parseDataIT(campi.documentoScadenza)){
    avviso('❌ La scadenza del documento deve essere nel formato GG/MM/AAAA.', true);
    return;
  }
  if(campi.congCodiceFiscale && !cfValido(campi.congCodiceFiscale)){
    avviso('❌ Il codice fiscale del coniuge non e\' valido: correggilo o lascia il campo vuoto.', true);
    return;
  }
  if(campi.scadenzaAssistenza && !parseDataIT(campi.scadenzaAssistenza)){
    avviso('❌ La scadenza assistenza deve essere nel formato GG/MM/AAAA.', true);
    return;
  }
  const annoP = annoPratica(p);
  if(typeof eAffitto === 'function' && eAffitto(campi.tipo)){ const errA = erroreAffitto(campi); if(errA){ avviso('❌ ' + errA, true); return; } }
  const doppione = (eAltrePratiche(campi.tipo) || (typeof eAffitto === 'function' && eAffitto(campi.tipo))) ? null : await cercaDoppione(annoP, campi.nome, campi.tipo, p.codiceFiscale, id);
  if(doppione){
    avviso('❌ ' + campi.nome + ' ha gia\' una pratica ' + campi.tipo + ' nel ' + annoP + ' (protocollo ' + doppione + '): modifica non salvata.', true);
    return;
  }
  delete p._editing;
  const primaNF = String(p.numFattura || '').trim(), primaPag = Number(p.pagato || 0), statoPrima = p.stato;
  const vecchiTit = { nomeCompleto: p.nome, dataNascita: p.cf, codiceFiscale: p.codiceFiscale };
  const vecchiCong = { nomeCompleto: ((p.congCognome||'')+' '+(p.congNome||'')).trim(), dataNascita: p.congData };
  const esito = await data.pratiche.aggiorna(id, campi);
  if(esito && esito.error) return;
  await aggiornaArchivioCliente(vecchiTit, { cognome: cognomeTit, nome: nomeTit, dataNascita: campi.cf, codiceFiscale: p.codiceFiscale });
  if((campi.documentoNumero || campi.documentoTipo) && data.clienti.salvaDocumento) data.clienti.salvaDocumento({ codiceFiscale: p.codiceFiscale || '', nomeCompleto: (cognomeTit + ' ' + nomeTit).trim(), dataNascita: campi.cf || '', documentoNumero: campi.documentoNumero, documentoTipo: campi.documentoTipo });
  if(campi.telefono || campi.telefonoFisso || campi.documentoScadenza || campi.email) data.clienti.salvaTelefono({ nomeCompleto: (cognomeTit + ' ' + nomeTit).trim(), cognome: cognomeTit, nome: nomeTit, dataNascita: campi.cf || '', codiceFiscale: p.codiceFiscale || '', telefono: campi.telefono, telefonoFisso: campi.telefonoFisso, documentoScadenza: campi.documentoScadenza, email: campi.email });
  if(cc || cn) await aggiornaArchivioCliente(vecchiCong, { cognome: cc, nome: cn, dataNascita: campi.congData });
  if(cc || cn) salvaRuoloCliente((cc + ' ' + cn).trim(), campi.congData, cfValido(campi.congCodiceFiscale) ? campi.congCodiceFiscale : '', 'coniuge', true, campi.nome, campi.cf);
  if((cc || cn) && (campi.congCodiceFiscale || campi.congTelefono || campi.congEmail)) registraClienteSeNuovo(cc, cn, campi.congData, cfValido(campi.congCodiceFiscale) ? campi.congCodiceFiscale : '', campi.congTelefono, '', '', campi.congEmail);
  if(campi.lavCognome || campi.lavNome){ if(typeof registraLavoratoreArchivio === 'function') registraLavoratoreArchivio(campi); }
  if(campi.inquilini && campi.inquilini.length && typeof registraInquiliniArchivio === 'function') registraInquiliniArchivio(campi.inquilini);
  // pagato tutto ma lo stato e' ancora "lavorata", "da pagare"...: si propone di passare a "Pagato"
  if(propostaStatoPagato(campi.tipo, p.stato, campi.compenso, campi.pagato) && confirm('Il cliente ha pagato tutto (' + fmtEuro(campi.pagato) + ').\n\nPasso lo stato della pratica da "' + statoLabel(p.stato) + '" a "Pagato"?')){
    const r2 = await data.pratiche.aggiorna(id, { stato: 'pagato' });
    if(!(r2 && r2.error)) avviso('✓ Stato: Pagato');
  } else if(!eColf(campi.tipo) && Number(campi.compenso || 0) > 0 && Number(campi.pagato || 0) < Number(campi.compenso || 0) && STATI_NON_PROPONI_DA_PAGARE.indexOf(statoPrima) < 0 && !(typeof eStatoNonPagato === 'function' && eStatoNonPagato(statoPrima)) && !(typeof eRinuncia === 'function' && eRinuncia(p))){
    // fattura appena emessa, o pagamento parziale: si propone "Da pagare"
    const nuovaNF = !primaNF && String(campi.numFattura || '').trim();
    const parziale = Number(campi.pagato || 0) > 0 && Number(campi.pagato || 0) !== primaPag;
    if(nuovaNF || parziale) await proponiStato(p, 'da_pagare', nuovaNF ? 'Hai emesso la fattura n. ' + campi.numFattura + ' (' + fmtEuro(campi.compenso) + ')' + (Number(campi.pagato||0) ? ' e il cliente ha pagato solo ' + fmtEuro(campi.pagato) : ' e il cliente non ha ancora pagato') + '.' : 'Il cliente ha pagato ' + fmtEuro(campi.pagato) + ' su ' + fmtEuro(campi.compenso) + ' di fattura.');
  }
}
// Stati da cui non si propone "Da pagare" (già pagata, già da pagare)
const STATI_NON_PROPONI_DA_PAGARE = ['da_pagare', 'pagato', 'pagato_da_ritirare', 'pratica_attiva', 'pratica_cessata'];
// Proposta di cambio stato: chiede conferma, non cambia mai da solo
const PROPOSTE_RIFIUTATE = {};
async function proponiStato(p, nuovo, motivo){
  if(!p || !STATI[nuovo] || p.stato === nuovo || !statoVisibile(nuovo, p.tipo)) return false;
  const chiave = p.id + '>' + nuovo;
  if(PROPOSTE_RIFIUTATE[chiave]) return false;
  if(!confirm(motivo + '\n\nPasso la pratica ' + formattaProtocollo(p) + ' da "' + statoLabel(p.stato) + '" a "' + statoLabel(nuovo) + '"?')){ PROPOSTE_RIFIUTATE[chiave] = true; return false; }
  await cambiaStato(p.id, nuovo);
  return true;
}
// Stati da cui, a pagamento completo, si propone il passaggio a "Pagato"
const STATI_PROPONI_PAGATO = ['lavorata', 'lavorata_da_fatturare', 'da_pagare'];
function propostaStatoPagato(tipo, stato, compenso, pagato){
  const pg = Number(pagato || 0), fa = Number(compenso || 0);
  return !eColf(tipo) && STATI_PROPONI_PAGATO.indexOf(stato) >= 0 && pg > 0 && pg >= fa;
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

function indirizzoApp(){ return location.origin + location.pathname.replace(/index\.html$/, ''); }
// Il QR apre il programma con la guida per installare l'app (icona CAF CISL sulla schermata Home)
function indirizzoInstallazione(){ return indirizzoApp() + '?installa=1'; }
function qrSvg(testo){
  const qr = qrcode(0, 'H'); // correzione alta: il logo al centro non disturba la lettura
  qr.addData(testo);
  qr.make();
  const n = qr.getModuleCount(), m = 2, tot = n + m * 2;
  let celle = '';
  for(let r = 0; r < n; r++) for(let c = 0; c < n; c++) if(qr.isDark(r, c)) celle += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
  const lato = tot * 0.24, pos = (tot - lato) / 2;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + tot + ' ' + tot + '" width="100%" height="100%" shape-rendering="crispEdges">'
    + '<rect width="' + tot + '" height="' + tot + '" fill="#fff"/><path d="' + celle + '" fill="#0f1b2d"/>'
    + '<rect x="' + (pos - 0.6) + '" y="' + (pos - 0.6) + '" width="' + (lato + 1.2) + '" height="' + (lato + 1.2) + '" rx="1.6" fill="#fff"/>'
    + '<image href="icone/icona-192.png" x="' + pos + '" y="' + pos + '" width="' + lato + '" height="' + lato + '" preserveAspectRatio="xMidYMid slice" style="image-rendering:auto"/></svg>';
}
function disegnaQrApp(){
  const box = document.getElementById('qr-app');
  if(!box || typeof qrcode !== 'function') return;
  box.innerHTML = qrSvg(indirizzoInstallazione());
}
function apriQrApp(){
  document.getElementById('qr-grande').innerHTML = qrSvg(indirizzoInstallazione());
  document.getElementById('qr-url').textContent = indirizzoApp();
  document.getElementById('qr-overlay').classList.add('open');
}
// Aperto dal QR: si mostra subito la guida per installare l'app
(function(){
  if(!/[?&]installa=1/.test(location.search)) return;
  try{ history.replaceState(null, '', location.pathname); }catch(e){}
  window.addEventListener('load', function(){
    setTimeout(function(){
      if(typeof appGiaInstallata === 'function' && appGiaInstallata()) return;
      if(typeof installaApp === 'function') installaApp();
    }, 1200);
  });
})();

document.addEventListener('DOMContentLoaded', async function(){
  const logoCisl = document.querySelector('.hero-logo');
  if(logoCisl) document.documentElement.style.setProperty('--logo-cisl', 'url("'+logoCisl.src+'")');
  disegnaQrApp();
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
  impostaTipoPredefinito();
});

function datiPerTipo(pratiche){
  const righe = {};
  pratiche.forEach(function(p){
    const k = p.tipo || 'SENZA TIPO';
    const r = righe[k] || (righe[k] = { n:0, fatt:0, inc:0 });
    r.n += pesoPratica(p);
    r.fatt += Number(p.compenso||0);
    r.inc += Number(p.pagato||0);
  });
  const ordine = getTipiList();
  const tipi = Object.keys(righe).sort(function(a,b){
    const ia = ordine.indexOf(a), ib = ordine.indexOf(b);
    return (ia<0?999:ia) - (ib<0?999:ib);
  });
  return { tipi: tipi, righe: righe };
}

// Incasso diviso per tipo di pagamento (contanti, POS, bonifico)
function datiPerPagamento(pratiche){
  const righe = {};
  METODI_PAGAMENTO.concat(['']).forEach(function(m){ righe[m] = { n: 0, inc: 0 }; });
  (pratiche||[]).forEach(function(p){
    const inc = Number(p.pagato||0);
    if(!inc) return;
    const m = METODI_PAGAMENTO.indexOf(p.metodoPagamento) >= 0 ? p.metodoPagamento : '';
    righe[m].n++; righe[m].inc += inc;
  });
  return righe;
}
function riepilogoPerPagamento(pratiche){
  const r = datiPerPagamento(pratiche);
  const tot = Object.keys(r).reduce(function(t,k){ return t + r[k].inc; }, 0);
  const totN = Object.keys(r).reduce(function(t,k){ return t + r[k].n; }, 0);
  const icone = { CONTANTI: '💶', POS: '💳', BONIFICO: '🏦', '': '❔' };
  const voci = METODI_PAGAMENTO.concat(r[''].n ? [''] : []);
  return '<div class="raff-title" style="margin-top:14px">Incasso per tipo di pagamento</div>'
    + '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>Pagamento</th><th>Pratiche pagate</th><th>Incasso</th><th>%</th></tr></thead><tbody>'
    + voci.map(function(m){
      return '<tr><td><b>' + icone[m] + ' ' + (m || 'Non indicato') + '</b></td><td>' + r[m].n + '</td><td><b>' + fmtEuro(r[m].inc) + '</b></td><td>' + (tot ? Math.round(r[m].inc / tot * 100) : 0) + '%</td></tr>';
    }).join('')
    + '<tr style="font-weight:800; border-top:2px solid var(--line)"><td>TOTALE</td><td>' + totN + '</td><td>' + fmtEuro(tot) + '</td><td>100%</td></tr>'
    + '</tbody></table></div>'
    + (r[''].n ? '<div style="font-size:12px; color:var(--sub); margin-top:4px">"Non indicato" sono le pratiche pagate senza tipo di pagamento: puoi aggiungerlo con Modifica.</div>' : '');
}
function riepilogoPerTipo(pratiche){
  const d = datiPerTipo(pratiche);
  if(!d.tipi.length) return '';
  return '<div class="raff-title">Dettaglio per tipo di pratica</div>'
    + '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>Tipo di pratica</th><th>Pratiche</th><th>Fatture emesse</th><th>Incasso</th>'+(vedeGuadagni()?'<th>Guadagno netto (incasso − fatture)</th>':'')+'</tr></thead><tbody>'
    + d.tipi.map(function(t){
      const r = d.righe[t];
      return '<tr><td>'+esc(t)+'</td><td>'+r.n+'</td><td>'+fmtEuro(r.fatt)+'</td><td>'+fmtEuro(r.inc)+'</td>'+(vedeGuadagni()?'<td><b>'+fmtEuro(r.inc-r.fatt)+'</b></td>':'')+'</tr>';
    }).join('')
    + '</tbody></table></div>';
}

let chTipi = null;
function aggiornaGraficoTipi(pratiche){
  const cv = document.getElementById('ch-tipi');
  const box = document.getElementById('box-ch-tipi');
  if(!window.Chart || !cv) return;
  const d = datiPerTipo(pratiche);
  if(box) box.style.display = d.tipi.length ? '' : 'none';
  if(chTipi && chTipi.canvas !== cv){ chTipi.destroy(); chTipi = null; }
  const fatt = d.tipi.map(function(t){ return d.righe[t].fatt; });
  const inc = d.tipi.map(function(t){ return d.righe[t].inc; });
  const prov = d.tipi.map(function(t){ return d.righe[t].inc - d.righe[t].fatt; });
  const wrap = cv.parentNode;
  if(wrap) wrap.style.height = '320px';
  if(!chTipi){
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue('--ink').trim() || '#0f1b2d';
    const sub = cs.getPropertyValue('--sub').trim() || '#5b6b82';
    chTipi = new Chart(cv, {type:'bar',
      data:{labels:d.tipi.map(etichettaSuPiuRighe), datasets:[
        {label:'Fatture emesse', data:fatt, backgroundColor:'#2f9e5f', borderRadius:6, maxBarThickness:18},
        {label:'Incasso', data:inc, backgroundColor:'#8e5bd6', borderRadius:6, maxBarThickness:18},
        {label:'Guadagno netto', data:prov, backgroundColor:'#c2185b', borderRadius:6, maxBarThickness:18}]},
      options:{responsive:true, maintainAspectRatio:false,
        plugins:{legend:{position:'bottom', labels:{boxWidth:10, color:ink, font:{size:11}}}, tooltip:{callbacks:{label:function(c){ return c.dataset.label+': '+fmtEuro(c.parsed.y); }}}},
        scales:{x:{ticks:{color:ink, font:{size:11}}, grid:{display:false}}, y:{beginAtZero:true, ticks:{color:sub, callback:function(v){ return '€ '+Number(v).toLocaleString('it-IT'); }}, grid:{color:'rgba(128,140,160,.18)'}}}}});
  } else {
    chTipi.data.labels = d.tipi.map(etichettaSuPiuRighe);
    chTipi.data.datasets[0].data = fatt; chTipi.data.datasets[1].data = inc; chTipi.data.datasets[2].data = prov;
  }
  chTipi.setDatasetVisibility(2, vedeGuadagni());
  chTipi.update();
}

async function caricaNomiOperatori(){
  try{
    const { data: righe, error } = await supabase.rpc('nomi_operatori', {});
    if(error || !Array.isArray(righe)) return;
    NOMI_OPERATORI = righe.map(function(r){ return r.nome; }).filter(Boolean);
    render();
  }catch(e){ console.error('nomi operatori', e); }
}

// Stesso nominativo + stesso tipo + stesso anno = doppione; due omonimi con codice fiscale diverso restano distinti.
async function cercaDoppione(anno, nome, tipo, codiceFiscale, escludiId){
  if(!nome || !tipo) return null;
  let elenco = (state.pratiche||[]).map(function(p){ return { id:p.id, numero:p.numero, anno:annoPratica(p), nome:p.nome, tipo:p.tipo, codiceFiscale:p.codiceFiscale, serie:p.serie, trasferitaIn:p.trasferitaIn, protocolloOrigine:p.continuazione ? p.protocolloOrigine : '' }; });
  try{
    const { data: righe, error } = await supabase.from('pratiche').select('id,numero,anno,nome,tipo,codice_fiscale,serie,trasferita_in,continuazione,protocollo_origine').eq('anno', anno).eq('nome', nome).eq('tipo', tipo);
    if(!error && Array.isArray(righe)) elenco = righe.map(function(r){ return { id:r.id, numero:r.numero, anno:r.anno, nome:r.nome, tipo:r.tipo, codiceFiscale:r.codice_fiscale, serie:r.serie, trasferitaIn:r.trasferita_in, protocolloOrigine:r.continuazione ? r.protocollo_origine : '' }; });
  }catch(e){ console.error('controllo doppioni', e); }
  const trovato = elenco.find(function(p){
    if(p.id === escludiId) return false;
    // contratto colf già trasferito o rinnovato: è chiuso, non conta come doppione
    if(p.trasferitaIn) return false;
    if(Number(p.anno) !== Number(anno) || (p.nome||'').toUpperCase() !== nome.toUpperCase() || p.tipo !== tipo) return false;
    return !(codiceFiscale && p.codiceFiscale && p.codiceFiscale !== codiceFiscale);
  });
  if(trovato && trovato.protocolloOrigine) return trovato.protocolloOrigine + ' (continuazione)';
  return trovato ? serieDi(trovato) + '-' + String(trovato.numero).padStart(4,'0') + '/' + anno : null;
}

function e730(p){ return /^730\b/.test(String(p.tipo||'').toUpperCase()); }
// "ALTRE PRATICHE": il tipo si accompagna a una descrizione scritta a mano
const TIPO_ALTRE = 'ALTRE PRATICHE';
function eAltrePratiche(t){ return String(t||'').trim().toUpperCase() === TIPO_ALTRE; }
function tipoConDescrizione(p){ return (p.tipo||'') + (eAltrePratiche(p.tipo) && p.descrizioneTipo ? ' – ' + p.descrizioneTipo : ''); }
function aggiornaDescTipoForm(){ const b = document.getElementById('f-desctipo-box'); if(b) b.style.display = eAltrePratiche((document.getElementById('f-tipo')||{}).value) ? '' : 'none'; aggiornaCongiuntaForm(); }
// La dichiarazione congiunta esiste solo per i 730: per gli altri tipi (colf, affitti, IMU, successioni,
// ISEE, F24, canone RAI, rottamazione, altre pratiche...) la spunta "Congiunta" non compare
function tipoAmmetteCongiunta(t){ t = String(t||'').trim().toUpperCase(); return !t || t.indexOf('730') === 0; }
function aggiornaCongiuntaForm(){
  const chk = document.getElementById('f-congiunta-on');
  if(!chk) return;
  const ok = tipoAmmetteCongiunta((document.getElementById('f-tipo')||{}).value);
  if(typeof mostraLavoratoreModulo === 'function') mostraLavoratoreModulo((document.getElementById('f-tipo')||{}).value);
  if(typeof mostraAffittoModulo === 'function') mostraAffittoModulo((document.getElementById('f-tipo')||{}).value);
  const riga = chk.closest('.full');
  if(riga) riga.style.display = ok ? '' : 'none';
  if(!ok && chk.checked){ chk.checked = false; toggleCongBox(); }
}
function aggiornaCongiuntaEdit(id, tipo){
  const w = document.getElementById('e-congwrap-' + id), chk = document.getElementById('e-congon-' + id);
  if(!w) return;
  const ok = tipoAmmetteCongiunta(tipo);
  w.style.display = ok ? '' : 'none';
  if(!ok && chk && chk.checked){
    chk.checked = false;
    document.getElementById('e-congbox-' + id).style.display = 'none';
    ['e-congcognome-','e-congnome-','e-congdata-','e-congcf-','e-congtel-','e-congemail-'].forEach(function(k){ const el = document.getElementById(k + id); if(el) el.value = ''; });
  }
}
// Stati: "da lavorare" finche' la pratica non e' stata lavorata; dopo (anche pagata o da pagare) conta come lavorata
const STATI_DA_LAVORARE = ['arrivo','lavorazione','da_lavorare_scansionata'];
function eDaLavorare(p){ return STATI_DA_LAVORARE.indexOf(p.stato) >= 0; }
// Rinunce (e stati aggiunti con "rinuncia" o "annullata" nel nome): contabilità a parte, non contano tra le pratiche
function eRinuncia(p){
  if(!p) return false;
  if(p._annFatt) return true;
  if(p.stato === 'rinuncia_compilazione') return true;
  return /rinunc|annullat/i.test((STATI[p.stato]||{}).l || '');
}
function eLavorata(p){ return !eDaLavorare(p) && !eRinuncia(p); }
function e730Conta(p){ return e730(p) && !eRinuncia(p); }
function eAltraConta(p){ return !e730(p) && !eRinuncia(p); }
// Elenco delle pratiche di un contatore in alto (tocca il contatore): 730 dell'anno, congiunte valgono 2
function apriElencoContatore(chiave){
  const anno = annoAttivo();
  const l730 = state.pratiche.filter(function(p){ return annoPratica(p) === anno && e730(p); });
  let lista, titolo, colore;
  if(chiave === 'dafare'){ lista = l730.filter(eDaLavorare); titolo = '730 da lavorare'; colore = '#c0392b'; }
  else if(chiave === 'lav'){ lista = l730.filter(eLavorata); titolo = '730 lavorati'; colore = '#2f9e5f'; }
  else if(chiave === 'rinunce'){ lista = l730.filter(eRinuncia); titolo = 'Rinunce alla compilazione'; colore = '#6b7280'; }
  else if(String(chiave).indexOf('op:') === 0){ const chi = chiave.slice(3); lista = l730.filter(function(p){ return eLavorata(p) && String(p.inseritoDa || '').toUpperCase() === chi; }); titolo = '730 lavorati da ' + chi; colore = '#1d4f91'; }
  else { lista = l730.filter(function(p){ return eDaLavorare(p) || eLavorata(p); }); titolo = 'Tutti i 730 (lavorati e da lavorare)'; colore = '#374151'; }
  lista = lista.slice().sort(function(a,b){ return (a.numero||0) - (b.numero||0); });
  const vecchio = document.getElementById('popup-contatore'); if(vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-contatore';
  ov.style.cssText = 'position:fixed; inset:0; z-index:457; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:10px';
  ov.addEventListener('click', function(e){ if(e.target === ov || e.target.closest('[data-chiudi]')) ov.remove(); });
  // tipi (collaboratori) presenti nell'elenco, con quante pratiche
  const perTipo = {}; lista.forEach(function(p){ perTipo[p.tipo || '-'] = (perTipo[p.tipo || '-'] || 0) + pesoPratica(p); });
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:14px; border-top:6px solid ' + colore + '; max-width:860px; width:100%; max-height:92vh; display:flex; flex-direction:column; box-shadow:0 10px 40px rgba(0,0,0,.3)"><div style="padding:14px 16px; overflow:auto">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px"><b style="font-size:18px; color:' + colore + '">' + esc(titolo) + ' – ' + anno + ' (' + sommaPeso(lista) + ')</b><button type="button" data-chiudi style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:6px 12px; cursor:pointer">✕</button></div>'
    + '<div class="sub2" style="margin:4px 0 8px">' + lista.length + (lista.length === 1 ? ' pratica' : ' pratiche') + (numeroCongiunte(lista) ? ', di cui ' + numeroCongiunte(lista) + (numeroCongiunte(lista) === 1 ? ' congiunta (vale 2)' : ' congiunte (valgono 2)') : '') + (Object.keys(perTipo).length > 1 ? ' · ' + Object.keys(perTipo).sort().map(function(t){ return esc(t) + ' ' + perTipo[t]; }).join(' · ') : '') + '</div>'
    + (lista.length > 1 ? '<input type="search" id="cont-cerca" autocomplete="off" placeholder="🔎 Cerca per cognome, nome, protocollo, tipo o stato…" oninput="filtraElencoContatore(this.value)" style="margin-bottom:6px"><div id="cont-trovate" class="sub2" style="margin-bottom:4px"></div>' : '')
    + (lista.length ? lista.map(function(p){
        const cerca = chiaveRicerca([formattaProtocollo(p), p.nome, p.congiunta, p.codiceFiscale, p.tipo, statoLabel(p.stato), p.inseritoDa].join(' '));
        return '<div class="cont-riga" data-cerca="' + esc(cerca) + '" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:6px 0; border-bottom:1px solid var(--line); font-size:13px">'
          + '<span style="flex:1 1 280px"><b>' + esc(formattaProtocollo(p)) + '</b> · <b>' + esc(p.nome || '') + '</b>' + (p.congiunta ? ' <span class="sub2">(congiunta con ' + esc(p.congiunta) + ')</span>' : '')
          + ' <span class="sub2">· ' + esc(p.tipo || '') + ' · ' + esc((STATI[p.stato] || {}).e || '') + ' ' + esc(statoLabel(p.stato)) + (p.inseritoDa ? ' · inserita da ' + esc(p.inseritoDa) : '') + '</span></span>'
          + '<button type="button" onclick="document.getElementById(\'popup-contatore\').remove(); apriDaStorico(' + esc(JSON.stringify(p.id)) + ')" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:700; cursor:pointer">📂 Apri</button></div>';
      }).join('') : '<div class="empty" style="padding:14px">Nessuna pratica.</div>')
    + '</div></div>';
  document.body.appendChild(ov);
  const c = document.getElementById('cont-cerca'); if(c) setTimeout(function(){ c.focus(); }, 50);
}
// ricerca dentro l'elenco del contatore (apostrofi, spazi e accenti non contano)
function filtraElencoContatore(q){
  const k = chiaveRicerca(q || '');
  let n = 0;
  document.querySelectorAll('#popup-contatore .cont-riga').forEach(function(r){ const si = !k || r.dataset.cerca.indexOf(k) >= 0; r.style.display = si ? '' : 'none'; if(si) n++; });
  const t = document.getElementById('cont-trovate'); if(t) t.textContent = k ? (n ? 'Trovate ' + n : 'Nessuna pratica trovata') : '';
}
function conteggi730(pratiche){
  const l = (pratiche||[]).filter(e730);
  const daFare = sommaPeso(l.filter(eDaLavorare)), lav = sommaPeso(l.filter(eLavorata));
  return { tot: daFare + lav, daFare: daFare, lav: lav, rinunce: sommaPeso(l.filter(eRinuncia)),
    listaTot: l.filter(function(p){ return eDaLavorare(p) || eLavorata(p); }), listaDaFare: l.filter(eDaLavorare), listaLav: l.filter(eLavorata) };
}
// Spese pagate per conto del CAF e detratte nei versamenti (TARI, IMU, condominio…): contabilità a parte
function speseCafAnno(anno){
  const perId = {}; (state.speseSede||[]).forEach(function(s){ perId[s.id] = s; });
  const righe = [];
  (state.versamenti||[]).filter(function(v){ return annoVersamento(v) === anno; }).forEach(function(v){
    (Array.isArray(v.cassaElenco) ? v.cassaElenco : []).forEach(function(r){ const s = r.spesaId && perId[r.spesaId]; righe.push({ versamento: v, spesa: s || null, descrizione: r.descrizione || (s ? s.categoria : 'spesa'), importo: Number(r.importo||0) }); });
    const somma = (Array.isArray(v.cassaElenco) ? v.cassaElenco : []).reduce(function(t,r){ return t + Number(r.importo||0); }, 0);
    const resto = Number(v.cassa||0) - somma;
    if(resto > 0.004) righe.push({ versamento: v, spesa: null, descrizione: 'spese detratte', importo: resto });
  });
  return righe;
}
function bloccoSpeseCaf(pratAnno, anno){
  const righe = speseCafAnno(anno);
  const d = typeof cassaDivisa === 'function' ? cassaDivisa(anno) : { bollettini: 0, bonifici: 0 };
  const speseCaf = righe.reduce(function(t,r){ return t + r.importo; }, 0);
  const inc = pratAnno.reduce(function(t,p){ return t + Number(p.pagato||0); }, 0), fatt = pratAnno.reduce(function(t,p){ return t + Number(p.compenso||0); }, 0);
  const vers = (state.versamenti||[]).filter(function(v){ return annoVersamento(v) === anno; }).reduce(function(t,v){ return t + Number(v.importo||0); }, 0);
  const speseSede = typeof totaleSpeseSede === 'function' ? totaleSpeseSede(anno) : 0;
  const daVers = fatt - vers, resta = inc - d.bollettini - d.bonifici - speseCaf - speseSede;
  const tile = function(bg, valore, etichetta, dett){ return '<div class="stat c4" data-dett="'+dett+'" style="background:'+bg+'; border-color:'+bg+'; color:#fff"><b>'+valore+'</b><span style="color:rgba(255,255,255,.92); font-weight:600; letter-spacing:.03em">'+etichetta+'</span></div>'; };
  const v = function(t, x, col){ return '<span style="white-space:nowrap">' + t + ' <b style="color:' + col + '">' + fmtEuro(x) + '</b></span>'; };
  return '<div class="cont-gruppo" style="--cg:#a0522d"><div class="cont-gruppo-tit">🏦 SPESE CAF – contabilità a parte (spese pagate per il CAF e detratte nei versamenti)</div>'
    + tile('#a0522d', fmtEuro(speseCaf), 'SPESE CAF DETRATTE<br>' + righe.length + ' voci (TARI, IMU, condominio…)', 'spesecaf')
    + tile('#2f7de1', fmtEuro(d.bollettini), 'BOLLETTINI VERSATI', 'versamenti')
    + tile('#1d4f91', fmtEuro(vers), 'DATO AL CAF<br>bollettini + spese' + (d.bonifici > 0.004 ? ' + bonifici' : ''), 'versamenti')
    + tile(daVers > 0.004 ? '#c0392b' : '#1a7f37', fmtEuro(daVers), 'ANCORA DA VERSARE AL CAF<br>fatture ' + fmtEuro(fatt) + ' − dato ' + fmtEuro(vers), 'fatture')
    + '<div style="flex-basis:100%; padding:12px 14px; border-radius:12px; background:var(--card); border:2px dashed #a0522d; font-size:14.5px; display:flex; flex-wrap:wrap; gap:6px 10px; align-items:center">'
    + '<b style="color:#a0522d; flex-basis:100%">📋 Conto definitivo dell\'anno</b>'
    + v('Incasso', inc, '#8e5bd6') + '<b>−</b>' + v('bollettini', d.bollettini, '#2f7de1') + (d.bonifici > 0.004 ? '<b>−</b>' + v('bonifici detratti', d.bonifici, '#2f7de1') : '') + '<b>−</b>' + v('spese CAF', speseCaf, '#a0522d') + (speseSede > 0.004 ? '<b>−</b>' + v('spese sede', speseSede, '#b35f0c') : '') + '<b>=</b>'
    + '<span style="white-space:nowrap; background:#a0522d; color:#fff; padding:4px 12px; border-radius:999px; font-weight:800">RESTA ' + fmtEuro(resta) + '</span>'
    + '<span style="flex-basis:100%; font-size:12.5px; color:var(--sub)">di cui guadagno della sede <b>' + fmtEuro(resta - daVers) + '</b>' + (daVers > 0.004 ? ' e <b style="color:#c0392b">' + fmtEuro(daVers) + '</b> ancora da versare al CAF' : ' · al CAF non si deve più niente') + '</span>'
    + '</div></div>';
}
// La fattura scritta a "lavorata" entra in contabilità solo quando la pratica è consegnata/definita.
// Fino ad allora per i conti vale 0 e resta "in attesa di consegna" (_fattAttesa). I contratti colf restano come prima.
function praticaContabile(p){
  if(!p || p._annFatt || (typeof eColf === 'function' && eColf(p.tipo)) || eConsegnata(p) || !(Number(p.compenso||0) > 0)) return p;
  return Object.assign({}, p, { compenso: 0, _fattAttesa: Number(p.compenso) });
}
function praticheContabili(lista){ return (lista||[]).map(praticaContabile); }
function totaleFattureInAttesa(lista){ return (lista||[]).reduce(function(t,p){ const c = praticaContabile(p); return t + Number(c._fattAttesa||0); }, 0); }
function annullateAnno(anno){ return (state.annullate||[]).filter(function(p){ return annoPratica(p) === anno; }); }
// Pratiche annullate con la fattura già emessa e senza nota di credito: la fattura resta in contabilità
// (fatture emesse, da versare al CAF, guadagno) insieme alle rinunce; l'incasso non conta.
function haFatturaEmessa(p){ return !!String(p.numFattura||'').trim() || (p.fatt === 'fatturata' && Number(p.compenso||0) > 0); }
function fattureAnnullateAperte(anno){
  return (state.annullate||[]).filter(function(p){ return (!anno || annoPratica(p) === anno) && haFatturaEmessa(p) && !String(p.notaCredito||'').trim(); })
    .map(function(p){ return Object.assign({}, p, { pagato: 0, _annFatt: true }); });
}
async function segnaNotaCredito(id){
  const p = (state.annullate||[]).find(function(x){ return x.id === id; }); if(!p) return;
  const n = prompt('Nota di credito per la fattura n. ' + (p.numFattura||'') + ' di ' + (p.nome||'') + '\n\nNumero della nota di credito:', ''); if(n === null) return;
  if(!n.trim()){ alert('Scrivi il numero della nota di credito.'); return; }
  const d = prompt('Data della nota di credito (GG/MM/AAAA):', todayIT()); if(d === null) return;
  const esito = await data.pratiche.aggiorna(id, { notaCredito: n.trim(), notaCreditoData: (d || '').trim() || todayIT() });
  if(!(esito && esito.error)) avviso('✓ Nota di credito n. ' + n.trim() + ' registrata: la fattura esce dalla contabilità');
}
async function togliNotaCredito(id){
  const p = (state.annullate||[]).find(function(x){ return x.id === id; }); if(!p) return;
  if(!confirm('Togliere la nota di credito n. ' + p.notaCredito + '?\nLa fattura n. ' + (p.numFattura||'') + ' torna in contabilità.')) return;
  const esito = await data.pratiche.aggiorna(id, { notaCredito: '', notaCreditoData: '' });
  if(!(esito && esito.error)) avviso('Nota di credito tolta: la fattura torna in contabilità');
}
// Blocco a parte: rinunce alla compilazione e pratiche annullate
function bloccoRinunce(pratAnno, anno){
  const rin = pratAnno.filter(eRinuncia), ann = annullateAnno(anno);
  const fatt = rin.reduce(function(a,p){ return a+Number(p.compenso||0); }, 0), inc = rin.reduce(function(a,p){ return a+Number(p.pagato||0); }, 0);
  const tile = function(bg, valore, etichetta, dett){ return '<div class="stat c4" data-dett="'+dett+'" data-gruppo="rinunce" style="background:'+bg+'; border-color:'+bg+'; color:#fff"><b>'+valore+'</b><span style="color:rgba(255,255,255,.92); font-weight:600; letter-spacing:.03em">'+etichetta+'</span></div>'; };
  const annF = rin.filter(function(p){ return p._annFatt; });
  return '<div class="cont-gruppo" style="--cg:#374151"><div class="cont-gruppo-tit">🚫 RINUNCE E ANNULLATE (contabilità a parte, non contano tra le pratiche)</div>'
    + tile('#374151', sommaPeso(rin.filter(function(p){ return !p._annFatt; })), 'RINUNCE ALLA COMPILAZIONE' + (rin.filter(function(p){ return e730(p) && !p._annFatt; }).length ? '<br>di cui 730: ' + sommaPeso(rin.filter(function(p){ return e730(p) && !p._annFatt; })) : ''), 'g-pratiche')
    + tile('#6b7280', sommaPeso(ann), 'PRATICHE ANNULLATE', 'annullate')
    + (fatt || inc ? tile('#2f9e5f', fmtEuro(fatt), 'FATTURE DELLE RINUNCE' + (annF.length ? '<br>e di ' + annF.length + ' annullate (nota di credito da fare)' : ''), 'g-fatture') + tile('#8e5bd6', fmtEuro(inc), 'INCASSO DELLE RINUNCE', 'g-incasso') : '')
    + '</div>';
}
// Tasto che somma il guadagno netto 730 e quello delle altre pratiche (resta aperto finché non lo richiudi)
let SOMMA_GUADAGNI_APERTA = false;
function sommaGuadagniHTML(pratiche){
  const g = function(lista){ return lista.reduce(function(a,p){ return a + Number(p.pagato||0) - Number(p.compenso||0); }, 0); };
  const g730 = g(pratiche.filter(e730Conta)), gAltre = g(pratiche.filter(eAltraConta)), gRin = g(pratiche.filter(eRinuncia));
  return '<div style="flex-basis:100%; margin-top:10px; display:flex; flex-wrap:wrap; align-items:center; gap:10px">'
    + '<button type="button" onclick="SOMMA_GUADAGNI_APERTA=!SOMMA_GUADAGNI_APERTA; render()" style="padding:12px 20px; border:none; border-radius:999px; background:linear-gradient(90deg,#1d4f91,#0e8a8a); color:#fff; font-size:15px; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,.2)">'
    + (SOMMA_GUADAGNI_APERTA ? '✕ Chiudi somma' : '➕ Somma guadagni 730 + altre pratiche') + '</button>'
    + (SOMMA_GUADAGNI_APERTA ? '<div style="flex:1; min-width:260px; padding:12px 16px; border-radius:14px; background:#c2185b; color:#fff; display:flex; flex-wrap:wrap; align-items:baseline; gap:6px 10px">'
      + '<span style="font-size:14px; font-weight:700">Guadagno netto 730 <b>' + fmtEuro(g730) + '</b> + altre pratiche <b>' + fmtEuro(gAltre) + '</b>' + (Math.abs(gRin) > 0.004 ? ' + rinunce <b>' + fmtEuro(gRin) + '</b>' : '') + ' =</span>'
      + '<span style="font-size:26px; font-weight:900">' + fmtEuro(g730 + gAltre + gRin) + '</span>'
      + '<span style="flex-basis:100%; font-size:12px; opacity:.9">Guadagno complessivo delle pratiche, prima delle spese sede</span></div>' : '')
    + '</div>';
}
function bloccoIntroito(titolo, colore, lista, conMedia, nomeGuadagno){
  const fatt = lista.reduce(function(a,p){ return a+Number(p.compenso||0); }, 0);
  const inc = lista.reduce(function(a,p){ return a+Number(p.pagato||0); }, 0);
  const n = sommaPeso(lista);
  const gruppo = conMedia ? '730' : 'altre';
  const tile = function(bg, valore, etichetta, dett){
    return '<div class="stat '+(conMedia?'c3':'c4')+'" data-dett="'+dett+'" data-gruppo="'+gruppo+'" style="background:'+bg+'; border-color:'+bg+'; color:#fff"><b>'+valore+'</b><span style="color:rgba(255,255,255,.92); font-weight:600; letter-spacing:.03em">'+etichetta+'</span></div>';
  };
  return '<div class="cont-gruppo" style="--cg:'+colore+'"><div class="cont-gruppo-tit">'+(conMedia ? '📘 ' : '📗 ')+esc(titolo)+'</div>'
    + tile(colore, n, 'PRATICHE' + (conMedia ? notaCongiunte(lista) : ''), 'g-pratiche')
    + tile('#2f9e5f', fmtEuro(fatt), 'FATTURE EMESSE', 'g-fatture')
    + tile('#8e5bd6', fmtEuro(inc), 'INCASSO', 'g-incasso')
    + (vedeGuadagni() ? tile('#c2185b', fmtEuro(inc-fatt), (nomeGuadagno || 'GUADAGNO NETTO') + ' (INCASSO − FATTURE)', 'g-guadagno') : '')
    + (conMedia ? tile('#d98b1e', n ? fmtEuro(fatt / n) : '—', 'PREZZO MEDIO (FATTURE ÷ PRATICHE)', 'g-guadagno') : '')
    + (conMedia ? tile('#b8860b', n ? fmtEuro(inc / n) : '—', 'INCASSO MEDIO (INCASSO ÷ PRATICHE)', 'g-guadagno') : '')
    + (!conMedia ? (function(){
        // come i 730 consegnati: altre pratiche definite e da definire, con incasso e fatture
        const def = lista.filter(eConsegnata), daD = lista.filter(function(p){ return !eConsegnata(p); });
        const som = function(l, c){ return l.reduce(function(t,p){ return t + Number(p[c]||0); }, 0); };
        return '<div class="stat c4" data-dett="definite" style="background:#8d5a3b; border-color:#8d5a3b; color:#fff"><b>' + sommaPeso(def) + ' / ' + sommaPeso(lista) + '</b><span style="color:rgba(255,255,255,.92); font-weight:600">✔️ ALTRE PRATICHE DEFINITE'
          + '<br><span style="display:inline-block; margin-top:3px; padding:1px 8px; border-radius:999px; background:#1a7f37; color:#fff">✅ definite ' + sommaPeso(def) + '</span> incasso ' + fmtEuro(som(def,'pagato')) + ' · fatture ' + fmtEuro(som(def,'compenso'))
          + '<br><span style="display:inline-block; margin-top:3px; padding:1px 8px; border-radius:999px; background:#fff; color:#8d5a3b">⏳ da definire ' + sommaPeso(daD) + '</span> incasso ' + fmtEuro(som(daD,'pagato')) + ' · fatture ' + fmtEuro(som(daD,'compenso'))
          + '</span></div>'; })() : '')
    + (conMedia ? (function(){ const nums = lista.map(numeroFatturaPratica).filter(function(x){ return x != null; }).sort(function(a,b){ return a-b; });
        return tile('#5b4bb7', nums.length, 'FATTURE 730 NUMERATE' + (nums.length ? '<br>dal n. ' + nums[0] + ' al n. ' + nums[nums.length-1] : '') + (lista.length - nums.length > 0 ? '<br>' + (lista.length - nums.length) + ' ancora senza numero' : ''), 'g-fatture'); })() : '')
    + '</div>';
}

// Pulsante 👁 per mostrare/nascondere ogni campo password, anche quelli creati dopo
function aggiungiOcchioPassword(input){
  if(input.dataset.occhio) return;
  input.dataset.occhio = '1';
  const wrap = document.createElement('span');
  const larghezza = input.style.width && input.style.width !== '100%' ? input.style.width : '';
  wrap.style.cssText = 'position:relative; display:' + (larghezza ? 'inline-block; width:'+larghezza : 'block') + '; margin-bottom:' + (input.style.marginBottom || '0');
  input.style.marginBottom = '0';
  input.style.paddingRight = '46px';
  if(larghezza) input.style.width = '100%';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '👁';
  btn.title = 'Mostra password';
  btn.setAttribute('aria-label', 'Mostra password');
  btn.style.cssText = 'position:absolute; right:4px; top:50%; transform:translateY(-50%); background:#e8eef7; border:1px solid #c5d3e8; border-radius:8px; padding:3px 7px; font-size:18px; line-height:1; cursor:pointer';
  btn.addEventListener('click', function(){
    const nascosta = input.type === 'password';
    input.type = nascosta ? 'text' : 'password';
    btn.textContent = nascosta ? '🙈' : '👁';
    btn.title = nascosta ? 'Nascondi password' : 'Mostra password';
    btn.setAttribute('aria-label', btn.title);
    btn.style.background = nascosta ? '#fde8d7' : '#e8eef7';
    input.focus();
  });
  wrap.appendChild(btn);
}
function aggiungiOcchiPassword(root){
  (root || document).querySelectorAll('input[type="password"]').forEach(aggiungiOcchioPassword);
}
document.addEventListener('DOMContentLoaded', function(){
  aggiungiOcchiPassword();
  new MutationObserver(function(){ aggiungiOcchiPassword(); }).observe(document.body, { childList:true, subtree:true });
});

function trovaInArchivio(nomeCompleto, dataNascita, codiceFiscale){
  const nc = String(nomeCompleto||'').trim().toUpperCase();
  if(codiceFiscale){
    const perCF = ARCHIVIO_CLIENTI.find(function(c){ return c.codiceFiscale === codiceFiscale; });
    if(perCF) return perCF;
  }
  if(!nc) return null;
  return ARCHIVIO_CLIENTI.find(function(c){
    return (c.nomeCompleto||'').toUpperCase() === nc && (!dataNascita || !c.dataNascita || c.dataNascita === dataNascita);
  }) || null;
}

// Cognome e nome separati: dall'archivio se il cliente c'e', altrimenti l'ultima parola e' il nome
function dividiNominativo(p){
  const rec = trovaInArchivio(p.nome, p.cf, p.codiceFiscale);
  if(rec && (rec.cognome || rec.nome)) return { cognome: rec.cognome || '', nome: rec.nome || '' };
  const parole = String(p.nome||'').trim().split(/\s+/).filter(Boolean);
  if(parole.length < 2) return { cognome: parole.join(' '), nome: '' };
  return { cognome: parole.slice(0, -1).join(' '), nome: parole[parole.length-1] };
}

// Dopo una "Modifica": corregge la scheda del cliente in archivio, o lo aggiunge se non c'era
async function aggiornaArchivioCliente(vecchio, nuovo){
  const cognome = (nuovo.cognome||'').trim().toUpperCase();
  const nome = (nuovo.nome||'').trim().toUpperCase();
  const nomeCompleto = (cognome + ' ' + nome).trim();
  if(!nomeCompleto) return;
  const dataNascita = (nuovo.dataNascita||'').trim();
  const rec = trovaInArchivio(vecchio.nomeCompleto, vecchio.dataNascita, vecchio.codiceFiscale);
  if(!rec){ registraClienteSeNuovo(cognome, nome, dataNascita, nuovo.codiceFiscale); return; }
  const giaUguale = (rec.nomeCompleto||'').toUpperCase() === nomeCompleto && (rec.cognome||'') === cognome && (rec.nome||'') === nome && (!dataNascita || rec.dataNascita === dataNascita);
  if(giaUguale) return;
  const altro = trovaInArchivio(nomeCompleto, dataNascita, null);
  if(altro && altro !== rec) return;
  const campi = { nomeCompleto: nomeCompleto, cognome: cognome, nome: nome, dataNascita: dataNascita || rec.dataNascita || '' };
  Object.assign(rec, campi);
  if(rec.id) await data.clienti.aggiorna(rec.id, campi);
}

function puoEliminareClienti(){ return puo('elimina_clienti'); }
async function eliminaClienteArchivio(id, ctx){
  if(!puoEliminareClienti()) return;
  const c = ARCHIVIO_CLIENTI.find(function(x){ return String(x.id) === String(id); });
  if(!c) return;
  const pratiche = (state.pratiche||[]).filter(function(p){ return (p.nome||'').toUpperCase() === (c.nomeCompleto||'').toUpperCase(); }).length;
  const testo = 'Eliminare definitivamente ' + c.nomeCompleto + ' dall\'archivio clienti?'
    + (pratiche ? '\n\nLe sue ' + pratiche + ' pratiche restano nel Registro.' : '')
    + '\n\nL\'operazione non si puo\' annullare.';
  if(!confirm(testo)) return;
  const esito = await data.clienti.elimina(id);
  if(esito && esito.error){ avviso('❌ Cliente non eliminato: ' + esito.error, true); return; }
  ARCHIVIO_CLIENTI = ARCHIVIO_CLIENTI.filter(function(x){ return String(x.id) !== String(id); });
  avviso('✓ ' + c.nomeCompleto + ' eliminato dall\'archivio');
  const inp = document.getElementById(ctx==='cong' ? 'cli-cerca-cong' : ctx==='sc' ? 'sc-cliente' : 'cli-cerca');
  if(inp) cercaClienti(inp.value, ctx);
}

function eColf(tipo){ return String(tipo||'').toUpperCase() === 'CONTRATTI COLF E BADANTI'; }
// Nel modulo: per colf e badanti il campo "Fine lavorazione" diventa "Scadenza assistenza", da compilare a mano
// Nel modulo i chip "Pratica attiva / cessata" compaiono solo per colf e badanti
function aggiornaStatiColfForm(){
  const cont = document.getElementById('f-stato-btns'), sel = document.getElementById('f-stato'), tipo = (document.getElementById('f-tipo')||{}).value;
  if(!cont || !sel) return;
  Array.from(cont.children).forEach(function(b, i){
    const k = Object.keys(STATI)[i];
    b.style.display = statoVisibile(k, tipo) ? '' : 'none';
  });
  if(!statoVisibile(sel.value, tipo)){
    const primo = statoVisibile('arrivo', tipo) ? 'arrivo' : (Object.keys(STATI).find(function(k){ return statoVisibile(k, tipo); }) || 'arrivo');
    pickChip('f-stato-btns', 'f-stato', primo);
  }
}
function aggiornaCampoFineForm(){
  aggiornaStatiColfForm();
  const inp = document.getElementById('f-data-fine');
  const lbl = document.getElementById('f-data-fine-lbl');
  if(!inp || !lbl) return;
  if(eColf(document.getElementById('f-tipo').value)){
    if(inp.readOnly) inp.value = '';
    lbl.innerHTML = '<span style="color:#c0392b; font-weight:700">⏰ Scadenza assistenza</span>';
    inp.readOnly = false;
    inp.style.opacity = '1';
    inp.placeholder = 'GG/MM/AAAA';
    inp.title = 'Data di scadenza dell\'assistenza: viene messa nel calendario con avviso 15 giorni prima';
  } else {
    lbl.textContent = 'Fine lavorazione (automatica)';
    inp.readOnly = true;
    inp.style.opacity = '.8';
    inp.placeholder = 'Quando è Lavorata';
    inp.title = 'Si compila da sola quando l\'etichetta è Lavorata';
    inp.value = document.getElementById('f-stato').value === 'lavorata' ? todayIT() : '';
  }
}

function riepilogoGuadagno(pratiche, pagamentiCaf, speseSede){
  speseSede = speseSede || 0;
  const provento = function(lista){ return lista.reduce(function(a,p){ return a + Number(p.pagato||0) - Number(p.compenso||0); }, 0); };
  const p730 = provento(pratiche.filter(e730Conta));
  const pAltre = provento(pratiche.filter(eAltraConta));
  const pRin = provento(pratiche.filter(eRinuncia));
  const voce = function(testo, valore, colore){ return '<span style="white-space:nowrap"><span style="color:var(--sub); font-weight:600">'+testo+'</span> <b style="color:'+colore+'">'+fmtEuro(valore)+'</b></span>'; };
  return '<div style="flex-basis:100%; margin-top:6px; padding:12px 16px; border-radius:12px; background:var(--card); border:2px dashed #c2185b; font-size:15px; display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px">'
    + voce('Guadagno netto 730', p730, '#1d4f91') + '<b>+</b>'
    + voce('Guadagno netto altre pratiche', pAltre, '#0e8a8a')
    + (Math.abs(pRin) > 0.004 ? '<b>+</b>' + voce('Rinunce', pRin, '#374151') : '') + '<b>−</b>'
    + voce('Spese sede', speseSede, '#b35f0c') + '<b>=</b>'
    + '<span style="white-space:nowrap; background:#c2185b; color:#fff; padding:4px 12px; border-radius:999px; font-weight:800">GUADAGNO NETTO ' + fmtEuro(p730 + pAltre + pRin - speseSede) + '</span>'
    + (function(){ const daVers = pratiche.reduce(function(a,p){ return a + Number(p.compenso||0); }, 0) - pagamentiCaf; return '<div style="flex-basis:100%; font-size:12.5px; color:var(--sub)">Fatture ancora da versare al CAF: <b style="color:' + (daVers > 0.004 ? '#c0392b' : 'inherit') + '">' + fmtEuro(daVers) + '</b> (fatture emesse − versamenti CAF). I versamenti non cambiano il guadagno: cambiano solo il netto in cassa.</div>'; })()
    + '</div>';
}

// Parti della Contabilita' che si possono nascondere a un operatore (se non impostate restano visibili)
const SEZIONI_CONTABILITA = {
  cont_pratiche: 'Numero pratiche',
  cont_economici: 'Riquadri economici e guadagno netto',
  cont_blocchi: 'Blocchi SOLO 730 / ALTRE PRATICHE',
  cont_grafici: 'Grafici e tabella per tipo'
};
function vedeSezioneContabilita(k){
  const u = auth.profilo;
  if(!u || u.ruolo === 'admin') return true;
  return !(u.tabs && u.tabs[k] === false);
}
// Guadagno netto e proventi: per gli operatori solo se autorizzati esplicitamente
function vedeGuadagni(){
  const u = auth.profilo;
  if(!u || u.ruolo === 'admin') return true;
  return !!(u.tabs && u.tabs.cont_guadagni === true);
}

// Inserimento pratica: ogni campo diventa verde quando e' compilato correttamente
function campoCompilatoBene(el){
  const v = (el.value||'').trim();
  if(!v) return false;
  // schede dell'archivio (nuovo cliente nc-, modifica mc-) e dichiarante: controllo secondo il tipo di dato
  const k = String(el.id || '').replace(/^(nc|mc|f-cong|f)-/, '');
  if(k === 'cf' && /^(nc|mc)-/.test(el.id)) return typeof cfValido !== 'function' || cfValido(v);
  if(['nascita','scad','deceduto','dichiarante-nascita','doc-scad'].indexOf(k) >= 0) return !!parseDataIT(v);
  if(k === 'email') return typeof emailValida !== 'function' || emailValida(v);
  if(k === 'tel') return !!numeroWhatsApp(v) || v.replace(/\D/g, '').length >= 9;
  if(k === 'fisso' || k === 'tel-fisso') return v.replace(/\D/g, '').length >= 6;
  if(el.id === 'f-codfisc') return typeof cfValido !== 'function' || cfValido(v);
  if(el.id === 'f-cf' || el.id === 'f-cong-data' || el.id === 'f-data' || el.id === 'f-data-fine') return !!parseDataIT(v);
  if(el.id === 'f-compenso' || el.id === 'f-pagato' || el.id === 'f-richiesto') return !isNaN(parseImporto(v));
  return true;
}
// anche le schede del cliente in archivio: nuovo cliente e modifica
const MODULI_VERDI = '.form-anagrafica, #popup-nuovo-cliente, #popup-mod-cliente';
function aggiornaColoriModulo(){
  document.querySelectorAll('.form-anagrafica input[id^="f-"], .form-anagrafica select[id^="f-"], #popup-nuovo-cliente [id^="nc-"], #popup-mod-cliente [id^="mc-"]').forEach(function(el){
    if(!/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.type === 'checkbox' || el.type === 'hidden' || el.type === 'radio') return;
    el.classList.toggle('compilato', campoCompilatoBene(el));
  });
}
document.addEventListener('input', function(e){ if(e.target.closest && e.target.closest(MODULI_VERDI)) aggiornaColoriModulo(); });
document.addEventListener('change', function(e){ if(e.target.closest && e.target.closest(MODULI_VERDI)) aggiornaColoriModulo(); });
// i campi riempiti dal programma (archivio, lettura documento, azzeramento dopo il salvataggio) non generano eventi
setInterval(aggiornaColoriModulo, 700);

const TIPO_PREDEFINITO = '730 SEDE';
function impostaTipoPredefinito(){
  const sel = document.getElementById('f-tipo');
  if(!sel) return;
  const t = getTipiList().indexOf(TIPO_PREDEFINITO) >= 0 ? TIPO_PREDEFINITO : (getTipiList()[0] || '');
  sel.value = t;
  pickChip('f-tipo-btns','f-tipo', t);
}

function chiediNuovoContribuente(nome, dataNascita, codiceFiscale){
  return new Promise(function(risolvi){
    const vecchio = document.getElementById('popup-nuovo-contribuente');
    if(vecchio) vecchio.remove();
    const ov = document.createElement('div');
    ov.id = 'popup-nuovo-contribuente';
    ov.style.cssText = 'position:fixed; inset:0; z-index:400; background:rgba(15,27,45,.45); display:flex; align-items:center; justify-content:center; padding:16px';
    ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #d98b1e; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:26px 30px; max-width:440px; width:100%; text-align:center">'
      + '<div style="width:64px; height:64px; margin:0 auto 10px; border-radius:50%; background:#d98b1e; color:#fff; font-size:34px; line-height:64px">👤</div>'
      + '<div style="font-size:21px; font-weight:800; color:#d98b1e; margin-bottom:4px">Nuovo Contribuente</div>'
      + '<div style="font-size:15px; font-weight:700; margin-bottom:10px">Inserisco in Anagrafica?</div>'
      + '<div style="font-size:16px; font-weight:700">' + esc(nome) + '</div>'
      + '<div style="font-size:13px; color:var(--sub); margin-bottom:16px">' + (dataNascita ? 'Nato/a il ' + esc(dataNascita) : '') + (codiceFiscale ? (dataNascita ? ' · ' : '') + 'CF ' + esc(codiceFiscale) : '') + '<br>Non è presente nell\'archivio clienti</div>'
      + '<div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap">'
      + '<button type="button" data-r="no" style="background:var(--line); color:var(--ink); min-width:120px; font-size:15px">Annulla</button>'
      + '<button type="button" data-r="si" style="background:#2f9e5f; color:#fff; min-width:160px; font-size:15px">✓ Sì, inserisci</button></div></div>';
    document.body.appendChild(ov);
    const fine = function(esito){ ov.remove(); document.removeEventListener('keydown', tasto); risolvi(esito); };
    const tasto = function(e){ if(e.key === 'Escape') fine(false); if(e.key === 'Enter'){ e.preventDefault(); fine(true); } };
    document.addEventListener('keydown', tasto);
    ov.addEventListener('click', function(e){
      const b = e.target.closest('button[data-r]');
      if(b) fine(b.dataset.r === 'si');
      else if(e.target === ov) fine(false);
    });
    setTimeout(function(){ const si = ov.querySelector('[data-r="si"]'); if(si) si.focus(); }, 50);
  });
}

function confermaPraticaSalvata(id, nome, tipo, mancanti){
  mancanti = mancanti || [];
  const p = (state.pratiche||[]).find(function(x){ return x.id === id; });
  const numero = p ? formattaProtocollo(p) : '';
  const vecchio = document.getElementById('popup-salvata');
  if(vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-salvata';
  ov.style.cssText = 'position:fixed; inset:0; z-index:400; background:rgba(15,27,45,.35); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #2f9e5f; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:26px 30px; max-width:420px; width:100%; text-align:center">'
    + '<div style="width:64px; height:64px; margin:0 auto 10px; border-radius:50%; background:#2f9e5f; color:#fff; font-size:38px; line-height:64px; font-weight:800">✓</div>'
    + '<div style="font-size:22px; font-weight:800; color:#2f9e5f; margin-bottom:6px">Pratica salvata</div>'
    + (numero ? '<div style="font-size:16px; font-weight:700; margin-bottom:2px">Protocollo n. ' + esc(numero) + '</div>' : '')
    + '<div style="font-size:15px">' + esc(nome) + '</div>'
    + '<div style="font-size:13px; color:var(--sub); margin-bottom:' + (mancanti.length ? '10' : '16') + 'px">' + esc(tipo) + '</div>'
    + (mancanti.length ? '<div style="text-align:left; margin-bottom:16px; padding:10px 14px; border-radius:12px; border:2px solid #c0392b; background:color-mix(in srgb, #c0392b 8%, var(--card))">'
        + '<div style="font-weight:800; color:#c0392b; margin-bottom:4px">⚠️ Stato: IN ARRIVO – mancano ' + mancanti.length + (mancanti.length === 1 ? ' documento' : ' documenti') + '</div>'
        + '<ul style="margin:0 0 6px; padding-left:20px; font-size:14px">' + mancanti.map(function(d){ return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>'
        + '<div style="font-size:12.5px; color:var(--sub)">La pratica potrà passare agli stati successivi solo quando il cliente avrà portato tutti i documenti (spuntali nel registro).</div></div>' : '')
    + '<div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap"><button type="button" data-ricevuta="1" style="background:var(--line); color:var(--ink); font-size:15px">🧾 Presa in carico</button><button type="button" data-privacy="1" style="background:var(--line); color:var(--ink); font-size:15px">🔏 Modulo privacy</button>'
    + '<button type="button" style="background:#2f9e5f; color:#fff; min-width:120px; font-size:15px">OK</button></div></div>';
  document.body.appendChild(ov);
  const chiudi = function(){ clearTimeout(t); ov.remove(); };
  const t = mancanti.length ? null : setTimeout(chiudi, 6000);
  ov.addEventListener('click', function(e){
    if(e.target.closest('[data-ricevuta]')){ chiudi(); stampaRicevuta(id); return; }
    if(e.target.closest('[data-privacy]')){ chiudi(); if(typeof stampaPrivacy === 'function') stampaPrivacy(id); return; }
    if(mancanti.length && !e.target.closest('button')) return;
    chiudi();
  });
}

// Impostazioni condivise (dati del CAF per i messaggi): le legge chiunque, le modifica solo l'amministratore
let IMPOSTAZIONI = {};
async function caricaImpostazioni(){
  try{
    const { data: righe, error } = await supabase.from('impostazioni').select('chiave,valore');
    if(error || !Array.isArray(righe)) return;
    IMPOSTAZIONI = {};
    righe.forEach(function(r){ IMPOSTAZIONI[r.chiave] = r.valore || ''; });
    if(typeof applicaEtichetteMenu === 'function') applicaEtichetteMenu();
    if(typeof applicaStati === 'function') applicaStati();
    mostraDatiCaf();
    render(); // importi FPS nell'elenco della contabilita'
  }catch(e){ console.error('impostazioni', e); }
}
let MODELLI_IN_MODIFICA = null;
let PREDEFINITO_IN_MODIFICA = 0;
// Intestazione: giorno e ora sempre aggiornati
function aggiornaOrologio(){
  const box = document.getElementById('hero-orologio');
  if(!box) return;
  const d = new Date();
  box.querySelector('.ora').textContent = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  box.querySelector('.giorno').textContent = d.toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
aggiornaOrologio();
setInterval(aggiornaOrologio, 1000);

// Intestazione: dati del CAF presi da Messaggi > Dati del CAF
function aggiornaIntestazioneCaf(){
  const box = document.getElementById('hero-caf');
  if(!box) return;
  const tel = IMPOSTAZIONI.caf_telefono || '';
  const mail = IMPOSTAZIONI.caf_email || '';
  const orari = testoOrari(leggiTabellaOrari()) || IMPOSTAZIONI.caf_orari || '';
  box.innerHTML = [
    IMPOSTAZIONI.caf_indirizzo ? '<span>📍 ' + esc(IMPOSTAZIONI.caf_indirizzo) + '</span>' : '',
    tel ? '<span>📞 <a href="tel:' + esc(tel.replace(/[^\d+]/g, '')) + '">' + esc(tel) + '</a></span>' : '',
    mail ? '<span>✉️ <a href="mailto:' + esc(mail) + '">' + esc(mail) + '</a></span>' : '',
    orari ? '<span class="orari">🕘 ' + esc(orari) + '</span>' : ''
  ].join('');
}
function mostraDatiCaf(){
  aggiornaIntestazioneCaf();
  const ind = document.getElementById('caf-indirizzo');
  const tel = document.getElementById('caf-telefono');
  if(!ind || !tel) return;
  const scrivibile = puo('messaggi', true);
  const sez = document.getElementById('tab-messaggi');
  if(sez) sez.classList.toggle('sola-lettura-msg', !scrivibile);
  if(document.activeElement !== ind) ind.value = IMPOSTAZIONI.caf_indirizzo || '';
  if(document.activeElement !== tel) tel.value = IMPOSTAZIONI.caf_telefono || '';
  const mail = document.getElementById('caf-email');
  if(mail && document.activeElement !== mail) mail.value = IMPOSTAZIONI.caf_email || '';
  if(!document.getElementById('caf-orari-tabella').contains(document.activeElement)) disegnaTabellaOrari(leggiTabellaOrari());
  const box = document.getElementById('wa-modelli');
  if(box && !(document.activeElement && box.contains(document.activeElement))){
    MODELLI_IN_MODIFICA = modelliWhatsApp().slice();
    PREDEFINITO_IN_MODIFICA = indiceModelloPredefinito();
    disegnaModelliWhatsApp();
  }
  anteprimaMessaggioCaf();
}
function disegnaModelliWhatsApp(){
  const box = document.getElementById('wa-modelli');
  if(!box || !MODELLI_IN_MODIFICA) return;
  box.innerHTML = MODELLI_IN_MODIFICA.map(function(t, i){
    const pred = i === PREDEFINITO_IN_MODIFICA;
    return '<div style="border:2px solid ' + (pred ? '#25d366' : 'var(--line)') + '; border-radius:10px; padding:8px 10px; margin-bottom:8px">'
      + '<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px">'
      + '<b>Messaggio ' + (i + 1) + (pred ? ' ⭐ predefinito' : '') + '</b>'
      + '<span style="display:flex; gap:6px">'
      + (pred ? '' : '<button type="button" style="background:#25d366; color:#fff; padding:4px 10px; font-size:12px" onclick="PREDEFINITO_IN_MODIFICA=' + i + '; disegnaModelliWhatsApp(); anteprimaMessaggioCaf()">⭐ Rendi predefinito</button>')
      + (MODELLI_IN_MODIFICA.length > 1 ? '<button type="button" style="background:none; color:#c0392b; padding:4px 8px; font-size:12px" onclick="eliminaModelloWhatsApp(' + i + ')">✕ Elimina</button>' : '')
      + '</span></div>'
      + '<textarea rows="3" style="width:100%; padding:8px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); font:inherit; font-size:13px; resize:vertical" oninput="MODELLI_IN_MODIFICA[' + i + ']=this.value; anteprimaMessaggioCaf()">' + esc(t).replace(/>/g,'&gt;') + '</textarea></div>';
  }).join('');
}
function aggiungiModelloWhatsApp(){
  if(!MODELLI_IN_MODIFICA) MODELLI_IN_MODIFICA = modelliWhatsApp().slice();
  MODELLI_IN_MODIFICA.push('Gentile {nome}, ');
  disegnaModelliWhatsApp();
  const aree = document.querySelectorAll('#wa-modelli textarea');
  if(aree.length) aree[aree.length - 1].focus();
}
function eliminaModelloWhatsApp(i){
  if(!MODELLI_IN_MODIFICA || MODELLI_IN_MODIFICA.length < 2) return;
  if(!confirm('Eliminare il messaggio ' + (i + 1) + '?')) return;
  MODELLI_IN_MODIFICA.splice(i, 1);
  if(PREDEFINITO_IN_MODIFICA === i) PREDEFINITO_IN_MODIFICA = 0;
  else if(PREDEFINITO_IN_MODIFICA > i) PREDEFINITO_IN_MODIFICA--;
  disegnaModelliWhatsApp();
  anteprimaMessaggioCaf();
}
function anteprimaMessaggioCaf(){
  const box = document.getElementById('caf-anteprima');
  if(!box) return;
  const salvate = IMPOSTAZIONI;
  const modelli = MODELLI_IN_MODIFICA || modelliWhatsApp();
  IMPOSTAZIONI = Object.assign({}, salvate, { caf_indirizzo: document.getElementById('caf-indirizzo').value.trim(), caf_telefono: document.getElementById('caf-telefono').value.trim(), caf_email: document.getElementById('caf-email').value.trim(), caf_orari: testoOrari(tabellaOrariDalModulo()) });
  box.textContent = compilaMessaggio(modelli[PREDEFINITO_IN_MODIFICA] || modelli[0] || '', { nome: 'ROSSI MARIO', tipo: '730 SEDE', numero: 6, anno: annoAttivo() });
  IMPOSTAZIONI = salvate;
}
async function salvaDatiCaf(){
  const modelli = (MODELLI_IN_MODIFICA || modelliWhatsApp()).map(function(t){ return String(t).trim(); }).filter(Boolean);
  if(!modelli.length){ avviso('❌ Serve almeno un messaggio WhatsApp', true); return; }
  const pred = Math.min(PREDEFINITO_IN_MODIFICA, modelli.length - 1);
  const valori = {
    caf_indirizzo: document.getElementById('caf-indirizzo').value.trim(),
    caf_telefono: document.getElementById('caf-telefono').value.trim(),
    caf_email: document.getElementById('caf-email').value.trim(),
    caf_orari: testoOrari(tabellaOrariDalModulo()),
    caf_orari_tabella: JSON.stringify(tabellaOrariDalModulo()),
    whatsapp_modelli: JSON.stringify(modelli),
    whatsapp_predefinito: String(pred)
  };
  for(const chiave in valori){
    const { data: righe, error } = await supabase.from('impostazioni').update({ valore: valori[chiave], aggiornato_il: new Date().toISOString() }).eq('chiave', chiave).select('chiave');
    if(error || !righe || !righe.length){ avviso('❌ Impostazioni non salvate' + (error ? ': ' + error.message : ''), true); return; }
  }
  Object.assign(IMPOSTAZIONI, valori);
  aggiornaIntestazioneCaf();
  MODELLI_IN_MODIFICA = modelli.slice();
  PREDEFINITO_IN_MODIFICA = pred;
  disegnaModelliWhatsApp();
  avviso('✓ Dati del CAF e messaggi salvati');
  anteprimaMessaggioCaf();
}

// Orari di apertura: tabella settimanale (mattina e pomeriggio) da cui si ricava la frase {orari}
const GIORNI_SETTIMANA = ['lunedì','martedì','mercoledì','giovedì','venerdì','sabato','domenica'];
function leggiTabellaOrari(){
  try{
    const t = JSON.parse(IMPOSTAZIONI.caf_orari_tabella || '');
    if(Array.isArray(t) && t.length === 7) return t;
  }catch(e){}
  return GIORNI_SETTIMANA.map(function(_, i){ return { aperto: false, ma: '', mc: '', pa: '', pc: '' }; });
}
function disegnaTabellaOrari(t){
  const tab = document.getElementById('caf-orari-tabella');
  if(!tab) return;
  const ora = function(i, k, v){ return '<input type="time" data-g="'+i+'" data-k="'+k+'" value="'+esc(v||'')+'" oninput="aggiornaTestoOrari()">'; };
  tab.innerHTML = '<thead><tr><th>Giorno</th><th>Aperto</th><th>Mattina: apertura</th><th>chiusura</th><th>Pomeriggio: apertura</th><th>chiusura</th></tr></thead><tbody>'
    + t.map(function(g, i){
      return '<tr class="'+(g.aperto?'':'chiuso')+'"><td style="font-weight:700; text-transform:capitalize">'+GIORNI_SETTIMANA[i]+'</td>'
        + '<td><input type="checkbox" style="width:auto" data-g="'+i+'" data-k="aperto" '+(g.aperto?'checked':'')+' onchange="this.closest(\'tr\').className=this.checked?\'\':\'chiuso\'; aggiornaTestoOrari()"></td>'
        + '<td>'+ora(i,'ma',g.ma)+'</td><td>'+ora(i,'mc',g.mc)+'</td><td>'+ora(i,'pa',g.pa)+'</td><td>'+ora(i,'pc',g.pc)+'</td></tr>';
    }).join('') + '</tbody>';
  aggiornaTestoOrari();
}
function tabellaOrariDalModulo(){
  const t = GIORNI_SETTIMANA.map(function(){ return { aperto: false, ma: '', mc: '', pa: '', pc: '' }; });
  document.querySelectorAll('#caf-orari-tabella [data-g]').forEach(function(el){
    const g = t[+el.dataset.g];
    if(el.dataset.k === 'aperto') g.aperto = el.checked; else g[el.dataset.k] = el.value;
  });
  return t;
}
function testoOrari(t){
  const breve = function(h){ return String(h||'').replace(/^0(\d)/, '$1'); };
  const fascia = function(a, c){ return (a && c) ? breve(a) + '-' + breve(c) : ''; };
  const desc = t.map(function(g){
    if(!g.aperto) return '';
    return [fascia(g.ma, g.mc), fascia(g.pa, g.pc)].filter(Boolean).join(' e ');
  });
  const parti = [];
  let i = 0;
  while(i < 7){
    if(!desc[i]){ i++; continue; }
    let j = i;
    while(j + 1 < 7 && desc[j + 1] === desc[i]) j++;
    const giorni = i === j ? GIORNI_SETTIMANA[i] : (j === i + 1 ? GIORNI_SETTIMANA[i] + ' e ' + GIORNI_SETTIMANA[j] : 'dal ' + GIORNI_SETTIMANA[i] + ' al ' + GIORNI_SETTIMANA[j]);
    parti.push(giorni + ' ' + desc[i]);
    i = j + 1;
  }
  return parti.join(', ');
}
function aggiornaTestoOrari(){
  const el = document.getElementById('caf-orari-testo');
  if(el) el.textContent = testoOrari(tabellaOrariDalModulo()) || '(nessun orario: la frase non compare)';
  anteprimaMessaggioCaf();
}

// ---- Invio WhatsApp multiplo guidato: un clic per cliente (il browser non permette di aprire piu' chat insieme) ----
let INVIO_MULTIPLO = null;
function apriInvioMultiplo(){
  const anno = annoAttivo();
  const lista = (state.pratiche||[]).filter(function(p){ return p.stato === 'lavorata' && annoPratica(p) === anno; })
    .sort(function(a,b){ return a.numero - b.numero; });
  if(!lista.length){ avviso('Nessuna pratica in stato Lavorata nel ' + anno, true); return; }
  INVIO_MULTIPLO = {
    fase: 'scelta',
    lista: lista,
    scelti: {},
    modello: indiceModelloPredefinito(),
    coda: [], pos: 0, inviati: {}
  };
  lista.forEach(function(p){ if(numeroWhatsApp(p.telefono) && !p.whatsappInviato) INVIO_MULTIPLO.scelti[p.id] = true; });
  let ov = document.getElementById('invio-multiplo');
  if(ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'invio-multiplo';
  ov.style.cssText = 'position:fixed; inset:0; z-index:400; background:rgba(15,27,45,.45); display:flex; align-items:center; justify-content:center; padding:16px';
  document.body.appendChild(ov);
  disegnaInvioMultiplo();
}
function chiudiInvioMultiplo(){ const ov = document.getElementById('invio-multiplo'); if(ov) ov.remove(); INVIO_MULTIPLO = null; }
function disegnaInvioMultiplo(){
  const ov = document.getElementById('invio-multiplo');
  const st = INVIO_MULTIPLO;
  if(!ov || !st) return;
  const modelli = modelliWhatsApp();
  let corpo = '';
  if(st.fase === 'scelta'){
    const n = st.lista.filter(function(p){ return st.scelti[p.id]; }).length;
    // pratiche con lo stesso cellulare: un solo messaggio
    const nMsg = Object.keys(st.lista.filter(function(p){ return st.scelti[p.id] && numeroWhatsApp(p.telefono); }).reduce(function(o, p){ o[numeroWhatsApp(p.telefono)] = 1; return o; }, {})).length;
    corpo = '<div style="font-size:18px; font-weight:800; margin-bottom:2px">💬 WhatsApp multiplo</div>'
      + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:10px">Pratiche in stato Lavorata del ' + annoAttivo() + '. Sono già selezionate quelle con un cellulare valido non ancora avvisate.</div>'
      + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px">'
      + '<button type="button" style="background:var(--line); color:var(--ink); padding:6px 10px; font-size:12.5px" onclick="selezionaInvioMultiplo(true)">Seleziona tutti</button>'
      + '<button type="button" style="background:var(--line); color:var(--ink); padding:6px 10px; font-size:12.5px" onclick="selezionaInvioMultiplo(false)">Nessuno</button></div>'
      + (st.lista.length > 1 ? campoRicercaElenco('invio-multiplo', 'Cerca un nome o un protocollo…') : '')
      + '<div style="max-height:45vh; overflow-y:auto; border:1px solid var(--line); border-radius:10px">'
      + st.lista.map(function(p){
          const num = numeroWhatsApp(p.telefono);
          return '<label class="el-riga" style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid var(--line); margin:0; font-size:13px; color:var(--ink); cursor:' + (num ? 'pointer' : 'not-allowed') + '; opacity:' + (num ? '1' : '.5') + '">'
            + '<input type="checkbox" style="width:auto" ' + (st.scelti[p.id] ? 'checked' : '') + (num ? '' : ' disabled') + ' onchange="INVIO_MULTIPLO.scelti[\'' + p.id + '\']=this.checked; disegnaInvioMultiplo()">'
            + '<span style="flex:1; min-width:0"><b>' + esc(formattaProtocollo(p)) + '</b> · ' + esc(p.nome||'') + ' <span style="color:var(--sub)">(' + esc(p.tipo||'') + ')</span><br>'
            + '<span style="font-size:12px; color:var(--sub)">' + (num ? '📱 ' + esc(p.telefono) : '⚠️ cellulare mancante o non valido') + '</span>'
            + (p.whatsappInviato ? ' <span style="font-size:12px; color:#1a9e4b; font-weight:600">· già avvisato il ' + esc(p.whatsappInviato) + '</span>' : '') + '</span></label>';
        }).join('') + '</div>'
      + (modelli.length > 1 ? '<div style="margin-top:10px"><label>Messaggio da inviare</label><select onchange="INVIO_MULTIPLO.modello=parseInt(this.value,10)">'
          + modelli.map(function(m, i){ return '<option value="' + i + '"' + (i === st.modello ? ' selected' : '') + '>' + (i + 1) + (i === indiceModelloPredefinito() ? ' ⭐' : '') + ' – ' + esc(m.slice(0, 70)) + '…</option>'; }).join('') + '</select></div>' : '')
      + '<div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px">'
      + '<button type="button" style="background:var(--line); color:var(--ink)" onclick="chiudiInvioMultiplo()">Annulla</button>'
      + '<button type="button" style="background:#25d366; color:#fff"' + (n ? '' : ' disabled') + ' onclick="avviaInvioMultiplo()">Avanti: ' + nMsg + (nMsg === 1 ? ' messaggio' : ' messaggi') + (nMsg < n ? ' per ' + n + ' pratiche' : '') + ' ›</button></div>';
  } else {
    const tot = st.coda.length;
    const prossimo = st.coda[st.pos];
    corpo = '<div style="font-size:18px; font-weight:800; margin-bottom:2px">💬 Invio in corso: ' + Math.min(st.pos, tot) + ' di ' + tot + '</div>'
      + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:10px">Per ogni cliente si apre WhatsApp con il messaggio già scritto: premi Invio in WhatsApp, poi torna qui e clicca il cliente successivo.</div>'
      + rigaModoWhatsAppPC()
      + (prossimo
          ? '<button type="button" style="display:block; width:100%; background:#25d366; color:#fff; font-size:16px; padding:14px" onclick="inviaProssimoMultiplo()">💬 Apri WhatsApp per ' + esc(prossimo.pratiche.map(function(p){ return nomeProprio(p.nome); }).join(', ')) + (prossimo.pratiche.length > 1 ? ' (un solo messaggio)' : '') + ' (' + (st.pos + 1) + '/' + tot + ')</button>'
            + '<div style="text-align:right; margin-top:6px"><button type="button" style="background:none; color:var(--sub); font-size:12.5px; padding:4px 0" onclick="INVIO_MULTIPLO.pos++; disegnaInvioMultiplo()">Salta questo cliente ›</button></div>'
          : '<div style="padding:14px; border-radius:10px; background:color-mix(in srgb, #25d366 15%, var(--card)); font-weight:700; text-align:center">✅ Finito: aperte ' + Object.keys(st.inviati).length + ' chat su ' + tot + '</div>')
      + '<div style="max-height:40vh; overflow-y:auto; margin-top:10px; border:1px solid var(--line); border-radius:10px">'
      + st.coda.map(function(p, i){
          const fatto = st.inviati[p.id];
          const stato = fatto ? '<span style="color:#1a9e4b; font-weight:700">✓ aperto</span>' : (i < st.pos ? '<span style="color:var(--sub)">saltato</span>' : (i === st.pos ? '<span style="color:#d4881c; font-weight:700">● prossimo</span>' : '<span style="color:var(--sub)">in attesa</span>'));
          return '<div style="display:flex; justify-content:space-between; gap:8px; padding:7px 10px; border-bottom:1px solid var(--line); font-size:13px"><span>' + (i + 1) + '. ' + esc(p.nome||'') + (p.pratiche.length > 1 ? ' <span style="color:#1a9e4b; font-weight:700">· 📱 stesso numero: ' + p.pratiche.length + ' pratiche in un messaggio</span>' : '') + '</span>' + stato + '</div>';
        }).join('') + '</div>'
      + '<div style="display:flex; justify-content:flex-end; margin-top:12px"><button type="button" style="background:var(--line); color:var(--ink)" onclick="chiudiInvioMultiplo()">' + (prossimo ? 'Interrompi' : 'Chiudi') + '</button></div>';
  }
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; max-width:600px; width:100%; max-height:90vh; overflow:auto; padding:18px 20px; box-shadow:0 20px 50px rgba(0,0,0,.3)">' + corpo + '</div>';
}
function selezionaInvioMultiplo(tutti){
  const st = INVIO_MULTIPLO;
  st.lista.forEach(function(p){ st.scelti[p.id] = tutti && !!numeroWhatsApp(p.telefono); });
  disegnaInvioMultiplo();
}
function avviaInvioMultiplo(){
  const st = INVIO_MULTIPLO;
  // stesso cellulare (es. collaboratore o famiglia): un solo messaggio con tutte le pratiche
  const gruppi = {};
  st.coda = [];
  st.lista.filter(function(p){ return st.scelti[p.id] && numeroWhatsApp(p.telefono); }).forEach(function(p){
    const k = numeroWhatsApp(p.telefono);
    if(!gruppi[k]){ gruppi[k] = { id: 'g' + st.coda.length, num: k, pratiche: [] }; st.coda.push(gruppi[k]); }
    gruppi[k].pratiche.push(p);
  });
  st.coda.forEach(function(g){ g.nome = g.pratiche.map(function(p){ return p.nome || ''; }).join(', '); });
  st.pos = 0;
  st.fase = 'invio';
  disegnaInvioMultiplo();
}
// Un solo messaggio per più pratiche pronte con lo stesso cellulare
function messaggioRitiroGruppo(pratiche){
  const righe = pratiche.map(function(p){ return '• ' + nomeProprio(p.nome) + ' – ' + (/^730/.test(p.tipo||'') ? 'dichiarazione 730' : (p.tipo || 'pratica').toLowerCase()) + ' (protocollo n. ' + formattaProtocollo(p) + ')'; }).join('\n');
  return compilaMessaggio('Buongiorno, la informiamo che sono pronte queste pratiche:\n' + righe + '\n\nPotete passare a ritirarle presso il CAF CISL di Alì Terme' + (IMPOSTAZIONI.caf_indirizzo ? ', in {indirizzo}' : '') + '.' + (IMPOSTAZIONI.caf_telefono ? ' Per informazioni può chiamare il {telefono}.' : '') + (IMPOSTAZIONI.caf_orari ? ' Orari di apertura: {orari}.' : '') + ' Cordiali saluti.', pratiche[0]);
}
function inviaProssimoMultiplo(){
  const st = INVIO_MULTIPLO;
  const g = st && st.coda[st.pos];
  if(!g) return;
  if(g.pratiche.length === 1){ apriWhatsApp(g.num, messaggioRitiro(g.pratiche[0], st.modello), g.pratiche[0]); }
  else {
    const testo = messaggioRitiroGruppo(g.pratiche);
    apriWhatsApp(g.num, testo, g.pratiche[0]);
    // le altre pratiche dello stesso messaggio: «avvisato» e una riga nelle comunicazioni per ogni cliente
    g.pratiche.slice(1).forEach(function(p){
      if(typeof registraComunicazione === 'function') registraComunicazione({ canale: 'whatsapp', telefono: g.num, testo: testo, nome: p.nome, cf: p.codiceFiscale || '', nascita: p.cf || '', praticaId: p.id, motivo: 'Pratica pronta', senzaContesto: true });
      p.whatsappInviato = todayIT(); data.pratiche.aggiorna(p.id, { whatsappInviato: p.whatsappInviato });
    });
  }
  st.inviati[g.id] = true;
  st.pos++;
  disegnaInvioMultiplo();
}
