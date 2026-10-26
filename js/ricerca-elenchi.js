/* ---------------- 🔎 Ricerca negli elenchi delle finestre ----------------
   Una casella «Cerca» uguale per tutti gli elenchi (documenti scaduti, pratiche ferme, 730 da definire,
   WhatsApp multiplo, buste paga, trasferimento colf, auguri, campagna 730…). Le righe dell'elenco hanno la
   classe «el-riga»: la ricerca le nasconde senza ridisegnare la finestra (si continua a scrivere senza perdere
   il cursore). Il testo cercato resta anche quando la finestra si ridisegna (dopo un invio). Apostrofi, spazi
   e accenti non contano. */

const RICERCA_ELENCHI = {};

function campoRicercaElenco(chiave, segnaposto) {
  return '<div class="el-cerca-box" style="display:flex; gap:8px; align-items:center; margin:6px 0">'
    + '<input type="search" data-el-chiave="' + esc(chiave) + '" value="' + esc(RICERCA_ELENCHI[chiave] || '') + '" placeholder="🔎 ' + esc(segnaposto || 'Cerca un nome…') + '" autocomplete="off" oninput="filtraElenco(this)" style="flex:1; min-width:0; margin:0">'
    + '<span class="sub2 el-cerca-n" style="white-space:nowrap"></span></div>';
}
function chiaveElenco(t) { return typeof chiaveRicerca === 'function' ? chiaveRicerca(t) : String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
// il contenitore dell'elenco: il primo antenato della casella che contiene righe
function contenitoreElenco(input) {
  let el = input.parentElement;
  while (el && el !== document.body && !el.querySelector('.el-riga')) el = el.parentElement;
  return el && el !== document.body ? el : null;
}
function filtraElenco(input) {
  RICERCA_ELENCHI[input.dataset.elChiave] = input.value;
  applicaRicercaElenco(input);
}
function applicaRicercaElenco(input) {
  const box = contenitoreElenco(input);
  const n = input.parentElement.querySelector('.el-cerca-n');
  if (!box) { if (n) n.textContent = ''; return; }
  const k = chiaveElenco(input.value);
  let trovate = 0;
  box.querySelectorAll('.el-riga').forEach(function (r) {
    const si = !k || chiaveElenco(r.dataset.cerca || r.innerText).indexOf(k) >= 0;
    r.style.display = si ? '' : 'none';
    if (si) trovate++;
  });
  if (n) n.textContent = k ? (trovate ? 'trovate ' + trovate : 'nessuna') : '';
}
// dopo ogni ridisegno delle finestre si riapplica la ricerca già scritta
let RICERCA_ELENCHI_TIMER = null;
new MutationObserver(function () {
  if (RICERCA_ELENCHI_TIMER) return;
  RICERCA_ELENCHI_TIMER = setTimeout(function () {
    RICERCA_ELENCHI_TIMER = null;
    document.querySelectorAll('input[data-el-chiave]').forEach(function (i) { if (i.value) applicaRicercaElenco(i); });
  }, 60);
}).observe(document.documentElement, { childList: true, subtree: true });
