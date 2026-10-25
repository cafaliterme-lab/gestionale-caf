/* ---------------- 💼 Buste paga colf e badanti, mese per mese ----------------
   Ogni contratto colf e badanti in corso (qualsiasi stato tranne «Pratica cessata», non annullato e non trasferito nell'anno dopo)
   ha una busta paga da compilare ogni mese. Dal giorno 25 il mese in corso è «da fare»: entrando nel
   programma compare l'avviso e in «Oggi» c'è la casella. Si spunta ✓ quando la busta paga è compilata
   (tabella «buste_paga», una riga per contratto e mese): i mesi passati non spuntati restano in evidenza. */

const BUSTE_PAGA = { fatte: {}, caricato: false, mostrato: false, mese: null };
const GIORNO_AVVISO_BUSTE = 25;
const MESI_BUSTE = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
// dalla nascita di questa funzione: i mesi prima non si chiedono
const PRIMO_MESE_BUSTE = '2026-10';

function meseIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function nomeMese(m) { const [a, n] = String(m).split('-'); return MESI_BUSTE[Number(n) - 1] + ' ' + a; }
function meseDopo(m, k) { const [a, n] = String(m).split('-').map(Number); const d = new Date(a, n - 1 + (k || 1), 1); return meseIso(d); }
// Ultimo mese per cui la busta paga va già fatta: dal 25 il mese in corso, prima il mese scorso
function meseBusteDovuto() { const d = new Date(); return d.getDate() >= GIORNO_AVVISO_BUSTE ? meseIso(d) : meseDopo(meseIso(d), -1); }

function contrattiColfAttivi() {
  return (state.pratiche || []).filter(function (p) { return eColf(p.tipo) && p.stato !== 'pratica_cessata' && !p.annullata && !p.trasferitaIn; })
    .sort(function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || '')); });
}
// Primo mese da chiedere per un contratto: il mese di apertura della pratica (non prima di PRIMO_MESE_BUSTE)
function primoMeseContratto(p) {
  const d = typeof parseDataIT === 'function' ? parseDataIT(p.data) : null;
  const m = d ? d.a + '-' + String(d.m).padStart(2, '0') : PRIMO_MESE_BUSTE;
  return m > PRIMO_MESE_BUSTE ? m : PRIMO_MESE_BUSTE;
}
function bustaFatta(p, mese) { return !!BUSTE_PAGA.fatte[p.id + '|' + mese]; }
// Buste paga che mancano fino al mese dovuto (anche i mesi passati non spuntati)
function bustePagaMancanti() {
  const fino = meseBusteDovuto(), l = [];
  contrattiColfAttivi().forEach(function (p) {
    for (let m = primoMeseContratto(p), i = 0; m <= fino && i < 36; m = meseDopo(m), i++) if (!bustaFatta(p, m)) l.push({ p: p, mese: m });
  });
  return l;
}

async function caricaBustePaga() {
  if (!(typeof puo === 'function' && puo('registro'))) return;
  try {
    const r = await fetchSupabase('/rest/v1/buste_paga?select=*', 'GET');
    if (r && r.ok && Array.isArray(r.data)) { BUSTE_PAGA.fatte = {}; r.data.forEach(function (x) { BUSTE_PAGA.fatte[x.pratica_id + '|' + x.mese] = x; }); BUSTE_PAGA.caricato = true; }
  } catch (e) { /* senza rete restano tutte da fare */ }
}
async function spuntaBustaPaga(id, mese, fatta) {
  let r;
  try {
    r = fatta
      ? await fetchSupabase('/rest/v1/buste_paga', 'POST', { pratica_id: id, mese: mese, chi: ((auth.profilo && auth.profilo.nome) || '').toUpperCase() }, { Prefer: 'resolution=merge-duplicates,return=representation' })
      : await fetchSupabase('/rest/v1/buste_paga?pratica_id=eq.' + encodeURIComponent(id) + '&mese=eq.' + encodeURIComponent(mese), 'DELETE', null, { Prefer: 'return=minimal' });
  } catch (e) { r = { ok: false }; }
  if (!r || !r.ok) { avviso('❌ Non salvato: controlla la connessione', true); disegnaBustePaga(); return; }
  if (fatta) BUSTE_PAGA.fatte[id + '|' + mese] = (Array.isArray(r.data) && r.data[0]) || { pratica_id: id, mese: mese, fatta_il: new Date().toISOString(), chi: ((auth.profilo && auth.profilo.nome) || '').toUpperCase() };
  else delete BUSTE_PAGA.fatte[id + '|' + mese];
  disegnaBustePaga();
  if (typeof renderOggi === 'function') { try { renderOggi(); } catch (e) {} }
}

function apriBustePaga(mese) {
  BUSTE_PAGA.mese = mese || (bustePagaMancanti()[0] || {}).mese || meseBusteDovuto();
  const vecchio = document.getElementById('popup-buste'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-buste';
  ov.style.cssText = 'position:fixed; inset:0; z-index:457; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:10px';
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-chiudi]')) ov.remove(); });
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:14px; border-top:6px solid #1f8a70; max-width:760px; width:100%; max-height:92vh; display:flex; flex-direction:column; box-shadow:0 10px 40px rgba(0,0,0,.3)"><div data-corpo style="padding:12px 16px; overflow:auto"></div></div>';
  document.body.appendChild(ov);
  if (!BUSTE_PAGA.caricato) caricaBustePaga().then(disegnaBustePaga);
  disegnaBustePaga();
}
function scegliMeseBuste(m) { BUSTE_PAGA.mese = m; disegnaBustePaga(); }
function disegnaBustePaga() {
  const ov = document.getElementById('popup-buste'); if (!ov) return;
  const contratti = contrattiColfAttivi(), mese = BUSTE_PAGA.mese || meseBusteDovuto(), dovuto = meseBusteDovuto();
  const anno = Number(mese.slice(0, 4));
  // i 12 mesi dell'anno, con quante buste fatte su quante dovute
  const chip = function (m) {
    const dovute = contratti.filter(function (p) { return primoMeseContratto(p) <= m; });
    const fatte = dovute.filter(function (p) { return bustaFatta(p, m); }).length, on = m === mese;
    const col = !dovute.length || m > dovuto ? '#8a8f98' : (fatte === dovute.length ? '#1a7f37' : '#c0392b');
    return '<button type="button" onclick="scegliMeseBuste(\'' + m + '\')" style="padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700; cursor:pointer; border:2px solid ' + col + '; background:' + (on ? col : 'transparent') + '; color:' + (on ? '#fff' : col) + '">' + MESI_BUSTE[Number(m.slice(5)) - 1].slice(0, 3) + (dovute.length && m <= dovuto ? ' ' + (fatte === dovute.length ? '✓' : fatte + '/' + dovute.length) : '') + '</button>';
  };
  const mesi = []; for (let i = 1; i <= 12; i++) mesi.push(anno + '-' + String(i).padStart(2, '0'));
  const dovute = contratti.filter(function (p) { return primoMeseContratto(p) <= mese; });
  const fatte = dovute.filter(function (p) { return bustaFatta(p, mese); }).length;
  const mancanti = bustePagaMancanti();
  const altriMesi = mancanti.filter(function (x) { return x.mese !== mese; });
  ov.querySelector('[data-corpo]').innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px"><b style="font-size:18px; color:#1f8a70">💼 Buste paga colf e badanti</b><button type="button" data-chiudi style="border:none; background:none; font-size:22px; cursor:pointer; color:var(--ink)">✕</button></div>'
    + '<div class="sub2" style="margin:4px 0 8px">Ogni mese una busta paga per ogni contratto attivo. Dal ' + GIORNO_AVVISO_BUSTE + ' del mese il programma avvisa; spunta ✓ quando è compilata.</div>'
    + '<div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center; margin-bottom:8px"><button type="button" onclick="scegliMeseBuste(\'' + meseDopo(mesi[0], -12) + '\')" style="border:none; background:none; cursor:pointer; font-weight:800">◀ ' + (anno - 1) + '</button>'
    + mesi.map(chip).join('') + '<button type="button" onclick="scegliMeseBuste(\'' + meseDopo(mesi[0], 12) + '\')" style="border:none; background:none; cursor:pointer; font-weight:800">' + (anno + 1) + ' ▶</button></div>'
    + '<div style="font-size:15px; font-weight:800; margin:6px 0">' + nomeMese(mese).replace(/^./, function (c) { return c.toUpperCase(); }) + ': ' + (dovute.length ? fatte + ' di ' + dovute.length + ' compilate' + (fatte === dovute.length ? ' ✓' : '') : 'nessun contratto attivo') + (mese > dovuto ? ' <span class="sub2">(si fanno dal ' + GIORNO_AVVISO_BUSTE + ' del mese)</span>' : '') + '</div>'
    + (dovute.length ? dovute.map(function (p) {
      const f = BUSTE_PAGA.fatte[p.id + '|' + mese];
      return '<label style="display:flex; gap:10px; align-items:center; padding:7px 4px; border-bottom:1px solid var(--line); cursor:pointer; font-size:13.5px' + (f ? '; background:color-mix(in srgb, #1a7f37 7%, var(--card))' : '') + '">'
        + '<input type="checkbox"' + (f ? ' checked' : '') + ' onchange="spuntaBustaPaga(' + esc(JSON.stringify(p.id)) + ', \'' + mese + '\', this.checked)" style="width:20px; height:20px">'
        + '<span style="flex:1"><b>' + esc(p.nome || '') + '</b> <span class="sub2">· ' + esc(formattaProtocollo(p)) + (p.scadenzaAssistenza ? ' · assistenza fino al ' + esc(p.scadenzaAssistenza) : '') + '</span></span>'
        + (f ? '<span style="font-size:12px; font-weight:800; color:#1a7f37">✓ compilata il ' + esc(new Date(f.fatta_il || Date.now()).toLocaleDateString('it-IT')) + (f.chi ? ' da ' + esc(f.chi) : '') + '</span>' : (mese <= dovuto ? '<span style="font-size:12px; font-weight:800; color:#c0392b">da fare</span>' : '')) + '</label>';
    }).join('') : '<div class="empty" style="padding:14px">Nessun contratto colf e badanti in corso in questo mese (le pratiche «Contratti colf e badanti» non cessate né annullate).</div>')
    + (altriMesi.length ? '<div style="margin-top:10px; padding:8px 12px; border-radius:10px; border:2px solid #c0392b; font-size:13px"><b style="color:#c0392b">⚠️ Mancano anche:</b> ' + Object.keys(altriMesi.reduce(function (o, x) { o[x.mese] = (o[x.mese] || 0) + 1; return o; }, {})).sort().map(function (m) { const n = altriMesi.filter(function (x) { return x.mese === m; }).length; return '<a href="#" onclick="scegliMeseBuste(\'' + m + '\'); return false">' + nomeMese(m) + ' (' + n + ')</a>'; }).join(' · ') + '</div>' : '')
    + '<div style="text-align:right; margin-top:10px"><button type="button" data-chiudi style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:7px 16px; font-weight:700; cursor:pointer">Chiudi</button></div>';
}

// Entrando nel programma: una volta al giorno, se ci sono buste paga da fare
setInterval(async function () {
  if (BUSTE_PAGA.mostrato || typeof auth === 'undefined' || !auth.profilo || !(typeof puo === 'function' && puo('registro'))) return;
  const ov = document.getElementById('login-overlay'); if (ov && ov.style.display !== 'none') return;
  if (!(state.pratiche || []).length) return;
  BUSTE_PAGA.mostrato = true;
  if (!BUSTE_PAGA.caricato) { await caricaBustePaga(); if (!BUSTE_PAGA.caricato) { BUSTE_PAGA.mostrato = false; return; } if (typeof renderOggi === 'function') { try { renderOggi(); } catch (e) {} } }
  const oggi = new Date().toDateString();
  try { if (localStorage.getItem('buste-avviso') === oggi) return; } catch (e) {}
  if (!bustePagaMancanti().length) return;
  // aspetta che non ci sia un'altra finestra aperta (es. pratiche ferme)
  const prova = function () {
    if (document.querySelector('[id^="popup-"]')) { setTimeout(prova, 4000); return; }
    try { localStorage.setItem('buste-avviso', oggi); } catch (e) {}
    apriBustePaga();
  };
  prova();
}, 3500);
