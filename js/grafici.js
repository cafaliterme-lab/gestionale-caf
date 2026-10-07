/**
 * Tab GRAFICI: contabilita' e numero pratiche dell'anno scelto, piu' il confronto tra anni.
 * Le pratiche congiunte valgono 2; i tipi pratica hanno lo stesso colore del Registro.
 */
const graficiAttivi = {};
const COL_FATTURE = '#2f9e5f';
const COL_INCASSO = '#8e5bd6';
const COL_CAF = '#2f7de1';
const COL_NETTO = '#1d4f91';
const COL_GUADAGNO = '#374151';
const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function euroTick(v) { return '€ ' + Number(v).toLocaleString('it-IT'); }

function opzioniBase(conEuro, orizzontale, legenda) {
  const cs = getComputedStyle(document.documentElement);
  const ink = cs.getPropertyValue('--ink').trim() || '#0f1b2d';
  const sub = cs.getPropertyValue('--sub').trim() || '#5b6b82';
  const assiValori = { beginAtZero: true, ticks: { color: sub, precision: 0, callback: conEuro ? euroTick : undefined }, grid: { color: 'rgba(128,140,160,.18)' } };
  const assiCategorie = { ticks: { color: ink, font: { size: 11 } }, grid: { display: false } };
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: orizzontale ? 'y' : 'x',
    plugins: {
      legend: { display: !!legenda, position: 'bottom', labels: { boxWidth: 10, color: ink, font: { size: 11 } } },
      tooltip: { callbacks: { label: function (c) {
        const v = orizzontale ? c.parsed.x : c.parsed.y;
        return (c.dataset.label ? c.dataset.label + ': ' : '') + (conEuro ? fmtEuro(v) : v);
      } } },
    },
    scales: orizzontale ? { x: assiValori, y: assiCategorie } : { x: assiCategorie, y: assiValori },
  };
}

function opzioniCiambella(conEuro) {
  const cs = getComputedStyle(document.documentElement);
  const ink = cs.getPropertyValue('--ink').trim() || '#0f1b2d';
  return {
    responsive: true, maintainAspectRatio: false, cutout: '60%',
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, color: ink, font: { size: 11 } } },
      tooltip: { callbacks: { label: function (c) { return c.label + ': ' + (conEuro ? fmtEuro(c.parsed) : c.parsed); } } },
    },
  };
}

function disegna(id, config) {
  const cv = document.getElementById(id);
  if (!cv || !window.Chart) return;
  if (graficiAttivi[id]) graficiAttivi[id].destroy();
  graficiAttivi[id] = new Chart(cv, config);
}

function meseDi(p) {
  const d = parseDataIT(p.data);
  return d ? d.m - 1 : -1;
}

function sommaCampo(lista, campo) { return lista.reduce(function (a, p) { return a + Number(p[campo] || 0); }, 0); }

function renderGrafici() {
  const sez = document.getElementById('tab-grafici');
  if (!sez || !sez.classList.contains('active')) return;
  if (!window.Chart) {
    document.getElementById('grafici-avviso').textContent = 'I grafici non si sono caricati: controlla la connessione e ricarica la pagina.';
    return;
  }
  const anno = annoAttivo();
  document.getElementById('grafici-anno').textContent = anno;
  const pratAnno = (state.pratiche || []).filter(function (p) { return annoPratica(p) === anno; });
  const versAnno = (state.versamenti || []).filter(function (v) { return annoDiData(v.data) === anno; });
  const fatture = sommaCampo(pratAnno, 'compenso');
  const incasso = sommaCampo(pratAnno, 'pagato');
  const acconti = typeof totaleAcconti === 'function' ? totaleAcconti(anno) : 0;
  const caf = sommaCampo(versAnno, 'importo');
  const speseSedeAnno = typeof totaleSpeseSede === 'function' ? totaleSpeseSede(anno) : 0;
  document.getElementById('grafici-avviso').textContent = pratAnno.length ? '' : 'Nessuna pratica nel ' + anno + ': scegli un altro anno in "Anno di protocollo".';

  // 1. Riepilogo economico
  disegna('gr-economico', {
    type: 'bar',
    data: {
      labels: ['Fatture emesse', 'Incasso totale', 'Pagamenti collaboratori', 'Pagamenti CAF', 'Netto'].concat(vedeGuadagni() ? ['Spese sede', 'Guadagno netto'] : []),
      datasets: [{ data: [fatture, incasso, acconti, caf, incasso + acconti - caf].concat(vedeGuadagni() ? [speseSedeAnno, incasso + acconti - caf - fatture - speseSedeAnno] : []), backgroundColor: [COL_FATTURE, COL_INCASSO, '#0e7c86', COL_CAF, COL_NETTO, '#b35f0c', COL_GUADAGNO], borderRadius: 6, maxBarThickness: 56 }],
    },
    options: opzioniBase(true, false, false),
  });

  // 2. Pratiche per stato
  const stati = Object.keys(STATI).filter(function (k) { return pratAnno.some(function (p) { return p.stato === k; }); });
  disegna('gr-stati', {
    type: 'doughnut',
    data: {
      labels: stati.map(function (k) { return STATI[k].l; }),
      datasets: [{ data: stati.map(function (k) { return sommaPeso(pratAnno.filter(function (p) { return p.stato === k; })); }), backgroundColor: stati.map(function (k) { return STATI[k].c; }), borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#fff', borderWidth: 2 }],
    },
    options: opzioniCiambella(false),
  });

  // 3 e 4. Per tipo pratica
  const d = datiPerTipo(pratAnno);
  const contaTipo = {};
  pratAnno.forEach(function (p) { const k = p.tipo || 'SENZA TIPO'; contaTipo[k] = (contaTipo[k] || 0) + pesoPratica(p); });
  document.getElementById('gr-tipi-wrap').style.height = '300px';
  document.getElementById('gr-tipi-euro-wrap').style.height = '340px';
  const etichette = d.tipi.map(etichettaSuPiuRighe);
  disegna('gr-tipi', {
    type: 'bar',
    data: { labels: etichette, datasets: [{ label: 'Pratiche', data: d.tipi.map(function (t) { return contaTipo[t]; }), backgroundColor: d.tipi.map(function (t) { return coloreCollaboratore(t); }), borderRadius: 6, maxBarThickness: 22 }] },
    options: opzioniBase(false, false, false),
  });
  disegna('gr-tipi-euro', {
    type: 'bar',
    data: {
      labels: etichette,
      datasets: [
        { label: 'Fatture emesse', data: d.tipi.map(function (t) { return d.righe[t].fatt; }), backgroundColor: COL_FATTURE, borderRadius: 6, maxBarThickness: 16 },
        { label: 'Incasso', data: d.tipi.map(function (t) { return d.righe[t].inc; }), backgroundColor: COL_INCASSO, borderRadius: 6, maxBarThickness: 16 },
      ].concat(vedeGuadagni() ? [{ label: 'Provento', data: d.tipi.map(function (t) { return d.righe[t].inc - d.righe[t].fatt; }), backgroundColor: COL_GUADAGNO, borderRadius: 6, maxBarThickness: 16 }] : []),
    },
    options: opzioniBase(true, false, true),
  });

  // 5 e 6. Per mese (data di apertura)
  const praticheMese = MESI.map(function () { return 0; });
  const fattMese = MESI.map(function () { return 0; });
  const incMese = MESI.map(function () { return 0; });
  pratAnno.forEach(function (p) {
    const m = meseDi(p);
    if (m < 0) return;
    praticheMese[m] += pesoPratica(p);
    fattMese[m] += Number(p.compenso || 0);
    incMese[m] += Number(p.pagato || 0);
  });
  disegna('gr-mesi', {
    type: 'bar',
    data: { labels: MESI, datasets: [{ label: 'Pratiche', data: praticheMese, backgroundColor: COL_NETTO, borderRadius: 6, maxBarThickness: 28 }] },
    options: opzioniBase(false, false, false),
  });
  disegna('gr-mesi-euro', {
    type: 'bar',
    data: {
      labels: MESI,
      datasets: [
        { label: 'Fatture emesse', data: fattMese, backgroundColor: COL_FATTURE, borderRadius: 6, maxBarThickness: 18 },
        { label: 'Incasso', data: incMese, backgroundColor: COL_INCASSO, borderRadius: 6, maxBarThickness: 18 },
      ],
    },
    options: opzioniBase(true, false, true),
  });

  // 7. Incasso 730 contro altre pratiche
  disegna('gr-730', {
    type: 'doughnut',
    data: {
      labels: ['730', 'Altre pratiche'],
      datasets: [{ data: [sommaCampo(pratAnno.filter(e730), 'pagato'), sommaCampo(pratAnno.filter(function (p) { return !e730(p); }), 'pagato')], backgroundColor: ['#1d4f91', '#9aa3ae'], borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#fff', borderWidth: 2 }],
    },
    options: opzioniCiambella(true),
  });

  // 8. Pratiche lavorate per operatore
  const perOp = {};
  (typeof NOMI_OPERATORI !== 'undefined' ? NOMI_OPERATORI : []).forEach(function (n) { perOp[String(n).toUpperCase()] = { tot: 0, lav: 0 }; });
  pratAnno.forEach(function (p) {
    const chi = (p.inseritoDa || '').toUpperCase();
    if (!chi) return;
    const r = perOp[chi] || (perOp[chi] = { tot: 0, lav: 0 });
    r.tot += pesoPratica(p);
    if (eLavorata(p)) r.lav += pesoPratica(p);
  });
  const operatori = Object.keys(perOp).sort();
  disegna('gr-operatori', {
    type: 'bar',
    data: {
      labels: operatori,
      datasets: [
        { label: 'Inserite', data: operatori.map(function (o) { return perOp[o].tot; }), backgroundColor: '#9aa3ae', borderRadius: 6, maxBarThickness: 40 },
        { label: 'Lavorate', data: operatori.map(function (o) { return perOp[o].lav; }), backgroundColor: COL_FATTURE, borderRadius: 6, maxBarThickness: 40 },
      ],
    },
    options: opzioniBase(false, false, true),
  });

  // 9. Confronto tra anni
  const anni = Array.from(new Set((state.pratiche || []).map(annoPratica))).sort();
  disegna('gr-anni', {
    type: 'bar',
    data: {
      labels: anni.map(String),
      datasets: [
        { label: 'Fatture emesse', data: anni.map(function (a) { return sommaCampo((state.pratiche || []).filter(function (p) { return annoPratica(p) === a; }), 'compenso'); }), backgroundColor: COL_FATTURE, borderRadius: 6, maxBarThickness: 40 },
        { label: 'Incasso', data: anni.map(function (a) { return sommaCampo((state.pratiche || []).filter(function (p) { return annoPratica(p) === a; }), 'pagato'); }), backgroundColor: COL_INCASSO, borderRadius: 6, maxBarThickness: 40 },
      ],
    },
    options: opzioniBase(true, false, true),
  });
}

// Nomi lunghi dei tipi pratica su piu' righe sotto le colonne
function etichettaSuPiuRighe(t) {
  const parole = String(t || '').split(/\s+/);
  const righe = [];
  parole.forEach(function (w) {
    const ultima = righe[righe.length - 1];
    if (ultima && (ultima + ' ' + w).length <= 14) righe[righe.length - 1] = ultima + ' ' + w;
    else righe.push(w);
  });
  return righe;
}
