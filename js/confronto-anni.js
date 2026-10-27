/* ---------------- 📈 Confronto con l'anno prima ----------------
   Pagina da guardare o stampare a fine campagna: pratiche e incasso per ogni tipo (730 SEDE, collaboratori,
   altre pratiche) nell'anno scelto e in quello prima, con la differenza; quanti clienti del 730 dell'anno prima
   sono tornati, quanti mancano ancora (con il tasto per richiamarli) e quanti sono nuovi.
   La congiunta conta 2 come in tutto il programma; rinunce e annullate non contano. */

function chiavePersonaConfronto(nome, nascita, cf) {
  cf = String(cf || '').trim().toUpperCase();
  return cf ? 'cf:' + cf : 'n:' + String(nome || '').trim().toUpperCase() + '|' + String(nascita || '').trim();
}
// persone del 730 di un anno (titolare e coniuge)
function persone730Anno(anno) {
  const out = {};
  (state.pratiche || []).forEach(function (p) {
    if (p.annullata || !e730(p) || eRinuncia(p) || annoPratica(p) !== anno) return;
    out[chiavePersonaConfronto(p.nome, p.cf, p.codiceFiscale)] = true;
    const con = ((p.congCognome || '') + ' ' + (p.congNome || '')).trim() || p.congiunta;
    if (con) out[chiavePersonaConfronto(con, p.congData, p.congCodiceFiscale)] = true;
  });
  return out;
}
function datiConfrontoAnni(anno) {
  const prec = anno - 1;
  const conta = function (a) { return (state.pratiche || []).filter(function (p) { return !p.annullata && !eRinuncia(p) && annoPratica(p) === a; }); };
  const lA = conta(anno), lP = conta(prec);
  const tipi = {};
  const somma = function (lista, chi) { lista.forEach(function (p) { const k = p.tipo || 'SENZA TIPO'; const t = tipi[k] || (tipi[k] = { tipo: k, e730: e730(p), n: [0, 0], inc: [0, 0] }); t.n[chi] += pesoPratica(p); t.inc[chi] += Number(p.pagato || 0); }); };
  somma(lP, 0); somma(lA, 1);
  const righe = Object.keys(tipi).map(function (k) { return tipi[k]; }).sort(function (a, b) { return (b.e730 - a.e730) || a.tipo.localeCompare(b.tipo); });
  const tot = function (filtro) { return righe.filter(filtro).reduce(function (t, r) { t.n[0] += r.n[0]; t.n[1] += r.n[1]; t.inc[0] += r.inc[0]; t.inc[1] += r.inc[1]; return t; }, { n: [0, 0], inc: [0, 0] }); };
  // clienti del 730: tornati, da richiamare, nuovi
  const daRichiamare = typeof clientiDaRichiamare === 'function' ? clientiDaRichiamare(anno) : [];
  const ora = persone730Anno(anno), prima = persone730Anno(prec);
  const primoAnno = typeof ANNO_INIZIO_PROTOCOLLO !== 'undefined' && prec < ANNO_INIZIO_PROTOCOLLO;
  let nuovi = 0;
  if (primoAnno) {
    // l'anno prima del programma: i clienti «vecchi» sono quelli dell'archivio caricato prima dell'inizio
    const limite = Date.parse(ANNO_INIZIO_PROTOCOLLO + '-01-01T00:00:00'), vecchi = {};
    (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).forEach(function (c) { if (!c.creatoIl || Date.parse(c.creatoIl) < limite) vecchi[chiavePersonaConfronto(c.nomeCompleto, c.dataNascita, c.codiceFiscale)] = true; });
    nuovi = Object.keys(ora).filter(function (k) { return !vecchi[k]; }).length;
  } else nuovi = Object.keys(ora).filter(function (k) { return !prima[k]; }).length;
  return { anno: anno, prec: prec, righe: righe, tot730: tot(function (r) { return r.e730; }), totAltre: tot(function (r) { return !r.e730; }), totale: tot(function () { return true; }),
    tornati: Object.keys(ora).length - nuovi, daRichiamare: daRichiamare.length, nuovi: nuovi, primoAnno: primoAnno };
}
function htmlConfrontoAnni(d, perStampa) {
  const diff = function (a, b, soldi) {
    const x = b - a; if (!x) return '<span style="color:#6b7280">=</span>';
    const col = x > 0 ? '#1a7f37' : '#c0392b', t = (x > 0 ? '+' : '−') + (soldi ? fmtEuro(Math.abs(x)) : Math.abs(x));
    return '<b style="color:' + col + '">' + t + (a ? ' <small>(' + (x > 0 ? '+' : '−') + Math.round(Math.abs(x) / a * 100) + '%)</small>' : '') + '</b>';
  };
  const riga = function (r, grassetto) {
    const st = grassetto ? ' style="font-weight:800; background:rgba(29,79,145,.08)"' : '';
    return '<tr' + st + '><td>' + esc(r.tipo) + '</td><td class="n">' + r.n[0] + '</td><td class="n">' + r.n[1] + '</td><td class="n">' + diff(r.n[0], r.n[1]) + '</td>'
      + '<td class="n">' + fmtEuro(r.inc[0]) + '</td><td class="n">' + fmtEuro(r.inc[1]) + '</td><td class="n">' + diff(r.inc[0], r.inc[1], true) + '</td></tr>';
  };
  const testa = '<tr><th>Tipo di pratica</th><th class="n">Pratiche ' + d.prec + '</th><th class="n">Pratiche ' + d.anno + '</th><th class="n">Differenza</th><th class="n">Incasso ' + d.prec + '</th><th class="n">Incasso ' + d.anno + '</th><th class="n">Differenza</th></tr>';
  const box = function (n, testo, colore) { return '<div style="flex:1 1 170px; padding:10px; border-radius:10px; background:' + colore + '; color:#fff; text-align:center"><div style="font-size:22px; font-weight:800">' + n + '</div><div style="font-size:11.5px; font-weight:700; text-transform:uppercase">' + testo + '</div></div>'; };
  return '<style>.cf-tab{width:100%; border-collapse:collapse; font-size:13px}.cf-tab th,.cf-tab td{border-bottom:1px solid #d9e0ea; padding:5px 6px; text-align:left}.cf-tab .n{text-align:right; white-space:nowrap}.cf-tab th{background:#1d4f91; color:#fff}</style>'
    + '<div style="font-size:13px; margin:4px 0 10px">Pratiche (senza rinunce e annullate; la congiunta conta 2) e incasso di ogni tipo, ' + d.anno + ' confrontato con il ' + d.prec + '.'
    + (d.primoAnno ? ' <b>Il ' + d.prec + ' è l\'anno prima del programma</b>: le sue pratiche nel programma sono solo prove, quindi il confronto vero partirà dal prossimo anno; i clienti del ' + d.prec + ' sono presi dall\'archivio.' : '') + '</div>'
    + '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px">'
    + box(d.tornati, 'Clienti 730 tornati nel ' + d.anno, '#1a7f37')
    + box(d.daRichiamare, 'Clienti 730 del ' + d.prec + ' non ancora tornati', '#c0392b')
    + box(d.nuovi, 'Clienti 730 nuovi nel ' + d.anno, '#1d4f91') + '</div>'
    + (!perStampa && d.daRichiamare ? '<div style="margin-bottom:12px"><button type="button" onclick="document.getElementById(\'popup-confronto\').remove(); if (typeof apriRichiami === \'function\') apriRichiami();" style="background:#c0392b; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">☎️ Vedi chi richiamare</button></div>' : '')
    + '<table class="cf-tab">' + testa
    + d.righe.filter(function (r) { return r.e730; }).map(function (r) { return riga(r); }).join('')
    + riga(Object.assign({ tipo: '📘 Totale 730' }, d.tot730), true)
    + d.righe.filter(function (r) { return !r.e730; }).map(function (r) { return riga(r); }).join('')
    + riga(Object.assign({ tipo: '📗 Totale altre pratiche' }, d.totAltre), true)
    + riga(Object.assign({ tipo: '🧮 TOTALE' }, d.totale), true) + '</table>';
}
function apriConfrontoAnni(anno) {
  anno = anno || annoAttivo();
  const d = datiConfrontoAnni(anno);
  const vecchio = document.getElementById('popup-confronto'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-confronto';
  ov.style.cssText = 'position:fixed; inset:0; z-index:457; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:10px';
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-chiudi]')) ov.remove(); });
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:14px; border-top:6px solid #1d4f91; max-width:900px; width:100%; max-height:92vh; overflow:auto; padding:14px 16px; box-shadow:0 10px 40px rgba(0,0,0,.3)">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap"><b style="font-size:18px; color:#1d4f91">📈 Confronto ' + d.anno + ' con il ' + d.prec + '</b>'
    + '<span style="display:flex; gap:6px"><button type="button" onclick="apriConfrontoAnni(' + (anno - 1) + ')" title="Anno prima" style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:6px 10px; cursor:pointer">◀</button>'
    + '<button type="button" onclick="apriConfrontoAnni(' + (anno + 1) + ')" title="Anno dopo" style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:6px 10px; cursor:pointer">▶</button>'
    + '<button type="button" onclick="stampaConfrontoAnni(' + anno + ')" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">🖨️ Stampa</button>'
    + '<button type="button" data-chiudi style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:6px 12px; cursor:pointer">✕</button></span></div>'
    + htmlConfrontoAnni(d, false) + '</div>';
  document.body.appendChild(ov);
}
function stampaConfrontoAnni(anno) {
  const d = datiConfrontoAnni(anno);
  const html = '<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Confronto ' + d.anno + ' – ' + d.prec + '</title><style>@page{size:A4 portrait; margin:12mm} body{font-family:Arial,Helvetica,sans-serif; color:#0f1b2d; font-size:12px; margin:0; padding:14px} h1{font-size:17px; margin:0 0 4px}</style></head><body>'
    + '<h1>CAF CISL Alì Terme – Confronto ' + d.anno + ' con il ' + d.prec + '</h1><div>Stampato il ' + esc(new Date().toLocaleDateString('it-IT')) + '</div>'
    + htmlConfrontoAnni(d, true) + '</body></html>';
  if (typeof mostraPaginaNelProgramma === 'function') mostraPaginaNelProgramma(html, 'Confronto anni');
  else { const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); } }
}
