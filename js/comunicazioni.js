/* ---------------- 📨 Registro delle comunicazioni con i clienti ----------------
   Ogni WhatsApp aperto e ogni e-mail inviata dal programma lascia una riga (tabella "comunicazioni"):
   quando, come, perché, a chi e chi l'ha mandata. Si vede nella scheda della persona (ricerca unica)
   e nell'archivio clienti, così si sa subito se il cliente è già stato avvisato. */

const COMUNICAZIONI = { lista: [], caricato: false };
// Chi sta per ricevere il messaggio (lo indica chi apre WhatsApp o l'e-mail); si usa una volta sola
let CONTESTO_COMUNICAZIONE = null;
function contestoComunicazione(c) { CONTESTO_COMUNICAZIONE = c ? Object.assign({ quando: Date.now() }, c) : null; }

// Perché è stato mandato il messaggio, dal testo
function motivoDaTesto(t) {
  t = String(t || '').toLowerCase();
  if (/appuntamento/.test(t) && /ricordiamo/.test(t)) return 'Promemoria appuntamento';
  if (/iniziata la campagna/.test(t)) return 'Avvio campagna 730';
  if (/ancora possibile presentare/.test(t)) return 'Richiamo 730';
  if (/documento d'identit|documento d’identit/.test(t)) return 'Richiesta documento d\'identità';
  if (/ci mancano ancora|documenti mancanti/.test(t)) return 'Documenti mancanti';
  if (/ricevuta/.test(t)) return 'Invio ricevuta';
  if (/da pagare|deve ancora|saldo|pagamento/.test(t)) return 'Sollecito pagamento';
  if (/pronta|ritir|può passare|e' pronta|è pronta/.test(t)) return 'Pratica pronta';
  if (/assistenza.*scade|scade il/.test(t)) return 'Avviso scadenza';
  return 'Messaggio';
}
function soloCifre(s) { return String(s || '').replace(/\D/g, '').replace(/^(00)?39(?=\d{9,10}$)/, ''); }
// Il cliente dal numero di telefono (archivio, poi pratiche)
function personaDaTelefono(num) {
  const n = soloCifre(num); if (!n) return null;
  const c = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).find(function (x) { return soloCifre(x.telefono) === n || soloCifre(x.telefonoFisso) === n; });
  if (c) return { nome: c.nomeCompleto, cf: c.codiceFiscale || '', nascita: c.dataNascita || '' };
  const p = (state.pratiche || []).slice().reverse().find(function (x) { return soloCifre(x.telefono) === n; });
  if (p) return { nome: p.nome, cf: p.codiceFiscale || '', nascita: p.cf || '', praticaId: p.id };
  const q = (state.pratiche || []).slice().reverse().find(function (x) { return soloCifre(x.congTelefono) === n; });
  if (q) return { nome: (((q.congCognome || '') + ' ' + (q.congNome || '')).trim() || q.congiunta || ''), cf: q.congCodiceFiscale || '', nascita: q.congData || '' };
  return null;
}
function personaDaEmail(a) {
  a = String(a || '').trim().toLowerCase(); if (!a) return null;
  const c = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).find(function (x) { return String(x.email || '').toLowerCase() === a; });
  if (c) return { nome: c.nomeCompleto, cf: c.codiceFiscale || '', nascita: c.dataNascita || '' };
  const p = (state.pratiche || []).slice().reverse().find(function (x) { return String(x.email || '').toLowerCase() === a; });
  return p ? { nome: p.nome, cf: p.codiceFiscale || '', nascita: p.cf || '', praticaId: p.id } : null;
}

async function registraComunicazione(r) {
  if (!r || !auth || !auth.profilo) return;
  // senzaContesto: riga per una persona indicata qui (es. gli altri clienti di un messaggio unico), lascia il contesto a chi lo aspetta
  const ctx = !r.senzaContesto && CONTESTO_COMUNICAZIONE && Date.now() - CONTESTO_COMUNICAZIONE.quando < 120000 ? CONTESTO_COMUNICAZIONE : null;
  if (!r.senzaContesto) CONTESTO_COMUNICAZIONE = null;
  const chi = (r.canale === 'email' ? personaDaEmail(r.email) : personaDaTelefono(r.telefono)) || {};
  const riga = {
    canale: r.canale, motivo: r.motivo || (ctx && ctx.motivo) || motivoDaTesto(r.testo),
    nome: String((ctx && ctx.nome) || r.nome || chi.nome || '').trim().toUpperCase() || null,
    codice_fiscale: (ctx && ctx.cf) || r.cf || chi.cf || null,
    telefono: r.telefono || null, email: r.email || null,
    pratica_id: (ctx && ctx.praticaId) || r.praticaId || chi.praticaId || null,
    data_nascita: (ctx && ctx.nascita) || r.nascita || chi.nascita || null,
    testo: String(r.testo || '').slice(0, 400) || null,
    operatore: ((auth.profilo && auth.profilo.nome) || '').toUpperCase() || null,
  };
  if (!riga.nome && !riga.telefono && !riga.email) return;
  // senza data di nascita: si prende dall'archivio, se c'è un solo cliente con quel nome (gli omonimi restano distinti)
  if (riga.nome && !riga.data_nascita && !riga.codice_fiscale) { const o = omonimiArchivio(riga.nome); if (o.length === 1) riga.data_nascita = o[0].dataNascita || null; if (o.length === 1 && o[0].codiceFiscale) riga.codice_fiscale = o[0].codiceFiscale; }
  riga.quando = new Date().toISOString();
  COMUNICAZIONI.lista.unshift(riga);
  // WhatsApp appena aperto: si tiene la riga per poterla togliere se il numero non ha WhatsApp
  if (r.canale === 'whatsapp' && ULTIMO_WA && numeroWA(r.telefono) === ULTIMO_WA.num && Date.now() - ULTIMO_WA.quando < 120000) ULTIMO_WA.righe.push(riga);
  try {
    const x = await fetchSupabase('/rest/v1/comunicazioni', 'POST', riga, { Prefer: 'return=representation' });
    if (x && x.ok && Array.isArray(x.data) && x.data[0]) Object.assign(riga, x.data[0]);
  } catch (e) { /* senza rete la riga resta solo su questo dispositivo fino al prossimo caricamento */ }
  if (typeof disegnaSchedaPersona === 'function' && document.getElementById('popup-persona')) disegnaSchedaPersona();
}

async function caricaComunicazioni() {
  if (!(typeof puo === 'function' && (puo('anagrafica') || puo('registro')))) return;
  const da = new Date(Date.now() - 400 * 86400000).toISOString();
  try {
    const r = await fetchSupabase('/rest/v1/comunicazioni?select=*&quando=gte.' + encodeURIComponent(da) + '&order=quando.desc&limit=5000', 'GET');
    if (r && r.ok && Array.isArray(r.data)) { COMUNICAZIONI.lista = r.data; COMUNICAZIONI.caricato = true; }
  } catch (e) {}
}

// Clienti dell'archivio con questo nome (più di uno = omonimi)
function omonimiArchivio(nome) {
  nome = String(nome || '').trim().toUpperCase().replace(/\s+/g, ' ');
  return nome && typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI.filter(function (c) { return String(c.nomeCompleto || '').trim().toUpperCase().replace(/\s+/g, ' ') === nome; }) : [];
}
// Comunicazioni di una persona: per codice fiscale, altrimenti per nome e data di nascita.
// Con gli omonimi (stesso nome, nascita diversa) una riga senza data di nascita non si attribuisce a nessuno dei due.
function comunicazioniPersona(nome, cf, nascita) {
  nome = String(nome || '').trim().toUpperCase().replace(/\s+/g, ' '); cf = String(cf || '').trim().toUpperCase(); nascita = String(nascita || '').trim();
  const omonimi = omonimiArchivio(nome).length > 1;
  return COMUNICAZIONI.lista.filter(function (c) {
    const ccf = String(c.codice_fiscale || '').toUpperCase();
    if (cf && ccf) return ccf === cf;
    if (!nome || String(c.nome || '').replace(/\s+/g, ' ') !== nome) return false;
    if (nascita && c.data_nascita) return c.data_nascita === nascita;
    return !omonimi;
  });
}
function quandoComunicazione(c) {
  const d = new Date(c.quando);
  return isNaN(d) ? '' : d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
function iconaCanale(c) { return c.canale === 'email' ? '📧' : c.canale === 'sms' ? '📱' : '💬'; }
// Richiesta di documento a cui il cliente ha già risposto (documento nuovo inserito): «✅ documento arrivato»
function etichettaDocumentoArrivato(c) {
  return typeof richiestaDocumentoRisolta === 'function' && richiestaDocumentoRisolta(c) ? ' <span style="color:#1a7f37; font-weight:800">✅ documento arrivato</span>' : '';
}
// Riga breve con l'ultimo contatto (archivio clienti)
function ultimoContattoHTML(nome, cf, nascita) {
  const l = comunicazioniPersona(nome, cf, nascita); if (!l.length) return '';
  const c = l[0];
  return '<div style="font-size:11.5px; color:#1d4f91; font-weight:700">📨 Ultimo contatto: ' + iconaCanale(c) + ' ' + esc(quandoComunicazione(c).split(' ')[0]) + ' · ' + esc(c.motivo || '') + etichettaDocumentoArrivato(c) + (l.length > 1 ? ' <span style="color:var(--sub); font-weight:600">(' + l.length + ' in tutto)</span>' : '') + '</div>';
}
// Elenco completo (scheda della persona, modifica cliente)
function elencoComunicazioniHTML(nome, cf, max, nascita) {
  const l = comunicazioniPersona(nome, cf, nascita);
  if (!l.length) return '<div style="margin-bottom:10px; font-size:12.5px; color:var(--sub)">📨 Nessuna comunicazione registrata (WhatsApp ed e-mail mandati dal programma).</div>';
  const mostra = l.slice(0, max || 15);
  return '<details open style="margin-bottom:10px; padding:8px 12px; border-radius:10px; border:1.5px solid #1d4f91; background:color-mix(in srgb, #1d4f91 6%, var(--card))"><summary style="cursor:pointer; font-weight:800; color:#1d4f91">📨 Comunicazioni (' + l.length + ')</summary>'
    + mostra.map(function (c) {
      const elimina = c.id && auth && auth.profilo && auth.profilo.ruolo === 'admin' ? '<button type="button" title="Togli questa comunicazione (se è uno sbaglio)" onclick="eliminaComunicazione(\'' + esc(String(c.id)) + '\', this)" style="flex:none; background:none; border:none; cursor:pointer; font-size:14px; padding:0 2px">🗑️</button>' : '';
      return '<div data-com-id="' + esc(String(c.id || '')) + '" style="display:flex; gap:8px; align-items:center; padding:5px 0; border-bottom:1px solid var(--line); font-size:13px" title="' + esc(c.testo || '') + '"><span style="flex:none">' + iconaCanale(c) + '</span>'
        + '<span style="flex:1"><b>' + esc(c.motivo || 'Messaggio') + '</b>' + etichettaDocumentoArrivato(c) + ' <span class="sub2">' + esc(quandoComunicazione(c)) + (c.operatore ? ' · da ' + esc(c.operatore) : '') + (c.canale === 'email' && c.email ? ' · ' + esc(c.email) : (c.telefono ? ' · ' + esc(c.telefono) : '')) + '</span></span>' + elimina + '</div>';
    }).join('') + (l.length > mostra.length ? '<div class="sub2" style="margin-top:4px">… e altre ' + (l.length - mostra.length) + '</div>' : '') + '</details>';
}

/* ---------- 🗑️ Togliere una comunicazione (solo l'amministratore, per gli sbagli) ---------- */
// Se era l'avviso della campagna, il cliente torna «da avvisare»
async function annullaEffettiComunicazione(c) {
  const tolti = [];
  if (c.motivo === 'Avvio campagna 730' && c.nome) {
    try {
      const r = await fetchSupabase('/rest/v1/richiami?nome=eq.' + encodeURIComponent(c.nome) + '&esito=eq.avvisato&anno=eq.' + new Date(c.quando || Date.now()).getFullYear(), 'DELETE', null, { Prefer: 'return=representation' });
      if (r && r.ok && Array.isArray(r.data)) r.data.forEach(function (x) { tolti.push(x); if (typeof RICHIAMI !== 'undefined' && RICHIAMI.esiti[x.chiave]) delete RICHIAMI.esiti[x.chiave]; });
    } catch (e) { /* niente */ }
  }
  return tolti;
}
async function togliComunicazione(c) {
  if (!c) return false;
  if (c.id) {
    let r;
    try { r = await fetchSupabase('/rest/v1/comunicazioni?id=eq.' + encodeURIComponent(c.id), 'DELETE', null, { Prefer: 'return=representation' }); } catch (e) { r = { ok: false }; }
    if (!r || !r.ok || !Array.isArray(r.data) || !r.data.length) return false;
  }
  const i = COMUNICAZIONI.lista.indexOf(c); if (i >= 0) COMUNICAZIONI.lista.splice(i, 1);
  return true;
}
async function eliminaComunicazione(id, el) {
  const c = COMUNICAZIONI.lista.find(function (x) { return String(x.id) === String(id); });
  if (!c) return;
  if (!confirm('Tolgo questa comunicazione dallo storico?\n\n' + (c.motivo || 'Messaggio') + ' – ' + (c.nome || '') + ' – ' + quandoComunicazione(c) + (c.motivo === 'Avvio campagna 730' ? '\n\nIl cliente torna «da avvisare» nella campagna.' : ''))) return;
  if (!await togliComunicazione(c)) { avviso('❌ Non tolta: controlla la connessione', true); return; }
  await annullaEffettiComunicazione(c);
  avviso('✓ Comunicazione tolta');
  const riga = el && el.closest('[data-com-id]'); if (riga) riga.remove();
  if (typeof disegnaSchedaPersona === 'function' && document.getElementById('popup-persona')) disegnaSchedaPersona();
  if (typeof disegnaRichiami === 'function' && document.getElementById('ric-invio')) disegnaRichiami();
  if (typeof disegnaAuguri === 'function') disegnaAuguri();
}

/* ---------- 📵 Numero che non ha WhatsApp ----------
   Dopo ogni WhatsApp aperto dal programma compare in basso «❌ Non ha WhatsApp»: se WhatsApp dice che il numero
   non c'è, si tocca e il programma toglie il messaggio dalle comunicazioni (non è arrivato), toglie «avvisato»,
   segna nella scheda del cliente che quel cellulare non ha WhatsApp e propone e-mail, SMS o chiamata. */
let ULTIMO_WA = null;
// numero per WhatsApp, anche se è già nel formato internazionale (393…)
function numeroWA(tel) { const d = String(tel || '').replace(/\D/g, ''); return /^393\d{9}$/.test(d) ? d : numeroWhatsApp(tel); }
function numeroSenzaWhatsApp(tel) {
  const n = numeroWA(tel); if (!n) return null;
  return (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).find(function (c) { return c.noWhatsapp && numeroWhatsApp(c.telefono) === n; }) || null;
}
// cellulare a cui si può mandare WhatsApp (per i messaggi a tutti)
function haWhatsApp(tel) { return !!numeroWhatsApp(tel) && !numeroSenzaWhatsApp(tel); }
function iniziaInvioWhatsApp(num, testo) {
  ULTIMO_WA = { num: numeroWA(num) || String(num || ''), testo: testo, quando: Date.now(), righe: [], nome: CONTESTO_COMUNICAZIONE && CONTESTO_COMUNICAZIONE.nome };
}
function mostraBarraNoWhatsApp() {
  const v = document.getElementById('barra-no-wa'); if (v) v.remove();
  if (!ULTIMO_WA) return;
  const d = document.createElement('div');
  d.id = 'barra-no-wa';
  d.style.cssText = 'position:fixed; left:50%; bottom:14px; transform:translateX(-50%); z-index:470; max-width:94vw; display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:center; padding:8px 12px; border-radius:14px; background:var(--card); color:var(--ink); border:2px solid #c0392b; box-shadow:0 8px 24px rgba(0,0,0,.25); font-size:13px';
  const nome = ULTIMO_WA.nome || (ULTIMO_WA.righe[0] && ULTIMO_WA.righe[0].nome) || '';
  // è solo una domanda: il programma non sa se il numero è su WhatsApp, lo dice WhatsApp nella sua finestra
  d.innerHTML = '<span>💬 Messaggio aperto su WhatsApp' + (nome ? ' per <b>' + esc(nomeGentile ? nomeGentile(nome) : nome) + '</b>' : '') + '. <span class="sub2">Solo se <b>WhatsApp</b> ti ha risposto che il numero non c\'è:</span></span>'
    + '<button type="button" onclick="nonHaWhatsApp()" style="background:#c0392b; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">❌ Non ha WhatsApp</button>'
    + '<button type="button" onclick="this.parentNode.remove()" title="Il messaggio è partito: chiudi" style="background:#1a7f37; color:#fff; border:none; border-radius:999px; padding:6px 12px; font-weight:800; cursor:pointer">✓ Partito</button>'
    + '<button type="button" onclick="annullaInvioWhatsApp()" title="Non l\'ho mandato (aperto per sbaglio): tolgo il messaggio dalle comunicazioni e torna tutto com\'era" style="background:none; border:1.5px solid #6d3fa0; color:#6d3fa0; border-radius:999px; padding:6px 12px; font-weight:800; cursor:pointer">↩️ Annulla</button>'
    + '<a href="sms:+' + esc(ULTIMO_WA.num) + '?&body=' + encodeURIComponent(ULTIMO_WA.testo || '') + '" onclick="registraSmsUltimo()" title="Apre i messaggi del telefono con lo stesso testo (sul PC solo se è collegato al telefono)" style="background:#5b6b82; color:#fff; text-decoration:none; border-radius:999px; padding:6px 14px; font-weight:800">📱 Manda anche come SMS</a>';
  document.body.appendChild(d);
  const mio = ULTIMO_WA;
  setTimeout(function () { if (ULTIMO_WA === mio) { const b = document.getElementById('barra-no-wa'); if (b) b.remove(); } }, 5 * 60000);
}
// 📱 stesso messaggio mandato anche come SMS: resta nelle comunicazioni delle stesse persone
function registraSmsUltimo() {
  const u = ULTIMO_WA; if (!u) return;
  const persone = u.righe.length ? u.righe : [{ nome: u.nome }];
  u.sms = u.sms || [];
  persone.forEach(function (r) { registraComunicazione({ canale: 'sms', telefono: u.num, testo: u.testo, nome: r.nome || '', cf: r.codice_fiscale || '', nascita: r.data_nascita || '', motivo: r.motivo || '', praticaId: r.pratica_id || null, senzaContesto: true }); if (COMUNICAZIONI.lista[0] && COMUNICAZIONI.lista[0].canale === 'sms') u.sms.push(COMUNICAZIONI.lista[0]); });
  // la barra resta, con la possibilità di togliere l'SMS segnato per sbaglio
  setTimeout(function () {
    const b = document.getElementById('barra-no-wa'); if (!b) return;
    b.innerHTML = '<span>📱 SMS segnato tra le comunicazioni.</span>'
      + '<button type="button" onclick="annullaSmsUltimo()" style="background:none; border:1.5px solid #6d3fa0; color:#6d3fa0; border-radius:999px; padding:6px 12px; font-weight:800; cursor:pointer">↩️ Annulla SMS</button>'
      + '<button type="button" onclick="this.parentNode.remove()" style="background:#1a7f37; color:#fff; border:none; border-radius:999px; padding:6px 12px; font-weight:800; cursor:pointer">✓ Partito</button>';
  }, 300);
}
async function annullaSmsUltimo() {
  const u = ULTIMO_WA; const b = document.getElementById('barra-no-wa'); if (b) b.remove();
  if (!u || !u.sms) return;
  for (let i = 0; i < 15 && u.sms.some(function (r) { return !r.id; }); i++) await new Promise(function (ok) { setTimeout(ok, 200); });
  for (const r of u.sms) await togliComunicazione(r);
  u.sms = [];
  ridisegnaDopoInvio();
  avviso('↩️ SMS tolto dalle comunicazioni');
}
// Toglie le righe di un invio (messaggio non partito): comunicazioni, «avvisato» della campagna e della pratica pronta
async function annullaRigheInvio(u) {
  // le righe registrate prendono il numero dal server dopo un attimo
  for (let i = 0; i < 15 && u.righe.some(function (r) { return !r.id; }); i++) await new Promise(function (ok) { setTimeout(ok, 200); });
  const persone = [], richiamiTolti = [], righeTolte = [], pratiche = [];
  for (const r of u.righe) {
    if (await togliComunicazione(r)) righeTolte.push(r);
    (await annullaEffettiComunicazione(r)).forEach(function (x) { richiamiTolti.push(x); });
    // «avvisato su WhatsApp» della pratica pronta: si toglie
    if (r.pratica_id) {
      const p = (state.pratiche || []).find(function (x) { return x.id === r.pratica_id; });
      if (p && p.whatsappInviato === todayIT()) { p.whatsappInviato = null; pratiche.push(p.id); data.pratiche.aggiorna(p.id, { whatsappInviato: null }); }
    }
    persone.push({ nome: r.nome, cf: r.codice_fiscale, nascita: r.data_nascita, motivo: r.motivo, praticaId: r.pratica_id });
  }
  u.righe = [];
  return { persone: persone, richiamiTolti: richiamiTolti, righeTolte: righeTolte, pratiche: pratiche };
}
// Rimette quello che annullaRigheInvio ha tolto (annullato per sbaglio)
async function ripristinaRigheInvio(t) {
  for (const r of t.righeTolte || []) {
    const riga = Object.assign({}, r); delete riga.id;
    COMUNICAZIONI.lista.unshift(riga);
    try { const x = await fetchSupabase('/rest/v1/comunicazioni', 'POST', riga, { Prefer: 'return=representation' }); if (x && x.ok && Array.isArray(x.data) && x.data[0]) Object.assign(riga, x.data[0]); } catch (e) { /* resta solo qui */ }
  }
  for (const x of t.richiamiTolti || []) {
    const riga = Object.assign({}, x); delete riga.id;
    try { const r = await fetchSupabase('/rest/v1/richiami?on_conflict=anno,chiave', 'POST', riga, { Prefer: 'resolution=merge-duplicates,return=representation' }); if (r && r.ok && typeof RICHIAMI !== 'undefined') RICHIAMI.esiti[x.chiave] = (Array.isArray(r.data) && r.data[0]) || riga; } catch (e) { /* niente */ }
  }
  (t.pratiche || []).forEach(function (id) { const p = (state.pratiche || []).find(function (x) { return x.id === id; }); if (p) { p.whatsappInviato = todayIT(); data.pratiche.aggiorna(id, { whatsappInviato: todayIT() }); } });
  ridisegnaDopoInvio();
}
function ridisegnaDopoInvio() {
  if (typeof disegnaRichiami === 'function' && document.getElementById('ric-invio')) disegnaRichiami();
  if (typeof disegnaAuguri === 'function') disegnaAuguri();
  if (typeof disegnaSchedaPersona === 'function' && document.getElementById('popup-persona')) disegnaSchedaPersona();
  if (typeof render === 'function') render();
}
// ↩️ Annulla: il messaggio non è stato mandato (aperto per sbaglio); tutto torna com'era prima
async function annullaInvioWhatsApp() {
  const u = ULTIMO_WA; if (!u) return;
  ULTIMO_WA = null;
  const barra = document.getElementById('barra-no-wa'); if (barra) barra.remove();
  const t = await annullaRigheInvio(u);
  (u.sms || []).forEach(function (r) { togliComunicazione(r); });
  ridisegnaDopoInvio();
  avviso('↩️ Annullato: il messaggio' + (u.nome ? ' a ' + (typeof nomeGentile === 'function' ? nomeGentile(u.nome) : u.nome) : '') + ' non risulta inviato');
  return t;
}
async function nonHaWhatsApp() {
  const u = ULTIMO_WA; if (!u) return;
  const barra = document.getElementById('barra-no-wa'); if (barra) barra.remove();
  const t = await annullaRigheInvio(u);
  const persone = t.persone, richiamiTolti = t.richiamiTolti;
  // nella scheda dei clienti con questo cellulare: «senza WhatsApp»
  const clienti = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).filter(function (c) { return numeroWhatsApp(c.telefono) === u.num; });
  const segnati = [];
  for (const c of clienti) { if (!c.noWhatsapp) { c.noWhatsapp = true; segnati.push(c); if (c.id) data.clienti.aggiorna(c.id, { noWhatsapp: true }); } }
  ridisegnaDopoInvio();
  altriModiMessaggio({ num: u.num, testo: u.testo, persone: persone.length ? persone : [{ nome: u.nome || (clienti[0] && clienti[0].nomeCompleto) || '' }], richiamiTolti: richiamiTolti,
    email: (clienti.find(function (c) { return c.email; }) || {}).email || '', tolto: true,
    // ↩️ «Non ha WhatsApp» toccato per sbaglio: si rimette tutto com'era
    annulla: async function () {
      for (const c of segnati) { c.noWhatsapp = false; if (c.id) await data.clienti.aggiorna(c.id, { noWhatsapp: false }); }
      await ripristinaRigheInvio(t);
      avviso('↩️ Annullato: il numero resta con WhatsApp e il messaggio risulta inviato come prima');
    } });
}
// Altri modi per far arrivare il messaggio: e-mail (parte da sola), SMS, chiamata
function altriModiMessaggio(m, provaWhatsApp) {
  const vecchio = document.getElementById('popup-altri-modi'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-altri-modi';
  ov.style.cssText = 'position:fixed; inset:0; z-index:491; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:14px';
  const nomi = m.persone.map(function (p) { return p.nome; }).filter(Boolean);
  const tel = '+' + m.num, corpo = encodeURIComponent(m.testo || '');
  const b = function (attr, testo, col) { return '<' + (attr.indexOf('href=') === 0 ? 'a ' + attr : 'button type="button" ' + attr) + ' style="display:block; text-align:center; text-decoration:none; width:100%; margin-bottom:8px; background:' + col + '; color:#fff; border:none; border-radius:12px; padding:10px; font-weight:800; cursor:pointer; box-sizing:border-box">' + testo + (attr.indexOf('href=') === 0 ? '</a>' : '</button>'); };
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid #c0392b; padding:16px 18px; max-width:440px; width:100%; max-height:90vh; overflow:auto">'
    + '<div style="font-size:18px; font-weight:800; color:#c0392b">📵 ' + esc(tel.replace(/^\+39/, '')) + ' non ha WhatsApp</div>'
    + '<div style="font-size:13px; margin:6px 0 10px">' + (m.tolto ? 'Il messaggio non è arrivato: l\'ho tolto dalle comunicazioni' + (m.richiamiTolti && m.richiamiTolti.length ? ' e il cliente è tornato «da avvisare»' : '') + '. ' : '')
    + (nomi.length ? 'Nella scheda di <b>' + nomi.map(esc).join(', ') + '</b> ' + (m.tolto ? 'resta' : 'è') + ' segnato «📵 senza WhatsApp»' + (m.tolto ? ': le prossime volte i messaggi a tutti useranno l\'e-mail' : '') + '. ' : '') + 'Fallo arrivare in un altro modo:</div>'
    + (m.email ? b('data-az="email"', '📧 Manda per e-mail a ' + esc(m.email), '#1d4f91') : '')
    + b('href="sms:' + tel + '?&body=' + corpo + '" data-az="sms"', '📱 Manda un SMS (stesso testo)', '#5b6b82')
    + b('href="tel:' + tel + '" data-az="tel"', '📞 Chiama', '#1a7f37')
    + (provaWhatsApp ? b('data-az="wa"', '💬 Prova lo stesso con WhatsApp', '#25a35a') : '')
    + (m.annulla ? b('data-az="annulla"', '↩️ Annulla: ho toccato «Non ha WhatsApp» per sbaglio', '#6d3fa0') : '')
    + '<div style="font-size:11.5px; color:var(--sub); margin:2px 0 10px">L\'SMS si apre già scritto sul telefono; sul PC solo se è collegato al telefono (es. «Collegamento al telefono» di Windows).</div>'
    + '<div style="text-align:right"><button type="button" data-az="chiudi" style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:7px 16px; font-weight:700; cursor:pointer">' + (m.tolto ? 'Lascia così (resta da avvisare)' : 'Chiudi') + '</button></div></div>';
  // dopo l'invio con un altro modo: riga nelle comunicazioni per ogni cliente e di nuovo «avvisato» nella campagna
  const registra = async function (canale) {
    m.persone.forEach(function (p) { if (p.nome) registraComunicazione({ canale: canale, telefono: canale === 'sms' ? m.num : null, email: canale === 'email' ? m.email : null, testo: m.testo, nome: p.nome, cf: p.cf || '', nascita: p.nascita || '', motivo: p.motivo || motivoDaTesto(m.testo), praticaId: p.praticaId, senzaContesto: true }); });
    for (const x of m.richiamiTolti || []) {
      const riga = Object.assign({}, x); delete riga.id; riga.quando = new Date().toISOString();
      try { const r = await fetchSupabase('/rest/v1/richiami?on_conflict=anno,chiave', 'POST', riga, { Prefer: 'resolution=merge-duplicates,return=representation' }); if (r && r.ok && typeof RICHIAMI !== 'undefined') RICHIAMI.esiti[x.chiave] = (Array.isArray(r.data) && r.data[0]) || riga; } catch (e) { /* niente */ }
    }
    if (typeof disegnaRichiami === 'function' && document.getElementById('ric-invio')) disegnaRichiami();
    if (typeof disegnaAuguri === 'function') disegnaAuguri();
  };
  ov.addEventListener('click', async function (e) {
    const el = e.target.closest('[data-az]');
    if (!el && e.target !== ov) return;
    const az = el ? el.dataset.az : 'chiudi';
    if (az === 'sms') { registra('sms'); setTimeout(function () { ov.remove(); }, 300); return; }
    if (az === 'tel') { setTimeout(function () { ov.remove(); }, 300); return; }
    if (az === 'annulla') { ov.remove(); await m.annulla(); return; }
    if (az === 'wa') { ov.remove(); if (provaWhatsApp) provaWhatsApp(); return; }
    if (az === 'email') {
      el.disabled = true; el.textContent = '⏳ Invio…';
      try {
        await chiamaInviaEmail('POST', { a: m.email, oggetto: 'Messaggio dal CAF CISL di Alì Terme', testo: m.testo });
        await registra('email');
        avviso('📧 E-mail inviata a ' + m.email);
        ov.remove();
      } catch (x) { el.disabled = false; el.textContent = '📧 Riprova l\'e-mail'; avviso('❌ E-mail non partita: ' + x.message, true); }
      return;
    }
    ov.remove();
  });
  document.body.appendChild(ov);
}
