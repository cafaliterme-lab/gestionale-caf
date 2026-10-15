/* ---------------- Chiusura di cassa del giorno ---------------- */
// Stampa di fine giornata: pratiche aperte nel giorno, incassi divisi per tipo di pagamento,
// spese della sede pagate nel giorno e contanti rimasti in cassa.
// L'incasso di una pratica conta nel giorno della consegna; se non è ancora consegnata, nel giorno di apertura.

function dataIncassoPratica(p) { return p.consegnataIl || p.data || ''; }

function apriChiusuraGiorno() {
  const vecchio = document.getElementById('chiusura-popup');
  if (vecchio) vecchio.remove();
  const box = document.createElement('div');
  box.id = 'chiusura-popup';
  box.style.cssText = 'position:fixed; inset:0; background:rgba(15,27,45,.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px';
  box.innerHTML = '<div style="background:var(--card,#fff); color:var(--ink,#0f1b2d); border-radius:14px; padding:18px 20px; max-width:380px; width:100%; box-shadow:0 10px 40px rgba(0,0,0,.3)">'
    + '<div style="font-size:18px; font-weight:800; margin-bottom:4px">📅 Chiusura di cassa</div>'
    + '<div style="font-size:13px; color:var(--sub); margin-bottom:10px">Pratiche del giorno, incassi divisi per contanti, POS e bonifico, spese della sede e contanti in cassa.</div>'
    + '<label>Giorno</label><input id="chiusura-data" type="date" value="' + isoOggi() + '">'
    + '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:14px">'
    + '<button type="button" style="background:var(--line); color:var(--ink)" onclick="document.getElementById(\'chiusura-popup\').remove()">Annulla</button>'
    + '<button type="button" onclick="stampaChiusuraGiorno(document.getElementById(\'chiusura-data\').value)">🖨️ Stampa</button></div></div>';
  box.addEventListener('click', function (e) { if (e.target === box) box.remove(); });
  document.body.appendChild(box);
}

function stampaChiusuraGiorno(iso) {
  if (!iso) { avviso('❌ Scegli il giorno', true); return; }
  const giorno = isoNum(iso);
  const giornoIT = iso.split('-').reverse().join('/');
  const stesso = function (d) { return dataNum(d) === giorno; };
  const valide = (state.pratiche || []).filter(function (p) { return !p.annullata; });
  const aperte = valide.filter(function (p) { return stesso(p.data); });
  const incassi = valide.filter(function (p) { return Number(p.pagato) > 0 && stesso(dataIncassoPratica(p)); });
  const spese = (state.speseSede || []).filter(function (s) { return stesso(s.data); });
  const metodo = function (m) { return METODI_PAGAMENTO.indexOf(m) >= 0 ? m : 'NESSUNO'; };
  const somma = function (lista, campo, m) { return lista.filter(function (x) { return !m || metodo(x.metodoPagamento) === m; }).reduce(function (t, x) { return t + Number(x[campo] || 0); }, 0); };
  const conta = function (lista, m) { return lista.filter(function (x) { return metodo(x.metodoPagamento) === m; }).length; };
  const contantiIn = somma(incassi, 'pagato', 'CONTANTI'), contantiOut = somma(spese, 'importo', 'CONTANTI');
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra: consenti i popup per questo sito e riprova.'); return; }
  const pop = document.getElementById('chiusura-popup'); if (pop) pop.remove();
  const riga = function (celle, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' + celle.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; };
  const testa = function (celle) { return '<tr>' + celle.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr>'; };
  const vuoto = function (n, testo) { return '<tr><td colspan="' + n + '" class="vuoto">' + testo + '</td></tr>'; };
  const metodi = [['CONTANTI', '💶 Contanti'], ['POS', '💳 POS'], ['BONIFICO', '🏦 Bonifico'], ['NESSUNO', '❔ Non indicato']];
  const caf = (typeof datiCafStampa === 'function') ? datiCafStampa() : {};
  const io = ((typeof auth !== 'undefined' && auth.profilo && auth.profilo.nome) || '');
  const html = '<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Chiusura di cassa ' + giornoIT + '</title><style>'
    + '@page{size:A4 portrait; margin:12mm} body{font-family:Arial,Helvetica,sans-serif; color:#0f1b2d; font-size:12px; margin:0; padding:12px}'
    + 'h1{font-size:18px; margin:0; color:#1d4f91} .sub{color:#5b6b82; font-size:11px; margin:2px 0 12px} h2{font-size:14px; margin:16px 0 6px; color:#1d4f91; border-bottom:2px solid #1d4f91; padding-bottom:3px}'
    + 'table{width:100%; border-collapse:collapse} th,td{text-align:left; padding:4px 6px; border-bottom:1px solid #e3e8ef} th{background:#f2f5f9; font-size:11px; color:#5b6b82} td.n,th.n{text-align:right}'
    + 'tr.tot td{font-weight:800; border-top:2px solid #0f1b2d} .vuoto{color:#8a8f98; text-align:center; font-style:italic}'
    + '.tessere{display:flex; gap:8px; flex-wrap:wrap} .tes{flex:1; min-width:120px; border:2px solid #cfd8e3; border-radius:10px; padding:8px 10px} .tes b{display:block; font-size:16px}'
    + '.cassa{border:2px solid #1a7f37; border-radius:10px; padding:10px 14px; margin-top:8px; font-size:13px} .cassa .fin{font-size:16px; font-weight:800; color:#1a7f37; margin-top:4px}'
    + '.firme{display:flex; gap:30px; margin-top:34px} .firme div{flex:1; border-top:1px solid #0f1b2d; padding-top:4px; text-align:center; font-size:11px}'
    + '.barra{margin-bottom:10px} .barra button{font-size:14px; padding:8px 16px; margin-right:6px} @media print{.barra{display:none} body{padding:0}}'
    + '</style></head><body><div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button><button onclick="window.close()">Chiudi</button></div>'
    + '<h1>CHIUSURA DI CASSA – ' + giornoIT + '</h1>'
    + '<div class="sub">CAF CISL – Sede di Alì Terme' + (caf.indirizzo ? ' · ' + esc(caf.indirizzo) : '') + ' · stampata il ' + esc(todayIT()) + (io ? ' da ' + esc(io) : '') + '</div>'

    + '<h2>💶 Incassi del giorno</h2><div class="tessere">'
    + '<div class="tes" style="border-color:#1d4f91">TOTALE<b>' + fmtEuro(somma(incassi, 'pagato')) + '</b>' + incassi.length + ' pratiche</div>'
    + metodi.filter(function (m) { return m[0] !== 'NESSUNO' || conta(incassi, 'NESSUNO'); }).map(function (m) { return '<div class="tes">' + m[1] + '<b>' + fmtEuro(somma(incassi, 'pagato', m[0])) + '</b>' + conta(incassi, m[0]) + ' pratiche</div>'; }).join('')
    + '</div><table style="margin-top:8px">' + testa(['Protocollo', 'Cliente', 'Tipo', 'N. fattura', '<span class="n">Fattura</span>', '<span class="n">Pagato</span>', 'Pagamento'])
    + (incassi.length ? incassi.map(function (p) {
      return riga([esc(formattaProtocollo(p)), esc(p.nome || ''), esc(p.tipo || ''), esc(p.numFattura || '-'), '<div style="text-align:right">' + fmtEuro(p.compenso) + '</div>', '<div style="text-align:right"><b>' + fmtEuro(p.pagato) + '</b></div>', etichettaPagamento(p.metodoPagamento)]);
    }).join('') + riga(['TOTALE', '', '', '', '<div style="text-align:right">' + fmtEuro(somma(incassi, 'compenso')) + '</div>', '<div style="text-align:right">' + fmtEuro(somma(incassi, 'pagato')) + '</div>', ''], 'tot') : vuoto(7, 'Nessun incasso in questo giorno'))
    + '</table>'

    + '<h2>🧾 Spese della sede pagate nel giorno</h2><table>' + testa(['Descrizione', 'Categoria', 'Pagamento', '<span class="n">Importo</span>'])
    + (spese.length ? spese.map(function (s) {
      return riga([esc(s.descrizione || ''), esc(s.categoria || ''), etichettaPagamento(s.metodoPagamento) + (s.prelevatiAngelo ? ' · anticipata da Angelo' : ''), '<div style="text-align:right">' + fmtEuro(s.importo) + '</div>']);
    }).join('') + riga(['TOTALE', '', '', '<div style="text-align:right">' + fmtEuro(somma(spese, 'importo')) + '</div>'], 'tot') : vuoto(4, 'Nessuna spesa in questo giorno'))
    + '</table>'

    + '<h2>💰 Contanti in cassa</h2><div class="cassa">Contanti incassati: <b>' + fmtEuro(contantiIn) + '</b><br>Spese pagate in contanti: <b>− ' + fmtEuro(contantiOut) + '</b>'
    + '<div class="fin">Contanti del giorno da mettere in cassa: ' + fmtEuro(contantiIn - contantiOut) + '</div>'
    + '<div style="font-size:11px; color:#5b6b82; margin-top:4px">POS e bonifici non sono contanti: arrivano sul conto.</div></div>'

    + '<h2>📂 Pratiche aperte nel giorno (' + aperte.length + ')</h2><table>' + testa(['Protocollo', 'Cliente', 'Tipo', 'Stato', 'Operatore'])
    + (aperte.length ? aperte.map(function (p) {
      return riga([esc(formattaProtocollo(p)), esc(p.nome || '') + (p.congiunta ? ' <span style="color:#5b6b82">+ ' + esc(p.congiunta) + '</span>' : ''), esc(p.tipo || ''), esc(typeof statoLabel === 'function' ? statoLabel(p.stato) : (p.stato || '')), esc(p.inseritoDa || '')]);
    }).join('') : vuoto(5, 'Nessuna pratica aperta in questo giorno'))
    + '</table>'
    + '<div style="font-size:10.5px; color:#5b6b82; margin-top:10px">L\'incasso di una pratica conta nel giorno della consegna; se la pratica non è ancora consegnata, nel giorno di apertura. Le pratiche annullate non sono comprese.</div>'
    + '<div class="firme"><div>L\'operatore</div><div>Controllato da</div></div>'
    + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>';
  w.document.open(); w.document.write(html); w.document.close();
}
