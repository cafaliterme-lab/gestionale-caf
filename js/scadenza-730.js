/* ---------------- 📅 Scadenza 730 del 30 settembre ----------------
   Dal 1° al 30 settembre: avviso con tutti i 730 dell'anno ancora da definire (non consegnati, senza rinunce
   né annullate), divisi in «ancora da lavorare» e «lavorati, da consegnare». Si apre una volta al giorno
   entrando nel programma e c'è la casella in «Oggi». */

const MESE_AVVISO_730 = 9, GIORNO_SCADENZA_730 = 30;

function periodoAvviso730() { const d = new Date(); return d.getMonth() + 1 === MESE_AVVISO_730 && d.getDate() <= GIORNO_SCADENZA_730; }
function giorniAllaScadenza730() { const d = new Date(); d.setHours(0, 0, 0, 0); return Math.round((new Date(d.getFullYear(), MESE_AVVISO_730 - 1, GIORNO_SCADENZA_730) - d) / 86400000); }
function settecentotrentaDaDefinire() {
  const anno = typeof annoAttivo === 'function' ? annoAttivo() : new Date().getFullYear();
  return (state.pratiche || []).filter(function (p) {
    return e730(p) && annoPratica(p) === anno && !p.annullata && !eRinuncia(p) && !eConsegnata(p);
  }).sort(function (a, b) { return (a.numero || 0) - (b.numero || 0); });
}
function apriAvviso730() {
  if (typeof popupFerme !== 'function') return;
  const ov = popupFerme('popup-scad730', '#1d4f91');
  const l = settecentotrentaDaDefinire();
  const daLavorare = l.filter(function (p) { return ['lavorata', 'pagato', 'da_pagare', 'pagato_da_ritirare', 'non_paga'].indexOf(p.stato) < 0; });
  const lavorati = l.filter(function (p) { return daLavorare.indexOf(p) < 0; });
  const g = giorniAllaScadenza730();
  const riga = function (p) {
    return '<div class="el-riga" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:6px 0; border-bottom:1px solid var(--line); font-size:13px">'
      + '<span style="flex:1 1 260px"><b>' + esc(formattaProtocollo(p)) + '</b> · <b>' + esc(p.nome || '') + '</b>' + (p.congiunta ? ' <span class="sub2">(congiunta con ' + esc(p.congiunta) + ')</span>' : '')
      + ' <span class="sub2">· ' + esc(p.tipo || '') + ' · ' + esc((STATI[p.stato] || {}).e || '') + ' ' + esc(statoLabel(p.stato)) + '</span></span>'
      + '<button type="button" onclick="document.getElementById(\'popup-scad730\').remove(); apriDaStorico(' + esc(JSON.stringify(p.id)) + ')" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:700; cursor:pointer">📂 Apri</button></div>';
  };
  const sez = function (titolo, colore, lista) { return lista.length ? '<div style="font-weight:800; color:' + colore + '; margin:10px 0 2px">' + titolo + ' (' + sommaPeso(lista) + ')</div>' + lista.map(riga).join('') : ''; };
  ov.querySelector('[data-corpo]').innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px"><b style="font-size:18px; color:#1d4f91">📅 730 da definire entro il 30 settembre</b><button type="button" data-chiudi style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:6px 12px; cursor:pointer">✕</button></div>'
    + '<div style="margin:6px 0; font-size:13.5px">' + (g > 0 ? 'Mancano <b>' + g + ' giorn' + (g === 1 ? 'o' : 'i') + '</b> alla scadenza del 30/09.' : '<b style="color:#c0392b">Oggi è l\'ultimo giorno.</b>')
    + ' Ci sono <b>' + sommaPeso(l) + '</b> dichiarazioni 730 del ' + (typeof annoAttivo === 'function' ? annoAttivo() : '') + ' non ancora definite (la congiunta conta 2).</div>'
    + (l.length > 1 ? campoRicercaElenco('scad730', 'Cerca un nome, un protocollo o un collaboratore…') : '')
    + (l.length ? sez('📥 Ancora da lavorare', '#c0392b', daLavorare) + sez('📦 Lavorati, da consegnare/definire', '#8d5a3b', lavorati) : '<div class="empty" style="padding:14px">✓ Tutti i 730 sono definiti.</div>');
}
// casella in «Oggi» (solo a settembre, fino al 30)
function tileAvviso730(tile) {
  if (!periodoAvviso730()) return '';
  const n = sommaPeso(settecentotrentaDaDefinire());
  return tile('📅', n, '730 da definire entro il 30/09', '#1d4f91', 'apriAvviso730()', 'mancano ' + giorniAllaScadenza730() + ' giorni alla scadenza');
}
// Entrando nel programma a settembre: una volta al giorno, se ci sono 730 da definire
setInterval(function () {
  if (!periodoAvviso730() || typeof auth === 'undefined' || !auth.profilo || !(typeof puo === 'function' && puo('registro'))) return;
  const lo = document.getElementById('login-overlay'); if (lo && lo.style.display !== 'none') return;
  if (!(state.pratiche || []).length || document.querySelector('[id^="popup-"]')) return;
  const oggi = new Date().toDateString();
  try { if (localStorage.getItem('avviso730-mostrato') === oggi) return; localStorage.setItem('avviso730-mostrato', oggi); } catch (e) { return; }
  if (settecentotrentaDaDefinire().length) apriAvviso730();
}, 4000);
