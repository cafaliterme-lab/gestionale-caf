/* ---------------- 🗓️ Agenda appuntamenti ----------------
   I giorni e gli orari sono quelli dell'ufficio (Messaggi → orari), divisi in spazi della durata scelta
   dall'amministratore. Il giorno prima si manda il promemoria su WhatsApp; quando il cliente arriva
   si apre la pratica già compilata con i suoi dati. Tabella "appuntamenti", visibile a tutti gli operatori. */

const AGENDA = { giorno: '', lista: [], caricato: false, inCarica: false };
const STATI_APPUNTAMENTO = {
  prenotato: { l: '🕒 Prenotato', c: '#1d4f91' },
  arrivato: { l: '✅ Arrivato', c: '#1a7f37' },
  non_venuto: { l: '❌ Non venuto', c: '#c0392b' },
};

function isoDaData(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dataDaIso(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(); }
function itDaIso(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
function oggiIso() { return isoDaData(new Date()); }
function spostaIso(iso, giorni) { const d = dataDaIso(iso); d.setDate(d.getDate() + giorni); return isoDaData(d); }
function giornoLungo(iso) { return dataDaIso(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }); }
function durataAgenda() { const n = parseInt((typeof IMPOSTAZIONI !== 'undefined' && IMPOSTAZIONI.agenda_durata) || '', 10); return n >= 5 && n <= 240 ? n : 30; }
function minuti(h) { const m = /^(\d{1,2}):(\d{2})/.exec(h || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function oraDaMinuti(n) { return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }

// Spazi del giorno dagli orari dell'ufficio (mattina e pomeriggio)
function fasceGiorno(iso) {
  const t = typeof leggiTabellaOrari === 'function' ? leggiTabellaOrari() : [];
  const g = t[(dataDaIso(iso).getDay() + 6) % 7];
  if (!g || !g.aperto) return [];
  const dur = durataAgenda(), out = [];
  [[g.ma, g.mc], [g.pa, g.pc]].forEach(function (f) {
    const a = minuti(f[0]), c = minuti(f[1]);
    if (a === null || c === null) return;
    for (let m = a; m + dur <= c; m += dur) out.push(oraDaMinuti(m));
  });
  return out;
}

function puoUsareAgenda() { return typeof puo === 'function' && (puo('anagrafica') || puo('registro')); }
function puoScrivereAgenda() { return typeof puo === 'function' && (puo('anagrafica', true) || puo('registro', true)); }

async function caricaAppuntamenti() {
  if (!puoUsareAgenda() || AGENDA.inCarica) return;
  AGENDA.inCarica = true;
  try {
    const da = spostaIso(oggiIso(), -90), a = spostaIso(oggiIso(), 240);
    const r = await fetchSupabase('/rest/v1/appuntamenti?select=*&data=gte.' + da + '&data=lte.' + a + '&order=data.asc,ora.asc', 'GET');
    if (r && r.ok && Array.isArray(r.data)) { AGENDA.lista = r.data; AGENDA.caricato = true; }
  } catch (e) { /* senza rete l'agenda resta quella già caricata */ }
  AGENDA.inCarica = false;
  aggiornaVisteAgenda();
}
function aggiornaVisteAgenda() {
  const t = document.getElementById('tab-agenda');
  if (t && t.classList.contains('active')) disegnaAgenda();
  if (typeof renderOggi === 'function') renderOggi();
}
// l'agenda si aggiorna da sola ogni 2 minuti (altri operatori possono prenotare)
setInterval(function () { if (document.visibilityState === 'visible' && auth && auth.profilo) caricaAppuntamenti(); }, 120000);

function appuntamentiDel(iso) { return AGENDA.lista.filter(function (a) { return a.data === iso; }).sort(function (x, y) { return String(x.ora).localeCompare(String(y.ora)); }); }
function appuntamentiAttivi(iso) { return appuntamentiDel(iso).filter(function (a) { return a.stato !== 'non_venuto'; }); }
// promemoria da mandare: appuntamenti di domani (o del primo giorno di apertura dopo oggi) ancora senza promemoria
function giornoPromemoria() {
  for (let i = 1; i <= 7; i++) { const g = spostaIso(oggiIso(), i); if (fasceGiorno(g).length || appuntamentiDel(g).length) return g; }
  return spostaIso(oggiIso(), 1);
}
function promemoriaDaMandare() { return appuntamentiDel(giornoPromemoria()).filter(function (a) { return a.stato === 'prenotato' && !a.promemoria_il; }); }

function renderAgenda() {
  if (!AGENDA.giorno) AGENDA.giorno = oggiIso();
  disegnaAgenda();
  caricaAppuntamenti();
}

function disegnaAgenda() {
  const box = document.getElementById('tab-agenda'); if (!box) return;
  const g = AGENDA.giorno || oggiIso();
  const scrive = puoScrivereAgenda(), admin = auth.profilo && auth.profilo.ruolo === 'admin';
  const btn = function (onclick, testo, colore, titolo) { return '<button type="button" onclick="' + onclick + '"' + (titolo ? ' title="' + titolo + '"' : '') + ' style="background:' + colore + '; color:#fff; border:none; border-radius:999px; padding:7px 14px; font-weight:800; cursor:pointer">' + testo + '</button>'; };
  const prom = promemoriaDaMandare(), gp = giornoPromemoria();
  // settimana del giorno scelto (da lunedì a domenica), con il numero di appuntamenti
  const lun = spostaIso(g, -((dataDaIso(g).getDay() + 6) % 7));
  const settimana = [0, 1, 2, 3, 4, 5, 6].map(function (i) {
    const d = spostaIso(lun, i), n = appuntamentiAttivi(d).length, aperto = fasceGiorno(d).length > 0, sel = d === g, oggi = d === oggiIso();
    return '<button type="button" onclick="AGENDA.giorno=\'' + d + '\'; disegnaAgenda()" style="flex:1 1 0; min-width:62px; padding:6px 4px; border-radius:10px; cursor:pointer; border:2px solid ' + (sel ? '#0f766e' : 'var(--line)') + '; background:' + (sel ? '#0f766e' : (aperto ? 'var(--card)' : 'var(--bg)')) + '; color:' + (sel ? '#fff' : 'var(--ink)') + '; opacity:' + (aperto || n ? 1 : .55) + '">'
      + '<div style="font-size:11px; font-weight:700; text-transform:capitalize">' + dataDaIso(d).toLocaleDateString('it-IT', { weekday: 'short' }) + (oggi ? ' •' : '') + '</div>'
      + '<div style="font-size:16px; font-weight:800">' + dataDaIso(d).getDate() + '</div>'
      + '<div style="font-size:11px">' + (n ? n + ' app.' : (aperto ? 'libero' : 'chiuso')) + '</div>'
      + (scadenzeDelGiorno(d).length ? '<div style="font-size:10.5px; font-weight:800; color:' + (sel ? '#fff' : '#7b3fa0') + '">⏰ ' + scadenzeDelGiorno(d).length + '</div>' : '') + '</button>';
  }).join('');
  const fasce = fasceGiorno(g), lista = appuntamentiDel(g);
  // gli orari di appuntamenti fuori dagli spazi (es. orario cambiato) si mostrano lo stesso
  const ore = fasce.slice();
  lista.forEach(function (a) { if (ore.indexOf(a.ora) < 0) ore.push(a.ora); });
  ore.sort();
  const passato = g < oggiIso();
  const righe = ore.map(function (h) {
    const qui = lista.filter(function (a) { return a.ora === h; });
    return '<div style="display:flex; gap:10px; align-items:flex-start; padding:8px 0; border-bottom:1px solid var(--line)">'
      + '<div style="flex:none; width:58px; font-size:17px; font-weight:800; color:#0f766e; padding-top:6px">' + esc(h) + '</div>'
      + '<div style="flex:1; display:flex; flex-direction:column; gap:6px; min-width:0">' + qui.map(cardAppuntamentoHTML).join('')
      + (scrive && !passato ? '<button type="button" onclick="nuovoAppuntamento(\'' + g + '\', \'' + h + '\')" style="align-self:flex-start; background:none; border:2px dashed ' + (qui.length ? 'var(--line)' : '#0f766e') + '; color:#0f766e; border-radius:10px; padding:6px 14px; font-weight:700; cursor:pointer">+ Prenota' + (qui.length ? ' un altro' : '') + '</button>' : (qui.length ? '' : '<span class="sub2" style="padding-top:8px">libero</span>')) + '</div></div>';
  }).join('');
  const nGiorno = appuntamentiAttivi(g).length;
  box.innerHTML = '<div class="card" style="border:2px solid #0f766e">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px">'
    + '<div style="font-size:19px; font-weight:800; color:#0f766e">🗓️ Agenda appuntamenti</div>'
    + '<span style="display:flex; gap:6px; flex-wrap:wrap">'
    + (prom.length ? btn('apriPromemoriaAgenda()', '💬 Promemoria per ' + (gp === spostaIso(oggiIso(), 1) ? 'domani' : giornoLungo(gp)) + ' (' + prom.length + ')', '#25a35a', 'Manda il promemoria su WhatsApp a chi ha l\'appuntamento') : '')
    + (typeof apriRichiami === 'function' ? btn('apriRichiami(\'campagna\')', '📢 Avvio campagna 730', '#b35f0c', 'Avvisa i clienti dell\'anno scorso che è iniziata la campagna 730') : '')
    + btn('stampaAgenda()', '🖨️ Stampa il giorno', '#374151') + '</span></div>'
    + '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-bottom:8px">'
    + btn('AGENDA.giorno=spostaIso(AGENDA.giorno,-7); disegnaAgenda()', '◀◀', '#5b6b82', 'Settimana prima')
    + btn('AGENDA.giorno=spostaIso(AGENDA.giorno,-1); disegnaAgenda()', '◀', '#5b6b82', 'Giorno prima')
    + '<input type="date" value="' + g + '" onchange="if(this.value){ AGENDA.giorno=this.value; disegnaAgenda(); }" style="width:auto; padding:6px 10px">'
    + btn('AGENDA.giorno=oggiIso(); disegnaAgenda()', 'Oggi', '#0f766e')
    + btn('AGENDA.giorno=spostaIso(AGENDA.giorno,1); disegnaAgenda()', '▶', '#5b6b82', 'Giorno dopo')
    + btn('AGENDA.giorno=spostaIso(AGENDA.giorno,7); disegnaAgenda()', '▶▶', '#5b6b82', 'Settimana dopo')
    + (admin ? '<label style="margin:0 0 0 auto; display:flex; align-items:center; gap:6px; font-size:12.5px">Durata appuntamento <select onchange="cambiaDurataAgenda(this.value)" style="width:auto; padding:5px 8px">' + [15, 20, 30, 40, 45, 60].map(function (m) { return '<option value="' + m + '"' + (m === durataAgenda() ? ' selected' : '') + '>' + m + ' minuti</option>'; }).join('') + '</select></label>' : '')
    + '</div>'
    + '<div style="display:flex; gap:5px; margin-bottom:10px; overflow-x:auto">' + settimana + '</div>'
    + '<div style="font-size:16px; font-weight:800; text-transform:capitalize; margin-bottom:2px">' + esc(giornoLungo(g)) + '</div>'
    + '<div class="sub2" style="margin-bottom:6px">' + (nGiorno ? nGiorno + ' appuntament' + (nGiorno === 1 ? 'o' : 'i') : 'Nessun appuntamento') + (fasce.length ? ' · ' + fasce.length + ' spazi da ' + durataAgenda() + ' minuti' : ' · ufficio chiuso secondo gli orari') + (AGENDA.caricato ? '' : ' · caricamento…') + '</div>'
    + scadenzeGiornoAgendaHTML(g)
    + (ore.length ? righe : '<div class="empty">Ufficio chiuso in questo giorno (orari in MESSAGGI).' + (scrive && !passato ? ' <button type="button" onclick="nuovoAppuntamento(\'' + g + '\', \'\')" style="margin-left:6px; background:#0f766e; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">+ Prenota lo stesso</button>' : '') + '</div>')
    + '</div>';
}

function cardAppuntamentoHTML(a) {
  const st = STATI_APPUNTAMENTO[a.stato] || STATI_APPUNTAMENTO.prenotato;
  const scrive = puoScrivereAgenda();
  const b = function (onclick, testo, colore, titolo) { return '<button type="button" onclick="' + onclick + '" title="' + (titolo || '') + '" style="background:' + colore + '; color:#fff; border:none; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:700; cursor:pointer">' + testo + '</button>'; };
  const id = esc(a.id);
  return '<div style="border:1px solid var(--line); border-left:5px solid ' + st.c + '; border-radius:10px; padding:7px 10px; background:var(--card)">'
    + '<div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap"><div><b>' + esc(a.nome) + '</b>' + (a.tipo ? ' <span style="background:var(--line); border-radius:999px; padding:1px 8px; font-size:11.5px; font-weight:700">' + esc(a.tipo) + '</span>' : '')
    + '<div class="sub2">' + [a.telefono ? '📞 ' + esc(a.telefono) : '', a.note ? '📝 ' + esc(a.note) : '', a.creato_da ? 'preso da ' + esc(a.creato_da) : ''].filter(Boolean).join(' · ') + '</div></div>'
    + '<span style="font-size:12px; font-weight:800; color:' + st.c + '">' + st.l + (a.promemoria_il ? ' · 💬 avvisato' : '') + '</span></div>'
    + (scrive ? '<div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:6px">'
      + (a.stato !== 'arrivato' ? b('appuntamentoArrivato(\'' + id + '\')', '✅ È arrivato → apri pratica', '#1a7f37', 'Segna arrivato e apri l\'inserimento della pratica con i suoi dati') : '')
      + (a.stato === 'prenotato' ? b('inviaPromemoriaAppuntamento(\'' + id + '\')', '💬 Promemoria', '#25a35a', 'Promemoria su WhatsApp') : '')
      + (a.stato === 'prenotato' ? b('statoAppuntamento(\'' + id + '\', \'non_venuto\')', '❌ Non venuto', '#c0392b') : '')
      + (a.stato !== 'prenotato' ? b('statoAppuntamento(\'' + id + '\', \'prenotato\')', '↩️ Rimetti prenotato', '#5b6b82') : '')
      + b('stampaAppuntamento(\'' + id + '\')', '🖨️ Stampa', '#374151', 'Stampa il promemoria da dare al cliente')
      + b('modificaAppuntamento(\'' + id + '\')', '✏️', '#1d4f91', 'Cambia giorno, ora o dati')
      + b('eliminaAppuntamento(\'' + id + '\')', '🗑', '#6b7280', 'Cancella l\'appuntamento (es. disdetto)') + '</div>' : '')
    + '</div>';
}

async function cambiaDurataAgenda(v) {
  const { data: righe, error } = await supabase.from('impostazioni').update({ valore: String(v), aggiornato_il: new Date().toISOString() }).eq('chiave', 'agenda_durata').select('chiave');
  if (error || !righe || !righe.length) { avviso('❌ Durata non salvata' + (error ? ': ' + error.message : ''), true); return; }
  IMPOSTAZIONI.agenda_durata = String(v);
  avviso('✓ Ogni appuntamento dura ' + v + ' minuti');
  disegnaAgenda();
}

/* ---- Prenotazione ---- */
function nuovoAppuntamento(iso, ora, dati) { finestraAppuntamento(Object.assign({ data: iso || oggiIso(), ora: ora || '' }, dati || {})); }
function modificaAppuntamento(id) { const a = AGENDA.lista.find(function (x) { return x.id === id; }); if (a) finestraAppuntamento(a); }
// Prenotazione partendo da una persona (ricerca unica, campagna 730): primo spazio libero da oggi
function prenotaPer(dati) {
  for (let i = 0; i <= 60; i++) {
    const g = spostaIso(oggiIso(), i);
    const libero = fasceGiorno(g).find(function (h) { return !appuntamentiAttivi(g).some(function (a) { return a.ora === h; }) && (i > 0 || minuti(h) > new Date().getHours() * 60 + new Date().getMinutes()); });
    if (libero) { finestraAppuntamento(Object.assign({ data: g, ora: libero }, dati || {})); return; }
  }
  finestraAppuntamento(Object.assign({ data: oggiIso(), ora: '' }, dati || {}));
}

function tipiAppuntamento() {
  const l = (typeof getTipiList === 'function' ? getTipiList() : []).slice();
  ['730', 'ISEE', 'RED', 'IMU', 'ALTRO'].forEach(function (t) { if (l.indexOf(t) < 0) l.push(t); });
  return l;
}

function finestraAppuntamento(a) {
  const vecchio = document.getElementById('popup-appuntamento'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-appuntamento';
  ov.style.cssText = 'position:fixed; inset:0; z-index:478; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:12px';
  const nuovo = !a.id;
  const opzOre = function (iso, sel) {
    const occ = {}; appuntamentiAttivi(iso).forEach(function (x) { if (x.id !== a.id) occ[x.ora] = (occ[x.ora] || 0) + 1; });
    const ore = fasceGiorno(iso); if (sel && ore.indexOf(sel) < 0) ore.push(sel); ore.sort();
    return '<option value="">— scegli —</option>' + ore.map(function (h) { return '<option value="' + h + '"' + (h === sel ? ' selected' : '') + '>' + h + (occ[h] ? ' (già ' + occ[h] + ' prenotat' + (occ[h] === 1 ? 'o' : 'i') + ')' : ' · libero') + '</option>'; }).join('');
  };
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid #0f766e; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:16px 18px; max-width:540px; width:100%; max-height:92vh; overflow:auto">'
    + '<div style="font-size:19px; font-weight:800; color:#0f766e; margin-bottom:8px">🗓️ ' + (nuovo ? 'Nuovo appuntamento' : 'Modifica appuntamento') + '</div>'
    + '<label>Cliente <span style="font-weight:600; color:var(--sub)">(scrivi per cercarlo in archivio, o scrivi un nome nuovo)</span></label>'
    + '<input id="ap-nome" autocomplete="off" value="' + esc(a.nome || '') + '" style="text-transform:uppercase" placeholder="COGNOME NOME">'
    + '<div id="ap-trovati" style="margin:4px 0 6px"></div>'
    + '<div class="grid">'
    + '<div><label>Giorno</label><input id="ap-data" type="date" value="' + esc(a.data || oggiIso()) + '"></div>'
    + '<div><label>Ora</label><div style="display:flex; gap:6px"><select id="ap-ora" style="flex:1">' + opzOre(a.data || oggiIso(), a.ora || '') + '</select><input id="ap-ora-libera" type="time" title="Oppure scrivi un orario diverso" value="" style="width:110px"></div></div>'
    + '<div><label>Cellulare</label><input id="ap-tel" type="tel" inputmode="tel" value="' + esc(a.telefono || '') + '"></div>'
    + '<div><label>Pratica</label><select id="ap-tipo">' + tipiAppuntamento().map(function (t, i, l) { const pred = a.tipo || l.find(function (x) { return /730/.test(x); }) || ''; return '<option' + (t === pred ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></div>'
    + '<div class="full"><label>Note</label><input id="ap-note" value="' + esc(a.note || '') + '" placeholder="Es. congiunta con la moglie, porta le spese mediche"></div>'
    + '</div><input type="hidden" id="ap-cf" value="' + esc(a.codice_fiscale || '') + '"><input type="hidden" id="ap-email" value="' + esc(a.email || '') + '">'
    + '<div id="ap-msg" style="color:#c0392b; font-size:12.5px; font-weight:700; margin-top:8px"></div>'
    + '<div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; margin-top:12px"><button type="button" data-az="no" style="background:var(--line); color:var(--ink)">Annulla</button>'
    + '<button type="button" data-az="si" style="background:#0f766e; color:#fff; font-weight:800">💾 ' + (nuovo ? 'Prenota' : 'Salva') + '</button></div></div>';
  document.body.appendChild(ov);
  const el = function (id) { return document.getElementById(id); };
  el('ap-data').addEventListener('change', function () { el('ap-ora').innerHTML = opzOre(this.value, el('ap-ora').value); });
  const cerca = function () {
    const q = el('ap-nome').value.trim(); el('ap-nome').value = el('ap-nome').value.toUpperCase();
    const box = el('ap-trovati');
    if (q.length < 2) { box.innerHTML = ''; return; }
    const kq = chiaveRicerca(q);
    const lista = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).filter(function (c) { return !c.decedutoIl && kq && (chiaveRicerca(c.nomeCompleto) + ' ' + chiaveRicerca(c.codiceFiscale)).indexOf(kq) >= 0; }).slice(0, 6);
    box.innerHTML = lista.map(function (c, i) { return '<button type="button" data-i="' + i + '" style="display:block; width:100%; text-align:left; background:var(--bg); color:var(--ink); border:1px solid var(--line); border-radius:8px; padding:6px 10px; margin-bottom:4px; cursor:pointer"><b>' + esc(c.nomeCompleto) + '</b> <span class="sub2">' + [c.dataNascita, c.telefono || c.telefonoFisso].filter(Boolean).map(esc).join(' · ') + '</span></button>'; }).join('');
    box._lista = lista;
  };
  el('ap-nome').addEventListener('input', cerca);
  el('ap-trovati').addEventListener('click', function (e) {
    const b = e.target.closest('button[data-i]'); if (!b) return;
    const c = el('ap-trovati')._lista[+b.dataset.i]; if (!c) return;
    el('ap-nome').value = c.nomeCompleto; el('ap-tel').value = c.telefono || c.telefonoFisso || el('ap-tel').value;
    el('ap-cf').value = c.codiceFiscale || ''; el('ap-email').value = c.email || '';
    el('ap-trovati').innerHTML = '';
  });
  setTimeout(function () { if (!a.nome) el('ap-nome').focus(); }, 50);
  ov.addEventListener('click', async function (e) {
    const b = e.target.closest('button[data-az]');
    if (e.target === ov || (b && b.dataset.az === 'no')) { ov.remove(); return; }
    if (!b) return;
    const msg = el('ap-msg');
    const riga = { data: el('ap-data').value, ora: el('ap-ora-libera').value || el('ap-ora').value, nome: el('ap-nome').value.trim().toUpperCase(), telefono: el('ap-tel').value.trim() || null,
      tipo: el('ap-tipo').value, note: el('ap-note').value.trim() || null, codice_fiscale: el('ap-cf').value || null, email: el('ap-email').value || null };
    if (!riga.nome) { msg.textContent = 'Scrivi il nome del cliente.'; return; }
    if (!riga.data) { msg.textContent = 'Scegli il giorno.'; return; }
    if (!riga.ora) { msg.textContent = 'Scegli l\'ora (o scrivila nella casella accanto).'; return; }
    const doppio = AGENDA.lista.find(function (x) { return x.id !== a.id && x.data === riga.data && x.nome === riga.nome && x.stato !== 'non_venuto'; });
    if (doppio && !confirm(riga.nome + ' ha già un appuntamento il ' + itDaIso(riga.data) + ' alle ' + doppio.ora + '. Lo prenoto lo stesso?')) return;
    b.disabled = true;
    let r;
    try {
      if (nuovo) { riga.creato_da = ((auth.profilo && auth.profilo.nome) || '').toUpperCase(); r = await fetchSupabase('/rest/v1/appuntamenti', 'POST', riga, { Prefer: 'return=representation' }); }
      else {
        if (riga.data !== a.data || riga.ora !== a.ora) riga.promemoria_il = null; // cambiato giorno o ora: il promemoria va rimandato
        r = await fetchSupabase('/rest/v1/appuntamenti?id=eq.' + encodeURIComponent(a.id), 'PATCH', riga, { Prefer: 'return=representation' });
      }
    } catch (err) { r = { ok: false, data: { message: err.message } }; }
    b.disabled = false;
    if (!r || !r.ok || !Array.isArray(r.data) || !r.data[0]) { msg.textContent = 'Non salvato: ' + ((r && r.data && r.data.message) || 'errore di rete'); return; }
    const salvato = r.data[0];
    AGENDA.lista = AGENDA.lista.filter(function (x) { return x.id !== salvato.id; }).concat([salvato]);
    ov.remove();
    AGENDA.giorno = salvato.data;
    avviso('🗓️ ' + salvato.nome + ': ' + giornoLungo(salvato.data) + ' alle ' + salvato.ora);
    if (typeof a.dopo === 'function') a.dopo(salvato);
    // promemoria su carta da dare al cliente (solo per un appuntamento nuovo o spostato)
    if ((nuovo || riga.promemoria_il === null) && confirm('Appuntamento salvato: ' + giornoLungo(salvato.data) + ' alle ' + salvato.ora + '.\n\nStampo il promemoria da dare al cliente?')) stampaAppuntamento(salvato.id);
    aggiornaVisteAgenda();
  });
}

async function aggiornaAppuntamento(id, campi) {
  let r;
  try { r = await fetchSupabase('/rest/v1/appuntamenti?id=eq.' + encodeURIComponent(id), 'PATCH', campi, { Prefer: 'return=representation' }); } catch (e) { r = { ok: false, data: { message: e.message } }; }
  if (!r || !r.ok || !Array.isArray(r.data) || !r.data[0]) { avviso('❌ Appuntamento non aggiornato: ' + ((r && r.data && r.data.message) || 'errore di rete'), true); return null; }
  AGENDA.lista = AGENDA.lista.map(function (x) { return x.id === id ? r.data[0] : x; });
  aggiornaVisteAgenda();
  return r.data[0];
}
function statoAppuntamento(id, stato) { return aggiornaAppuntamento(id, { stato: stato }); }
async function eliminaAppuntamento(id) {
  const a = AGENDA.lista.find(function (x) { return x.id === id; }); if (!a) return;
  if (!confirm('Cancellare l\'appuntamento di ' + a.nome + ' (' + itDaIso(a.data) + ' alle ' + a.ora + ')?')) return;
  let r;
  try { r = await fetchSupabase('/rest/v1/appuntamenti?id=eq.' + encodeURIComponent(id), 'DELETE', null, { Prefer: 'return=representation' }); } catch (e) { r = { ok: false }; }
  if (!r || !r.ok) { avviso('❌ Appuntamento non cancellato', true); return; }
  AGENDA.lista = AGENDA.lista.filter(function (x) { return x.id !== id; });
  avviso('🗑 Appuntamento cancellato');
  aggiornaVisteAgenda();
}

/* ---- Promemoria su WhatsApp ---- */
function documentiDaPortare(tipo) {
  if (/730/i.test(tipo || '')) return 'documento d\'identità e tessera sanitaria (anche del coniuge se la dichiarazione è congiunta), Certificazione Unica (CU), il 730 dell\'anno scorso, le spese mediche e le altre spese da detrarre';
  if (/ISEE/i.test(tipo || '')) return 'documento d\'identità e tessera sanitaria di tutta la famiglia, saldi e giacenze medie dei conti al 31 dicembre, contratto d\'affitto';
  return 'documento d\'identità, tessera sanitaria e i documenti per la pratica';
}
function messaggioPromemoria(a) {
  return 'Gentile ' + (typeof nomeProprio === 'function' ? nomeProprio(a.nome) : a.nome) + ', le ricordiamo l\'appuntamento al CAF CISL di Alì Terme ' + giornoLungo(a.data) + ' alle ' + a.ora + (a.tipo ? ' per la pratica ' + a.tipo : '') + '.\n'
    + 'Porti con sé: ' + documentiDaPortare(a.tipo) + '.\nSe non può venire ci avvisi, così diamo il posto a un altro cliente. Grazie.\n\n' + (typeof righeContattiCaf === 'function' ? righeContattiCaf() : '');
}
function inviaPromemoriaAppuntamento(id) {
  const a = AGENDA.lista.find(function (x) { return x.id === id; }); if (!a) return;
  if (inviaWhatsAppLibero(a.telefono, messaggioPromemoria(a), a.nome)) aggiornaAppuntamento(id, { promemoria_il: new Date().toISOString() });
}
function apriPromemoriaAgenda() {
  const g = giornoPromemoria(), lista = appuntamentiDel(g).filter(function (a) { return a.stato === 'prenotato'; });
  const vecchio = document.getElementById('popup-promemoria'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-promemoria';
  ov.style.cssText = 'position:fixed; inset:0; z-index:476; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:12px';
  const disegna = function () {
    const righe = appuntamentiDel(g).filter(function (a) { return a.stato === 'prenotato'; });
    ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid #25a35a; padding:16px 18px; max-width:560px; width:100%; max-height:90vh; overflow:auto">'
      + '<div style="font-size:18px; font-weight:800; color:#1a7f37; text-transform:capitalize">💬 Promemoria – ' + esc(giornoLungo(g)) + '</div>'
      + '<div class="sub2" style="margin-bottom:10px">Tocca 💬 per ogni cliente: WhatsApp si apre con il messaggio pronto (giorno, ora e documenti da portare). Chi è già stato avvisato è segnato in verde.</div>'
      + (righe.length ? righe.map(function (a) {
        return '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--line)"><span><b>' + esc(a.ora) + '</b> · ' + esc(a.nome) + (a.tipo ? ' <span class="sub2">' + esc(a.tipo) + '</span>' : '') + (a.promemoria_il ? ' <b style="color:#1a7f37">✓ avvisato</b>' : '') + '</span>'
          + '<button type="button" data-id="' + esc(a.id) + '" style="background:' + (a.promemoria_il ? 'var(--line)' : '#25d366') + '; color:' + (a.promemoria_il ? 'var(--ink)' : '#fff') + '; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">💬 ' + (a.promemoria_il ? 'Rimanda' : 'Manda') + '</button></div>';
      }).join('') : '<div class="empty">Nessun appuntamento</div>')
      + '<div style="text-align:right; margin-top:12px"><button type="button" data-chiudi="1" style="background:var(--line); color:var(--ink)">Chiudi</button></div></div>';
  };
  disegna();
  document.body.appendChild(ov);
  ov.addEventListener('click', async function (e) {
    if (e.target === ov || e.target.closest('[data-chiudi]')) { ov.remove(); return; }
    const b = e.target.closest('button[data-id]'); if (!b) return;
    const a = AGENDA.lista.find(function (x) { return x.id === b.dataset.id; }); if (!a) return;
    if (inviaWhatsAppLibero(a.telefono, messaggioPromemoria(a), a.nome)) { await aggiornaAppuntamento(a.id, { promemoria_il: new Date().toISOString() }); disegna(); }
  });
  if (!lista.length) avviso('Nessun appuntamento da avvisare');
}

/* ---- Il cliente è arrivato: si apre la pratica con i suoi dati ---- */
async function appuntamentoArrivato(id) {
  const a = AGENDA.lista.find(function (x) { return x.id === id; }); if (!a) return;
  await aggiornaAppuntamento(id, { stato: 'arrivato' });
  apriPraticaPerNome(a.nome, a.codice_fiscale);
}
// Va all'inserimento pratica e sceglie il cliente dall'archivio (se c'è), altrimenti scrive il nome nella ricerca
function apriPraticaPerNome(nome, cf) {
  const tb = document.querySelector('.navmenu button[data-tab="anagrafica"]');
  if (tb && typeof showTab === 'function') showTab(tb);
  const cerca = document.getElementById('cli-cerca'); if (!cerca) return;
  cerca.value = nome || '';
  if (typeof cercaClienti !== 'function') return;
  cercaClienti(nome || '', 'main');
  const box = document.getElementById('cli-results');
  const match = JSON.parse((box && box.dataset.match) || '[]');
  let i = match.findIndex(function (c) { return cf && c.codiceFiscale === cf; });
  if (i < 0) i = match.findIndex(function (c) { return String(c.nomeCompleto || '').toUpperCase() === String(nome || '').toUpperCase(); });
  if (i >= 0 && typeof scegliCliente === 'function') scegliCliente(i, 'main');
  else cerca.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function stampaAgenda() {
  const g = AGENDA.giorno || oggiIso(), lista = appuntamentiDel(g);
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
  const righe = lista.map(function (a) { return '<tr><td><b>' + esc(a.ora) + '</b></td><td><b>' + esc(a.nome) + '</b></td><td>' + esc(a.tipo || '') + '</td><td>' + esc(a.telefono || '') + '</td><td>' + esc(a.note || '') + '</td><td>' + esc((STATI_APPUNTAMENTO[a.stato] || {}).l || '') + '</td><td style="width:22%"></td></tr>'; }).join('');
  w.document.open();
  w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Agenda ' + itDaIso(g) + '</title><style>body{font-family:Arial,Helvetica,sans-serif; font-size:12px; margin:0; padding:12px} h1{font-size:17px; color:#0f766e; margin:0 0 6px; text-transform:capitalize} table{width:100%; border-collapse:collapse} th,td{text-align:left; padding:6px; border-bottom:1px solid #cfd6e0; vertical-align:top} th{background:#f2f5f9} .barra button{font-size:14px; padding:8px 16px; margin:0 6px 10px 0} @media print{.barra{display:none}}</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa</button><button onclick="window.close()">Chiudi</button></div>'
    + '<h1>CAF CISL Alì Terme – Appuntamenti di ' + esc(giornoLungo(g)) + '</h1>'
    + '<table><thead><tr><th>Ora</th><th>Cliente</th><th>Pratica</th><th>Telefono</th><th>Note</th><th>Stato</th><th>Annotazioni</th></tr></thead><tbody>' + (righe || '<tr><td colspan="7">Nessun appuntamento</td></tr>') + '</tbody></table>'
    + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
  w.document.close();
}

// Appuntamenti futuri di una persona (per la ricerca unica e la campagna 730)
function appuntamentiPersona(nome, cf) {
  nome = String(nome || '').trim().toUpperCase(); cf = String(cf || '').trim().toUpperCase();
  return AGENDA.lista.filter(function (a) { return a.data >= oggiIso() && a.stato !== 'non_venuto' && ((cf && a.codice_fiscale === cf) || a.nome === nome); });
}

// Promemoria dell'appuntamento su carta, da dare al cliente: giorno, ora, documenti da portare, recapiti e orari
function stampaAppuntamento(id) {
  const a = AGENDA.lista.find(function (x) { return x.id === id; }); if (!a) return;
  const logo = document.querySelector('.hero-logo');
  const caf = typeof datiCafStampa === 'function' ? datiCafStampa() : {};
  const doc = documentiDaPortare(a.tipo).split(/,\s+(?![^(]*\))/).map(function (d) { d = d.replace(/^(e |il |le |i |la |lo )/i, '').replace(/ e le /i, ' e '); return d.charAt(0).toUpperCase() + d.slice(1); });
  const giorno = dataDaIso(a.data).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const html = '<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Appuntamento ' + esc(a.nome) + '</title><style>'
    + '@page{size:A5; margin:10mm} body{font-family:Arial,Helvetica,sans-serif; color:#0f1b2d; margin:0; padding:14px; font-size:13px}'
    + '.testa{display:flex; align-items:center; gap:10px; border-bottom:3px solid #c0141d; padding-bottom:8px} .testa img{width:52px; height:52px; border-radius:50%} h1{font-size:17px; margin:0; color:#00612f} .caf{font-size:11px; color:#5b6b82; margin-top:2px}'
    + '.titolo{text-align:center; font-size:18px; font-weight:800; letter-spacing:.06em; margin:14px 0 6px; color:#0f766e} .chi{text-align:center; font-size:15px; margin-bottom:10px}'
    + '.quando{text-align:center; border:3px solid #0f766e; border-radius:14px; padding:12px; margin:8px 0 14px} .quando .g{font-size:20px; font-weight:800; text-transform:capitalize} .quando .o{font-size:30px; font-weight:900; color:#0f766e; margin-top:4px} .quando .t{font-size:13px; margin-top:4px}'
    + 'h2{font-size:14px; margin:10px 0 4px} ul{margin:0; padding-left:20px} li{margin:3px 0} .nota{margin-top:10px; padding:8px 10px; background:#f2f5f9; border-radius:8px} .piede{margin-top:14px; font-size:12px; border-top:1px solid #cfd6e0; padding-top:8px}'
    + '</style></head><body>'
    + '<div class="testa">' + (logo ? '<img src="' + logo.src + '" alt="">' : '') + '<div><h1>CAF CISL – Sede di Alì Terme</h1><div class="caf">' + [caf.indirizzo ? '📍 ' + esc(caf.indirizzo) : '', caf.telefono ? '📞 ' + esc(caf.telefono) : '', caf.email ? '✉️ ' + esc(caf.email) : ''].filter(Boolean).join(' · ') + '</div></div></div>'
    + '<div class="titolo">PROMEMORIA APPUNTAMENTO</div>'
    + '<div class="chi">Gentile <b>' + esc(a.nome) + '</b>, la aspettiamo</div>'
    + '<div class="quando"><div class="g">' + esc(giorno) + '</div><div class="o">ore ' + esc(a.ora) + '</div>' + (a.tipo ? '<div class="t">per la pratica <b>' + esc(a.tipo) + '</b></div>' : '') + '</div>'
    + '<h2>📋 Cosa portare</h2><ul>' + doc.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>'
    + (a.note ? '<div class="nota">📝 ' + esc(a.note) + '</div>' : '')
    + '<div class="piede">Se non può venire ci avvisi, così diamo il posto a un altro cliente.<br>Per l\'appuntamento o per qualsiasi comunicazione: ' + [caf.telefono ? '📞 <b>' + esc(caf.telefono) + '</b>' : '', caf.email ? '✉️ <b>' + esc(caf.email) + '</b>' : ''].filter(Boolean).join(' · ') + (caf.orari ? '<br>Orari dell\'ufficio: ' + esc(caf.orari) : '') + '</div>'
    + '</body></html>';
  if (typeof mostraPaginaNelProgramma === 'function') { mostraPaginaNelProgramma(html, 'Promemoria appuntamento – ' + a.nome); return; }
  const w = window.open('', '_blank'); if (!w) { alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
  w.document.open(); w.document.write(html); w.document.close(); setTimeout(function () { w.print(); }, 300);
}

// Scadenze dello stesso giorno: solo da vedere, non sono collegate agli appuntamenti
function scadenzeDelGiorno(iso) {
  return (state.scadenze || []).filter(function (x) { return !x.completata && String(x.data || '').slice(0, 10) === iso; });
}
function scadenzeGiornoAgendaHTML(iso) {
  const l = scadenzeDelGiorno(iso); if (!l.length) return '';
  return '<div style="margin:2px 0 8px; padding:7px 12px; border-radius:10px; border:1.5px solid #7b3fa0; background:color-mix(in srgb, #7b3fa0 8%, var(--card)); font-size:13px">'
    + '<b style="color:#7b3fa0">⏰ Scadenze di questo giorno:</b> ' + l.map(function (x) { return '<b>' + esc(x.titolo || '') + '</b>' + (x.cliente ? ' – ' + esc(x.cliente) : ''); }).join(' · ')
    + ' <button type="button" onclick="showTab(document.querySelector(\'.navmenu button[data-tab=&quot;scadenze&quot;]\'))" style="margin-left:6px; background:none; border:1px solid #7b3fa0; color:#7b3fa0; border-radius:999px; padding:2px 10px; font-size:12px; font-weight:700; cursor:pointer">apri Scadenze</button></div>';
}
