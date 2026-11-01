/* ---------------- 📜 Cronologia della pratica ----------------
   Tasto «📜 Cronologia» nella scheda della pratica (registro): in ordine di tempo, dalla prima all'ultima,
   tutto quello che è successo alla pratica:
   - inserimento, modifiche campo per campo (prima → dopo: stato, pagamenti, fattura, consegna…), con chi e quando
     (tabella pratiche_storico, riempita dal database a ogni modifica);
   - i messaggi WhatsApp ed e-mail mandati per quella pratica (tabella comunicazioni).
   In cima, «Passaggi principali» presi dalle date che la pratica tiene da sola (presa in carico, fine lavorazione,
   fattura, consegna/definita, pagamento, avvisi): ci sono anche per le pratiche fatte quando la registrazione
   delle modifiche era spenta (dal 5/10 al 1/11/2026).
   Solo lettura. */

// passaggi principali dalle date della pratica (e, per il pagamento, dalla cronologia se c'è)
function passaggiPratica(p, storico) {
  const passi = [];
  const ora = function (ts) { const d = new Date(ts); return isNaN(d) ? '' : ' alle ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const giorno = function (ts) { const d = new Date(ts); return isNaN(d) ? '' : d.toLocaleDateString('it-IT'); };
  const passo = function (icona, testo, data) { passi.push({ icona: icona, testo: testo, data: data || '' }); };
  passo('📥', 'Presa in carico' + (p.inseritoDa ? ' da <b>' + esc(p.inseritoDa) + '</b>' : ''), (p.data || (p.inseritoIl ? giorno(p.inseritoIl) : '')) + (p.inseritoIl ? ora(p.inseritoIl) : ''));
  if (p.dataFine) passo('🛠️', 'Lavorata (fine lavorazione)', p.dataFine);
  if (p.numFattura || p.dataFattura) passo('🧾', 'Fattura' + (p.numFattura ? ' n. <b>' + esc(p.numFattura) + '</b>' : '') + (Number(p.compenso) > 0 ? ' di ' + fmtEuro(p.compenso) : ''), p.dataFattura || '');
  if (p.whatsappInviato) passo('💬', 'Cliente avvisato su WhatsApp che è pronta', p.whatsappInviato);
  if (p.emailInviata) { const m = /^(.*?)\s*il\s+(\d{2}\/\d{2}\/\d{4})/.exec(String(p.emailInviata)); passo('📧', 'E-mail al cliente' + (m && m[1] ? ': ' + esc(m[1]) : ''), m ? m[2] : ''); }
  if (p.consegnataIl) passo('📦', /definit/i.test(statoLabel(p.stato) || '') ? 'Definita' : 'Consegnata / definita', p.consegnataIl);
  // pagamento: quando il «pagato» è cambiato nella cronologia; altrimenti solo l'importo
  const cambiPag = (storico || []).filter(function (r) { return r.azione === 'modificata' && r.modifiche && r.modifiche.pagato; });
  let recuperi = p.recuperi; try { if (typeof recuperi === 'string') recuperi = JSON.parse(recuperi); } catch (e) { recuperi = []; }
  if (Number(p.pagato) > 0) {
    const primo = cambiPag[0];
    passo('💶', 'Pagata <b>' + fmtEuro(p.pagato) + '</b>' + (p.metodoPagamento ? ' (' + esc(p.metodoPagamento) + ')' : '') + (primo && primo.chi ? ' · registrato da ' + esc(primo.chi) : ''),
      primo ? giorno(primo.quando) + ora(primo.quando) : (Array.isArray(recuperi) && recuperi.length ? '' : 'data non registrata'));
  }
  (Array.isArray(recuperi) ? recuperi : []).forEach(function (r) { passo('💶', 'Pagamento arretrato ' + fmtEuro(r.importo) + (r.metodo ? ' (' + esc(r.metodo) + ')' : ''), r.data || ''); });
  if (p.annullata) passo('🚫', 'Annullata' + (p.annullataMotivo ? ': ' + esc(p.annullataMotivo) : ''), p.annullataIl ? giorno(p.annullataIl) : '');
  passo('📌', 'Stato attuale: <b>' + esc(statoLabel(p.stato) || p.stato || '') + '</b>', '');
  return passi;
}
function passaggiPraticaHTML(passi) {
  return '<div style="border:1px solid var(--line); border-radius:10px; padding:8px 12px; margin-bottom:12px; background:color-mix(in srgb, #1d4f91 5%, var(--card))">'
    + '<div style="font-weight:800; color:#1d4f91; margin-bottom:4px">📌 Passaggi principali</div>'
    + passi.map(function (x) { return '<div style="display:flex; gap:8px; padding:4px 0; font-size:13px"><span style="flex:none">' + x.icona + '</span><span style="flex:1">' + x.testo + '</span>'
      + (x.data ? '<span style="flex:none; color:var(--sub); font-size:12.5px; white-space:nowrap">' + esc(x.data) + '</span>' : '') + '</div>'; }).join('')
    + '</div>';
}

async function apriCronologiaPratica(id) {
  const p = (state.pratiche || []).concat(state.annullate || []).find(function (x) { return x.id === id; });
  const vecchio = document.getElementById('popup-cronologia'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-cronologia';
  ov.style.cssText = 'position:fixed; inset:0; z-index:462; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:10px';
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-chiudi]')) ov.remove(); });
  const titolo = p ? esc(formattaProtocollo(p)) + ' · ' + esc(p.nome || '') + ' <span style="color:var(--sub); font-weight:400">(' + esc(p.tipo || '') + ')</span>' : '';
  const testa = '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px"><b style="font-size:17px; color:#1d4f91">📜 Cronologia della pratica</b>'
    + '<button type="button" data-chiudi style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:6px 12px; cursor:pointer">✕</button></div>'
    + '<div style="font-size:14px; font-weight:700; margin:2px 0 10px">' + titolo + '</div>';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:14px; border-top:6px solid #1d4f91; max-width:680px; width:100%; max-height:90vh; overflow:auto; padding:14px 16px; box-shadow:0 10px 40px rgba(0,0,0,.3)">'
    + testa + '<div id="cron-lista" class="sub2">⏳ Carico la cronologia…</div></div>';
  document.body.appendChild(ov);

  const [storico, mess] = await Promise.all([
    leggiStorico('&pratica_id=eq.' + encodeURIComponent(id), 500),
    fetchSupabase('/rest/v1/comunicazioni?select=quando,canale,motivo,nome,telefono,email,testo,operatore&pratica_id=eq.' + encodeURIComponent(id) + '&order=quando.asc&limit=300')
      .then(function (r) { return r && r.ok && Array.isArray(r.data) ? r.data : []; }, function () { return []; }),
  ]);
  const box = document.getElementById('cron-lista'); if (!box) return;
  const eventi = [];
  (storico || []).forEach(function (r) { eventi.push({ quando: r.quando, html: rigaStoricoHTML(r, false) }); });
  mess.forEach(function (m) {
    const wa = String(m.canale || '').toLowerCase().indexOf('whats') >= 0;
    eventi.push({ quando: m.quando, html: '<div style="padding:6px 0; border-bottom:1px solid var(--line); font-size:12.5px">'
      + (wa ? '💬' : '📧') + ' <span style="color:var(--sub)">' + esc(quandoStorico(m.quando)) + '</span> · <b>' + esc(m.operatore || '') + '</b> ha mandato ' + (wa ? 'un WhatsApp' : 'un\'e-mail')
      + (m.motivo ? ' <b>«' + esc(m.motivo) + '»</b>' : '') + ' a ' + esc(m.nome || '') + (m.telefono || m.email ? ' <span style="color:var(--sub)">(' + esc(wa ? (m.telefono || '') : (m.email || m.telefono || '')) + ')</span>' : '')
      + (m.testo ? '<details style="margin-left:22px"><summary style="cursor:pointer; color:var(--sub)">testo del messaggio</summary><div style="white-space:pre-wrap; font-size:12px; padding:4px 0">' + esc(m.testo) + '</div></details>' : '')
      + '</div>' });
  });
  eventi.sort(function (a, b) { return Date.parse(a.quando) - Date.parse(b.quando); });
  box.className = '';
  box.innerHTML = (p ? passaggiPraticaHTML(passaggiPratica(p, storico)) : '') + '<div style="font-weight:800; color:#1d4f91; margin:4px 0">🕓 Tutte le modifiche e i messaggi</div>' + (storico === null ? '<div class="empty">Cronologia non disponibile in questo momento.</div>'
    : eventi.length ? '<div style="font-size:12px; color:var(--sub); margin-bottom:4px">' + eventi.length + (eventi.length === 1 ? ' evento' : ' eventi') + ', dal primo all\'ultimo</div>' + eventi.map(function (e) { return e.html; }).join('')
      : '<div style="font-size:12.5px; color:var(--sub)">Nessuna modifica registrata per questa pratica.</div>');
}
