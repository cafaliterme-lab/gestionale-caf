/**
 * Scadenza del documento d'identita' (verde se valido, rosso se scaduto, richiesta del nuovo su WhatsApp)
 * e documentazione della pratica: presentata e mancante, da spuntare quando il cliente la porta.
 */

const DOCUMENTI_STANDARD = [
  "Documento d'identità", 'Tessera sanitaria', 'CU (Certificazione Unica)', 'Dichiarazione anno precedente',
  'Spese mediche e farmacia', 'Interessi mutuo', 'Spese istruzione / università', 'Assicurazioni',
  'Bonus edilizi / ristrutturazioni', 'Contratto di affitto', 'Spese funebri', 'Contributi colf / previdenziali',
  'Spese veterinarie', 'Spese sportive figli', 'Delega firmata',
  'Richiesta CUD Punto Fisco', 'Richiesta CUD Briguglio Santina',
];
// Richieste CUD: un tocco = da richiedere (rosso), due tocchi = ricevuto (verde), tre = tolto
const CUD_PUNTO_FISCO = 'Richiesta CUD Punto Fisco';
const CUD_BRIGUGLIO = 'Richiesta CUD Briguglio Santina';
const RICHIESTE_CUD = [CUD_PUNTO_FISCO, CUD_BRIGUGLIO];

/* ---------------- Scadenza documento ---------------- */

function statoScadenzaDocumento(dataIT) {
  const d = parseDataIT(dataIT);
  if (!d) return null;
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const giorni = Math.round((new Date(d.a, d.m - 1, d.g) - oggi) / 864e5);
  return { valido: giorni >= 0, giorni: giorni };
}

function coloraScadenzaDocumento() {
  const el = document.getElementById('f-doc-scad');
  if (!el) return;
  const msg = document.getElementById('f-doc-scad-msg');
  const wa = document.getElementById('f-doc-scad-wa');
  const st = statoScadenzaDocumento(el.value);
  el.style.background = st ? (st.valido ? '#1a7f37' : '#c0392b') : '';
  el.style.color = st ? '#fff' : '';
  el.style.borderColor = st ? (st.valido ? '#1a7f37' : '#c0392b') : '';
  if (wa) wa.style.display = st && !st.valido ? '' : 'none';
  if (msg) {
    msg.style.color = st ? (st.valido ? '#1a7f37' : '#c0392b') : 'var(--sub)';
    msg.textContent = !st ? '' : st.valido
      ? '✓ Documento valido' + (st.giorni <= 60 ? ' (scade tra ' + st.giorni + (st.giorni === 1 ? ' giorno' : ' giorni') + ')' : '')
      : '✗ Documento SCADUTO da ' + (-st.giorni) + (st.giorni === -1 ? ' giorno' : ' giorni') + ': chiedi il nuovo al cliente';
  }
}

function righeContattiCaf() {
  const imp = (typeof IMPOSTAZIONI !== 'undefined' && IMPOSTAZIONI) || {};
  let orari = '';
  try { orari = testoOrari(leggiTabellaOrari()); } catch (e) {}
  orari = orari || imp.caf_orari || '';
  return ['CAF CISL Alì Terme' + (imp.caf_indirizzo ? ', ' + imp.caf_indirizzo : ''),
    imp.caf_telefono ? 'Tel. ' + imp.caf_telefono : '', orari ? 'Orari: ' + orari : ''].filter(Boolean).join('\n');
}
function messaggioNuovoDocumento(nome, scadenza) {
  return 'Gentile ' + nomeProprio(nome) + ', le ricordiamo che il suo documento d\'identità risulta scaduto' + (scadenza ? ' il ' + scadenza : '')
    + '. Per completare la sua pratica le chiediamo di portarci (o inviarci qui) una copia del nuovo documento.\nGrazie.\n\n' + righeContattiCaf();
}
function messaggioDocumentiMancanti(p) {
  const mancanti = senzaCUD(documentiPratica(p).mancanti);
  return 'Gentile ' + nomeProprio(p.nome) + ', per completare la sua pratica ' + (p.tipo || '') + ' (protocollo ' + formattaProtocollo(p) + ') ci mancano ancora:\n'
    + mancanti.map(function (d) { return '• ' + d; }).join('\n') + '\n\nPuò portarli in ufficio quando le è comodo. Grazie.\n\n' + righeContattiCaf();
}
function inviaWhatsAppLibero(telefono, testo, nome) {
  let num = numeroWhatsApp(telefono);
  if (!num) {
    const t = prompt('Numero di cellulare di ' + (nome || 'cliente') + ':', telefono || '');
    if (!t) return;
    num = numeroWhatsApp(t);
    if (!num) { avviso('❌ Numero di telefono non valido', true); return; }
  }
  apriChatWhatsApp(num, testo);
}
function richiediNuovoDocumentoModulo() {
  const nome = (document.getElementById('f-cognome').value + ' ' + document.getElementById('f-nome').value).trim();
  inviaWhatsAppLibero(document.getElementById('f-tel').value, messaggioNuovoDocumento(nome || 'cliente', document.getElementById('f-doc-scad').value.trim()), nome);
}
function richiediNuovoDocumento(id) {
  const p = (state.pratiche || []).find(function (x) { return x.id === id; });
  if (p) inviaWhatsAppLibero(p.telefono, messaggioNuovoDocumento(p.nome, p.documentoScadenza), p.nome);
}
function richiediDocumentiMancanti(id) {
  const p = (state.pratiche || []).find(function (x) { return x.id === id; });
  if (!p) return;
  if (!senzaCUD(documentiPratica(p).mancanti).length) { avviso('ℹ️ Manca solo il CUD: lo richiede il CAF da "📋 Richieste CUD"'); return; }
  inviaWhatsAppLibero(p.telefono, messaggioDocumentiMancanti(p), p.nome);
}

/* ---------------- Documentazione: editor a "chip" ---------------- */

function documentiPratica(p) {
  const d = (p && p.documenti) || {};
  return { presentati: Array.isArray(d.presentati) ? d.presentati.slice() : [], mancanti: Array.isArray(d.mancanti) ? d.mancanti.slice() : [] };
}
// stato: { nome: 'presentato' | 'mancante' }, ordine: elenco dei nomi da mostrare
function chipsDocumentiHTML(stato, ordine, azione) {
  const chip = function (n) {
    const s = stato[n] || '';
    const segno = s === 'presentato' ? '✓ ' : s === 'mancante' ? '✗ ' : '';
    return '<span class="doc-chip ' + s + '" role="button" tabindex="0" data-doc="' + esc(n) + '" onclick="' + azione + '(this.dataset.doc)">' + segno + esc(n) + '</span>';
  };
  // Le richieste CUD stanno in un riquadro a parte, sempre visibile
  const cud = RICHIESTE_CUD.map(function (n) {
    const s = stato[n] || '';
    const etichetta = (n === CUD_PUNTO_FISCO ? '🏛️ ' : '👤 ') + n + (s === 'mancante' ? ' – DA RICHIEDERE' : s === 'presentato' ? ' – ARRIVATO ✓' : '');
    return '<span class="doc-chip ' + s + '" role="button" tabindex="0" data-doc="' + esc(n) + '" onclick="' + azione + '(this.dataset.doc)">' + esc(etichetta) + '</span>';
  }).join('');
  return ordine.filter(function (n) { return !eRichiestaCUD(n); }).map(chip).join('')
    + '<div style="flex-basis:100%; margin-top:6px; padding:8px 10px; border:2px dashed #1d4f91; border-radius:12px">'
    + '<div style="font-size:12.5px; font-weight:800; color:#1d4f91; margin-bottom:6px">📋 Richieste CUD <span style="font-weight:400; color:var(--sub)">— 1 tocco = da richiedere (rosso), 2 tocchi = arrivato (verde), 3 = tolto · non compaiono sulla ricevuta del cliente</span></div>'
    + '<div class="doc-chips">' + cud + '</div></div>';
}
function eRichiestaCUD(n) { return RICHIESTE_CUD.indexOf(n) >= 0; }
function senzaCUD(lista) { return (lista || []).filter(function (n) { return !eRichiestaCUD(n); }); }
function prossimoStato(s, nome) {
  if (RICHIESTE_CUD.indexOf(nome) >= 0) return !s ? 'mancante' : s === 'mancante' ? 'presentato' : '';
  return !s ? 'presentato' : s === 'presentato' ? 'mancante' : '';
}

// Modulo di inserimento
let DOC_MODULO = {};
let DOC_EXTRA = [];
function ordineModulo() { return DOCUMENTI_STANDARD.concat(DOC_EXTRA.filter(function (n) { return DOCUMENTI_STANDARD.indexOf(n) < 0; })); }
function disegnaDocumentiModulo() {
  const box = document.getElementById('f-documenti');
  if (box) box.innerHTML = chipsDocumentiHTML(DOC_MODULO, ordineModulo(), 'cambiaDocumentoModulo');
}
function cambiaDocumentoModulo(nome) {
  const s = prossimoStato(DOC_MODULO[nome], nome);
  if (s) DOC_MODULO[nome] = s; else delete DOC_MODULO[nome];
  disegnaDocumentiModulo();
}
function aggiungiDocumentoAltro() {
  const inp = document.getElementById('f-doc-altro');
  const n = inp.value.trim().replace(/\s+/g, ' ');
  if (!n) return;
  const nome = n.charAt(0).toUpperCase() + n.slice(1);
  if (ordineModulo().indexOf(nome) < 0) DOC_EXTRA.push(nome);
  DOC_MODULO[nome] = DOC_MODULO[nome] || 'presentato';
  inp.value = '';
  disegnaDocumentiModulo();
}
function documentiDalModulo() {
  const out = { presentati: [], mancanti: [] };
  ordineModulo().forEach(function (n) {
    if (DOC_MODULO[n] === 'presentato') out.presentati.push(n);
    if (DOC_MODULO[n] === 'mancante') out.mancanti.push(n);
  });
  return out;
}
function azzeraDocumentiModulo() { DOC_MODULO = {}; DOC_EXTRA = []; disegnaDocumentiModulo(); }
document.addEventListener('DOMContentLoaded', function () { disegnaDocumentiModulo(); coloraScadenzaDocumento(); });

/* ---------------- Registro: scheda della pratica ---------------- */

function documentoCardHTML(p) {
  const st = statoScadenzaDocumento(p.documentoScadenza);
  if (!st) return '';
  return '<div class="meta" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">'
    + '<span style="display:inline-block; padding:3px 10px; border-radius:999px; font-weight:700; color:#fff; background:' + (st.valido ? '#1a7f37' : '#c0392b') + '">🪪 Documento '
    + (st.valido ? 'valido fino al ' : 'SCADUTO il ') + esc(p.documentoScadenza) + '</span>'
    + (st.valido ? '' : '<button type="button" style="background:#25d366; color:#fff; border:none; border-radius:999px; padding:4px 12px; font-size:12px; font-weight:700; cursor:pointer" onclick="richiediNuovoDocumento(\'' + p.id + '\')">💬 Richiedi nuovo documento</button>')
    + '</div>';
}
function documentiCardHTML(p) {
  const d = documentiPratica(p);
  const btn = 'border:none; border-radius:999px; padding:4px 12px; font-size:12px; font-weight:700; cursor:pointer';
  let h = '<div class="meta" style="margin-top:6px">';
  if (d.presentati.length) h += '<div style="margin-bottom:4px"><b>📎 Presentati:</b> ' + d.presentati.map(function (n) { return '<span class="doc-chip presentato" style="cursor:default; padding:2px 9px; font-size:11.5px">✓ ' + esc(n) + '</span>'; }).join(' ') + '</div>';
  const daPortare = senzaCUD(d.mancanti), cud = d.mancanti.filter(eRichiestaCUD);
  if (cud.length) {
    h += '<div style="padding:6px 10px; margin-bottom:4px; border-radius:10px; border:1.5px dashed #1d4f91"><b style="color:#1d4f91">📋 CUD da richiedere (spunta quando arriva):</b>'
      + cud.map(function (n) {
        return '<label style="display:flex; align-items:center; gap:8px; margin:4px 0 0; font-size:13px; color:var(--ink); cursor:pointer"><input type="checkbox" style="width:auto" data-doc="' + esc(n) + '" onchange="segnaDocumentoConsegnato(\'' + p.id + '\', this.dataset.doc)"> ' + esc(n) + '</label>';
      }).join('') + '</div>';
  }
  if (daPortare.length) {
    h += '<div style="padding:6px 10px; border-radius:10px; border:1.5px solid #c0392b; background:color-mix(in srgb, #c0392b 8%, var(--card))"><b style="color:#c0392b">⚠️ Da portare (spunta quando li consegna):</b>'
      + daPortare.map(function (n) {
        return '<label style="display:flex; align-items:center; gap:8px; margin:4px 0 0; font-size:13px; color:var(--ink); cursor:pointer"><input type="checkbox" style="width:auto" data-doc="' + esc(n) + '" onchange="segnaDocumentoConsegnato(\'' + p.id + '\', this.dataset.doc)"> ' + esc(n) + '</label>';
      }).join('')
      + '<div style="margin-top:6px"><button type="button" style="background:#25d366; color:#fff; ' + btn + '" onclick="richiediDocumentiMancanti(\'' + p.id + '\')">💬 Chiedi i documenti mancanti</button></div></div>';
  }
  h += '<div style="margin-top:6px"><button type="button" style="background:var(--line); color:var(--ink); ' + btn + '" onclick="apriEditorDocumenti(\'' + p.id + '\')">📎 ' + (d.presentati.length || d.mancanti.length ? 'Modifica documentazione' : 'Aggiungi documentazione') + '</button></div></div>';
  return h;
}
function segnaliDocumentiHTML(p) {
  const st = statoScadenzaDocumento(p.documentoScadenza);
  const m = documentiPratica(p).mancanti.length;
  const out = [];
  if (st && !st.valido) out.push('<span title="Documento d\'identità scaduto il ' + esc(p.documentoScadenza) + '" style="background:#c0392b; color:#fff; border-radius:999px; padding:1px 7px; font-size:10.5px; font-weight:700">🪪 scaduto</span>');
  if (m) out.push('<span title="' + esc(documentiPratica(p).mancanti.join(', ')) + '" style="background:#f08a24; color:#fff; border-radius:999px; padding:1px 7px; font-size:10.5px; font-weight:700">📎 ' + m + (m === 1 ? ' doc. mancante' : ' doc. mancanti') + '</span>');
  return out.length ? '<div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:3px">' + out.join('') + '</div>' : '';
}
async function salvaDocumentiPratica(p, d) {
  p.documenti = d;
  const campi = { documenti: d };
  // se mancano documenti la pratica torna/resta "In arrivo"
  if (d.mancanti.length && p.stato !== 'arrivo') {
    campi.stato = 'arrivo';
    if (!eColf(p.tipo)) campi.dataFine = '';
    p.stato = 'arrivo';
    avviso('ℹ️ Mancano documenti: la pratica torna "In arrivo"');
  }
  render();
  const esito = await data.pratiche.aggiorna(p.id, campi);
  if (esito && esito.error) avviso('❌ Documentazione non salvata', true);
}
function segnaDocumentoConsegnato(id, nome) {
  const p = (state.pratiche || []).find(function (x) { return x.id === id; });
  if (!p) return;
  const d = documentiPratica(p);
  d.mancanti = d.mancanti.filter(function (n) { return n !== nome; });
  if (d.presentati.indexOf(nome) < 0) d.presentati.push(nome);
  salvaDocumentiPratica(p, d);
  avviso(d.mancanti.length ? '✓ ' + nome + ' consegnato' : '✓ Documentazione completa');
}

// Finestra per modificare la documentazione di una pratica gia' salvata
let DOC_EDITOR = null;
function apriEditorDocumenti(id) {
  const p = (state.pratiche || []).find(function (x) { return x.id === id; });
  if (!p) return;
  const d = documentiPratica(p);
  const stato = {};
  d.presentati.forEach(function (n) { stato[n] = 'presentato'; });
  d.mancanti.forEach(function (n) { stato[n] = 'mancante'; });
  DOC_EDITOR = { id: id, stato: stato, ordine: DOCUMENTI_STANDARD.concat(d.presentati, d.mancanti).filter(function (n, i, a) { return a.indexOf(n) === i; }) };
  const ov = document.createElement('div');
  ov.id = 'editor-documenti';
  ov.style.cssText = 'position:fixed; inset:0; z-index:400; background:rgba(15,27,45,.45); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; max-width:640px; width:100%; max-height:90vh; overflow:auto; padding:18px 20px; box-shadow:0 20px 50px rgba(0,0,0,.3)">'
    + '<div style="font-size:18px; font-weight:800">📎 Documentazione</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin:2px 0 10px">' + esc(p.nome) + ' · ' + esc(p.tipo || '') + ' — tocca: 1 volta = ✓ presentato, 2 volte = ✗ mancante, 3 volte = tolto</div>'
    + '<div id="editor-doc-chips" class="doc-chips"></div>'
    + '<div style="display:flex; gap:6px; margin-top:8px"><input id="editor-doc-altro" placeholder="Altro documento"><button type="button" class="btn-scan-cf" onclick="aggiungiDocumentoEditor()">+ Aggiungi</button></div>'
    + '<div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px"><button type="button" style="background:var(--line); color:var(--ink)" onclick="chiudiEditorDocumenti()">Annulla</button>'
    + '<button type="button" style="background:var(--accent); color:var(--accent-ink)" onclick="salvaEditorDocumenti()">Salva</button></div></div>';
  document.body.appendChild(ov);
  disegnaEditorDocumenti();
}
function disegnaEditorDocumenti() {
  const box = document.getElementById('editor-doc-chips');
  if (box && DOC_EDITOR) box.innerHTML = chipsDocumentiHTML(DOC_EDITOR.stato, DOC_EDITOR.ordine, 'cambiaDocumentoEditor');
}
function cambiaDocumentoEditor(nome) {
  const s = prossimoStato(DOC_EDITOR.stato[nome], nome);
  if (s) DOC_EDITOR.stato[nome] = s; else delete DOC_EDITOR.stato[nome];
  disegnaEditorDocumenti();
}
function aggiungiDocumentoEditor() {
  const inp = document.getElementById('editor-doc-altro');
  const n = inp.value.trim().replace(/\s+/g, ' ');
  if (!n) return;
  const nome = n.charAt(0).toUpperCase() + n.slice(1);
  if (DOC_EDITOR.ordine.indexOf(nome) < 0) DOC_EDITOR.ordine.push(nome);
  DOC_EDITOR.stato[nome] = DOC_EDITOR.stato[nome] || 'presentato';
  inp.value = '';
  disegnaEditorDocumenti();
}
function chiudiEditorDocumenti() { const ov = document.getElementById('editor-documenti'); if (ov) ov.remove(); DOC_EDITOR = null; }
function salvaEditorDocumenti() {
  const p = (state.pratiche || []).find(function (x) { return x.id === DOC_EDITOR.id; });
  const d = { presentati: [], mancanti: [] };
  DOC_EDITOR.ordine.forEach(function (n) {
    if (DOC_EDITOR.stato[n] === 'presentato') d.presentati.push(n);
    if (DOC_EDITOR.stato[n] === 'mancante') d.mancanti.push(n);
  });
  chiudiEditorDocumenti();
  if (p) salvaDocumentiPratica(p, d);
}

// Finestra al centro: la pratica non puo' avanzare finche' mancano documenti
function popupDocumentiMancanti(p, statoRichiesto) {
  const mancanti = documentiPratica(p).mancanti;
  const vecchio = document.getElementById('popup-mancanti');
  if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-mancanti';
  ov.style.cssText = 'position:fixed; inset:0; z-index:450; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #c0392b; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:24px 26px; max-width:440px; width:100%">'
    + '<div style="text-align:center"><div style="width:60px; height:60px; margin:0 auto 8px; border-radius:50%; background:#c0392b; color:#fff; font-size:32px; line-height:60px">📎</div>'
    + '<div style="font-size:20px; font-weight:800; color:#c0392b">Documenti mancanti</div>'
    + '<div style="font-size:14px; margin:4px 0 12px"><b>' + esc(p.nome || '') + '</b> non può passare a <b>' + esc(statoRichiesto || 'uno stato successivo') + '</b>: resta <b>In arrivo</b> finché non porta:</div></div>'
    + '<ul style="margin:0 0 14px; padding:10px 14px 10px 32px; border-radius:12px; border:2px solid #c0392b; background:color-mix(in srgb, #c0392b 8%, var(--card)); font-size:15px; font-weight:600">'
    + mancanti.map(function (d) { return '<li style="margin:3px 0">' + esc(d) + '</li>'; }).join('') + '</ul>'
    + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:14px">Quando li porta, spuntali nella pratica (riquadro rosso "Da portare"): poi potrai cambiare lo stato.</div>'
    + '<div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap">'
    + '<button type="button" data-azione="wa" style="background:#25d366; color:#fff">💬 Chiedi su WhatsApp</button>'
    + '<button type="button" data-azione="apri" style="background:var(--line); color:var(--ink)">Apri la pratica</button>'
    + '<button type="button" data-azione="ok" style="background:#c0392b; color:#fff; min-width:90px">OK</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function (e) {
    const b = e.target.closest('button[data-azione]');
    if (!b && e.target !== ov) return;
    ov.remove();
    if (b && b.dataset.azione === 'wa') richiediDocumentiMancanti(p.id);
    if (b && b.dataset.azione === 'apri' && typeof apriPraticaDaTabella === 'function') { apriPraticaDaTabella(p.id); const q = state.pratiche.find(function (x) { return x.id === p.id; }); if (q) { delete q._editing; render(); setTimeout(function () { const el = document.getElementById('pratica-' + p.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150); } }
  });
}

/* ---------------- Richieste CUD: Punto Fisco (elenco da stampare) e Briguglio Santina (WhatsApp) ---------------- */

function praticheConRichiesta(nome) {
  const anno = annoAttivo();
  return (state.pratiche || []).filter(function (p) { return annoPratica(p) === anno && documentiPratica(p).mancanti.indexOf(nome) >= 0; })
    .sort(function (a, b) { return a.numero - b.numero; });
}
function numeroRichiesteCUD() { return praticheConRichiesta(CUD_PUNTO_FISCO).length + praticheConRichiesta(CUD_BRIGUGLIO).length; }
function aggiornaPulsanteCUD() {
  const b = document.getElementById('btn-richieste-cud');
  if (!b) return;
  const n = numeroRichiesteCUD();
  b.textContent = '📋 Richieste CUD' + (n ? ' (' + n + ')' : '');
  b.style.background = n ? '#b35f0c' : '#6b7280';
}
function idCUD(p) { return p.codiceFiscale ? 'CF ' + p.codiceFiscale : (p.cf ? 'nato/a il ' + p.cf : 'codice fiscale mancante'); }
// Numero WhatsApp completo: un cellulare italiano (inizia con 3) deve avere 9-10 cifre
function numeroWhatsAppCUD(v) {
  const t = String(v || '').replace(/[^\d+]/g, '');
  if (/^3/.test(t) && !/^3\d{8,9}$/.test(t)) return '';
  if (/^(\+|00)39/.test(t) && !/^(\+|00)393\d{8,9}$/.test(t) && /^(\+|00)393/.test(t)) return '';
  return numeroWhatsApp(t);
}
function nomeOperatoreCUD() { return nomeProprio((typeof auth !== 'undefined' && auth.profilo && auth.profilo.nome) || ''); }
function telefonoCUD() { return (typeof IMPOSTAZIONI !== 'undefined' && IMPOSTAZIONI.whatsapp_cud_telefono) || ''; }

function apriRichiesteCUD() {
  let ov = document.getElementById('richieste-cud');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'richieste-cud';
    ov.style.cssText = 'position:fixed; inset:0; z-index:420; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
    ov.addEventListener('click', function (e) { if (e.target === ov) chiudiRichiesteCUD(); });
    document.body.appendChild(ov);
  }
  disegnaRichiesteCUD();
}
function chiudiRichiesteCUD() { const ov = document.getElementById('richieste-cud'); if (ov) ov.remove(); aggiornaPulsanteCUD(); }
function righeCUD(lista, nome, conInvio) {
  if (!lista.length) return '<div class="empty">✓ Nessuna richiesta in sospeso</div>';
  return '<div class="cud-lista" style="max-height:34vh; overflow-y:auto; border:1px solid var(--line); border-radius:10px">' + lista.map(function (p) {
    return '<div style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid var(--line); font-size:13px">'
      + '<input type="checkbox" style="width:auto" title="Spunta quando il CUD è arrivato" onchange="ricevutoCUD(\'' + p.id + '\', \'' + nome.replace(/'/g, "\\'") + '\')">'
      + '<span style="flex:1; min-width:0"><b>' + esc(formattaProtocollo(p)) + '</b> · ' + esc(p.nome || '') + '<br><span style="font-size:12px; color:var(--sub); font-family:monospace">' + esc(idCUD(p)) + '</span></span>'
      + (conInvio ? '<button type="button" style="background:#25d366; color:#fff; border:none; border-radius:999px; padding:5px 10px; font-size:12px; font-weight:700; cursor:pointer" onclick="inviaCUDBriguglio(\'' + p.id + '\')">💬 Invia</button>' : '')
      + '</div>';
  }).join('') + '</div>';
}
function disegnaRichiesteCUD() {
  const ov = document.getElementById('richieste-cud');
  if (!ov) return;
  const pf = praticheConRichiesta(CUD_PUNTO_FISCO), bs = praticheConRichiesta(CUD_BRIGUGLIO);
  const vecchio = document.getElementById('cud-tel');
  const staScrivendo = vecchio && document.activeElement === vecchio;
  const tel = vecchio ? vecchio.value : telefonoCUD();
  const scroll = Array.prototype.map.call(ov.querySelectorAll('.cud-lista'), function (el) { return el.scrollTop; });
  const puoModificare = (typeof isAdmin === 'function' && isAdmin()) || (typeof puo === 'function' && puo('messaggi', true));
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; max-width:720px; width:100%; max-height:92vh; overflow:auto; padding:18px 20px; box-shadow:0 20px 50px rgba(0,0,0,.3)">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:10px"><div style="font-size:19px; font-weight:800">📋 Richieste CUD – ' + annoAttivo() + '</div>'
    + '<button type="button" style="background:var(--line); color:var(--ink)" onclick="chiudiRichiesteCUD()">Chiudi</button></div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin:2px 0 12px">Qui compaiono le pratiche con la richiesta CUD segnata in rosso nella documentazione. Spunta ☑ quando il CUD è arrivato: sparisce dall\'elenco e passa tra i documenti presentati.</div>'
    // Punto Fisco
    + '<div style="padding:12px; border-radius:12px; border:2px solid #1d4f91; margin-bottom:14px">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px"><div style="font-weight:800; color:#1d4f91">🏛️ Punto Fisco <span style="font-weight:600; color:var(--sub)">(' + pf.length + ')</span></div>'
    + (pf.length ? '<button type="button" class="btn-add" style="margin:0" onclick="stampaElencoCUD()">🖨️ Stampa elenco</button>' : '') + '</div>'
    + righeCUD(pf, CUD_PUNTO_FISCO, false) + '</div>'
    // Briguglio Santina
    + '<div style="padding:12px; border-radius:12px; border:2px solid #25a35a">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px"><div style="font-weight:800; color:#1a7f37">👤 Briguglio Santina <span style="font-weight:600; color:var(--sub)">(' + bs.length + ')</span></div>'
    + (bs.length ? '<button type="button" style="background:#25d366; color:#fff; border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer" onclick="inviaCUDBriguglio()">📤 Invia tabulato su WhatsApp</button>' : '') + '</div>'
    + '<div style="display:flex; gap:6px; align-items:flex-end; margin-bottom:8px; flex-wrap:wrap"><div style="flex:1; min-width:180px"><label style="font-size:12px">Telefono predefinito per le richieste</label>'
    + '<input id="cud-tel" type="tel" inputmode="tel" value="' + esc(tel) + '" placeholder="Numero di Briguglio Santina"' + (puoModificare ? '' : ' disabled') + '></div>'
    + (puoModificare ? '<button type="button" class="btn-add" style="margin:0; background:var(--line); color:var(--ink)" onclick="salvaTelefonoCUD()">💾 Salva numero</button>' : '')
    + '<button type="button" class="btn-add" style="margin:0; background:#25d366; color:#fff" onclick="provaTelefonoCUD()" title="Apre la chat su WhatsApp per controllare che il numero sia giusto">🔗 Prova su WhatsApp</button></div>'
    + (tel && !numeroWhatsAppCUD(tel) ? '<div style="font-size:12.5px; font-weight:700; color:#c0392b; margin:-2px 0 8px">⚠️ Il numero salvato (' + esc(tel) + ') è incompleto: un cellulare ha 10 cifre (es. 333 1234567). Correggilo e premi Salva numero.</div>' : '')
    + '<div style="font-size:12px; color:var(--sub); margin:-2px 0 8px">Il messaggio parte dal WhatsApp del telefono o PC che stai usando (Angelo o Federica) e viene firmato con il tuo nome' + (nomeOperatoreCUD() ? ' (<b>' + esc(nomeOperatoreCUD()) + '</b>)' : '') + '.</div>'
    + righeCUD(bs, CUD_BRIGUGLIO, true) + '</div></div>';
  ov.querySelectorAll('.cud-lista').forEach(function (el, i) { if (scroll[i]) el.scrollTop = scroll[i]; });
  if (staScrivendo) { const t = document.getElementById('cud-tel'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
}
function ricevutoCUD(id, nome) {
  segnaDocumentoConsegnato(id, nome);
  setTimeout(disegnaRichiesteCUD, 50);
}
async function salvaTelefonoCUD() {
  const v = document.getElementById('cud-tel').value.trim();
  if (v && !numeroWhatsAppCUD(v)) { avviso('❌ Numero non valido o incompleto: un cellulare ha 10 cifre (es. 333 1234567)', true); return; }
  const { data: righe, error } = await supabase.from('impostazioni').update({ valore: v, aggiornato_il: new Date().toISOString() }).eq('chiave', 'whatsapp_cud_telefono').select('chiave');
  if (error || !righe || !righe.length) { avviso('❌ Numero non salvato' + (error ? ': ' + error.message : ''), true); return; }
  IMPOSTAZIONI.whatsapp_cud_telefono = v;
  avviso('✓ Numero per le richieste CUD salvato');
  disegnaRichiesteCUD();
}
function provaTelefonoCUD() {
  const num = numeroWhatsAppCUD((document.getElementById('cud-tel') || {}).value || telefonoCUD());
  if (!num) { avviso('❌ Numero non valido o incompleto: un cellulare ha 10 cifre (es. 333 1234567)', true); return; }
  apriChatWhatsApp(num, '');
}
// Senza id: tutto il tabulato; con id: solo quel codice fiscale
function inviaCUDBriguglio(id) {
  const tel = (document.getElementById('cud-tel') || {}).value || telefonoCUD();
  const num = numeroWhatsAppCUD(tel);
  if (!num) { avviso(tel ? '❌ Il numero di Briguglio Santina è incompleto: correggilo (10 cifre)' : '❌ Inserisci il telefono predefinito per le richieste CUD', true); const el = document.getElementById('cud-tel'); if (el) el.focus(); return; }
  const lista = praticheConRichiesta(CUD_BRIGUGLIO).filter(function (p) { return !id || p.id === id; });
  if (!lista.length) return;
  const righe = lista.map(function (p, i) { return (lista.length > 1 ? (i + 1) + '. ' : '') + (p.nome || '') + ' – ' + (p.codiceFiscale || ('nato/a il ' + (p.cf || '?'))); });
  const testo = 'Buongiorno, dal CAF CISL di Alì Terme chiediamo ' + (lista.length > 1 ? 'i CUD dei seguenti contribuenti' : 'il CUD di') + ':\n' + righe.join('\n') + '\n\nGrazie.' + (nomeOperatoreCUD() ? '\n' + nomeOperatoreCUD() + ' – CAF CISL Alì Terme' : '');
  apriChatWhatsApp(num, testo);
  popupRichiestaCUDInviata(lista, tel);
}
// Conferma al centro dopo l'invio della richiesta a Briguglio Santina
function popupRichiestaCUDInviata(lista, tel) {
  const vecchio = document.getElementById('popup-cud-inviata');
  if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-cud-inviata';
  ov.style.cssText = 'position:fixed; inset:0; z-index:460; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #1a7f37; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:24px 26px; max-width:440px; width:100%; text-align:center">'
    + '<div style="width:64px; height:64px; margin:0 auto 8px; border-radius:50%; background:#1a7f37; color:#fff; font-size:36px; line-height:64px">✓</div>'
    + '<div style="font-size:20px; font-weight:800; color:#1a7f37">Richiesta andata a buon fine</div>'
    + '<div style="font-size:14px; margin:6px 0 10px">Richiesta CUD inviata a <b>Briguglio Santina</b>' + (tel ? ' (' + esc(tel) + ')' : '') + (nomeOperatoreCUD() ? ' dal WhatsApp di <b>' + esc(nomeOperatoreCUD()) + '</b>' : '') + ' per ' + (lista.length === 1 ? '<b>1 contribuente</b>' : '<b>' + lista.length + ' contribuenti</b>') + ':</div>'
    + '<div style="max-height:30vh; overflow-y:auto; text-align:left; padding:8px 12px; border-radius:12px; border:2px solid #1a7f37; background:color-mix(in srgb, #1a7f37 8%, var(--card)); font-size:13.5px">'
    + lista.map(function (p) { return '<div style="margin:3px 0"><b>' + esc(p.nome || '') + '</b> <span style="font-family:monospace; color:var(--sub)">' + esc(p.codiceFiscale || '') + '</span></div>'; }).join('') + '</div>'
    + '<div style="font-size:12px; color:var(--sub); margin:10px 0 14px">Quando arriva il CUD, metti la spunta ☑ nell\'elenco "Richieste CUD".</div>'
    + '<button type="button" style="background:#1a7f37; color:#fff; min-width:110px">OK</button></div>';
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.tagName === 'BUTTON') ov.remove(); });
  document.body.appendChild(ov);
}
function stampaElencoCUD() {
  const lista = praticheConRichiesta(CUD_PUNTO_FISCO);
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
  const logo = document.querySelector('.hero-logo');
  const caf = (typeof datiCafStampa === 'function') ? datiCafStampa() : {};
  const html = '<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Richieste CUD Punto Fisco</title><style>'
    + '@page{size:A4 portrait; margin:12mm} body{font-family:Arial,Helvetica,sans-serif; color:#0f1b2d; margin:0; padding:14px; font-size:12px}'
    + '.testa{display:flex; align-items:center; gap:12px; border-bottom:3px solid #1d4f91; padding-bottom:8px; margin-bottom:12px}.testa img{width:50px}.testa h1{font-size:16px; margin:0; color:#1d4f91}.sub{font-size:11px; color:#5b6b82}'
    + 'table{width:100%; border-collapse:collapse}th,td{border:1px solid #cfd8e3; padding:6px 8px; text-align:left}th{background:#1d4f91; color:#fff}td.cf{font-family:monospace; font-size:12.5px}td.ok{width:40px; text-align:center; font-size:16px}'
    + '.barra{margin-bottom:10px}.barra button{font-size:14px; padding:8px 16px; border:none; border-radius:999px; background:#1d4f91; color:#fff; cursor:pointer}@media print{.barra{display:none} body{padding:0}}'
    + '</style></head><body><div class="barra"><button onclick="window.print()">🖨️ Stampa</button></div>'
    + '<div class="testa">' + (logo ? '<img src="' + logo.src + '" alt="">' : '') + '<div><h1>Richieste CUD – Punto Fisco</h1><div class="sub">CAF CISL Alì Terme' + (caf.indirizzo ? ' · ' + esc(caf.indirizzo) : '') + ' · anno ' + annoAttivo() + ' · stampato il ' + esc(todayIT()) + ' · ' + lista.length + ' richieste</div></div></div>'
    + '<table><thead><tr><th>#</th><th>Protocollo</th><th>Cognome e Nome</th><th>Codice fiscale</th><th>Data di nascita</th><th>Arrivato</th></tr></thead><tbody>'
    + lista.map(function (p, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(formattaProtocollo(p)) + '</td><td>' + esc(p.nome || '') + '</td><td class="cf">' + esc(p.codiceFiscale || '—') + '</td><td>' + esc(p.cf || '') + '</td><td class="ok">☐</td></tr>'; }).join('')
    + '</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>';
  w.document.open(); w.document.write(html); w.document.close();
}
