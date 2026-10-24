/* ---------------- 🎄 Auguri di Natale e fine anno, 🐣 auguri di Pasqua ----------------
   A tutti i clienti dell'archivio con cellulare o e-mail (non i deceduti, non chi non vuole messaggi):
   si scelgono i collaboratori e il modo (WhatsApp, e-mail o tutti e due), si controlla l'elenco e il testo,
   poi le e-mail partono da sole e i WhatsApp si aprono uno dopo l'altro. Chi ha lo stesso cellulare o la
   stessa e-mail riceve un solo messaggio. Ogni invio resta nelle comunicazioni del cliente (motivo «Auguri
   di Natale 2026»…): così si sa a chi sono già arrivati e nessuno li riceve due volte nello stesso anno. */

const AUGURI = { festa: null, anno: null, esclusi: {}, testo: {}, coda: [], pos: 0 };
const SENZA_COLLAB_AUGURI = '— senza collaboratore —';

// Domenica di Pasqua dell'anno (calendario gregoriano)
function dataPasqua(anno) {
  const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31), giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anno, mese - 1, giorno);
}
// Festa del momento (per la casella in «Oggi»): Natale dal 10 al 31 dicembre, Pasqua dai 12 giorni prima al lunedì dell'Angelo
function festaAuguriDiOggi(oggi) {
  oggi = oggi || new Date();
  const g = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
  if (g.getMonth() === 11 && g.getDate() >= 10) return { festa: 'natale', anno: g.getFullYear() };
  const p = dataPasqua(g.getFullYear()), giorni = Math.round((p - g) / 86400000);
  if (giorni <= 12 && giorni >= -1) return { festa: 'pasqua', anno: g.getFullYear() };
  return null;
}
// Aprendo a mano fuori dai giorni: la prossima festa
function prossimaFestaAuguri() {
  const oggi = new Date(), f = festaAuguriDiOggi(oggi);
  if (f) return f;
  if (oggi.getMonth() === 0 && oggi.getDate() <= 6) return { festa: 'natale', anno: oggi.getFullYear() - 1 };
  return oggi < dataPasqua(oggi.getFullYear()) ? { festa: 'pasqua', anno: oggi.getFullYear() } : { festa: 'natale', anno: oggi.getFullYear() };
}
function titoloFesta(f) { return f === 'pasqua' ? '🐣 Auguri di Pasqua' : '🎄 Auguri di Natale e fine anno'; }
function motivoAuguri() { return (AUGURI.festa === 'pasqua' ? 'Auguri di Pasqua ' : 'Auguri di Natale ') + AUGURI.anno; }
function oggettoAuguri() { return (AUGURI.festa === 'pasqua' ? 'Buona Pasqua' : 'Buon Natale e felice anno nuovo') + ' dal CAF CISL di Alì Terme'; }
function testoBaseAuguri(f) {
  return f === 'pasqua' ? 'il CAF CISL di Alì Terme augura a lei e ai suoi cari una serena Pasqua. Grazie per la fiducia!'
    : 'il CAF CISL di Alì Terme augura a lei e ai suoi cari un sereno Natale e un felice anno nuovo. Grazie per la fiducia!';
}
function testoAuguri() { return AUGURI.testo[AUGURI.festa] || testoBaseAuguri(AUGURI.festa); }
function canaleAuguri() { try { return localStorage.getItem('auguri-canale') || 'entrambi'; } catch (e) { return 'entrambi'; } }

function collabAuguri(c) { return c.collaboratore || SENZA_COLLAB_AUGURI; }
function auguriGiaMandati(c) {
  if (typeof comunicazioniPersona !== 'function') return false;
  const m = motivoAuguri();
  return comunicazioniPersona(c.nomeCompleto, c.codiceFiscale).some(function (x) { return x.motivo === m; });
}
// Tutti i clienti a cui si possono mandare gli auguri
function clientiAuguri() {
  return (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).filter(function (c) { return c.nomeCompleto && !c.decedutoIl && !c.noMessaggi; });
}
// Destinatari: i clienti con lo stesso cellulare (o la stessa e-mail) sono un solo messaggio
function destinatariAuguri() {
  const can = canaleAuguri();
  const l = clientiAuguri().filter(function (c) { return !AUGURI.esclusi[collabAuguri(c)] && !auguriGiaMandati(c); });
  const gruppi = function (lista, chiave) {
    const g = {}, ordine = [];
    lista.forEach(function (c) {
      const k = chiave(c);
      if (!g[k]) { g[k] = { chiave: k, tel: c.telefono, email: c.email, persone: [] }; ordine.push(g[k]); }
      g[k].persone.push(c);
    });
    ordine.forEach(function (x) {
      const cl = x.persone[0].collaboratore || '';
      const sede = typeof collaboratorePredefinito === 'function' ? collaboratorePredefinito() : '';
      x.collab = x.persone.length > 1 && cl && cl !== sede && x.persone.every(function (c) { return c.collaboratore === cl; }) ? cl : '';
    });
    return ordine;
  };
  return {
    wa: gruppi(can === 'email' ? [] : l.filter(function (c) { return haWhatsApp(c.telefono); }), function (c) { return numeroWhatsApp(c.telefono); }),
    email: gruppi(can === 'wa' ? [] : l.filter(function (c) { return c.email && (can === 'email' || !haWhatsApp(c.telefono)); }), function (c) { return String(c.email).trim().toLowerCase(); }),
  };
}
// Saluto: il cliente, i familiari con lo stesso numero, o il collaboratore (anche per i suoi clienti)
function messaggioAuguri(g) {
  let saluto;
  if (g.collab) saluto = 'Gentile ' + nomeGentile(String(g.collab).replace(/^730\s+/i, '')) + ',';
  else if (g.persone.length > 1) saluto = 'Gentili ' + g.persone.map(function (c) { return nomeGentile(c.nomeCompleto); }).join(', ').replace(/, ([^,]*)$/, ' e $1') + ',';
  else saluto = 'Gentile ' + nomeGentile(g.persone[0].nomeCompleto) + ',';
  // più familiari sullo stesso numero: «a voi e ai vostri cari»
  const corpo = g.persone.length > 1 && !g.collab ? testoAuguri().replace(/a lei e ai suoi cari/g, 'a voi e ai vostri cari') : testoAuguri();
  return saluto + ' ' + corpo + (g.collab ? ' Gli auguri sono anche per i suoi clienti.' : '')
    + (typeof righeContattiCaf === 'function' ? '\n\n' + righeContattiCaf() : '');
}
function registraAuguri(g, canale, testo, primoGiaRegistrato) {
  g.persone.forEach(function (c, i) {
    if (primoGiaRegistrato && i === 0) return;
    registraComunicazione({ canale: canale, telefono: canale === 'whatsapp' ? c.telefono : null, email: canale === 'email' ? c.email : null, testo: testo, nome: c.nomeCompleto, cf: c.codiceFiscale || '', motivo: motivoAuguri(), senzaContesto: true });
  });
}

function apriAuguri(festa, anno) {
  const f = festa ? { festa: festa, anno: anno || new Date().getFullYear() } : prossimaFestaAuguri();
  AUGURI.festa = f.festa; AUGURI.anno = f.anno; AUGURI.coda = []; AUGURI.pos = 0;
  const vecchio = document.getElementById('popup-auguri'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-auguri';
  ov.style.cssText = 'position:fixed; inset:0; z-index:456; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:10px';
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-chiudi]')) { AUGURI.coda = []; ov.remove(); } });
  document.body.appendChild(ov);
  disegnaAuguri();
}
function scegliFestaAuguri(f) {
  const oggi = new Date();
  AUGURI.festa = f;
  AUGURI.anno = f === 'natale' && oggi.getMonth() === 0 && oggi.getDate() <= 6 ? oggi.getFullYear() - 1 : (f === 'pasqua' && oggi > dataPasqua(oggi.getFullYear()) ? oggi.getFullYear() + 1 : oggi.getFullYear());
  AUGURI.coda = []; disegnaAuguri();
}
function scegliCollabAuguri(k) {
  if (k === '*tutti') AUGURI.esclusi = {};
  else if (k === '*nessuno') { AUGURI.esclusi = {}; clientiAuguri().forEach(function (c) { AUGURI.esclusi[collabAuguri(c)] = true; }); }
  else if (AUGURI.esclusi[k]) delete AUGURI.esclusi[k]; else AUGURI.esclusi[k] = true;
  disegnaAuguri();
}
function scegliCanaleAuguri(c) { try { localStorage.setItem('auguri-canale', c); } catch (e) {} disegnaAuguri(); }
function cambiaTestoAuguri(t) {
  AUGURI.testo[AUGURI.festa] = String(t || '').trim() || testoBaseAuguri(AUGURI.festa);
  document.querySelectorAll('#popup-auguri [data-esempio]').forEach(function (el) {
    const d = destinatariAuguri(), g = (el.dataset.esempio === 'wa' ? d.wa : d.email)[0];
    if (g) el.textContent = messaggioAuguri(g);
  });
}

function disegnaAuguri() {
  const ov = document.getElementById('popup-auguri'); if (!ov) return;
  const tutti = clientiAuguri(), d = destinatariAuguri(), can = canaleAuguri();
  const gia = tutti.filter(auguriGiaMandati).length;
  const senzaRecapito = tutti.filter(function (c) { return !haWhatsApp(c.telefono) && !c.email; }).length;
  const noMsg = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).filter(function (c) { return c.noMessaggi && !c.decedutoIl; }).length;
  const chip = function (onclick, testo, on, col) { return '<button type="button" onclick="' + onclick + '" style="padding:4px 11px; border-radius:999px; font-size:12px; font-weight:700; cursor:pointer; border:2px ' + (on ? 'solid' : 'dashed') + ' ' + col + '; background:' + (on ? col : 'transparent') + '; color:' + (on ? '#fff' : col) + '">' + testo + '</button>'; };
  // collaboratori, con quanti clienti hanno
  const perCollab = {};
  tutti.forEach(function (c) { const k = collabAuguri(c); perCollab[k] = (perCollab[k] || 0) + 1; });
  const collab = Object.keys(perCollab).sort(function (a, b) { return a === SENZA_COLLAB_AUGURI ? 1 : b === SENZA_COLLAB_AUGURI ? -1 : a.localeCompare(b); });
  const riga = function (g, canale, recapito) {
    const testa = g.persone.length > 1
      ? '<b>👥 ' + esc(g.collab || g.persone.map(function (c) { return c.nomeCompleto; }).join(' e ')) + '</b> <span class="sub2">(' + g.persone.length + ' clienti, un solo messaggio)</span>' + (g.collab ? '<div style="font-size:12px; color:var(--sub)">' + g.persone.map(function (c) { return esc(c.nomeCompleto); }).join(' · ') + '</div>' : '')
      : '<b>' + esc(g.persone[0].nomeCompleto) + '</b>' + (g.persone[0].collaboratore ? ' <span class="sub2">· ' + esc(g.persone[0].collaboratore) + '</span>' : '');
    return '<label style="display:flex; gap:8px; align-items:center; padding:5px 0; border-bottom:1px solid var(--line); font-size:13.5px; cursor:pointer"><input type="checkbox" checked data-canale="' + canale + '" value="' + esc(g.chiave) + '" onchange="contaAuguri()" style="width:18px; height:18px">'
      + '<span style="flex:1; color:var(--ink)">' + testa + '</span><span class="sub2">' + esc(recapito) + '</span></label>';
  };
  const gruppo = function (titolo, colore, canale, lista, recapito) {
    if (!lista.length) return '';
    return '<div style="display:flex; justify-content:space-between; align-items:center; margin:12px 0 4px"><b style="font-size:15px; color:' + colore + '">' + titolo + ' (<span data-n="' + canale + '">' + lista.length + '</span>)</b>'
      + '<span style="font-size:12px"><a href="#" onclick="spuntaAuguri(\'' + canale + '\', true); return false">tutti</a> · <a href="#" onclick="spuntaAuguri(\'' + canale + '\', false); return false">nessuno</a></span></div>'
      + lista.map(function (g) { return riga(g, canale, recapito(g)); }).join('');
  };
  const esempio = function (titolo, colore, lista, chiave, oggetto) {
    if (!lista.length) return '';
    return '<div style="margin-top:10px; border:1.5px solid ' + colore + '; border-radius:10px; overflow:hidden"><div style="padding:6px 10px; background:' + colore + '; color:#fff; font-weight:800; font-size:13.5px">' + titolo + '</div>'
      + (oggetto ? '<div style="padding:6px 10px; font-size:13px; border-bottom:1px solid var(--line)"><b>Oggetto:</b> ' + esc(oggetto) + '</div>' : '')
      + '<div data-esempio="' + chiave + '" style="white-space:pre-wrap; font-size:13px; padding:8px 10px">' + esc(messaggioAuguri(lista[0])) + '</div></div>';
  };
  const inCoda = AUGURI.coda.length && AUGURI.pos < AUGURI.coda.length;
  const nW = d.wa.length, nM = d.email.length;
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:14px; border-top:6px solid ' + (AUGURI.festa === 'pasqua' ? '#b35f0c' : '#c0392b') + '; max-width:680px; width:100%; max-height:92vh; display:flex; flex-direction:column; box-shadow:0 10px 40px rgba(0,0,0,.3)">'
    + '<div style="padding:12px 16px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; gap:8px"><b style="font-size:18px">' + titoloFesta(AUGURI.festa) + ' ' + AUGURI.anno + '</b><button type="button" data-chiudi style="border:none; background:none; font-size:22px; cursor:pointer; color:var(--ink)">✕</button></div>'
    + '<div style="padding:6px 16px 12px; overflow:auto">'
    + '<div style="display:flex; gap:5px; flex-wrap:wrap; margin:6px 0">' + chip("scegliFestaAuguri('natale')", '🎄 Natale e fine anno', AUGURI.festa === 'natale', '#c0392b') + chip("scegliFestaAuguri('pasqua')", '🐣 Pasqua', AUGURI.festa === 'pasqua', '#b35f0c') + '</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:6px">' + tutti.length + ' clienti in archivio · <b style="color:#1a7f37">' + gia + ' hanno già ricevuto questi auguri</b> · ' + senzaRecapito + ' senza cellulare né e-mail' + (noMsg ? ' · 🚫 ' + noMsg + ' non vogliono messaggi' : '') + '</div>'
    + '<div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center; margin-bottom:6px; font-size:12.5px"><b style="color:var(--sub)">🤝 Collaboratori:</b>'
    + collab.map(function (k) { const on = !AUGURI.esclusi[k]; return chip('scegliCollabAuguri(this.dataset.k)', (on ? '✓ ' : '✕ ') + esc(k) + ' ' + perCollab[k], on, '#1a7f37').replace('<button ', '<button data-k="' + esc(k) + '" '); }).join('')
    + chip("scegliCollabAuguri('*tutti')", '✓ Tutti', false, '#374151') + chip("scegliCollabAuguri('*nessuno')", '✕ Nessuno', false, '#374151') + '</div>'
    + '<div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center; font-size:12.5px"><b style="color:var(--sub)">📤 Manda con:</b>'
    + chip("scegliCanaleAuguri('wa')", '💬 Solo WhatsApp', can === 'wa', '#25a35a') + chip("scegliCanaleAuguri('email')", '📧 Solo e-mail', can === 'email', '#25a35a') + chip("scegliCanaleAuguri('entrambi')", '💬 + 📧 Tutti e due', can === 'entrambi', '#25a35a') + '</div>'
    + '<div style="margin-top:10px"><b style="font-size:14px">✏️ Testo degli auguri</b> <span class="sub2">(prima c\'è «Gentile …» con il nome, dopo i recapiti del CAF)</span>'
    + '<textarea rows="3" oninput="cambiaTestoAuguri(this.value)" style="width:100%; margin-top:4px; font-size:13.5px; font-family:inherit">' + esc(testoAuguri()) + '</textarea></div>'
    + (inCoda ? '' : (nW || nM ? gruppo('📧 E-mail (partono tutte insieme dalla casella del CAF)', '#1d4f91', 'email', d.email, function (g) { return g.email; })
        + gruppo('💬 WhatsApp (uno dopo l\'altro)', '#1a7f37', 'wa', d.wa, function (g) { return g.tel; })
        + '<div style="margin-top:12px; font-weight:800; font-size:15px">👁️ Ecco cosa riceveranno</div>'
        + esempio('📧 L\'e-mail', '#1d4f91', d.email, 'email', oggettoAuguri()) + esempio('💬 Il messaggio WhatsApp', '#1a7f37', d.wa, 'wa')
      : '<div class="empty" style="padding:14px">Nessuno a cui mandare gli auguri con le scelte fatte' + (gia ? ' (chi li ha già ricevuti non compare più)' : '') + '.</div>'))
    + '</div><div style="padding:10px 16px; border-top:1px solid var(--line); display:flex; gap:8px; justify-content:flex-end; align-items:center; flex-wrap:wrap">'
    + (inCoda
      ? '<span class="sub2">premi Invia su WhatsApp, poi torna qui e tocca Prossimo</span><button type="button" onclick="prossimoAuguri()" style="background:#25a35a; color:#fff; border:none; border-radius:999px; padding:8px 18px; font-weight:800; cursor:pointer">💬 Prossimo WhatsApp (' + (AUGURI.pos + 1) + ' di ' + AUGURI.coda.length + ')</button>'
      : '<button type="button" data-chiudi style="border:1.5px solid var(--line); background:transparent; color:var(--ink); border-radius:999px; padding:8px 16px; font-weight:700; cursor:pointer">Chiudi</button>'
        + '<button type="button" id="auguri-manda" onclick="mandaAuguri(this)" style="background:#25a35a; color:#fff; border:none; border-radius:999px; padding:8px 18px; font-weight:800; cursor:pointer"></button>')
    + '</div></div>';
  contaAuguri();
}
function spuntaAuguri(canale, si) {
  document.querySelectorAll('#popup-auguri input[data-canale="' + canale + '"]').forEach(function (c) { c.checked = si; });
  contaAuguri();
}
function sceltiAuguri(canale) {
  return Array.prototype.map.call(document.querySelectorAll('#popup-auguri input[data-canale="' + canale + '"]:checked'), function (c) { return c.value; });
}
function contaAuguri() {
  const w = sceltiAuguri('wa').length, m = sceltiAuguri('email').length;
  ['wa', 'email'].forEach(function (k) { const s = document.querySelector('#popup-auguri [data-n="' + k + '"]'); if (s) s.textContent = k === 'wa' ? w : m; });
  const b = document.getElementById('auguri-manda'); if (!b) return;
  b.disabled = !w && !m; b.style.opacity = w || m ? 1 : .5;
  b.textContent = w || m ? '✅ Conferma e manda (' + [m ? m + ' e-mail' : '', w ? w + ' WhatsApp' : ''].filter(Boolean).join(' + ') + ')' : 'Nessuno scelto';
}
async function mandaAuguri(b) {
  const sw = sceltiAuguri('wa'), sm = sceltiAuguri('email'), d = destinatariAuguri();
  const wa = d.wa.filter(function (g) { return sw.indexOf(g.chiave) >= 0; }), email = d.email.filter(function (g) { return sm.indexOf(g.chiave) >= 0; });
  if (!wa.length && !email.length) return;
  if (email.length) {
    b.disabled = true;
    let ok = 0; const ko = [];
    for (const g of email) {
      b.textContent = '⏳ E-mail ' + (ok + ko.length + 1) + ' di ' + email.length + '…';
      try {
        const testo = messaggioAuguri(g);
        await chiamaInviaEmail('POST', { a: g.email, oggetto: oggettoAuguri(), testo: testo });
        registraAuguri(g, 'email', oggettoAuguri() + ' – ' + testo, false);
        ok++;
      } catch (e) { ko.push(g.persone[0].nomeCompleto); }
    }
    avviso('📧 E-mail di auguri inviate: ' + ok + (ko.length ? ' · non partite: ' + ko.join(', ') : ''), !!ko.length);
  }
  AUGURI.coda = wa; AUGURI.pos = 0;
  if (wa.length) prossimoAuguri(); else disegnaAuguri();
}
function prossimoAuguri() {
  const g = AUGURI.coda[AUGURI.pos];
  AUGURI.pos++;
  if (g) {
    const c = g.persone[0], testo = messaggioAuguri(g);
    // la riga del primo cliente la scrive WhatsApp quando il messaggio parte; gli altri dello stesso messaggio qui
    contestoComunicazione({ nome: c.nomeCompleto, cf: c.codiceFiscale || '', motivo: motivoAuguri() });
    if (inviaWhatsAppLibero(g.tel, testo, c.nomeCompleto)) registraAuguri(g, 'whatsapp', testo, true);
  }
  if (AUGURI.pos >= AUGURI.coda.length) { AUGURI.coda = []; AUGURI.pos = 0; avviso('✓ Ultimo messaggio di auguri aperto: invio finito'); }
  disegnaAuguri();
}

// Casella in «Oggi» nei giorni delle feste: quanti clienti devono ancora ricevere gli auguri
function auguriDaMandareOggi() {
  const f = festaAuguriDiOggi(); if (!f) return null;
  const prima = { festa: AUGURI.festa, anno: AUGURI.anno };
  AUGURI.festa = f.festa; AUGURI.anno = f.anno;
  const n = clientiAuguri().filter(function (c) { return (haWhatsApp(c.telefono) || c.email) && !auguriGiaMandati(c); }).length;
  AUGURI.festa = prima.festa; AUGURI.anno = prima.anno;
  return { festa: f.festa, anno: f.anno, n: n };
}
