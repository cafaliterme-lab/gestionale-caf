/* ---------------- 🔎 Ricerca unica ----------------
   Casella sempre visibile sotto il menu: scrivi un nome o un codice fiscale e apri la scheda della persona
   con anagrafica, pratiche di tutti gli anni, debiti, scadenze e appuntamenti, più i tasti veloci
   (chiama, WhatsApp, e-mail, modifica, nuova pratica, prenota). */

const RICERCA_UNICA = { lista: [], sel: -1 };

function personeRicercaUnica(q) {
  q = String(q || '').trim();
  if (q.length < 2) return [];
  const Q = q.toUpperCase(), kq = chiaveRicerca(q);
  const persone = (typeof personeStorico === 'function' ? personeStorico(q) : []).map(function (x) { return Object.assign({}, x); });
  // dall'archivio clienti: anche chi non ha ancora pratiche
  (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).forEach(function (c) {
    const testo = (c.nomeCompleto || '') + ' ' + (c.codiceFiscale || '');
    if (testo.toUpperCase().indexOf(Q) < 0 && !(kq && chiaveRicerca(testo).indexOf(kq) >= 0)) return;
    const cf = String(c.codiceFiscale || '').toUpperCase(), nome = String(c.nomeCompleto || '').toUpperCase();
    const gia = persone.find(function (x) { return (cf && x.cf === cf) || (x.nome === nome && (!x.nascita || !c.dataNascita || x.nascita === c.dataNascita)); });
    if (gia) { gia.cliente = c; if (!gia.cf && cf) gia.cf = cf; return; }
    persone.push({ nome: nome, nascita: c.dataNascita || '', cf: cf, telefono: c.telefono || '', n: 0, cliente: c });
  });
  persone.forEach(function (x) { if (!x.cliente && typeof trovaInArchivio === 'function') x.cliente = trovaInArchivio(x.nome, x.nascita, x.cf) || null; });
  // prima chi ha pratiche, poi in ordine di nome; i deceduti in fondo
  return persone.sort(function (a, b) {
    const da = a.cliente && a.cliente.decedutoIl ? 1 : 0, db = b.cliente && b.cliente.decedutoIl ? 1 : 0;
    return (da - db) || ((b.n > 0) - (a.n > 0)) || a.nome.localeCompare(b.nome);
  }).slice(0, 12);
}

function cercaRicercaUnica(q) {
  const box = document.getElementById('ru-risultati'); if (!box) return;
  const lista = personeRicercaUnica(q);
  RICERCA_UNICA.lista = lista; RICERCA_UNICA.sel = lista.length ? 0 : -1;
  if (String(q || '').trim().length < 2) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = 'block';
  box.innerHTML = lista.length ? lista.map(function (x, i) {
    const c = x.cliente || {};
    return '<div class="ru-riga' + (i === 0 ? ' sel' : '') + '" data-i="' + i + '"><b>' + esc(x.nome) + '</b>'
      + (c.decedutoIl ? ' <span class="ru-badge" style="background:#374151">✝️</span>' : '')
      + (typeof badgeRuolo === 'function' ? badgeRuolo(c) : '') + (c.collaboratore ? ' <span class="ru-badge" style="background:' + coloreCollaboratore(c.collaboratore) + '">🤝 ' + esc(c.collaboratore) + '</span>' : '') + (x.n ? ' <span class="ru-badge">' + x.n + (x.n === 1 ? ' pratica' : ' pratiche') + '</span>' : ' <span class="ru-badge" style="background:#8a8f98">solo archivio</span>')
      + '<div class="sub2">' + [x.nascita ? 'nato/a il ' + esc(x.nascita) : '', x.cf ? 'CF ' + esc(x.cf) : '', (c.telefono || x.telefono) ? '📞 ' + esc(c.telefono || x.telefono) : ''].filter(Boolean).join(' · ') + '</div></div>';
  }).join('') : '<div class="ru-riga" style="cursor:default">Nessuno trovato con «' + esc(q) + '»' + (typeof nuovoClienteArchivio === 'function' ? ' · <a href="#" onclick="event.preventDefault(); chiudiRicercaUnica(); nuovoClienteArchivio(\'' + esc(String(q).replace(/'/g, '')) + '\')">➕ Nuovo cliente</a>' : '') + '</div>';
}
function chiudiRicercaUnica() { const box = document.getElementById('ru-risultati'); if (box) { box.style.display = 'none'; } }
function tastoRicercaUnica(e) {
  const box = document.getElementById('ru-risultati'); if (!box) return;
  const n = RICERCA_UNICA.lista.length;
  if (e.key === 'Escape') { chiudiRicercaUnica(); e.target.blur(); return; }
  if (!n) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    RICERCA_UNICA.sel = (RICERCA_UNICA.sel + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
    box.querySelectorAll('.ru-riga').forEach(function (r, i) { r.classList.toggle('sel', i === RICERCA_UNICA.sel); });
  }
  if (e.key === 'Enter') { e.preventDefault(); apriSchedaPersona(RICERCA_UNICA.sel < 0 ? 0 : RICERCA_UNICA.sel); }
}
document.addEventListener('click', function (e) {
  const r = e.target.closest && e.target.closest('#ru-risultati .ru-riga[data-i]');
  if (r) { apriSchedaPersona(+r.dataset.i); return; }
  if (!(e.target.closest && e.target.closest('#ricerca-unica'))) chiudiRicercaUnica();
});

function apriSchedaPersona(i) {
  const x = RICERCA_UNICA.lista[i]; if (!x) return;
  chiudiRicercaUnica();
  const inp = document.getElementById('ru-cerca'); if (inp) inp.blur();
  RICERCA_UNICA.persona = x;
  const vecchio = document.getElementById('popup-persona'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-persona';
  ov.style.cssText = 'position:fixed; inset:0; z-index:458; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:10px';
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-chiudi]')) ov.remove(); });
  document.body.appendChild(ov);
  disegnaSchedaPersona();
}
function disegnaSchedaPersona() {
  const ov = document.getElementById('popup-persona'), x = RICERCA_UNICA.persona; if (!ov || !x) return;
  const c = x.cliente || (typeof trovaInArchivio === 'function' ? trovaInArchivio(x.nome, x.nascita, x.cf) : null) || {};
  const pratiche = typeof praticheStorico === 'function' ? praticheStorico(x) : [];
  const valide = pratiche.filter(function (p) { return !p.annullata; });
  const residuo = function (p) { return typeof residuoPratica === 'function' && p.stato !== 'rinuncia_compilazione' && !p.saldataCollaboratore ? residuoPratica(p) : 0; };
  const manca = valide.reduce(function (t, p) { return t + residuo(p); }, 0);
  const tel = c.telefono || x.telefono || '', fisso = c.telefonoFisso || '', email = c.email || '';
  const st = c.documentoScadenza && typeof statoScadenzaDocumento === 'function' ? statoScadenzaDocumento(c.documentoScadenza) : null;
  const annoProt = annoAttivo();
  const nomeJs = esc(JSON.stringify(x.nome)), cfJs = esc(JSON.stringify(x.cf || ''));
  const b = function (onclick, testo, colore, titolo) { return '<button type="button" onclick="' + onclick + '"' + (titolo ? ' title="' + titolo + '"' : '') + ' style="background:' + colore + '; color:#fff; border:none; border-radius:999px; padding:7px 13px; font-weight:800; cursor:pointer">' + testo + '</button>'; };
  const link = function (href, testo, colore) { return '<a href="' + href + '" style="display:inline-block; background:' + colore + '; color:#fff; text-decoration:none; border-radius:999px; padding:7px 13px; font-weight:800">' + testo + '</a>'; };
  const scrive = typeof puo === 'function' && (puo('anagrafica', true) || puo('registro', true));
  // scadenze (colf, IMU…) con il suo nome
  const scad = (state.scadenze || []).filter(function (s) { return !s.completata && String(s.cliente || '').trim().toUpperCase() === x.nome; }).sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
  const app = typeof appuntamentiPersona === 'function' ? appuntamentiPersona(x.nome, x.cf) : [];
  const righe = pratiche.map(function (p) {
    const coniuge = String(p.nome || '').trim().toUpperCase() !== x.nome;
    const m = p.annullata ? 0 : residuo(p);
    return '<tr' + (p.annullata ? ' style="color:var(--sub)"' : '') + '><td><b>' + annoPratica(p) + '</b></td><td class="n"' + (p.annullata ? ' style="text-decoration:line-through"' : '') + '>' + formattaProtocollo(p) + '</td>'
      + '<td class="wrap">' + esc(p.tipo || '-') + (coniuge ? '<div class="sub2">coniuge di ' + esc(p.nome || '') + '</div>' : (p.congiunta ? '<div class="sub2">congiunta con ' + esc(p.congiunta) + '</div>' : '')) + '</td>'
      + '<td>' + (p.annullata ? '🚫 annullata' : esc(statoLabel(p.stato))) + (p.consegnataIl ? '<div class="sub2">📦 ' + esc(p.consegnataIl) + '</div>' : '') + '</td>'
      + '<td style="text-align:right">' + (Number(p.compenso) ? fmtEuro(p.compenso) : '-') + '</td><td style="text-align:right">' + (Number(p.pagato) ? fmtEuro(p.pagato) : '-') + '</td>'
      + '<td style="text-align:right; font-weight:800; color:' + (m > 0.004 ? '#c0392b' : '#1a7f37') + '">' + (p.annullata ? '' : (m > 0.004 ? fmtEuro(m) : '✓')) + '</td>'
      + '<td style="white-space:nowrap">' + (!p.annullata && annoPratica(p) === annoProt ? '<button type="button" onclick="document.getElementById(\'popup-persona\').remove(); apriDaStorico(\'' + p.id + '\')" style="background:var(--accent); color:var(--accent-ink); border:none; border-radius:6px; padding:4px 9px; font-size:12px; cursor:pointer">Apri</button> ' : '')
      + (typeof documentiStoricoHTML === 'function' ? documentiStoricoHTML(p) : '') + '</td></tr>';
  }).join('');
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border-top:6px solid #5e4fa2; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:16px 18px; max-width:980px; width:100%; max-height:94vh; overflow:auto">'
    + '<div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start; flex-wrap:wrap">'
    + '<div><div style="font-size:21px; font-weight:800">' + esc(x.nome) + (typeof badgeCollaboratore === 'function' ? badgeCollaboratore(c) + badgeRuolo(c) : '') + (c.decedutoIl ? ' <span style="font-size:13px; background:#374151; color:#fff; border-radius:999px; padding:2px 10px">✝️ deceduto/a il ' + esc(c.decedutoIl) + '</span>' : '') + '</div>'
    + '<div class="sub2">' + [x.nascita || c.dataNascita ? 'nato/a il ' + esc(x.nascita || c.dataNascita) : '', c.comuneNascita ? 'a ' + esc(c.comuneNascita) : '', x.cf ? 'CF ' + esc(x.cf) : ''].filter(Boolean).join(' · ') + '</div>'
    + '<div style="font-size:13px; margin-top:4px">' + [tel ? '📞 ' + esc(tel) : '', fisso ? '☎️ ' + esc(fisso) : '', email ? '✉️ ' + esc(email) : ''].filter(Boolean).join(' · ') + (tel || fisso || email ? '' : '<span style="color:#c0392b">Nessun recapito in archivio</span>') + '</div>'
    + (c.documentoScadenza || c.documentoNumero ? '<div style="margin-top:4px"><span style="display:inline-block; padding:2px 10px; border-radius:999px; font-size:12.5px; font-weight:700; color:#fff; background:' + (st && !st.valido ? '#c0392b' : '#1a7f37') + '">🪪 ' + esc(c.documentoTipo || 'Documento') + (c.documentoNumero ? ' ' + esc(c.documentoNumero) : '') + (c.documentoScadenza ? (st && !st.valido ? ' SCADUTO il ' : ' valido fino al ') + esc(c.documentoScadenza) : '') + '</span></div>' : '')
    + '</div><button type="button" data-chiudi="1" style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer">✕ Chiudi</button></div>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin:12px 0">'
    + (tel || fisso ? link('tel:' + String(tel || fisso).replace(/[^\d+]/g, ''), '📞 Chiama', '#1d4f91') : '')
    + (tel && typeof inviaWhatsAppLibero === 'function' ? b('inviaWhatsAppLibero(' + esc(JSON.stringify(tel)) + ', ' + esc(JSON.stringify('Gentile ' + (typeof nomeProprio === 'function' ? nomeProprio(x.nome) : x.nome) + ', ')) + ', ' + nomeJs + ')', '💬 WhatsApp', '#25d366') : '')
    + (typeof apriEmail === 'function' ? b('apriEmail({ titolo: \'E-mail a ' + esc(x.nome.replace(/'/g, ' ')) + '\', nome: ' + nomeJs + ', a: ' + esc(JSON.stringify(email)) + ', oggetto: \'CAF CISL Alì Terme\', testo: \'\' })', '📧 E-mail', '#8e5bd6') : '')
    + (scrive ? b('document.getElementById(\'popup-persona\').remove(); apriPraticaPerNome(' + nomeJs + ', ' + cfJs + ')', '➕ Nuova pratica', '#1a7f37', 'Apri l\'inserimento pratica con i suoi dati') : '')
    + (scrive && typeof prenotaPer === 'function' && !c.decedutoIl ? b('prenotaPer({ nome: ' + nomeJs + ', codice_fiscale: ' + cfJs + ', telefono: ' + esc(JSON.stringify(tel)) + ', email: ' + esc(JSON.stringify(email)) + ', dopo: function(){ disegnaSchedaPersona(); } })', '🗓️ Prenota appuntamento', '#0f766e') : '')
    + (c.id && typeof modificaClienteArchivio === 'function' ? b('modificaClienteArchivio(RICERCA_UNICA.persona.cliente || trovaInArchivio(' + nomeJs + ', \'\', ' + cfJs + '), disegnaSchedaPersona)', '✏️ Modifica anagrafica', '#5b6b82') : '')
    + (st && !st.valido && c.id && typeof richiediDocumentoCliente === 'function' ? b('richiediDocumentoCliente(\'' + esc(String(c.id)) + '\', \'wa\')', '💬 Chiedi documento', '#c0392b') : '')
    + '</div>'
    + (app.length ? '<div style="margin-bottom:10px; padding:8px 12px; border-radius:10px; background:color-mix(in srgb, #0f766e 10%, var(--card)); border:1.5px solid #0f766e"><b style="color:#0f766e">🗓️ Appuntament' + (app.length === 1 ? 'o' : 'i') + ':</b> ' + app.map(function (a) { return esc(giornoLungo(a.data)) + ' alle <b>' + esc(a.ora) + '</b>' + (a.tipo ? ' (' + esc(a.tipo) + ')' : ''); }).join(' · ') + '</div>' : '')
    + (scad.length ? '<div style="margin-bottom:10px; padding:8px 12px; border-radius:10px; background:color-mix(in srgb, #7b3fa0 10%, var(--card)); border:1.5px solid #7b3fa0"><b style="color:#7b3fa0">⏰ Scadenze:</b> ' + scad.map(function (s) { return esc(s.titolo || '') + ' – ' + esc(s.data ? itDaIso(String(s.data).slice(0, 10)) || s.data : ''); }).join(' · ') + '</div>' : '')
    + (typeof elencoComunicazioniHTML === 'function' ? elencoComunicazioniHTML(x.nome, x.cf) : '')
    + (typeof avvisoMorosoHTML === 'function' ? avvisoMorosoHTML(pratiche) : '')
    + '<div class="meta" style="margin:0 0 6px">' + valide.length + ' pratiche' + (pratiche.length > valide.length ? ' (+ ' + (pratiche.length - valide.length) + ' annullate)' : '') + ' · pagato in tutto <b>' + fmtEuro(valide.reduce(function (t, p) { return t + Number(p.pagato || 0); }, 0)) + '</b>'
    + (manca > 0.004 ? ' · <b style="color:#c0392b">deve ancora ' + fmtEuro(manca) + '</b>' : '') + '</div>'
    + (pratiche.length ? '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>Anno</th><th>Protocollo</th><th>Pratica</th><th>Stato</th><th style="text-align:right">Fattura</th><th style="text-align:right">Pagato</th><th style="text-align:right">Da pagare</th><th>Apri e ricevute</th></tr></thead><tbody>' + righe + '</tbody></table></div>'
      : '<div class="empty">Nessuna pratica: è solo nell\'archivio clienti.</div>')
    + '</div>';
}
