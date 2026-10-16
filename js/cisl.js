/* ---------------- Prezzario iscritti CISL ---------------- */
// L'amministratore imposta in Utenti e permessi le fasce: tipologia di reddito, reddito dal… al…, dichiarazione, prezzo.
// Nella pratica la spunta "Iscritto CISL" fa comparire il prezzario per compilare l'importo richiesto al cliente.

const CHIAVE_CISL = 'iscritti_cisl_importi';
let CISL_IN_MODIFICA = null;
const TIPOLOGIE_CISL = ['Lavoro dipendente', 'Pensionato', 'Lavoro dipendente e pensionato', 'Lavoro autonomo', 'Altro'];

function prezziCisl() {
  try {
    const l = JSON.parse((typeof IMPOSTAZIONI !== 'undefined' && IMPOSTAZIONI[CHIAVE_CISL]) || '[]');
    return Array.isArray(l) ? l.filter(function (x) { return x && !isNaN(Number(x.importo)); }) : [];
  } catch (e) { return []; }
}
function fasciaCisl(x) {
  const dal = Number(x.dal), al = Number(x.al);
  if (x.dal !== '' && x.dal != null && x.al !== '' && x.al != null) return 'reddito da ' + fmtEuro(dal) + ' a ' + fmtEuro(al);
  if (x.al !== '' && x.al != null) return 'reddito fino a ' + fmtEuro(al);
  if (x.dal !== '' && x.dal != null) return 'reddito oltre ' + fmtEuro(dal);
  return '';
}
function etichettaCisl(x) {
  return [x.tipologia, fasciaCisl(x), x.applica && x.applica !== 'tutte' ? x.applica : ''].filter(Boolean).join(' · ') + ' → ' + fmtEuro(x.importo);
}
// Scelta rapida del prezzo (compila il campo idCampo)
function selectPrezziCisl(idCampo, idFattura) {
  const l = prezziCisl();
  if (!l.length) return '<div style="font-size:11.5px; color:var(--sub)">Prezzario iscritti CISL vuoto: l\'amministratore lo compila in Utenti e permessi.</div>';
  return '<select style="width:100%; padding:6px 8px; margin-top:4px; border:2px solid #1d4f91" onchange="if(this.value!==\'\'){ [\'' + idCampo + '\', \'' + (idFattura || '') + '\'].forEach(function(id){ var c = id && document.getElementById(id); if(c){ c.value = importoInCampo(this.value); c.dispatchEvent(new Event(\'input\')); } }, this); this.value=\'\'; }">'
    + '<option value="">👤 Prezzario iscritti CISL – scegli…</option>'
    + l.map(function (x) { return '<option value="' + Number(x.importo) + '">' + esc(etichettaCisl(x)) + '</option>'; }).join('') + '</select>';
}

// Editor in Utenti e permessi (solo amministratore)
function renderEditorCisl() {
  const box = document.getElementById('cisl-importi-editor');
  if (!box) return;
  if (!CISL_IN_MODIFICA) CISL_IN_MODIFICA = prezziCisl().map(function (x) { return { tipologia: x.tipologia || '', dal: x.dal === '' || x.dal == null ? '' : importoInCampo(x.dal), al: x.al === '' || x.al == null ? '' : importoInCampo(x.al), applica: x.applica || 'tutte', importo: importoInCampo(x.importo) }; });
  const r0 = 'CISL_IN_MODIFICA';
  const campo = 'padding:7px 9px; width:100%';
  const cella = function (etichetta, html) { return '<label class="imp-cella" style="margin:0; display:block"><span class="imp-cap">' + etichetta + '</span>' + html + '</label>'; };
  const euro = function (i, k, ph) { return '<input class="cisl-' + k + '" inputmode="decimal" placeholder="' + ph + '" value="' + esc(CISL_IN_MODIFICA[i][k]) + '" oninput="filtraImporto(this); this.style.borderColor=\'\'; ' + r0 + '[' + i + '].' + k + '=this.value" onblur="formattaCampoImporto(this); ' + r0 + '[' + i + '].' + k + '=this.value" style="' + campo + '">'; };
  box.innerHTML = (CISL_IN_MODIFICA.length
    ? CISL_IN_MODIFICA.map(function (r, i) {
      return '<div class="importi-griglia" data-riga="' + i + '" style="display:grid; grid-template-columns:minmax(140px,2fr) minmax(90px,1fr) minmax(90px,1fr) minmax(100px,1fr) minmax(90px,1fr) auto; gap:6px 8px; align-items:end; margin-bottom:8px; padding:8px; border:1px solid var(--line); border-radius:10px">'
        + cella('Tipologia di reddito', '<select onchange="' + r0 + '[' + i + '].tipologia=this.value" style="' + campo + '">'
          + '<option value="">— scegli —</option>'
          + TIPOLOGIE_CISL.concat(r.tipologia && TIPOLOGIE_CISL.indexOf(r.tipologia) < 0 ? [r.tipologia] : []).map(function (t) { return '<option' + (t === r.tipologia ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>')
        + cella('Reddito dal €', euro(i, 'dal', 'es. 0,00'))
        + cella('al € (vuoto = oltre)', euro(i, 'al', 'es. 15.000,00'))
        + cella('Dichiarazione', '<select onchange="' + r0 + '[' + i + '].applica=this.value" style="' + campo + '">' + [['tutte', 'Tutte'], ['singola', 'Singola'], ['congiunta', 'Congiunta']].map(function (o) { return '<option value="' + o[0] + '"' + (r.applica === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>')
        + cella('Paga €', euro(i, 'importo', 'es. 30,00'))
        + '<button type="button" title="Togli" style="background:none; border:none; color:#c0392b; font-weight:800; font-size:16px; cursor:pointer; margin-bottom:6px" onclick="' + r0 + '.splice(' + i + ',1); renderEditorCisl()">✕</button></div>';
    }).join('')
    : '<div class="empty" style="margin-bottom:8px">Nessuna fascia impostata</div>')
    + '<div style="display:flex; gap:8px; flex-wrap:wrap"><button type="button" class="btn-add" style="background:var(--line); color:var(--ink); margin:0" onclick="' + r0 + '.push({tipologia:\'\', dal:\'\', al:\'\', applica:\'tutte\', importo:\'\'}); renderEditorCisl()">+ Aggiungi fascia</button>'
    + '<button type="button" class="btn-add" style="margin:0" onclick="salvaPrezziCisl()">💾 Salva prezzario</button></div>';
}
async function salvaPrezziCisl() {
  // valori scritti anche se non si è ancora usciti dal campo
  document.querySelectorAll('#cisl-importi-editor .importi-griglia').forEach(function (riga) {
    const r = (CISL_IN_MODIFICA || [])[+riga.dataset.riga]; if (!r) return;
    ['dal', 'al', 'importo'].forEach(function (k) { const el = riga.querySelector('.cisl-' + k); if (el) r[k] = el.value; });
  });
  const lista = [];
  const num = function (v) { const t = String(v || '').trim(); return t ? parseImporto(t.replace(/[^0-9,.]/g, '')) : ''; };
  for (let i = 0; i < (CISL_IN_MODIFICA || []).length; i++) {
    const r = CISL_IN_MODIFICA[i];
    if (!String(r.tipologia).trim() && !String(r.importo).trim() && !String(r.dal).trim() && !String(r.al).trim()) continue;
    const imp = num(r.importo), dal = num(r.dal), al = num(r.al);
    const segna = function (k, msg) { const el = document.querySelector('#cisl-importi-editor .importi-griglia[data-riga="' + i + '"] .cisl-' + k); if (el) { el.style.borderColor = '#c0392b'; el.focus(); } avviso('❌ Riga ' + (i + 1) + ': ' + msg, true); };
    if (imp === '' || isNaN(imp)) return segna('importo', 'scrivi quanto paga (campo "Paga €")');
    if ((dal !== '' && isNaN(dal)) || (al !== '' && isNaN(al))) return segna(isNaN(dal) ? 'dal' : 'al', 'importo del reddito non valido');
    if (dal !== '' && al !== '' && al < dal) return segna('al', 'il reddito "al" è più basso del reddito "dal"');
    lista.push({ tipologia: String(r.tipologia || '').trim(), dal: dal, al: al, applica: r.applica || 'tutte', importo: imp });
  }
  lista.sort(function (a, b) { return String(a.tipologia).localeCompare(String(b.tipologia)) || ((a.dal === '' ? 0 : a.dal) - (b.dal === '' ? 0 : b.dal)); });
  const valore = JSON.stringify(lista);
  const { data: righe, error } = await supabase.from('impostazioni').update({ valore: valore, aggiornato_il: new Date().toISOString() }).eq('chiave', CHIAVE_CISL).select('chiave');
  if (error || !righe || !righe.length) { avviso('❌ Prezzario non salvato' + (error ? ': ' + error.message : ''), true); return; }
  IMPOSTAZIONI[CHIAVE_CISL] = valore;
  CISL_IN_MODIFICA = null;
  renderEditorCisl();
  avviso('✓ Prezzario iscritti CISL salvato (' + lista.length + ' fasce)');
}
// Prezzario da consultare/stampare
function stampaPrezzarioCisl() {
  const l = prezziCisl();
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
  w.document.open();
  w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Prezzario iscritti CISL</title><style>body{font-family:Arial,Helvetica,sans-serif; font-size:12.5px; padding:14px; color:#0f1b2d} h1{font-size:17px; color:#1d4f91} table{width:100%; border-collapse:collapse} th,td{text-align:left; padding:6px 8px; border-bottom:1px solid #e3e8ef} th{background:#f2f5f9} td.n{text-align:right; font-weight:800} .barra{margin-bottom:10px} @media print{.barra{display:none}}</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa</button> <button onclick="window.close()">Chiudi</button></div>'
    + '<h1>CAF CISL Alì Terme – Prezzario iscritti CISL</h1><div style="color:#5b6b82; margin-bottom:8px">Aggiornato al ' + new Date().toLocaleDateString('it-IT') + '</div>'
    + '<table><thead><tr><th>Tipologia di reddito</th><th>Fascia di reddito</th><th>Dichiarazione</th><th style="text-align:right">Prezzo</th></tr></thead><tbody>'
    + (l.length ? l.map(function (x) { return '<tr><td>' + esc(x.tipologia || '-') + '</td><td>' + esc(fasciaCisl(x) || 'tutte') + '</td><td>' + esc(x.applica && x.applica !== 'tutte' ? x.applica : 'tutte') + '</td><td class="n">' + fmtEuro(x.importo) + '</td></tr>'; }).join('') : '<tr><td colspan="4">Nessuna fascia</td></tr>')
    + '</tbody></table></body></html>');
  w.document.close();
}
