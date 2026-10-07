/* ---------------- Tabulato morosi (pratiche degli anni precedenti non ancora pagate) ---------------- */

const MOROSI = { anno: null, collaboratori: false, cerca: '', aperto: false };

function residuoPratica(p) { return Math.max(0, Math.round((Number(p.compenso || 0) - Number(p.pagato || 0)) * 100) / 100); }
function eMorosa(p) { return !p.annullata && p.stato !== 'rinuncia_compilazione' && residuoPratica(p) > 0; }

function morosiAnno(anno, conCollaboratori) {
  return (state.pratiche || []).filter(function (p) {
    return annoPratica(p) === anno && eMorosa(p) && (conCollaboratori || typeof haAcconti !== 'function' || !haAcconti(p.tipo));
  }).sort(function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || '')); });
}

function renderMorosi() {
  const box = document.getElementById('morosi-box');
  if (!box) return;
  const annoPrec = annoAttivo() - 1;
  if (MOROSI.anno == null) MOROSI.anno = annoPrec;
  const anni = Array.from(new Set((state.pratiche || []).map(annoPratica).filter(function (a) { return a < annoAttivo(); }))).sort(function (a, b) { return b - a; });
  if (anni.indexOf(MOROSI.anno) < 0) anni.unshift(MOROSI.anno);
  const tutti = morosiAnno(MOROSI.anno, MOROSI.collaboratori);
  const q = MOROSI.cerca.trim().toUpperCase();
  const lista = q ? tutti.filter(function (p) { return (String(p.nome || '') + ' ' + formattaProtocolloTesto(p) + ' ' + (p.telefono || '')).toUpperCase().indexOf(q) >= 0; }) : tutti;
  const tot = tutti.reduce(function (t, p) { return t + residuoPratica(p); }, 0);
  const sola = document.body.classList.contains('sola-lettura');
  box.innerHTML = '<details class="grp" style="--gc:#c0392b" ' + (MOROSI.aperto ? 'open' : '') + ' ontoggle="MOROSI.aperto=this.open">'
    + '<summary style="background:#c0392b; color:#fff; background-image:none"><span class="grp-name">💸 TABULATO MOROSI ' + MOROSI.anno + '</span><span class="grp-n">' + tutti.length + '</span><span class="grp-soldi">Da pagare<br>' + fmtEuro(tot) + '</span></summary>'
    + '<div class="grp-b" style="padding-top:10px">'
    + '<div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:8px">'
    + '<label style="margin:0">Anno <select onchange="MOROSI.anno=Number(this.value); renderMorosi()" style="width:auto">' + anni.map(function (a) { return '<option' + (a === MOROSI.anno ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select></label>'
    + '<input type="search" placeholder="Cerca cliente, protocollo, telefono…" value="' + esc(MOROSI.cerca) + '" oninput="MOROSI.cerca=this.value; renderMorosiLista()" style="flex:1; min-width:200px">'
    + '<label class="chk"><input type="checkbox" ' + (MOROSI.collaboratori ? 'checked' : '') + ' onchange="MOROSI.collaboratori=this.checked; renderMorosi()"> Includi pratiche dei collaboratori</label>'
    + '<button type="button" onclick="stampaMorosi()" style="background:#374151; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">🖨️ Stampa</button>'
    + '</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:6px">Pratiche del ' + MOROSI.anno + ' con fattura più alta del pagato (escluse annullate e rinunce' + (MOROSI.collaboratori ? '' : ' e, se non spunti la casella, quelle dei collaboratori') + '). Quando il cliente paga premi <b>✓ Pagato</b>: l\'incasso viene scritto nella sua pratica del ' + MOROSI.anno + '.</div>'
    + '<div id="morosi-lista">' + tabellaMorosiHTML(lista, sola) + '</div>'
    + '</div></details>';
}
function renderMorosiLista() {
  const el = document.getElementById('morosi-lista');
  if (!el) return renderMorosi();
  const q = MOROSI.cerca.trim().toUpperCase();
  const tutti = morosiAnno(MOROSI.anno, MOROSI.collaboratori);
  el.innerHTML = tabellaMorosiHTML(q ? tutti.filter(function (p) { return (String(p.nome || '') + ' ' + formattaProtocolloTesto(p) + ' ' + (p.telefono || '')).toUpperCase().indexOf(q) >= 0; }) : tutti, document.body.classList.contains('sola-lettura'));
}

function tabellaMorosiHTML(lista, sola) {
  if (!lista.length) return '<div class="empty">Nessun moroso 🎉</div>';
  return '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>N.</th><th>Data</th><th>Cliente</th><th>Tipo</th><th>Stato</th><th>Fattura</th><th>Pagato</th><th>Da pagare</th><th></th></tr></thead><tbody>'
    + lista.map(function (p) {
      return '<tr><td class="n">' + formattaProtocollo(p) + '</td><td>' + esc(p.data || '-') + '</td>'
        + '<td class="wrap"><b>' + esc((p.nome || '-').toUpperCase()) + '</b>' + (p.telefono ? '<div class="sub2">📱 ' + esc(p.telefono) + '</div>' : '') + '</td>'
        + '<td class="wrap">' + esc(p.tipo || '-') + '</td><td>' + pallino(p.stato) + esc(statoLabel(p.stato)) + '</td>'
        + '<td>' + fmtEuro(p.compenso) + '</td><td>' + fmtEuro(p.pagato) + '</td><td><b style="color:#c0392b">' + fmtEuro(residuoPratica(p)) + '</b></td>'
        + '<td style="white-space:nowrap">' + (sola ? '' : '<button type="button" onclick="incassaMoroso(\'' + p.id + '\')" style="background:#2f9e5f; color:#fff; border:none; border-radius:6px; padding:5px 10px; font-weight:800; cursor:pointer">✓ Pagato</button> ')
        + (p.telefono ? '<button type="button" title="Ricorda il pagamento su WhatsApp" onclick="ricordaMoroso(\'' + p.id + '\')" style="background:#25d366; color:#fff; border:none; border-radius:6px; padding:5px 8px; cursor:pointer">💬</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

function ricordaMoroso(id) {
  const p = (state.pratiche || []).find(function (x) { return x.id === id; });
  if (!p) return;
  const testo = 'Gentile ' + (p.nome || '') + ', le ricordiamo che per la pratica ' + formattaProtocolloTesto(p) + ' (' + (p.tipo || '') + ') del ' + annoPratica(p) + ' risulta ancora da saldare l\'importo di ' + fmtEuro(residuoPratica(p)) + '. Può passare in sede quando le è comodo. Grazie, CAF CISL Alì Terme.';
  apriChatWhatsApp(numeroWhatsApp(p.telefono), testo);
}

function incassaMoroso(id) {
  const p = (state.pratiche || []).find(function (x) { return x.id === id; });
  if (!p) return;
  const res = residuoPratica(p);
  const vecchio = document.getElementById('popup-moroso'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-moroso';
  ov.style.cssText = 'position:fixed; inset:0; z-index:470; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #2f9e5f; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:20px 22px; max-width:440px; width:100%">'
    + '<div style="font-size:19px; font-weight:800; color:#2f9e5f">✓ Pagamento arretrato</div>'
    + '<div style="font-size:13px; color:var(--sub); margin:2px 0 12px">' + esc(p.nome || '') + ' · ' + formattaProtocolloTesto(p) + ' · ' + esc(p.tipo || '') + '<br>Fattura ' + fmtEuro(p.compenso) + ' · già pagato ' + fmtEuro(p.pagato) + ' · <b style="color:#c0392b">da pagare ' + fmtEuro(res) + '</b></div>'
    + '<div class="grid" style="gap:8px"><div><label>Importo pagato ora (€)</label><input id="mo-importo" type="text" inputmode="decimal" value="' + String(res.toFixed(2)).replace('.', ',') + '" oninput="filtraImporto(this)" onblur="formattaCampoImporto(this)" style="font-weight:800"></div>'
    + '<div><label>Pagamento</label><select id="mo-metodo">' + METODI_PAGAMENTO.map(function (m) { return '<option' + (m === 'CONTANTI' ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></div></div>'
    + '<div id="mo-esito" style="font-size:13px; margin-top:6px"></div>'
    + '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px"><button type="button" data-azione="no" style="background:var(--line); color:var(--ink)">Annulla</button><button type="button" data-azione="si" style="background:#2f9e5f; color:#fff; font-weight:800">💾 Registra pagamento</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', async function (e) {
    const b = e.target.closest('button[data-azione]');
    if (!b && e.target !== ov) return;
    if (!b || b.dataset.azione === 'no') { ov.remove(); return; }
    const imp = parseImporto(document.getElementById('mo-importo').value);
    const esito = document.getElementById('mo-esito');
    if (!imp || imp <= 0) { esito.innerHTML = '<b style="color:#c0392b">Scrivi l\'importo pagato</b>'; return; }
    if (imp > res + 0.001 && !confirm('L\'importo è più alto di quanto deve (' + fmtEuro(res) + '). Registrarlo lo stesso?')) return;
    const metodo = document.getElementById('mo-metodo').value;
    const nuovoPagato = Math.round((Number(p.pagato || 0) + imp) * 100) / 100;
    const campi = {
      pagato: nuovoPagato,
      metodoPagamento: metodo,
      note: ((p.note ? p.note + ' · ' : '') + 'Pagato arretrato ' + fmtEuro(imp) + ' il ' + todayIT() + ' (' + metodo + ')').slice(0, 1000)
    };
    if (nuovoPagato >= Number(p.compenso || 0) && ['da_pagare', 'non_paga', 'lavorata', 'lavorata_da_fatturare', 'filca_non_paga', 'fps_non_paga'].indexOf(p.stato) >= 0) campi.stato = 'pagato';
    b.disabled = true;
    const r = await data.pratiche.aggiorna(p.id, campi);
    if (r && r.error) { b.disabled = false; esito.innerHTML = '<b style="color:#c0392b">❌ ' + esc(r.error) + '</b>'; return; }
    Object.assign(p, campi);
    ov.remove();
    avviso('✓ Pagamento di ' + fmtEuro(imp) + ' registrato nella pratica ' + formattaProtocolloTesto(p));
    render();
    if (typeof aggiornaStoricoForm === 'function') aggiornaStoricoForm();
  });
}

// Avviso nell'inserimento anagrafica: il cliente ha pratiche degli anni precedenti ancora da pagare
function avvisoMorosoHTML(lista) {
  const arretrati = (lista || []).filter(function (p) { return annoPratica(p) < annoAttivo() && eMorosa(p); });
  if (!arretrati.length) return '';
  const tot = arretrati.reduce(function (t, p) { return t + residuoPratica(p); }, 0);
  const sola = document.body.classList.contains('sola-lettura');
  return '<div style="margin-bottom:10px; padding:10px 12px; border-radius:12px; background:#fdecea; border:2px solid #c0392b; color:#7f1d1d">'
    + '<div style="font-weight:800; font-size:15px">⚠️ Deve ancora pagare ' + fmtEuro(tot) + ' di pratiche degli anni precedenti</div>'
    + arretrati.map(function (p) {
      return '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; padding:4px 0; border-top:1px solid #f5c6c0; font-size:13px">'
        + '<span>' + formattaProtocollo(p) + ' · ' + esc(p.tipo || '') + ' · fattura ' + fmtEuro(p.compenso) + ', pagato ' + fmtEuro(p.pagato) + ' → <b>da pagare ' + fmtEuro(residuoPratica(p)) + '</b></span>'
        + (sola ? '' : '<button type="button" onclick="incassaMoroso(\'' + p.id + '\')" style="background:#2f9e5f; color:#fff; border:none; border-radius:6px; padding:4px 10px; font-weight:800; cursor:pointer">✓ Pagato</button>')
        + '</div>';
    }).join('') + '</div>';
}

function stampaMorosi() {
  const lista = morosiAnno(MOROSI.anno, MOROSI.collaboratori);
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
  const tot = lista.reduce(function (t, p) { return t + residuoPratica(p); }, 0);
  const tabella = tabellaMorosiHTML(lista, true).replace(/<button[\s\S]*?<\/button>/g, '');
  w.document.open();
  w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Morosi ' + MOROSI.anno + '</title><style>@page{size:A4 landscape; margin:10mm} body{font-family:Arial,Helvetica,sans-serif; font-size:11.5px; color:#0f1b2d; -webkit-print-color-adjust:exact; print-color-adjust:exact} h1{font-size:16px; color:#c0392b; margin:0 0 4px} table{width:100%; border-collapse:collapse; margin-top:8px} th,td{border:1px solid #cfd8e3; padding:4px 6px; text-align:left} th{background:#c0392b; color:#fff} th:last-child,td:last-child{display:none} .sub2{font-size:10px; color:#5b6b82} .dot{display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:4px} .barra button{padding:8px 16px; margin:0 6px 10px 0} @media print{.barra{display:none}}</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button><button onclick="window.close()">Chiudi</button></div>'
    + '<h1>CAF CISL Alì Terme – Tabulato morosi ' + MOROSI.anno + '</h1><div style="color:#5b6b82">Stampato il ' + new Date().toLocaleDateString('it-IT') + ' · ' + lista.length + ' pratiche · totale da pagare <b>' + fmtEuro(tot) + '</b>' + (MOROSI.collaboratori ? ' · comprese le pratiche dei collaboratori' : '') + '</div>'
    + tabella + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
  w.document.close();
}
