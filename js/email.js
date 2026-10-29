/**
 * E-mail inviate direttamente dal programma con la casella del CAF su Aruba (aliterme@cafcislsicilia.com).
 * L'invio passa dalla funzione del server "invia-email": la password della casella sta solo sul server.
 * Ogni invio apre prima una finestra dove si controllano destinatario, oggetto e testo.
 */

function pulisciTestoEmail(t) { return String(t || '').replace(/\*/g, ''); }
function emailCliente(p) {
  if (p && p.email) return p.email;
  const c = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).find(function (x) {
    return (p.codiceFiscale && x.codiceFiscale === p.codiceFiscale) || x.nomeCompleto === p.nome;
  });
  return (c && c.email) || '';
}

async function chiamaInviaEmail(metodo, corpo) {
  const invia = function () {
    return fetch(SUPABASE_URL + '/functions/v1/invia-email', {
      method: metodo,
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '') },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  };
  let r;
  try {
    await rinnovaToken();
    r = await invia();
    if (r.status === 401 && await rinnovaToken()) r = await invia();
  } catch (e) { throw new Error('il server non risponde, controlla la connessione e riprova'); }
  let dati = {};
  try { dati = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(dati.error || dati.message || ('errore ' + r.status));
  // la casella scelta non ha funzionato: l'e-mail è partita dall'altra (avviso al massimo ogni 10 minuti)
  if (dati.cambiata && Date.now() - (chiamaInviaEmail._avvisoRiserva || 0) > 600000) {
    chiamaInviaEmail._avvisoRiserva = Date.now();
    avviso('📧 La casella scelta non funziona: l\'e-mail è partita dall\'altra casella (' + (dati.mittente || '') + '). Controlla la casella che non va.', true);
  }
  return dati;
}

/* ---- 📧 Da quale casella partono le e-mail (scelta dell'amministratore, vale per tutti e per gli invii a tutti) ---- */
const CASELLE_EMAIL = { caf: 'aliterme@cafcislsicilia.com', riserva: 'cafcislaliterme@tim.it' };
function casellaInvio() { return typeof IMPOSTAZIONI !== 'undefined' && IMPOSTAZIONI.casella_invio === 'riserva' ? 'riserva' : 'caf'; }
async function impostaCasellaInvio(valore) {
  if (!auth || !auth.profilo || auth.profilo.ruolo !== 'admin') { avviso('Solo l\'amministratore sceglie la casella', true); return; }
  const { data: righe, error } = await supabase.from('impostazioni').upsert([{ chiave: 'casella_invio', valore: valore, aggiornato_il: new Date().toISOString() }], { onConflict: 'chiave' }).select('chiave');
  if (error || !righe || !righe.length) { avviso('❌ Non salvato' + (error ? ': ' + error.message : ''), true); return; }
  IMPOSTAZIONI.casella_invio = valore;
  avviso('✓ Da adesso le e-mail partono dalla casella ' + (valore === 'riserva' ? 'di riserva (' + CASELLE_EMAIL.riserva + ')' : 'del CAF (' + CASELLE_EMAIL.caf + ')'));
  document.querySelectorAll('.riga-casella-invio').forEach(function (el) { el.outerHTML = rigaCasellaInvioHTML(); });
}
// riga in Utenti e permessi: le due caselle, si tocca quella da usare
function rigaCasellaInvioHTML() {
  const c = casellaInvio();
  const chip = function (k, testo) {
    const on = c === k;
    return '<button type="button" onclick="impostaCasellaInvio(\'' + k + '\')" style="border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer; border:2px solid #1d4f91; background:' + (on ? '#1d4f91' : 'transparent') + '; color:' + (on ? '#fff' : '#1d4f91') + '">' + (on ? '✓ ' : '') + testo + '</button>';
  };
  return '<div class="riga-casella-invio perm-row" style="margin-bottom:12px; padding:10px 12px; border-radius:12px; background:var(--bg); border:1px solid var(--line); flex-wrap:wrap; gap:8px">'
    + '<span><b>📧 Casella da cui partono le e-mail</b> <span style="font-size:12px; color:var(--sub)">vale per tutti, anche per gli invii a tutti; se quella scelta non funziona il programma prova l\'altra e avvisa</span></span>'
    + '<span style="display:flex; gap:6px; flex-wrap:wrap">' + chip('caf', 'CAF · ' + CASELLE_EMAIL.caf) + chip('riserva', 'Riserva · ' + CASELLE_EMAIL.riserva) + '</span></div>';
}
// 🧪 Utenti e permessi: prova della casella di riserva (manda un'e-mail dalla riserva a se stessa)
async function provaCasellaRiserva(b) {
  if (b) { b.disabled = true; b.textContent = 'Prova in corso…'; }
  try {
    const d = await chiamaInviaEmail('POST', { provaRiserva: true });
    avviso('✅ Casella di riserva funzionante: e-mail di prova mandata a ' + (d.mittente || 'riserva'));
  } catch (e) { avviso('❌ Casella di riserva: ' + e.message, true); }
  if (b) { b.disabled = false; b.textContent = '🧪 Prova la casella di riserva'; }
}

// Finestra per scrivere / controllare l'e-mail prima dell'invio
// opz: { a, oggetto, testo, html, titolo, nome, dopo(a) }
function apriEmail(opz) {
  // in tutte le e-mail ci sono i recapiti del CAF, compresa l'e-mail
  if (typeof righeContattiCaf === 'function' && typeof emailCaf === 'function') {
    let t = pulisciTestoEmail(opz.testo);
    const mail = emailCaf();
    if (t.toLowerCase().indexOf(mail.toLowerCase()) < 0) {
      if (/\nTel\. /.test(t)) t = t.replace(/(\nTel\. [^\n]*)/, '$1\nE-mail: ' + mail);
      else t = t.replace(/\s+$/, '') + '\n\n' + righeContattiCaf();
    }
    opz = Object.assign({}, opz, { testo: t });
  }
  const vecchio = document.getElementById('popup-email'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-email';
  ov.style.cssText = 'position:fixed; inset:0; z-index:480; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #1d4f91; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:20px 22px; max-width:560px; width:100%; max-height:92vh; overflow:auto">'
    + '<div style="font-size:19px; font-weight:800; color:#1d4f91; margin-bottom:2px">📧 ' + esc(opz.titolo || 'Invia e-mail') + '</div>'
    + '<div style="font-size:12px; color:var(--sub); margin-bottom:10px; display:flex; align-items:center; gap:6px; flex-wrap:wrap">Da: <select id="em-da" style="width:auto; padding:3px 8px; font-size:12.5px; font-weight:700" title="Da quale casella parte questa e-mail">'
      + '<option value="caf"' + (casellaInvio() === 'caf' ? ' selected' : '') + '>CAF CISL Alì Terme &lt;' + CASELLE_EMAIL.caf + '&gt;</option>'
      + '<option value="riserva"' + (casellaInvio() === 'riserva' ? ' selected' : '') + '>Riserva &lt;' + CASELLE_EMAIL.riserva + '&gt;</option></select></div>'
    + '<label style="font-size:12px">A (e-mail del destinatario)</label><input id="em-a" type="email" inputmode="email" value="' + esc(opz.a || '') + '" placeholder="nome@esempio.it" style="text-transform:lowercase">'
    + (opz.a ? '' : '<div style="font-size:12px; color:#b5842a; margin-top:3px">Per ' + esc(opz.nome || 'questo cliente') + ' non c\'è un\'e-mail salvata: scrivila qui, verrà salvata anche nella pratica.</div>')
    + '<label style="font-size:12px; margin-top:8px; display:block">Oggetto</label><input id="em-ogg" value="' + esc(opz.oggetto || '') + '">'
    + '<label style="font-size:12px; margin-top:8px; display:block">Testo</label><textarea id="em-testo" rows="10" style="width:100%; font-size:13.5px; line-height:1.45">' + esc(pulisciTestoEmail(opz.testo)) + '</textarea>'
    + (opz.html ? '<div style="font-size:12px; color:var(--sub); margin-top:4px">📎 Nel corpo dell\'e-mail verrà inserita anche la <b>ricevuta</b> della pratica.</div>' : '')
    + '<div id="em-esito" style="font-size:13px; margin-top:8px"></div>'
    + '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px; flex-wrap:wrap">'
    + '<button type="button" data-azione="no" style="background:var(--line); color:var(--ink)">Annulla</button>'
    + '<button type="button" data-azione="invia" style="background:#1d4f91; color:#fff; font-weight:800">📤 Invia e-mail</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', async function (e) {
    const b = e.target.closest('button[data-azione]');
    if (!b && e.target !== ov) return;
    if (!b || b.dataset.azione === 'no') { ov.remove(); return; }
    const a = document.getElementById('em-a').value.trim().toLowerCase();
    const oggetto = document.getElementById('em-ogg').value.trim();
    const testo = document.getElementById('em-testo').value;
    const esito = document.getElementById('em-esito');
    if (!emailValida(a)) { esito.innerHTML = '<b style="color:#c0392b">❌ Scrivi un indirizzo e-mail valido (es. nome@esempio.it)</b>'; document.getElementById('em-a').focus(); return; }
    if (!oggetto || !testo.trim()) { esito.innerHTML = '<b style="color:#c0392b">❌ Oggetto e testo non possono essere vuoti</b>'; return; }
    b.disabled = true; b.textContent = '⏳ Invio in corso...';
    try {
      const html = opz.html ? '<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; white-space:pre-wrap">' + esc(testo) + '</div><hr>' + opz.html : undefined;
      const da = (document.getElementById('em-da') || {}).value || casellaInvio();
      await chiamaInviaEmail('POST', { a: a, oggetto: oggetto, testo: testo, html: html, casella: da });
      ov.remove();
      popupEmailInviata(a, opz.nome);
      if (typeof registraComunicazione === 'function') registraComunicazione({ canale: 'email', email: a, nome: opz.nome, motivo: opz.motivo || motivoDaTesto(oggetto + ' ' + testo), testo: oggetto + ' – ' + testo });
      if (opz.dopo) opz.dopo(a);
    } catch (err) {
      b.disabled = false; b.textContent = '📤 Riprova a inviare';
      const bloccato = /550|rifiutata|rejected|blocked|spam/i.test(err.message);
      esito.innerHTML = '<b style="color:#c0392b">❌ ' + (bloccato ? 'Aruba ha rifiutato l\'invio dal server (blocca temporaneamente gli invii che arrivano dai server del programma).' : esc(err.message)) + '</b>'
        + '<div style="margin-top:8px; padding:8px 10px; border-radius:10px; background:#e8f0fb; color:#0f1b2d">Puoi mandarla subito dalla tua posta: si apre già compilata, premi solo Invia.'
        + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px">'
        + '<button type="button" data-posta="app" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">📨 Apri nella mia posta</button>'
        + '<button type="button" data-posta="copia" style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:6px 14px; cursor:pointer">📋 Copia il testo</button></div></div>';
    }
  });
  // alternativa quando l'invio dal server non riesce: programma di posta del computer/telefono
  ov.addEventListener('click', async function (e) {
    const t = e.target.closest && e.target.closest('button[data-posta]');
    if (!t) return;
    const a = document.getElementById('em-a').value.trim();
    const oggetto = document.getElementById('em-ogg').value.trim();
    const testo = document.getElementById('em-testo').value;
    if (t.dataset.posta === 'copia') {
      try { await navigator.clipboard.writeText(testo); t.textContent = '✓ Copiato'; } catch (er) { document.getElementById('em-testo').select(); }
      return;
    }
    location.href = 'mailto:' + encodeURIComponent(a) + '?subject=' + encodeURIComponent(oggetto) + '&body=' + encodeURIComponent(testo);
    if (typeof registraComunicazione === 'function') registraComunicazione({ canale: 'email', email: a, nome: opz.nome, motivo: opz.motivo || motivoDaTesto(oggetto + ' ' + testo), testo: oggetto + ' – ' + testo });
    if (opz.dopo) opz.dopo(a);
  });
  setTimeout(function () { const el = document.getElementById(opz.a ? 'em-testo' : 'em-a'); if (el) el.focus(); }, 50);
}
function popupEmailInviata(a, nome) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed; inset:0; z-index:490; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #1a7f37; padding:22px 24px; max-width:420px; width:100%; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,.3)">'
    + '<div style="width:60px; height:60px; margin:0 auto 8px; border-radius:50%; background:#1a7f37; color:#fff; font-size:34px; line-height:60px">✓</div>'
    + '<div style="font-size:20px; font-weight:800; color:#1a7f37">E-mail inviata</div>'
    + '<div style="font-size:14px; margin:6px 0 14px">' + (nome ? 'a <b>' + esc(nome) + '</b><br>' : '') + esc(a) + '</div>'
    + '<button type="button" style="background:#1a7f37; color:#fff; min-width:110px">OK</button></div>';
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.tagName === 'BUTTON') ov.remove(); });
  document.body.appendChild(ov);
}

// Dopo l'invio: si annota sulla pratica e, se mancava, si salva l'e-mail (pratica + archivio clienti)
async function annotaEmailPratica(p, motivo, a) {
  const campi = { emailInviata: motivo + ' il ' + todayIT() };
  if (!p.email && a) campi.email = a;
  await data.pratiche.aggiorna(p.id, campi);
  if (!p.email && a) {
    const nn = typeof dividiNominativo === 'function' ? dividiNominativo(p) : { cognome: '', nome: '' };
    data.clienti.salvaTelefono({ nomeCompleto: p.nome, cognome: nn.cognome, nome: nn.nome, dataNascita: p.cf || '', codiceFiscale: p.codiceFiscale || '', email: a });
  }
}
function praticaPerId(id) { return (state.pratiche || []).find(function (x) { return x.id === id; }); }

/* ---- I vari invii ---- */
function emailRitiro(id) {
  const p = praticaPerId(id); if (!p) return;
  apriEmail({ titolo: 'Avvisa che la pratica è pronta', nome: p.nome, a: emailCliente(p), oggetto: 'La sua pratica è pronta – CAF CISL Alì Terme',
    testo: messaggioRitiro(p), dopo: function (a) { annotaEmailPratica(p, 'pratica pronta', a); } });
}
function emailDocumentiMancanti(id) {
  const p = praticaPerId(id); if (!p) return;
  if (!senzaCUD(documentiPratica(p).mancanti).length) { avviso('ℹ️ Manca solo il CUD: lo richiede il CAF da "📋 Richieste CUD"'); return; }
  apriEmail({ titolo: 'Chiedi i documenti mancanti', nome: p.nome, a: emailCliente(p), oggetto: 'Documenti da portare – pratica ' + formattaProtocollo(p),
    testo: messaggioDocumentiMancanti(p), dopo: function (a) { annotaEmailPratica(p, 'documenti mancanti', a); } });
}
function emailNuovoDocumento(id) {
  const p = praticaPerId(id); if (!p) return;
  apriEmail({ titolo: 'Chiedi il nuovo documento d\'identità', nome: p.nome, a: emailCliente(p), oggetto: 'Documento d\'identità scaduto – CAF CISL Alì Terme',
    testo: messaggioNuovoDocumento(p.nome, p.documentoScadenza), dopo: function (a) { annotaEmailPratica(p, 'richiesta nuovo documento', a); } });
}
function emailNuovoDocumentoModulo() {
  const nome = (document.getElementById('f-cognome').value + ' ' + document.getElementById('f-nome').value).trim();
  apriEmail({ titolo: 'Chiedi il nuovo documento d\'identità', nome: nome, a: document.getElementById('f-email').value.trim(), oggetto: 'Documento d\'identità scaduto – CAF CISL Alì Terme',
    testo: messaggioNuovoDocumento(nome || 'cliente', document.getElementById('f-doc-scad').value.trim()),
    dopo: function (a) { const el = document.getElementById('f-email'); if (el && !el.value) el.value = a; } });
}
function emailRicevuta(id) {
  const p = praticaPerId(id); if (!p) return;
  apriEmail({ titolo: 'Invia la ricevuta al cliente', nome: p.nome, a: emailCliente(p), oggetto: 'Ricevuta pratica ' + formattaProtocollo(p) + ' – CAF CISL Alì Terme',
    testo: 'Gentile ' + nomeProprio(p.nome) + ',\nle inviamo la ricevuta della sua pratica ' + (p.tipo || '') + ' (protocollo ' + formattaProtocollo(p) + ' del ' + (p.data || '') + ').\nGrazie.\n\n' + righeContattiCaf(),
    html: ricevutaHTML(p, true), dopo: function (a) { annotaEmailPratica(p, 'ricevuta', a); } });
}
function emailScadenzaColf(idScadenza) {
  const s = (state.scadenze || []).find(function (x) { return x.id === idScadenza; });
  if (!s) return;
  const p = typeof praticaDiScadenza === 'function' ? praticaDiScadenza(s) : null;
  const nome = (p && p.nome) || s.cliente || '';
  apriEmail({ titolo: 'Avvisa la scadenza colf e badanti', nome: nome, a: p ? emailCliente(p) : '', oggetto: 'Scadenza assistenza colf/badante – CAF CISL Alì Terme',
    testo: testoAvvisoScadenza(s, nome),
    dopo: async function (a) {
      const note = [String(s.note || '').replace(/\s*·?\s*AVVISATO (il|via e-mail il) [\d\/]+/g, ''), 'AVVISATO via e-mail il ' + new Date().toLocaleDateString('it-IT')].filter(Boolean).join(' · ');
      await data.scadenze.aggiorna(s.id, { note: note });
      if (p && !p.email) annotaEmailPratica(p, 'avviso scadenza', a);
    } });
}
function emailAccessoUtente(u, testo) {
  apriEmail({ titolo: 'Invia l\'accesso a ' + (u.nome || ''), nome: u.nome, a: u.email || '', oggetto: 'Accesso al programma CAF CISL Alì Terme', testo: testo });
}

function bottoneEmail(onclick, etichetta, titolo) {
  return '<button type="button" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:4px 12px; font-size:12px; font-weight:700; cursor:pointer" title="' + esc(titolo || 'Invia per e-mail dalla casella del CAF') + '" onclick="' + onclick + '">📧 ' + (etichetta || 'E-mail') + '</button>';
}
