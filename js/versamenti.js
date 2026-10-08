/* ---------------- Versamenti al CAF Regionale ---------------- */
// Modulo del versamento (fatture dal n. al n., importo versato, POS, fatture/spese pagate per cassa → totale),
// elenco dei versamenti con la stampa del modulo "Trasmissione versamento" del CAF CISL Sicilia
// già compilato e del bollettino postale compilato.

const RIGHE_CASSA = 5;
let BON_N = 3;        // righe dei bonifici mostrate (aumentano con "+ riga" o prendendo dalle pratiche)
let VC_BON = [];      // per ogni riga dei bonifici: { praticaId, fattura } se presa dalle pratiche
let VC_ULTIMO = null; // ultimi dati del disegno, per ridisegnare il modulo con più righe
let VC_SPESE = [];   // per ogni riga delle spese: id della spesa sede scelta (se presa dall'elenco)

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
  VC_ULTIMO = [vlist, versatoCaf];
  const val = function (id) { const el = document.getElementById(id); return el ? esc(el.value) : ''; };
  const vcData = val('vc-data') || todayIT();
  const cassaRighe = [];
  for (let i = 0; i < RIGHE_CASSA; i++) cassaRighe.push({ d: val('vc-cd' + i), i: val('vc-ci' + i) });
  const bonRighe = [];
  for (let i = 0; i < BON_N; i++) bonRighe.push({ n: val('vc-bn' + i), d: val('vc-bd' + i), i: val('vc-bi' + i) });
  const campoImp = function (id, v, ph) { return '<input id="' + id + '" type="text" inputmode="decimal" placeholder="' + (ph || '0,00') + '" value="' + v + '" oninput="totaleVersamentoForm()">'; };
  caf.innerHTML = '<div class="raff-title">Versamenti al CAF Regionale</div>'
    + '<div class="grid">'
    + '<div><label>Dalla fattura n.</label><input id="vc-dal" value="' + val('vc-dal') + '" placeholder="Es. 1" inputmode="numeric" oninput="this.value=this.value.replace(/\\D/g,\'\'); suggerimentoVersamento()"></div>'
    + '<div><label>Alla fattura n.</label><input id="vc-al" value="' + val('vc-al') + '" placeholder="Es. 50" inputmode="numeric" oninput="this.value=this.value.replace(/\\D/g,\'\'); suggerimentoVersamento()"></div>'
    + '<div class="full" id="vc-suggerimento" style="font-size:12.5px"></div>'
    + '<div class="full"><label>Importo delle fatture €</label>' + campoImp('vc-importo', val('vc-importo')) + '</div>'
    + '<div class="full"><div style="display:flex; justify-content:space-between; align-items:flex-end; gap:8px; flex-wrap:wrap"><label style="margin:0">Spese pagate per conto del CAF da detrarre (condominio, TARI, acqua…)</label>'
    + '<button type="button" onclick="scegliSpeseDaDetrarre()" style="padding:4px 12px; font-size:12.5px; background:#a0522d; color:#fff; border:none; border-radius:999px; font-weight:700; margin-bottom:4px">📥 Prendi da Spese sede</button></div>'
    + cassaRighe.map(function (r, i) {
      return '<div style="display:flex; gap:6px; margin-bottom:4px"><span style="width:18px; padding-top:9px; color:var(--sub)">' + (i + 1) + '.</span>'
        + '<input id="vc-cd' + i + '" value="' + r.d + '" oninput="VC_SPESE[' + i + ']=null" placeholder="Descrizione (es. TARI 2026, condominio settembre)" style="flex:1">'
        + '<input id="vc-ci' + i + '" type="text" inputmode="decimal" placeholder="0,00" value="' + r.i + '" oninput="totaleVersamentoForm()" style="width:110px"></div>';
    }).join('') + '</div>'
    + '<div class="full"><div style="display:flex; justify-content:space-between; align-items:flex-end; gap:8px; flex-wrap:wrap"><label style="margin:0">Pagamenti ricevuti con bonifico da detrarre (uno per riga: chi l\'ha fatto, data, importo)</label>'
    + '<button type="button" onclick="scegliBonificiDaPratiche()" style="padding:4px 12px; font-size:12.5px; background:#2f7de1; color:#fff; border:none; border-radius:999px; font-weight:700; margin-bottom:4px">📥 Prendi dalle pratiche pagate con bonifico</button></div>'
    + bonRighe.map(function (r, i) {
      return '<div style="display:flex; gap:6px; margin-bottom:4px; flex-wrap:wrap"><span style="width:18px; padding-top:9px; color:var(--sub)">' + (i + 1) + '.</span>'
        + '<input id="vc-bn' + i + '" value="' + r.n + '" oninput="VC_BON[' + i + ']=null" placeholder="Chi ha fatto il bonifico (es. Rossi Mario)" style="flex:1; min-width:150px">'
        + '<input id="vc-bd' + i + '" value="' + r.d + '" placeholder="Data" inputmode="numeric" oninput="autoSlashData(this)" style="width:105px">'
        + '<input id="vc-bi' + i + '" type="text" inputmode="decimal" placeholder="0,00" value="' + r.i + '" oninput="totaleVersamentoForm()" style="width:110px"></div>';
    }).join('') + '<button type="button" onclick="BON_N++; ridisegnaVersamentiCaf()" style="padding:3px 12px; font-size:12.5px; background:none; border:1px dashed #2f7de1; color:#2f7de1; border-radius:999px">+ Aggiungi riga</button></div>'
    + '<div class="full" id="vc-totale" style="font-size:15px"></div>'
    + '<div><label>Data del versamento</label><input id="vc-data" value="' + vcData + '" placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"></div>'
    + '<div><label>Causale</label><input id="vc-causale" placeholder="Facoltativo" value="' + val('vc-causale') + '"></div>'
    + '</div>'
    + '<div style="text-align:left"><button class="btn-add" onclick="aggiungiVersamento()">+ Aggiungi versamento</button></div>'
    + '<div id="caf-msg" style="color:#c0392b; font-size:12px; margin:4px 0 8px; display:none"></div>'
    + (vlist.length ? vlist.map(function (v) {
      const parti = [];
      if (Number(v.cassa) || Number(v.bonifico)) parti.push('fatture ' + fmtEuro(v.importo) + (Number(v.cassa) ? ' − spese ' + fmtEuro(v.cassa) : '') + (Number(v.bonifico) ? ' − bonifici ' + fmtEuro(v.bonifico) : '') + ' = versato ' + fmtEuro(v.versato));
      return '<div class="caf-row" style="align-items:flex-start">'
        + '<span>' + esc(v.data || '-') + (v.causale ? ' · ' + esc(v.causale) : '')
        + (v.fatturaDal || v.fatturaAl ? '<div class="sub2">🧾 Fatture dal n. ' + esc(v.fatturaDal || '…') + ' al n. ' + esc(v.fatturaAl || '…') + '</div>' : '')
        + (parti.length ? '<div class="sub2">' + parti.join(' · ') + '</div>' : '')
        + (Array.isArray(v.bonificiElenco) && v.bonificiElenco.length ? '<div class="sub2">🏦 Bonifici: ' + v.bonificiElenco.map(function (r) { return esc(r.nome || '') + (r.data ? ' (' + esc(r.data) + ')' : '') + ' ' + fmtEuro(r.importo); }).join(' · ') + '</div>' : '')
        + '<div style="display:flex; gap:6px; margin-top:4px; flex-wrap:wrap">'
        + '<button type="button" onclick="stampaModuloVersamento(\'' + v.id + '\')" style="padding:3px 10px; font-size:12px; background:#1d4f91; color:#fff; border:none; border-radius:999px">🖨️ Modulo trasmissione</button>'
        + '<button type="button" onclick="stampaBollettino(\'' + v.id + '\')" style="padding:3px 10px; font-size:12px; background:#d98b1e; color:#fff; border:none; border-radius:999px">📮 Bollettino postale</button></div></span>'
        + '<span style="white-space:nowrap; text-align:right"><b>' + fmtEuro(v.importo) + '</b>'
        + (puoEliminareVersamenti() ? '<div><button type="button" onclick="rimuoviVersamento(\'' + v.id + '\')" title="Elimina questo versamento" style="margin-top:4px; padding:3px 10px; font-size:12px; background:#fdecea; color:#c0392b; border:1px solid #c0392b; border-radius:999px; font-weight:700; cursor:pointer">🗑️ Elimina</button></div>' : '')
        + '</span></div>';
    }).join('') : '<div class="empty">Nessun versamento registrato</div>')
    + '<div class="caf-tot"><span>Totale versato</span><span>' + fmtEuro(versatoCaf) + '</span></div>'
    + impostazioniVersamentoHTML();
  suggerimentoVersamento();
  totaleVersamentoForm();
}

// Spese della sede già detratte in un versamento (si possono usare di nuovo: serve solo per ricordarlo)
function speseGiaDetratte() {
  const m = {};
  (state.versamenti || []).forEach(function (v) { (Array.isArray(v.cassaElenco) ? v.cassaElenco : []).forEach(function (r) { if (r.spesaId) m[r.spesaId] = v; }); });
  return m;
}
function scegliSpeseDaDetrarre() {
  const usate = speseGiaDetratte();
  const lista = (state.speseSede || []).slice()
    .sort(function (a, b) { return (dataNum(b.data) || 0) - (dataNum(a.data) || 0); });
  if (!lista.length) { avviso('Non ci sono spese registrate in SPESE SEDE'); return; }
  const vecchio = document.getElementById('popup-spese-vers'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-spese-vers';
  ov.style.cssText = 'position:fixed; inset:0; z-index:470; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #a0522d; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:18px 20px; max-width:560px; width:100%; max-height:90vh; display:flex; flex-direction:column">'
    + '<div style="font-size:18px; font-weight:800; color:#a0522d">📥 Spese della sede da detrarre</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin:2px 0 10px">Spunta le spese pagate per conto del CAF (al massimo ' + RIGHE_CASSA + ' righe). Una spesa si può usare anche più volte: se è già stata detratta lo vedi scritto accanto.</div>'
    + '<div style="overflow:auto; flex:1; border:1px solid var(--line); border-radius:10px">' + lista.map(function (sp) {
      return '<label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid var(--line); margin:0; cursor:pointer"><input type="checkbox" class="spv-chk" value="' + sp.id + '" style="width:auto; margin:0">'
        + '<span style="flex:1">' + esc(sp.data || '') + ' · <b>' + esc(sp.categoria || '') + '</b>' + (sp.descrizione ? ' · ' + esc(sp.descrizione) : '')
        + (usate[sp.id] ? '<div style="font-size:11.5px; color:#1d4f91">🏦 già detratta nel versamento del ' + esc(usate[sp.id].data || '') + '</div>' : '') + '</span><b>' + fmtEuro(sp.importo) + '</b></label>';
    }).join('') + '</div>'
    + '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px"><button type="button" data-azione="no" style="background:var(--line); color:var(--ink)">Annulla</button><button type="button" data-azione="si" style="background:#a0522d; color:#fff; font-weight:800">Aggiungi al versamento</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function (e) {
    const b = e.target.closest('button[data-azione]');
    if (!b && e.target !== ov) return;
    if (!b || b.dataset.azione === 'no') { ov.remove(); return; }
    const scelte = Array.from(ov.querySelectorAll('.spv-chk')).filter(function (c) { return c.checked; }).map(function (c) { return lista.find(function (sp) { return sp.id === c.value; }); });
    const libere = [];
    for (let i = 0; i < RIGHE_CASSA; i++) if (!document.getElementById('vc-cd' + i).value.trim() && !document.getElementById('vc-ci' + i).value.trim()) libere.push(i);
    if (scelte.length > libere.length) { alert('Ci sono solo ' + libere.length + ' righe libere: togli qualche spunta.'); return; }
    scelte.forEach(function (sp, k) {
      const i = libere[k];
      document.getElementById('vc-cd' + i).value = (sp.categoria || '') + (sp.descrizione ? ' – ' + sp.descrizione : '') + ' (' + (sp.data || '') + ')';
      document.getElementById('vc-ci' + i).value = Number(sp.importo || 0).toFixed(2).replace('.', ',');
      VC_SPESE[i] = sp.id;
    });
    ov.remove();
    totaleVersamentoForm();
  });
}
function ridisegnaVersamentiCaf() { if (VC_ULTIMO) renderVersamentiCaf(VC_ULTIMO[0], VC_ULTIMO[1]); }

// Bonifici presi dalle pratiche: quelle con pagamento "BONIFICO" (anno di protocollo attivo)
function bonificiGiaDetratti() {
  const m = {};
  (state.versamenti || []).forEach(function (v) { (Array.isArray(v.bonificiElenco) ? v.bonificiElenco : []).forEach(function (r) { if (r.praticaId) m[r.praticaId] = v; }); });
  return m;
}
function scegliBonificiDaPratiche() {
  const anno = typeof annoAttivo === 'function' ? annoAttivo() : null;
  const nFatt = function (p) { return typeof numeroFatturaPratica === 'function' ? numeroFatturaPratica(p) : null; };
  const tutte = (state.pratiche || []).filter(function (p) {
    return !p.annullata && p.metodoPagamento === 'BONIFICO' && Number(p.pagato || 0) > 0 && (!anno || typeof annoPratica !== 'function' || annoPratica(p) === anno);
  }).sort(function (a, b) { return ((nFatt(a) || 1e9) - (nFatt(b) || 1e9)) || String(a.nome || '').localeCompare(String(b.nome || '')); });
  if (!tutte.length) { avviso('Non ci sono pratiche pagate con bonifico' + (anno ? ' nel ' + anno : '')); return; }
  const usati = bonificiGiaDetratti();
  const giaNelModulo = VC_BON.filter(Boolean).map(function (b) { return b.praticaId; });
  const dal = parseInt((document.getElementById('vc-dal') || {}).value, 10), al = parseInt((document.getElementById('vc-al') || {}).value, 10);
  const conRange = dal > 0 && al > 0 && dal <= al;
  const vecchio = document.getElementById('popup-bon-vers'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-bon-vers';
  ov.style.cssText = 'position:fixed; inset:0; z-index:470; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #2f7de1; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:18px 20px; max-width:600px; width:100%; max-height:90vh; display:flex; flex-direction:column">'
    + '<div style="font-size:18px; font-weight:800; color:#2f7de1">📥 Pratiche pagate con bonifico</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin:2px 0 8px">Spunta i bonifici da detrarre: per ognuno vengono scritti il nome, la data della fattura e l\'importo pagato. Accanto vedi se un bonifico è già stato detratto in un altro versamento.</div>'
    + '<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:8px">'
    + '<input id="bonp-cerca" type="search" placeholder="Cerca per nome o numero di fattura…" style="flex:1; min-width:180px">'
    + (conRange ? '<label class="chk" style="font-size:13px; white-space:nowrap"><input type="checkbox" id="bonp-range" checked> Solo fatture dal n. ' + dal + ' al n. ' + al + ' (e quelle senza numero)</label>' : '')
    + '<label class="chk" style="font-size:13px; white-space:nowrap"><input type="checkbox" id="bonp-nuovi" checked> Nascondi quelli già detratti</label></div>'
    + '<div id="bonp-lista" style="overflow:auto; flex:1; border:1px solid var(--line); border-radius:10px"></div>'
    + '<div style="display:flex; gap:8px; justify-content:space-between; align-items:center; margin-top:12px; flex-wrap:wrap"><span id="bonp-tot" style="font-size:13px; font-weight:700"></span>'
    + '<span style="display:flex; gap:8px; flex-wrap:wrap"><button type="button" data-azione="tutti" style="background:var(--line); color:var(--ink)">Spunta tutti</button><button type="button" data-azione="no" style="background:var(--line); color:var(--ink)">Annulla</button><button type="button" data-azione="si" style="background:#2f7de1; color:#fff; font-weight:800">Aggiungi al versamento</button></span></div></div>';
  document.body.appendChild(ov);
  const scelti = {};
  const filtrate = function () {
    const q = (document.getElementById('bonp-cerca').value || '').trim().toUpperCase();
    const soloRange = conRange && document.getElementById('bonp-range').checked;
    const soloNuovi = document.getElementById('bonp-nuovi').checked;
    return tutte.filter(function (p) {
      const n = nFatt(p);
      if (soloRange && n != null && !(n >= dal && n <= al)) return false;   // quelle ancora senza numero di fattura restano
      if (soloNuovi && (usati[p.id] || giaNelModulo.indexOf(p.id) >= 0)) return false;
      return !q || String(p.nome || '').toUpperCase().indexOf(q) >= 0 || String(p.numFattura || '').toUpperCase().indexOf(q) >= 0;
    });
  };
  const disegna = function () {
    const lista = filtrate();
    document.getElementById('bonp-lista').innerHTML = lista.length ? lista.map(function (p) {
      return '<label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid var(--line); margin:0; cursor:pointer"><input type="checkbox" class="bonp-chk" value="' + p.id + '"' + (scelti[p.id] ? ' checked' : '') + ' style="width:auto; margin:0">'
        + '<span style="flex:1"><b>' + esc(p.nome || '') + '</b><div style="font-size:12px; color:var(--sub)">' + (p.numFattura ? 'Fattura n. ' + esc(p.numFattura) : 'Senza numero di fattura') + ((p.dataFattura || p.data) ? ' · ' + esc(p.dataFattura || p.data) : '') + (p.tipo ? ' · ' + esc(p.tipo) : '') + '</div>'
        + (usati[p.id] ? '<div style="font-size:11.5px; color:#c0392b">🏦 già detratto nel versamento del ' + esc(usati[p.id].data || '') + '</div>' : '')
        + (giaNelModulo.indexOf(p.id) >= 0 ? '<div style="font-size:11.5px; color:#c0392b">già nelle righe del versamento</div>' : '') + '</span><b>' + fmtEuro(p.pagato) + '</b></label>';
    }).join('') : '<div class="empty" style="padding:14px">Nessuna pratica con questi filtri' + (tutte.length ? ' (le pratiche pagate con bonifico sono ' + tutte.length + ': togli le spunte qui sopra per vederle)' : '') + '</div>';
    const ids = Object.keys(scelti).filter(function (k) { return scelti[k]; });
    const tot = ids.reduce(function (t, id) { const p = tutte.find(function (x) { return x.id === id; }); return t + Number((p && p.pagato) || 0); }, 0);
    document.getElementById('bonp-tot').textContent = ids.length ? 'Scelti ' + ids.length + ' · totale ' + fmtEuro(tot) : '';
  };
  disegna();
  ov.addEventListener('input', function (e) { if (e.target.id === 'bonp-cerca') disegna(); });
  ov.addEventListener('change', function (e) {
    if (e.target.classList.contains('bonp-chk')) { scelti[e.target.value] = e.target.checked; disegna(); }
    else if (e.target.id === 'bonp-range' || e.target.id === 'bonp-nuovi') disegna();
  });
  ov.addEventListener('click', function (e) {
    const b = e.target.closest('button[data-azione]');
    if (!b && e.target !== ov) return;
    if (!b || b.dataset.azione === 'no') { ov.remove(); return; }
    if (b.dataset.azione === 'tutti') { filtrate().forEach(function (p) { scelti[p.id] = true; }); disegna(); return; }
    const scelte = tutte.filter(function (p) { return scelti[p.id]; });
    if (!scelte.length) { alert('Spunta almeno un bonifico.'); return; }
    // righe libere (se non bastano se ne aggiungono)
    const libere = [];
    for (let i = 0; i < BON_N; i++) {
      const n = document.getElementById('vc-bn' + i), im = document.getElementById('vc-bi' + i);
      if (n && !n.value.trim() && !im.value.trim()) libere.push(i);
    }
    let prossima = BON_N;
    while (libere.length < scelte.length) libere.push(prossima++);
    BON_N = Math.max(BON_N, prossima);
    ridisegnaVersamentiCaf();
    scelte.forEach(function (p, k) {
      const i = libere[k];
      document.getElementById('vc-bn' + i).value = p.nome || '';
      document.getElementById('vc-bd' + i).value = p.dataFattura || p.data || '';
      document.getElementById('vc-bi' + i).value = Number(p.pagato || 0).toFixed(2).replace('.', ',');
      VC_BON[i] = { praticaId: p.id, fattura: p.numFattura || '' };
    });
    ov.remove();
    totaleVersamentoForm();
    avviso('✓ ' + scelte.length + (scelte.length === 1 ? ' bonifico aggiunto' : ' bonifici aggiunti'));
  });
}

// Eliminazione di un versamento: amministratore e operatori che possono scrivere nei Versamenti CAF, con conferma
function puoEliminareVersamenti() { return typeof puo === 'function' ? puo('caf', true) : !!(auth.profilo && auth.profilo.ruolo === 'admin'); }
async function rimuoviVersamento(id) {
  if (!puoEliminareVersamenti()) { avviso('❌ Non hai il permesso di eliminare i versamenti', true); return; }
  const v = cercaVersamento(id);
  if (!v) return;
  if (!confirm('Eliminare il versamento del ' + (v.data || '') + ' di ' + fmtEuro(v.importo) + (v.fatturaDal || v.fatturaAl ? ' (fatture dal n. ' + (v.fatturaDal || '…') + ' al n. ' + (v.fatturaAl || '…') + ')' : '') + '?\n\nL\'operazione non si può annullare.')) return;
  const r = await data.versamenti.elimina(id);
  if (r && r.error) return;
  avviso('🗑️ Versamento eliminato');
}
function letturaFormVersamento() {
  const num = function (id) { const el = document.getElementById(id); const v = el ? parseImporto(el.value) : 0; return v > 0 ? v : 0; };
  const elenco = [];
  for (let i = 0; i < RIGHE_CASSA; i++) {
    const d = (document.getElementById('vc-cd' + i).value || '').trim(), imp = num('vc-ci' + i);
    if (d || imp) elenco.push(VC_SPESE[i] ? { descrizione: d, importo: imp, spesaId: VC_SPESE[i] } : { descrizione: d, importo: imp });
  }
  // importo delle fatture − spese pagate per conto del CAF = quanto si versa col bollettino
  const fatture = num('vc-importo');
  const cassa = Math.round(elenco.reduce(function (t, r) { return t + r.importo; }, 0) * 100) / 100;
  const bonifici = [];
  for (let i = 0; i < BON_N; i++) {
    const el = document.getElementById('vc-bn' + i);
    if (!el) continue;
    const n = (el.value || '').trim(), dt = (document.getElementById('vc-bd' + i).value || '').trim(), imp = num('vc-bi' + i);
    if (n || dt || imp) bonifici.push(VC_BON[i] ? { nome: n, data: dt, importo: imp, praticaId: VC_BON[i].praticaId, fattura: VC_BON[i].fattura } : { nome: n, data: dt, importo: imp });
  }
  const bonifico = Math.round(bonifici.reduce(function (t, r) { return t + r.importo; }, 0) * 100) / 100;
  return { totale: fatture, cassa: cassa, elenco: elenco, bonifico: bonifico, bonifici: bonifici, versato: Math.round((fatture - cassa - bonifico) * 100) / 100, pos: 0 };
}
function totaleVersamentoForm() {
  const box = document.getElementById('vc-totale');
  if (!box) return;
  const f = letturaFormVersamento();
  box.innerHTML = 'DA VERSARE (bollettino): <b style="color:' + (f.versato < 0 ? '#c0392b' : 'inherit') + '">' + fmtEuro(f.versato) + '</b>'
    + (f.cassa || f.bonifico ? ' <span style="color:var(--sub); font-size:12.5px">= fatture ' + fmtEuro(f.totale) + (f.cassa ? ' − spese ' + fmtEuro(f.cassa) : '') + (f.bonifico ? ' − bonifici ' + fmtEuro(f.bonifico) : '') + '</span>' : '');
}

function aggiungiVersamento() {
  const msg = document.getElementById('caf-msg');
  if (msg) msg.style.display = 'none';
  const f = letturaFormVersamento();
  const errore = function (t) { if (msg) { msg.textContent = '⚠️ ' + t; msg.style.display = 'block'; } };
  if (!(f.totale > 0)) return errore('Inserisci l\'importo delle fatture, es. 1.460,21');
  if (f.elenco.some(function (r) { return !r.importo; })) return errore('In una delle spese da detrarre manca l\'importo');
  if (f.bonifici.some(function (r) { return !r.importo; })) return errore('In uno dei bonifici manca l\'importo');
  if (f.bonifici.some(function (r) { return !r.nome; })) return errore('In uno dei bonifici manca chi l\'ha fatto');
  if (f.versato < 0) return errore('Spese e bonifici da detrarre sono più alti dell\'importo delle fatture');
  const dal = (document.getElementById('vc-dal').value || '').trim(), al = (document.getElementById('vc-al').value || '').trim();
  if (dal && al && Number(dal) > Number(al)) return errore('Il numero "dalla fattura" deve essere più piccolo di "alla fattura"');
  const nuovo = {
    importo: f.totale, versato: f.versato, pos: f.pos, cassa: f.cassa, cassaElenco: f.elenco, bonifico: f.bonifico, bonificiElenco: f.bonifici,
    data: document.getElementById('vc-data').value.trim() || todayIT(),
    causale: document.getElementById('vc-causale').value.trim(),
    fatturaDal: dal, fatturaAl: al,
    operatore: ((auth.profilo && auth.profilo.nome) || '').toUpperCase()
  };
  ['vc-dal', 'vc-al', 'vc-importo', 'vc-causale'].forEach(function (id) { document.getElementById(id).value = ''; });
  for (let i = 0; i < BON_N; i++) ['vc-bn', 'vc-bd', 'vc-bi'].forEach(function (k) { const el = document.getElementById(k + i); if (el) el.value = ''; });
  VC_BON = []; BON_N = 3;
  for (let i = 0; i < RIGHE_CASSA; i++) { document.getElementById('vc-cd' + i).value = ''; document.getElementById('vc-ci' + i).value = ''; }
  VC_SPESE = [];
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
  const versato = v.versato != null && v.versato !== '' ? Number(v.versato) : Number(v.importo || 0) - Number(v.pos || 0) - Number(v.cassa || 0) - Number(v.bonifico || 0);
  const elenco = Array.isArray(v.cassaElenco) ? v.cassaElenco : [];
  const bonElenco = Array.isArray(v.bonificiElenco) ? v.bonificiElenco : [];
  const righe = [];
  for (let i = 0; i < Math.max(5, elenco.length); i++) {
    const r = elenco[i] || {};
    righe.push('<tr><td style="width:24px">' + (i + 1) + '.</td><td>' + esc(r.descrizione || '') + '</td><td style="width:120px; text-align:right">' + (r.importo ? fmtEuro(r.importo) : '') + '</td></tr>');
  }
  const riga = function (et, val) { return '<tr><th>' + et + '</th><td>' + val + '</td></tr>'; };
  const imgLogo = document.querySelector('.hero-logo'), logoCaf = imgLogo ? imgLogo.src : '';
  finestraStampa('Trasmissione versamento ' + (v.data || ''),
    '<div class="foglio"><div class="testa">' + (logoCaf ? '<img class="logo" src="' + logoCaf + '" alt="CAF CISL">' : '<span></span>')
    + '<div class="indirizzo"><b>CAF CISL SICILIA</b><br>Piazza Castelnuovo 35 – 90141 Palermo<br>Tel 091/331973 – Fax 091/328708<br>e-mail: info@cafcislsicilia.com</div></div>'
    + '<h1>TRASMISSIONE VERSAMENTO</h1>'
    + '<table class="dati">'
    + riga('SEDE', esc(d.sede)) + riga('OPERATORE', esc(v.operatore || (auth.profilo && auth.profilo.nome) || ''))
    + riga('NUMERO SEZIONALE SEDE', esc(d.sezionale || '')) + riga('DATA', esc(v.data || ''))
    + (v.fatturaDal || v.fatturaAl ? riga('FATTURE', 'dal n. ' + esc(v.fatturaDal || '…') + ' al n. ' + esc(v.fatturaAl || '…')) : '')
    + riga('IMPORTO FATTURE €', fmtEuro(v.importo)) + riga('FATTURE / SPESE PAGATE PER CASSA (da detrarre) €', Number(v.cassa) ? '− ' + fmtEuro(v.cassa) : fmtEuro(0))
    + riga('PAGAMENTI CON BONIFICO (da detrarre) €', Number(v.bonifico) ? '− ' + fmtEuro(v.bonifico) : fmtEuro(0))
    + '</table>'
    + '<div class="sotto">Elenco fatture o spese pagate per cassa</div><table class="elenco">' + righe.join('') + '</table>'
    + (bonElenco.length || Number(v.bonifico) ? '<div class="sotto">Note – pagamenti ricevuti con bonifico (detratti)</div><table class="elenco">'
      + bonElenco.map(function (r, i) { return '<tr><td style="width:24px">' + (i + 1) + '.</td><td>Bonifico di <b>' + esc(r.nome || '') + '</b>' + (r.data ? ' del ' + esc(r.data) : '') + (r.fattura ? ' – fattura n. ' + esc(r.fattura) : '') + '</td><td style="width:120px; text-align:right">' + fmtEuro(r.importo) + '</td></tr>'; }).join('')
      + (v.bonificoNote ? '<tr><td></td><td colspan="2">' + esc(v.bonificoNote) + '</td></tr>' : '')
      + '<tr><td></td><td style="text-align:right"><b>Totale bonifici</b></td><td style="text-align:right"><b>' + fmtEuro(v.bonifico) + '</b></td></tr></table>' : '')
    + '<table class="dati" style="margin-top:14px">' + riga('TOTALE VERSATO €', '<b style="font-size:18px">' + fmtEuro(versato) + '</b><div style="font-size:11px">(importo fatture ' + fmtEuro(v.importo) + ' − spese pagate per cassa ' + fmtEuro(v.cassa || 0) + (Number(v.bonifico) ? ' − pagamenti con bonifico ' + fmtEuro(v.bonifico) : '') + ')</div>') + '</table>'
    + '<p class="nota">In allegato devono essere allegati esclusivamente: copia versamento banca, bollettino postale e le fatture e spese documentate pagate per cassa.</p>'
    + '<div class="firme"><div>Data ' + esc(v.data || '') + '</div><div>Firma ____________________________</div></div></div>',
    '@page{size:A4; margin:14mm} .foglio{max-width:180mm} .testa{display:flex; justify-content:space-between; align-items:center; gap:12mm; font-size:12px; border-bottom:2px solid #1d4f91; padding-bottom:8px} .testa .logo{width:24mm; height:auto} .testa .indirizzo{text-align:right; line-height:1.45} h1{text-align:center; font-size:20px; letter-spacing:.08em; margin:14px 0} table{width:100%; border-collapse:collapse} .dati th{width:42%; text-align:left; background:#eef3fa; font-size:12px} .dati th,.dati td{border:1px solid #9aa8bb; padding:7px 9px; font-size:14px} .sotto{margin:14px 0 4px; font-weight:bold; font-size:13px} .elenco td{border-bottom:1px solid #9aa8bb; padding:8px 6px; font-size:13px; height:18px} .note{border:1px solid #9aa8bb; padding:8px 9px; font-size:13px; min-height:34px; white-space:pre-wrap} .nota{font-size:11px; margin-top:14px} .firme{display:flex; justify-content:space-between; margin-top:40px; font-size:13px}');
}

/* --- Bollettino postale TD 123 compilato sul modulo vero (modelli/bollettino-td123.jpg) ---
   Il modulo è la scansione a 200 dpi del bollettino in bianco: 2625 × 805 punti = 333,4 × 102,2 mm.
   Tutte le posizioni qui sotto sono in punti della scansione (1 punto = 0,127 mm).
   Si stampa in due modi: su foglio bianco A4 con il disegno del bollettino (un po' rimpicciolito)
   oppure solo il testo, a grandezza reale, sul bollettino di carta messo nella stampante. */
const BOLL = {
  larg: 2625, alt: 805,
  // parte 1 (attestazione) e parte 2 (ricevuta di versamento): uguali, la seconda spostata di 656 punti
  sinistra: {
    cc: { x: 190, y: 72, n: 12, passo: 35 },
    euro: { x: 190, y: 145, n: 10, passo: 35 },
    lettere: { x: 105, x2: 628, y: 234 },
    intestato: { x: 130, x2: 628, y: 273 },
    causale: [{ x: 32, x2: 622, y: 328 }, { x: 32, x2: 622, y: 368 }],
    eseguito: { x: 132, x2: 628, y: 696 },
    via: { x: 125, x2: 628, y: 736 },
    cap: { x: 58, x2: 192, y: 776 },
    localita: { x: 288, x2: 628, y: 776 }
  },
  spostamentoParte2: 656,
  // parte 3 (ricevuta di accredito): caselle una lettera ciascuna
  destra: {
    cc: { x: 1591, y: 72, n: 12, passo: 35 },
    euro: { x: 2238, y: 72, n: 10, passo: 35 },
    lettere: { x: 1715, x2: 2585, y: 166 },
    intestato: [{ x: 1384, y: 190, n: 34, passo: 34.85 }, { x: 1384, y: 233, n: 34, passo: 34.85 }],
    causale: [{ x: 1392, x2: 2585, y: 330 }, { x: 1392, x2: 2585, y: 370 }],
    eseguito: [{ x: 1771, y: 408, n: 23, passo: 34.73 }, { x: 1771, y: 450, n: 23, passo: 34.73 }],
    via: [{ x: 1771, y: 515, n: 23, passo: 34.73 }],
    cap: { x: 1772, y: 579, n: 5, passo: 34.6 },
    localita: { x: 1982, y: 579, n: 17, passo: 34.53 }
  },
  casella: { larg: 31, alt: 38 }
};

function stampaBollettino(id) {
  const v = cercaVersamento(id);
  if (!v) return;
  const d = datiVersamento();
  if (!d.cc && !confirm('Non è stato impostato il numero di conto corrente postale (⚙️ Dati per il modulo e il bollettino, in fondo ai versamenti). Stampo lo stesso con lo spazio vuoto?')) return;
  const versato = v.versato != null && v.versato !== '' ? Number(v.versato) : Number(v.importo || 0) - Number(v.pos || 0) - Number(v.cassa || 0) - Number(v.bonifico || 0);
  if (!(versato > 0) && !confirm('L\'importo da versare è ' + fmtEuro(versato) + '. Stampo lo stesso il bollettino?')) return;
  const cent = Math.round(Math.max(0, versato) * 100);
  const intero = String(Math.floor(cent / 100)), decimali = String(cent % 100).padStart(2, '0');
  const dati = {
    cc: String(d.cc || '').replace(/\D/g, ''),
    lettere: importoInLettere(Math.max(0, versato)),
    intestato: d.intestatario || '', causale: causaleVersamento(v, d),
    eseguito: d.eseguito || '', via: d.indirizzo || '', cap: String(d.cap || '').replace(/\s/g, ''), localita: d.localita || ''
  };
  const mm = function (p) { return (p * 25.4 / 200).toFixed(2) + 'mm'; };
  const pezzi = [];
  // una lettera per casella
  const caselle = function (c, testo, allineaDestra) {
    const t = String(testo || '').toUpperCase().slice(0, c.n).split('');
    const inizio = allineaDestra ? c.n - t.length : 0;
    t.forEach(function (ch, i) {
      if (ch === ' ') return;
      pezzi.push('<span class="car" style="left:' + mm(c.x + (inizio + i) * c.passo) + '; top:' + mm(c.y) + '">' + esc(ch) + '</span>');
    });
  };
  // testo che va a capo sulle righe di caselle (senza spezzare le parole se si può)
  const caselleSuRighe = function (righe, testo) {
    let resto = String(testo || '').toUpperCase().replace(/\s+/g, ' ').trim();
    righe.forEach(function (r) {
      if (!resto) return;
      let parte = resto.slice(0, r.n);
      if (resto.length > r.n) { const sp = parte.lastIndexOf(' '); if (sp > r.n / 2) parte = parte.slice(0, sp); }
      caselle(r, parte);
      resto = resto.slice(parte.length).trim();
    });
  };
  // testo scritto su una riga (si rimpicciolisce se è lungo)
  const riga = function (r, testo, dx) {
    const t = String(testo || '').toUpperCase().trim();
    if (!t) return;
    const largMm = (r.x2 - r.x) * 25.4 / 200;
    const corpo = Math.min(3.3, largMm / (t.length * 0.62));
    pezzi.push('<span class="riga" style="left:' + mm(r.x + (dx || 0)) + '; top:' + mm(r.y) + '; width:' + largMm.toFixed(2) + 'mm; font-size:' + corpo.toFixed(2) + 'mm">' + esc(t) + '</span>');
  };
  // testo lungo diviso su più righe (la causale)
  const righeMultiple = function (righe, testo, dx) {
    const parole = String(testo || '').toUpperCase().split(/\s+/).filter(Boolean);
    const capienza = function (r) { return Math.floor((r.x2 - r.x) * 25.4 / 200 / (3.3 * 0.62)); };
    const linee = righe.map(function () { return ''; });
    let k = 0;
    parole.forEach(function (p) {
      if (k < righe.length - 1 && linee[k] && (linee[k] + ' ' + p).length > capienza(righe[k])) k++;
      linee[k] = linee[k] ? linee[k] + ' ' + p : p;
    });
    linee.forEach(function (l, i) { riga(righe[i], l, dx); });
  };

  const s = BOLL.sinistra;
  [0, BOLL.spostamentoParte2].forEach(function (dx) {
    caselle({ x: s.cc.x + dx, y: s.cc.y, n: s.cc.n, passo: s.cc.passo }, dati.cc, true);
    caselle({ x: s.euro.x + dx, y: s.euro.y, n: 8, passo: s.euro.passo }, intero, true);
    caselle({ x: s.euro.x + dx + 8 * s.euro.passo, y: s.euro.y, n: 2, passo: s.euro.passo }, decimali);
    riga(s.lettere, dati.lettere, dx);
    riga(s.intestato, dati.intestato, dx);
    righeMultiple(s.causale, dati.causale, dx);
    riga(s.eseguito, dati.eseguito, dx);
    riga(s.via, dati.via, dx);
    riga(s.cap, dati.cap, dx);
    riga(s.localita, dati.localita, dx);
  });
  const r3 = BOLL.destra;
  caselle(r3.cc, dati.cc, true);
  caselle({ x: r3.euro.x, y: r3.euro.y, n: 8, passo: r3.euro.passo }, intero, true);
  caselle({ x: r3.euro.x + 8 * r3.euro.passo, y: r3.euro.y, n: 2, passo: r3.euro.passo }, decimali);
  riga(r3.lettere, dati.lettere);
  caselleSuRighe(r3.intestato, dati.intestato);
  righeMultiple(r3.causale, dati.causale);
  caselleSuRighe(r3.eseguito, dati.eseguito);
  caselleSuRighe(r3.via, dati.via);
  caselle(r3.cap, dati.cap);
  caselleSuRighe([r3.localita], dati.localita);

  const sfondo = new URL('modelli/bollettino-td123.jpg', location.href).href;
  const W = mm(BOLL.larg), H = mm(BOLL.alt);
  const scalaA4 = (287 / (BOLL.larg * 25.4 / 200)).toFixed(4);
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
  w.document.open();
  w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Bollettino postale ' + esc(v.data || '') + '</title>'
    + '<style>'
    + 'body{margin:0; font-family:Arial,Helvetica,sans-serif; color:#111; background:#e9edf2; -webkit-print-color-adjust:exact; print-color-adjust:exact}'
    + '.barra{padding:10px 12px; background:#fff; border-bottom:1px solid #ccd5e0; display:flex; flex-wrap:wrap; gap:10px 18px; align-items:center; font-size:14px}'
    + '.barra button{padding:8px 16px; font-size:14px; border-radius:999px; border:1px solid #1d4f91; background:#fff; color:#1d4f91; cursor:pointer}'
    + '.barra button.princ{background:#1d4f91; color:#fff; font-weight:700}'
    + '.barra label{display:flex; align-items:center; gap:6px} .barra input[type=number]{width:60px; padding:4px}'
    + '.nota{flex-basis:100%; font-size:12px; color:#555; margin:0}'
    + '.area{padding:12px; overflow:auto}'
    + '.contenitore{width:calc(' + W + ' * var(--scala)); height:calc(' + H + ' * var(--scala)); background:#fff; box-shadow:0 2px 10px rgba(0,0,0,.18)}'
    + '.boll{position:relative; width:' + W + '; height:' + H + '; transform-origin:0 0; transform:scale(var(--scala)) translate(var(--dx), var(--dy)); background:url("' + sfondo + '") 0 0 / 100% 100% no-repeat}'
    + 'body.solo-testo .boll{background:none}'
    + '.car{position:absolute; width:' + mm(BOLL.casella.larg) + '; height:' + mm(BOLL.casella.alt) + '; line-height:' + mm(BOLL.casella.alt) + '; text-align:center; font-family:"Courier New",Courier,monospace; font-weight:bold; font-size:4.1mm; color:#000}'
    + '.riga{position:absolute; transform:translateY(-100%); white-space:nowrap; overflow:hidden; font-family:"Courier New",Courier,monospace; font-weight:bold; line-height:1.15; color:#000}'
    + ':root{--scala:1; --dx:0mm; --dy:0mm}'
    + 'body.a4{--scala:' + scalaA4 + '}'
    + '@media print{body{background:none} .barra{display:none} .area{padding:0} .contenitore{box-shadow:none}}'
    + '</style>'
    + '<style id="pagina-a4">@page{size:A4 landscape; margin:5mm}</style>'
    + '<style id="pagina-reale" media="not all">@page{size:' + W + ' ' + H + '; margin:0}</style>'
    + '</head><body class="a4">'
    + '<div class="barra">'
    + '<button class="princ" onclick="window.print()">🖨️ Stampa / Salva come PDF</button>'
    + '<label><input type="radio" name="modo" value="a4" checked onchange="modo(this.value)"> Su foglio bianco A4 (con il disegno del bollettino)</label>'
    + '<label><input type="radio" name="modo" value="vero" onchange="modo(this.value)"> Solo i dati, sul bollettino di carta</label>'
    + '<span id="regola" style="display:none; gap:12px"><label>Sposta → <input type="number" id="dx" step="0.5" value="0" oninput="sposta()"> mm</label><label>↓ <input type="number" id="dy" step="0.5" value="0" oninput="sposta()"> mm</label></span>'
    + '<button onclick="window.close()">Chiudi</button>'
    + '<p class="nota" id="nota-a4">Il bollettino è leggermente rimpicciolito per entrare nel foglio A4.</p>'
    + '<p class="nota" id="nota-vero" style="display:none">Metti il bollettino in bianco nel cassetto manuale della stampante e scegli il formato carta 333 × 102 mm (personalizzato), scala 100%. Se la scritta esce spostata, correggi con "Sposta" e riprova su un foglio di prova.</p>'
    + '</div>'
    + '<div class="area"><div class="contenitore"><div class="boll">' + pezzi.join('') + '</div></div></div>'
    + '<script>'
    + 'function leggi(k){try{return localStorage.getItem(k)}catch(e){return null}}'
    + 'function salva(k,v){try{localStorage.setItem(k,v)}catch(e){}}'
    + 'function sposta(){var x=parseFloat(document.getElementById("dx").value)||0,y=parseFloat(document.getElementById("dy").value)||0;'
    + 'document.documentElement.style.setProperty("--dx",x+"mm");document.documentElement.style.setProperty("--dy",y+"mm");salva("bollettino_dx",x);salva("bollettino_dy",y);}'
    + 'function modo(m){var vero=m==="vero";document.body.className=vero?"solo-testo":"a4";'
    + 'document.getElementById("pagina-a4").media=vero?"not all":"all";document.getElementById("pagina-reale").media=vero?"all":"not all";'
    + 'document.getElementById("regola").style.display=vero?"flex":"none";document.getElementById("nota-a4").style.display=vero?"none":"";document.getElementById("nota-vero").style.display=vero?"":"none";'
    + 'if(vero){document.getElementById("dx").value=leggi("bollettino_dx")||0;document.getElementById("dy").value=leggi("bollettino_dy")||0;sposta();}'
    + 'else{document.documentElement.style.setProperty("--dx","0mm");document.documentElement.style.setProperty("--dy","0mm");}salva("bollettino_modo",m);}'
    + 'if(leggi("bollettino_modo")==="vero"){document.querySelector("input[value=vero]").checked=true;modo("vero");}'
    + '<\/script></body></html>');
  w.document.close();
}
