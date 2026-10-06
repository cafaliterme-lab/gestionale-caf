/**
 * Contabilità > Ricerca fatture: dal / al (per data di apertura, fine lavorazione o data fattura),
 * con il tipo di pagamento (contanti, POS, bonifico, non indicato) e i totali divisi per pagamento.
 */
const RF = { da: '', a: '', rif: 'apertura', pag: '', soloFatturate: true, testo: '' };

function isoOggi() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function primoDelMese() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; }
function dataRiferimento(p) { return RF.rif === 'fine' ? p.dataFine : RF.rif === 'fattura' ? p.dataFattura : p.data; }
function etichettaPagamento(m) { return ({ CONTANTI: '💶 Contanti', POS: '💳 POS', BONIFICO: '🏦 Bonifico' })[m] || '❔ Non indicato'; }

function renderRicercaFatture() {
  const box = document.getElementById('ricerca-fatture');
  if (!box) return;
  if (!box.dataset.pronta) {
    box.dataset.pronta = '1';
    RF.da = RF.da || primoDelMese(); RF.a = RF.a || isoOggi();
    const campo = 'style="width:auto"';
    box.innerHTML = '<div class="raff-title">🔎 Ricerca fatture</div>'
      + '<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end">'
      + '<div><label>Dal</label><input id="rf-da" type="date" ' + campo + ' value="' + RF.da + '" onchange="RF.da=this.value; aggiornaRicercaFatture()"></div>'
      + '<div><label>Al</label><input id="rf-a" type="date" ' + campo + ' value="' + RF.a + '" onchange="RF.a=this.value; aggiornaRicercaFatture()"></div>'
      + '<div><label>Riferimento</label><select id="rf-rif" ' + campo + ' onchange="RF.rif=this.value; aggiornaRicercaFatture()"><option value="apertura">Data apertura</option><option value="fine">Fine lavorazione</option><option value="fattura">Data fattura</option></select></div>'
      + '<div><label>Tipo di pagamento</label><select id="rf-pag" ' + campo + ' onchange="RF.pag=this.value; aggiornaRicercaFatture()"><option value="">Tutti</option><option value="CONTANTI">💶 Contanti</option><option value="POS">💳 POS</option><option value="BONIFICO">🏦 Bonifico</option><option value="NESSUNO">❔ Non indicato</option></select></div>'
      + '<div style="flex:1; min-width:160px"><label>Cliente / n. fattura</label><input id="rf-testo" type="search" placeholder="Facoltativo" oninput="RF.testo=this.value; aggiornaRicercaFatture()"></div>'
      + '<label class="chk" style="margin-bottom:8px"><input type="checkbox" id="rf-solo" checked onchange="RF.soloFatturate=this.checked; aggiornaRicercaFatture()"> Solo con importo</label></div>'
      + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin:8px 0">'
      + ['Oggi', 'Questo mese', 'Mese scorso', 'Quest\'anno'].map(function (t, i) { return '<button type="button" style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:4px 12px; font-size:12px; cursor:pointer" onclick="periodoRicercaFatture(' + i + ')">' + t + '</button>'; }).join('')
      + '<span style="flex:1"></span><button type="button" style="background:#1d7a46; color:#fff; border:none; border-radius:999px; padding:5px 14px; font-size:12.5px; font-weight:700; cursor:pointer" onclick="excelRicercaFatture()">📊 Excel</button>'
      + '<button type="button" style="background:#c0392b; color:#fff; border:none; border-radius:999px; padding:5px 14px; font-size:12.5px; font-weight:700; cursor:pointer" onclick="stampaRicercaFatture()">🖨️ Stampa</button></div>'
      + '<div id="rf-totali"></div><div id="rf-lista"></div>';
  }
  aggiornaRicercaFatture();
}
function periodoRicercaFatture(i) {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth();
  const iso = function (x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  if (i === 0) { RF.da = RF.a = iso(d); }
  if (i === 1) { RF.da = iso(new Date(y, m, 1)); RF.a = iso(d); }
  if (i === 2) { RF.da = iso(new Date(y, m - 1, 1)); RF.a = iso(new Date(y, m, 0)); }
  if (i === 3) { RF.da = y + '-01-01'; RF.a = iso(d); }
  document.getElementById('rf-da').value = RF.da; document.getElementById('rf-a').value = RF.a;
  aggiornaRicercaFatture();
}
function fattureTrovate() {
  const da = isoNum(RF.da), a = isoNum(RF.a);
  const q = String(RF.testo || '').trim().toUpperCase();
  return (state.pratiche || []).filter(function (p) {
    if (RF.soloFatturate && !Number(p.compenso) && !Number(p.pagato)) return false;
    const d = dataNum(dataRiferimento(p));
    if (da || a) { if (d === null) return false; if (da && d < da) return false; if (a && d > a) return false; }
    const m = METODI_PAGAMENTO.indexOf(p.metodoPagamento) >= 0 ? p.metodoPagamento : 'NESSUNO';
    if (RF.pag && m !== RF.pag) return false;
    if (q && [p.nome, p.numFattura, p.codiceFiscale, formattaProtocollo(p)].join(' ').toUpperCase().indexOf(q) < 0) return false;
    return true;
  }).sort(function (x, y) { return (dataNum(dataRiferimento(x)) || 0) - (dataNum(dataRiferimento(y)) || 0) || x.numero - y.numero; });
}
function aggiornaRicercaFatture() {
  const lista = document.getElementById('rf-lista');
  if (!lista) return;
  const r = fattureTrovate();
  const tot = { CONTANTI: { n: 0, f: 0, i: 0 }, POS: { n: 0, f: 0, i: 0 }, BONIFICO: { n: 0, f: 0, i: 0 }, NESSUNO: { n: 0, f: 0, i: 0 } };
  r.forEach(function (p) { const m = METODI_PAGAMENTO.indexOf(p.metodoPagamento) >= 0 ? p.metodoPagamento : 'NESSUNO'; tot[m].n++; tot[m].f += Number(p.compenso || 0); tot[m].i += Number(p.pagato || 0); });
  const tf = r.reduce(function (t, p) { return t + Number(p.compenso || 0); }, 0), ti = r.reduce(function (t, p) { return t + Number(p.pagato || 0); }, 0);
  const tessera = function (titolo, n, f, i, col) {
    return '<div style="flex:1; min-width:140px; padding:8px 10px; border-radius:10px; border:2px solid ' + col + '"><div style="font-weight:800; color:' + col + '">' + titolo + '</div>'
      + '<div style="font-size:12px; color:var(--sub)">' + n + ' pratiche</div><div style="font-size:12.5px">Fatture: <b>' + fmtEuro(f) + '</b></div><div style="font-size:12.5px">Incassato: <b>' + fmtEuro(i) + '</b></div></div>';
  };
  document.getElementById('rf-totali').innerHTML = '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px">'
    + tessera('TOTALE', r.length, tf, ti, '#1d4f91')
    + tessera('💶 Contanti', tot.CONTANTI.n, tot.CONTANTI.f, tot.CONTANTI.i, '#1a7f37')
    + tessera('💳 POS', tot.POS.n, tot.POS.f, tot.POS.i, '#8e5bd6')
    + tessera('🏦 Bonifico', tot.BONIFICO.n, tot.BONIFICO.f, tot.BONIFICO.i, '#2f7de1')
    + (tot.NESSUNO.n ? tessera('❔ Non indicato', tot.NESSUNO.n, tot.NESSUNO.f, tot.NESSUNO.i, '#8a8f98') : '') + '</div>';
  lista.innerHTML = r.length ? '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>Data</th><th>Protocollo</th><th>Cliente</th><th>Tipo</th><th>N. fattura</th><th>Fattura</th><th>Pagato</th><th>Pagamento</th></tr></thead><tbody>'
    + r.map(function (p) {
      return '<tr><td>' + esc(dataRiferimento(p) || '-') + '</td><td>' + esc(formattaProtocollo(p)) + '</td><td>' + esc(p.nome || '') + '</td><td>' + esc(p.tipo || '') + '</td><td>' + esc(p.numFattura || '-') + '</td>'
        + '<td>' + fmtEuro(p.compenso) + '</td><td><b>' + fmtEuro(p.pagato) + '</b></td><td>' + etichettaPagamento(p.metodoPagamento) + '</td></tr>';
    }).join('')
    + '<tr style="font-weight:800"><td colspan="5">TOTALE · ' + r.length + ' pratiche</td><td>' + fmtEuro(tf) + '</td><td>' + fmtEuro(ti) + '</td><td></td></tr></tbody></table></div>'
    : '<div class="empty">Nessuna fattura nel periodo scelto' + (RF.rif === 'fattura' ? ' (molte pratiche non hanno la data fattura: prova con "Data apertura")' : '') + '</div>';
}
function descrizioneRicercaFatture() {
  const d = function (iso) { return iso ? iso.split('-').reverse().join('/') : '…'; };
  return 'Dal ' + d(RF.da) + ' al ' + d(RF.a) + ' · per ' + ({ apertura: 'data apertura', fine: 'fine lavorazione', fattura: 'data fattura' })[RF.rif]
    + ' · pagamento: ' + (RF.pag ? etichettaPagamento(RF.pag === 'NESSUNO' ? '' : RF.pag).replace(/^\S+ /, '') : 'tutti');
}
function excelRicercaFatture() {
  if (!window.XLSX) { alert('La libreria Excel non si è caricata. Riprova tra poco.'); return; }
  const r = fattureTrovate();
  const righe = r.map(function (p) {
    return { 'Data': dataRiferimento(p) || '', 'Protocollo': formattaProtocollo(p), 'Cliente': p.nome || '', 'Codice fiscale': p.codiceFiscale || '', 'Tipo': p.tipo || '',
      'N. fattura': p.numFattura || '', 'Fattura (€)': Number(p.compenso) || 0, 'Pagato (€)': Number(p.pagato) || 0, 'Pagamento': etichettaPagamento(p.metodoPagamento).replace(/^\S+ /, '') };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(righe), 'Fatture');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Ricerca fatture'], [descrizioneRicercaFatture()]]), 'Filtri');
  XLSX.writeFile(wb, 'fatture-' + (RF.da || 'inizio') + '-' + (RF.a || 'fine') + '.xlsx');
}
function stampaRicercaFatture() {
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
  const tabella = document.getElementById('rf-lista').innerHTML, totali = document.getElementById('rf-totali').innerHTML;
  w.document.open();
  w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Ricerca fatture</title><style>@page{size:A4 landscape; margin:10mm} body{font-family:Arial,Helvetica,sans-serif; font-size:11.5px; color:#0f1b2d; --sub:#5b6b82; --line:#cfd8e3} h1{font-size:16px; color:#1d4f91; margin:0 0 4px} table{width:100%; border-collapse:collapse} th,td{border:1px solid #cfd8e3; padding:4px 6px; text-align:left} th{background:#1d4f91; color:#fff} @media print{.barra{display:none}}</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa</button></div><h1>CAF CISL Alì Terme – Ricerca fatture</h1><div style="margin-bottom:8px">' + esc(descrizioneRicercaFatture()) + '</div>'
    + totali + tabella + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
  w.document.close();
}
