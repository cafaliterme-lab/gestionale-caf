/* ---------------- Tipi di pratica ed etichette (solo amministratore) ---------------- */

// Tipi usati da funzioni particolari del programma: si possono colorare ma non rinominare o eliminare
const TIPI_PROTETTI = ['730 SEDE', '730 FILCA', '730 FPS IN CONVENZIONE', 'CONTRATTI COLF E BADANTI'];
let TIPI_IN_MODIFICA = null;

function tipoE730Nome(n) { return /^730\b/.test(String(n || '').toUpperCase().trim()); }
function contaPraticheTipo(n) { return (state.pratiche || []).filter(function (p) { return p.tipo === n; }).length; }

function caricaTipiInModifica() {
  TIPI_IN_MODIFICA = getTipiList().map(function (n) {
    return { nome: n, originale: n, colore: coloreCollaboratore(n), acconto: haAcconti(n), soldi: conSoldi(n) };
  });
}

function renderTipiPratica(ricarica) {
  const wrap = document.getElementById('tipi-lista');
  if (!wrap) return;
  if (!auth.profilo || auth.profilo.ruolo !== 'admin') { wrap.innerHTML = '<div class="empty">Solo l\'amministratore può gestire i tipi di pratica.</div>'; return; }
  if (ricarica || !TIPI_IN_MODIFICA) caricaTipiInModifica();
  const righe = TIPI_IN_MODIFICA.map(function (t, i) {
    const protetto = TIPI_PROTETTI.indexOf(t.originale) >= 0;
    const n = t.originale ? contaPraticheTipo(t.originale) : 0;
    return '<div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px; padding:8px; border-radius:10px; border:1px solid var(--line); margin-bottom:6px; border-left:8px solid ' + esc(t.colore) + '">'
      + '<input type="color" value="' + esc(t.colore) + '" title="Colore dell\'etichetta" onchange="TIPI_IN_MODIFICA[' + i + '].colore=this.value; renderTipiPratica()" style="width:42px; height:34px; padding:2px; flex:none">'
      + '<input value="' + esc(t.nome) + '" ' + (protetto ? 'disabled title="Tipo usato da funzioni del programma: non si può rinominare"' : '') + ' oninput="TIPI_IN_MODIFICA[' + i + '].nome=this.value.toUpperCase()" style="flex:1; min-width:180px; text-transform:uppercase; font-weight:700">'
      + '<span style="font-size:12px; color:var(--sub); white-space:nowrap">' + n + ' pratiche' + (protetto ? ' · 🔒' : '') + '</span>'
      + '<label class="chk" style="white-space:nowrap"><input type="checkbox" ' + (t.soldi ? 'checked' : '') + ' onchange="TIPI_IN_MODIFICA[' + i + '].soldi=this.checked"> € Fatture e incasso</label>'
      + '<label class="chk" style="white-space:nowrap"><input type="checkbox" ' + (t.acconto ? 'checked' : '') + ' onchange="TIPI_IN_MODIFICA[' + i + '].acconto=this.checked"> 💰 Tasto Acconto</label>'
      + '<span style="display:flex; gap:4px; margin-left:auto">'
      + '<button type="button" title="Sposta su" onclick="spostaTipo(' + i + ',-1)" ' + (i === 0 ? 'disabled' : '') + ' style="padding:4px 10px">↑</button>'
      + '<button type="button" title="Sposta giù" onclick="spostaTipo(' + i + ',1)" ' + (i === TIPI_IN_MODIFICA.length - 1 ? 'disabled' : '') + ' style="padding:4px 10px">↓</button>'
      + (protetto ? '' : '<button type="button" title="Elimina" onclick="eliminaTipo(' + i + ')" style="padding:4px 10px; background:#c0392b; color:#fff; border:none">✕</button>')
      + '</span></div>';
  }).join('');
  wrap.innerHTML = righe
    + '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; align-items:center">'
    + '<input id="tipo-nuovo" placeholder="Nuovo tipo di pratica, es. 730 ROSSI MARIO" style="flex:1; min-width:220px; text-transform:uppercase" onkeydown="if(event.key===\'Enter\'){ aggiungiTipo(); }">'
    + '<button type="button" class="btn-add" style="margin-top:0" onclick="aggiungiTipo()">+ Aggiungi tipo</button></div>'
    + '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px">'
    + '<button type="button" class="btn-add" style="margin-top:0; background:#2f9e5f" onclick="salvaTipiPratica()">💾 Salva tipi di pratica</button>'
    + '<button type="button" class="btn-add" style="margin-top:0; background:var(--line); color:var(--ink)" onclick="renderTipiPratica(true)">Annulla modifiche</button></div>'
    + '<div style="font-size:12px; color:var(--sub); margin-top:8px">🔒 = tipo usato da funzioni particolari (importi FILCA/FPS, scadenze colf, tipo predefinito): puoi cambiare colore e opzioni ma non il nome. Rinominando un tipo, tutte le sue pratiche e i suoi acconti prendono il nuovo nome; il numero di protocollo non cambia.</div>';
}

function spostaTipo(i, d) {
  const j = i + d;
  if (j < 0 || j >= TIPI_IN_MODIFICA.length) return;
  const t = TIPI_IN_MODIFICA[i]; TIPI_IN_MODIFICA[i] = TIPI_IN_MODIFICA[j]; TIPI_IN_MODIFICA[j] = t;
  renderTipiPratica();
}

function eliminaTipo(i) {
  const t = TIPI_IN_MODIFICA[i];
  const n = t.originale ? contaPraticheTipo(t.originale) : 0;
  if (!confirm('Eliminare il tipo "' + t.nome + '"?' + (n ? '\n\nAttenzione: ci sono ' + n + ' pratiche di questo tipo. Non vengono cancellate: restano nel registro con il loro tipo, ma il tipo non si potrà più scegliere per le nuove pratiche.' : ''))) return;
  TIPI_IN_MODIFICA.splice(i, 1);
  renderTipiPratica();
}

function aggiungiTipo() {
  const inp = document.getElementById('tipo-nuovo');
  const v = (inp.value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!v) return;
  if (TIPI_IN_MODIFICA.some(function (t) { return t.nome === v; })) { avviso('❌ Il tipo "' + v + '" esiste già', true); return; }
  TIPI_IN_MODIFICA.push({ nome: v, originale: '', colore: coloreCollaboratore(v), acconto: tipoE730Nome(v), soldi: true });
  renderTipiPratica();
}

async function salvaTipiPratica() {
  const lista = TIPI_IN_MODIFICA.map(function (t) { return Object.assign({}, t, { nome: String(t.nome || '').trim().toUpperCase().replace(/\s+/g, ' ') }); });
  const nomi = lista.map(function (t) { return t.nome; });
  if (nomi.some(function (n) { return !n; })) { avviso('❌ C\'è un tipo senza nome', true); return; }
  const doppio = nomi.find(function (n, i) { return nomi.indexOf(n) !== i; });
  if (doppio) { avviso('❌ Il tipo "' + doppio + '" compare due volte', true); return; }
  const rinomina = lista.filter(function (t) { return t.originale && t.nome !== t.originale; });
  const cambioSerie = rinomina.find(function (t) { return tipoE730Nome(t.nome) !== tipoE730Nome(t.originale); });
  if (cambioSerie) { avviso('❌ "' + cambioSerie.originale + '" non può diventare "' + cambioSerie.nome + '": un 730 deve restare 730 (e un\'altra pratica non può diventare 730), altrimenti cambierebbe la numerazione del protocollo', true); return; }
  if (rinomina.length && !confirm('Rinominare questi tipi?\n\n' + rinomina.map(function (t) { return '• ' + t.originale + ' → ' + t.nome + ' (' + contaPraticheTipo(t.originale) + ' pratiche)'; }).join('\n') + '\n\nLe pratiche e gli acconti prenderanno il nuovo nome; il numero di protocollo non cambia.')) return;

  for (const t of rinomina) {
    const r1 = await supabase.from('pratiche').update({ tipo: t.nome }).eq('tipo', t.originale);
    if (r1.error) { avviso('❌ Pratiche di "' + t.originale + '" non rinominate: ' + r1.error.message, true); return; }
    const r2 = await supabase.from('acconti').update({ tipo: t.nome }).eq('tipo', t.originale);
    if (r2.error) { avviso('❌ Acconti di "' + t.originale + '" non rinominati: ' + r2.error.message, true); return; }
    (state.pratiche || []).forEach(function (p) { if (p.tipo === t.originale) p.tipo = t.nome; });
    (state.acconti || []).forEach(function (a) { if (a.tipo === t.originale) a.tipo = t.nome; });
    if (typeof aperti !== 'undefined' && aperti[t.originale]) aperti[t.nome] = true;
  }

  const cfg = {};
  lista.forEach(function (t) { cfg[t.nome] = { colore: t.colore, acconto: !!t.acconto, soldi: !!t.soldi }; });
  const valore = JSON.stringify(cfg);
  const { data: righe, error } = await supabase.from('impostazioni').update({ valore: valore, aggiornato_il: new Date().toISOString() }).eq('chiave', 'tipi_config').select('chiave');
  if (error || !righe || !righe.length) { avviso('❌ Etichette non salvate' + (error ? ': ' + error.message : ''), true); return; }
  IMPOSTAZIONI.tipi_config = valore;

  const res = await data.collaboratori.salva(nomi);
  if (res && res.error) return;
  if (typeof initTipoBtns === 'function') initTipoBtns();
  renderTipiPratica(true);
  render();
  avviso('✓ Tipi di pratica salvati');
}

/* ---------------- Etichette del menu (nome e colore di ogni tasto) ---------------- */

const MENU_PREDEFINITO = {};
(function () {
  document.querySelectorAll('.navmenu button[data-tab]').forEach(function (b) {
    MENU_PREDEFINITO[b.dataset.tab] = { testo: b.textContent.replace(/ /g, ' ').trim(), colore: (getComputedStyle(b).getPropertyValue('--tc') || '#1d4f91').trim() };
  });
})();
let MENU_IN_MODIFICA = null;

function etichetteMenu() {
  try { return JSON.parse(IMPOSTAZIONI.etichette_menu || '{}') || {}; } catch (e) { return {}; }
}
function etichettaMenu(tab) {
  const e = etichetteMenu()[tab] || {}, d = MENU_PREDEFINITO[tab] || {};
  return { testo: e.testo || d.testo || tab, colore: e.colore || d.colore || '#1d4f91' };
}
function applicaEtichetteMenu() {
  Object.keys(MENU_PREDEFINITO).forEach(function (tab) {
    const b = document.querySelector('.navmenu button[data-tab="' + tab + '"]');
    if (!b) return;
    const e = etichettaMenu(tab);
    b.textContent = e.testo;
    b.style.setProperty('--tc', e.colore);
    if (typeof TAB_LABELS !== 'undefined' && TAB_LABELS[tab]) TAB_LABELS[tab] = e.testo.toUpperCase();
  });
}

function renderEtichetteMenu(ricarica) {
  const wrap = document.getElementById('menu-etichette');
  if (!wrap) return;
  if (!auth.profilo || auth.profilo.ruolo !== 'admin') { wrap.innerHTML = ''; return; }
  if (ricarica || !MENU_IN_MODIFICA) MENU_IN_MODIFICA = Object.keys(MENU_PREDEFINITO).map(function (tab) { return Object.assign({ tab: tab }, etichettaMenu(tab)); });
  wrap.innerHTML = MENU_IN_MODIFICA.map(function (m, i) {
    const d = MENU_PREDEFINITO[m.tab];
    return '<div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px; padding:8px; border-radius:10px; border:1px solid var(--line); margin-bottom:6px; border-left:8px solid ' + esc(m.colore) + '">'
      + '<input type="color" value="' + esc(m.colore) + '" title="Colore del tasto" onchange="MENU_IN_MODIFICA[' + i + '].colore=this.value; renderEtichetteMenu()" style="width:42px; height:34px; padding:2px; flex:none">'
      + '<input value="' + esc(m.testo) + '" oninput="MENU_IN_MODIFICA[' + i + '].testo=this.value" style="flex:1; min-width:180px; font-weight:700">'
      + '<span style="font-size:12px; color:var(--sub)">originale: ' + esc(d.testo) + '</span>'
      + '<button type="button" title="Torna al nome e colore originali" onclick="MENU_IN_MODIFICA[' + i + '].testo=MENU_PREDEFINITO[\'' + m.tab + '\'].testo; MENU_IN_MODIFICA[' + i + '].colore=MENU_PREDEFINITO[\'' + m.tab + '\'].colore; renderEtichetteMenu()" style="padding:4px 10px">↺ Originale</button>'
      + '</div>';
  }).join('')
    + '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px">'
    + '<button type="button" class="btn-add" style="margin-top:0; background:#2f9e5f" onclick="salvaEtichetteMenu()">💾 Salva etichette del menu</button>'
    + '<button type="button" class="btn-add" style="margin-top:0; background:var(--line); color:var(--ink)" onclick="renderEtichetteMenu(true)">Annulla modifiche</button></div>';
}

async function salvaEtichetteMenu() {
  const cfg = {};
  for (const m of MENU_IN_MODIFICA) {
    const testo = String(m.testo || '').trim();
    if (!testo) { avviso('❌ Il tasto "' + MENU_PREDEFINITO[m.tab].testo + '" non può restare senza nome', true); return; }
    const d = MENU_PREDEFINITO[m.tab];
    if (testo !== d.testo || m.colore !== d.colore) cfg[m.tab] = { testo: testo, colore: m.colore };
  }
  const valore = JSON.stringify(cfg);
  const { data: righe, error } = await supabase.from('impostazioni').update({ valore: valore, aggiornato_il: new Date().toISOString() }).eq('chiave', 'etichette_menu').select('chiave');
  if (error || !righe || !righe.length) { avviso('❌ Etichette non salvate' + (error ? ': ' + error.message : ''), true); return; }
  IMPOSTAZIONI.etichette_menu = valore;
  applicaEtichetteMenu();
  renderEtichetteMenu(true);
  if (typeof renderPermessi === 'function') renderPermessi();
  avviso('✓ Etichette del menu salvate');
}
