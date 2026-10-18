/* ---------------- Resoconto annuale ----------------
   Pagina da stampare con i conti di un anno: pratiche, fatture, incassi, differenze, spese sede,
   guadagno netto e divisione del guadagno tra i soci (di base 50% Federica e 50% Angelo). */

function apriResocontoAnnuale() {
  if (typeof vedeGuadagni === 'function' && !vedeGuadagni()) { alert('Il resoconto annuale con il guadagno è visibile solo all\'amministratore.'); return; }
  const anni = Array.from(new Set((state.pratiche || []).map(annoPratica))).sort(function (a, b) { return b - a; });
  if (anni.indexOf(annoAttivo()) < 0) anni.unshift(annoAttivo());
  let soci = { a: 'FEDERICA', b: 'ANGELO', perc: 50 };
  try { soci = Object.assign(soci, JSON.parse(localStorage.getItem('resoconto-soci') || '{}')); } catch (e) {}
  const vecchio = document.getElementById('popup-resoconto'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-resoconto';
  ov.style.cssText = 'position:fixed; inset:0; z-index:470; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:14px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid #c2185b; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:16px 18px; max-width:440px; width:100%">'
    + '<div style="font-size:19px; font-weight:800; color:#c2185b">📊 Resoconto annuale</div>'
    + '<div style="font-size:13px; color:var(--sub); margin-bottom:10px">Pratiche, fatture, incassi, spese, guadagno netto e divisione tra i soci.</div>'
    + '<label>Anno</label><select id="rs-anno">' + anni.map(function (a) { return '<option value="' + a + '"' + (a === annoAttivo() ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select>'
    + '<div class="grid" style="margin-top:8px"><div><label>Socio 1</label><input id="rs-a" value="' + esc(soci.a) + '" style="text-transform:uppercase"></div>'
    + '<div><label>Socio 2</label><input id="rs-b" value="' + esc(soci.b) + '" style="text-transform:uppercase"></div>'
    + '<div><label>Quota socio 1 (%)</label><input id="rs-perc" value="' + esc(String(soci.perc)) + '" inputmode="numeric"></div>'
    + '<div style="align-self:end; font-size:12.5px; color:var(--sub)">il socio 2 prende il resto</div></div>'
    + '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:14px"><button type="button" data-az="no" style="background:var(--line); color:var(--ink)">Annulla</button>'
    + '<button type="button" data-az="si" style="background:#c2185b; color:#fff; font-weight:800">📊 Apri il resoconto</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function (e) {
    const b = e.target.closest('button[data-az]');
    if (e.target === ov || (b && b.dataset.az === 'no')) { ov.remove(); return; }
    if (!b) return;
    const perc = Math.max(0, Math.min(100, parseFloat(String(document.getElementById('rs-perc').value).replace(',', '.')) || 0));
    const s = { a: document.getElementById('rs-a').value.trim().toUpperCase() || 'SOCIO 1', b: document.getElementById('rs-b').value.trim().toUpperCase() || 'SOCIO 2', perc: perc };
    try { localStorage.setItem('resoconto-soci', JSON.stringify(s)); } catch (er) {}
    const anno = parseInt(document.getElementById('rs-anno').value, 10);
    ov.remove();
    stampaResocontoAnnuale(anno, s);
  });
}

function datiResocontoAnnuale(anno) {
  const somma = function (l, c) { return l.reduce(function (t, p) { return t + Number(p[c] || 0); }, 0); };
  const prat = (state.pratiche || []).filter(function (p) { return annoPratica(p) === anno; });
  const pratC = praticheContabili(prat).concat(typeof fattureAnnullateAperte === 'function' ? fattureAnnullateAperte(anno) : []);
  const gruppo = function (filtro) {
    const fatt = pratC.filter(filtro), inc = prat.filter(filtro);
    const f = somma(fatt, 'compenso'), i = somma(inc, 'pagato'), n = sommaPeso(inc.filter(function (p) { return !p._annFatt; }));
    const daIncassare = inc.reduce(function (t, p) { return t + (eConsegnata(p) && typeof eMorosa === 'function' && eMorosa(p) ? residuoPratica(p) : 0); }, 0);
    return { n: n, fatture: f, incasso: i, guadagno: i - f, attesa: totaleFattureInAttesa(inc), daIncassare: daIncassare,
      consegnate: inc.filter(eConsegnata).length, medioF: n ? f / n : 0, medioI: n ? i / n : 0 };
  };
  const g730 = gruppo(e730Conta), gAltre = gruppo(eAltraConta), gRin = gruppo(eRinuncia);
  const c730 = conteggi730(prat);
  const vers = (state.versamenti || []).filter(function (v) { return annoVersamento(v) === anno; });
  const versato = somma(vers, 'importo');
  const spese = typeof totaleSpeseSede === 'function' ? totaleSpeseSede(anno) : 0;
  const fattureTot = g730.fatture + gAltre.fatture + gRin.fatture;
  const lordo = g730.guadagno + gAltre.guadagno + gRin.guadagno;
  return { anno: anno, c730: c730, g730: g730, gAltre: gAltre, gRin: gRin, versato: versato, daVersare: fattureTot - versato, spese: spese,
    fattureTot: fattureTot, incassoTot: g730.incasso + gAltre.incasso + gRin.incasso, lordo: lordo, netto: lordo - spese,
    annullate: (state.annullate || []).filter(function (p) { return annoPratica(p) === anno; }).length };
}

function stampaResocontoAnnuale(anno, soci) {
  const d = datiResocontoAnnuale(anno);
  const e = function (v) { return fmtEuro(v || 0); };
  const quotaA = Math.round(d.netto * soci.perc) / 100, quotaB = Math.round((d.netto - quotaA) * 100) / 100;
  const riga = function (voce, valore, stile) { return '<tr' + (stile ? ' class="' + stile + '"' : '') + '><td>' + voce + '</td><td class="n">' + valore + '</td></tr>'; };
  const blocco = function (titolo, colore, g, extra) {
    return '<div class="blocco" style="border-color:' + colore + '"><h2 style="color:' + colore + '">' + titolo + '</h2><table>'
      + riga('Pratiche fatte' + (extra || ''), g.n)
      + riga('di cui consegnate / definite', g.consegnate)
      + riga('Fatture emesse (da versare al CAF)', e(g.fatture))
      + riga('Incasso', e(g.incasso))
      + riga('<b>Differenza = guadagno (incasso − fatture)</b>', '<b>' + e(g.guadagno) + '</b>', 'evid')
      + (g.n ? riga('Prezzo medio fattura / incasso medio', e(g.medioF) + ' / ' + e(g.medioI)) : '')
      + (g.attesa > 0.004 ? riga('Fatture in attesa di consegna (non ancora contate)', e(g.attesa), 'nota') : '')
      + (g.daIncassare > 0.004 ? riga('Ancora da incassare (morosi)', e(g.daIncassare), 'nota') : '')
      + '</table></div>';
  };
  const html = '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Resoconto ' + anno + '</title><style>'
    + '@page{size:A4 portrait; margin:12mm} body{font-family:Arial,Helvetica,sans-serif; color:#0f1b2d; margin:0; padding:14px; font-size:12.5px; background:#fff}'
    + 'h1{font-size:20px; color:#c2185b; margin:0} .sub{color:#5b6b82; font-size:11.5px; margin:2px 0 12px}'
    + '.blocco{border:2px solid; border-radius:10px; padding:8px 12px; margin-bottom:10px; page-break-inside:avoid} h2{font-size:14.5px; margin:0 0 4px}'
    + 'table{width:100%; border-collapse:collapse} td{padding:4px 6px; border-bottom:1px solid #e3e8ef} td.n{text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums}'
    + 'tr.evid td{background:#fdf0f5} tr.nota td{color:#5b6b82; font-size:11.5px} tr.tot td{font-size:15px; font-weight:800; background:#c2185b; color:#fff}'
    + '.soci{display:flex; gap:10px; margin-top:6px} .socio{flex:1; border:2px solid #c2185b; border-radius:10px; padding:10px; text-align:center} .socio b{display:block; font-size:22px; color:#c2185b; margin-top:4px}'
    + '.firme{display:flex; gap:30px; margin-top:34px} .firme div{flex:1; border-top:1px solid #0f1b2d; padding-top:4px; text-align:center; font-size:11px}'
    + '.barra{margin-bottom:10px} .barra button{font-size:14px; padding:8px 16px; border:none; border-radius:999px; background:#c2185b; color:#fff; cursor:pointer; margin-right:6px} .barra button.chiudi{background:#e3e8ef; color:#0f1b2d}'
    + '@media print{.barra{display:none} body{padding:0}}</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button><button class="chiudi" onclick="window.close()">Chiudi</button></div>'
    + '<h1>CAF CISL – Sede di Alì Terme · Resoconto anno ' + anno + '</h1>'
    + '<div class="sub">Stampato il ' + new Date().toLocaleDateString('it-IT') + ' · le fatture contano dalla consegna della pratica · pratiche annullate: ' + d.annullate + ' (non contate)</div>'
    + blocco('📘 Pratiche 730', '#1d4f91', d.g730, ' (le congiunte valgono 2)')
    + (d.c730.daFare ? '<div class="sub" style="margin:-6px 0 10px">730 ancora da lavorare: ' + d.c730.daFare + '</div>' : '')
    + blocco('📗 Altre pratiche (ISEE, RED, IMU, colf…)', '#0e8a8a', d.gAltre)
    + (d.gRin.n || Math.abs(d.gRin.guadagno) > 0.004 ? blocco('⛔ Rinunce alla compilazione', '#6b7280', d.gRin) : '')
    + '<div class="blocco" style="border-color:#c2185b"><h2 style="color:#c2185b">💰 Totale dell\'anno</h2><table>'
    + riga('Fatture emesse in totale', e(d.fattureTot))
    + riga('Incasso totale', e(d.incassoTot))
    + riga('Differenza incasso − fatture (guadagno delle pratiche)', e(d.lordo))
    + riga('− Spese gestione sede (al netto dei rimborsi CAF)', e(d.spese))
    + riga('GUADAGNO NETTO ' + anno, e(d.netto), 'tot')
    + riga('Versamenti fatti al CAF', e(d.versato), 'nota')
    + riga('Fatture ancora da versare al CAF', e(d.daVersare), 'nota')
    + '</table></div>'
    + '<div class="blocco" style="border-color:#c2185b"><h2 style="color:#c2185b">🤝 Divisione del guadagno netto</h2>'
    + '<div class="soci"><div class="socio">' + esc(soci.a) + ' (' + String(soci.perc).replace('.', ',') + '%)<b>' + e(quotaA) + '</b></div>'
    + '<div class="socio">' + esc(soci.b) + ' (' + String(Math.round((100 - soci.perc) * 100) / 100).replace('.', ',') + '%)<b>' + e(quotaB) + '</b></div></div>'
    + (d.daVersare > 0.004 ? '<div class="sub" style="margin-top:8px">Attenzione: ci sono ancora ' + e(d.daVersare) + ' di fatture da versare al CAF. Il guadagno è già calcolato al netto delle fatture: quei soldi non vanno divisi.</div>' : '')
    + '<div class="firme"><div>' + esc(soci.a) + '</div><div>' + esc(soci.b) + '</div></div></div>'
    + '</body></html>';
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra del resoconto: consenti i popup per questo sito e riprova.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
