/**
 * Scadenza del documento d'identita' (verde se valido, rosso se scaduto, richiesta del nuovo su WhatsApp)
 * e documentazione della pratica: presentata e mancante, da spuntare quando il cliente la porta.
 */

const DOCUMENTI_STANDARD = [
  "Documento d'identità", 'Tessera sanitaria', 'CU (Certificazione Unica)', 'Dichiarazione anno precedente',
  'Spese mediche e farmacia', 'Interessi mutuo', 'Spese istruzione / università', 'Assicurazioni',
  'Bonus edilizi / ristrutturazioni', 'Contratto di affitto', 'Spese funebri', 'Contributi colf / previdenziali',
  'Spese veterinarie', 'Spese sportive figli', 'Delega firmata',
];

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
  const mancanti = documentiPratica(p).mancanti;
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
  window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(testo), '_blank');
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
  if (p) inviaWhatsAppLibero(p.telefono, messaggioDocumentiMancanti(p), p.nome);
}

/* ---------------- Documentazione: editor a "chip" ---------------- */

function documentiPratica(p) {
  const d = (p && p.documenti) || {};
  return { presentati: Array.isArray(d.presentati) ? d.presentati.slice() : [], mancanti: Array.isArray(d.mancanti) ? d.mancanti.slice() : [] };
}
// stato: { nome: 'presentato' | 'mancante' }, ordine: elenco dei nomi da mostrare
function chipsDocumentiHTML(stato, ordine, azione) {
  return ordine.map(function (n) {
    const s = stato[n] || '';
    const segno = s === 'presentato' ? '✓ ' : s === 'mancante' ? '✗ ' : '';
    return '<span class="doc-chip ' + s + '" role="button" tabindex="0" data-doc="' + esc(n) + '" onclick="' + azione + '(this.dataset.doc)">' + segno + esc(n) + '</span>';
  }).join('');
}
function prossimoStato(s) { return !s ? 'presentato' : s === 'presentato' ? 'mancante' : ''; }

// Modulo di inserimento
let DOC_MODULO = {};
let DOC_EXTRA = [];
function ordineModulo() { return DOCUMENTI_STANDARD.concat(DOC_EXTRA.filter(function (n) { return DOCUMENTI_STANDARD.indexOf(n) < 0; })); }
function disegnaDocumentiModulo() {
  const box = document.getElementById('f-documenti');
  if (box) box.innerHTML = chipsDocumentiHTML(DOC_MODULO, ordineModulo(), 'cambiaDocumentoModulo');
}
function cambiaDocumentoModulo(nome) {
  const s = prossimoStato(DOC_MODULO[nome]);
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
  if (d.mancanti.length) {
    h += '<div style="padding:6px 10px; border-radius:10px; border:1.5px solid #c0392b; background:color-mix(in srgb, #c0392b 8%, var(--card))"><b style="color:#c0392b">⚠️ Da portare (spunta quando li consegna):</b>'
      + d.mancanti.map(function (n) {
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
  render();
  const esito = await data.pratiche.aggiorna(p.id, { documenti: d });
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
  const s = prossimoStato(DOC_EDITOR.stato[nome]);
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
