/* ---------------- Versamenti al CAF Regionale ---------------- */
// Modulo del versamento (fatture dal n. al n., importo versato, POS, fatture/spese pagate per cassa → totale),
// elenco dei versamenti con la stampa del modulo "Trasmissione versamento" del CAF CISL Sicilia
// già compilato e del bollettino postale compilato.

const RIGHE_CASSA = 5;

function datiVersamento() {
  let d = {};
  try { d = JSON.parse(IMPOSTAZIONI.versamento_dati || '{}') || {}; } catch (e) { d = {}; }
  return Object.assign({
    sede: 'ALÌ TERME', sezionale: '', cc: '', intestatario: 'CAF CISL SICILIA SRL',
    eseguito: 'CAF CISL ALÌ TERME', indirizzo: IMPOSTAZIONI.caf_indirizzo || '', cap: '98020', localita: 'ALÌ TERME (ME)',
    causale: 'Versamento fatture sede di Alì Terme'
  }, d);
}

function renderVersamentiCaf(vlist, versatoCaf) {
  const caf = document.getElementById('caf-card');
  if (!caf) return;
  const val = function (id) { const el = document.getElementById(id); return el ? esc(el.value) : ''; };
  const vcData = val('vc-data') || todayIT();
  const cassaRighe = [];
  for (let i = 0; i < RIGHE_CASSA; i++) cassaRighe.push({ d: val('vc-cd' + i), i: val('vc-ci' + i) });
  const campoImp = function (id, v, ph) { return '<input id="' + id + '" type="text" inputmode="decimal" placeholder="' + (ph || '0,00') + '" value="' + v + '" oninput="totaleVersamentoForm()">'; };
  caf.innerHTML = '<div class="raff-title">Versamenti al CAF Regionale</div>'
    + '<div class="grid">'
    + '<div><label>Dalla fattura n.</label><input id="vc-dal" value="' + val('vc-dal') + '" placeholder="Es. 1" inputmode="numeric" oninput="this.value=this.value.replace(/\\D/g,\'\'); suggerimentoVersamento()"></div>'
    + '<div><label>Alla fattura n.</label><input id="vc-al" value="' + val('vc-al') + '" placeholder="Es. 50" inputmode="numeric" oninput="this.value=this.value.replace(/\\D/g,\'\'); suggerimentoVersamento()"></div>'
    + '<div class="full" id="vc-suggerimento" style="font-size:12.5px"></div>'
    + '<div><label>Importo versato (banca / bollettino) €</label>' + campoImp('vc-importo', val('vc-importo')) + '</div>'
    + '<div><label>POS €</label>' + campoImp('vc-pos', val('vc-pos')) + '</div>'
    + '<div class="full"><label>Fatture o spese pagate per cassa</label>'
    + cassaRighe.map(function (r, i) {
      return '<div style="display:flex; gap:6px; margin-bottom:4px"><span style="width:18px; padding-top:9px; color:var(--sub)">' + (i + 1) + '.</span>'
        + '<input id="vc-cd' + i + '" value="' + r.d + '" placeholder="Descrizione (es. fattura n. 12 Enel)" style="flex:1">'
        + '<input id="vc-ci' + i + '" type="text" inputmode="decimal" placeholder="0,00" value="' + r.i + '" oninput="totaleVersamentoForm()" style="width:110px"></div>';
    }).join('') + '</div>'
    + '<div class="full" id="vc-totale" style="font-size:15px"></div>'
    + '<div><label>Data del versamento</label><input id="vc-data" value="' + vcData + '" placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"></div>'
    + '<div><label>Causale</label><input id="vc-causale" placeholder="Facoltativo" value="' + val('vc-causale') + '"></div>'
    + '</div>'
    + '<div style="text-align:left"><button class="btn-add" onclick="aggiungiVersamento()">+ Aggiungi versamento</button></div>'
    + '<div id="caf-msg" style="color:#c0392b; font-size:12px; margin:4px 0 8px; display:none"></div>'
    + (vlist.length ? vlist.map(function (v) {
      const parti = [];
      if (v.versato != null && v.versato !== '') parti.push('versato ' + fmtEuro(v.versato));
      if (Number(v.pos)) parti.push('POS ' + fmtEuro(v.pos));
      if (Number(v.cassa)) parti.push('per cassa ' + fmtEuro(v.cassa));
      return '<div class="caf-row" style="align-items:flex-start">'
        + '<span>' + esc(v.data || '-') + (v.causale ? ' · ' + esc(v.causale) : '')
        + (v.fatturaDal || v.fatturaAl ? '<div class="sub2">🧾 Fatture dal n. ' + esc(v.fatturaDal || '…') + ' al n. ' + esc(v.fatturaAl || '…') + '</div>' : '')
        + (parti.length ? '<div class="sub2">' + parti.join(' · ') + '</div>' : '')
        + '<div style="display:flex; gap:6px; margin-top:4px; flex-wrap:wrap">'
        + '<button type="button" onclick="stampaModuloVersamento(\'' + v.id + '\')" style="padding:3px 10px; font-size:12px; background:#1d4f91; color:#fff; border:none; border-radius:999px">🖨️ Modulo trasmissione</button>'
        + '<button type="button" onclick="stampaBollettino(\'' + v.id + '\')" style="padding:3px 10px; font-size:12px; background:#d98b1e; color:#fff; border:none; border-radius:999px">📮 Bollettino postale</button></div></span>'
        + '<span style="white-space:nowrap">' + fmtEuro(v.importo) + ' <button onclick="rimuoviVersamento(\'' + v.id + '\')" style="background:none;border:none;color:#c0392b;cursor:pointer;font-weight:700;margin-left:6px">✕</button></span></div>';
    }).join('') : '<div class="empty">Nessun versamento registrato</div>')
    + '<div class="caf-tot"><span>Totale versato</span><span>' + fmtEuro(versatoCaf) + '</span></div>'
    + impostazioniVersamentoHTML();
  suggerimentoVersamento();
  totaleVersamentoForm();
}

function letturaFormVersamento() {
  const num = function (id) { const el = document.getElementById(id); const v = el ? parseImporto(el.value) : 0; return v > 0 ? v : 0; };
  const elenco = [];
  for (let i = 0; i < RIGHE_CASSA; i++) {
    const d = (document.getElementById('vc-cd' + i).value || '').trim(), imp = num('vc-ci' + i);
    if (d || imp) elenco.push({ descrizione: d, importo: imp });
  }
  const versato = num('vc-importo'), pos = num('vc-pos');
  const cassa = Math.round(elenco.reduce(function (t, r) { return t + r.importo; }, 0) * 100) / 100;
  return { versato: versato, pos: pos, cassa: cassa, elenco: elenco, totale: Math.round((versato + pos + cassa) * 100) / 100 };
}
function totaleVersamentoForm() {
  const box = document.getElementById('vc-totale');
  if (!box) return;
  const f = letturaFormVersamento();
  box.innerHTML = 'TOTALE (versato + POS + pagate per cassa): <b>' + fmtEuro(f.totale) + '</b>'
    + (f.pos || f.cassa ? ' <span style="color:var(--sub); font-size:12.5px">= ' + fmtEuro(f.versato) + ' + ' + fmtEuro(f.pos) + ' + ' + fmtEuro(f.cassa) + '</span>' : '');
}

function aggiungiVersamento() {
  const msg = document.getElementById('caf-msg');
  if (msg) msg.style.display = 'none';
  const f = letturaFormVersamento();
  const errore = function (t) { if (msg) { msg.textContent = '⚠️ ' + t; msg.style.display = 'block'; } };
  if (!(f.totale > 0)) return errore('Inserisci l\'importo versato (o POS / pagate per cassa), es. 50,00');
  if (f.elenco.some(function (r) { return !r.importo; })) return errore('Nelle fatture o spese pagate per cassa manca un importo');
  const dal = (document.getElementById('vc-dal').value || '').trim(), al = (document.getElementById('vc-al').value || '').trim();
  if (dal && al && Number(dal) > Number(al)) return errore('Il numero "dalla fattura" deve essere più piccolo di "alla fattura"');
  const nuovo = {
    importo: f.totale, versato: f.versato, pos: f.pos, cassa: f.cassa, cassaElenco: f.elenco,
    data: document.getElementById('vc-data').value.trim() || todayIT(),
    causale: document.getElementById('vc-causale').value.trim(),
    fatturaDal: dal, fatturaAl: al,
    operatore: ((auth.profilo && auth.profilo.nome) || '').toUpperCase()
  };
  ['vc-dal', 'vc-al', 'vc-importo', 'vc-pos', 'vc-causale'].forEach(function (id) { document.getElementById(id).value = ''; });
  for (let i = 0; i < RIGHE_CASSA; i++) { document.getElementById('vc-cd' + i).value = ''; document.getElementById('vc-ci' + i).value = ''; }
  document.getElementById('vc-data').value = todayIT();
  document.getElementById('vc-suggerimento').innerHTML = '';
  totaleVersamentoForm();
  data.versamenti.aggiungi(nuovo);
}

/* --- Dati fissi per modulo e bollettino (li imposta l'amministratore) --- */
function impostazioniVersamentoHTML() {
  const d = datiVersamento();
  const admin = auth.profilo && auth.profilo.ruolo === 'admin';
  const campo = function (k, et, ph) { return '<div><label>' + et + '</label><input id="vd-' + k + '" value="' + esc(d[k] || '') + '" placeholder="' + (ph || '') + '"' + (admin ? '' : ' disabled') + '></div>'; };
  return '<details style="margin-top:14px"><summary style="cursor:pointer; font-weight:700; color:var(--sub)">⚙️ Dati per il modulo di trasmissione e il bollettino postale' + (d.cc ? '' : ' <span style="color:#c0392b">(manca il numero di conto corrente)</span>') + '</summary>'
    + '<div class="grid" style="margin-top:8px">'
    + campo('sede', 'Sede') + campo('sezionale', 'Numero sezionale sede', 'Es. 503')
    + campo('cc', 'Bollettino: conto corrente postale n.', 'Es. 12345678') + campo('intestatario', 'Bollettino: intestato a')
    + campo('eseguito', 'Eseguito da') + campo('indirizzo', 'Via / piazza')
    + campo('cap', 'CAP') + campo('localita', 'Località')
    + '<div class="full"><label>Causale predefinita</label><input id="vd-causale" value="' + esc(d.causale || '') + '"' + (admin ? '' : ' disabled') + '></div></div>'
    + (admin ? '<button type="button" class="btn-add" onclick="salvaDatiVersamento()">💾 Salva questi dati</button>' : '<div style="font-size:12px; color:var(--sub)">Li può cambiare solo l\'amministratore.</div>')
    + '</details>';
}
async function salvaDatiVersamento() {
  const d = {};
  ['sede', 'sezionale', 'cc', 'intestatario', 'eseguito', 'indirizzo', 'cap', 'localita', 'causale'].forEach(function (k) { d[k] = (document.getElementById('vd-' + k).value || '').trim(); });
  const valore = JSON.stringify(d);
  const { data: righe, error } = await supabase.from('impostazioni').update({ valore: valore, aggiornato_il: new Date().toISOString() }).eq('chiave', 'versamento_dati').select('chiave');
  if (error || !righe || !righe.length) { avviso('❌ Dati non salvati' + (error ? ': ' + error.message : ''), true); return; }
  IMPOSTAZIONI.versamento_dati = valore;
  avviso('✓ Dati per modulo e bollettino salvati');
  render();
}

/* --- Importo in lettere (come si scrive sul bollettino: "centoventi/50") --- */
function numeroInLettere(n) {
  const u = ['', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
  const d = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];
  const sotto100 = function (x) {
    if (x < 20) return u[x];
    let dec = d[Math.floor(x / 10)], un = x % 10;
    if (un === 1 || un === 8) dec = dec.slice(0, -1);
    return dec + (un === 3 ? 'tré' : u[un]);
  };
  const sotto1000 = function (x) {
    const c = Math.floor(x / 100), r = x % 100;
    let s = c ? (c === 1 ? 'cento' : u[c] + 'cento') : '';
    if (c && ((r >= 80 && r < 90) || r === 8)) s = s.slice(0, -1);
    return s + sotto100(r);
  };
  if (n === 0) return 'zero';
  let s = '';
  const mil = Math.floor(n / 1000000), mig = Math.floor((n % 1000000) / 1000), resto = n % 1000;
  if (mil) s += mil === 1 ? 'unmilione' : sotto1000(mil) + 'milioni';
  if (mig) s += mig === 1 ? 'mille' : sotto1000(mig) + 'mila';
  s += sotto1000(resto);
  return s;
}
function importoInLettere(v) {
  const cent = Math.round(Number(v || 0) * 100);
  return numeroInLettere(Math.floor(cent / 100)) + '/' + String(cent % 100).padStart(2, '0');
}

function finestraStampa(titolo, corpo, stile) {
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
  w.document.open();
  w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>' + titolo + '</title><style>body{font-family:Arial,Helvetica,sans-serif; color:#111; -webkit-print-color-adjust:exact; print-color-adjust:exact} .barra button{padding:8px 16px; margin:0 6px 10px 0} @media print{.barra{display:none}}' + stile + '</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button><button onclick="window.close()">Chiudi</button></div>'
    + corpo + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
  w.document.close();
}
function cercaVersamento(id) { return (state.versamenti || []).find(function (v) { return v.id === id; }); }
function causaleVersamento(v, d) {
  return v.causale || ((d.causale || 'Versamento') + (v.fatturaDal || v.fatturaAl ? ' – fatture dal n. ' + (v.fatturaDal || '…') + ' al n. ' + (v.fatturaAl || '…') : ''));
}

/* --- Modulo "TRASMISSIONE VERSAMENTO" del CAF CISL Sicilia, già compilato --- */
function stampaModuloVersamento(id) {
  const v = cercaVersamento(id);
  if (!v) return;
  const d = datiVersamento();
  const versato = v.versato != null && v.versato !== '' ? Number(v.versato) : Number(v.importo || 0) - Number(v.pos || 0) - Number(v.cassa || 0);
  const elenco = Array.isArray(v.cassaElenco) ? v.cassaElenco : [];
  const righe = [];
  for (let i = 0; i < Math.max(5, elenco.length); i++) {
    const r = elenco[i] || {};
    righe.push('<tr><td style="width:24px">' + (i + 1) + '.</td><td>' + esc(r.descrizione || '') + '</td><td style="width:120px; text-align:right">' + (r.importo ? fmtEuro(r.importo) : '') + '</td></tr>');
  }
  const riga = function (et, val) { return '<tr><th>' + et + '</th><td>' + val + '</td></tr>'; };
  finestraStampa('Trasmissione versamento ' + (v.data || ''),
    '<div class="foglio"><div class="testa"><b>CAF CISL SICILIA</b><br>Piazza Castelnuovo 35 – 90141 Palermo<br>Tel 091/331973 – Fax 091/328708 – e-mail: info@cafcislsicilia.com</div>'
    + '<h1>TRASMISSIONE VERSAMENTO</h1>'
    + '<table class="dati">'
    + riga('SEDE', esc(d.sede)) + riga('OPERATORE', esc(v.operatore || (auth.profilo && auth.profilo.nome) || ''))
    + riga('NUMERO SEZIONALE SEDE', esc(d.sezionale || '')) + riga('DATA', esc(v.data || ''))
    + (v.fatturaDal || v.fatturaAl ? riga('FATTURE', 'dal n. ' + esc(v.fatturaDal || '…') + ' al n. ' + esc(v.fatturaAl || '…')) : '')
    + riga('IMPORTO VERSATO €', fmtEuro(versato)) + riga('POS €', fmtEuro(v.pos || 0)) + riga('FATTURE PAGATE PER CASSA €', fmtEuro(v.cassa || 0))
    + '</table>'
    + '<div class="sotto">Elenco fatture o spese pagate per cassa</div><table class="elenco">' + righe.join('') + '</table>'
    + '<table class="dati" style="margin-top:14px">' + riga('TOTALE €', '<b style="font-size:18px">' + fmtEuro(v.importo) + '</b><div style="font-size:11px">(deve coincidere con la somma dell\'importo versato + POS + fatture pagate per cassa)</div>') + '</table>'
    + '<p class="nota">In allegato devono essere allegati esclusivamente: copia versamento banca, bollettino postale, ricevute POS e le fatture e spese documentate pagate per cassa.</p>'
    + '<div class="firme"><div>Data ' + esc(v.data || '') + '</div><div>Firma ____________________________</div></div></div>',
    '@page{size:A4; margin:14mm} .foglio{max-width:180mm} .testa{text-align:center; font-size:12px; border-bottom:2px solid #1d4f91; padding-bottom:8px} h1{text-align:center; font-size:20px; letter-spacing:.08em; margin:14px 0} table{width:100%; border-collapse:collapse} .dati th{width:42%; text-align:left; background:#eef3fa; font-size:12px} .dati th,.dati td{border:1px solid #9aa8bb; padding:7px 9px; font-size:14px} .sotto{margin:14px 0 4px; font-weight:bold; font-size:13px} .elenco td{border-bottom:1px solid #9aa8bb; padding:8px 6px; font-size:13px; height:18px} .nota{font-size:11px; margin-top:14px} .firme{display:flex; justify-content:space-between; margin-top:40px; font-size:13px}');
}

/* --- Bollettino postale (conto corrente) compilato: ricevuta + attestazione --- */
function stampaBollettino(id) {
  const v = cercaVersamento(id);
  if (!v) return;
  const d = datiVersamento();
  if (!d.cc && !confirm('Non è stato impostato il numero di conto corrente postale (⚙️ Dati per il modulo e il bollettino, in fondo ai versamenti). Stampo lo stesso con lo spazio vuoto?')) return;
  const versato = v.versato != null && v.versato !== '' ? Number(v.versato) : Number(v.importo || 0) - Number(v.pos || 0) - Number(v.cassa || 0);
  const euro = versato.toFixed(2).replace('.', ',');
  const lettere = importoInLettere(versato);
  const causale = causaleVersamento(v, d);
  const parte = function (titolo, larga) {
    return '<div class="parte' + (larga ? ' larga' : '') + '">'
      + '<div class="riga1"><span class="logo">BancoPosta</span><span class="tit">' + titolo + '</span></div>'
      + '<div class="riga2"><span class="et">sul C/C n.</span><span class="box cc">' + esc(d.cc || '') + '</span><span class="et">di Euro</span><span class="box eur">' + euro + '</span></div>'
      + (larga ? '<div class="campo"><span class="et">IMPORTO IN LETTERE</span><span class="val">' + esc(lettere) + '</span></div>' : '')
      + '<div class="campo"><span class="et">INTESTATO A</span><span class="val">' + esc(d.intestatario || '') + '</span></div>'
      + '<div class="campo"><span class="et">CAUSALE</span><span class="val">' + esc(causale) + '</span></div>'
      + '<div class="campo"><span class="et">ESEGUITO DA</span><span class="val">' + esc(d.eseguito || '') + '</span></div>'
      + '<div class="campo"><span class="et">VIA - PIAZZA</span><span class="val">' + esc(d.indirizzo || '') + '</span></div>'
      + '<div class="campo"><span class="et">CAP</span><span class="val" style="flex:0 0 22mm">' + esc(d.cap || '') + '</span><span class="et">LOCALITÀ</span><span class="val">' + esc(d.localita || '') + '</span></div>'
      + '<div class="bollo">BOLLO DELL\'UFFICIO POSTALE</div></div>';
  };
  finestraStampa('Bollettino postale ' + (v.data || ''),
    '<div class="boll">' + parte('RICEVUTA DI VERSAMENTO', false) + parte('CONTI CORRENTI POSTALI – Ricevuta di accredito', true) + '</div>'
    + '<p style="font-size:11px; color:#555; margin-top:6mm">Data ' + esc(v.data || '') + ' · Importo in lettere: ' + esc(lettere) + ' euro</p>',
    '@page{size:A4 landscape; margin:10mm} .boll{display:flex; border:2px solid #1f5fa8; width:270mm; min-height:100mm; font-size:12px} .parte{flex:0 0 90mm; border-right:2px dashed #1f5fa8; padding:4mm; position:relative} .parte.larga{flex:1; border-right:none} .riga1{display:flex; justify-content:space-between; color:#1f5fa8; font-weight:bold; margin-bottom:3mm} .logo{background:#ffd200; color:#1f5fa8; padding:1px 6px; border-radius:3px} .riga2{display:flex; align-items:center; gap:2mm; margin-bottom:3mm; flex-wrap:wrap} .et{font-size:9px; color:#1f5fa8; font-weight:bold; white-space:nowrap} .box{border:1.5px solid #1f5fa8; padding:2px 6px; font-family:Courier New,monospace; font-size:15px; font-weight:bold; min-width:28mm; letter-spacing:2px} .box.eur{min-width:24mm; text-align:right} .campo{display:flex; align-items:flex-end; gap:2mm; border-bottom:1px solid #1f5fa8; padding:2.2mm 0 1mm} .val{flex:1; font-family:Courier New,monospace; font-size:13px; font-weight:bold; text-transform:uppercase} .bollo{position:absolute; right:4mm; bottom:3mm; width:30mm; height:16mm; border:1px dashed #1f5fa8; font-size:7px; color:#1f5fa8; text-align:center; padding-top:1mm}');
}
