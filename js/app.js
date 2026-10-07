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
const TIPI_DEFAULT = ["730 SEDE","730 BRIGUGLIO ANTONIO","730 CAMINITI ANTONIO","730 CAMINITI LUIGI","730 RICCA AGATINO","730 FILCA","730 FPS IN CONVENZIONE","730 CRISAFULLI ROBERTO","730 FARAONE ARTURO","730 DECEDUTI","730 INTEGRATIVI/RETTIFICATIVI","730 TRIOLO CARMELA","730 DI BELLA SANTINO","CONTRATTI DI AFFITTO","CONTRATTI COLF E BADANTI","ISEE A PAGAMENTO","IMU","SUCCESSIONI","ISEE","SEND","MODELLI UNICO PF","RED","INVCIV","ADI","F24"];
let NOMI_OPERATORI = [];
function getTipiList(){ return (state.collaboratori && state.collaboratori.length) ? state.collaboratori : TIPI_DEFAULT; }
Object.defineProperty(window, 'TIPI', { get: function(){ return getTipiList(); } });
function statoLabel(s){ return (STATI[s]||{}).l || s; }
function pallino(s){ return '<span class="dot" style="background:'+((STATI[s]||{}).c||'#8a8f98')+'"></span>'; }
function statoOptions(sel, tipo){ return Object.keys(STATI).filter(k=>statoVisibile(k, tipo, sel)).map(k=>'<option value="'+k+'"'+(k===sel?' selected':'')+'>'+STATI[k].e+' '+STATI[k].l+'</option>').join(''); }
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
  if(!on){ ['f-cong-cognome','f-cong-nome','f-cong-data','f-cong-cf','f-cong-tel'].forEach(function(id){ document.getElementById(id).value=''; }); document.getElementById('cli-cerca-cong').value=''; }
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
  cognome = (cognome||'').trim().toUpperCase();
  nome = (nome||'').trim().toUpperCase();
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
    const esistente = ARCHIVIO_CLIENTI.find(function(c){ return c.nomeCompleto.toUpperCase() === nc && (c.dataNascita||'') === dataNascita && !c.codiceFiscale; });
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
  // Inizialmente vuoto, verrà popolato dopo il login
  ARCHIVIO_CLIENTI = [];
}
function boxRisultatiClienti(ctx){ return document.getElementById(ctx==='cong' ? 'cli-results-cong' : ctx==='sc' ? 'cli-results-sc' : 'cli-results'); }
function cercaClienti(q, ctx){
  ctx = ctx || 'main';
  const box = boxRisultatiClienti(ctx);
  q = (q||'').trim().toLowerCase();
  if(!q){ box.classList.remove('open'); box.innerHTML=''; return; }
  const match = ARCHIVIO_CLIENTI.filter(function(c){ return c.nomeCompleto.toLowerCase().indexOf(q) >= 0 || (c.codiceFiscale||'').toLowerCase().indexOf(q) >= 0; }).slice(0,8);
  if(!match.length){ box.innerHTML = '<div class="cli-row" style="cursor:default">Nessun cliente trovato</div>'; box.classList.add('open'); return; }
  box.innerHTML = match.map(function(c,i){
    const cestino = (puoEliminareClienti() && c.id) ? '<button type="button" title="Elimina definitivamente dall\'archivio" style="float:right; background:none; border:none; padding:2px 6px; font-size:15px; cursor:pointer" onclick="event.stopPropagation(); eliminaClienteArchivio(&quot;'+esc(String(c.id))+'&quot;, &quot;'+ctx+'&quot;)">🗑</button>' : '';
    return '<div class="cli-row" onclick="scegliCliente('+i+', &quot;'+ctx+'&quot;)" data-idx="'+i+'">'+cestino+'<b>'+esc(c.nomeCompleto)+'</b><span class="sub2 sub">Nato/a il '+esc(c.dataNascita)+(c.codiceFiscale ? ' · CF '+esc(c.codiceFiscale) : '')+(c.telefono || c.telefonoFisso ? ' · 📞 '+esc(c.telefono || c.telefonoFisso) : '')+'</span></div>';
  }).join('');
  box.dataset.match = JSON.stringify(match);
  box.classList.add('open');
}
function scegliCliente(i, ctx){
  ctx = ctx || 'main';
  const box = boxRisultatiClienti(ctx);
  const match = JSON.parse(box.dataset.match || '[]');
  const c = match[i];
  if(!c) return;
  if(ctx==='sc'){
    document.getElementById('sc-cliente').value = c.nomeCompleto.toUpperCase();
  } else if(ctx==='cong'){
    document.getElementById('f-cong-cognome').value = c.cognome.toUpperCase();
    document.getElementById('f-cong-nome').value = c.nome.toUpperCase();
    document.getElementById('f-cong-data').value = c.dataNascita;
    document.getElementById('cli-cerca-cong').value = c.nomeCompleto;
    document.getElementById('f-cong-cf').value = c.codiceFiscale || '';
    document.getElementById('f-cong-tel').value = c.telefono || '';
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
  box.innerHTML = (typeof avvisoMorosoHTML === 'function' ? avvisoMorosoHTML(lista) : '') + '<div class="raff-title">Storico pratiche di '+esc(nomeCompleto)+(dataNascita ? ' <span class="sub2">nato/a il '+esc(dataNascita)+'</span>' : '')+'</div>'
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
    campo('f-tel', archiviato.telefono);
    campo('f-tel-fisso', archiviato.telefonoFisso);
    campo('f-email', archiviato.email);
    campo('f-doc-scad', archiviato.documentoScadenza);
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
function formattaProtocollo(p){
  const anno = annoPratica(p);
  const num = serieDi(p) + '-' + String(p.numero).padStart(4,'0');
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
  anagrafica: 'INSERIMENTO ANAGRAFICA',
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
  bar.innerHTML = '<span>Accesso come <b>'+esc(u.nome)+(isAdmin?' (amministratore)':'')+'</b></span><button type="button" onclick="apriGuida()" style="background:#1d4f91; color:#fff; border-color:#1d4f91; font-weight:700" title="Guida del programma con ricerca">📖 GUIDA DEL PROGRAMMA</button><button type="button" onclick="cambiaUtente()">Cambia utente</button><button type="button" onclick="esciDalProgramma()">🚪 Esci dal programma</button>';
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
    'Fine lavorazione': eColf(p.tipo) ? '' : (p.dataFine||''),
    'Scadenza assistenza': p.scadenzaAssistenza||'',
    'Cognome e Nome': p.nome||'',
    'Congiunta': p.congiunta||'',
    'Data nascita': p.cf||'',
    'Cellulare': p.telefono||'',
    'Telefono fisso': p.telefonoFisso||'',
    'E-mail': p.email||'',
    'Stato': statoLabel(p.stato),
    'Fattura (€)': Number(p.compenso)||0,
    'Pagato (€)': Number(p.pagato)||0,
    'Pagamento': p.metodoPagamento||'',
    'N. Fattura': p.numFattura||'',
    'Inserito da': p.inseritoDa||'',
    'Note': p.note||''
  };
}
function formattaProtocolloTesto(p){ return formattaProtocollo(p); }
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
  const DA_LAVORARE = STATI_DA_LAVORARE;
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
    { 'Voce':'Spese gestione sede (€)', 'Valore': (typeof totaleSpeseSede === 'function' ? totaleSpeseSede(anno) : 0) },
    { 'Voce':'Guadagno netto: netto − fatture − spese sede (€)', 'Valore': incasso - fattureEmesse - (typeof totaleSpeseSede === 'function' ? totaleSpeseSede(anno) : 0) },
    { 'Voce':'', 'Valore':'' },
    { 'Voce':'Dettaglio per collaboratore / tipo pratica', 'Valore':'' }
  ];
  nomiGruppi.forEach(function(k){
    const items = gruppi[k] || [];
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
    wrap.innerHTML = '<div class="empty">Nessun altro utente oltre a te</div>';
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
      + '</div>'
      + '<div class="perm-row"><span>Nuova password</span><span style="display:flex; gap:6px"><input type="password" id="pwd-'+u.id+'" placeholder="Lascia vuoto per non cambiarla" style="width:160px; padding:6px 8px; font-size:12.5px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--ink)"><button type="button" style="background:var(--line); color:var(--ink); border:none; border-radius:6px; padding:6px 10px; font-size:12px; cursor:pointer" onclick="cambiaPasswordUtente(&quot;'+u.id+'&quot;, document.getElementById(&quot;pwd-'+u.id+'&quot;).value, { nome: &quot;'+esc(u.nome)+'&quot;, email: &quot;'+esc(u.email||'')+'&quot;, ruolo: &quot;'+ruoloAttuale+'&quot; })">Salva</button></span></div>'
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
function staModificando(){
  const a = document.activeElement;
  if(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'button') return true;
  if(document.querySelector('.scanner-overlay.open, #invio-multiplo, #finestra-stampa, #editor-documenti, .conferma-scritta, #popup-nuovo-contribuente')) return true;
  return [state.pratiche, state.versamenti, state.isee].some(function(l){ return (l||[]).some(function(x){ return x._editing || x._confirmDelete || x._editingFattura; }); });
}
async function aggiornaDaServer(){
  if(AGGIORNAMENTO_IN_CORSO || document.hidden || !auth.profilo || !localStorage.getItem('auth_token') || staModificando()) return;
  AGGIORNAMENTO_IN_CORSO = true;
  try{
    // Prima si chiede al server solo una "impronta" dei dati (pochi byte): si ricarica tutto solo se e' cambiata
    const { data: firma, error } = await supabase.rpc('firma_dati', {});
    if(!error && firma){
      if(firma === ULTIMA_FIRMA_SERVER) return;
      ULTIMA_FIRMA_SERVER = firma;
    }
    // impostazioni (dati CAF, telefoni CUD, importi convenzioni) e modulistica cambiate da un altro utente
    const inModifica = document.activeElement && document.activeElement.closest && document.activeElement.closest('#tab-messaggi, #tab-permessi');
    if(!inModifica) await caricaImpostazioni();
    if(typeof MODULI_CARICATI !== 'undefined'){
      MODULI_CARICATI = false;
      const sm = document.getElementById('tab-modulistica');
      if(sm && sm.classList.contains('active') && typeof renderModulistica === 'function') renderModulistica();
    }
    const prima = firmaDati();
    const ok = await data.caricaTutto({ silenzioso: true });
    if(ok && firmaDati() !== prima && !staModificando()) onDatiAggiornati();
  }catch(e){ console.error('aggiornamento automatico', e); }
  finally{ AGGIORNAMENTO_IN_CORSO = false; }
}
setInterval(aggiornaDaServer, 15000);
window.addEventListener('focus', aggiornaDaServer);
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
  if(containerId === 'f-tipo-btns'){ coloraTriggerTipo(); aggiornaCampoFineForm(); applicaFatturaAutomatica(val); if(typeof mostraImportiFPSModulo === 'function') mostraImportiFPSModulo(val); }
  if(containerId === 'f-stato-btns'){ coloraTriggerStato(); const df = document.getElementById('f-data-fine'); if(df && !eColf(document.getElementById('f-tipo').value)) df.value = val === 'lavorata' ? todayIT() : ''; }
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
  if(tab === 'messaggi') mostraDatiCaf();
  if(tab === 'grafici') renderGrafici();
  if(tab === 'spese' && typeof renderSpese === 'function') renderSpese();
  if(tab === 'modulistica' && typeof renderModulistica === 'function') renderModulistica();
  if(tab === 'permessi'){ renderPermessi(); if(typeof renderTipiPratica === 'function'){ renderTipiPratica(true); renderEtichetteMenu(true); renderStatiPratica(true); } if(typeof renderBackupEStorico === 'function') renderBackupEStorico(); }
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
    + '<td><span style="display:inline-block; background:#8a8f98; color:#fff; border-radius:999px; padding:3px 10px; font-size:12px; font-weight:700">ANNULLATA</span></td>'
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
function filtra(lista){
  initFiltroStato();
  const statoSel = (document.getElementById('filtro-stato')||{}).value || '';
  if(statoSel){ lista = lista.filter(function(p){ return p.stato === statoSel; }); }
  const q = ((document.getElementById('cerca')||{}).value||'').trim().toLowerCase();
  if(!q) return lista;
  return lista.filter(function(p){
    return [String(p.numero).padStart(4,'0'), formattaProtocollo(p), p.nome, p.congiunta, p.congData, p.telefono, p.telefonoFisso, p.tipo, p.cf, p.data, p.note, statoLabel(p.stato), p.numFattura, p.inseritoDa].join(' ').toLowerCase().indexOf(q) >= 0;
  });
}

function render(){
  if(typeof renderGrafici === 'function') renderGrafici();
  if(typeof renderMorosi === 'function') renderMorosi();
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
    const badge = function(testo, numero, colore, titolo){
      return '<span title="' + esc(titolo) + '" style="display:flex; align-items:center; justify-content:space-between; gap:8px; background:' + colore + '; color:#fff; font-size:13.5px; font-weight:700; padding:5px 6px 5px 12px; border-radius:999px; box-shadow:0 2px 8px rgba(0,0,0,.2); white-space:nowrap">' + testo
        + ' <span style="background:#fff; color:' + colore + '; font-size:16px; font-weight:800; min-width:30px; text-align:center; padding:1px 8px; border-radius:999px">' + numero + '</span></span>';
    };
    const nota = ' del ' + annoSel + ': solo 730, le congiunte valgono 2.';
    lavorateEl.innerHTML = '<div style="display:flex; flex-direction:column; align-items:stretch; gap:5px; min-width:210px">'
      + badge('TOTALE PRATICHE', c.tot, '#374151', 'Tutte le pratiche' + nota + (c.rinunce ? ' Comprese ' + c.rinunce + ' rinunce alla compilazione.' : ''))
      + badge('DA LAVORARE', c.daFare, c.daFare ? '#c0392b' : '#2f9e5f', 'In arrivo, in lavorazione o da lavorare scansionata' + nota)
      + badge('TOTALE LAVORATE', c.lav, '#2f9e5f', 'Lavorate, da fatturare, da pagare, pagate o non pagate' + nota)
      + Object.keys(perOperatore).sort().map(function(chi){ return badge(esc(chi), perOperatore[chi], '#1d4f91', 'Pratiche 730 lavorate da ' + chi + nota); }).join('')
      + '</div>';
    if(typeof posizionaPannelloScadenze === 'function') posizionaPannelloScadenze();
  }
  const versAnno = (state.versamenti||[]).filter(function(v){ return annoDiData(v.data) === annoSel; });

  const conti = conteggi730(pratAnno);
  const tot = conti.tot, daLavorare = conti.daFare, lavorate = conti.lav;
  const fattureEmesse = pratAnno.reduce((a,p)=>a+Number(p.compenso||0),0);
  const incassoLordo = pratAnno.reduce((a,p)=>a+Number(p.pagato||0),0);
  const versatoCaf = versAnno.reduce(function(a,v){ return a+Number(v.importo||0); }, 0);
  const incasso = incassoLordo - versatoCaf;
  const speseSede = typeof totaleSpeseSede === 'function' ? totaleSpeseSede(annoSel) : 0;
  const differenzaIncFatt = incasso - fattureEmesse - speseSede;

  const vPrat = vedeSezioneContabilita('cont_pratiche'), vEco = vedeSezioneContabilita('cont_economici'), vBlocchi = vedeSezioneContabilita('cont_blocchi'), vGrafici = vedeSezioneContabilita('cont_grafici');
  const contExcel = document.getElementById('cont-excel');
  if(contExcel) contExcel.style.display = (vPrat && vEco && vBlocchi && vGrafici) ? '' : 'none';
  const raffBox = document.getElementById('raffronto');
  if(raffBox) raffBox.style.display = vGrafici ? '' : 'none';
  summary.innerHTML = (vPrat ? `
    <div class="stat c3" style="background:#1d4f91; border-color:#1d4f91; color:#fff"><b>${tot}</b><span style="color:rgba(255,255,255,.92); font-weight:600">PRATICHE 730 TOTALI</span></div>
    <div class="stat c3" style="background:#2f9e5f; border-color:#2f9e5f; color:#fff"><b>${lavorate}</b><span style="color:rgba(255,255,255,.92); font-weight:600">730 LAVORATE</span></div>
    <div class="stat c3" style="background:#e57373; border-color:#e57373; color:#fff"><b>${daLavorare}</b><span style="color:rgba(255,255,255,.95); font-weight:600">730 DA LAVORARE</span></div>` : '') + (vEco ? `
    <div class="stat c5 verde"><b>${fmtEuro(fattureEmesse)}</b><span>FATTURE EMESSE</span></div>
    <div class="stat c5 viola"><b>${fmtEuro(incassoLordo)}</b><span>INCASSO TOTALE</span></div>
    <div class="stat c5 blu"><b>${fmtEuro(versatoCaf)}</b><span>PAGAMENTI CAF</span></div>
    <div class="stat c5" style="background:#1d4f91; border-color:#1d4f91; color:#fff"><b>${fmtEuro(incasso)}</b><span style="color:rgba(255,255,255,.92); font-weight:600">NETTO (incasso − pagamenti CAF)</span></div>
    ${vedeGuadagni() ? `<div class="stat c5" style="background:#b35f0c; border-color:#b35f0c; color:#fff"><b>${fmtEuro(speseSede)}</b><span style="color:rgba(255,255,255,.92); font-weight:600">SPESE SEDE</span></div>${typeof debitoAngelo === 'function' && debitoAngelo().totale ? `<div class="stat c5" style="background:#8e5bd6; border-color:#8e5bd6; color:#fff"><b>${fmtEuro(debitoAngelo().totale)}</b><span style="color:rgba(255,255,255,.92); font-weight:600">DA RESTITUIRE AD ANGELO</span></div>` : ''}<div class="stat c5 gray"><b>${fmtEuro(differenzaIncFatt)}</b><span>GUADAGNO NETTO (meno spese sede)</span></div>` : ''}` : '') + (vBlocchi ? `
    ${bloccoIntroito('SOLO 730', '#1d4f91', pratAnno.filter(e730), true)}
    ${bloccoIntroito('ALTRE PRATICHE (IMU, ISEE, contratti di affitto, colf e badanti)', '#6b7280', pratAnno.filter(function(p){ return !e730(p); }))}` : '') + (vEco && vBlocchi && vedeGuadagni() ? riepilogoGuadagno(pratAnno, versatoCaf, speseSede) : '');
  if(typeof renderSpese === 'function') renderSpese();

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
  document.getElementById('raff-diff').textContent = vedeGuadagni() ? 'Guadagno netto (incasso − pagamenti CAF − fatture emesse − spese sede): ' + fmtEuro(incasso - fattureEmesse - speseSede) : '';
  aggiornaGrafici(fattureEmesse, incassoLordo);
  aggiornaGraficoTipi(pratAnno);
  document.getElementById('raff-tipi').innerHTML = riepilogoPerTipo(pratAnno) + riepilogoPerPagamento(pratAnno);
  if(typeof renderElencoFPS === 'function') renderElencoFPS(pratAnno);
  if(typeof renderRicercaFatture === 'function') renderRicercaFatture();
  if(typeof aggiornaPulsanteCUD === 'function'){ aggiornaPulsanteCUD(); if(document.getElementById('richieste-cud')) disegnaRichiesteCUD(); }

  const tab = document.getElementById('tabella');
  const annAnno = (state.annullate||[]).filter(function(p){ return annoPratica(p) === annoSel; });
  const ordinate = filtra([...pratAnno].sort((a,b)=> a.numero - b.numero));
  // le annullate compaiono nel registro (barrate) solo senza filtro per stato
  const statoFiltro = (document.getElementById('filtro-stato')||{}).value || '';
  if(!statoFiltro){ filtraTesto(annAnno).forEach(function(p){ ordinate.push(p); }); ordinate.sort((a,b)=> a.numero - b.numero); }
  const rigaRegistro = (p) => p.annullata ? rigaAnnullataHTML(p) : `
            <tr>
              <td class="n">${formattaProtocollo(p)}</td>
              <td>${p.data||'-'}</td>
              <td>${eColf(p.tipo) ? (p.scadenzaAssistenza ? '<span title="Scadenza assistenza" style="color:#c0392b; font-weight:700">⏰ '+esc(p.scadenzaAssistenza)+'</span>' : '-') : (esc(p.dataFine)||'-')}</td>
              <td class="wrap">${(p.nome||'-').toUpperCase()}${p.congiunta ? '<div class="sub2">Congiunta: '+esc(p.congiunta)+'</div>' : ''}${typeof segnaliDocumentiHTML === 'function' ? segnaliDocumentiHTML(p) : ''}</td>
              <td class="wrap">${p.tipo||'-'}</td>
              <td><select class="stato-tab-sel" style="border-left:6px solid ${(STATI[p.stato]||{}).c||'#8a8f98'}" onchange="cambiaStato('${p.id}', this.value)">${statoOptions(p.stato, p.tipo)}</select></td>
              <td>${formattaInserimento(p)}${ultimaModifica(p) ? '<div class="sub2" title="Ultima modifica">✏️ ' + ultimaModifica(p) + '</div>' : ''}</td>
              <td><button type="button" style="background:var(--accent); color:var(--accent-ink); border:none; border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer" onclick="apriPraticaDaTabella('${p.id}')">Apri</button> ${bottoneWhatsApp(p, 'border:none; border-radius:6px; padding:5px 8px; font-size:12px; cursor:pointer', true)} <button type="button" title="Ricevuta da consegnare al cliente" style="background:var(--line); color:var(--ink); border:none; border-radius:6px; padding:5px 8px; font-size:12px; cursor:pointer" onclick="stampaRicevuta('${p.id}')">🧾</button></td>
            </tr>`;
  // Due registri con numerazioni separate: 730 e altre pratiche (AP)
  const tabellaRegistro = function(titolo, colore, lista, totale){
    return `<div class="raff-title" style="margin-top:14px; color:${colore}">${titolo} <span style="color:var(--sub); font-weight:600">(${totale})</span></div>
    <div class="tab-wrap">
      <table class="tab-proto tab-registro">
        <thead><tr><th>N.</th><th>Apertura</th><th>Fine lav.</th><th>Mittente</th><th>Tipo</th><th>Stato</th><th>Inserito da</th><th></th></tr></thead>
        <tbody>
          ${lista.length ? lista.map(rigaRegistro).join('') : '<tr><td colspan="8" class="empty">'+(totale ? 'Nessun risultato' : 'Nessuna registrazione per l\'anno '+annoSel)+'</td></tr>'}
        </tbody>
      </table>
    </div>`;
  };
  const di730 = ordinate.filter(function(p){ return serieDi(p) === '730'; }), diAP = ordinate.filter(function(p){ return serieDi(p) !== '730'; });
  tab.innerHTML = (typeof avvisoRitiriHTML === 'function' ? avvisoRitiriHTML(pratAnno) : '')
    + tabellaRegistro('📘 Registro di protocollo 730', '#1d4f91', di730, pratAnno.filter(function(p){ return serieDi(p) === '730'; }).length)
    + tabellaRegistro('📗 Registro di protocollo altre pratiche (AP)', '#2f9e5f', diAP, pratAnno.filter(function(p){ return serieDi(p) !== '730'; }).length);


  const sorted = [...pratAnno].sort((a,b)=> b.numero - a.numero);
  const cardHTML = (p) => `
    <div class="item" id="pratica-${p.id}">
      <div class="item-top">
        <div>
          <div class="num">#${formattaProtocollo(p)} — ${(p.nome||'(senza nome)').toUpperCase()}</div>
          <div class="name">${p.tipo||''} ${p.cf ? '· nato il '+p.cf : ''}</div>
          ${p.congiunta ? `<div class="name">Congiunta con <b>${esc(p.congiunta)}</b>${p.congData ? ' (nato il '+esc(p.congData)+')' : ''}${p.congCodiceFiscale ? ' · CF '+esc(p.congCodiceFiscale) : ''}${p.congTelefono ? ' · Cell. <a href="tel:'+esc(p.congTelefono)+'" style="color:inherit">'+esc(p.congTelefono)+'</a>' : ''}</div>` : ''}
          ${p.telefono ? `<div class="name">Cell. <a href="tel:${esc(p.telefono)}" style="color:inherit">${esc(p.telefono)}</a></div>` : ''}
          ${p.email ? `<div class="name">📧 <a href="mailto:${esc(p.email)}" style="color:inherit">${esc(p.email)}</a></div>` : ''}
          ${p.telefonoFisso ? `<div class="name">Tel. fisso <a href="tel:${esc(p.telefonoFisso)}" style="color:inherit">${esc(p.telefonoFisso)}</a></div>` : ''}
        </div>
        <div class="badges">
          <span class="badge stato">${pallino(p.stato)}${statoLabel(p.stato)}</span>
        </div>
      </div>
      <div class="meta">Aperta il ${p.data||'-'}${eColf(p.tipo) ? (p.scadenzaAssistenza ? ' · <b style="color:#c0392b">⏰ Scadenza assistenza il '+esc(p.scadenzaAssistenza)+'</b>' : '') : (p.dataFine ? ' · <b>Fine lavorazione il '+esc(p.dataFine)+'</b>' : '')} ${p.note ? '· '+esc(p.note) : ''}</div>
      <div class="meta compenso">Fattura: ${fmtEuro(p.compenso)} · Pagato effettivo: ${fmtEuro(p.pagato)}${p.metodoPagamento ? ' (' + esc(p.metodoPagamento) + ')' : ''}</div>
      ${typeof documentoCardHTML === 'function' ? documentoCardHTML(p) : ''}
      ${typeof documentiCardHTML === 'function' ? documentiCardHTML(p) : ''}
      ${storicoClienteHTML(p)}
      ${p.numFattura ? `<div class="meta">Fattura n. ${esc(p.numFattura)}</div>` : ''}
      ${p.emailInviata ? `<div class="meta" style="color:#1d4f91">📧 E-mail inviata: ${esc(p.emailInviata)}</div>` : ''}
      ${ultimaModifica(p) ? `<div class="meta" style="color:var(--sub)">✏️ Ultima modifica: <b>${ultimaModifica(p)}</b></div>` : ''}
      ${p.whatsappInviato ? `<div class="meta" style="color:#1a9e4b">💬 Avvisato su WhatsApp il ${esc(p.whatsappInviato)}</div>` : ''}
      ${p._editing ? `
        <div class="grid" style="margin-top:8px">
          <div><label>Cognome</label><input id="e-cognome-${p.id}" value="${esc(dividiNominativo(p).cognome)}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
          <div><label>Nome</label><input id="e-nomeproprio-${p.id}" value="${esc(dividiNominativo(p).nome)}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
          <div class="full"><label class="chk"><input type="checkbox" id="e-congon-${p.id}" ${p.congiunta ? 'checked' : ''} onchange="(function(){var on=document.getElementById('e-congon-${p.id}').checked; document.getElementById('e-congbox-${p.id}').style.display = on?'':'none';})()"> Congiunta</label>
            <div id="e-congbox-${p.id}" class="grid" style="${p.congiunta ? '' : 'display:none; '}margin-top:6px">
              <div><label>Cognome</label><input id="e-congcognome-${p.id}" value="${esc(p.congCognome)}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
              <div><label>Nome</label><input id="e-congnome-${p.id}" value="${esc(p.congNome)}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
              <div><label>Data di nascita</label><input id="e-congdata-${p.id}" value="${esc(p.congData)}" placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"></div>
              <div><label>Codice fiscale coniuge</label><input id="e-congcf-${p.id}" value="${esc(p.congCodiceFiscale)}" maxlength="16" style="text-transform:uppercase; font-family:monospace" oninput="this.value=normalizzaCF(this.value)"></div>
              <div><label>Cellulare coniuge</label><input id="e-congtel-${p.id}" type="tel" inputmode="tel" value="${esc(p.congTelefono)}"></div>
            </div>
          </div>
          <div><label>Cellulare *</label><input id="e-tel-${p.id}" type="tel" inputmode="tel" value="${esc(p.telefono)}"></div>
          <div><label>Telefono fisso *</label><input id="e-telfisso-${p.id}" type="tel" inputmode="tel" value="${esc(p.telefonoFisso)}"></div>
          <div><label>📧 E-mail</label><input id="e-email-${p.id}" type="email" inputmode="email" value="${esc(p.email)}" style="text-transform:lowercase"></div>
          <div><label>Data di nascita</label><input id="e-cf-${p.id}" value="${esc(p.cf)}" inputmode="numeric" placeholder="GG/MM/AAAA" oninput="autoSlashData(this)"></div>
          <div><label>Scadenza documento</label><input id="e-docscad-${p.id}" value="${esc(p.documentoScadenza)}" inputmode="numeric" placeholder="GG/MM/AAAA" oninput="autoSlashData(this)"></div>
          <div><label>Tipo pratica</label><select id="e-tipo-${p.id}" onchange="document.getElementById('e-scadass-box-${p.id}').style.display = eColf(this.value) ? '' : 'none'; applicaFatturaAutomatica(this.value, 'e-comp-${p.id}')">${tipoOptions(p.tipo)}</select></div>
          <div id="e-scadass-box-${p.id}" style="${eColf(p.tipo) ? '' : 'display:none'}"><label>Scadenza assistenza</label><input id="e-scadass-${p.id}" value="${esc(p.scadenzaAssistenza)}" inputmode="numeric" placeholder="GG/MM/AAAA" oninput="autoSlashData(this)"></div>
          <div><label>Fattura (€)</label><input id="e-comp-${p.id}" type="text" inputmode="decimal" placeholder="0,00" value="${importoInCampo(p.compenso)}" oninput="filtraImporto(this)" onblur="formattaCampoImporto(this)"></div>
          <div><label>Pagato effettivo (€)</label><div style="display:flex; gap:6px"><input id="e-pag-${p.id}" type="text" inputmode="decimal" placeholder="0,00" value="${importoInCampo(p.pagato)}" oninput="filtraImporto(this)" onblur="formattaCampoImporto(this)" style="flex:1; min-width:0"><select id="e-met-${p.id}" title="Tipo di pagamento" style="width:auto; flex:0 0 auto">${metodoOptions(p.metodoPagamento)}</select></div></div>
          <div><label>Numero fattura</label><input id="e-nf-${p.id}" value="${esc(p.numFattura)}"></div>
          <div class="full"><label>Note</label><input id="e-note-${p.id}" value="${esc(p.note)}"></div>
        </div>
        <div class="row-actions">
          <button onclick="salvaModifica('${p.id}')" style="background:var(--accent); color:var(--accent-ink)">Salva modifica</button>
          <button onclick="annullaModifica('${p.id}')">Annulla</button>
        </div>
      ` : `
      <div class="row-actions">
        <select class="stato-tab-sel" onchange="cambiaStato('${p.id}', this.value)">${statoOptions(p.stato, p.tipo)}</select>
        ${bottoneWhatsApp(p)}
        <button onclick="modifica('${p.id}')">Modifica</button>
        <button onclick="stampaRicevuta('${p.id}')" title="Ricevuta da consegnare al cliente">🧾 Ricevuta</button>
        <button onclick="emailRicevuta('${p.id}')" title="Invia la ricevuta al cliente per e-mail" style="background:#1d4f91; color:#fff">📧 Ricevuta</button>
        <button onclick="annullaPratica('${p.id}')" title="La pratica resta nel registro con il suo numero, segnata ANNULLATA" style="color:#c0392b">🚫 Annulla pratica</button>
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
    const accK = inRicerca ? 0 : totaleAcconti(annoAttivo(), function(t){ return t === k; });
    const open = aperti[k] === true;
    const col = coloreCollaboratore(k);
    const schedeAperte = aperti[k + '|schede'] === true || items.some(function(p){ return p._editing || p._confirmDelete || p._editingFattura; });
    return '<details class="grp" data-k="' + esc(k) + '" style="--gc:' + col + '" ' + (open ? 'open' : '') + ' ontoggle="gToggle(this)">'
      + '<summary style="background:' + col + '; background-image:none"><span class="grp-name">' + esc(k) + '</span><span class="grp-n">' + sommaPeso(items) + '</span>'
      + (senzaSoldi(k, fe, inc) ? '' : '<span class="grp-soldi">Fatture ' + fmtEuro(fe) + '<br>Incasso ' + fmtEuro(inc) + (accK ? '<br>Pagamenti ' + fmtEuro(accK) : '') + '</span>') + '</summary>'
      + '<div class="grp-b">' + contabilitaCollaboratoreHTML(k, items) + tabellaPraticheGruppoHTML(items, k)
      + (items.length ? '<details class="grp-schede" data-k="' + esc(k) + '|schede" ' + (schedeAperte ? 'open' : '') + ' ontoggle="aperti[this.dataset.k]=this.open" style="margin-top:10px"><summary style="cursor:pointer; font-weight:700; color:var(--sub); padding:6px 0">📋 Schede complete delle pratiche (' + items.length + ') – per modificare, ricevuta, WhatsApp…</summary>'
        + items.map(cardHTML).join('') + '</details>' : '') + '</div></details>';
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
  msg.style.display = 'none';
  const cognome = document.getElementById('f-cognome').value.trim().toUpperCase();
  const nomeProprio = document.getElementById('f-nome').value.trim().toUpperCase();
  const nome = (cognome + ' ' + nomeProprio).trim();
  const cf = document.getElementById('f-cf').value.trim();
  const tipo = document.getElementById('f-tipo').value.trim();
  const compensoScritto = parseImporto(document.getElementById('f-compenso').value);
  const compensoAuto = fatturaAutomatica(document.getElementById('f-tipo').value);
  const compenso = compensoScritto || (compensoAuto !== undefined ? compensoAuto : '');
  const pagato = parseImporto(document.getElementById('f-pagato').value) || '';
  const metodoPagamento = document.getElementById('f-metodo').value;
  const congCognome = document.getElementById('f-cong-cognome').value.trim().toUpperCase();
  const congNome = document.getElementById('f-cong-nome').value.trim().toUpperCase();
  const congData = document.getElementById('f-cong-data').value.trim();
  const congCodiceFiscale = (congCognome || congNome) ? normalizzaCF(document.getElementById('f-cong-cf').value) : '';
  const congTelefono = (congCognome || congNome) ? document.getElementById('f-cong-tel').value.trim() : '';
  const congiunta = [congCognome, congNome].filter(Boolean).join(' ');
  const telefono = document.getElementById('f-tel').value.trim();
  const telefonoFisso = document.getElementById('f-tel-fisso').value.trim();
  const email = document.getElementById('f-email').value.trim().toLowerCase();
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
  if(email && !emailValida(email)){
    popupErroreCampo('E-mail non valida', 'L\'indirizzo <b>' + esc(email) + '</b> non è corretto: controllalo (es. nome@esempio.it) oppure lascia il campo vuoto.', 'f-email');
    return;
  }
  const scadAss = document.getElementById('f-data-fine').value.trim();
  if(eColf(tipo) && scadAss && !parseDataIT(scadAss)){
    msg.textContent = '⚠️ La scadenza assistenza deve essere nel formato GG/MM/AAAA.';
    msg.style.display = 'block';
    return;
  }
  const documentoScadenza = document.getElementById('f-doc-scad').value.trim();
  if(documentoScadenza && !parseDataIT(documentoScadenza)){
    msg.textContent = '⚠️ La scadenza del documento deve essere nel formato GG/MM/AAAA.';
    msg.style.display = 'block';
    return;
  }
  const documenti = documentiDalModulo();
  if(documenti.mancanti.length && (document.getElementById('f-stato').value || 'arrivo') !== 'arrivo'){
    pickChip('f-stato-btns','f-stato','arrivo');
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
  const doppione = await cercaDoppione(annoPr, nome, tipo, codiceFiscale, null);
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
  registraClienteSeNuovo(cognome, nomeProprio, cf, codiceFiscale, telefono, telefonoFisso, documentoScadenza, email);
  if(congCognome || congNome){ registraClienteSeNuovo(congCognome, congNome, congData, congCodiceFiscale, congTelefono); }

  // Il numero è assegnato dal trigger del database (non passare numero, il trigger lo genererà)
  const nuovaPratica = {
    anno: annoPr,
    nome, congiunta, congCognome, congNome, congData, congCodiceFiscale, congTelefono, telefono, telefonoFisso, email, cf, codiceFiscale, documentoScadenza, documenti, tipo, compenso, pagato, metodoPagamento, data: dataPratica, note,
    stato: documenti.mancanti.length ? 'arrivo' : (document.getElementById('f-stato').value || 'arrivo'),
    dataFine: (!eColf(tipo) && document.getElementById('f-stato').value === 'lavorata') ? todayIT() : '',
    scadenzaAssistenza: eColf(tipo) ? document.getElementById('f-data-fine').value.trim() : '',
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
  if(eColf(tipo) && typeof concludiRinnovoScadenza === 'function') concludiRinnovoScadenza();
  confermaPraticaSalvata(result.id, nome, tipo, documenti.mancanti);

  document.getElementById('f-cognome').value='';
  document.getElementById('f-nome').value='';
  document.getElementById('f-cf').value='';
  document.getElementById('f-codfisc').value='';
  controllaCampoCF();
  impostaTipoPredefinito();
  document.getElementById('f-compenso').value=''; document.getElementById('f-compenso').dataset.auto='';
  document.getElementById('f-pagato').value='';
  document.getElementById('f-metodo').value='CONTANTI';
  document.getElementById('cli-cerca').value='';
  document.getElementById('cli-cerca-cong').value='';
  document.getElementById('f-congiunta-on').checked=false;
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
  if(eDispositivoMobile()){
    window.open('https://wa.me/' + (num || '') + (t ? '?text=' + t : ''), '_blank');
    if(dopo) dopo('telefono');
    return;
  }
  const modo = modoWhatsAppPC();
  if(!modo){ scegliModoWhatsAppPC(function(){ apriChatWhatsApp(num, testo, dopo); }); return; }
  if(modo === 'app'){
    const a = document.createElement('a');
    a.href = 'whatsapp://send?' + (num ? 'phone=' + num + (t ? '&' : '') : '') + (t ? 'text=' + t : '');
    document.body.appendChild(a); a.click(); a.remove();
  } else if(modo === 'copia'){
    copiaTestoWhatsApp(testo);
    if(!dopo) popupMessaggioCopiato(num);
  } else {
    window.open('https://web.whatsapp.com/send?' + (num ? 'phone=' + num + (t ? '&' : '') : '') + (t ? 'text=' + t : ''), '_blank');
  }
  if(dopo) dopo(modo);
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
    email: IMPOSTAZIONI.caf_email || '',
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
    const t = prompt('Numero di cellulare di ' + p.nome + ' (verra\' salvato nella pratica):', p.telefono || '');
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
async function cambiaStato(id, stato){
  const p = (state.pratiche||[]).find(function(x){ return x.id===id; });
  // con documenti mancanti la pratica resta "In arrivo"
  if(p && stato !== 'arrivo' && typeof documentiPratica === 'function' && documentiPratica(p).mancanti.length){
    render();
    popupDocumentiMancanti(p, statoLabel(stato));
    return;
  }
  const campi = { stato: stato };
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
const TIPI_SENZA_ACCONTO = ['730 SEDE','730 FILCA','730 FPS IN CONVENZIONE','730 DECEDUTI','730 INTEGRATIVI/RETTIFICATIVI','CONTRATTI DI AFFITTO','CONTRATTI COLF E BADANTI','ISEE A PAGAMENTO','IMU','ISEE','RED','SEND','MODELLI UNICO PF','INVCIV','ADI','F24'];
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
  return (haAcconti(k) && puoScrivereAcconti() ? '<button type="button" onclick="pagamentoCumulativo(\'' + kk + '\')" style="background:#2f9e5f; color:#fff; border:none; border-radius:999px; padding:5px 14px; font-weight:800; cursor:pointer; margin-right:6px">✓ Togli dai morosi</button>' : '')
    + '<button type="button" onclick="stampaCollaboratore(\'' + k.replace(/'/g, "\\'") + '\')" style="background:#374151; color:#fff; border:none; border-radius:999px; padding:5px 14px; font-weight:800; cursor:pointer">🖨️ Stampa</button>';
}
function contabilitaCollaboratoreHTML(k, items){
  const fatt0 = items.reduce(function(a,p){ return a+Number(p.compenso||0); }, 0);
  const inc0 = items.reduce(function(a,p){ return a+Number(p.pagato||0); }, 0);
  if(items.length && senzaSoldi(k, fatt0, inc0)){
    const colS = coloreCollaboratore(k);
    const tileS = function(colore, valore, etichetta){ return '<div style="flex:1; min-width:110px; padding:8px 10px; border-radius:10px; background:' + colore + '; color:#fff; text-align:center"><div style="font-size:17px; font-weight:800">' + valore + '</div><div style="font-size:10.5px; font-weight:700; opacity:.92; text-transform:uppercase">' + etichetta + '</div></div>'; };
    const daFareS = sommaPeso(items.filter(eDaLavorare));
    return '<div style="margin-bottom:10px; padding:10px; border-radius:12px; border:2px solid ' + colS + '">'
      + '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px"><b style="color:' + colS + '">📊 ' + esc(k) + ' – ' + annoAttivo() + '</b>' + bottoneStampaCollaboratore(k) + '</div>'
      + '<div style="display:flex; gap:6px; flex-wrap:wrap">' + tileS('#1d4f91', sommaPeso(items), 'Pratiche') + tileS('#2f9e5f', sommaPeso(items.filter(eLavorata)), 'Lavorate') + tileS(daFareS ? '#e57373' : '#8a8f98', daFareS, 'Da lavorare') + '</div></div>';
  }
  if(!items.length && !accontiDi(annoAttivo(), function(t){ return t === k; }).length) return (puoScrivereAcconti() && haAcconti(k) ? '<div style="margin-bottom:8px"><button type="button" onclick="nuovoAcconto(\'' + k.replace(/'/g, "\\'") + '\')" style="background:#8e5bd6; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">+ 💰 Acconto</button></div>' : '');
  const fatt = items.reduce(function(a,p){ return a+Number(p.compenso||0); }, 0);
  const accLista = accontiDi(annoAttivo(), function(t){ return t === k; });
  const acc = accLista.reduce(function(t,a){ return t + Number(a.importo||0); }, 0);
  const conAcc = haAcconti(k) || accLista.length > 0;
  const inc = items.reduce(function(a,p){ return a+Number(p.pagato||0); }, 0);
  const n = sommaPeso(items);
  const lav = sommaPeso(items.filter(eLavorata)), daFare = sommaPeso(items.filter(eDaLavorare));
  const pag = datiPerPagamento(items);
  const col = coloreCollaboratore(k);
  const tile = function(colore, valore, etichetta){
    return '<div style="flex:1; min-width:110px; padding:8px 10px; border-radius:10px; background:' + colore + '; color:#fff; text-align:center"><div style="font-size:17px; font-weight:800">' + valore + '</div><div style="font-size:10.5px; font-weight:700; opacity:.92; text-transform:uppercase">' + etichetta + '</div></div>';
  };
  return '<div style="margin-bottom:10px; padding:10px; border-radius:12px; border:2px solid ' + col + '">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px"><b style="color:' + col + '">📊 Contabilità ' + esc(k) + ' – ' + annoAttivo() + '</b>' + bottoneStampaCollaboratore(k) + '</div>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap">'
    + tile('#1d4f91', n, 'Pratiche')
    + tile('#2f9e5f', lav, 'Lavorate')
    + tile(daFare ? '#e57373' : '#8a8f98', daFare, 'Da lavorare')
    + tile('#2f9e5f', fmtEuro(fatt), 'Fatture emesse')
    + tile('#8e5bd6', fmtEuro(inc), 'Incasso')
    + (conAcc ? tile('#0e7c86', fmtEuro(acc), 'Pagamenti effettuati')
    + tile((inc - acc) > 0 ? '#c0392b' : '#374151', fmtEuro(inc - acc), 'Da incassare (incasso − pagamenti)') : '')
    + tile('#d98b1e', n ? fmtEuro(fatt / n) : '—', 'Prezzo medio')
    + '</div>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; font-size:12.5px">'
    + METODI_PAGAMENTO.concat(pag[''].n ? [''] : []).map(function(m){ return '<span style="padding:3px 10px; border-radius:999px; background:var(--line)">' + ({ CONTANTI:'💶 Contanti', POS:'💳 POS', BONIFICO:'🏦 Bonifico' }[m] || '❔ Non indicato') + ': <b>' + fmtEuro(pag[m].inc) + '</b> (' + pag[m].n + ')</span>'; }).join('')
    + '</div>'
    + (!conAcc ? '</div>' : '<div style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--line)">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap"><b style="color:#0e7c86">💰 Pagamenti effettuati (acconti) ' + annoAttivo() + ': ' + fmtEuro(acc) + '</b>'
    + (puoScrivereAcconti() && haAcconti(k) ? '<button type="button" onclick="nuovoAcconto(\'' + k.replace(/'/g, "\\'") + '\')" style="background:#8e5bd6; color:#fff; border:none; border-radius:999px; padding:5px 14px; font-weight:800; cursor:pointer">+ 💰 Acconto</button>' : '') + '</div>'
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
        + '<td><span style="white-space:nowrap">' + pallino(p.stato) + esc(statoLabel(p.stato)) + '</span></td>' + (soldi ? '<td>' + fmtEuro(p.compenso) + '</td><td><b>' + fmtEuro(p.pagato) + '</b>' + (p.saldataCollaboratore ? '<div class="sub2" style="color:#2f9e5f" title="Tolta dai morosi: saldata tramite il collaboratore">✓ fuori dai morosi</div>' : '') + '</td><td>' + esc(p.metodoPagamento || '-') + '</td>' : '')
        + '<td><button type="button" style="background:var(--accent); color:var(--accent-ink); border:none; border-radius:6px; padding:4px 10px; font-size:12px; cursor:pointer" onclick="apriPraticaDaTabella(\'' + p.id + '\')">Apri</button></td></tr>';
    }).join('') + '</tbody></table></div>';
}
// Stampa della contabilita' e delle pratiche di un solo collaboratore / tipo (anno scelto)
function stampaCollaboratore(k){
  const anno = annoAttivo();
  const items = state.pratiche.filter(function(p){ return (p.tipo || 'SENZA TIPO') === k && annoPratica(p) === anno; });
  const w = window.open('', '_blank');
  if(!w){ alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
  const riquadro = contabilitaCollaboratoreHTML(k, items).replace(/<button[\s\S]*?<\/button>/g, '');
  const tabella = tabellaPraticheGruppoHTML(items, k).replace(/<td><button[\s\S]*?<\/button><\/td>/g, '<td></td>');
  w.document.open();
  w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>' + esc(k) + ' ' + anno + '</title><style>@page{size:A4 landscape; margin:10mm} body{font-family:Arial,Helvetica,sans-serif; font-size:11.5px; color:#0f1b2d; --sub:#5b6b82; --line:#e3e8ef; -webkit-print-color-adjust:exact; print-color-adjust:exact} h1{font-size:16px; color:#1d4f91; margin:0 0 6px} table{width:100%; border-collapse:collapse; margin-top:8px} th,td{border:1px solid #cfd8e3; padding:4px 6px; text-align:left} th{background:#1d4f91; color:#fff} th:last-child,td:last-child{display:none} .sub2{font-size:10px; color:#5b6b82} .barra button{padding:8px 16px; margin:0 6px 10px 0} @media print{.barra{display:none}}</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button><button onclick="window.close()">Chiudi</button></div>'
    + '<h1>CAF CISL Alì Terme – ' + esc(k) + ' – anno ' + anno + '</h1><div style="margin-bottom:8px; color:#5b6b82">Stampato il ' + new Date().toLocaleDateString('it-IT') + ' · ' + sommaPeso(items) + ' pratiche (le congiunte valgono 2)</div>'
    + riquadro + tabella + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
  w.document.close();
}
function apriPraticaDaTabella(id){
  const p = state.pratiche.find(function(x){ return x.id===id; });
  if(!p) return;
  const k = p.tipo || 'SENZA TIPO';
  aperti[k] = true;
  aperti[k + '|schede'] = true;
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
    congCodiceFiscale: (cc || cn) ? normalizzaCF(g('e-congcf')) : '',
    congTelefono: (cc || cn) ? g('e-congtel').trim() : '',
    congiunta: [cc, cn].filter(Boolean).join(' '),
    telefono: g('e-tel').trim(),
    telefonoFisso: g('e-telfisso').trim(),
    email: g('e-email').trim().toLowerCase(),
    cf: g('e-cf').trim(),
    tipo: g('e-tipo'),
    scadenzaAssistenza: eColf(g('e-tipo')) ? g('e-scadass').trim() : '',
    compenso: parseImporto(g('e-comp')) || '',
    pagato: parseImporto(g('e-pag')) || '',
    metodoPagamento: g('e-met'),
    numFattura: numFattura,
    documentoScadenza: g('e-docscad').trim(),
    note: g('e-note').trim(),
    fatt: (numFattura || p.dataFattura) ? 'fatturata' : 'dafatturare'
  };
  if(campi.email && !emailValida(campi.email)){ popupErroreCampo('E-mail non valida', 'L\'indirizzo <b>' + esc(campi.email) + '</b> non è corretto.', 'e-email-' + id); return; }
  if(!campi.telefono && !campi.telefonoFisso){
    avviso('❌ Inserisci almeno un numero di telefono: cellulare o telefono fisso.', true);
    return;
  }
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
  if(campi.telefono || campi.telefonoFisso || campi.documentoScadenza || campi.email) data.clienti.salvaTelefono({ nomeCompleto: (cognomeTit + ' ' + nomeTit).trim(), cognome: cognomeTit, nome: nomeTit, dataNascita: campi.cf || '', codiceFiscale: p.codiceFiscale || '', telefono: campi.telefono, telefonoFisso: campi.telefonoFisso, documentoScadenza: campi.documentoScadenza, email: campi.email });
  if(cc || cn) await aggiornaArchivioCliente(vecchiCong, { cognome: cc, nome: cn, dataNascita: campi.congData });
  if((cc || cn) && (campi.congCodiceFiscale || campi.congTelefono)) registraClienteSeNuovo(cc, cn, campi.congData, cfValido(campi.congCodiceFiscale) ? campi.congCodiceFiscale : '', campi.congTelefono);
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
    + '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>Tipo di pratica</th><th>Pratiche</th><th>Fatture emesse</th><th>Incasso</th>'+(vedeGuadagni()?'<th>Provento (incasso − fatture)</th>':'')+'</tr></thead><tbody>'
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
        {label:'Provento', data:prov, backgroundColor:'#374151', borderRadius:6, maxBarThickness:18}]},
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
  return trovato ? serieDi(trovato) + '-' + String(trovato.numero).padStart(4,'0') + '/' + anno : null;
}

function e730(p){ return /^730\b/.test(String(p.tipo||'').toUpperCase()); }
// Stati: "da lavorare" finche' la pratica non e' stata lavorata; dopo (anche pagata o da pagare) conta come lavorata
const STATI_DA_LAVORARE = ['arrivo','lavorazione','da_lavorare_scansionata'];
function eDaLavorare(p){ return STATI_DA_LAVORARE.indexOf(p.stato) >= 0; }
function eLavorata(p){ return !eDaLavorare(p) && p.stato !== 'rinuncia_compilazione'; }
function conteggi730(pratiche){
  const l = (pratiche||[]).filter(e730);
  const daFare = sommaPeso(l.filter(eDaLavorare)), lav = sommaPeso(l.filter(eLavorata));
  return { tot: sommaPeso(l), daFare: daFare, lav: lav, rinunce: sommaPeso(l) - daFare - lav };
}
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
    + (vedeGuadagni() ? tile('#374151', fmtEuro(inc-fatt), 'PROVENTO (INCASSO − FATTURE)') : '')
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
  const p730 = provento(pratiche.filter(e730));
  const pAltre = provento(pratiche.filter(function(p){ return !e730(p); }));
  const voce = function(testo, valore, colore){ return '<span style="white-space:nowrap"><span style="color:var(--sub); font-weight:600">'+testo+'</span> <b style="color:'+colore+'">'+fmtEuro(valore)+'</b></span>'; };
  return '<div style="flex-basis:100%; margin-top:6px; padding:12px 16px; border-radius:12px; background:var(--card); border:2px dashed #374151; font-size:15px; display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px">'
    + voce('Provento 730', p730, '#1d4f91') + '<b>+</b>'
    + voce('Provento altre pratiche', pAltre, '#6b7280') + '<b>−</b>'
    + voce('Pagamenti CAF', pagamentiCaf, '#2f7de1') + '<b>−</b>'
    + voce('Spese sede', speseSede, '#b35f0c') + '<b>=</b>'
    + '<span style="white-space:nowrap; background:#374151; color:#fff; padding:4px 12px; border-radius:999px; font-weight:800">GUADAGNO NETTO ' + fmtEuro(p730 + pAltre - pagamentiCaf - speseSede) + '</span>'
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

// Inserimento anagrafica: ogni campo diventa verde quando e' compilato correttamente
function campoCompilatoBene(el){
  const v = (el.value||'').trim();
  if(!v) return false;
  if(el.id === 'f-codfisc') return typeof cfValido !== 'function' || cfValido(v);
  if(el.id === 'f-cf' || el.id === 'f-cong-data' || el.id === 'f-data' || el.id === 'f-data-fine') return !!parseDataIT(v);
  if(el.id === 'f-compenso' || el.id === 'f-pagato') return !isNaN(parseImporto(v));
  return true;
}
function aggiornaColoriModulo(){
  document.querySelectorAll('.form-anagrafica input[id^="f-"]').forEach(function(el){
    if(el.type === 'checkbox' || el.type === 'hidden') return;
    el.classList.toggle('compilato', campoCompilatoBene(el));
  });
}
document.addEventListener('input', function(e){ if(e.target.closest && e.target.closest('.form-anagrafica')) aggiornaColoriModulo(); });
document.addEventListener('change', function(e){ if(e.target.closest && e.target.closest('.form-anagrafica')) aggiornaColoriModulo(); });
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
    + '<div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap"><button type="button" data-ricevuta="1" style="background:var(--line); color:var(--ink); font-size:15px">🧾 Stampa ricevuta</button>'
    + '<button type="button" style="background:#2f9e5f; color:#fff; min-width:120px; font-size:15px">OK</button></div></div>';
  document.body.appendChild(ov);
  const chiudi = function(){ clearTimeout(t); ov.remove(); };
  const t = mancanti.length ? null : setTimeout(chiudi, 6000);
  ov.addEventListener('click', function(e){
    if(e.target.closest('[data-ricevuta]')){ chiudi(); stampaRicevuta(id); return; }
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
    corpo = '<div style="font-size:18px; font-weight:800; margin-bottom:2px">💬 WhatsApp multiplo</div>'
      + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:10px">Pratiche in stato Lavorata del ' + annoAttivo() + '. Sono già selezionate quelle con un cellulare valido non ancora avvisate.</div>'
      + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px">'
      + '<button type="button" style="background:var(--line); color:var(--ink); padding:6px 10px; font-size:12.5px" onclick="selezionaInvioMultiplo(true)">Seleziona tutti</button>'
      + '<button type="button" style="background:var(--line); color:var(--ink); padding:6px 10px; font-size:12.5px" onclick="selezionaInvioMultiplo(false)">Nessuno</button></div>'
      + '<div style="max-height:45vh; overflow-y:auto; border:1px solid var(--line); border-radius:10px">'
      + st.lista.map(function(p){
          const num = numeroWhatsApp(p.telefono);
          return '<label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid var(--line); margin:0; font-size:13px; color:var(--ink); cursor:' + (num ? 'pointer' : 'not-allowed') + '; opacity:' + (num ? '1' : '.5') + '">'
            + '<input type="checkbox" style="width:auto" ' + (st.scelti[p.id] ? 'checked' : '') + (num ? '' : ' disabled') + ' onchange="INVIO_MULTIPLO.scelti[\'' + p.id + '\']=this.checked; disegnaInvioMultiplo()">'
            + '<span style="flex:1; min-width:0"><b>' + esc(formattaProtocollo(p)) + '</b> · ' + esc(p.nome||'') + ' <span style="color:var(--sub)">(' + esc(p.tipo||'') + ')</span><br>'
            + '<span style="font-size:12px; color:var(--sub)">' + (num ? '📱 ' + esc(p.telefono) : '⚠️ cellulare mancante o non valido') + '</span>'
            + (p.whatsappInviato ? ' <span style="font-size:12px; color:#1a9e4b; font-weight:600">· già avvisato il ' + esc(p.whatsappInviato) + '</span>' : '') + '</span></label>';
        }).join('') + '</div>'
      + (modelli.length > 1 ? '<div style="margin-top:10px"><label>Messaggio da inviare</label><select onchange="INVIO_MULTIPLO.modello=parseInt(this.value,10)">'
          + modelli.map(function(m, i){ return '<option value="' + i + '"' + (i === st.modello ? ' selected' : '') + '>' + (i + 1) + (i === indiceModelloPredefinito() ? ' ⭐' : '') + ' – ' + esc(m.slice(0, 70)) + '…</option>'; }).join('') + '</select></div>' : '')
      + '<div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px">'
      + '<button type="button" style="background:var(--line); color:var(--ink)" onclick="chiudiInvioMultiplo()">Annulla</button>'
      + '<button type="button" style="background:#25d366; color:#fff"' + (n ? '' : ' disabled') + ' onclick="avviaInvioMultiplo()">Avanti: ' + n + (n === 1 ? ' messaggio' : ' messaggi') + ' ›</button></div>';
  } else {
    const tot = st.coda.length;
    const prossimo = st.coda[st.pos];
    corpo = '<div style="font-size:18px; font-weight:800; margin-bottom:2px">💬 Invio in corso: ' + Math.min(st.pos, tot) + ' di ' + tot + '</div>'
      + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:10px">Per ogni cliente si apre WhatsApp con il messaggio già scritto: premi Invio in WhatsApp, poi torna qui e clicca il cliente successivo.</div>'
      + (prossimo
          ? '<button type="button" style="display:block; width:100%; background:#25d366; color:#fff; font-size:16px; padding:14px" onclick="inviaProssimoMultiplo()">💬 Apri WhatsApp per ' + esc(nomeProprio(prossimo.nome)) + ' (' + (st.pos + 1) + '/' + tot + ')</button>'
            + '<div style="text-align:right; margin-top:6px"><button type="button" style="background:none; color:var(--sub); font-size:12.5px; padding:4px 0" onclick="INVIO_MULTIPLO.pos++; disegnaInvioMultiplo()">Salta questo cliente ›</button></div>'
          : '<div style="padding:14px; border-radius:10px; background:color-mix(in srgb, #25d366 15%, var(--card)); font-weight:700; text-align:center">✅ Finito: aperte ' + Object.keys(st.inviati).length + ' chat su ' + tot + '</div>')
      + '<div style="max-height:40vh; overflow-y:auto; margin-top:10px; border:1px solid var(--line); border-radius:10px">'
      + st.coda.map(function(p, i){
          const fatto = st.inviati[p.id];
          const stato = fatto ? '<span style="color:#1a9e4b; font-weight:700">✓ aperto</span>' : (i < st.pos ? '<span style="color:var(--sub)">saltato</span>' : (i === st.pos ? '<span style="color:#d4881c; font-weight:700">● prossimo</span>' : '<span style="color:var(--sub)">in attesa</span>'));
          return '<div style="display:flex; justify-content:space-between; gap:8px; padding:7px 10px; border-bottom:1px solid var(--line); font-size:13px"><span>' + (i + 1) + '. ' + esc(p.nome||'') + '</span>' + stato + '</div>';
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
  st.coda = st.lista.filter(function(p){ return st.scelti[p.id] && numeroWhatsApp(p.telefono); });
  st.pos = 0;
  st.fase = 'invio';
  disegnaInvioMultiplo();
}
function inviaProssimoMultiplo(){
  const st = INVIO_MULTIPLO;
  const p = st && st.coda[st.pos];
  if(!p) return;
  apriWhatsApp(numeroWhatsApp(p.telefono), messaggioRitiro(p, st.modello), p);
  st.inviati[p.id] = true;
  st.pos++;
  disegnaInvioMultiplo();
}
