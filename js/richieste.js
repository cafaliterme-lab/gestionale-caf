/* ---------------- 📨 Sportello online: richieste dei clienti ----------------
   I clienti scrivono dalla pagina pubblica scrivici.html (senza password; possono solo mandare, non leggere).
   Qui le vedono l'amministratore e gli operatori con il permesso «📨 Richieste dai clienti» (Utenti e permessi).
   - sezione «📨 RICHIESTE WEB» nel menu (con il numero delle nuove) e riquadro in Oggi che porta lì; avviso quando ne arriva una;
   - elenco con filtro per stato (nuova → in lavorazione → chiusa), risposta su WhatsApp o e-mail, appuntamento;
   - l'amministratore accende/spegne lo sportello (impostazioni.sportello_attivo) e stampa il cartello con il QR.
   Lo sportello parte SPENTO. */

let RICHIESTE = null, RICHIESTE_NUOVE_VISTE = null;
const STATI_RICHIESTA = { nuova: ['🆕 Nuova', '#c0392b'], lavorazione: ['🛠️ In lavorazione', '#d98b1e'], chiusa: ['✅ Chiusa', '#1a7f37'] };

function puoRichieste() { return !!(auth && auth.profilo && (auth.profilo.ruolo === 'admin' || (auth.profilo.tabs && auth.profilo.tabs.richieste === true))); }
// link corto: la pagina sta nella cartella scrivici/ (index.html), si apre con /scrivici e /scrivici/; scrivici.html porta lì
// l'indirizzo vero è sempre quello di Vercel (anche se il programma è aperto da un indirizzo vecchio, es. github.io)
function indirizzoSportello() { return (/(^|\.)vercel\.app$|^localhost$|^127\.0\.0\.1$/.test(location.hostname) ? location.origin : 'https://gestionale-caf.vercel.app') + '/scrivici'; }
// v1.6: il link «Scrivici online» va in TUTTI i messaggi ai clienti (WhatsApp ed e-mail), anche se il testo non ha
// il blocco dei recapiti; poi diventa personale. Non va nei messaggi che non sono per i clienti (testo indicato in TESTO_SENZA_LINK).
let TESTO_SENZA_LINK = null;
// v1.6.1: se manca, si aggiunge anche l'e-mail del CAF (es. il messaggio «pratica pronta» non l'aveva)
function conLinkSportello(testo, d) {
  if (!testo || !String(testo).trim()) return testo;
  const base = linkSportelloDaScrivere();
  const mail = typeof emailCaf === 'function' ? emailCaf() : '';
  let t = String(testo);
  const aggiunte = [];
  if (mail && t.toLowerCase().indexOf(mail.toLowerCase()) < 0) aggiunte.push('E-mail: ' + mail);
  if (base && t.indexOf(base) < 0) aggiunte.push('Scrivici online: ' + base);
  if (aggiunte.length) t = t.replace(/\s+$/, '') + '\n\n' + aggiunte.join('\n');
  return base ? personalizzaLinkSportello(t, d || {}) : t;
}
// link personale (v1.5): nei messaggi a UN cliente il link porta nome, cellulare ed e-mail, che la pagina scrivici scrive da sola.
// Cambia solo il link «nudo» (non già personalizzato); su ricevute, cartello e stampe il link resta senza dati.
function personalizzaLinkSportello(testo, d) {
  const base = linkSportelloDaScrivere(); if (!base || !testo || !d) return testo;
  // v1.7.2: spazi come %20 (non «+»): WhatsApp tagliava il link al «+» e arrivava solo il cognome
  const enc = function (v) { return encodeURIComponent(v).replace(/['()!*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); }); };
  const nome = String(d.nome || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  let tel = String(d.tel || '').replace(/\D/g, ''); if (/^(00)?39\d{9,10}$/.test(tel)) tel = tel.replace(/^(00)?39/, '');
  const email = String(d.email || '').trim().toLowerCase();
  const p = [];
  // prima il cellulare (solo cifre), poi e-mail e nome: se un programma taglia il link, il numero arriva comunque
  if (tel.length >= 9 && tel.length <= 15) p.push('t=' + tel);
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email)) p.push('e=' + enc(email));
  if (nome) p.push('n=' + enc(nome));
  if (!p.length) return testo;
  const re = new RegExp('(^|[^\\w/.:-])' + base.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&') + '(?![\\w/?#&=%.-])', 'g');
  return testo.replace(re, '$1https://' + base + '?' + p.join('&'));
}
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
  return tile('📨', n, 'Richieste dai clienti', '#8e5bd6', "oggiTab('richieste')", n ? 'arrivate dallo sportello online, da gestire' : 'nessuna richiesta nuova');
}

// cliente già in archivio con lo stesso cellulare
function clienteDaRichiesta(x) {
  const num = typeof numeroWhatsApp === 'function' ? numeroWhatsApp(x.telefono) : '';
  if (!num) return null;
  return (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).find(function (c) { return numeroWhatsApp(c.telefono) === num; }) || null;
}
// v1.7: chi conosciamo già da quel numero (archivio + pratiche, coniuge compreso) e, se scritto, la persona «per chi»;
// per ognuno data di nascita, codice fiscale e ultima pratica. Solo per l'ufficio: nella pagina dei clienti non va niente.
function personeDaRichiesta(x) {
  const cifre = function (s) { return typeof soloCifre === 'function' ? soloCifre(s) : String(s || '').replace(/\D/g, ''); };
  const n = cifre(x.telefono), visti = {}, out = [];
  const arch = typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : [];
  const prat = (typeof state !== 'undefined' && state.pratiche) || [];
  const metti = function (nome, nascita, cf) {
    nome = String(nome || '').trim().toUpperCase(); if (!nome) return;
    const k = cf || nome; if (visti[k]) return; visti[k] = true;
    const c = arch.find(function (a) { return (cf && a.codiceFiscale === cf) || a.nomeCompleto === nome; });
    out.push({ nome: nome, nascita: nascita || (c && c.dataNascita) || '', cf: cf || (c && c.codiceFiscale) || '' });
  };
  if (n) {
    arch.forEach(function (c) { if (cifre(c.telefono) === n || cifre(c.telefonoFisso) === n) metti(c.nomeCompleto, c.dataNascita, c.codiceFiscale); });
    prat.forEach(function (p) {
      if (cifre(p.telefono) === n) metti(p.nome, p.cf, p.codiceFiscale);
      if (p.congiunta && cifre(p.congTelefono || p.telefono) === n) metti(((p.congCognome || '') + ' ' + (p.congNome || '')).trim(), p.congData, p.congCodiceFiscale);
    });
  }
  // la persona scritta in «La richiesta è per…» (es. «IL CONIUGE: ROSSI ANNA»)
  const m = /:\s*(.+)$/.exec(String(x.per_chi || ''));
  if (m) { const nome = m[1].trim().toUpperCase(); const c = arch.find(function (a) { return a.nomeCompleto === nome || a.nomeCompleto === nome.split(' ').reverse().join(' '); }); if (c) metti(c.nomeCompleto, c.dataNascita, c.codiceFiscale); }
  out.forEach(function (o) {
    const sue = prat.filter(function (p) { return !p.annullata && ((o.cf && (p.codiceFiscale === o.cf || p.congCodiceFiscale === o.cf)) || p.nome === o.nome); })
      .sort(function (a, b) { return String(b.inseritoIl || '').localeCompare(String(a.inseritoIl || '')) || (b.numero || 0) - (a.numero || 0); });
    o.ultima = sue[0] || null; o.congiunta = !!(o.ultima && o.cf && o.ultima.congCodiceFiscale === o.cf && o.ultima.codiceFiscale !== o.cf);
  });
  return out;
}
function personeRichiestaHTML(x) {
  const l = personeDaRichiesta(x); if (!l.length) return '';
  return '<div style="font-size:12.5px; margin:0 0 8px; padding:6px 10px; border-radius:8px; border:1px dashed #8e5bd6">'
    + '<b style="color:#8e5bd6">📇 Dall\'archivio</b>' + l.map(function (o) {
      const u = o.ultima;
      return '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:3px 0"><span style="flex:1 1 300px"><b>' + esc(o.nome) + '</b>'
        + (o.nascita ? ' · nato/a il ' + esc(o.nascita) : '') + (o.cf ? ' · CF <span style="font-family:monospace">' + esc(o.cf) + '</span>' : '')
        + (u ? '<br><span style="color:var(--sub)">Ultima pratica: ' + esc(u.tipo || '') + ' n. ' + esc(typeof formattaProtocollo === 'function' ? formattaProtocollo(u) : String(u.numero || '')) + (u.data ? ' del ' + esc(u.data) : '') + ' · ' + esc(typeof statoLabel === 'function' ? statoLabel(u.stato) : u.stato || '') + (o.congiunta ? ' (come coniuge)' : '') + '</span>' : '<br><span style="color:var(--sub)">Nessuna pratica quest\'anno</span>') + '</span>'
        + (typeof apriSchedaPersonaNome === 'function' ? '<button type="button" data-az="scheda" data-nome="' + esc(o.nome) + '" data-cf="' + esc(o.cf) + '" style="border:none; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:700; cursor:pointer; background:#5e4fa2; color:#fff">👤 Apri la scheda</button>' : '') + '</div>';
    }).join('') + '</div>';
}

let FILTRO_RICHIESTE = 'aperte';
// tasti e cambi di stato dell'elenco (nella sezione del menu o nella finestra)
function collegaEventiRichieste(el, chiudi) {
  el.addEventListener('click', function (e) {
    if (chiudi && (e.target === el || e.target.closest('[data-chiudi]'))) { chiudi(); return; }
    const f = e.target.closest('[data-filtro]'); if (f) { FILTRO_RICHIESTE = f.dataset.filtro; disegnaRichieste(); return; }
    const b = e.target.closest('[data-az]'); if (!b) return;
    if (b.dataset.az === 'elimina-chiuse') { eliminaRichiesteChiuse(); return; }
    if (b.dataset.az === 'scheda') { if (typeof apriSchedaPersonaNome === 'function') apriSchedaPersonaNome(b.dataset.nome, b.dataset.cf); return; }
    const x = (RICHIESTE || []).find(function (r) { return r.id === b.dataset.id; }); if (!x) return;
    azioneRichiesta(b.dataset.az, x);
  });
  el.addEventListener('change', function (e) {
    const s = e.target.closest('select[data-stato]'); if (!s) return;
    const x = (RICHIESTE || []).find(function (r) { return r.id === s.dataset.stato; }); if (x) cambiaStatoRichiesta(x, s.value);
  });
}
// sezione «📨 RICHIESTE WEB» del menu
async function renderRichiesteTab() {
  const sec = document.getElementById('tab-richieste'); if (!sec) return;
  if (!puoRichieste()) { sec.innerHTML = '<div class="card"><div class="empty">Non hai il permesso per le richieste dei clienti.</div></div>'; return; }
  if (!document.getElementById('richieste-box')) {
    sec.innerHTML = '<div class="card" id="richieste-box" style="border-top:6px solid #8e5bd6"><div class="sub2">⏳ Carico le richieste…</div></div>';
    collegaEventiRichieste(document.getElementById('richieste-box'), null);
  }
  await caricaRichieste();
  disegnaRichieste();
}
// numero delle richieste nuove sul tasto del menu
function aggiornaPallinoRichieste() {
  const b = document.getElementById('nav-richieste'); if (!b) return;
  const n = richiesteNuove().length;
  b.innerHTML = 'RICHIESTE WEB' + (n ? ' <span class="nav-pallino">' + n + '</span>' : '');
}
async function apriRichieste() {
  if (!puoRichieste()) { avviso('Non hai il permesso per le richieste dei clienti', true); return; }
  // c'è la sezione nel menu: si va lì
  if (typeof oggiTab === 'function' && document.getElementById('tab-richieste') && oggiTab('richieste')) return;
  const vecchio = document.getElementById('popup-richieste'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-richieste';
  ov.style.cssText = 'position:fixed; inset:0; z-index:456; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:10px';
  collegaEventiRichieste(ov, function () { ov.remove(); });
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:14px; border-top:6px solid #8e5bd6; max-width:820px; width:100%; max-height:92vh; overflow:auto; padding:14px 16px; box-shadow:0 10px 40px rgba(0,0,0,.3)"><div class="sub2">⏳ Carico le richieste…</div></div>';
  document.body.appendChild(ov);
  await caricaRichieste();
  disegnaRichieste();
}
function disegnaRichieste() {
  aggiornaPallinoRichieste();
  const pop = document.getElementById('popup-richieste'), box = document.getElementById('richieste-box');
  const dove = pop ? pop.firstChild : box; if (!dove) return;
  const tutte = RICHIESTE || [];
  const lista = tutte.filter(function (x) { return FILTRO_RICHIESTE === 'tutte' ? true : FILTRO_RICHIESTE === 'aperte' ? x.stato !== 'chiusa' : x.stato === FILTRO_RICHIESTE; });
  const conta = function (f) { return tutte.filter(function (x) { return f === 'aperte' ? x.stato !== 'chiusa' : f === 'tutte' ? true : x.stato === f; }).length; };
  const chip = function (k, t) { const on = FILTRO_RICHIESTE === k; return '<button type="button" data-filtro="' + k + '" style="border:2px solid #8e5bd6; border-radius:999px; padding:4px 12px; font-size:12.5px; font-weight:700; cursor:pointer; background:' + (on ? '#8e5bd6' : 'transparent') + '; color:' + (on ? '#fff' : '#8e5bd6') + '">' + t + ' (' + conta(k) + ')</button>'; };
  const tasto = 'border:none; border-radius:999px; padding:5px 11px; font-size:12.5px; font-weight:700; cursor:pointer';
  dove.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap"><b style="font-size:18px; color:#8e5bd6">📨 Richieste dai clienti (sportello web)</b>'
    + (pop ? '<button type="button" data-chiudi style="' + tasto + '; background:var(--line); color:var(--ink)">✕</button>' : '<button type="button" onclick="renderRichiesteTab()" style="' + tasto + '; background:var(--line); color:var(--ink)">🔄 Aggiorna</button>') + '</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin:2px 0 8px">Arrivano dallo sportello online (' + esc(indirizzoSportello()) + ') · ' + (sportelloAttivo() ? '<b style="color:#1a7f37">sportello ACCESO</b>' : '<b style="color:#c0392b">sportello SPENTO</b>: non arrivano richieste nuove') + '</div>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px">' + chip('aperte', 'Da gestire') + chip('nuova', '🆕 Nuove') + chip('lavorazione', '🛠️ In lavorazione') + chip('chiusa', '✅ Chiuse') + chip('tutte', 'Tutte') + '</div>'
    + (eAdminRichieste() && FILTRO_RICHIESTE === 'chiusa' && conta('chiusa') ? '<div style="margin-bottom:8px"><button type="button" data-az="elimina-chiuse" style="' + tasto + '; background:#c0392b; color:#fff">🗑️ Elimina tutte le chiuse (' + conta('chiusa') + ')</button> <span style="font-size:12px; color:var(--sub)">solo l\'amministratore · quelle non chiuse restano</span></div>' : '')
    + (lista.length ? lista.map(function (x) {
        const st = STATI_RICHIESTA[x.stato] || STATI_RICHIESTA.nuova, cli = clienteDaRichiesta(x);
        return '<div style="border:1px solid var(--line); border-left:5px solid ' + st[1] + '; border-radius:10px; padding:10px 12px; margin-bottom:8px">'
          + '<div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap"><span><b>' + esc(x.nome) + '</b>' + (cli ? ' <span style="font-size:11.5px; color:#1a7f37; font-weight:700">· già in archivio</span>' : '') + '<br><span style="font-size:12.5px; color:var(--sub)">📞 ' + esc(x.telefono) + (x.email ? ' · ✉️ ' + esc(x.email) : '') + '</span></span>'
          + '<span style="text-align:right; font-size:12px; color:var(--sub)">' + esc(quandoStorico(x.creato_il)) + '<br><b style="color:#8e5bd6">' + esc(x.tipo || '') + '</b></span></div>'
          + (x.per_chi ? '<div style="margin-top:6px; font-size:13px">👥 <b>La richiesta è per: ' + esc(x.per_chi) + '</b></div>' : '')
          + '<div style="white-space:pre-wrap; font-size:14px; margin:8px 0; padding:8px 10px; background:var(--bg); border-radius:8px">' + esc(x.messaggio) + '</div>'
          + personeRichiestaHTML(x)
          + (x.gestita_da ? '<div style="font-size:12px; color:var(--sub); margin-bottom:6px">Gestita da <b>' + esc(x.gestita_da) + '</b>' + (x.gestita_il ? ' il ' + esc(quandoStorico(x.gestita_il)) : '') + '</div>' : '')
          + '<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center">'
          + '<select data-stato="' + x.id + '" style="width:auto; padding:4px 8px; font-size:12.5px">' + Object.keys(STATI_RICHIESTA).map(function (k) { return '<option value="' + k + '"' + (k === x.stato ? ' selected' : '') + '>' + STATI_RICHIESTA[k][0] + '</option>'; }).join('') + '</select>'
          + '<button type="button" data-az="wa" data-id="' + x.id + '" style="' + tasto + '; background:#25d366; color:#fff">💬 Rispondi su WhatsApp</button>'
          + (x.email ? '<button type="button" data-az="email" data-id="' + x.id + '" style="' + tasto + '; background:#1d4f91; color:#fff">📧 Rispondi per e-mail</button>' : '')
          + '<button type="button" data-az="app" data-id="' + x.id + '" style="' + tasto + '; background:#2f9e9e; color:#fff">📅 Appuntamento</button>'
          + (eAdminRichieste() && x.stato === 'chiusa' ? '<button type="button" data-az="elimina" data-id="' + x.id + '" title="Elimina definitivamente questa richiesta chiusa" style="' + tasto + '; background:#c0392b; color:#fff">🗑️ Elimina</button>' : '')
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
  // alla prima risposta si conferma la richiesta; nelle successive solo il saluto (la conversazione è già avviata)
  const testo = x.stato === 'nuova' ? 'Buongiorno ' + nome + ', abbiamo ricevuto la sua richiesta al CAF CISL di Alì Terme (' + (x.tipo || 'informazioni') + ').\n\n' : 'Buongiorno ' + nome + ', ';
  // v1.7.4: e-mail del CAF e link «Scrivici online» in fondo solo alla PRIMA risposta (richiesta ancora «Nuova»); nelle successive no
  const prima = x.stato === 'nuova';
  if (az === 'wa') {
    const num = numeroWhatsApp(x.telefono);
    if (!num) { avviso('Il numero non sembra un cellulare', true); return; }
    if (!prima && typeof TESTO_SENZA_LINK !== 'undefined') TESTO_SENZA_LINK = testo;
    apriChatWhatsApp(num, testo);
    if (typeof registraComunicazione === 'function') registraComunicazione({ canale: 'whatsapp', telefono: num, testo: testo, nome: x.nome, motivo: 'Risposta sportello online', senzaContesto: true });
    if (x.stato === 'nuova') cambiaStatoRichiesta(x, 'lavorazione');
  } else if (az === 'email') {
    apriEmail({ a: x.email, oggetto: 'La sua richiesta al CAF CISL di Alì Terme', testo: testo, titolo: 'Risposta a ' + x.nome, senzaLink: !prima });
    if (x.stato === 'nuova') cambiaStatoRichiesta(x, 'lavorazione');
  } else if (az === 'app') {
    if (typeof nuovoAppuntamento === 'function') nuovoAppuntamento('', '', { nome: x.nome, telefono: x.telefono, note: 'Sportello online: ' + (x.tipo || '') });
    if (x.stato === 'nuova') cambiaStatoRichiesta(x, 'lavorazione');
  } else if (az === 'elimina') {
    if (!eAdminRichieste() || x.stato !== 'chiusa') { avviso('Si possono eliminare solo le richieste chiuse', true); return; }
    if (!confirm('Eliminare definitivamente la richiesta di ' + x.nome + '?')) return;
    const r = await fetchSupabase('/rest/v1/richieste_clienti?id=eq.' + x.id + '&stato=eq.chiusa', 'DELETE', null, { Prefer: 'return=minimal' });
    if (!r.ok) { avviso('❌ Non eliminata', true); return; }
    RICHIESTE = (RICHIESTE || []).filter(function (r2) { return r2.id !== x.id; });
    disegnaRichieste();
  }
}
function eAdminRichieste() { return !!(auth.profilo && auth.profilo.ruolo === 'admin'); }
// svuota l'archivio delle richieste chiuse (solo amministratore; le non chiuse restano)
async function eliminaRichiesteChiuse() {
  if (!eAdminRichieste()) return;
  const chiuse = (RICHIESTE || []).filter(function (r) { return r.stato === 'chiusa'; });
  if (!chiuse.length) { avviso('Nessuna richiesta chiusa da eliminare'); return; }
  if (!confirm('Eliminare definitivamente ' + (chiuse.length === 1 ? 'la richiesta chiusa' : 'tutte le ' + chiuse.length + ' richieste chiuse') + '?\n\nLe richieste nuove e in lavorazione restano.')) return;
  const r = await fetchSupabase('/rest/v1/richieste_clienti?stato=eq.chiusa', 'DELETE', null, { Prefer: 'return=minimal' });
  if (!r.ok) { avviso('❌ Non eliminate', true); return; }
  RICHIESTE = (RICHIESTE || []).filter(function (r2) { return r2.stato !== 'chiusa'; });
  avviso('✓ Eliminate ' + chiuse.length + (chiuse.length === 1 ? ' richiesta chiusa' : ' richieste chiuse'));
  disegnaRichieste();
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
  aggiornaPallinoRichieste();
  if (document.getElementById('richieste-box') && document.getElementById('tab-richieste').classList.contains('active')) disegnaRichieste();
  if (RICHIESTE_NUOVE_VISTE !== ora) { RICHIESTE_NUOVE_VISTE = ora; if (typeof render === 'function' && document.getElementById('popup-richieste') == null) render(); }
}, 120000);
setTimeout(function () { if (puoRichieste()) caricaRichieste().then(function () { RICHIESTE_NUOVE_VISTE = richiesteNuove().length; aggiornaPallinoRichieste(); if (typeof render === 'function') render(); }); }, 6000);
