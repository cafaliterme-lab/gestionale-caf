/* ---------- Contabilità: ogni riquadro si apre e mostra il dettaglio ----------
   Pratiche, fatture, incasso, versamenti CAF, soldi in cassa, spese sede, Angelo, guadagno:
   elenco delle voci che compongono il numero, con i totali e il tasto Stampa. */

function praticheDettaglio(anno) { return (state.pratiche || []).filter(function (p) { return !p.annullata && annoPratica(p) === anno; }); }
function euroCella(v, colore) { return '<td style="text-align:right; white-space:nowrap' + (colore ? '; color:' + colore + '; font-weight:700' : '') + '">' + fmtEuro(v) + '</td>'; }

function tabellaPraticheDettaglio(lista, colonne) {
  colonne = colonne || {};
  if (!lista.length) return '<div class="empty">Nessuna pratica</div>';
  const ordinata = lista.slice().sort(function (a, b) { return (serieDi ? String(serieDi(a)).localeCompare(String(serieDi(b))) : 0) || (Number(a.numero) - Number(b.numero)); });
  const righe = ordinata.map(function (p) {
    const fa = Number(p.compenso || 0), pa = Number(p.pagato || 0);
    return '<tr data-pratica="' + esc(p.id) + '" style="cursor:pointer" title="Apri la pratica">'
      + '<td style="white-space:nowrap"><b>' + esc(formattaProtocollo(p)) + '</b></td><td style="white-space:nowrap">' + esc(p.data || '') + '</td>'
      + '<td>' + esc(p.nome || '') + (p.congCognome || p.congNome ? '<div class="sub2">+ ' + esc(((p.congCognome || '') + ' ' + (p.congNome || '')).trim()) + '</div>' : '') + '</td>'
      + '<td>' + esc(p.tipo || '') + (p.descrizioneTipo ? '<div class="sub2">' + esc(p.descrizioneTipo) + '</div>' : '') + '</td>'
      + '<td>' + esc(statoLabel(p.stato)) + '</td>'
      + '<td style="white-space:nowrap">' + (p.numFattura ? 'n. ' + esc(p.numFattura) + (p.dataFattura ? '<div class="sub2">' + esc(p.dataFattura) + '</div>' : '') : '<span class="sub2">da fatturare</span>') + '</td>'
      + euroCella(fa) + euroCella(pa) + '<td>' + esc(p.metodoPagamento || '—') + '</td>'
      + (colonne.guadagno ? euroCella(pa - fa, pa - fa < 0 ? '#c0392b' : '#c2185b') : '') + '</tr>';
  }).join('');
  const tf = lista.reduce(function (t, p) { return t + Number(p.compenso || 0); }, 0), tp = lista.reduce(function (t, p) { return t + Number(p.pagato || 0); }, 0);
  return '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>Protocollo</th><th>Data</th><th>Cliente</th><th>Tipo</th><th>Stato</th><th>Fattura</th><th style="text-align:right">Importo fattura</th><th style="text-align:right">Pagato</th><th>Pagamento</th>' + (colonne.guadagno ? '<th style="text-align:right">Guadagno</th>' : '') + '</tr></thead><tbody>' + righe
    + '<tr style="font-weight:800; background:var(--bg)"><td colspan="6">TOTALE · ' + sommaPeso(lista) + ' pratiche (le congiunte valgono 2)</td>' + euroCella(tf) + euroCella(tp) + '<td></td>' + (colonne.guadagno ? euroCella(tp - tf) : '') + '</tr></tbody></table></div>';
}

function riepilogoPagamentiHTML(lista) {
  const per = {};
  lista.forEach(function (p) { const m = p.metodoPagamento || 'Non indicato'; per[m] = per[m] || { n: 0, v: 0 }; per[m].n++; per[m].v += Number(p.pagato || 0); });
  return '<div style="display:flex; gap:6px; flex-wrap:wrap; margin:0 0 10px">' + Object.keys(per).sort().map(function (m) {
    return '<span style="padding:4px 10px; border-radius:999px; background:var(--line); font-size:13px">' + ({ CONTANTI: '💶 Contanti', POS: '💳 POS', BONIFICO: '🏦 Bonifico' }[m] || '❔ ' + esc(m)) + ': <b>' + fmtEuro(per[m].v) + '</b> (' + per[m].n + ')</span>';
  }).join('') + '</div>';
}

function rigaFormula(voci, risultato) {
  return '<div style="display:flex; gap:6px 10px; flex-wrap:wrap; align-items:center; padding:10px 12px; border-radius:10px; background:var(--bg); margin-bottom:10px; font-size:14px">'
    + voci.map(function (v, i) { return (i ? '<b>' + (v[2] || '−') + '</b> ' : '') + '<span style="white-space:nowrap">' + esc(v[0]) + ' <b>' + fmtEuro(v[1]) + '</b></span>'; }).join(' ')
    + ' <b>=</b> <span style="white-space:nowrap; padding:3px 10px; border-radius:999px; background:#1d4f91; color:#fff; font-weight:800">' + fmtEuro(risultato) + '</span></div>';
}

function dettaglioVersamentiHTML(anno) {
  const lista = (state.versamenti || []).filter(function (v) { return annoVersamento(v) === anno; })
    .sort(function (a, b) { return (dataNum(a.data) || 0) - (dataNum(b.data) || 0); });
  if (!lista.length) return '<div class="empty">Nessun versamento al CAF per il ' + anno + '</div>';
  const t = { imp: 0, sp: 0, bon: 0, bol: 0 };
  const righe = lista.map(function (v) {
    const sp = Number(v.cassa || 0), bon = Number(v.bonifico || 0), imp = Number(v.importo || 0);
    const bol = v.versato != null && v.versato !== '' ? Number(v.versato || 0) : imp - sp - bon;
    t.imp += imp; t.sp += sp; t.bon += bon; t.bol += bol;
    const elenco = (Array.isArray(v.cassaElenco) ? v.cassaElenco : []).map(function (r) { return esc(r.descrizione || 'spesa') + ' ' + fmtEuro(r.importo); })
      .concat((Array.isArray(v.bonificiElenco) ? v.bonificiElenco : []).map(function (r) { return 'bonifico ' + esc(r.nome || '') + ' ' + fmtEuro(r.importo); }));
    return '<tr><td style="white-space:nowrap">' + esc(v.data || '') + (v.anno && Number(v.anno) !== annoDiData(v.data) ? '<div class="sub2">fatture del ' + esc(v.anno) + '</div>' : '') + '</td>'
      + '<td>' + (v.fatturaDal || v.fatturaAl ? 'dal n. ' + esc(v.fatturaDal || '…') + ' al n. ' + esc(v.fatturaAl || '…') : '<span class="sub2">non indicate</span>') + (elenco.length ? '<div class="sub2">' + elenco.join(' · ') + '</div>' : '') + '</td>'
      + euroCella(imp) + euroCella(sp) + euroCella(bon) + euroCella(bol, '#1d4f91') + '<td>' + esc(v.operatore || '') + '</td></tr>';
  }).join('');
  return '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>Data</th><th>Fatture</th><th style="text-align:right">Fatture coperte</th><th style="text-align:right">Spese detratte</th><th style="text-align:right">Bonifici detratti</th><th style="text-align:right">Bollettino</th><th>Operatore</th></tr></thead><tbody>' + righe
    + '<tr style="font-weight:800; background:var(--bg)"><td colspan="2">TOTALE · ' + lista.length + ' versamenti</td>' + euroCella(t.imp) + euroCella(t.sp) + euroCella(t.bon) + euroCella(t.bol) + '<td></td></tr></tbody></table></div>';
}

function dettaglioSpeseHTML(anno) {
  const lista = (typeof speseAnno === 'function' ? speseAnno(anno) : []).slice().sort(function (a, b) { return (dataNum(a.data) || 0) - (dataNum(b.data) || 0); });
  if (!lista.length) return '<div class="empty">Nessuna spesa sede nel ' + anno + '</div>';
  const rimb = typeof rimborsiCafSpese === 'function' ? rimborsiCafSpese() : {};
  let tl = 0, tr = 0;
  const righe = lista.map(function (s) {
    const imp = Number(s.importo || 0), r = typeof rimborsoCafSpesa === 'function' ? rimborsoCafSpesa(s, rimb) : 0;
    tl += imp; tr += r;
    return '<tr><td style="white-space:nowrap">' + esc(s.data || '') + '</td><td><b>' + esc(s.categoria || '') + '</b>' + (s.descrizione ? '<div class="sub2">' + esc(s.descrizione) + '</div>' : '') + '</td>'
      + '<td>' + esc(s.metodoPagamento || '—') + (s.prelevatiAngelo ? '<div class="sub2" style="color:#8e5bd6">💰 anticipata da Angelo' + (s.restituitoAngelo ? ' · restituita' : ' · da restituire') + '</div>' : '') + '</td>'
      + euroCella(imp) + euroCella(r, r ? '#1d4f91' : '') + euroCella(imp - r, '#b35f0c') + '</tr>';
  }).join('');
  return '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>Data</th><th>Voce</th><th>Pagamento</th><th style="text-align:right">Importo</th><th style="text-align:right">Rimborsata dal CAF</th><th style="text-align:right">A carico della sede</th></tr></thead><tbody>' + righe
    + '<tr style="font-weight:800; background:var(--bg)"><td colspan="3">TOTALE · ' + lista.length + ' spese</td>' + euroCella(tl) + euroCella(tr) + euroCella(tl - tr) + '</tr></tbody></table></div>';
}

function apriDettaglioCont(chiave, gruppo) {
  const anno = annoAttivo();
  const prat = praticheDettaglio(anno);
  const filtroGruppo = function (l) { return gruppo === '730' ? l.filter(e730) : gruppo === 'altre' ? l.filter(function (p) { return !e730(p); }) : l; };
  const nomeGruppo = gruppo === '730' ? ' – solo 730' : gruppo === 'altre' ? ' – altre pratiche' : '';
  const somma = function (l, c) { return l.reduce(function (t, p) { return t + Number(p[c] || 0); }, 0); };
  let titolo = '', corpo = '', colore = '#1d4f91';
  if (chiave === 'p730') { titolo = 'Pratiche 730'; corpo = tabellaPraticheDettaglio(prat.filter(e730)); }
  else if (chiave === 'p730lav') { titolo = '730 lavorate'; colore = '#2f9e5f'; corpo = tabellaPraticheDettaglio(prat.filter(function (p) { return e730(p) && eLavorata(p); })); }
  else if (chiave === 'p730dalav') { titolo = '730 da lavorare'; colore = '#e57373'; corpo = tabellaPraticheDettaglio(prat.filter(function (p) { return e730(p) && eDaLavorare(p); })); }
  else if (chiave === 'paltre') { titolo = 'Altre pratiche'; colore = '#0e8a8a'; corpo = tabellaPraticheDettaglio(prat.filter(function (p) { return !e730(p); })); }
  else if (chiave === 'g-pratiche') { titolo = 'Pratiche' + nomeGruppo; corpo = tabellaPraticheDettaglio(filtroGruppo(prat)); }
  else if (chiave === 'fatture' || chiave === 'g-fatture') {
    const l = filtroGruppo(prat).filter(function (p) { return Number(p.compenso || 0) > 0; });
    const emesse = l.filter(function (p) { return p.numFattura; });
    titolo = 'Fatture emesse' + nomeGruppo; colore = '#2f9e5f';
    corpo = rigaFormula([['Con numero di fattura', somma(emesse, 'compenso')], ['Ancora da fatturare', somma(l, 'compenso') - somma(emesse, 'compenso'), '+']], somma(l, 'compenso')) + tabellaPraticheDettaglio(l);
  }
  else if (chiave === 'incasso' || chiave === 'g-incasso') {
    const l = filtroGruppo(prat).filter(function (p) { return Number(p.pagato || 0) > 0; });
    titolo = 'Incasso' + nomeGruppo; colore = '#8e5bd6';
    corpo = riepilogoPagamentiHTML(l) + tabellaPraticheDettaglio(l);
  }
  else if (chiave === 'g-guadagno') {
    const l = filtroGruppo(prat);
    titolo = 'Guadagno' + nomeGruppo + ' (incasso − fatture)'; colore = '#c2185b';
    const n = sommaPeso(l);
    corpo = rigaFormula([['Incasso', somma(l, 'pagato')], ['Fatture', somma(l, 'compenso')]], somma(l, 'pagato') - somma(l, 'compenso'))
      + '<div style="font-size:13px; margin:-4px 0 10px; color:var(--sub)">Prezzo medio (fatture ÷ pratiche): <b>' + (n ? fmtEuro(somma(l, 'compenso') / n) : '—') + '</b> · Incasso medio (incasso ÷ pratiche): <b>' + (n ? fmtEuro(somma(l, 'pagato') / n) : '—') + '</b></div>'
      + tabellaPraticheDettaglio(l, { guadagno: true });
  }
  else if (chiave === 'consegnate') {
    titolo = 'Pratiche consegnate e da consegnare'; colore = '#8d5a3b';
    const cons = prat.filter(function (p) { return !!p.consegnataIl; }), daC = prat.filter(function (p) { return !p.consegnataIl; });
    corpo = rigaFormula([['Pagato delle consegnate', somma(cons, 'pagato')], ['importo delle da consegnare', somma(daC, 'pagato'), '+']], somma(prat, 'pagato'))
      + '<h4 style="margin:10px 0 6px">📦 Da consegnare (' + sommaPeso(daC) + ')</h4>' + tabellaPraticheDettaglio(daC)
      + '<h4 style="margin:14px 0 6px">✅ Consegnate (' + sommaPeso(cons) + ')</h4>' + tabellaPraticheDettaglio(cons);
  }
  else if (chiave === 'versamenti') { titolo = 'Versamenti al CAF'; colore = '#2f7de1'; corpo = dettaglioVersamentiHTML(anno); }
  else if (chiave === 'spese') {
    titolo = 'Spese sede'; colore = '#b35f0c';
    const lordo = typeof totaleSpeseSedeLordo === 'function' ? totaleSpeseSedeLordo(anno) : 0, rimb = typeof totaleRimborsiCaf === 'function' ? totaleRimborsiCaf(anno) : 0;
    corpo = rigaFormula([['Spese registrate', lordo], ['Rimborsate dal CAF', rimb]], lordo - rimb) + dettaglioSpeseHTML(anno);
  }
  else if (chiave === 'angelo') {
    titolo = 'Da restituire ad Angelo'; colore = '#8e5bd6';
    const d = typeof debitoAngelo === 'function' ? debitoAngelo() : { lista: [], totale: 0 };
    corpo = d.lista.length ? '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>Data</th><th>Voce</th><th style="text-align:right">Importo</th></tr></thead><tbody>'
      + d.lista.map(function (s) { return '<tr><td>' + esc(s.data || '') + '</td><td><b>' + esc(s.categoria || '') + '</b>' + (s.descrizione ? ' · ' + esc(s.descrizione) : '') + '</td>' + euroCella(s.importo) + '</tr>'; }).join('')
      + '<tr style="font-weight:800; background:var(--bg)"><td colspan="2">TOTALE</td>' + euroCella(d.totale) + '</tr></tbody></table></div>' : '<div class="empty">Niente da restituire</div>';
  }
  else if (chiave === 'cassa') {
    titolo = 'Soldi in cassa'; colore = '#1d4f91';
    const inc = somma(prat, 'pagato');
    const vers = (state.versamenti || []).filter(function (v) { return annoVersamento(v) === anno; }).reduce(function (t, v) { return t + Number(v.importo || 0); }, 0);
    const sp = typeof totaleSpeseSede === 'function' ? totaleSpeseSede(anno) : 0;
    const d = typeof cassaDivisa === 'function' ? cassaDivisa(anno) : null;
    const dd = typeof cassaDivisa === 'function' ? cassaDivisa(anno) : { detrContanti: 0, detrBanca: 0, bonifici: 0 };
    const detr = dd.detrContanti + dd.detrBanca;
    corpo = rigaFormula([['Incasso', inc], ['Bollettini al CAF', vers - detr - dd.bonifici], ['Spese detratte (restituite ad Angelo / pagate dalla cassa)', detr], ['Bonifici dei clienti detratti', dd.bonifici], ['Altre spese della sede', sp]].filter(function (v, i) { return i < 2 || i === 4 || v[1] > 0.004; }), inc - vers - sp)
      + (d ? '<div style="display:flex; gap:10px; flex-wrap:wrap">'
        + '<div style="flex:1; min-width:240px; padding:10px 12px; border-radius:10px; border-left:5px solid #1a7f37; background:color-mix(in srgb, #1a7f37 8%, var(--card))"><b>💶 Contanti nel cassetto: ' + fmtEuro(d.contanti) + '</b>'
        + '<div style="font-size:13px; margin-top:4px">+ pagamenti in contanti ' + fmtEuro(d.incContanti) + '<br>− bollettini pagati ' + fmtEuro(d.bollettini) + '<br>− spese detratte pagate in contanti ' + fmtEuro(d.detrContanti) + '<br>− spese sede in contanti ' + fmtEuro(d.speseContanti) + '</div></div>'
        + '<div style="flex:1; min-width:240px; padding:10px 12px; border-radius:10px; border-left:5px solid #1d4f91; background:color-mix(in srgb, #1d4f91 8%, var(--card))"><b>🏦 In banca: ' + fmtEuro(d.banca) + '</b>'
        + '<div style="font-size:13px; margin-top:4px">+ pagamenti POS e bonifico ' + fmtEuro(d.incBanca) + '<br>− bonifici detratti nei versamenti ' + fmtEuro(d.bonifici) + '<br>− spese detratte pagate con POS/bonifico ' + fmtEuro(d.detrBanca) + '<br>− spese sede con POS/bonifico ' + fmtEuro(d.speseBanca) + '</div></div></div>' : '')
      + '<h4 style="margin:14px 0 6px">Versamenti al CAF</h4>' + dettaglioVersamentiHTML(anno) + '<h4 style="margin:14px 0 6px">Spese sede</h4>' + dettaglioSpeseHTML(anno);
  }
  else if (chiave === 'guadagno') {
    titolo = 'Guadagno netto'; colore = '#c2185b';
    const g730 = prat.filter(e730), gAltre = prat.filter(function (p) { return !e730(p); });
    const sp = typeof totaleSpeseSede === 'function' ? totaleSpeseSede(anno) : 0;
    const v730 = somma(g730, 'pagato') - somma(g730, 'compenso'), vAltre = somma(gAltre, 'pagato') - somma(gAltre, 'compenso');
    corpo = rigaFormula([['Guadagno 730', v730], ['Guadagno altre pratiche', vAltre, '+'], ['Spese a carico della sede', sp]], v730 + vAltre - sp)
      + '<h4 style="margin:10px 0 6px">Pratiche</h4>' + tabellaPraticheDettaglio(prat, { guadagno: true })
      + '<h4 style="margin:14px 0 6px">Spese sede</h4>' + dettaglioSpeseHTML(anno);
  }
  else return;

  const vecchio = document.getElementById('popup-dett-cont'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-dett-cont';
  ov.style.cssText = 'position:fixed; inset:0; z-index:460; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:12px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid ' + colore + '; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:16px 18px; max-width:1100px; width:100%; max-height:92vh; display:flex; flex-direction:column">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px"><div style="font-size:19px; font-weight:800; color:' + colore + '">🔎 ' + esc(titolo) + ' – ' + anno + '</div>'
    + '<span style="display:flex; gap:6px"><button type="button" data-az="stampa" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer">🖨️ Stampa</button>'
    + '<button type="button" data-az="chiudi" style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer">✕ Chiudi</button></span></div>'
    + '<div id="dett-cont-corpo" style="overflow:auto; flex:1">' + corpo + '</div>'
    + '<div style="font-size:12px; color:var(--sub); margin-top:8px">Tocca una pratica per aprirla nel registro.</div></div>';
  document.body.appendChild(ov);
  const chiudi = function () { ov.remove(); document.removeEventListener('keydown', esci); };
  const esci = function (e) { if (e.key === 'Escape') chiudi(); };
  document.addEventListener('keydown', esci);
  ov.addEventListener('click', function (e) {
    const b = e.target.closest('button[data-az]');
    if (e.target === ov || (b && b.dataset.az === 'chiudi')) return chiudi();
    if (b && b.dataset.az === 'stampa') return stampaDettaglioCont(titolo + ' – ' + anno, document.getElementById('dett-cont-corpo').innerHTML);
    const r = e.target.closest('tr[data-pratica]');
    if (r && typeof apriPraticaDaTabella === 'function') { chiudi(); const tb = document.querySelector('.navmenu button[data-tab="registro"]'); if (tb && typeof showTab === 'function') showTab(tb); apriPraticaDaTabella(r.dataset.pratica); }
  });
}

function stampaDettaglioCont(titolo, html) {
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
  w.document.open();
  w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>' + esc(titolo) + '</title><style>@page{size:A4 landscape; margin:10mm} body{font-family:Arial,Helvetica,sans-serif; font-size:11.5px; color:#0f1b2d; -webkit-print-color-adjust:exact; print-color-adjust:exact} h1{font-size:16px; color:#1d4f91; margin:0 0 8px} table{width:100%; border-collapse:collapse; margin-bottom:10px} th,td{border:1px solid #d6dde8; padding:4px 6px; text-align:left; vertical-align:top} th{background:#eef3fa} .sub2{font-size:10px; color:#5b6b82} .barra{margin-bottom:10px} @media print{.barra{display:none}}</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button> <button onclick="window.close()">Chiudi</button></div>'
    + '<h1>CAF CISL Alì Terme – ' + esc(titolo) + '</h1><div style="color:#5b6b82; margin-bottom:8px">Stampato il ' + new Date().toLocaleDateString('it-IT') + '</div>' + html + '</body></html>');
  w.document.close();
}

// Clic su un riquadro della Contabilità
document.addEventListener('click', function (e) {
  const t = e.target.closest('#summary [data-dett]');
  if (!t) return;
  apriDettaglioCont(t.dataset.dett, t.dataset.gruppo || '');
});
