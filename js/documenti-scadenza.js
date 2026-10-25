/* ---------------- 🪪 Documenti scaduti o in scadenza ----------------
   Clienti recenti (pratiche quest'anno o l'anno scorso, o inseriti in archivio nell'ultimo anno) con il documento d'identità già scaduto o che scade entro 30 giorni:
   avviso su WhatsApp o per e-mail (uno alla volta o a tutti), e l'elenco di chi non ha né cellulare né e-mail.
   Ogni invio resta nel registro delle comunicazioni; chi è già stato avvisato non viene riselezionato. */

const GIORNI_PREAVVISO_DOCUMENTO = 30;
const DOC_SCADENZA = { coda: [], pos: 0 };

function clientiDocumentoDaRinnovare() {
  const rec = typeof clientiConPraticheRecenti === 'function' ? clientiConPraticheRecenti() : { cf: {}, nome: {} };
  return (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).filter(function (c) {
    if (c.decedutoIl || !c.documentoScadenza) return false;
    if (!((c.codiceFiscale && rec.cf[c.codiceFiscale]) || rec.nome[String(c.nomeCompleto || '').toUpperCase()])) return false;
    const st = statoScadenzaDocumento(c.documentoScadenza);
    return st && st.giorni <= GIORNI_PREAVVISO_DOCUMENTO;
  }).map(function (c) { return { c: c, giorni: statoScadenzaDocumento(c.documentoScadenza).giorni }; })
    .sort(function (a, b) { return a.giorni - b.giorni; });
}
// Già avvisato per il documento (registro delle comunicazioni, ultimi 60 giorni)
function avvisoDocumentoInviato(c) {
  if (typeof comunicazioniPersona !== 'function') return null;
  const da = Date.now() - 60 * 86400000;
  return comunicazioniPersona(c.nomeCompleto, c.codiceFiscale, c.dataNascita).find(function (x) { return /documento/i.test(x.motivo || '') && Date.parse(x.quando) >= da; }) || null;
}
function messaggioDocumentoDaRinnovare(c, giorni) {
  if (giorni < 0) return messaggioNuovoDocumento(c.nomeCompleto, c.documentoScadenza, true);
  return 'Gentile ' + nomeProprio(c.nomeCompleto) + ', le ricordiamo che il suo documento d\'identità scadrà il ' + c.documentoScadenza
    + '. Quando lo avrà rinnovato, per poter preparare le sue prossime pratiche le chiediamo di portarci (o inviarci qui) una copia del nuovo documento.\nGrazie.\n\n' + righeContattiCaf();
}
function motivoDocumento(giorni) { return giorni < 0 ? 'Richiesta documento d\'identità' : 'Documento in scadenza'; }

function avvisaDocumentoWhatsApp(id) {
  const r = clientiDocumentoDaRinnovare().find(function (x) { return String(x.c.id) === String(id); }); if (!r) return false;
  contestoComunicazione({ nome: r.c.nomeCompleto, cf: r.c.codiceFiscale || '', nascita: r.c.dataNascita || '', motivo: motivoDocumento(r.giorni) });
  const ok = inviaWhatsAppLibero(r.c.telefono, messaggioDocumentoDaRinnovare(r.c, r.giorni), r.c.nomeCompleto);
  setTimeout(disegnaDocumentiInScadenza, 800);
  return ok;
}
function avvisaDocumentoEmail(id) {
  const r = clientiDocumentoDaRinnovare().find(function (x) { return String(x.c.id) === String(id); }); if (!r) return;
  apriEmail({ titolo: 'Documento d\'identità ' + (r.giorni < 0 ? 'scaduto' : 'in scadenza'), nome: r.c.nomeCompleto, a: r.c.email || '', motivo: motivoDocumento(r.giorni),
    oggetto: 'Documento d\'identità ' + (r.giorni < 0 ? 'scaduto' : 'in scadenza') + ' – CAF CISL Alì Terme', testo: messaggioDocumentoDaRinnovare(r.c, r.giorni),
    dopo: function () { setTimeout(disegnaDocumentiInScadenza, 800); } });
}
// WhatsApp a tutti quelli con cellulare non ancora avvisati: uno dopo l'altro (il browser apre una chat per volta)
function avviaInvioDocumentiWhatsApp() {
  DOC_SCADENZA.coda = clientiDocumentoDaRinnovare().filter(function (r) { return haWhatsApp(r.c.telefono) && !avvisoDocumentoInviato(r.c); }).map(function (r) { return r.c.id; });
  DOC_SCADENZA.pos = 0;
  if (!DOC_SCADENZA.coda.length) { avviso('Tutti i clienti con cellulare sono già stati avvisati'); return; }
  prossimoDocumentoWhatsApp();
}
function prossimoDocumentoWhatsApp() {
  if (DOC_SCADENZA.pos >= DOC_SCADENZA.coda.length) { DOC_SCADENZA.coda = []; avviso('✓ Avvisi su WhatsApp finiti'); disegnaDocumentiInScadenza(); return; }
  avvisaDocumentoWhatsApp(DOC_SCADENZA.coda[DOC_SCADENZA.pos]);
  DOC_SCADENZA.pos++;
  if (DOC_SCADENZA.pos >= DOC_SCADENZA.coda.length) { DOC_SCADENZA.coda = []; avviso('✓ Ultimo avviso aperto: invio su WhatsApp finito'); }
  disegnaDocumentiInScadenza();
}
// E-mail a tutti quelli con solo e-mail non ancora avvisati: partono dalla casella del CAF
async function inviaDocumentiEmailATutti(b) {
  const lista = clientiDocumentoDaRinnovare().filter(function (r) { return !haWhatsApp(r.c.telefono) && r.c.email && !avvisoDocumentoInviato(r.c); });
  if (!lista.length) { avviso('Nessuna e-mail da mandare'); return; }
  if (!confirm('Mando l\'e-mail a ' + lista.length + ' client' + (lista.length === 1 ? 'e' : 'i') + ' dalla casella del CAF?')) return;
  b.disabled = true;
  let ok = 0, ko = [];
  for (const r of lista) {
    b.textContent = '⏳ ' + (ok + ko.length + 1) + ' di ' + lista.length + '…';
    const oggetto = 'Documento d\'identità ' + (r.giorni < 0 ? 'scaduto' : 'in scadenza') + ' – CAF CISL Alì Terme', testo = messaggioDocumentoDaRinnovare(r.c, r.giorni);
    try {
      await chiamaInviaEmail('POST', { a: r.c.email, oggetto: oggetto, testo: testo });
      contestoComunicazione({ nome: r.c.nomeCompleto, cf: r.c.codiceFiscale || '', nascita: r.c.dataNascita || '', motivo: motivoDocumento(r.giorni) });
      await registraComunicazione({ canale: 'email', email: r.c.email, testo: oggetto + ' – ' + testo });
      ok++;
    } catch (e) { ko.push(r.c.nomeCompleto); }
  }
  b.disabled = false;
  avviso('📧 E-mail inviate: ' + ok + (ko.length ? ' · non partite: ' + ko.join(', ') : ''), !!ko.length);
  disegnaDocumentiInScadenza();
}

function apriDocumentiInScadenza() {
  const vecchio = document.getElementById('popup-doc-scadenza'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-doc-scadenza';
  ov.style.cssText = 'position:fixed; inset:0; z-index:456; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:10px';
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-chiudi]')) { DOC_SCADENZA.coda = []; ov.remove(); } });
  document.body.appendChild(ov);
  disegnaDocumentiInScadenza();
}
function disegnaDocumentiInScadenza() {
  const ov = document.getElementById('popup-doc-scadenza'); if (!ov) return;
  const tutti = clientiDocumentoDaRinnovare();
  const conCell = tutti.filter(function (r) { return haWhatsApp(r.c.telefono); });
  const soloMail = tutti.filter(function (r) { return !haWhatsApp(r.c.telefono) && r.c.email; });
  const nessuno = tutti.filter(function (r) { return !haWhatsApp(r.c.telefono) && !r.c.email; });
  const b = function (onclick, testo, colore) { return '<button type="button" onclick="' + onclick + '" style="background:' + colore + '; color:#fff; border:none; border-radius:999px; padding:5px 12px; font-size:12.5px; font-weight:800; cursor:pointer">' + testo + '</button>'; };
  const riga = function (r, tasti) {
    const av = avvisoDocumentoInviato(r.c);
    return '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; padding:7px 0; border-bottom:1px solid var(--line)">'
      + '<span><b>' + esc(r.c.nomeCompleto) + '</b> <span style="font-size:12px; font-weight:800; color:' + (r.giorni < 0 ? '#c0392b' : '#b35f0c') + '">🪪 ' + (r.giorni < 0 ? 'scaduto il ' : 'scade il ') + esc(r.c.documentoScadenza) + (r.giorni >= 0 ? ' (tra ' + r.giorni + ' giorn' + (r.giorni === 1 ? 'o' : 'i') + ')' : '') + '</span>'
      + '<div class="sub2">' + [r.c.telefono ? '📱 ' + esc(r.c.telefono) : '', r.c.telefonoFisso ? '☎️ ' + esc(r.c.telefonoFisso) : '', r.c.email ? '✉️ ' + esc(r.c.email) : ''].filter(Boolean).join(' · ')
      + (av ? ' · <b style="color:#1a7f37">✓ avvisato il ' + esc(quandoComunicazione(av).split(' ')[0]) + '</b>' : '') + '</div></span>'
      + '<span style="display:flex; gap:5px">' + tasti + '</span></div>';
  };
  const titolo = function (t, n, extra) { return '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin:12px 0 4px"><b style="font-size:15px">' + t + ' (' + n + ')</b>' + (extra || '') + '</div>'; };
  const daAvvisareCell = conCell.filter(function (r) { return !avvisoDocumentoInviato(r.c); }).length;
  const daAvvisareMail = soloMail.filter(function (r) { return !avvisoDocumentoInviato(r.c); }).length;
  const inCorso = DOC_SCADENZA.coda.length && DOC_SCADENZA.pos <= DOC_SCADENZA.coda.length;
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border-top:6px solid #c0392b; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:16px 18px; max-width:820px; width:100%; max-height:94vh; overflow:auto">'
    + '<div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start"><div><div style="font-size:19px; font-weight:800; color:#c0392b">🪪 Documenti scaduti o in scadenza</div>'
    + '<div class="sub2">Clienti venuti quest\'anno o l\'anno scorso, o inseriti in archivio nell\'ultimo anno, con il documento già scaduto o che scade entro ' + GIORNI_PREAVVISO_DOCUMENTO + ' giorni. Quando scrivi la nuova scadenza escono da soli dall\'elenco.</div></div>'
    + '<button type="button" data-chiudi="1" style="flex:none; white-space:nowrap; background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer">✕ Chiudi</button></div>'
    + (!tutti.length ? '<div class="empty" style="margin-top:12px">Nessun documento scaduto o in scadenza 👍</div>' : '')
    + (conCell.length ? titolo('📱 Con cellulare', conCell.length, inCorso
        ? b('prossimoDocumentoWhatsApp()', '💬 Prossimo (' + (DOC_SCADENZA.pos + 1) + ' di ' + DOC_SCADENZA.coda.length + ')', '#25a35a')
        : (daAvvisareCell ? b('avviaInvioDocumentiWhatsApp()', '💬 Manda a tutti, uno dopo l\'altro (' + daAvvisareCell + ')', '#25a35a') : '<span class="sub2">tutti avvisati</span>'))
      + conCell.map(function (r) { return riga(r, b('avvisaDocumentoWhatsApp(\'' + esc(String(r.c.id)) + '\')', '💬', '#25d366') + (r.c.email ? b('avvisaDocumentoEmail(\'' + esc(String(r.c.id)) + '\')', '📧', '#1d4f91') : '')); }).join('') : '')
    + (soloMail.length ? titolo('📧 Solo e-mail', soloMail.length, daAvvisareMail ? b('inviaDocumentiEmailATutti(this)', '📧 Manda a tutti (' + daAvvisareMail + ')', '#1d4f91') : '<span class="sub2">tutti avvisati</span>')
      + soloMail.map(function (r) { return riga(r, b('avvisaDocumentoEmail(\'' + esc(String(r.c.id)) + '\')', '📧', '#1d4f91')); }).join('') : '')
    + (nessuno.length ? titolo('☎️ Senza cellulare né e-mail', nessuno.length, '<span class="sub2">da chiamare al fisso o completare la scheda</span>')
      + nessuno.map(function (r) { return riga(r, (r.c.telefonoFisso ? '<a href="tel:' + esc(String(r.c.telefonoFisso).replace(/[^\d+]/g, '')) + '" style="display:inline-block; background:#1d4f91; color:#fff; text-decoration:none; border-radius:999px; padding:5px 12px; font-size:12.5px; font-weight:800">📞</a>' : '') + b('modificaClienteArchivio(ARCHIVIO_CLIENTI.find(function(x){ return String(x.id) === \'' + esc(String(r.c.id)) + '\'; }), disegnaDocumentiInScadenza)', '✏️ Completa la scheda', '#5b6b82')); }).join('') : '')
    + '</div>';
}
