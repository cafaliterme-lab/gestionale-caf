/* ---------------- 📨 Sportello online: richieste dei clienti ----------------
   I clienti scrivono dalla pagina pubblica scrivici.html (senza password; possono solo mandare, non leggere).
   Qui le vedono l'amministratore e gli operatori con il permesso «📨 Richieste dai clienti» (Utenti e permessi).
   - riquadro in Oggi con le richieste nuove (e un avviso quando ne arriva una);
   - elenco con filtro per stato (nuova → in lavorazione → chiusa), risposta su WhatsApp o e-mail, appuntamento;
   - l'amministratore accende/spegne lo sportello (impostazioni.sportello_attivo) e stampa il cartello con il QR.
   Lo sportello parte SPENTO. */

let RICHIESTE = null, RICHIESTE_NUOVE_VISTE = null;
const STATI_RICHIESTA = { nuova: ['🆕 Nuova', '#c0392b'], lavorazione: ['🛠️ In lavorazione', '#d98b1e'], chiusa: ['✅ Chiusa', '#1a7f37'] };

function puoRichieste() { return !!(auth && auth.profilo && (auth.profilo.ruolo === 'admin' || (auth.profilo.tabs && auth.profilo.tabs.richieste === true))); }
// link corto: la pagina sta nella cartella scrivici/ (index.html), si apre con /scrivici e /scrivici/; scrivici.html porta lì
function indirizzoSportello() { return location.origin + '/scrivici'; }
// da scrivere su ricevute e messaggi (senza https://), solo se lo sportello è acceso
function linkSportelloDaScrivere() { return sportelloAttivo() ? indirizzoSportello().replace(/^https?:\/\//, '') : ''; }
function sportelloAttivo() { return typeof IMPOSTAZIONI !== 'undefined' && IMPOSTAZIONI.sportello_attivo === 'si'; }

async function caricaRichieste() {
  if (!puoRichieste()) return null;
  const r = await fetchSupabase('/rest/v1/richieste_clienti?select=*&order=creato_il.desc&limit=500');
  if (!r.ok || !Array.isArray(r.data)) return RICHIESTE;
  RICHIESTE = r.data;
  return RICHIESTE;
}
function richiesteNuove() { return (RICHIESTE || []).filter(function (x) { return x.stato === 'nuova'; }); }

// riquadro in Oggi
function tileRichieste(tile) {
  if (!puoRichieste() || (!sportelloAttivo() && !richiesteNuove().length)) return '';
  const n = richiesteNuove().length;
  return tile('📨', n, 'Richieste dai clienti', '#8e5bd6', 'apriRichieste()', n ? 'arrivate dallo sportello online, da gestire' : 'nessuna richiesta nuova');
}

// cliente già in archivio con lo stesso cellulare
function clienteDaRichiesta(x) {
  const num = typeof numeroWhatsApp === 'function' ? numeroWhatsApp(x.telefono) : '';
  if (!num) return null;
  return (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).find(function (c) { return numeroWhatsApp(c.telefono) === num; }) || null;
}

let FILTRO_RICHIESTE = 'aperte';
async function apriRichieste() {
  if (!puoRichieste()) { avviso('Non hai il permesso per le richieste dei clienti', true); return; }
  const vecchio = document.getElementById('popup-richieste'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-richieste';
  ov.style.cssText = 'position:fixed; inset:0; z-index:456; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:10px';
  ov.addEventListener('click', function (e) {
    if (e.target === ov || e.target.closest('[data-chiudi]')) { ov.remove(); return; }
    const f = e.target.closest('[data-filtro]'); if (f) { FILTRO_RICHIESTE = f.dataset.filtro; disegnaRichieste(); return; }
    const b = e.target.closest('[data-az]'); if (!b) return;
    const x = (RICHIESTE || []).find(function (r) { return r.id === b.dataset.id; }); if (!x) return;
    azioneRichiesta(b.dataset.az, x);
  });
  ov.addEventListener('change', function (e) {
    const s = e.target.closest('select[data-stato]'); if (!s) return;
    const x = (RICHIESTE || []).find(function (r) { return r.id === s.dataset.stato; }); if (x) cambiaStatoRichiesta(x, s.value);
  });
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:14px; border-top:6px solid #8e5bd6; max-width:820px; width:100%; max-height:92vh; overflow:auto; padding:14px 16px; box-shadow:0 10px 40px rgba(0,0,0,.3)"><div class="sub2">⏳ Carico le richieste…</div></div>';
  document.body.appendChild(ov);
  await caricaRichieste();
  disegnaRichieste();
}
function disegnaRichieste() {
  const ov = document.getElementById('popup-richieste'); if (!ov) return;
  const tutte = RICHIESTE || [];
  const lista = tutte.filter(function (x) { return FILTRO_RICHIESTE === 'tutte' ? true : FILTRO_RICHIESTE === 'aperte' ? x.stato !== 'chiusa' : x.stato === FILTRO_RICHIESTE; });
  const conta = function (f) { return tutte.filter(function (x) { return f === 'aperte' ? x.stato !== 'chiusa' : f === 'tutte' ? true : x.stato === f; }).length; };
  const chip = function (k, t) { const on = FILTRO_RICHIESTE === k; return '<button type="button" data-filtro="' + k + '" style="border:2px solid #8e5bd6; border-radius:999px; padding:4px 12px; font-size:12.5px; font-weight:700; cursor:pointer; background:' + (on ? '#8e5bd6' : 'transparent') + '; color:' + (on ? '#fff' : '#8e5bd6') + '">' + t + ' (' + conta(k) + ')</button>'; };
  const tasto = 'border:none; border-radius:999px; padding:5px 11px; font-size:12.5px; font-weight:700; cursor:pointer';
  ov.firstChild.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap"><b style="font-size:18px; color:#8e5bd6">📨 Richieste dai clienti</b>'
    + '<button type="button" data-chiudi style="' + tasto + '; background:var(--line); color:var(--ink)">✕</button></div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin:2px 0 8px">Arrivano dallo sportello online (' + esc(indirizzoSportello()) + ') · ' + (sportelloAttivo() ? '<b style="color:#1a7f37">sportello ACCESO</b>' : '<b style="color:#c0392b">sportello SPENTO</b>: non arrivano richieste nuove') + '</div>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px">' + chip('aperte', 'Da gestire') + chip('nuova', '🆕 Nuove') + chip('lavorazione', '🛠️ In lavorazione') + chip('chiusa', '✅ Chiuse') + chip('tutte', 'Tutte') + '</div>'
    + (lista.length ? lista.map(function (x) {
        const st = STATI_RICHIESTA[x.stato] || STATI_RICHIESTA.nuova, cli = clienteDaRichiesta(x);
        return '<div style="border:1px solid var(--line); border-left:5px solid ' + st[1] + '; border-radius:10px; padding:10px 12px; margin-bottom:8px">'
          + '<div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap"><span><b>' + esc(x.nome) + '</b>' + (cli ? ' <span style="font-size:11.5px; color:#1a7f37; font-weight:700">· già in archivio</span>' : '') + '<br><span style="font-size:12.5px; color:var(--sub)">📞 ' + esc(x.telefono) + (x.email ? ' · ✉️ ' + esc(x.email) : '') + '</span></span>'
          + '<span style="text-align:right; font-size:12px; color:var(--sub)">' + esc(quandoStorico(x.creato_il)) + '<br><b style="color:#8e5bd6">' + esc(x.tipo || '') + '</b></span></div>'
          + '<div style="white-space:pre-wrap; font-size:14px; margin:8px 0; padding:8px 10px; background:var(--bg); border-radius:8px">' + esc(x.messaggio) + '</div>'
          + (x.gestita_da ? '<div style="font-size:12px; color:var(--sub); margin-bottom:6px">Gestita da <b>' + esc(x.gestita_da) + '</b>' + (x.gestita_il ? ' il ' + esc(quandoStorico(x.gestita_il)) : '') + '</div>' : '')
          + '<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center">'
          + '<select data-stato="' + x.id + '" style="width:auto; padding:4px 8px; font-size:12.5px">' + Object.keys(STATI_RICHIESTA).map(function (k) { return '<option value="' + k + '"' + (k === x.stato ? ' selected' : '') + '>' + STATI_RICHIESTA[k][0] + '</option>'; }).join('') + '</select>'
          + '<button type="button" data-az="wa" data-id="' + x.id + '" style="' + tasto + '; background:#25d366; color:#fff">💬 Rispondi su WhatsApp</button>'
          + (x.email ? '<button type="button" data-az="email" data-id="' + x.id + '" style="' + tasto + '; background:#1d4f91; color:#fff">📧 Rispondi per e-mail</button>' : '')
          + '<button type="button" data-az="app" data-id="' + x.id + '" style="' + tasto + '; background:#2f9e9e; color:#fff">📅 Appuntamento</button>'
          + (auth.profilo && auth.profilo.ruolo === 'admin' && x.stato === 'chiusa' ? '<button type="button" data-az="elimina" data-id="' + x.id + '" title="Elimina definitivamente questa richiesta chiusa" style="' + tasto + '; background:var(--line); color:#c0392b">🗑️</button>' : '')
          + '</div></div>';
      }).join('') : '<div class="empty" style="padding:14px">Nessuna richiesta' + (FILTRO_RICHIESTE === 'aperte' ? ' da gestire' : '') + '.</div>');
}
async function cambiaStatoRichiesta(x, stato) {
  const campi = { stato: stato, gestita_da: (auth.profilo && auth.profilo.nome) || '', gestita_il: new Date().toISOString() };
  const r = await fetchSupabase('/rest/v1/richieste_clienti?id=eq.' + x.id, 'PATCH', campi, { Prefer: 'return=minimal' });
  if (!r.ok) { avviso('❌ Non salvato', true); return; }
  Object.assign(x, campi);
  disegnaRichieste();
  if (typeof render === 'function') render();
}
async function azioneRichiesta(az, x) {
  const nome = typeof nomeProprio === 'function' ? nomeProprio(x.nome) : x.nome;
  const testo = 'Buongiorno ' + nome + ', abbiamo ricevuto la sua richiesta al CAF CISL di Alì Terme (' + (x.tipo || 'informazioni') + ').\n\n';
  if (az === 'wa') {
    const num = numeroWhatsApp(x.telefono);
    if (!num) { avviso('Il numero non sembra un cellulare', true); return; }
    apriChatWhatsApp(num, testo);
    if (typeof registraComunicazione === 'function') registraComunicazione({ canale: 'whatsapp', telefono: num, testo: testo, nome: x.nome, motivo: 'Risposta sportello online', senzaContesto: true });
    if (x.stato === 'nuova') cambiaStatoRichiesta(x, 'lavorazione');
  } else if (az === 'email') {
    apriEmail({ a: x.email, oggetto: 'La sua richiesta al CAF CISL di Alì Terme', testo: testo, titolo: 'Risposta a ' + x.nome });
    if (x.stato === 'nuova') cambiaStatoRichiesta(x, 'lavorazione');
  } else if (az === 'app') {
    if (typeof nuovoAppuntamento === 'function') nuovoAppuntamento('', '', { nome: x.nome, telefono: x.telefono, note: 'Sportello online: ' + (x.tipo || '') });
    if (x.stato === 'nuova') cambiaStatoRichiesta(x, 'lavorazione');
  } else if (az === 'elimina') {
    if (!confirm('Eliminare definitivamente la richiesta di ' + x.nome + '?')) return;
    const r = await fetchSupabase('/rest/v1/richieste_clienti?id=eq.' + x.id, 'DELETE', null, { Prefer: 'return=minimal' });
    if (!r.ok) { avviso('❌ Non eliminata', true); return; }
    RICHIESTE = (RICHIESTE || []).filter(function (r2) { return r2.id !== x.id; });
    disegnaRichieste();
  }
}

// ---- Utenti e permessi (solo amministratore): interruttore e cartello con QR ----
function rigaSportelloHTML() {
  if (!(auth && auth.profilo && auth.profilo.ruolo === 'admin')) return '';
  const on = sportelloAttivo();
  return '<div class="card riga-sportello" style="margin-bottom:12px; border-left:5px solid #8e5bd6">'
    + '<div class="raff-title">📨 Sportello online per i clienti</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:8px">I clienti scrivono dalla pagina <b>' + esc(indirizzoSportello()) + '</b> (senza password: possono solo mandare la richiesta). Le richieste le vedi tu e gli operatori a cui dai il permesso «📨 Richieste dai clienti» qui sotto.</div>'
    + '<div style="font-size:15px; margin-bottom:8px">🔗 Link da dare ai clienti: <b style="color:#8e5bd6; user-select:all">' + esc(indirizzoSportello().replace(/^https?:\/\//, '')) + '</b> '
    + '<button type="button" onclick="copiaLinkSportello()" style="border:none; border-radius:999px; padding:4px 10px; font-weight:700; cursor:pointer; background:var(--line); color:var(--ink)">📋 Copia il link</button>'
    + '<div style="font-size:12px; color:var(--sub)">Con lo sportello acceso il link compare da solo sulle ricevute, sui promemoria degli appuntamenti e in fondo ai messaggi WhatsApp ed e-mail; spento, sparisce.</div></div>'
    + '<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center">'
    + '<button type="button" onclick="impostaSportello(' + (on ? 'false' : 'true') + ')" style="border:none; border-radius:999px; padding:8px 16px; font-weight:800; cursor:pointer; background:' + (on ? '#1a7f37' : '#c0392b') + '; color:#fff">' + (on ? '🟢 ACCESO · tocca per spegnere' : '🔴 SPENTO · tocca per accendere') + '</button>'
    + '<button type="button" onclick="apriRichieste()" style="border:none; border-radius:999px; padding:8px 14px; font-weight:700; cursor:pointer; background:#8e5bd6; color:#fff">📨 Vedi le richieste</button>'
    + '<button type="button" onclick="stampaCartelloSportello()" style="border:none; border-radius:999px; padding:8px 14px; font-weight:700; cursor:pointer; background:var(--line); color:var(--ink)">🖨️ Cartello con il QR</button>'
    + '<button type="button" onclick="window.open(indirizzoSportello(), \'_blank\')" style="border:none; border-radius:999px; padding:8px 14px; font-weight:700; cursor:pointer; background:var(--line); color:var(--ink)">👁️ Vedi la pagina</button>'
    + '</div></div>';
}
async function impostaSportello(acceso) {
  if (!(auth && auth.profilo && auth.profilo.ruolo === 'admin')) return;
  if (acceso && !confirm('Accendo lo sportello online? Da adesso chiunque abbia il link o il QR può mandarvi una richiesta.')) return;
  const valore = acceso ? 'si' : 'no';
  const { data: righe, error } = await supabase.from('impostazioni').upsert([{ chiave: 'sportello_attivo', valore: valore, aggiornato_il: new Date().toISOString() }], { onConflict: 'chiave' }).select('chiave');
  if (error || !righe || !righe.length) { avviso('❌ Non salvato' + (error ? ': ' + error.message : ''), true); return; }
  IMPOSTAZIONI.sportello_attivo = valore;
  avviso(acceso ? '🟢 Sportello online acceso: i clienti possono scrivervi' : '🔴 Sportello online spento: la pagina dice di chiamare in ufficio');
  document.querySelectorAll('.riga-sportello').forEach(function (el) { el.outerHTML = rigaSportelloHTML(); });
  if (typeof render === 'function') render();
}
function copiaLinkSportello() {
  const t = indirizzoSportello();
  const fatto = function () { avviso('📋 Link copiato: ' + t.replace(/^https?:\/\//, '') + ' (incollalo dove vuoi: WhatsApp, Facebook, biglietti da visita…)'); };
  try { navigator.clipboard.writeText(t).then(fatto, function () { prompt('Copia il link:', t); }); } catch (e) { prompt('Copia il link:', t); }
}
function stampaCartelloSportello() {
  const w = window.open('', '_blank');
  if (!w) { avviso('Il browser ha bloccato la finestra di stampa', true); return; }
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Scrivi al CAF</title><style>body{font-family:Arial,sans-serif; text-align:center; color:#0f1b2d; padding:30px} h1{color:#00612f; font-size:34px; margin:10px 0} p{font-size:20px} .qr svg{width:300px; height:300px} .url{color:#1d4f91; font-weight:bold; letter-spacing:.02em}</style></head><body>'
    + '<h1>📨 Scrivi al CAF CISL di Alì Terme</h1><p>Inquadra il codice con la fotocamera del telefono<br>e mandaci la tua richiesta: <b>ti ricontattiamo noi</b>.</p>'
    + '<div class="qr">' + qrSvg(indirizzoSportello()) + '</div>'
    + '<p style="margin:18px 0 4px">oppure scrivi questo indirizzo nel telefono o nel computer:</p>'
    + '<p class="url" style="font-size:30px; border:3px solid #00612f; border-radius:14px; display:inline-block; padding:10px 22px; margin:4px 0 14px">' + indirizzoSportello().replace(/^https?:\/\//, '') + '</p>'
    + '<p style="font-size:15px">730 · ISEE · colf e badanti · affitti · successioni · appuntamenti · informazioni</p></body></html>');
  w.document.close();
  setTimeout(function () { w.print(); }, 500);
}

// controllo ogni 2 minuti: nuove richieste → avviso e riquadro in Oggi aggiornato
setInterval(async function () {
  if (!puoRichieste() || document.hidden) return;
  const prima = RICHIESTE_NUOVE_VISTE;
  await caricaRichieste();
  const ora = richiesteNuove().length;
  if (prima !== null && ora > prima) avviso('📨 Nuova richiesta dallo sportello online: ' + (RICHIESTE[0] ? RICHIESTE[0].nome : '') + ' · aprila dalla pagina Oggi');
  if (RICHIESTE_NUOVE_VISTE !== ora) { RICHIESTE_NUOVE_VISTE = ora; if (typeof render === 'function' && document.getElementById('popup-richieste') == null) render(); }
}, 120000);
setTimeout(function () { if (puoRichieste()) caricaRichieste().then(function () { RICHIESTE_NUOVE_VISTE = richiesteNuove().length; if (typeof render === 'function') render(); }); }, 6000);
