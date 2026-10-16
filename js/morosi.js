/* ---------------- Tabulato morosi (pratiche degli anni precedenti non ancora pagate) ---------------- */

const MOROSI = { anno: null, annoBase: null, collaboratori: false, cerca: '', aperto: false };

// Quanto deve pagare il cliente: l'importo richiesto se c'è, altrimenti la fattura
function dovutoPratica(p) { return Number(p.richiesto || 0) > 0 ? Number(p.richiesto) : Number(p.compenso || 0); }
function residuoPratica(p) { return Math.max(0, Math.round((dovutoPratica(p) - Number(p.pagato || 0)) * 100) / 100); }
function eMorosa(p) { return !p.annullata && p.stato !== 'rinuncia_compilazione' && !p.saldataCollaboratore && residuoPratica(p) > 0; }

function morosiAnno(anno, conCollaboratori) {
  return (state.pratiche || []).filter(function (p) {
    // anno 0 = tutti gli anni precedenti a quello di protocollo
    // anno in corso: solo le pratiche già consegnate con un pagamento non completo
    if (anno && anno === annoAttivo() && !(typeof eConsegnata === 'function' && eConsegnata(p))) return false;
    return (anno ? annoPratica(p) === anno : annoPratica(p) < annoAttivo()) && eMorosa(p) && (conCollaboratori || typeof haAcconti !== 'function' || !haAcconti(p.tipo));
  }).sort(function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || '')) || (annoPratica(a) - annoPratica(b)); });
}
function nomeAnnoMorosi(a) { return a ? String(a) : 'TUTTI GLI ANNI';
}

function renderMorosi() {
  const box = document.getElementById('morosi-box');
  if (!box) return;
  renderMorosiCorrente();
  const annoPrec = annoAttivo() - 1;
  // segue sempre l'anno di protocollo: nel 2027 mostra i morosi 2026, nel 2028 quelli 2027…
  if (MOROSI.anno == null || MOROSI.annoBase !== annoAttivo()) {
    // di solito l'anno precedente; se lì non c'è nessuno ma ci sono non pagate dell'anno in corso, si apre sull'anno in corso
    MOROSI.anno = annoPrec; // l'anno in corso ha la sua barra a parte (renderMorosiCorrente)
    MOROSI.annoBase = annoAttivo();
  }
  const anni = Array.from(new Set((state.pratiche || []).map(annoPratica).filter(function (a) { return a < annoAttivo(); }))).sort(function (a, b) { return b - a; });
  if (MOROSI.anno && anni.indexOf(MOROSI.anno) < 0) anni.unshift(MOROSI.anno);
  if (anni.indexOf(annoAttivo()) < 0) anni.unshift(annoAttivo());
  const tutti = morosiAnno(MOROSI.anno, MOROSI.collaboratori);
  const q = MOROSI.cerca.trim().toUpperCase();
  const lista = q ? tutti.filter(function (p) { return (String(p.nome || '') + ' ' + formattaProtocolloTesto(p) + ' ' + (p.telefono || '')).toUpperCase().indexOf(q) >= 0; }) : tutti;
  const tot = tutti.reduce(function (t, p) { return t + residuoPratica(p); }, 0);
  const sola = document.body.classList.contains('sola-lettura');
  box.innerHTML = (typeof avvisoTrasferimentoColfHTML === 'function' ? avvisoTrasferimentoColfHTML() : '') + '<details class="grp" style="--gc:#c0392b" ' + (MOROSI.aperto ? 'open' : '') + ' ontoggle="MOROSI.aperto=this.open">'
    + '<summary style="background:#c0392b; color:#fff; background-image:none"><span class="grp-name">💸 TABULATO MOROSI ' + nomeAnnoMorosi(MOROSI.anno) + '</span><span class="grp-n">' + tutti.length + '</span><span class="grp-soldi">Da pagare<br>' + fmtEuro(tot) + '</span></summary>'
    + '<div class="grp-b" style="padding-top:10px">'
    + '<div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:8px">'
    + '<label style="margin:0">Anno <select onchange="MOROSI.anno=Number(this.value); renderMorosi()" style="width:auto">' + anni.map(function (a) { return '<option value="' + a + '"' + (a === MOROSI.anno ? ' selected' : '') + '>' + a + (a === annoAttivo() ? ' (consegnate non saldate)' : '') + '</option>'; }).join('') + '<option value="0"' + (!MOROSI.anno ? ' selected' : '') + '>Tutti gli anni</option></select></label>'
    + '<input type="search" placeholder="Cerca cliente, protocollo, telefono…" value="' + esc(MOROSI.cerca) + '" oninput="MOROSI.cerca=this.value; renderMorosiLista()" style="flex:1; min-width:200px">'
    + '<label class="chk"><input type="checkbox" ' + (MOROSI.collaboratori ? 'checked' : '') + ' onchange="MOROSI.collaboratori=this.checked; renderMorosi()"> Includi pratiche dei collaboratori</label>'
    + '<button type="button" onclick="stampaMorosi()" style="background:#374151; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">🖨️ Stampa</button>'
    + '</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:6px">Pratiche ' + (MOROSI.anno ? 'del ' + MOROSI.anno : 'di tutti gli anni precedenti al ' + annoAttivo()) + ' con fattura più alta del pagato (escluse annullate e rinunce' + (MOROSI.collaboratori ? '' : ' e, se non spunti la casella, quelle dei collaboratori') + '). Quando il cliente paga premi <b>✓ Pagato</b>: l\'incasso viene scritto nella pratica dell\'anno a cui si riferisce.</div>'
    + riepilogoRecuperiHTML(MOROSI.anno, MOROSI.collaboratori, tot)
    + '<div id="morosi-lista">' + tabellaMorosiHTML(lista, sola) + '</div>'
    + registroRecuperiHTML(MOROSI.anno, MOROSI.collaboratori)
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
        + '<td class="wrap"><b>' + esc((p.nome || '-').toUpperCase()) + '</b>' + (p.telefono ? '<div class="sub2">📱 ' + esc(p.telefono) + '</div>' : '') + (p.note ? '<div class="sub2" style="white-space:normal">📝 ' + esc(p.note) + '</div>' : '') + '</td>'
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
    const recupero = { data: todayIT(), importo: Math.round(imp * 100) / 100, metodo: metodo, da: ((auth.profilo && auth.profilo.nome) || '').toUpperCase() };
    const campi = {
      pagato: nuovoPagato,
      metodoPagamento: Number(p.pagato || 0) > 0 && p.metodoPagamento ? p.metodoPagamento : metodo,
      recuperi: (Array.isArray(p.recuperi) ? p.recuperi : []).concat([recupero]),
      note: ((p.note ? p.note + ' · ' : '') + 'Pagato arretrato ' + fmtEuro(imp) + ' il ' + todayIT() + ' (' + metodo + ')').slice(0, 1000)
    };
    if (nuovoPagato >= dovutoPratica(p) && (['da_pagare', 'non_paga', 'lavorata', 'lavorata_da_fatturare', 'filca_non_paga', 'fps_non_paga'].indexOf(p.stato) >= 0 || (typeof eStatoNonPagato === 'function' && eStatoNonPagato(p.stato)))) campi.stato = 'pagato';
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
  w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Morosi ' + nomeAnnoMorosi(MOROSI.anno) + '</title><style>@page{size:A4 landscape; margin:10mm} body{font-family:Arial,Helvetica,sans-serif; font-size:11.5px; color:#0f1b2d; -webkit-print-color-adjust:exact; print-color-adjust:exact} h1{font-size:16px; color:#c0392b; margin:0 0 4px} table{width:100%; border-collapse:collapse; margin-top:8px} th,td{border:1px solid #cfd8e3; padding:4px 6px; text-align:left} th{background:#c0392b; color:#fff} th:last-child,td:last-child{display:none} .sub2{font-size:10px; color:#5b6b82} .dot{display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:4px} .barra button{padding:8px 16px; margin:0 6px 10px 0} @media print{.barra{display:none}}</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button><button onclick="window.close()">Chiudi</button></div>'
    + '<h1>CAF CISL Alì Terme – Tabulato morosi ' + (MOROSI.anno || 'di tutti gli anni') + '</h1><div style="color:#5b6b82">Stampato il ' + new Date().toLocaleDateString('it-IT') + ' · ' + lista.length + ' pratiche · totale da pagare <b>' + fmtEuro(tot) + '</b>' + (MOROSI.collaboratori ? ' · comprese le pratiche dei collaboratori' : '') + '</div>'
    + tabella + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
  w.document.close();
}

/* ---------------- Pratiche dei collaboratori saldate tramite il collaboratore ---------------- */
// Il collaboratore regola i conti con gli acconti: qui si spuntano le pratiche da togliere dai morosi
// SENZA toccare fattura, pagato, incasso o stato (la contabilità resta quella degli incassi e degli acconti).
function pagamentoCumulativo(k) {
  const lista = (state.pratiche || []).filter(function (p) {
    return (p.tipo || 'SENZA TIPO') === k && annoPratica(p) <= annoAttivo() && !p.annullata && p.stato !== 'rinuncia_compilazione' && residuoPratica(p) > 0;
  }).sort(function (a, b) { return (annoPratica(a) - annoPratica(b)) || (a.numero - b.numero); });
  if (!lista.length) { avviso('✓ Nessuna pratica di ' + k + ' risulta da pagare'); return; }
  const vecchio = document.getElementById('popup-cumulativo'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-cumulativo';
  ov.style.cssText = 'position:fixed; inset:0; z-index:470; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #2f9e5f; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:18px 20px; max-width:680px; width:100%; max-height:92vh; display:flex; flex-direction:column">'
    + '<div style="font-size:19px; font-weight:800; color:#2f9e5f">✓ Togli dai morosi</div>'
    + '<div style="font-size:13px; color:var(--sub); margin:2px 0 10px">' + esc(k) + ' – le pratiche spuntate risultano <b>saldate tramite il collaboratore</b> e non escono più nel tabulato morosi. Fattura, pagato, incasso, acconti e stato <b>non cambiano</b>. Togliendo la spunta la pratica torna tra i morosi.</div>'
    + '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px"><button type="button" data-tutte="1" style="padding:5px 12px">☑ Seleziona tutte</button><button type="button" data-tutte="0" style="padding:5px 12px">☐ Nessuna</button></div>'
    + '<div style="overflow:auto; flex:1; border:1px solid var(--line); border-radius:10px">'
    + lista.map(function (p) {
      return '<label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid var(--line); cursor:pointer; margin:0">'
        + '<input type="checkbox" class="cum-chk" value="' + p.id + '" ' + (p.saldataCollaboratore ? 'checked' : '') + ' style="width:auto; margin:0">'
        + '<span style="flex:1"><b>' + formattaProtocollo(p) + '</b> · ' + esc(p.data || '') + ' · ' + esc((p.nome || '').toUpperCase()) + '<span class="sub2"> · ' + esc(statoLabel(p.stato)) + '</span>'
        + (p.saldataCollaboratore ? '<div class="sub2" style="color:#2f9e5f">✓ già tolta dai morosi il ' + esc(p.saldataCollaboratore) + '</div>' : '') + '</span>'
        + '<span style="white-space:nowrap; text-align:right">fattura ' + fmtEuro(p.compenso) + '<div class="sub2">pagato ' + fmtEuro(p.pagato) + '</div></span></label>';
    }).join('') + '</div>'
    + '<div id="cum-totale" style="margin-top:10px; font-weight:800; text-align:right"></div>'
    + '<div id="cum-esito" style="font-size:13px; margin-top:6px"></div>'
    + '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:10px"><button type="button" data-azione="no" style="background:var(--line); color:var(--ink)">Annulla</button><button type="button" data-azione="si" style="background:#2f9e5f; color:#fff; font-weight:800">💾 Salva</button></div></div>';
  document.body.appendChild(ov);
  const spuntata = function (p) { const c = ov.querySelector('.cum-chk[value="' + p.id + '"]'); return !!(c && c.checked); };
  const aggiornaTotale = function () {
    const n = lista.filter(spuntata).length;
    document.getElementById('cum-totale').textContent = n + ' di ' + lista.length + ' pratiche fuori dai morosi';
  };
  aggiornaTotale();
  ov.addEventListener('change', aggiornaTotale);
  ov.addEventListener('click', async function (e) {
    const t = e.target.closest('button[data-tutte]');
    if (t) { ov.querySelectorAll('.cum-chk').forEach(function (c) { c.checked = t.dataset.tutte === '1'; }); aggiornaTotale(); return; }
    const b = e.target.closest('button[data-azione]');
    if (!b && e.target !== ov) return;
    if (!b || b.dataset.azione === 'no') { ov.remove(); return; }
    // si salvano solo le pratiche cambiate
    const cambiate = lista.filter(function (p) { return spuntata(p) !== !!p.saldataCollaboratore; });
    const esito = document.getElementById('cum-esito');
    if (!cambiate.length) { ov.remove(); return; }
    b.disabled = true;
    let fatte = 0;
    for (const p of cambiate) {
      const valore = spuntata(p) ? todayIT() : '';
      esito.textContent = 'Salvataggio ' + (fatte + 1) + ' di ' + cambiate.length + '…';
      const { data: righe, error } = await supabase.from('pratiche').update({ saldata_collaboratore: valore }).eq('id', p.id).select('id');
      if (error || !righe || !righe.length) { esito.innerHTML = '<b style="color:#c0392b">❌ Pratica ' + formattaProtocolloTesto(p) + ' non salvata' + (error ? ': ' + esc(error.message) : '') + '. Salvate ' + fatte + ' di ' + cambiate.length + '.</b>'; b.disabled = false; break; }
      p.saldataCollaboratore = valore;
      fatte++;
    }
    if (typeof caricaTutto === 'function') await caricaTutto();
    if (fatte === cambiate.length) { ov.remove(); avviso('✓ Elenco dei morosi di ' + k + ' aggiornato'); }
    render();
  });
}

/* ---------------- Registro dei recuperi: pagamenti arretrati incassati dai morosi ---------------- */
// Ogni "✓ Pagato" del tabulato morosi resta scritto nella pratica (data, importo, pagamento, operatore):
// l'importo entra nella contabilità dell'anno della pratica, e qui si vede quanto è stato recuperato.
function recuperiAnno(anno, conCollaboratori) {
  const righe = [];
  (state.pratiche || []).forEach(function (p) {
    if (!Array.isArray(p.recuperi) || !p.recuperi.length) return;
    if (anno ? annoPratica(p) !== anno : annoPratica(p) >= annoAttivo()) return;
    if (!conCollaboratori && typeof haAcconti === 'function' && haAcconti(p.tipo)) return;
    p.recuperi.forEach(function (r) { righe.push({ p: p, r: r }); });
  });
  return righe.sort(function (a, b) { return (dataNum(a.r.data) || 0) - (dataNum(b.r.data) || 0); });
}
function riepilogoRecuperiHTML(anno, conCollaboratori, daRecuperare) {
  const recuperato = recuperiAnno(anno, conCollaboratori).reduce(function (t, x) { return t + Number(x.r.importo || 0); }, 0);
  const totale = daRecuperare + recuperato;
  const perc = totale > 0 ? Math.round(recuperato / totale * 100) : 0;
  const tessera = function (titolo, valore, col, nota) {
    return '<div style="flex:1; min-width:150px; padding:8px 12px; border-radius:12px; border:2px solid ' + col + '"><div style="font-size:12px; font-weight:800; color:' + col + '">' + titolo + '</div>'
      + '<div style="font-size:19px; font-weight:800">' + fmtEuro(valore) + '</div>' + (nota ? '<div class="sub2">' + nota + '</div>' : '') + '</div>';
  };
  return '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px">'
    + tessera('📋 TOTALE MOROSI', totale, '#374151', 'da recuperare + recuperato')
    + tessera('✅ RECUPERATO', recuperato, '#2f9e5f', perc + '% del totale')
    + tessera('💸 ANCORA DA RECUPERARE', daRecuperare, '#c0392b', '')
    + '</div>';
}
function registroRecuperiHTML(anno, conCollaboratori) {
  const righe = recuperiAnno(anno, conCollaboratori);
  const tot = righe.reduce(function (t, x) { return t + Number(x.r.importo || 0); }, 0);
  return '<details style="margin-top:12px" ' + (MOROSI.registroAperto ? 'open' : '') + ' ontoggle="MOROSI.registroAperto=this.open">'
    + '<summary style="cursor:pointer; font-weight:800; color:#2f9e5f; font-size:15px">📒 Registro recuperi ' + nomeAnnoMorosi(anno) + ' (' + righe.length + ' pagamenti · ' + fmtEuro(tot) + ')</summary>'
    + '<div style="display:flex; justify-content:flex-end; margin:6px 0"><button type="button" onclick="stampaRegistroRecuperi()" style="background:#2f9e5f; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">🖨️ Stampa registro recuperi</button></div>'
    + tabellaRecuperiHTML(righe, tot) + '</details>';
}
function tabellaRecuperiHTML(righe, tot) {
  if (!righe.length) return '<div class="empty">Nessun pagamento arretrato registrato. Quando un moroso paga, premi ✓ Pagato nel tabulato: il pagamento finisce qui.</div>';
  const perMetodo = {};
  righe.forEach(function (x) { const m = x.r.metodo || 'NON INDICATO'; perMetodo[m] = (perMetodo[m] || 0) + Number(x.r.importo || 0); });
  return '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>Data pagamento</th><th>Pratica</th><th>Cliente</th><th>Tipo</th><th>Importo</th><th>Pagamento</th><th>Operatore</th><th>Ancora da pagare</th></tr></thead><tbody>'
    + righe.map(function (x) {
      return '<tr><td>' + esc(x.r.data || '-') + '</td><td>' + formattaProtocollo(x.p) + '</td><td><b>' + esc((x.p.nome || '').toUpperCase()) + '</b></td><td class="wrap">' + esc(x.p.tipo || '') + '</td>'
        + '<td><b style="color:#2f9e5f">' + fmtEuro(x.r.importo) + '</b></td><td>' + (typeof etichettaPagamento === 'function' ? etichettaPagamento(x.r.metodo) : esc(x.r.metodo || '')) + '</td><td>' + esc(x.r.da || '') + '</td>'
        + '<td>' + (residuoPratica(x.p) > 0 ? '<span style="color:#c0392b">' + fmtEuro(residuoPratica(x.p)) + '</span>' : '✓ saldata') + '</td></tr>';
    }).join('')
    + '<tr style="font-weight:800"><td colspan="4">TOTALE RECUPERATO · ' + Object.keys(perMetodo).map(function (m) { return esc(m) + ' ' + fmtEuro(perMetodo[m]); }).join(' · ') + '</td><td>' + fmtEuro(tot) + '</td><td colspan="3"></td></tr>'
    + '</tbody></table></div>';
}
function stampaRegistroRecuperi() {
  const righe = recuperiAnno(MOROSI.anno, MOROSI.collaboratori);
  const tot = righe.reduce(function (t, x) { return t + Number(x.r.importo || 0); }, 0);
  const daRec = morosiAnno(MOROSI.anno, MOROSI.collaboratori).reduce(function (t, p) { return t + residuoPratica(p); }, 0);
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
  w.document.open();
  w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Registro recuperi ' + nomeAnnoMorosi(MOROSI.anno) + '</title><style>@page{size:A4 landscape; margin:10mm} body{font-family:Arial,Helvetica,sans-serif; font-size:11.5px; color:#0f1b2d; margin:0; padding:10px}'
    + 'h1{font-size:17px; color:#2f9e5f; margin:0 0 4px} table{width:100%; border-collapse:collapse; margin-top:10px} th,td{text-align:left; padding:4px 6px; border-bottom:1px solid #e3e8ef} th{background:#f2f5f9; font-size:11px}'
    + '.sub2{font-size:10px; color:#5b6b82} .tot{display:flex; gap:10px; margin-top:8px} .tot div{flex:1; border:2px solid #cfd8e3; border-radius:10px; padding:6px 10px} .tot b{display:block; font-size:16px}'
    + '.barra{margin-bottom:10px} .barra button{font-size:14px; padding:8px 16px; margin-right:6px} @media print{.barra{display:none} body{padding:0}}</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button><button onclick="window.close()">Chiudi</button></div>'
    + '<h1>CAF CISL Alì Terme – Registro recuperi morosi ' + (MOROSI.anno || 'di tutti gli anni') + '</h1><div style="color:#5b6b82">Stampato il ' + new Date().toLocaleDateString('it-IT') + '</div>'
    + '<div class="tot"><div>TOTALE MOROSI<b>' + fmtEuro(tot + daRec) + '</b></div><div style="border-color:#2f9e5f">RECUPERATO<b>' + fmtEuro(tot) + '</b></div><div style="border-color:#c0392b">ANCORA DA RECUPERARE<b>' + fmtEuro(daRec) + '</b></div></div>'
    + tabellaRecuperiHTML(righe, tot) + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
  w.document.close();
}

/* ---------------- Non pagate dell'anno in corso: barra a parte sotto il tabulato morosi ---------------- */
// Pratiche dell'anno di protocollo già consegnate/definite ma non saldate (es. "Non ha pagato" alla consegna)
const MOROSI_CORR = { aperto: false, collaboratori: false };
function renderMorosiCorrente() {
  const box = document.getElementById('morosi-corrente-box');
  if (!box) return;
  const anno = annoAttivo();
  const lista = morosiAnno(anno, MOROSI_CORR.collaboratori);
  const tot = lista.reduce(function (t, p) { return t + residuoPratica(p); }, 0);
  const sola = document.body.classList.contains('sola-lettura');
  box.innerHTML = '<details class="grp" style="--gc:#e67e22" ' + (MOROSI_CORR.aperto ? 'open' : '') + ' ontoggle="MOROSI_CORR.aperto=this.open">'
    + '<summary style="background:#e67e22; color:#fff; background-image:none"><span class="grp-name">💸 NON PAGATE ' + anno + ' (anno in corso)</span><span class="grp-n">' + lista.length + '</span><span class="grp-soldi">Da pagare<br>' + fmtEuro(tot) + '</span></summary>'
    + '<div class="grp-b" style="padding-top:10px">'
    + '<div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:8px">'
    + '<span style="font-size:12.5px; color:var(--sub); flex:1; min-width:220px">Pratiche del ' + anno + ' già <b>consegnate o definite</b> ma non ancora pagate del tutto (per esempio "Non ha pagato" alla consegna). Quando il cliente paga premi <b>✓ Pagato</b>.</span>'
    + '<label class="chk"><input type="checkbox" ' + (MOROSI_CORR.collaboratori ? 'checked' : '') + ' onchange="MOROSI_CORR.collaboratori=this.checked; renderMorosiCorrente()"> Includi pratiche dei collaboratori</label>'
    + '<button type="button" onclick="stampaMorosiCorrente()" style="background:#374151; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">🖨️ Stampa</button></div>'
    + tabellaMorosiHTML(lista, sola)
    + '</div></details>';
}
function stampaMorosiCorrente() {
  const prima = { anno: MOROSI.anno, coll: MOROSI.collaboratori };
  MOROSI.anno = annoAttivo(); MOROSI.collaboratori = MOROSI_CORR.collaboratori;
  try { stampaMorosi(); } finally { MOROSI.anno = prima.anno; MOROSI.collaboratori = prima.coll; }
}
