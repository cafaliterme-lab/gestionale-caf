/* ---------------- Storico contribuente ---------------- */
// Sezione di sola consultazione: si cerca un contribuente (cognome, nome o codice fiscale) e si vedono
// tutte le sue pratiche di tutti gli anni (anche come coniuge nelle congiunte), consegnate, da consegnare e annullate.

const STORICO = { cerca: '', scelto: null, anno: '' };

function personeStorico(q) {
  q = String(q || '').trim().toUpperCase();
  if (q.length < 2) return [];
  const persone = {};
  const aggiungi = function (nome, nascita, cf, telefono) {
    nome = String(nome || '').trim().toUpperCase(); if (!nome) return;
    cf = String(cf || '').trim().toUpperCase();
    if ((nome + ' ' + cf).indexOf(q) < 0 && !(chiaveRicerca(q) && chiaveRicerca(nome + cf).indexOf(chiaveRicerca(q)) >= 0)) return;
    const k = cf || (nome + '|' + (nascita || ''));
    const x = persone[k] || (persone[k] = { nome: nome, nascita: nascita || '', cf: cf, telefono: '', n: 0 });
    x.n++; if (!x.nascita && nascita) x.nascita = nascita; if (!x.telefono && telefono) x.telefono = telefono;
  };
  (state.pratiche || []).concat(state.annullate || []).forEach(function (p) {
    aggiungi(p.nome, p.cf, p.codiceFiscale, p.telefono);
    const coniuge = ((p.congCognome || '') + ' ' + (p.congNome || '')).trim() || p.congiunta;
    if (coniuge) aggiungi(coniuge, p.congData, p.congCodiceFiscale, p.congTelefono);
    // lavoratore dei contratti colf e badanti: cercando la colf si trova la pratica del datore di lavoro
    const lav = ((p.lavCognome || '') + ' ' + (p.lavNome || '')).trim();
    if (lav) aggiungi(lav, p.lavData, p.lavCodiceFiscale, p.lavTelefono);
    // inquilini dei contratti di affitto: cercando l'inquilino si trova la pratica del proprietario
    (Array.isArray(p.inquilini) ? p.inquilini : []).forEach(function (q) { aggiungi(((q.cognome || '') + ' ' + (q.nome || '')).trim(), q.dataNascita, q.codiceFiscale, q.telefono); });
  });
  return Object.keys(persone).map(function (k) { return persone[k]; }).sort(function (a, b) { return a.nome.localeCompare(b.nome); }).slice(0, 40);
}

function praticheStorico(x) {
  const stessa = function (nome, nascita, cf) {
    nome = String(nome || '').trim().toUpperCase(); cf = String(cf || '').trim().toUpperCase();
    if (x.cf && cf) return cf === x.cf;
    return nome === x.nome && (!x.nascita || !nascita || nascita === x.nascita);
  };
  return (state.pratiche || []).concat(state.annullate || []).filter(function (p) {
    const coniuge = ((p.congCognome || '') + ' ' + (p.congNome || '')).trim() || p.congiunta;
    const lav = ((p.lavCognome || '') + ' ' + (p.lavNome || '')).trim();
    return stessa(p.nome, p.cf, p.codiceFiscale) || (coniuge && stessa(coniuge, p.congData, p.congCodiceFiscale)) || (lav && stessa(lav, p.lavData, p.lavCodiceFiscale))
      || (Array.isArray(p.inquilini) && p.inquilini.some(function (q) { const n = ((q.cognome || '') + ' ' + (q.nome || '')).trim(); return n && stessa(n, q.dataNascita, q.codiceFiscale); }));
  }).sort(function (a, b) { return (annoPratica(b) - annoPratica(a)) || (b.numero - a.numero); });
}

function renderStorico() {
  const box = document.getElementById('tab-storico');
  if (!box) return;
  if (!box.dataset.pronta) {
    box.dataset.pronta = '1';
    box.innerHTML = '<div class="card"><div class="raff-title">🗂️ Storico contribuente</div>'
      + '<div style="font-size:13px; color:var(--sub); margin-bottom:8px">Scrivi cognome, nome o codice fiscale: vedi tutte le pratiche del contribuente, dell\'anno in corso e degli anni precedenti (anche come coniuge nelle congiunte), consegnate, da consegnare e annullate. Qui si consulta soltanto.</div>'
      + '<input id="storico-cerca" type="search" placeholder="Es. ROSSI MARIO oppure RSSMRA60…" autocomplete="off" oninput="STORICO.cerca=this.value; STORICO.scelto=null; aggiornaStorico()" style="font-size:16px">'
      + '<div id="storico-risultati" style="margin-top:10px"></div></div>'
      + '<div class="card" style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap"><div><div class="raff-title" style="margin:0">📞 Clienti da richiamare</div>'
      + '<div style="font-size:13px; color:var(--sub)">Fine campagna 730: i clienti dell\'anno scorso che quest\'anno non si sono ancora presentati, con telefoni, WhatsApp ed esito del contatto.</div></div>'
      + '<button type="button" onclick="apriRichiami()" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:9px 18px; font-weight:800; cursor:pointer">📞 Apri l\'elenco</button></div>';
  }
  aggiornaStorico();
}

function aggiornaStorico() {
  const el = document.getElementById('storico-risultati');
  if (!el) return;
  if (STORICO.scelto) { el.innerHTML = schedaStoricoHTML(STORICO.scelto); return; }
  const q = STORICO.cerca.trim();
  if (q.length < 2) { el.innerHTML = '<div class="empty">Scrivi almeno 2 lettere del cognome o del codice fiscale</div>'; return; }
  const lista = personeStorico(q);
  if (!lista.length) { el.innerHTML = '<div class="empty">Nessun contribuente trovato con «' + esc(q) + '»</div>'; return; }
  if (lista.length === 1) { STORICO.scelto = lista[0]; STORICO.anno = ''; el.innerHTML = schedaStoricoHTML(lista[0]); return; }
  el.innerHTML = '<div style="font-size:13px; color:var(--sub); margin-bottom:6px">' + lista.length + ' contribuenti trovati: tocca quello che cerchi</div>'
    + lista.map(function (x, i) {
      return '<button type="button" onclick="scegliStorico(' + i + ')" style="display:flex; width:100%; justify-content:space-between; align-items:center; gap:8px; text-align:left; background:var(--card); color:var(--ink); border:1px solid var(--line); border-radius:10px; padding:9px 12px; margin-bottom:6px; cursor:pointer">'
        + '<span><b>' + esc(x.nome) + '</b><span class="sub2" style="display:block">' + [x.nascita ? 'nato/a il ' + esc(x.nascita) : '', x.cf ? 'CF ' + esc(x.cf) : ''].filter(Boolean).join(' · ') + '</span></span>'
        + '<span class="grp-n" style="background:#1d4f91; color:#fff; border-radius:999px; padding:2px 10px; font-weight:800">' + x.n + '</span></button>';
    }).join('');
  STORICO._lista = lista;
}
function scegliStorico(i) { STORICO.scelto = (STORICO._lista || [])[i] || null; STORICO.anno = ''; aggiornaStorico(); }
function tornaRicercaStorico() { STORICO.scelto = null; aggiornaStorico(); }

function schedaStoricoHTML(x) {
  const tutte = praticheStorico(x);
  const anni = Array.from(new Set(tutte.map(annoPratica))).sort(function (a, b) { return b - a; });
  const lista = STORICO.anno ? tutte.filter(function (p) { return String(annoPratica(p)) === String(STORICO.anno); }) : tutte;
  const valide = lista.filter(function (p) { return !p.annullata; });
  const somma = function (l, c) { return l.reduce(function (t, p) { return t + Number(p[c] || 0); }, 0); };
  const manca = valide.reduce(function (t, p) { return t + (typeof residuoPratica === 'function' && p.stato !== 'rinuncia_compilazione' && !p.saldataCollaboratore ? residuoPratica(p) : 0); }, 0);
  const euro = function (v) { return Number(v) ? fmtEuro(v) : '-'; };
  const annoProt = annoAttivo();
  const tasto = function (testo, valore) { const on = String(STORICO.anno) === String(valore); return '<button type="button" onclick="STORICO.anno=\'' + valore + '\'; aggiornaStorico()" style="padding:5px 12px; border-radius:999px; font-size:12.5px; font-weight:700; cursor:pointer; border:2px solid #1d4f91; background:' + (on ? '#1d4f91' : 'transparent') + '; color:' + (on ? '#fff' : '#1d4f91') + '">' + testo + '</button>'; };
  let righe = '', annoPrec = null;
  lista.forEach(function (p) {
    const a = annoPratica(p);
    if (a !== annoPrec) { annoPrec = a; righe += '<tr><td colspan="11" style="background:var(--bg); font-weight:800; color:#1d4f91">Anno ' + a + (a === annoProt ? ' (anno in corso)' : '') + '</td></tr>'; }
    const coniuge = String(p.nome || '').trim().toUpperCase() !== x.nome;
    const m = !p.annullata && typeof residuoPratica === 'function' && p.stato !== 'rinuncia_compilazione' && !p.saldataCollaboratore ? residuoPratica(p) : 0;
    const apribile = !p.annullata && a === annoProt;
    righe += '<tr' + (p.annullata ? ' style="color:var(--sub)"' : '') + '>'
      + '<td class="n"' + (p.annullata ? ' style="text-decoration:line-through"' : '') + '>' + formattaProtocollo(p) + '</td><td>' + esc(p.data || '-') + '</td>'
      + '<td class="wrap">' + esc(p.tipo || '-') + (p.viaEmail ? ' <span style="background:#1d4f91; color:#fff; border-radius:999px; padding:0 6px; font-size:11px">📧 e-mail</span>' : '') + (coniuge && typeof nomiInquilini === 'function' && nomiInquilini(p).map(function (n) { return n.toUpperCase(); }).indexOf(x.nome) >= 0 ? '<div class="sub2">🏠 come inquilino di ' + esc(p.nome || '') + '</div>' : coniuge && ((p.lavCognome || '') + ' ' + (p.lavNome || '')).trim().toUpperCase() === x.nome ? '<div class="sub2">👷 come lavoratore di ' + esc(p.nome || '') + '</div>' : coniuge ? '<div class="sub2">come coniuge di ' + esc(p.nome || '') + '</div>' : (p.congiunta ? '<div class="sub2">congiunta con ' + esc(p.congiunta) + '</div>' : '')) + '</td>'
      + '<td>' + (p.annullata ? '<b style="color:#c0392b">🚫 ANNULLATA</b>' : esc(statoLabel(p.stato))) + (p.consegnataIl ? '<div class="sub2">📦 ' + (e730(p) ? 'consegnata' : 'definita') + ' il ' + esc(p.consegnataIl) + '</div>' : '') + '</td>'
      + '<td>' + (p.numFattura ? 'n. ' + esc(p.numFattura) + (p.dataFattura ? '<div class="sub2">' + esc(p.dataFattura) + '</div>' : '') : '-') + '</td>'
      + '<td style="text-align:right">' + euro(p.compenso) + '</td><td style="text-align:right">' + euro(p.richiesto) + '</td><td style="text-align:right">' + euro(p.pagato) + (p.metodoPagamento && Number(p.pagato) ? '<div class="sub2">' + esc(p.metodoPagamento) + '</div>' : '') + '</td>'
      + '<td style="text-align:right; font-weight:800; color:' + (m > 0.004 ? '#c0392b' : '#1a7f37') + '">' + (p.annullata ? '' : (m > 0.004 ? fmtEuro(m) : '✓')) + '</td>'
      + '<td style="white-space:nowrap">' + esc(p.inseritoDa || '-') + (apribile ? ' <button type="button" onclick="apriDaStorico(\'' + p.id + '\')" style="background:var(--accent); color:var(--accent-ink); border:none; border-radius:6px; padding:4px 9px; font-size:12px; cursor:pointer">Apri</button>' : '') + '</td>'
      + '<td>' + documentiStoricoHTML(p) + '</td></tr>';
  });
  return '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap; margin-bottom:8px">'
    + '<div><div style="font-size:19px; font-weight:800">' + esc(x.nome) + '</div><div class="sub2">' + [x.nascita ? 'nato/a il ' + esc(x.nascita) : '', x.cf ? 'CF ' + esc(x.cf) : '', x.telefono ? '📱 ' + esc(x.telefono) : ''].filter(Boolean).join(' · ') + '</div></div>'
    + '<span style="display:flex; gap:6px; flex-wrap:wrap"><button type="button" onclick="stampaStorico()" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer">🖨️ Stampa</button>'
    + '<button type="button" onclick="tornaRicercaStorico()" style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer">↩️ Altra ricerca</button></span></div>'
    + (typeof avvisoMorosoHTML === 'function' ? avvisoMorosoHTML(tutte) : '')
    + (typeof percorsoCollaboratoreHTML === 'function' ? percorsoCollaboratoreHTML(tutte) : '')
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px">' + tasto('Tutti gli anni', '') + anni.map(function (a) { return tasto(a + (a === annoProt ? ' (in corso)' : ''), a); }).join('') + '</div>'
    + '<div class="meta" style="margin:0 0 8px">' + valide.length + ' pratiche' + (lista.length > valide.length ? ' (+ ' + (lista.length - valide.length) + ' annullate)' : '') + ' · Fatture <b>' + fmtEuro(somma(valide, 'compenso')) + '</b> · Richiesto <b>' + fmtEuro(somma(valide, 'richiesto')) + '</b> · Pagato <b>' + fmtEuro(somma(valide, 'pagato')) + '</b>'
    + (manca > 0.004 ? ' · <b style="color:#c0392b">Deve ancora ' + fmtEuro(manca) + '</b>' : ' · <b style="color:#1a7f37">nulla da pagare</b>') + '</div>'
    + (lista.length ? '<div class="tab-wrap" id="storico-tabella"><table class="tab-proto"><thead><tr><th>Protocollo</th><th>Apertura</th><th>Tipo</th><th>Stato</th><th>N. fattura</th><th style="text-align:right">Fattura</th><th style="text-align:right">Richiesto</th><th style="text-align:right">Pagato</th><th style="text-align:right">Da pagare</th><th>Operatore</th><th>Documenti da stampare</th></tr></thead><tbody>' + righe + '</tbody></table></div>'
      : '<div class="empty">Nessuna pratica</div>');
}

// Ricevute ristampabili in ogni momento, anche anni dopo: presa in carico, consegna, pagamento (730)
function documentiStoricoHTML(p) {
  if (p.annullata) return '';
  const t = function (fn, testo, titolo, colore) { return '<button type="button" onclick="' + fn + '(\'' + p.id + '\')" title="' + titolo + '" style="background:' + colore + '; color:#fff; border:none; border-radius:6px; padding:4px 8px; font-size:11.5px; font-weight:700; cursor:pointer; margin:1px">' + testo + '</button>'; };
  return t('stampaRicevuta', '🧾 Presa in carico', 'Ricevuta di presa in carico', '#5b6b82')
    + (eConsegnata(p) && typeof stampaRicevutaConsegna === 'function' ? t('stampaRicevutaConsegna', '📦 Consegna', 'Ricevuta di consegna', '#8d5a3b') : '')
    + (e730(p) && Number(p.pagato || 0) > 0 && typeof stampaRicevutaPagamento === 'function' ? t('stampaRicevutaPagamento', '💶 Pagamento' + (p.ricevutaUfficiale ? ' ⭐' : ''), 'Ricevuta di pagamento', '#1a7f37') : '');
}
function apriDaStorico(id) {
  const tb = document.querySelector('.navmenu button[data-tab="registro"]');
  if (tb && tb.style.display !== 'none' && typeof showTab === 'function') showTab(tb);
  if (typeof apriPraticaDaTabella === 'function') apriPraticaDaTabella(id);
}

function stampaStorico() {
  const x = STORICO.scelto; if (!x) return;
  const t = document.getElementById('storico-tabella');
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
  const corpo = t ? t.innerHTML.replace(/<button[\s\S]*?<\/button>/g, '') : '<p>Nessuna pratica</p>';
  const riep = (document.querySelector('#storico-risultati .meta') || {}).innerHTML || '';
  w.document.open();
  w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Storico ' + esc(x.nome) + '</title><style>@page{size:A4 landscape; margin:10mm} body{font-family:Arial,Helvetica,sans-serif; font-size:11.5px; color:#0f1b2d; margin:0; padding:10px}'
    + 'h1{font-size:17px; color:#1d4f91; margin:0} table{width:100%; border-collapse:collapse; margin-top:8px} th,td{text-align:left; padding:4px 6px; border-bottom:1px solid #e3e8ef; vertical-align:top} th{background:#f2f5f9; font-size:11px} .sub2{font-size:10px; color:#5b6b82}'
    + '.barra{margin-bottom:10px} .barra button{font-size:14px; padding:8px 16px; margin-right:6px} @media print{.barra{display:none} body{padding:0}}</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button><button onclick="window.close()">Chiudi</button></div>'
    + '<h1>CAF CISL Alì Terme – Storico pratiche di ' + esc(x.nome) + '</h1><div class="sub2">' + [x.nascita ? 'nato/a il ' + esc(x.nascita) : '', x.cf ? 'CF ' + esc(x.cf) : '', STORICO.anno ? 'anno ' + esc(STORICO.anno) : 'tutti gli anni', 'stampato il ' + new Date().toLocaleDateString('it-IT')].filter(Boolean).join(' · ') + '</div>'
    + '<div style="margin-top:6px">' + riep + '</div><table>' + corpo + '</table><script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
  w.document.close();
}
