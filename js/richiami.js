/* ---------------- Clienti da richiamare (fine campagna 730) ---------------- */
// Clienti che l'anno precedente hanno fatto il 730 (come titolari o come coniuge nella congiunta)
// e quest'anno non si sono ancora presentati: elenco con telefoni, chiamata, WhatsApp, e-mail
// ed esito del contatto (salvato nella tabella "richiami", visibile a tutti gli utenti).

// modo: 'richiamo' (fine campagna, luglio-ottobre) o 'campagna' (avvio della campagna 730, in primavera)
const RICHIAMI = { anno: null, esiti: {}, filtro: 'da_chiamare', cerca: '', caricato: false, modo: 'richiamo' };
const ESITI_RICHIAMO = {
  avvisato: { l: '📢 Avvisato (inizio campagna)', c: '#b35f0c' },
  richiamera: { l: '🔁 Richiamerà', c: '#1d4f91' },
  appuntamento: { l: '📅 Appuntamento preso', c: '#1a7f37' },
  non_risponde: { l: '📵 Non risponde', c: '#b35f0c' },
  altrove: { l: '🚫 Non interessato / va altrove', c: '#7a8699' },
  deceduto: { l: '✝️ Deceduto', c: '#4b5563' },
};
// dopo questi esiti il cliente non si richiama più
const ESITI_CHIUSI = ['appuntamento', 'altrove', 'deceduto'];

function chiaveRichiamo(nome, nascita, cf) {
  cf = String(cf || '').trim().toUpperCase();
  return cf || (String(nome || '').trim().toUpperCase() + '|' + String(nascita || '').trim());
}

function clientiDaRichiamare(anno) {
  const prec = anno - 1;
  const valida = function (p) { return p && !p.annullata && e730(p); };
  // chi si è già presentato quest'anno (titolare o coniuge di un 730)
  const cfOk = {}, nomeOk = {};
  (state.pratiche || []).forEach(function (p) {
    if (!valida(p) || annoPratica(p) !== anno) return;
    const segna = function (nome, nascita, cf) {
      nome = String(nome || '').trim().toUpperCase(); cf = String(cf || '').trim().toUpperCase();
      if (cf) cfOk[cf] = true;
      if (nome) { nomeOk[nome + '|' + (nascita || '')] = true; nomeOk[nome + '|'] = true; }
    };
    segna(p.nome, p.cf, p.codiceFiscale);
    const coniuge = ((p.congCognome || '') + ' ' + (p.congNome || '')).trim() || p.congiunta;
    if (coniuge) segna(coniuge, p.congData, p.congCodiceFiscale);
  });
  const presente = function (nome, nascita, cf) {
    if (cf && cfOk[cf]) return true;
    return !!(nomeOk[nome + '|' + (nascita || '')] || (!nascita && nomeOk[nome + '|']));
  };
  const persone = {};
  // primo anno del programma: l'anno prima non ci sono pratiche vere (solo prove), quindi
  // i clienti del 730 dell'anno scorso sono quelli dell'archivio (caricato con i 730 fatti prima del programma)
  const daArchivio = typeof ANNO_INIZIO_PROTOCOLLO !== 'undefined' && prec < ANNO_INIZIO_PROTOCOLLO;
  if (daArchivio) {
    (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).forEach(function (c) {
      const nome = String(c.nomeCompleto || '').trim().toUpperCase(), cf = String(c.codiceFiscale || '').trim().toUpperCase(), nascita = String(c.dataNascita || '').trim();
      if (!nome || c.decedutoIl || presente(nome, nascita, cf)) return;
      const k = chiaveRichiamo(nome, nascita, cf);
      if (persone[k]) return;
      persone[k] = { chiave: k, nome: nome, nascita: nascita, cf: cf, tel: c.telefono || '', fisso: c.telefonoFisso || '', email: c.email || '', daArchivio: true,
        pratiche: [{ p: { tipo: c.collaboratore || '730', nome: c.ruoloDichiarazione === 'coniuge' ? (c.dichiaranteNome || '') : nome, pagato: 0, iscrittoCisl: false, inseritoDa: '' }, coniuge: c.ruoloDichiarazione === 'coniuge' && !!c.dichiaranteNome }] };
    });
  }
  (state.pratiche || []).forEach(function (p) {
    if (daArchivio || !valida(p) || annoPratica(p) !== prec) return;
    const aggiungi = function (nome, nascita, cf, tel, fisso, email, comeConiuge) {
      nome = String(nome || '').trim().toUpperCase(); cf = String(cf || '').trim().toUpperCase(); nascita = String(nascita || '').trim();
      if (!nome || presente(nome, nascita, cf)) return;
      const k = chiaveRichiamo(nome, nascita, cf);
      const x = persone[k] || (persone[k] = { chiave: k, nome: nome, nascita: nascita, cf: cf, tel: '', fisso: '', email: '', pratiche: [] });
      if (!x.tel && tel) x.tel = tel; if (!x.fisso && fisso) x.fisso = fisso; if (!x.email && email) x.email = email;
      x.pratiche.push({ p: p, coniuge: comeConiuge });
    };
    aggiungi(p.nome, p.cf, p.codiceFiscale, p.telefono, p.telefonoFisso, p.email, false);
    const coniuge = ((p.congCognome || '') + ' ' + (p.congNome || '')).trim() || p.congiunta;
    if (coniuge) aggiungi(coniuge, p.congData, p.congCodiceFiscale, p.congTelefono, '', p.congEmail || '', true);
  });
  return Object.keys(persone).map(function (k) {
    const x = persone[k];
    // recapiti mancanti presi dall'archivio clienti
    const a = typeof trovaInArchivio === 'function' ? trovaInArchivio(x.nome, x.nascita, x.cf) : null;
    if (a) { if (!x.tel) x.tel = a.telefono || ''; if (!x.fisso) x.fisso = a.telefonoFisso || ''; if (!x.email) x.email = a.email || ''; }
    x.cisl = x.pratiche.some(function (r) { return r.p.iscrittoCisl; });
    // deceduto (segnato nella scheda dell'archivio): non si richiama
    x.deceduto = !!(a && a.decedutoIl);
    return x;
  }).filter(function (x) { return !x.deceduto; }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });
}

async function caricaEsitiRichiami(anno) {
  try {
    const r = await fetchSupabase('/rest/v1/richiami?select=*&anno=eq.' + anno, 'GET');
    if (r && r.ok && Array.isArray(r.data)) {
      const m = {};
      r.data.forEach(function (e) { m[e.chiave] = e; });
      RICHIAMI.esiti = m; RICHIAMI.caricato = true;
    }
  } catch (e) { /* senza esiti si vede comunque l'elenco */ }
}

function statoRichiamo(x) {
  const e = RICHIAMI.esiti[x.chiave];
  return e && e.esito && ESITI_RICHIAMO[e.esito] ? e : null;
}
// appuntamento già preso in agenda (conta come esito chiuso)
function appuntamentoRichiamo(x) { return typeof appuntamentiPersona === 'function' ? appuntamentiPersona(x.nome, x.cf)[0] || null : null; }
function chiusoRichiamo(x) { const e = statoRichiamo(x); return !!appuntamentoRichiamo(x) || !!(e && ESITI_CHIUSI.indexOf(e.esito) >= 0); }
function filtraRichiami(lista) {
  const q = RICHIAMI.cerca.trim().toUpperCase();
  return lista.filter(function (x) {
    if (q && (x.nome + ' ' + x.cf).indexOf(q) < 0 && chiaveRicerca(x.nome + x.cf).indexOf(chiaveRicerca(q)) < 0) return false;
    const e = statoRichiamo(x);
    if (RICHIAMI.filtro === 'da_chiamare') return !chiusoRichiamo(x) && !(RICHIAMI.modo === 'campagna' && e && e.esito === 'avvisato');
    if (RICHIAMI.filtro === 'contattati') return !!e || !!appuntamentoRichiamo(x);
    return true;
  });
}

function nomeGentile(nome) {
  return String(nome || '').toLowerCase().replace(/(^|[\s'’-])([a-zàèéìòù])/g, function (m, s, c) { return s + c.toUpperCase(); });
}
function messaggioRichiamo(x) {
  if (RICHIAMI.modo === 'campagna') return 'Gentile ' + nomeGentile(x.nome) + ', è iniziata la campagna 730 ' + RICHIAMI.anno + ' al CAF CISL di Alì Terme. Può prenotare il suo appuntamento chiamandoci o rispondendo a questo messaggio: le diremo anche quali documenti portare. Grazie!'
    + (typeof righeContattiCaf === 'function' ? '\n\n' + righeContattiCaf() : '');
  return 'Gentile ' + nomeGentile(x.nome) + ', il CAF CISL di Alì Terme le ricorda che è ancora possibile presentare la dichiarazione 730 ' + RICHIAMI.anno + '. Ci contatti per fissare un appuntamento. Grazie!';
}

// Avviso in cima al Registro da agosto a settembre
function avvisoRichiamiHTML() {
  if (!auth.profilo || document.body.classList.contains('sola-lettura')) return '';
  const mese = new Date().getMonth() + 1;
  if (mese < 8 || mese > 9) return '';
  try { if (sessionStorage.getItem('richiami-nascosto')) return ''; } catch (e) {}
  const n = clientiDaRichiamare(annoAttivo()).filter(function (x) {
    const e = RICHIAMI.anno === annoAttivo() ? statoRichiamo(x) : null;
    return !e || ESITI_CHIUSI.indexOf(e.esito) < 0;
  }).length;
  if (!n) return '';
  return '<div id="avviso-richiami" style="margin-bottom:12px; padding:10px 14px; border-radius:12px; background:#eef3fa; border:2px solid #1d4f91; display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between">'
    + '<span><b style="color:#1d4f91">📞 Fine campagna 730:</b> ' + n + ' client' + (n === 1 ? 'e' : 'i') + ' del ' + (annoAttivo() - 1) + ' non si ' + (n === 1 ? 'è' : 'sono') + ' ancora presentat' + (n === 1 ? 'o' : 'i') + ' quest\'anno.</span>'
    + '<span style="display:flex; gap:6px"><button type="button" onclick="apriRichiami()" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">📞 Clienti da richiamare</button>'
    + '<button type="button" title="Nascondi fino alla prossima apertura del programma" onclick="try{sessionStorage.setItem(\'richiami-nascosto\',\'1\')}catch(e){} document.getElementById(\'avviso-richiami\').remove()" style="background:none; border:1px solid #1d4f91; color:#1d4f91; border-radius:999px; padding:6px 10px; cursor:pointer">✕</button></span></div>';
}

async function apriRichiami(modo) {
  RICHIAMI.anno = annoAttivo();
  RICHIAMI.modo = modo === 'campagna' ? 'campagna' : 'richiamo';
  const camp = RICHIAMI.modo === 'campagna';
  if (typeof caricaAppuntamenti === 'function' && !AGENDA.caricato) caricaAppuntamenti();
  const vecchio = document.getElementById('popup-richiami'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-richiami';
  ov.style.cssText = 'position:fixed; inset:0; z-index:460; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:10px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border-top:6px solid #1d4f91; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:16px 18px; max-width:860px; width:100%; max-height:94vh; display:flex; flex-direction:column">'
    + '<div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start; flex-wrap:wrap">'
    + '<div><div style="font-size:19px; font-weight:800; color:' + (camp ? '#b35f0c' : '#1d4f91') + '">' + (camp ? '📢 Avvio campagna 730 ' : '📞 Clienti da richiamare – 730 ') + RICHIAMI.anno + '</div>'
    + '<div style="font-size:12.5px; color:var(--sub)">' + (camp ? 'Avvisa i clienti del 730 ' + (RICHIAMI.anno - 1) + ' (anche come coniuge) che la campagna è iniziata: tocca 💬 WhatsApp (il cliente viene segnato «avvisato») e, quando chiama, 🗓️ Prenota. ' : 'Hanno fatto il 730 nel ' + (RICHIAMI.anno - 1) + ' (anche come coniuge) e nel ' + RICHIAMI.anno + ' non si sono ancora presentati. ') + 'Chi ha l\'appuntamento in agenda o fa la pratica sparisce da solo.' + (typeof ANNO_INIZIO_PROTOCOLLO !== 'undefined' && RICHIAMI.anno - 1 < ANNO_INIZIO_PROTOCOLLO ? '<br><b style="color:#b35f0c">Primo anno del programma: l\'elenco viene dall\'archivio clienti (i 730 del ' + (RICHIAMI.anno - 1) + ' caricati prima di iniziare). I deceduti segnati nell\'archivio non compaiono.</b>' : '') + '</div></div>'
    + '<span style="display:flex; gap:6px; flex-wrap:wrap"><button type="button" onclick="stampaRichiami()" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer">🖨️ Stampa</button>'
    + '<button type="button" onclick="excelRichiami()" style="background:#1a7f37; color:#fff; border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer">📊 Excel</button>'
    + '<button type="button" onclick="document.getElementById(\'popup-richiami\').remove()" style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer">Chiudi</button></span></div>'
    + '<div id="ric-filtri" style="display:flex; gap:6px; flex-wrap:wrap; margin:10px 0 6px"></div>'
    + '<input id="ric-cerca" type="search" placeholder="Cerca un nome…" autocomplete="off" value="' + esc(RICHIAMI.cerca) + '" oninput="RICHIAMI.cerca=this.value; disegnaRichiami()" style="margin-bottom:8px">'
    + '<div id="ric-lista" style="overflow:auto; flex:1"><div class="empty">Caricamento…</div></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
  disegnaRichiami();
  await caricaEsitiRichiami(RICHIAMI.anno);
  disegnaRichiami();
}

function disegnaRichiami() {
  const box = document.getElementById('ric-lista'); if (!box) return;
  const tutti = clientiDaRichiamare(RICHIAMI.anno);
  const conta = { da_chiamare: 0, contattati: 0, tutti: tutti.length };
  tutti.forEach(function (x) { const e = statoRichiamo(x); if (e || appuntamentoRichiamo(x)) conta.contattati++; if (!chiusoRichiamo(x) && !(RICHIAMI.modo === 'campagna' && e && e.esito === 'avvisato')) conta.da_chiamare++; });
  const chip = function (k, t) { const on = RICHIAMI.filtro === k; return '<button type="button" onclick="RICHIAMI.filtro=\'' + k + '\'; disegnaRichiami()" style="padding:5px 12px; border-radius:999px; font-size:12.5px; font-weight:700; cursor:pointer; border:2px solid #1d4f91; background:' + (on ? '#1d4f91' : 'transparent') + '; color:' + (on ? '#fff' : '#1d4f91') + '">' + t + ' (' + conta[k] + ')</button>'; };
  document.getElementById('ric-filtri').innerHTML = chip('da_chiamare', RICHIAMI.modo === 'campagna' ? 'Da avvisare' : 'Da chiamare') + chip('contattati', 'Già contattati') + chip('tutti', 'Tutti');
  const lista = filtraRichiami(tutti);
  RICHIAMI._lista = lista;
  if (!tutti.length) { box.innerHTML = '<div class="empty">Nessun cliente da richiamare: tutti i clienti del 730 ' + (RICHIAMI.anno - 1) + ' si sono già presentati 👍</div>'; return; }
  if (!lista.length) { box.innerHTML = '<div class="empty">Nessun cliente in questo elenco</div>'; return; }
  const bt = function (href, testo, colore, extra) { return '<a href="' + href + '" ' + (extra || '') + ' style="display:inline-block; background:' + colore + '; color:#fff; text-decoration:none; border-radius:999px; padding:6px 12px; font-size:13px; font-weight:800">' + testo + '</a>'; };
  box.innerHTML = lista.map(function (x, i) {
    const e = statoRichiamo(x);
    const ultima = x.pratiche[0].p;
    const tipi = Array.from(new Set(x.pratiche.map(function (r) { return (r.p.tipo || '730') + (r.coniuge ? ' (coniuge di ' + r.p.nome + ')' : ''); }))).join(', ');
    const pagato = x.pratiche.reduce(function (t, r) { return t + (r.coniuge ? 0 : Number(r.p.pagato || 0)); }, 0);
    const wa = typeof numeroWhatsApp === 'function' ? numeroWhatsApp(x.tel) : '';
    const tel = function (n) { return String(n || '').replace(/[^\d+]/g, ''); };
    const contatti = [
      x.tel ? bt('tel:' + tel(x.tel), '📞 ' + esc(x.tel), '#1d4f91') : '',
      x.fisso ? bt('tel:' + tel(x.fisso), '☎️ ' + esc(x.fisso), '#3b5578') : '',
      wa ? bt('https://wa.me/' + wa + '?text=' + encodeURIComponent(messaggioRichiamo(x)), '💬 WhatsApp', '#25d366', 'target="_blank" rel="noopener" onclick="' + (RICHIAMI.modo === 'campagna' ? 'segnaAvvisato(' + i + '); ' : '') + 'registraRichiamoInviato(' + i + ', \'whatsapp\')"') : '',
      x.email ? bt('mailto:' + encodeURIComponent(x.email) + '?subject=' + encodeURIComponent('Dichiarazione 730 ' + RICHIAMI.anno) + '&body=' + encodeURIComponent(messaggioRichiamo(x)), '✉️ E-mail', '#8e5bd6', 'onclick="registraRichiamoInviato(' + i + ', \'email\')"') : '',
    ].filter(Boolean).join(' ');
    const opzioni = '<option value="">— esito del contatto —</option>' + Object.keys(ESITI_RICHIAMO).map(function (k) { return '<option value="' + k + '"' + (e && e.esito === k ? ' selected' : '') + '>' + ESITI_RICHIAMO[k].l + '</option>'; }).join('');
    const quando = e && e.quando ? new Date(e.quando) : null;
    return '<div style="border:1px solid var(--line); border-left:5px solid ' + (appuntamentoRichiamo(x) ? '#0f766e' : (e ? ESITI_RICHIAMO[e.esito].c : '#c0392b')) + '; border-radius:12px; padding:10px 12px; margin-bottom:8px">'
      + '<div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap"><div><b style="font-size:15px">' + esc(x.nome) + '</b>'
      + (x.cisl ? ' <span style="background:#c0392b; color:#fff; border-radius:999px; padding:0 7px; font-size:11px; font-weight:800">CISL</span>' : '')
      + '<div class="sub2">' + [x.nascita ? 'nato/a il ' + esc(x.nascita) : '', x.cf ? 'CF ' + esc(x.cf) : ''].filter(Boolean).join(' · ') + '</div>'
      + '<div class="sub2">' + (RICHIAMI.anno - 1) + ': ' + esc(tipi) + (pagato ? ' · pagato ' + fmtEuro(pagato) : '') + (ultima.inseritoDa ? ' · operatore ' + esc(ultima.inseritoDa) : '') + '</div></div>'
      + '<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:flex-start">' + (contatti || '<span style="color:#c0392b; font-size:12.5px; font-weight:700">Nessun recapito in archivio</span>')
      + (typeof prenotaPer === 'function' && !appuntamentoRichiamo(x) ? ' <button type="button" onclick="prenotaRichiamo(' + i + ')" style="background:#0f766e; color:#fff; border:none; border-radius:999px; padding:6px 12px; font-size:13px; font-weight:800; cursor:pointer">🗓️ Prenota</button>' : '') + '</div></div>'
      + (appuntamentoRichiamo(x) ? '<div style="margin-top:6px; font-size:13px; font-weight:800; color:#0f766e">🗓️ Appuntamento ' + esc(giornoLungo(appuntamentoRichiamo(x).data)) + ' alle ' + esc(appuntamentoRichiamo(x).ora) + '</div>' : '')
      + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; align-items:center">'
      + '<select id="ric-esito-' + i + '" style="width:auto; flex:0 1 250px">' + opzioni + '</select>'
      + '<input id="ric-nota-' + i + '" placeholder="Nota (es. richiamare dopo il 10)" value="' + esc((e && e.nota) || '') + '" style="flex:1 1 180px; min-width:140px">'
      + '<button type="button" onclick="salvaRichiamo(' + i + ', this)" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">💾 Salva</button></div>'
      + (e ? '<div class="sub2" style="margin-top:4px">Ultimo contatto: <b>' + ESITI_RICHIAMO[e.esito].l + '</b>' + (e.chi ? ' · ' + esc(e.chi) : '') + (quando && !isNaN(quando) ? ' · ' + quando.toLocaleDateString('it-IT') + ' ' + quando.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '') + '</div>' : '')
      + '</div>';
  }).join('');
}

// WhatsApp o e-mail dall'elenco: resta nel registro delle comunicazioni del cliente
function registraRichiamoInviato(i, canale) {
  const x = (RICHIAMI._lista || [])[i]; if (!x || typeof registraComunicazione !== 'function') return;
  contestoComunicazione({ nome: x.nome, cf: x.cf || '', motivo: RICHIAMI.modo === 'campagna' ? 'Avvio campagna 730' : 'Richiamo 730' });
  registraComunicazione({ canale: canale, telefono: canale === 'whatsapp' ? x.tel : null, email: canale === 'email' ? x.email : null, testo: messaggioRichiamo(x) });
}
// campagna: chi riceve il WhatsApp viene segnato «avvisato» (se non ha già un altro esito)
function segnaAvvisato(i) {
  const x = (RICHIAMI._lista || [])[i]; if (!x || statoRichiamo(x)) return;
  salvaEsitoRichiamo(x, 'avvisato', '');
}
function prenotaRichiamo(i) {
  const x = (RICHIAMI._lista || [])[i]; if (!x) return;
  prenotaPer({ nome: x.nome, codice_fiscale: x.cf || null, telefono: x.tel || x.fisso || '', email: x.email || '', tipo: (x.pratiche[0] && x.pratiche[0].p.tipo) || '',
    dopo: function () { salvaEsitoRichiamo(x, 'appuntamento', ''); } });
}
async function salvaEsitoRichiamo(x, esito, nota) {
  const riga = { anno: RICHIAMI.anno, chiave: x.chiave, nome: x.nome, esito: esito, nota: nota || '', chi: ((auth.profilo && auth.profilo.nome) || '').toUpperCase(), quando: new Date().toISOString() };
  let r;
  try { r = await fetchSupabase('/rest/v1/richiami?on_conflict=anno,chiave', 'POST', riga, { Prefer: 'resolution=merge-duplicates,return=representation' }); } catch (e) { r = { ok: false }; }
  if (r && r.ok) RICHIAMI.esiti[x.chiave] = Array.isArray(r.data) && r.data[0] ? r.data[0] : riga;
  disegnaRichiami();
}
async function salvaRichiamo(i, b) {
  const x = (RICHIAMI._lista || [])[i]; if (!x) return;
  const esito = document.getElementById('ric-esito-' + i).value;
  const nota = document.getElementById('ric-nota-' + i).value.trim().slice(0, 500);
  if (!esito && !nota) { avviso('Scegli l\'esito del contatto', true); return; }
  if (!esito) { avviso('Scegli anche l\'esito del contatto', true); return; }
  b.disabled = true;
  const riga = { anno: RICHIAMI.anno, chiave: x.chiave, nome: x.nome, esito: esito, nota: nota, chi: ((auth.profilo && auth.profilo.nome) || '').toUpperCase(), quando: new Date().toISOString() };
  let r;
  try { r = await fetchSupabase('/rest/v1/richiami?on_conflict=anno,chiave', 'POST', riga, { Prefer: 'resolution=merge-duplicates,return=representation' }); } catch (e) { r = { ok: false, data: { message: e.message } }; }
  b.disabled = false;
  if (!r || !r.ok) { avviso('❌ Esito non salvato: ' + ((r && r.data && r.data.message) || 'errore di rete'), true); return; }
  RICHIAMI.esiti[x.chiave] = Array.isArray(r.data) && r.data[0] ? r.data[0] : riga;
  avviso('✓ ' + x.nome + ': ' + ESITI_RICHIAMO[esito].l);
  disegnaRichiami();
}

function righeRichiami() {
  return filtraRichiami(clientiDaRichiamare(RICHIAMI.anno || annoAttivo()));
}
function stampaRichiami() {
  const lista = righeRichiami();
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
  const filtro = { da_chiamare: 'da chiamare', contattati: 'già contattati', tutti: 'tutti' }[RICHIAMI.filtro];
  const righe = lista.map(function (x, i) {
    const e = statoRichiamo(x);
    return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(x.nome) + '</b><div class="sub2">' + esc(x.nascita || '') + (x.cf ? ' · ' + esc(x.cf) : '') + '</div></td>'
      + '<td>' + [x.tel, x.fisso].filter(Boolean).map(esc).join('<br>') + '</td><td>' + esc(x.email || '') + '</td>'
      + '<td>' + esc(x.pratiche.map(function (r) { return r.p.tipo || '730'; }).join(', ')) + (x.cisl ? ' · CISL' : '') + '</td>'
      + '<td>' + (e ? esc(ESITI_RICHIAMO[e.esito].l.replace(/^\S+\s/, '')) + (e.nota ? '<div class="sub2">' + esc(e.nota) + '</div>' : '') : '') + '</td><td class="vuota"></td></tr>';
  }).join('');
  w.document.open();
  w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Clienti da richiamare 730 ' + RICHIAMI.anno + '</title><style>@page{size:A4 landscape; margin:10mm} body{font-family:Arial,Helvetica,sans-serif; font-size:11.5px; color:#0f1b2d; margin:0; padding:10px}'
    + 'h1{font-size:17px; color:#1d4f91; margin:0} table{width:100%; border-collapse:collapse; margin-top:8px} th,td{text-align:left; padding:5px 6px; border-bottom:1px solid #cfd6e0; vertical-align:top} th{background:#f2f5f9; font-size:11px} .sub2{font-size:10px; color:#5b6b82} td.vuota{width:28%}'
    + '.barra{margin-bottom:10px} .barra button{font-size:14px; padding:8px 16px; margin-right:6px} @media print{.barra{display:none} body{padding:0}}</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button><button onclick="window.close()">Chiudi</button></div>'
    + '<h1>CAF CISL Alì Terme – Clienti da richiamare (730 ' + RICHIAMI.anno + ')</h1><div class="sub2">Clienti del 730 ' + (RICHIAMI.anno - 1) + ' non ancora presentati · elenco: ' + filtro + ' · ' + lista.length + ' clienti · stampato il ' + new Date().toLocaleDateString('it-IT') + '</div>'
    + '<table><thead><tr><th>#</th><th>Cliente</th><th>Telefoni</th><th>E-mail</th><th>Pratica ' + (RICHIAMI.anno - 1) + '</th><th>Esito registrato</th><th>Esito telefonata / note</th></tr></thead><tbody>' + righe + '</tbody></table>'
    + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
  w.document.close();
}
function excelRichiami() {
  if (typeof XLSX === 'undefined') { alert('Excel non disponibile: controlla la connessione e riprova.'); return; }
  const righe = righeRichiami().map(function (x) {
    const e = statoRichiamo(x);
    return { 'Cliente': x.nome, 'Nato/a il': x.nascita, 'Codice fiscale': x.cf, 'Cellulare': x.tel, 'Telefono fisso': x.fisso, 'E-mail': x.email,
      ['Pratica ' + (RICHIAMI.anno - 1)]: x.pratiche.map(function (r) { return r.p.tipo || '730'; }).join(', '), 'Iscritto CISL': x.cisl ? 'SI' : '',
      'Esito': e ? ESITI_RICHIAMO[e.esito].l.replace(/^\S+\s/, '') : '', 'Nota': (e && e.nota) || '', 'Contattato da': (e && e.chi) || '', 'Il': e && e.quando ? new Date(e.quando).toLocaleDateString('it-IT') : '' };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(righe), 'Da richiamare');
  XLSX.writeFile(wb, 'clienti-da-richiamare-730-' + RICHIAMI.anno + '.xlsx');
}
