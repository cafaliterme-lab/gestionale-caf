/**
 * Finestra STAMPA: si scelgono anno, periodo, tipi pratica, stati, operatore e cliente,
 * poi si genera il file Excel oppure la pagina PDF (si stampa o si salva come PDF).
 */
let STAMPA = null;

function apriStampa(origine) {
  const anno = annoAttivo();
  STAMPA = {
    origine: origine || 'registro',
    anno: anno,
    da: '', a: '',
    riferimento: 'apertura',
    tipi: {}, stati: {},
    operatore: '', cliente: '',
  };
  tipiPerStampa(anno).forEach(function (t) { STAMPA.tipi[t] = true; });
  Object.keys(STATI).forEach(function (k) { STAMPA.stati[k] = true; });
  let ov = document.getElementById('finestra-stampa');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'finestra-stampa';
  ov.style.cssText = 'position:fixed; inset:0; z-index:400; background:rgba(15,27,45,.45); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.addEventListener('click', function (e) { if (e.target === ov) chiudiStampa(); });
  document.body.appendChild(ov);
  disegnaStampa();
}
function chiudiStampa() { const ov = document.getElementById('finestra-stampa'); if (ov) ov.remove(); STAMPA = null; }

function tipiPerStampa(anno) {
  const usati = (state.pratiche || []).filter(function (p) { return annoPratica(p) === anno; }).map(function (p) { return p.tipo || 'SENZA TIPO'; });
  const lista = getTipiList().slice();
  usati.forEach(function (t) { if (lista.indexOf(t) < 0) lista.push(t); });
  return lista;
}
function operatoriPerStampa() {
  const nomi = (typeof NOMI_OPERATORI !== 'undefined' ? NOMI_OPERATORI : []).map(function (n) { return String(n).toUpperCase(); });
  (state.pratiche || []).forEach(function (p) { const n = String(p.inseritoDa || '').toUpperCase(); if (n && nomi.indexOf(n) < 0) nomi.push(n); });
  return nomi.sort();
}
function anniPerStampa() {
  const anni = new Set((state.pratiche || []).map(annoPratica));
  anni.add(annoAttivo());
  return Array.from(anni).sort(function (a, b) { return b - a; });
}
function dataNum(s) { const d = parseDataIT(s); return d ? d.a * 10000 + d.m * 100 + d.g : null; }
function isoNum(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? (+m[1]) * 10000 + (+m[2]) * 100 + (+m[3]) : null; }
function isoIT(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }

function tuttiTipi() { return Object.keys(STAMPA.tipi).every(function (k) { return STAMPA.tipi[k]; }); }
function tuttiStati() { return Object.keys(STAMPA.stati).every(function (k) { return STAMPA.stati[k]; }); }

function praticheFiltrate() {
  const s = STAMPA;
  const da = isoNum(s.da), a = isoNum(s.a);
  const cerca = s.cliente.trim().toUpperCase();
  return (state.pratiche || []).filter(function (p) {
    if (annoPratica(p) !== s.anno) return false;
    if (!s.tipi[p.tipo || 'SENZA TIPO']) return false;
    if (!s.stati[p.stato]) return false;
    if (s.operatore && String(p.inseritoDa || '').toUpperCase() !== s.operatore) return false;
    if (cerca && String(p.nome || '').toUpperCase().indexOf(cerca) < 0 && String(p.codiceFiscale || '').toUpperCase().indexOf(cerca) < 0) return false;
    if (da || a) {
      const d = dataNum(s.riferimento === 'fine' ? p.dataFine : p.data);
      if (d === null) return false;
      if (da && d < da) return false;
      if (a && d > a) return false;
    }
    return true;
  }).sort(function (x, y) { return x.numero - y.numero; });
}

// Pagamenti CAF e netto hanno senso solo sul totale (nessun filtro su tipo, stato, operatore, cliente)
function stampaSuTotale() { return tuttiTipi() && tuttiStati() && !STAMPA.operatore && !STAMPA.cliente.trim(); }
function versamentiFiltrati() {
  const da = isoNum(STAMPA.da), a = isoNum(STAMPA.a);
  return (state.versamenti || []).filter(function (v) {
    if (annoDiData(v.data) !== STAMPA.anno) return false;
    const d = dataNum(v.data);
    if (da && (d === null || d < da)) return false;
    if (a && (d === null || d > a)) return false;
    return true;
  });
}

function descrizioneFiltri() {
  const s = STAMPA;
  const righe = ['Anno di protocollo: ' + s.anno];
  if (s.da || s.a) righe.push('Periodo (' + (s.riferimento === 'fine' ? 'data fine lavorazione' : 'data di apertura') + '): ' + (s.da ? 'dal ' + isoIT(s.da) : '') + (s.da && s.a ? ' ' : '') + (s.a ? 'al ' + isoIT(s.a) : ''));
  else righe.push('Periodo: tutto l\'anno');
  const tipiSi = Object.keys(s.tipi).filter(function (k) { return s.tipi[k]; });
  righe.push('Tipo pratica: ' + (tuttiTipi() ? 'tutti' : tipiSi.join(', ')));
  const statiSi = Object.keys(s.stati).filter(function (k) { return s.stati[k]; });
  righe.push('Stato: ' + (tuttiStati() ? 'tutti' : statiSi.map(statoLabel).join(', ')));
  righe.push('Operatore: ' + (s.operatore || 'tutti'));
  if (s.cliente.trim()) righe.push('Cliente: ' + s.cliente.trim());
  return righe;
}

function riepilogoStampa(lista) {
  const fatt = lista.reduce(function (t, p) { return t + Number(p.compenso || 0); }, 0);
  const inc = lista.reduce(function (t, p) { return t + Number(p.pagato || 0); }, 0);
  const l730 = lista.filter(e730), altre = lista.filter(function (p) { return !e730(p); });
  const voci = [
    ['Pratiche (congiunte valgono 2)', sommaPeso(lista), false],
    ['Fatture emesse', fatt, true],
    ['Incasso totale', inc, true],
    ['Incasso solo 730', l730.reduce(function (t, p) { return t + Number(p.pagato || 0); }, 0), true],
    ['Incasso altre pratiche', altre.reduce(function (t, p) { return t + Number(p.pagato || 0); }, 0), true],
  ];
  if (stampaSuTotale()) {
    const caf = versamentiFiltrati().reduce(function (t, v) { return t + Number(v.importo || 0); }, 0);
    voci.push(['Pagamenti CAF', caf, true]);
    voci.push(['Netto (incasso − pagamenti CAF)', inc - caf, true]);
    if (vedeGuadagni()) voci.push(['Guadagno netto (netto − fatture)', inc - caf - fatt, true]);
  } else if (vedeGuadagni()) {
    voci.push(['Provento (incasso − fatture)', inc - fatt, true]);
  }
  return voci;
}

function gruppiPerTipo(lista) {
  const gruppi = {};
  lista.forEach(function (p) { const k = p.tipo || 'SENZA TIPO'; (gruppi[k] = gruppi[k] || []).push(p); });
  const ordine = tipiPerStampa(STAMPA.anno).filter(function (k) { return gruppi[k]; });
  return ordine.map(function (k) { return { tipo: k, lista: gruppi[k] }; });
}

function disegnaStampa() {
  const ov = document.getElementById('finestra-stampa');
  const s = STAMPA;
  if (!ov || !s) return;
  const n = praticheFiltrate();
  const btn = 'background:var(--line); color:var(--ink); padding:5px 10px; font-size:12px';
  const box = 'max-height:150px; overflow-y:auto; border:1px solid var(--line); border-radius:10px; padding:4px 8px';
  const voce = function (checked, onchange, testo, colore) {
    return '<label style="display:flex; align-items:center; gap:8px; margin:0; padding:4px 0; font-size:13px; color:var(--ink); cursor:pointer">'
      + '<input type="checkbox" style="width:auto" ' + (checked ? 'checked' : '') + ' onchange="' + onchange + '">'
      + (colore ? '<span class="dot" style="background:' + colore + '"></span>' : '') + esc(testo) + '</label>';
  };
  const tipi = Object.keys(s.tipi);
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; max-width:640px; width:100%; max-height:92vh; overflow:auto; padding:18px 20px; box-shadow:0 20px 50px rgba(0,0,0,.3)">'
    + '<div style="font-size:18px; font-weight:800; margin-bottom:2px">🖨️ ' + (s.origine === 'contabilita' ? 'Stampa contabilità' : 'Stampa registro') + '</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:12px">Scegli cosa stampare, poi premi Excel oppure PDF.</div>'

    + '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px">'
    + '<div><label>Anno di protocollo</label><select id="st-anno" onchange="cambiaAnnoStampa(this.value)">'
    + anniPerStampa().map(function (a) { return '<option value="' + a + '"' + (a === s.anno ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select></div>'
    + '<div><label>Dal</label><input id="st-da" type="date" value="' + esc(s.da) + '" onchange="STAMPA.da=this.value; disegnaStampa()"></div>'
    + '<div><label>Al</label><input id="st-a" type="date" value="' + esc(s.a) + '" onchange="STAMPA.a=this.value; disegnaStampa()"></div>'
    + '<div><label>Il periodo vale per</label><select id="st-rif" onchange="STAMPA.riferimento=this.value; disegnaStampa()">'
    + '<option value="apertura"' + (s.riferimento === 'apertura' ? ' selected' : '') + '>Data di apertura</option>'
    + '<option value="fine"' + (s.riferimento === 'fine' ? ' selected' : '') + '>Data fine lavorazione</option></select></div>'
    + '</div>'

    + '<div style="margin-top:12px"><label>Tipo di pratica</label>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px">'
    + '<button type="button" style="' + btn + '" onclick="tipiStampa(\'tutti\')">Tutti</button>'
    + '<button type="button" style="' + btn + '" onclick="tipiStampa(\'730\')">Solo 730</button>'
    + '<button type="button" style="' + btn + '" onclick="tipiStampa(\'altre\')">Solo altre pratiche</button>'
    + '<button type="button" style="' + btn + '" onclick="tipiStampa(\'nessuno\')">Nessuno</button></div>'
    + '<div style="' + box + '">' + tipi.map(function (t, i) { return voce(s.tipi[t], 'STAMPA.tipi[Object.keys(STAMPA.tipi)[' + i + ']]=this.checked; disegnaStampa()', t, coloreCollaboratore(t)); }).join('') + '</div></div>'

    + '<div style="margin-top:12px"><label>Stato</label>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px">'
    + '<button type="button" style="' + btn + '" onclick="statiStampa(true)">Tutti</button>'
    + '<button type="button" style="' + btn + '" onclick="statiStampa(false)">Nessuno</button></div>'
    + '<div style="' + box + '">' + Object.keys(STATI).map(function (k) { return voce(s.stati[k], 'STAMPA.stati[\'' + k + '\']=this.checked; disegnaStampa()', STATI[k].l, STATI[k].c); }).join('') + '</div></div>'

    + '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; margin-top:12px">'
    + '<div><label>Operatore (inserito da)</label><select id="st-op" onchange="STAMPA.operatore=this.value; disegnaStampa()"><option value="">Tutti</option>'
    + operatoriPerStampa().map(function (o) { return '<option value="' + esc(o) + '"' + (o === s.operatore ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></div>'
    + '<div><label>Cliente (cognome e nome)</label><input id="st-cliente" type="text" placeholder="Tutti i clienti" value="' + esc(s.cliente) + '" oninput="STAMPA.cliente=this.value; aggiornaContoStampa()"></div>'
    + '</div>'

    + '<div id="st-conto" style="margin-top:14px; padding:10px 12px; border-radius:10px; background:color-mix(in srgb, var(--accent) 12%, var(--card)); font-weight:700; text-align:center"></div>'
    + '<div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px; flex-wrap:wrap">'
    + '<button type="button" style="background:var(--line); color:var(--ink)" onclick="chiudiStampa()">Annulla</button>'
    + '<button type="button" id="st-excel" style="background:#1d7a46; color:#fff" onclick="stampaExcel()">📊 Excel</button>'
    + '<button type="button" id="st-pdf" style="background:#c0392b; color:#fff" onclick="stampaPDF()">📄 PDF</button></div>'
    + '</div>';
  aggiornaContoStampa(n);
}
function aggiornaContoStampa(lista) {
  const l = lista || praticheFiltrate();
  const el = document.getElementById('st-conto');
  if (el) el.textContent = l.length ? 'Pratiche trovate: ' + sommaPeso(l) + (sommaPeso(l) !== l.length ? ' (' + l.length + ' righe, le congiunte valgono 2)' : '') : 'Nessuna pratica con questi filtri';
  ['st-excel', 'st-pdf'].forEach(function (id) { const b = document.getElementById(id); if (b) { b.disabled = !l.length; b.style.opacity = l.length ? '1' : '.5'; } });
}
function cambiaAnnoStampa(v) {
  STAMPA.anno = parseInt(v, 10);
  const vecchi = STAMPA.tipi;
  STAMPA.tipi = {};
  tipiPerStampa(STAMPA.anno).forEach(function (t) { STAMPA.tipi[t] = vecchi[t] !== false; });
  disegnaStampa();
}
function tipiStampa(modo) {
  Object.keys(STAMPA.tipi).forEach(function (t) {
    const is730 = e730({ tipo: t });
    STAMPA.tipi[t] = modo === 'tutti' || (modo === '730' && is730) || (modo === 'altre' && !is730);
  });
  disegnaStampa();
}
function statiStampa(si) { Object.keys(STAMPA.stati).forEach(function (k) { STAMPA.stati[k] = si; }); disegnaStampa(); }

function nomeFileStampa(est) {
  const pezzi = [STAMPA.origine === 'contabilita' ? 'contabilita' : 'registro-protocollo', STAMPA.anno];
  if (STAMPA.da || STAMPA.a) pezzi.push((STAMPA.da || 'inizio') + '_' + (STAMPA.a || 'fine'));
  return pezzi.join('-') + '-' + dataOraFile() + '.' + est;
}

// Dati del CAF (scheda Messaggi > Dati del CAF) per l'intestazione delle stampe
function datiCafStampa() {
  const imp = (typeof IMPOSTAZIONI !== 'undefined' && IMPOSTAZIONI) || {};
  let orari = '';
  try { orari = testoOrari(leggiTabellaOrari()); } catch (e) {}
  return {
    indirizzo: imp.caf_indirizzo || '',
    telefono: imp.caf_telefono || '',
    email: imp.caf_email || '',
    orari: orari || imp.caf_orari || '',
  };
}

function stampaExcel() {
  if (!window.XLSX) { alert('La libreria per generare il file Excel non si è caricata. Riprova tra poco.'); return; }
  const lista = praticheFiltrate();
  if (!lista.length) return;
  const caf = datiCafStampa();
  const righe = [{ 'Voce': 'CAF CISL – Sede di Alì Terme', 'Valore': '' }];
  if (caf.indirizzo) righe.push({ 'Voce': 'Indirizzo', 'Valore': caf.indirizzo });
  if (caf.telefono) righe.push({ 'Voce': 'Telefono', 'Valore': caf.telefono });
  if (caf.email) righe.push({ 'Voce': 'Email', 'Valore': caf.email });
  if (caf.orari) righe.push({ 'Voce': 'Orari di apertura', 'Valore': caf.orari });
  righe.push({ 'Voce': '', 'Valore': '' }, { 'Voce': 'FILTRI DI STAMPA', 'Valore': '' });
  descrizioneFiltri().forEach(function (r) { const i = r.indexOf(': '); righe.push({ 'Voce': r.slice(0, i), 'Valore': r.slice(i + 2) }); });
  righe.push({ 'Voce': '', 'Valore': '' }, { 'Voce': 'RIEPILOGO', 'Valore': '' });
  riepilogoStampa(lista).forEach(function (v) { righe.push({ 'Voce': v[0] + (v[2] ? ' (€)' : ''), 'Valore': v[2] ? Math.round(v[1] * 100) / 100 : v[1] }); });
  righe.push({ 'Voce': '', 'Valore': '' }, { 'Voce': 'DETTAGLIO PER TIPO PRATICA', 'Valore': '' });
  const gruppi = gruppiPerTipo(lista);
  gruppi.forEach(function (g) {
    const fe = g.lista.reduce(function (t, p) { return t + Number(p.compenso || 0); }, 0);
    const inc = g.lista.reduce(function (t, p) { return t + Number(p.pagato || 0); }, 0);
    righe.push({ 'Voce': g.tipo + ' (' + sommaPeso(g.lista) + ' pratiche)', 'Valore': 'Fatture ' + fmtEuro(fe) + ' · Incasso ' + fmtEuro(inc) });
  });

  const wb = XLSX.utils.book_new();
  const wsRiep = XLSX.utils.json_to_sheet(righe);
  wsRiep['!cols'] = [{ wch: 42 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsRiep, 'Riepilogo');
  const elenco = lista.map(function (p) { const r = rigaPratica(p); return Object.assign({ 'N. Protocollo': r['N. Protocollo'], 'Tipo pratica': p.tipo || '' }, r); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(elenco), 'Elenco completo');
  const usati = {};
  gruppi.forEach(function (g) {
    let nome = nomeFoglio(g.tipo);
    while (usati[nome.toUpperCase()] || nome.toUpperCase() === 'RIEPILOGO' || nome.toUpperCase() === 'ELENCO COMPLETO') nome = nome.slice(0, 28) + '_' + (Object.keys(usati).length + 1);
    usati[nome.toUpperCase()] = true;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(g.lista.map(rigaPratica)), nome);
  });
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFileStampa('xlsx');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  if (typeof avviso === 'function') avviso('📊 File Excel scaricato');
}

function stampaPDF() {
  const lista = praticheFiltrate();
  if (!lista.length) return;
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito e riprova.'); return; }
  const logo = document.querySelector('.hero-logo');
  const titolo = STAMPA.origine === 'contabilita' ? 'Contabilità' : 'Registro di protocollo';
  const voci = riepilogoStampa(lista);
  const caf = datiCafStampa();
  const colonne = ['Protocollo', 'Apertura', 'Fine lav. / Scad.', 'Cognome e Nome', 'Stato', 'Fattura', 'Pagato', 'Operatore'];
  let corpo = '';
  let totF = 0, totI = 0;
  gruppiPerTipo(lista).forEach(function (g) {
    const fe = g.lista.reduce(function (t, p) { return t + Number(p.compenso || 0); }, 0);
    const inc = g.lista.reduce(function (t, p) { return t + Number(p.pagato || 0); }, 0);
    totF += fe; totI += inc;
    corpo += '<tr class="gruppo"><td colspan="8"><span class="pall" style="background:' + coloreCollaboratore(g.tipo) + '"></span>' + esc(g.tipo) + ' · ' + sommaPeso(g.lista) + ' pratiche</td></tr>';
    g.lista.forEach(function (p) {
      corpo += '<tr><td>' + esc(formattaProtocollo(p)) + '</td><td>' + esc(p.data || '') + '</td><td>' + esc(eColf(p.tipo) ? (p.scadenzaAssistenza || '') : (p.dataFine || '')) + '</td>'
        + '<td>' + esc(p.nome || '') + (p.congiunta ? '<div class="sub">+ ' + esc(p.congiunta) + '</div>' : '') + '</td>'
        + '<td>' + esc(statoLabel(p.stato)) + '</td><td class="num">' + fmtEuro(p.compenso) + '</td><td class="num">' + fmtEuro(p.pagato) + '</td><td>' + esc(p.inseritoDa || '') + '</td></tr>';
    });
    corpo += '<tr class="subtot"><td colspan="5">Totale ' + esc(g.tipo) + '</td><td class="num">' + fmtEuro(fe) + '</td><td class="num">' + fmtEuro(inc) + '</td><td></td></tr>';
  });
  corpo += '<tr class="tot"><td colspan="5">TOTALE GENERALE · ' + sommaPeso(lista) + ' pratiche</td><td class="num">' + fmtEuro(totF) + '</td><td class="num">' + fmtEuro(totI) + '</td><td></td></tr>';

  const html = '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(titolo + ' ' + STAMPA.anno) + '</title><style>'
    + '@page{size:A4 landscape; margin:12mm}'
    + 'body{font-family:Arial,Helvetica,sans-serif; color:#0f1b2d; background:#fff; margin:0; padding:16px; font-size:11px}'
    + '.testa{display:flex; align-items:center; gap:16px; padding:14px 18px; margin-bottom:12px; border-radius:12px; color:#fff; background:linear-gradient(110deg,#0f3a73 0%,#1d4f91 45%,#2f7de1 100%); border-bottom:5px solid #e30613}'
    + '.testa .logo{background:#fff; border-radius:50%; width:64px; height:64px; display:flex; align-items:center; justify-content:center; flex:0 0 auto; box-shadow:0 2px 6px rgba(0,0,0,.25)}'
    + '.testa img{width:52px; height:auto}.testa h1{font-size:19px; margin:0; letter-spacing:.3px}.testa .sub2{display:inline-block; font-size:11px; margin-top:5px; padding:2px 10px; border-radius:999px; background:rgba(255,255,255,.2); font-weight:700}'
    + '.testa .caf{margin-left:auto; text-align:right; font-size:10.5px; line-height:1.55; max-width:48%}.testa .caf b{font-weight:700}'
    + '.filtri{font-size:10.5px; color:#334; margin-bottom:10px; line-height:1.5}'
    + '.riep{display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px}.riep div{border:1px solid #cfd8e3; border-radius:8px; padding:6px 10px; min-width:120px}'
    + '.riep b{display:block; font-size:13px; margin-top:2px}'
    + 'table{width:100%; border-collapse:collapse}th,td{border:1px solid #cfd8e3; padding:4px 6px; text-align:left; vertical-align:top}'
    + 'th{background:#1d4f91; color:#fff; font-size:10.5px}thead{display:table-header-group}tr{page-break-inside:avoid}'
    + '.num{text-align:right; white-space:nowrap}.sub{font-size:9.5px; color:#5b6b82}'
    + '.gruppo td{background:#eef3fa; font-weight:700; font-size:11.5px}.subtot td{background:#f7f9fc; font-weight:700}'
    + '.tot td{background:#1d4f91; color:#fff; font-weight:800; font-size:12px}'
    + '.pall{display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:6px}'
    + '.barra{position:sticky; top:0; background:#fff; padding:8px 0 12px; display:flex; gap:8px}.barra button{font-size:14px; padding:8px 16px; border:none; border-radius:999px; background:#c0392b; color:#fff; cursor:pointer}'
    + '.barra button.chiudi{background:#e3e8ef; color:#0f1b2d}'
    + '*{-webkit-print-color-adjust:exact; print-color-adjust:exact}@media print{.barra{display:none} body{padding:0}}'
    + '</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button><button class="chiudi" onclick="window.close()">Chiudi</button></div>'
    + '<div class="testa">' + (logo ? '<div class="logo"><img src="' + logo.src + '" alt=""></div>' : '') + '<div><h1>CAF CISL – Sede di Alì Terme</h1><div class="sub2">' + esc(titolo) + ' ' + STAMPA.anno + ' · stampato il ' + esc(todayIT()) + '</div></div>'
    + '<div class="caf">' + [caf.indirizzo ? '📍 ' + esc(caf.indirizzo) : '', caf.telefono ? '📞 ' + esc(caf.telefono) : '', caf.email ? '✉️ ' + esc(caf.email) : '', caf.orari ? '🕘 <b>Orari:</b> ' + esc(caf.orari) : ''].filter(Boolean).join('<br>') + '</div></div>'
    + '<div class="filtri">' + descrizioneFiltri().map(esc).join('<br>') + '</div>'
    + '<div class="riep">' + voci.map(function (v) { return '<div>' + esc(v[0]) + '<b>' + (v[2] ? fmtEuro(v[1]) : v[1]) + '</b></div>'; }).join('') + '</div>'
    + '<table><thead><tr>' + colonne.map(function (c, i) { return '<th' + (i === 5 || i === 6 ? ' class="num"' : '') + '>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + corpo + '</tbody></table>'
    + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>'
    + '</body></html>';
  w.document.open();
  w.document.write(html);
  w.document.close();
}
