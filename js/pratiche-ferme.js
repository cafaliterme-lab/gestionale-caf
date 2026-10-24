/* ---------------- ⏰ Pratiche ferme e 📜 report dalla più vecchia ----------------
   «Da fare» = pratica non annullata, non consegnata/definita, ancora prima della lavorazione ultimata
   (in arrivo, da lavorare scansionata, in lavorazione). Se dalla data di apertura passano più di 30 giorni
   arriva l'avviso: entrando nel programma e nella casella di «Oggi». Ogni avviso si può rimandare
   (7, 15 giorni o un mese) o togliere; la scelta vale per tutti gli operatori (tabella «pratiche_avvisi")
   e non conta come modifica della pratica. */

const STATI_DA_FARE = ['arrivo', 'da_lavorare_scansionata', 'lavorazione'];
const GIORNI_PRATICA_FERMA = 30;
const AVVISI_PRATICHE = { lista: {}, caricato: false, mostrato: false };

function praticaDaFare(p) { return !!p && !p.annullata && !(typeof eConsegnata === 'function' && eConsegnata(p)) && STATI_DA_FARE.indexOf(p.stato) >= 0; }
function giorniDaApertura(p) {
  const d = typeof parseDataIT === 'function' ? parseDataIT(p.data) : null;
  if (!d) return 0;
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  return Math.floor((oggi - new Date(d.a, d.m - 1, d.g)) / 86400000);
}
function oggiIsoFerme() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function statoAvvisoPratica(p) {
  const a = AVVISI_PRATICHE.lista[p.id];
  if (!a) return 'attivo';
  if (a.nascosto) return 'tolto';
  if (a.rimanda_al && a.rimanda_al > oggiIsoFerme()) return 'rimandato';
  return 'attivo';
}
// Le pratiche ancora da fare dell'anno di lavoro (quello scelto in alto nel programma), dalla più vecchia
function annoPraticheFerme() { return typeof annoAttivo === 'function' ? annoAttivo() : new Date().getFullYear(); }
function praticheDaFareInOrdine() {
  const anno = annoPraticheFerme();
  return (state.pratiche || []).filter(function (p) { return praticaDaFare(p) && (typeof annoPratica === 'function' ? annoPratica(p) : p.anno) === anno; }).sort(function (a, b) {
    return (giorniDaApertura(b) - giorniDaApertura(a)) || ((a.anno || 0) - (b.anno || 0)) || ((a.numero || 0) - (b.numero || 0));
  });
}
// Quelle che devono dare l'avviso adesso
function praticheFerme() {
  return praticheDaFareInOrdine().filter(function (p) { return giorniDaApertura(p) > GIORNI_PRATICA_FERMA && statoAvvisoPratica(p) === 'attivo'; });
}

async function caricaAvvisiPratiche() {
  if (!(typeof puo === 'function' && puo('registro'))) return;
  try {
    const r = await fetchSupabase('/rest/v1/pratiche_avvisi?select=*', 'GET');
    if (r && r.ok && Array.isArray(r.data)) { AVVISI_PRATICHE.lista = {}; r.data.forEach(function (a) { AVVISI_PRATICHE.lista[a.pratica_id] = a; }); AVVISI_PRATICHE.caricato = true; }
  } catch (e) { /* senza rete gli avvisi restano tutti attivi */ }
}
async function salvaAvvisoPratica(id, campi) {
  const riga = Object.assign({ pratica_id: id, rimanda_al: null, nascosto: false, chi: ((auth.profilo && auth.profilo.nome) || '').toUpperCase(), quando: new Date().toISOString() }, campi);
  let r;
  try { r = await fetchSupabase('/rest/v1/pratiche_avvisi?on_conflict=pratica_id', 'POST', riga, { Prefer: 'resolution=merge-duplicates,return=representation' }); } catch (e) { r = { ok: false }; }
  if (!r || !r.ok) { avviso('❌ Non salvato: controlla la connessione', true); return false; }
  AVVISI_PRATICHE.lista[id] = (Array.isArray(r.data) && r.data[0]) || riga;
  return true;
}
async function rimandaAvvisoPratica(id, giorni) {
  const d = new Date(); d.setDate(d.getDate() + giorni);
  const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  if (await salvaAvvisoPratica(id, { rimanda_al: iso })) { avviso('⏳ Avviso rimandato al ' + d.toLocaleDateString('it-IT')); ridisegnaFerme(); }
}
async function togliAvvisoPratica(id) {
  const p = (state.pratiche || []).find(function (x) { return x.id === id; });
  if (!confirm('Non avvisare più per ' + (p ? p.nome + ' (' + formattaProtocollo(p) + ')' : 'questa pratica') + '?\n\nPuoi sempre rimettere l\'avviso dal report «Pratiche dalla più vecchia».')) return;
  if (await salvaAvvisoPratica(id, { nascosto: true })) { avviso('🗑️ Avviso tolto'); ridisegnaFerme(); }
}
async function riattivaAvvisoPratica(id) {
  if (await salvaAvvisoPratica(id, { nascosto: false, rimanda_al: null })) { avviso('🔔 Avviso rimesso'); ridisegnaFerme(); }
}
function ridisegnaFerme() {
  if (document.getElementById('popup-ferme')) disegnaPraticheFerme();
  if (document.getElementById('popup-report-vecchie')) disegnaReportVecchie();
  if (typeof renderOggi === 'function') { try { renderOggi(); } catch (e) {} }
}
function apriPraticaFerma(id) {
  ['popup-ferme', 'popup-report-vecchie'].forEach(function (k) { const o = document.getElementById(k); if (o) o.remove(); });
  if (typeof apriDaStorico === 'function') apriDaStorico(id);
}

function rigaPraticaFermaHTML(p, conRiattiva) {
  const g = giorniDaApertura(p), st = statoAvvisoPratica(p), a = AVVISI_PRATICHE.lista[p.id];
  const bt = function (onclick, testo, col, titolo) { return '<button type="button" onclick="' + onclick + '" title="' + (titolo || '') + '" style="background:' + col + '; color:#fff; border:none; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:700; cursor:pointer">' + testo + '</button>'; };
  const id = esc(JSON.stringify(p.id));
  return '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:7px 0; border-bottom:1px solid var(--line); font-size:13px">'
    + '<span style="flex:1 1 260px"><b>' + esc(formattaProtocollo(p)) + '</b> · <b>' + esc(p.nome || '') + '</b> <span class="sub2">· ' + esc(p.tipo || '') + ' · ' + esc((STATI[p.stato] || {}).e || '') + ' ' + esc(statoLabel(p.stato)) + '</span>'
    + '<div class="sub2">aperta il ' + esc(p.data || '') + ' · <b style="color:' + (g > GIORNI_PRATICA_FERMA ? '#c0392b' : 'inherit') + '">da ' + g + ' giorn' + (g === 1 ? 'o' : 'i') + '</b>' + (p.inseritoDa ? ' · inserita da ' + esc(p.inseritoDa) : '')
    + (st === 'rimandato' ? ' · ⏳ avviso rimandato al ' + esc(new Date(a.rimanda_al).toLocaleDateString('it-IT')) : st === 'tolto' ? ' · 🔕 avviso tolto' : '') + '</div></span>'
    + '<span style="display:flex; gap:4px; flex-wrap:wrap">' + bt('apriPraticaFerma(' + id + ')', '📂 Apri', '#1d4f91')
    + (conRiattiva && st !== 'attivo' ? bt('riattivaAvvisoPratica(' + id + ')', '🔔 Rimetti avviso', '#6d3fa0')
      : bt('rimandaAvvisoPratica(' + id + ', 7)', '⏳ 7 gg', '#b35f0c', 'Rimanda l\'avviso di 7 giorni') + bt('rimandaAvvisoPratica(' + id + ', 15)', '⏳ 15 gg', '#b35f0c', 'Rimanda l\'avviso di 15 giorni') + bt('rimandaAvvisoPratica(' + id + ', 30)', '⏳ 1 mese', '#b35f0c', 'Rimanda l\'avviso di un mese') + bt('togliAvvisoPratica(' + id + ')', '🗑️', '#6b7280', 'Non avvisare più per questa pratica'))
    + '</span></div>';
}
function popupFerme(id, colore) {
  const vecchio = document.getElementById(id); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = id;
  ov.style.cssText = 'position:fixed; inset:0; z-index:457; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:10px';
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-chiudi]')) ov.remove(); });
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:14px; border-top:6px solid ' + colore + '; max-width:900px; width:100%; max-height:92vh; display:flex; flex-direction:column; box-shadow:0 10px 40px rgba(0,0,0,.3)"><div data-corpo style="padding:12px 16px; overflow:auto"></div></div>';
  document.body.appendChild(ov);
  return ov;
}

// ⏰ Avviso: pratiche ancora da fare aperte da più di 30 giorni
function apriAvvisoPraticheFerme() { popupFerme('popup-ferme', '#c0392b'); disegnaPraticheFerme(); }
function disegnaPraticheFerme() {
  const ov = document.getElementById('popup-ferme'); if (!ov) return;
  const l = praticheFerme();
  ov.querySelector('[data-corpo]').innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px"><b style="font-size:18px; color:#c0392b">⏰ Pratiche del ' + annoPraticheFerme() + ' ferme da più di un mese (' + l.length + ')</b><button type="button" data-chiudi style="border:none; background:none; font-size:22px; cursor:pointer; color:var(--ink)">✕</button></div>'
    + '<div class="sub2" style="margin:4px 0 8px">Pratiche aperte da più di ' + GIORNI_PRATICA_FERMA + ' giorni e non ancora portate a lavorazione ultimata (in arrivo, da lavorare scansionata, in lavorazione). Puoi aprirle, rimandare l\'avviso o toglierlo: la scelta vale per tutti.</div>'
    + (l.length ? l.map(function (p) { return rigaPraticaFermaHTML(p, false); }).join('') : '<div class="empty" style="padding:14px">✓ Nessuna pratica ferma da più di un mese.</div>')
    + '<div style="display:flex; justify-content:space-between; gap:8px; margin-top:10px; flex-wrap:wrap"><button type="button" onclick="apriReportPraticheVecchie()" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer">📜 Tutte le pratiche da fare del ' + annoPraticheFerme() + ', dalla più vecchia</button><button type="button" data-chiudi style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:7px 16px; font-weight:700; cursor:pointer">Chiudi</button></div>';
}

// 📜 Report: tutte le pratiche da fare, dalla più vecchia alla più nuova
function apriReportPraticheVecchie() { const f = document.getElementById('popup-ferme'); if (f) f.remove(); popupFerme('popup-report-vecchie', '#1d4f91'); disegnaReportVecchie(); }
function disegnaReportVecchie() {
  const ov = document.getElementById('popup-report-vecchie'); if (!ov) return;
  const l = praticheDaFareInOrdine(), ferme = l.filter(function (p) { return giorniDaApertura(p) > GIORNI_PRATICA_FERMA; }).length;
  const bt = function (onclick, testo, col) { return '<button type="button" onclick="' + onclick + '" style="background:' + col + '; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:700; cursor:pointer">' + testo + '</button>'; };
  ov.querySelector('[data-corpo]').innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px"><b style="font-size:18px; color:#1d4f91">📜 Pratiche da fare del ' + annoPraticheFerme() + ', dalla più vecchia</b><button type="button" data-chiudi style="border:none; background:none; font-size:22px; cursor:pointer; color:var(--ink)">✕</button></div>'
    + '<div style="margin:6px 0 8px; font-size:13.5px">' + (l.length ? '<b>' + l.length + '</b> pratiche non ancora portate a lavorazione ultimata · la più vecchia è del <b>' + esc(l[0].data || '') + '</b> (da ' + giorniDaApertura(l[0]) + ' giorni)' + (ferme ? ' · <b style="color:#c0392b">' + ferme + ' ferme da più di un mese</b>' : '') : 'Nessuna pratica da fare.') + '</div>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px">' + bt('stampaReportVecchie()', '🖨️ Stampa', '#1d4f91') + bt('excelReportVecchie()', '📊 Excel', '#1a7f37') + '</div>'
    + l.map(function (p) { return rigaPraticaFermaHTML(p, true); }).join('');
}
function righeReportVecchie() {
  return praticheDaFareInOrdine().map(function (p) {
    const st = statoAvvisoPratica(p);
    return { 'Protocollo': formattaProtocollo(p), 'Aperta il': p.data || '', 'Giorni': giorniDaApertura(p), 'Cliente': p.nome || '', 'Tipo': p.tipo || '', 'Stato': statoLabel(p.stato), 'Inserita da': p.inseritoDa || '', 'Avviso': st === 'tolto' ? 'tolto' : st === 'rimandato' ? 'rimandato' : (giorniDaApertura(p) > GIORNI_PRATICA_FERMA ? 'ferma da più di un mese' : ''), 'Note': p.note || '' };
  });
}
function excelReportVecchie() {
  if (typeof XLSX === 'undefined') { alert('Excel non disponibile: controlla la connessione e riprova.'); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(righeReportVecchie()), 'Pratiche da fare');
  XLSX.writeFile(wb, 'pratiche-da-fare-' + annoPraticheFerme() + '-dalla-piu-vecchia.xlsx');
}
function stampaReportVecchie() {
  const righe = righeReportVecchie();
  const caf = typeof datiCafStampa === 'function' ? datiCafStampa() : {};
  const html = '<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Pratiche da fare</title><style>@page{size:A4 landscape; margin:12mm} body{font-family:Arial,Helvetica,sans-serif; color:#0f1b2d; font-size:11px; margin:0; padding:14px} h1{font-size:17px; margin:0 0 4px; color:#1d4f91} table{width:100%; border-collapse:collapse; margin-top:10px} th,td{border:1px solid #c8d0dc; padding:4px 6px; text-align:left} th{background:#e8f0fb} .rosso{color:#c0392b; font-weight:700}</style></head><body>'
    + '<h1>Pratiche da fare del ' + annoPraticheFerme() + ', dalla più vecchia</h1><div>' + esc(caf.nome || 'CAF CISL Alì Terme') + ' · stampato il ' + esc(new Date().toLocaleDateString('it-IT')) + ' · ' + righe.length + ' pratiche non ancora portate a lavorazione ultimata</div>'
    + '<table><tr>' + ['Protocollo', 'Aperta il', 'Giorni', 'Cliente', 'Tipo', 'Stato', 'Inserita da', 'Avviso', 'Note'].map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>'
    + righe.map(function (r) { return '<tr>' + Object.keys(r).map(function (k) { return '<td' + (k === 'Giorni' && r.Giorni > GIORNI_PRATICA_FERMA ? ' class="rosso"' : '') + '>' + esc(String(r[k])) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></body></html>';
  if (typeof mostraPaginaNelProgramma === 'function') mostraPaginaNelProgramma(html, 'Pratiche da fare');
  else { const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); } }
}

// Entrando nel programma: una volta per sessione, se ci sono pratiche ferme
setInterval(async function () {
  if (AVVISI_PRATICHE.mostrato || typeof auth === 'undefined' || !auth.profilo || !(typeof puo === 'function' && puo('registro'))) return;
  const ov = document.getElementById('login-overlay'); if (ov && ov.style.display !== 'none') return;
  if (!(state.pratiche || []).length) return;
  if (!AVVISI_PRATICHE.caricato) { AVVISI_PRATICHE.mostrato = true; await caricaAvvisiPratiche(); AVVISI_PRATICHE.mostrato = false; if (!AVVISI_PRATICHE.caricato) return; if (typeof renderOggi === 'function') { try { renderOggi(); } catch (e) {} } }
  AVVISI_PRATICHE.mostrato = true;
  try { if (sessionStorage.getItem('ferme-mostrate') === oggiIsoFerme()) return; sessionStorage.setItem('ferme-mostrate', oggiIsoFerme()); } catch (e) {}
  if (praticheFerme().length && !document.querySelector('[id^="popup-"]')) apriAvvisoPraticheFerme();
}, 3000);
