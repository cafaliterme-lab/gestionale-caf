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
  rinuncia_compilazione:{l:'Rinuncia alla compilazione', c:'#374151', e:'⚫'}
};
const TIPI_DEFAULT = ["730 SEDE","730 BRIGUGLIO ANTONIO","730 CAMINITI ANTONIO","730 CAMINITI LUIGI","730 RICCA AGATINO","730 FILCA","730 CRISAFULLI ROBERTO","730 FARAONE ARTURO","730 DECEDUTI","730 INTEGRATIVI/RETTIFICATIVI","730 TRIOLO CARMELA","730 DI BELLA SANTINO","CONTRATTI DI AFFITTO","CONTRATTI COLF E BADANTI","ISEE A PAGAMENTO","IMU"];
let NOMI_OPERATORI = [];
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
function registraClienteSeNuovo(cognome, nome, dataNascita, codiceFiscale){
  cognome = (cognome||'').trim().toUpperCase();
  nome = (nome||'').trim().toUpperCase();
  if(!cognome && !nome) return;
  if(codiceFiscale){
    if(ARCHIVIO_CLIENTI.some(function(c){ return c.codiceFiscale === codiceFiscale; })) return;
    const nc = (cognome+' '+nome).trim();
    const esistente = ARCHIVIO_CLIENTI.find(function(c){ return c.nomeCompleto.toUpperCase() === nc && (c.dataNascita||'') === (dataNascita||'') && !c.codiceFiscale; });
    if(esistente) esistente.codiceFiscale = codiceFiscale;
    else ARCHIVIO_CLIENTI.push({ nomeCompleto: nc, cognome: cognome, nome: nome, dataNascita: (dataNascita||'').trim(), codiceFiscale: codiceFiscale });
    data.clienti.salvaCF({ nomeCompleto: nc, cognome: cognome, nome: nome, dataNascita: (dataNascita||'').trim(), codiceFiscale: codiceFiscale });
    return;
  }
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
  const match = ARCHIVIO_CLIENTI.filter(function(c){ return c.nomeCompleto.toLowerCase().indexOf(q) >= 0 || (c.codiceFiscale||'').toLowerCase().indexOf(q) >= 0; }).slice(0,8);
  if(!match.length){ box.innerHTML = '<div class="cli-row" style="cursor:default">Nessun cliente trovato</div>'; box.classList.add('open'); return; }
  box.innerHTML = match.map(function(c,i){
    const cestino = (puoEliminareClienti() && c.id) ? '<button type="button" title="Elimina definitivamente dall\'archivio" style="float:right; background:none; border:none; padding:2px 6px; font-size:15px; cursor:pointer" onclick="event.stopPropagation(); eliminaClienteArchivio(&quot;'+esc(String(c.id))+'&quot;, &quot;'+ctx+'&quot;)">🗑</button>' : '';
    return '<div class="cli-row" onclick="scegliCliente('+i+', &quot;'+ctx+'&quot;)" data-idx="'+i+'">'+cestino+'<b>'+esc(c.nomeCompleto)+'</b><span class="sub2 sub">Nato/a il '+esc(c.dataNascita)+(c.codiceFiscale ? ' · CF '+esc(c.codiceFiscale) : '')+'</span></div>';
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
    document.getElementById('f-codfisc').value = c.codiceFiscale || '';
    controllaCampoCF();
    aggiornaStoricoForm();
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
// Una pratica congiunta vale 2, una singola 1
function pesoPratica(p){ return (p.congCognome || p.congNome) ? 2 : 1; }
function sommaPeso(lista){ return lista.reduce(function(t,p){ return t + pesoPratica(p); }, 0); }
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
function aggiornaStoricoForm(){
  const box = document.getElementById('storico-cliente');
  if(!box) return;
  const cognome = document.getElementById('f-cognome').value.trim().toUpperCase();
  const nome = document.getElementById('f-nome').value.trim().toUpperCase();
  const nomeCompleto = (cognome+' '+nome).trim();
  const dataNascita = document.getElementById('f-cf').value.trim();
  const cfForm = document.getElementById('f-codfisc').value;
  const lista = cognome ? praticheDelCliente(nomeCompleto, /^\d{2}\/\d{2}\/\d{4}$/.test(dataNascita) ? dataNascita : '', cfValido(cfForm) ? cfForm : '') : [];
  if(!cognome){ box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = 'block';
  if(!lista.length){
    box.innerHTML = '<div class="raff-title">Storico pratiche di '+esc(nomeCompleto)+'</div><div class="empty">Nessuna pratica precedente per questo cliente.</div>';
    return;
  }
  const totFatt = lista.reduce(function(a,p){ return a+Number(p.compenso||0); }, 0);
  const totPag = lista.reduce(function(a,p){ return a+Number(p.pagato||0); }, 0);
  box.innerHTML = '<div class="raff-title">Storico pratiche di '+esc(nomeCompleto)+(dataNascita ? ' <span class="sub2">nato/a il '+esc(dataNascita)+'</span>' : '')+'</div>'
    + '<div class="meta" style="margin:0 0 8px">'+lista.length+' pratiche · Fatturato: '+fmtEuro(totFatt)+' · Pagato: '+fmtEuro(totPag)+'</div>'
    + '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>N. protocollo</th><th>Data</th><th>Tipo</th><th>Stato</th><th>Fattura</th><th>Pagato</th><th>Inserita da</th></tr></thead><tbody>'
    + lista.map(function(p){
        const congiunto = (p.nome||'').toUpperCase() !== nomeCompleto;
        return '<tr><td class="n">'+formattaProtocollo(p)+'</td><td>'+esc(p.data)+'</td><td>'+esc(p.tipo)+(congiunto ? ' <span class="sub2">(congiunto di '+esc(p.nome)+')</span>' : '')+'</td>'
          + '<td>'+esc(statoLabel(p.stato))+'</td><td>'+(p.compenso!=null && p.compenso!=='' ? fmtEuro(p.compenso) : '-')+'</td><td>'+(p.pagato!=null && p.pagato!=='' ? fmtEuro(p.pagato) : '-')+'</td><td>'+esc(p.inseritoDa||'-')+'</td></tr>';
      }).join('')
    + '</tbody></table></div>';
}
// Messaggio sotto il campo codice fiscale: validita', dati ricavati e coerenza con il modulo
function controllaCampoCF(){
  const el = document.getElementById('f-codfisc-msg');
  const cf = document.getElementById('f-codfisc').value;
  if(!cf){ el.style.display = 'none'; return; }
  el.style.display = 'block';
  if(cf.length < 16){ el.style.color = 'var(--sub)'; el.textContent = cf.length + '/16 caratteri'; return; }
  if(!cfValido(cf)){ el.style.color = '#c0392b'; el.textContent = '❌ Codice fiscale non valido (controlla i caratteri)'; return; }
  const dati = datiDaCF(cf);
  const avvisi = controllaCoerenzaCF(cf, document.getElementById('f-cognome').value, document.getElementById('f-nome').value, document.getElementById('f-cf').value);
  if(avvisi.length){ el.style.color = '#b5842a'; el.textContent = '⚠️ Attenzione: ' + avvisi.join('; ') + '.'; return; }
  el.style.color = 'var(--accent)';
  el.textContent = '✓ Codice valido · ' + (dati.sesso === 'F' ? 'Donna nata il ' : 'Uomo nato il ') + dati.dataNascita;
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
    document.getElementById('cli-cerca').value = archiviato.nomeCompleto;
  }
  campo('f-cf', datiDaCF(cf).dataNascita);
  controllaCampoCF();
  aggiornaStoricoForm();
  avviso(archiviato ? '✓ Cliente gia\' in archivio: ' + archiviato.nomeCompleto : '✓ Codice fiscale letto: ' + cf);
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
  collaboratori: 'COLLABORATORI',
  scadenze: 'SCADENZE'
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
  if(!pwd || pwd.length < 6){
    alert('⚠️ Inserisci una password di almeno 6 caratteri: servira\' al nuovo utente per accedere.');
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
        password: pwd,
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
    isee: pulisciArray(state.isee),
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
    'Fine lavorazione': p.dataFine||'',
    'Cognome e Nome': p.nome||'',
    'Congiunta': p.congiunta||'',
    'Data nascita': p.cf||'',
    'Cellulare': p.telefono||'',
    'Telefono fisso': p.telefonoFisso||'',
    'Stato': statoLabel(p.stato),
    'Fattura (€)': Number(p.compenso)||0,
    'Pagato (€)': Number(p.pagato)||0,
    'N. Fattura': p.numFattura||'',
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
  const daLavorare = sommaPeso(tutte.filter(function(p){ return DA_LAVORARE.indexOf(p.stato)>=0; }));
  const rinunce = sommaPeso(tutte.filter(function(p){ return p.stato==='rinuncia_compilazione'; }));
  const lavorate = sommaPeso(tutte) - daLavorare - rinunce;

  const contabRighe = [
    { 'Voce':'Anno di protocollo', 'Valore': anno },
    { 'Voce':'Pratiche totali (congiunte valgono 2)', 'Valore': sommaPeso(tutte) },
    { 'Voce':'Lavorate', 'Valore': lavorate },
    { 'Voce':'Da lavorare', 'Valore': daLavorare },
    { 'Voce':'Rinuncia alla compilazione', 'Valore': rinunce },
    { 'Voce':'Fatture emesse (€)', 'Valore': fattureEmesse },
    { 'Voce':'Incasso totale (€)', 'Valore': incassoLordo },
    { 'Voce':'Pagamenti CAF (€)', 'Valore': versatoCaf },
    { 'Voce':'Netto: incasso − pagamenti CAF (€)', 'Valore': incasso },
    { 'Voce':'Netto − Fatture (€)', 'Valore': incasso - fattureEmesse },
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
    msg.textContent = '⚠️ Scegli prima un file .json o .csv da importare.'; msg.style.display='block'; return;
  }
  if(/\.csv$/i.test(inp.files[0].name)){
    await elaboraImportazione(inp.files[0], msg, document.getElementById('btn-importa'));
    return;
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

  if(!operatori.length) {
    wrap.innerHTML = '<div class="empty">Nessun operatore oltre all\'amministratore</div>';
    return;
  }

  const cardsHtml = operatori.map(function(u){
    const tabs = u.tabs || {};
    const righeTab = Object.keys(TAB_LABELS).map(function(tab){
      return '<div class="perm-row"><span>'+TAB_LABELS[tab]+'</span><label class="chk"><input type="checkbox" class="perm-check" data-user-id="'+u.id+'" data-tab="'+tab+'" '+(tabs[tab]?'checked':'')+' id="perm-'+u.id+'-'+tab+'"> Visibile</label></div>';
    }).join('');
    return '<div class="card" style="margin-bottom:12px">'
      + '<div class="raff-title">'+esc(u.nome)+'</div>'
      + righeTab
      + '<div class="perm-row" style="margin-top:6px; border-top:2px solid var(--line); padding-top:12px"><span>🗑 Elimina clienti dall\'archivio</span><label class="chk"><input type="checkbox" class="perm-check" data-user-id="'+u.id+'" data-tab="elimina_clienti" '+(tabs.elimina_clienti?'checked':'')+' id="perm-'+u.id+'-elimcli"> Consentito</label></div>'
      + '<div class="perm-row"><span>Sola lettura</span><label class="chk"><input type="checkbox" class="perm-check" data-user-id="'+u.id+'" data-type="sola_lettura" '+(u.sola_lettura?'checked':'')+' id="perm-'+u.id+'-solo"> Attiva</label></div>'
      + '<div class="perm-row"><span>Nuova password</span><span style="display:flex; gap:6px"><input type="password" id="pwd-'+u.id+'" placeholder="Lascia vuoto per non cambiarla" style="width:160px; padding:6px 8px; font-size:12.5px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--ink)"><button type="button" style="background:var(--line); color:var(--ink); border:none; border-radius:6px; padding:6px 10px; font-size:12px; cursor:pointer" onclick="cambiaPasswordUtente(&quot;'+u.id+'&quot;, document.getElementById(&quot;pwd-'+u.id+'&quot;).value); document.getElementById(&quot;pwd-'+u.id+'&quot;).value=&quot;&quot;">Salva</button></span></div>'
      + '<div class="perm-row"><span></span><button type="button" style="background:none; border:none; color:#c0392b; font-weight:700; cursor:pointer" onclick="rimuoviUtente(&quot;'+u.id+'&quot;)">Elimina utente</button></div>'
      + '</div>';
  }).join('');

  const buttonHtml = '<div style="margin-top:12px; text-align:left"><button type="button" class="btn-add" onclick="salvaPermessi()">💾 Salva permessi</button></div>';
  wrap.innerHTML = cardsHtml + buttonHtml;
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

    for(const userId in changes) {
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
  if(containerId === 'f-tipo-btns') coloraTriggerTipo();
  if(containerId === 'f-stato-btns'){ coloraTriggerStato(); const df = document.getElementById('f-data-fine'); if(df) df.value = val === 'lavorata' ? todayIT() : ''; }
}
function showTab(btn){
  const tab = btn.dataset.tab;
  document.querySelectorAll('.tabsec').forEach(function(s){ s.classList.remove('active'); });
  document.querySelectorAll('.navmenu button').forEach(function(b){ b.classList.remove('active'); });
  const sec = document.getElementById('tab-'+tab);
  if(sec) sec.classList.add('active');
  btn.classList.add('active');
  if(tab === 'collaboratori') renderCollaboratori();
  if(tab === 'scadenze') renderScadenze();
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
  sel.innerHTML = statoOptions('arrivo');
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
    return [String(p.numero).padStart(4,'0'), p.nome, p.congiunta, p.congData, p.telefono, p.telefonoFisso, p.tipo, p.cf, p.data, p.note, statoLabel(p.stato), p.numFattura, p.inseritoDa].join(' ').toLowerCase().indexOf(q) >= 0;
  });
}

function render(){
  const list = document.getElementById('gruppi'); const oldList = document.getElementById('list'); if(oldList) oldList.innerHTML = '';
  const summary = document.getElementById('summary');
  initSelettoreAnno();
  const annoSel = annoAttivo();
  const pratAnno = state.pratiche.filter(function(p){ return annoPratica(p) === annoSel; });

  const lavorateEl = document.getElementById('badge-lavorate');
  if(lavorateEl){
    // Pratiche lavorate per operatore: un badge per ogni operatore che ha inserito pratiche nell'anno, piu' l'utente collegato
    const perOperatore = {};
    const io = ((auth.profilo && auth.profilo.nome) || '').toUpperCase();
    if(io) perOperatore[io] = 0;
    NOMI_OPERATORI.forEach(function(n){ perOperatore[String(n).toUpperCase()] = 0; });
    pratAnno.forEach(function(p){
      const chi = (p.inseritoDa||'').toUpperCase();
      if(!chi) return;
      if(!(chi in perOperatore)) perOperatore[chi] = 0;
      if(p.stato === 'lavorata') perOperatore[chi] += (p.congCognome || p.congNome) ? 2 : 1;
    });
    const pesoP = function(p){ return (p.congCognome || p.congNome) ? 2 : 1; };
    const ESCLUSI_DA_LAVORARE = ['CONTRATTI DI AFFITTO','CONTRATTI COLF E BADANTI','ISEE A PAGAMENTO','IMU'];
    const pratConteggio = pratAnno.filter(function(p){ return ESCLUSI_DA_LAVORARE.indexOf(String(p.tipo||'').toUpperCase()) < 0; });
    const totPeso = pratConteggio.reduce(function(t,p){ return t+pesoP(p); }, 0);
    const lavPeso = pratConteggio.filter(function(p){ return p.stato === 'lavorata'; }).reduce(function(t,p){ return t+pesoP(p); }, 0);
    const daFare = totPeso - lavPeso;
    const badgeDaFare = '<span title="Pratiche del '+annoSel+' non ancora lavorate (tutti gli altri stati), le congiunte valgono 2. Esclusi contratti di affitto, colf e badanti, ISEE a pagamento e IMU" style="display:inline-flex; align-items:center; justify-content:space-between; gap:8px; background:'+(daFare?'#c0392b':'#2f9e5f')+'; color:#fff; font-size:16px; font-weight:700; padding:9px 16px; border-radius:999px; box-shadow:0 2px 8px rgba(0,0,0,.2)">DA LAVORARE <span style="background:#fff; color:'+(daFare?'#c0392b':'#2f9e5f')+'; font-size:20px; font-weight:800; min-width:34px; text-align:center; padding:2px 10px; border-radius:999px">'+daFare+'</span></span>';
    const totLavorate = pratConteggio.filter(function(p){ return p.stato === 'lavorata' && (p.inseritoDa||'').trim(); }).reduce(function(t,p){ return t+pesoP(p); }, 0);
    const badgeTotLav = '<span title="Somma delle pratiche lavorate da tutti gli operatori nel '+annoSel+', le congiunte valgono 2. Esclusi contratti di affitto, colf e badanti, ISEE a pagamento e IMU" style="display:inline-flex; align-items:center; justify-content:space-between; gap:8px; background:#2f9e5f; color:#fff; font-size:16px; font-weight:700; padding:9px 16px; border-radius:999px; box-shadow:0 2px 8px rgba(0,0,0,.2)">TOTALE LAVORATE <span style="background:#fff; color:#2f9e5f; font-size:20px; font-weight:800; min-width:34px; text-align:center; padding:2px 10px; border-radius:999px">'+totLavorate+'</span></span>';
    const colonna = '<div style="display:flex; flex-direction:column; align-items:stretch; gap:8px">';
    const badgeTotPrat = '<span title="Tutte le pratiche del '+annoSel+' in qualsiasi stato, le congiunte valgono 2. Esclusi contratti di affitto, colf e badanti, ISEE a pagamento e IMU" style="display:inline-flex; align-items:center; justify-content:space-between; gap:8px; background:#374151; color:#fff; font-size:16px; font-weight:700; padding:9px 16px; border-radius:999px; box-shadow:0 2px 8px rgba(0,0,0,.2)">TOTALE PRATICHE <span style="background:#fff; color:#374151; font-size:20px; font-weight:800; min-width:34px; text-align:center; padding:2px 10px; border-radius:999px">'+totPeso+'</span></span>';
    lavorateEl.innerHTML = colonna + badgeTotPrat + badgeDaFare + badgeTotLav + '</div>' + colonna + Object.keys(perOperatore).sort().map(function(chi){
      return '<span title="Pratiche lavorate nel '+annoSel+'" style="display:inline-flex; align-items:center; justify-content:space-between; gap:8px; background:#1d4f91; color:#fff; font-size:16px; font-weight:700; padding:9px 16px; border-radius:999px; box-shadow:0 2px 8px rgba(0,0,0,.2)">'+esc(chi)+' <span style="background:#fff; color:#1d4f91; font-size:20px; font-weight:800; min-width:34px; text-align:center; padding:2px 10px; border-radius:999px">'+perOperatore[chi]+'</span></span>';
    }).join('') + '</div>';
  }
  const versAnno = (state.versamenti||[]).filter(function(v){ return annoDiData(v.data) === annoSel; });

  const tot = sommaPeso(pratAnno);
  const DA_LAVORARE = ['arrivo','lavorazione','da_lavorare_scansionata'];
  const daLavorare = sommaPeso(pratAnno.filter(p=>DA_LAVORARE.indexOf(p.stato)>=0));
  const rinunce = sommaPeso(pratAnno.filter(p=>p.stato==='rinuncia_compilazione'));
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
    <div class="stat c5 verde"><b>${fmtEuro(fattureEmesse)}</b><span>FATTURE EMESSE</span></div>
    <div class="stat c5 viola"><b>${fmtEuro(incassoLordo)}</b><span>INCASSO TOTALE</span></div>
    <div class="stat c5 blu"><b>${fmtEuro(versatoCaf)}</b><span>PAGAMENTI CAF</span></div>
    <div class="stat c5" style="background:#1d4f91; border-color:#1d4f91; color:#fff"><b>${fmtEuro(incasso)}</b><span style="color:rgba(255,255,255,.92); font-weight:600">NETTO (incasso − pagamenti CAF)</span></div>
    <div class="stat c5 gray"><b>${fmtEuro(differenzaIncFatt)}</b><span>NETTO − FATTURE</span></div>
    ${bloccoIntroito('SOLO 730', '#1d4f91', pratAnno.filter(e730), true)}
    ${bloccoIntroito('ALTRE PRATICHE (IMU, ISEE, contratti di affitto, colf e badanti)', '#6b7280', pratAnno.filter(function(p){ return !e730(p); }))}
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
      <div class="raff-diff" id="raff-diff"></div>
      <div id="box-ch-tipi" style="margin-top:14px"><div class="chart-cap">Fatture emesse, incasso e provento per tipo di pratica</div><div class="chart-wrap"><canvas id="ch-tipi"></canvas></div></div>
      <div id="raff-tipi" style="margin-top:14px"></div>`;
  }
  document.getElementById('raff-diff').textContent = 'Netto (incasso − pagamenti CAF) − fatture emesse: ' + fmtEuro(incasso - fattureEmesse);
  aggiornaGrafici(fattureEmesse, incassoLordo);
  aggiornaGraficoTipi(pratAnno);
  document.getElementById('raff-tipi').innerHTML = riepilogoPerTipo(pratAnno);

  const tab = document.getElementById('tabella');
  const ordinate = filtra([...pratAnno].sort((a,b)=> a.numero - b.numero));
  tab.innerHTML = `
    <div class="raff-title">Registro di protocollo</div>
    <div class="tab-wrap">
      <table class="tab-proto tab-registro">
        <thead><tr><th>N.</th><th>Apertura</th><th>Fine lav.</th><th>Mittente</th><th>Tipo</th><th>Stato</th><th>Inserito da</th><th></th></tr></thead>
        <tbody>
          ${ordinate.length ? ordinate.map(p => `
            <tr>
              <td class="n">${formattaProtocollo(p)}</td>
              <td>${p.data||'-'}</td>
              <td>${esc(p.dataFine)||'-'}</td>
              <td class="wrap">${(p.nome||'-').toUpperCase()}${p.congiunta ? '<div class="sub2">Congiunta: '+esc(p.congiunta)+'</div>' : ''}</td>
              <td class="wrap">${p.tipo||'-'}</td>
              <td><select class="stato-tab-sel" style="border-left:6px solid ${(STATI[p.stato]||{}).c||'#8a8f98'}" onchange="cambiaStato('${p.id}', this.value)">${statoOptions(p.stato)}</select></td>
              <td>${formattaInserimento(p)}</td>
              <td><button type="button" style="background:var(--accent); color:var(--accent-ink); border:none; border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer" onclick="apriPraticaDaTabella('${p.id}')">Apri</button> ${bottoneWhatsApp(p, 'border:none; border-radius:6px; padding:5px 8px; font-size:12px; cursor:pointer', true)}</td>
            </tr>`).join('') : '<tr><td colspan="8" class="empty">'+(pratAnno.length ? 'Nessun risultato' : 'Nessuna registrazione per l\'anno '+annoSel)+'</td></tr>'}
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
          ${p.telefono ? `<div class="name">Cell. <a href="tel:${esc(p.telefono)}" style="color:inherit">${esc(p.telefono)}</a></div>` : ''}
          ${p.telefonoFisso ? `<div class="name">Tel. fisso <a href="tel:${esc(p.telefonoFisso)}" style="color:inherit">${esc(p.telefonoFisso)}</a></div>` : ''}
        </div>
        <div class="badges">
          <span class="badge stato">${pallino(p.stato)}${statoLabel(p.stato)}</span>
        </div>
      </div>
      <div class="meta">Aperta il ${p.data||'-'}${p.dataFine ? ' · <b>Fine lavorazione il '+esc(p.dataFine)+'</b>' : ''} ${p.note ? '· '+esc(p.note) : ''}</div>
      <div class="meta compenso">Fattura: ${fmtEuro(p.compenso)} · Pagato effettivo: ${fmtEuro(p.pagato)}</div>
      ${storicoClienteHTML(p)}
      ${p.numFattura ? `<div class="meta">Fattura n. ${esc(p.numFattura)}</div>` : ''}
      ${p._editing ? `
        <div class="grid" style="margin-top:8px">
          <div><label>Cognome</label><input id="e-cognome-${p.id}" value="${esc(dividiNominativo(p).cognome)}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
          <div><label>Nome</label><input id="e-nomeproprio-${p.id}" value="${esc(dividiNominativo(p).nome)}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
          <div class="full"><label class="chk"><input type="checkbox" id="e-congon-${p.id}" ${p.congiunta ? 'checked' : ''} onchange="(function(){var on=document.getElementById('e-congon-${p.id}').checked; document.getElementById('e-congbox-${p.id}').style.display = on?'':'none';})()"> Congiunta</label>
            <div id="e-congbox-${p.id}" class="grid" style="${p.congiunta ? '' : 'display:none; '}margin-top:6px">
              <div><label>Cognome</label><input id="e-congcognome-${p.id}" value="${esc(p.congCognome)}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
              <div><label>Nome</label><input id="e-congnome-${p.id}" value="${esc(p.congNome)}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
              <div><label>Data di nascita</label><input id="e-congdata-${p.id}" value="${esc(p.congData)}" placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"></div>
            </div>
          </div>
          <div><label>Cellulare *</label><input id="e-tel-${p.id}" type="tel" inputmode="tel" value="${esc(p.telefono)}"></div>
          <div><label>Telefono fisso *</label><input id="e-telfisso-${p.id}" type="tel" inputmode="tel" value="${esc(p.telefonoFisso)}"></div>
          <div><label>Data di nascita</label><input id="e-cf-${p.id}" value="${esc(p.cf)}" inputmode="numeric" placeholder="GG/MM/AAAA" oninput="autoSlashData(this)"></div>
          <div><label>Tipo pratica</label><select id="e-tipo-${p.id}">${tipoOptions(p.tipo)}</select></div>
          <div><label>Fattura (€)</label><input id="e-comp-${p.id}" type="text" inputmode="decimal" value="${esc(p.compenso)}"></div>
          <div><label>Pagato effettivo (€)</label><input id="e-pag-${p.id}" type="text" inputmode="decimal" value="${esc(p.pagato)}"></div>
          <div><label>Numero fattura</label><input id="e-nf-${p.id}" value="${esc(p.numFattura)}"></div>
          <div class="full"><label>Note</label><input id="e-note-${p.id}" value="${esc(p.note)}"></div>
        </div>
        <div class="row-actions">
          <button onclick="salvaModifica('${p.id}')" style="background:var(--accent); color:var(--accent-ink)">Salva modifica</button>
          <button onclick="annullaModifica('${p.id}')">Annulla</button>
        </div>
      ` : `
      <div class="row-actions">
        <select class="stato-tab-sel" onchange="cambiaStato('${p.id}', this.value)">${statoOptions(p.stato)}</select>
        ${bottoneWhatsApp(p)}
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
  const telefonoFisso = document.getElementById('f-tel-fisso').value.trim();
  const dataPratica = todayIT();
  const note = document.getElementById('f-note').value.trim();

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
  const codiceFiscale = document.getElementById('f-codfisc').value.trim();
  if(codiceFiscale && !cfValido(codiceFiscale)){
    msg.textContent = '⚠️ Il codice fiscale non e\' valido: correggilo o lascia il campo vuoto.';
    msg.style.display = 'block';
    return;
  }

  const annoPr = annoDiData(dataPratica);
  const doppione = await cercaDoppione(annoPr, nome, tipo, codiceFiscale, null);
  if(doppione){
    msg.textContent = '⚠️ ' + nome + ' ha gia\' una pratica ' + tipo + ' nel ' + annoPr + ' (protocollo ' + doppione + '). Non e\' possibile inserire un doppione.';
    msg.style.display = 'block';
    return;
  }
  registraClienteSeNuovo(cognome, nomeProprio, cf, codiceFiscale);
  if(congCognome || congNome){ registraClienteSeNuovo(congCognome, congNome, congData); }

  // Il numero è assegnato dal trigger del database (non passare numero, il trigger lo genererà)
  const nuovaPratica = {
    anno: annoPr,
    nome, congiunta, congCognome, congNome, congData, telefono, telefonoFisso, cf, codiceFiscale, tipo, compenso, pagato, data: dataPratica, note,
    stato: document.getElementById('f-stato').value || 'arrivo',
    dataFine: document.getElementById('f-stato').value === 'lavorata' ? todayIT() : '',
    fatt: 'dafatturare',
    numFattura: '',
    dataFattura: '',
    inseritoDa: ((auth.profilo && auth.profilo.nome) || currentUser || '').toUpperCase(),
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
  document.getElementById('f-codfisc').value='';
  controllaCampoCF();
  pickChip('f-tipo-btns','f-tipo', document.getElementById('f-tipo').value);
  document.getElementById('f-compenso').value='';
  document.getElementById('f-pagato').value='';
  document.getElementById('cli-cerca').value='';
  document.getElementById('cli-cerca-cong').value='';
  document.getElementById('f-congiunta-on').checked=false;
  toggleCongBox();
  pickChip('f-stato-btns','f-stato','arrivo');
  document.getElementById('f-tel').value='';
  document.getElementById('f-tel-fisso').value='';
  document.getElementById('f-stato').value='arrivo';
  document.getElementById('f-note').value='';
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
  return /^\d{10,15}$/.test(n) ? n : '';
}
function nomeProprio(s){ return String(s||'').toLowerCase().replace(/(^|[\s'-])\S/g, function(c){ return c.toUpperCase(); }); }
function messaggioRitiro(p){
  const cosa = /^730/.test(p.tipo||'') ? 'dichiarazione 730' : 'pratica';
  return 'Gentile ' + nomeProprio(p.nome) + ', la informiamo che la Sua ' + cosa + ' (protocollo n. ' + formattaProtocollo(p) + ') è pronta. '
    + 'Può passare a ritirarla presso il CAF CISL di Alì Terme. Cordiali saluti.';
}
function inviaWhatsApp(id){
  const p = state.pratiche.find(function(x){ return x.id === id; });
  if(!p) return;
  let num = numeroWhatsApp(p.telefono);
  let nuovoTel = '';
  if(!num){
    const t = prompt('Numero di cellulare di ' + p.nome + ' (verra\' salvato nella pratica):', p.telefono || '');
    if(!t) return;
    num = numeroWhatsApp(t);
    if(!num){ avviso('❌ Numero di telefono non valido', true); return; }
    nuovoTel = t.trim();
  }
  // Apertura immediata: dopo un'attesa il browser bloccherebbe la nuova finestra
  window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(messaggioRitiro(p)), '_blank');
  if(nuovoTel) data.pratiche.aggiorna(id, { telefono: nuovoTel });
}
function bottoneWhatsApp(p, stile, soloIcona){
  if(p.stato !== 'lavorata') return '';
  return '<button type="button" class="btn-wa" style="' + (stile||'') + '" onclick="inviaWhatsApp(\'' + p.id + '\')" title="' + (p.telefono ? 'Invia a ' + esc(p.telefono) : 'Telefono mancante: verra\' chiesto') + '">' + (soloIcona ? '💬' : '💬 WhatsApp') + '</button>';
}

const STATI_IN_LAVORAZIONE = ['arrivo','lavorazione','da_lavorare_scansionata'];
async function cambiaStato(id, stato){
  const p = (state.pratiche||[]).find(function(x){ return x.id===id; });
  const campi = { stato: stato };
  if(STATI_IN_LAVORAZIONE.indexOf(stato) >= 0) campi.dataFine = '';
  else if(stato === 'lavorata' && !(p && p.dataFine)) campi.dataFine = todayIT();
  const result = await data.pratiche.aggiorna(id, campi);
  if(result && result.error){ avviso('❌ Stato non salvato: ' + result.error, true); return; }
  avviso('✓ Stato salvato: ' + statoLabel(stato));
  render();
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

async function salvaModifica(id){
  const p = state.pratiche.find(x=>x.id===id);
  if(!p) return;
  const g = k => document.getElementById(k+'-'+id).value;
  var cc = g('e-congcognome').trim().toUpperCase();
  var cn = g('e-congnome').trim().toUpperCase();
  const numFattura = g('e-nf').trim();
  const cognomeTit = g('e-cognome').trim().toUpperCase();
  const nomeTit = g('e-nomeproprio').trim().toUpperCase();
  if(!cognomeTit && !nomeTit){ avviso('❌ Inserisci il cognome del contribuente.', true); return; }
  const campi = {
    nome: (cognomeTit + ' ' + nomeTit).trim(),
    congCognome: cc, congNome: cn,
    congData: g('e-congdata').trim(),
    congiunta: [cc, cn].filter(Boolean).join(' '),
    telefono: g('e-tel').trim(),
    telefonoFisso: g('e-telfisso').trim(),
    cf: g('e-cf').trim(),
    tipo: g('e-tipo'),
    compenso: parseImporto(g('e-comp')) || '',
    pagato: parseImporto(g('e-pag')) || '',
    numFattura: numFattura,
    note: g('e-note').trim(),
    fatt: (numFattura || p.dataFattura) ? 'fatturata' : 'dafatturare'
  };
  if(!campi.telefono && !campi.telefonoFisso){
    avviso('❌ Inserisci almeno un numero di telefono: cellulare o telefono fisso.', true);
    return;
  }
  const annoP = annoPratica(p);
  const doppione = await cercaDoppione(annoP, campi.nome, campi.tipo, p.codiceFiscale, id);
  if(doppione){
    avviso('❌ ' + campi.nome + ' ha gia\' una pratica ' + campi.tipo + ' nel ' + annoP + ' (protocollo ' + doppione + '): modifica non salvata.', true);
    return;
  }
  delete p._editing;
  const vecchiTit = { nomeCompleto: p.nome, dataNascita: p.cf, codiceFiscale: p.codiceFiscale };
  const vecchiCong = { nomeCompleto: ((p.congCognome||'')+' '+(p.congNome||'')).trim(), dataNascita: p.congData };
  const esito = await data.pratiche.aggiorna(id, campi);
  if(esito && esito.error) return;
  await aggiornaArchivioCliente(vecchiTit, { cognome: cognomeTit, nome: nomeTit, dataNascita: campi.cf, codiceFiscale: p.codiceFiscale });
  if(cc || cn) await aggiornaArchivioCliente(vecchiCong, { cognome: cc, nome: cn, dataNascita: campi.congData });
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
function qrSvg(testo){
  const qr = qrcode(0, 'M');
  qr.addData(testo);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 1, scalable: true });
}
function disegnaQrApp(){
  const box = document.getElementById('qr-app');
  if(!box || typeof qrcode !== 'function') return;
  box.innerHTML = qrSvg(indirizzoApp());
}
function apriQrApp(){
  document.getElementById('qr-grande').innerHTML = qrSvg(indirizzoApp());
  document.getElementById('qr-url').textContent = indirizzoApp();
  document.getElementById('qr-overlay').classList.add('open');
}

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
  caricaNomiOperatori();

  // Aggiorna l'interfaccia con il tipo di pratica dell'ultima pratica
  const ultima = state.pratiche.slice().sort(function(a,b){ return b.numero - a.numero; })[0];
  if(ultima && ultima.tipo){ document.getElementById('f-tipo').value = ultima.tipo; pickChip('f-tipo-btns','f-tipo', ultima.tipo); }
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

function riepilogoPerTipo(pratiche){
  const d = datiPerTipo(pratiche);
  if(!d.tipi.length) return '';
  return '<div class="raff-title">Dettaglio per tipo di pratica</div>'
    + '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>Tipo di pratica</th><th>Pratiche</th><th>Fatture emesse</th><th>Incasso</th><th>Provento (incasso − fatture)</th></tr></thead><tbody>'
    + d.tipi.map(function(t){
      const r = d.righe[t];
      return '<tr><td>'+esc(t)+'</td><td>'+r.n+'</td><td>'+fmtEuro(r.fatt)+'</td><td>'+fmtEuro(r.inc)+'</td><td><b>'+fmtEuro(r.inc-r.fatt)+'</b></td></tr>';
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
  if(wrap) wrap.style.height = Math.max(220, 70 + d.tipi.length * 46) + 'px';
  if(!chTipi){
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue('--ink').trim() || '#0f1b2d';
    const sub = cs.getPropertyValue('--sub').trim() || '#5b6b82';
    chTipi = new Chart(cv, {type:'bar',
      data:{labels:d.tipi, datasets:[
        {label:'Fatture emesse', data:fatt, backgroundColor:'#2f9e5f', borderRadius:6, maxBarThickness:18},
        {label:'Incasso', data:inc, backgroundColor:'#8e5bd6', borderRadius:6, maxBarThickness:18},
        {label:'Provento', data:prov, backgroundColor:'#374151', borderRadius:6, maxBarThickness:18}]},
      options:{indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins:{legend:{position:'bottom', labels:{boxWidth:10, color:ink, font:{size:11}}}, tooltip:{callbacks:{label:function(c){ return c.dataset.label+': '+fmtEuro(c.parsed.x); }}}},
        scales:{y:{ticks:{color:ink, font:{size:11}}, grid:{display:false}}, x:{beginAtZero:true, ticks:{color:sub, callback:function(v){ return '€ '+Number(v).toLocaleString('it-IT'); }}, grid:{color:'rgba(128,140,160,.18)'}}}}});
  } else {
    chTipi.data.labels = d.tipi;
    chTipi.data.datasets[0].data = fatt; chTipi.data.datasets[1].data = inc; chTipi.data.datasets[2].data = prov;
    chTipi.update();
  }
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
  let elenco = (state.pratiche||[]).map(function(p){ return { id:p.id, numero:p.numero, anno:annoPratica(p), nome:p.nome, tipo:p.tipo, codiceFiscale:p.codiceFiscale }; });
  try{
    const { data: righe, error } = await supabase.from('pratiche').select('id,numero,anno,nome,tipo,codice_fiscale').eq('anno', anno).eq('nome', nome).eq('tipo', tipo);
    if(!error && Array.isArray(righe)) elenco = righe.map(function(r){ return { id:r.id, numero:r.numero, anno:r.anno, nome:r.nome, tipo:r.tipo, codiceFiscale:r.codice_fiscale }; });
  }catch(e){ console.error('controllo doppioni', e); }
  const trovato = elenco.find(function(p){
    if(p.id === escludiId) return false;
    if(Number(p.anno) !== Number(anno) || (p.nome||'').toUpperCase() !== nome.toUpperCase() || p.tipo !== tipo) return false;
    return !(codiceFiscale && p.codiceFiscale && p.codiceFiscale !== codiceFiscale);
  });
  return trovato ? String(trovato.numero).padStart(4,'0') + '/' + anno : null;
}

function e730(p){ return /^730\b/.test(String(p.tipo||'').toUpperCase()); }
function bloccoIntroito(titolo, colore, lista, conMedia){
  const fatt = lista.reduce(function(a,p){ return a+Number(p.compenso||0); }, 0);
  const inc = lista.reduce(function(a,p){ return a+Number(p.pagato||0); }, 0);
  const n = sommaPeso(lista);
  const tile = function(bg, valore, etichetta){
    return '<div class="stat '+(conMedia?'c5':'c4')+'" style="background:'+bg+'; border-color:'+bg+'; color:#fff"><b>'+valore+'</b><span style="color:rgba(255,255,255,.92); font-weight:600; letter-spacing:.03em">'+etichetta+'</span></div>';
  };
  return '<div style="flex-basis:100%; margin-top:10px; padding:8px 14px; border-radius:10px; background:'+colore+'; color:#fff; font-size:15px; font-weight:800; letter-spacing:.04em">'+esc(titolo)+'</div>'
    + tile(colore, n, 'PRATICHE')
    + tile('#2f9e5f', fmtEuro(fatt), 'FATTURE EMESSE')
    + tile('#8e5bd6', fmtEuro(inc), 'INCASSO')
    + tile('#374151', fmtEuro(inc-fatt), 'PROVENTO (INCASSO − FATTURE)')
    + (conMedia ? tile('#d98b1e', n ? fmtEuro(fatt / n) : '—', 'PREZZO MEDIO (FATTURE ÷ PRATICHE)') : '');
}

// Pulsante 👁 per mostrare/nascondere ogni campo password, anche quelli creati dopo
function aggiungiOcchioPassword(input){
  if(input.dataset.occhio) return;
  input.dataset.occhio = '1';
  const wrap = document.createElement('span');
  const larghezza = input.style.width && input.style.width !== '100%' ? input.style.width : '';
  wrap.style.cssText = 'position:relative; display:' + (larghezza ? 'inline-block; width:'+larghezza : 'block') + '; margin-bottom:' + (input.style.marginBottom || '0');
  input.style.marginBottom = '0';
  input.style.paddingRight = '38px';
  if(larghezza) input.style.width = '100%';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '👁';
  btn.title = 'Mostra password';
  btn.setAttribute('aria-label', 'Mostra password');
  btn.style.cssText = 'position:absolute; right:4px; top:50%; transform:translateY(-50%); background:none; border:none; padding:4px 6px; font-size:16px; line-height:1; cursor:pointer; opacity:.55';
  btn.addEventListener('click', function(){
    const nascosta = input.type === 'password';
    input.type = nascosta ? 'text' : 'password';
    btn.textContent = nascosta ? '🙈' : '👁';
    btn.title = nascosta ? 'Nascondi password' : 'Mostra password';
    btn.setAttribute('aria-label', btn.title);
    btn.style.opacity = nascosta ? '.9' : '.55';
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
  const inp = document.getElementById(ctx==='cong' ? 'cli-cerca-cong' : 'cli-cerca');
  if(inp) cercaClienti(inp.value, ctx);
}
