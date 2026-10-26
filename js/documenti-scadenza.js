/* ---------------- 🪪 Documenti scaduti o in scadenza ----------------
   Tutti i clienti dell'archivio (non deceduti) con il documento d'identità già scaduto o che scade entro 30 giorni:
   avviso su WhatsApp o per e-mail (uno alla volta o a tutti), e l'elenco di chi non ha né cellulare né e-mail.
   Ogni invio resta nel registro delle comunicazioni; chi è già stato avvisato non viene riselezionato. */

const GIORNI_PREAVVISO_DOCUMENTO = 30;
const GIORNI_PREAVVISO_PERMESSO = 60;
const DOC_SCADENZA = { coda: [], pos: 0 };

// Le carte d'identità cartacee sono da sostituire con quella elettronica (regolamento UE 2019/1157, dal 3 agosto 2026):
// compaiono nell'elenco anche se la data scritta non è ancora passata, con un messaggio apposta.
const DATA_FINE_CARTACEE = new Date(2026, 7, 3);
function eCartaceaDaSostituire(c) {
  return typeof categoriaDocumento === 'function' && categoriaDocumento(c) === 'cartacea' && new Date() >= DATA_FINE_CARTACEE;
}
function clientiDocumentoDaRinnovare() {
  // tutti i clienti dell'archivio (non deceduti) con la scadenza scritta: chi ha la scadenza in scheda è un cliente seguito
  return (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).map(function (c) {
    if (c.decedutoIl) return null;
    const st = c.documentoScadenza ? statoScadenzaDocumento(c.documentoScadenza) : null;
    // permesso di soggiorno (lavoratori colf e badanti): scaduto o in scadenza entro 60 giorni (il rinnovo si chiede prima)
    const sp = c.permessoScadenza ? statoScadenzaDocumento(c.permessoScadenza) : null;
    if (sp && sp.giorni <= GIORNI_PREAVVISO_PERMESSO && !(st && st.giorni < sp.giorni && st.giorni <= GIORNI_PREAVVISO_DOCUMENTO)) return { c: c, giorni: sp.giorni, permesso: true };
    if (st && st.giorni < 0) return { c: c, giorni: st.giorni };
    if (eCartaceaDaSostituire(c)) return { c: c, giorni: Math.floor((DATA_FINE_CARTACEE - new Date()) / 86400000), cartacea: true };
    if (st && st.giorni <= GIORNI_PREAVVISO_DOCUMENTO) return { c: c, giorni: st.giorni };
    return null;
  }).filter(Boolean).sort(function (a, b) { return a.giorni - b.giorni; });
}
// Già avvisato per il documento (registro delle comunicazioni, ultimi 60 giorni)
function avvisoDocumentoInviato(c) {
  if (typeof comunicazioniPersona !== 'function') return null;
  const da = Date.now() - 60 * 86400000;
  return comunicazioniPersona(c.nomeCompleto, c.codiceFiscale, c.dataNascita).find(function (x) { return /documento/i.test(x.motivo || '') && Date.parse(x.quando) >= da; }) || null;
}
function messaggioPermessoSoggiorno(c, giorni) {
  return 'Gentile ' + nomeProprio(c.nomeCompleto) + ', ' + (giorni < 0 ? 'il suo permesso di soggiorno risulta scaduto il ' + c.permessoScadenza + '.' : 'le ricordiamo che il suo permesso di soggiorno scadrà il ' + c.permessoScadenza + ': si ricordi di chiedere il rinnovo in tempo.')
    + ' Quando avrà il permesso rinnovato (o la ricevuta della richiesta di rinnovo), le chiediamo di portarcene (o inviarci qui) una copia.\nGrazie.\n\n' + righeContattiCaf();
}
function messaggioDocumentoDaRinnovare(c, giorni, r) {
  if (r && r.permesso) return messaggioPermessoSoggiorno(c, giorni);
  if (eCartaceaDaSostituire(c) && !((statoScadenzaDocumento(c.documentoScadenza || '') || { giorni: 0 }).giorni < 0)) return messaggioCartaceaDaSostituire(c);
  if (giorni < 0) return messaggioNuovoDocumento(c.nomeCompleto, c.documentoScadenza, true);
  return 'Gentile ' + nomeProprio(c.nomeCompleto) + ', le ricordiamo che il suo documento d\'identità scadrà il ' + c.documentoScadenza
    + '. Quando lo avrà rinnovato, per poter preparare le sue prossime pratiche le chiediamo di portarci (o inviarci qui) una copia del nuovo documento.\nGrazie.\n\n' + righeContattiCaf();
}
function messaggioCartaceaDaSostituire(c) {
  return 'Gentile ' + nomeProprio(c.nomeCompleto) + ', dal 3 agosto 2026 le carte d\'identità di carta vanno sostituite con la carta d\'identità elettronica (regolamento europeo).'
    + ' Quando avrà fatto quella nuova, per poter preparare le sue prossime pratiche le chiediamo di portarci (o inviarci qui) una copia.\nGrazie.\n\n' + righeContattiCaf();
}
function motivoDocumento(giorni, r) {
  if (r && r.permesso) return 'Richiesta documento: permesso di soggiorno'; return giorni < 0 ? 'Richiesta documento d\'identità' : 'Documento in scadenza'; }

// Riga di una persona nel messaggio unico (più clienti con lo stesso cellulare)
function rigaDocumentoGruppo(r) {
  const c = r.c;
  const cosa = r.permesso ? 'permesso di soggiorno ' + (r.giorni < 0 ? 'scaduto il ' : 'che scade il ') + c.permessoScadenza
    : r.cartacea ? 'carta d\'identità di carta, da sostituire con quella elettronica'
    : 'documento d\'identità ' + (r.giorni < 0 ? 'scaduto il ' : 'che scade il ') + c.documentoScadenza;
  return '• ' + nomeProprio(c.nomeCompleto) + ' – ' + cosa;
}
function messaggioDocumentiGruppo(lista) {
  return 'Buongiorno, per poter preparare le prossime pratiche le chiediamo una copia del documento nuovo di queste persone:\n'
    + lista.map(rigaDocumentoGruppo).join('\n')
    + '\n\nPotete portarcela in ufficio o inviarcela qui (anche una foto va bene).\nGrazie.\n\n' + righeContattiCaf();
}
// Clienti dell'elenco con lo stesso cellulare e non ancora avvisati (compreso quello scelto): un solo messaggio
function gruppoDocumentoStessoNumero(r, tutti) {
  const n = numeroWhatsApp(r.c.telefono); if (!n) return [r];
  const altri = (tutti || clientiDocumentoDaRinnovare()).filter(function (x) { return x !== r && x.c.id !== r.c.id && numeroWhatsApp(x.c.telefono) === n && !avvisoDocumentoInviato(x.c); });
  return [r].concat(altri);
}
function avvisaDocumentoWhatsApp(id) {
  const tutti = clientiDocumentoDaRinnovare();
  const r = tutti.find(function (x) { return String(x.c.id) === String(id); }); if (!r) return false;
  return avvisaGruppoDocumenti(gruppoDocumentoStessoNumero(r, tutti));
}
function avvisaGruppoDocumenti(gruppo) {
  const r = gruppo[0];
  contestoComunicazione({ nome: r.c.nomeCompleto, cf: r.c.codiceFiscale || '', nascita: r.c.dataNascita || '', motivo: motivoDocumento(r.giorni, r) });
  const testo = gruppo.length > 1 ? messaggioDocumentiGruppo(gruppo) : messaggioDocumentoDaRinnovare(r.c, r.giorni, r);
  const ok = inviaWhatsAppLibero(r.c.telefono, testo, r.c.nomeCompleto);
  // gli altri clienti dello stesso messaggio: una riga nelle comunicazioni di ognuno
  if (ok) gruppo.slice(1).forEach(function (x) { registraComunicazione({ canale: 'whatsapp', telefono: numeroWhatsApp(x.c.telefono), testo: testo, nome: x.c.nomeCompleto, cf: x.c.codiceFiscale || '', nascita: x.c.dataNascita || '', motivo: motivoDocumento(x.giorni, x), senzaContesto: true }); });
  setTimeout(disegnaDocumentiInScadenza, 800);
  return ok;
}
function avvisaDocumentoEmail(id) {
  const r = clientiDocumentoDaRinnovare().find(function (x) { return String(x.c.id) === String(id); }); if (!r) return;
  apriEmail({ titolo: (r.permesso ? 'Permesso di soggiorno ' : 'Documento d\'identità ') + (r.giorni < 0 ? 'scaduto' : 'in scadenza'), nome: r.c.nomeCompleto, a: r.c.email || '', motivo: motivoDocumento(r.giorni, r),
    oggetto: (r.permesso ? 'Permesso di soggiorno ' : 'Documento d\'identità ') + (r.giorni < 0 ? 'scaduto' : 'in scadenza') + ' – CAF CISL Alì Terme', testo: messaggioDocumentoDaRinnovare(r.c, r.giorni, r),
    dopo: function () { setTimeout(disegnaDocumentiInScadenza, 800); } });
}
// WhatsApp a tutti quelli con cellulare non ancora avvisati: uno dopo l'altro (il browser apre una chat per volta)
function avviaInvioDocumentiWhatsApp() {
  // un messaggio per cellulare: chi ha lo stesso numero (collaboratore, famiglia) è nello stesso messaggio
  const gruppi = {}; DOC_SCADENZA.coda = [];
  clientiDocumentoDaRinnovare().filter(function (r) { return haWhatsApp(r.c.telefono) && !avvisoDocumentoInviato(r.c); }).forEach(function (r) {
    const k = numeroWhatsApp(r.c.telefono);
    if (!gruppi[k]) { gruppi[k] = []; DOC_SCADENZA.coda.push(gruppi[k]); }
    gruppi[k].push(r);
  });
  DOC_SCADENZA.pos = 0;
  if (!DOC_SCADENZA.coda.length) { avviso('Tutti i clienti con cellulare sono già stati avvisati'); return; }
  prossimoDocumentoWhatsApp();
}
function prossimoDocumentoWhatsApp() {
  if (DOC_SCADENZA.pos >= DOC_SCADENZA.coda.length) { DOC_SCADENZA.coda = []; avviso('✓ Avvisi su WhatsApp finiti'); disegnaDocumentiInScadenza(); return; }
  avvisaGruppoDocumenti(DOC_SCADENZA.coda[DOC_SCADENZA.pos]);
  DOC_SCADENZA.pos++;
  if (DOC_SCADENZA.pos >= DOC_SCADENZA.coda.length) { DOC_SCADENZA.coda = []; avviso('✓ Ultimo avviso aperto: invio su WhatsApp finito'); }
  disegnaDocumentiInScadenza();
}
// E-mail a tutti quelli con solo e-mail non ancora avvisati: partono dalla casella del CAF
async function inviaDocumentiEmailATutti(b) {
  const tutti = clientiDocumentoDaRinnovare().filter(function (r) { return !haWhatsApp(r.c.telefono) && r.c.email && !avvisoDocumentoInviato(r.c); });
  if (!tutti.length) { avviso('Nessuna e-mail da mandare'); return; }
  // stessa e-mail per più clienti: una sola e-mail con tutti i nominativi
  const perEmail = {}, lista = [];
  tutti.forEach(function (r) { const k = String(r.c.email).trim().toLowerCase(); if (!perEmail[k]) { perEmail[k] = []; lista.push(perEmail[k]); } perEmail[k].push(r); });
  if (!confirm('Mando l\'e-mail a ' + lista.length + ' client' + (lista.length === 1 ? 'e' : 'i') + ' dalla casella del CAF?')) return;
  b.disabled = true;
  let ok = 0, ko = [];
  for (const g of lista) {
    const r = g[0];
    b.textContent = '⏳ ' + (ok + ko.length + 1) + ' di ' + lista.length + '…';
    const oggetto = g.length > 1 ? 'Documenti da rinnovare – CAF CISL Alì Terme' : (r.permesso ? 'Permesso di soggiorno ' : 'Documento d\'identità ') + (r.giorni < 0 ? 'scaduto' : 'in scadenza') + ' – CAF CISL Alì Terme';
    const testo = g.length > 1 ? messaggioDocumentiGruppo(g) : messaggioDocumentoDaRinnovare(r.c, r.giorni, r);
    try {
      await chiamaInviaEmail('POST', { a: r.c.email, oggetto: oggetto, testo: testo });
      for (const x of g) await registraComunicazione({ canale: 'email', email: x.c.email, testo: oggetto + ' – ' + testo, nome: x.c.nomeCompleto, cf: x.c.codiceFiscale || '', nascita: x.c.dataNascita || '', motivo: motivoDocumento(x.giorni, x), senzaContesto: true });
      ok++;
    } catch (e) { ko.push(g.map(function (x) { return x.c.nomeCompleto; }).join(' e ')); }
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
      + '<span><b>' + esc(r.c.nomeCompleto) + '</b> <span style="font-size:12px; font-weight:800; color:' + (r.giorni < 0 ? '#c0392b' : '#b35f0c') + '">' + (r.permesso ? '🛂 permesso di soggiorno ' + (r.giorni < 0 ? 'scaduto il ' : 'scade il ') + esc(r.c.permessoScadenza) + (r.giorni >= 0 ? ' (tra ' + r.giorni + ' giorn' + (r.giorni === 1 ? 'o' : 'i') + ')' : '') : r.cartacea ? '📄 carta d\'identità cartacea: da sostituire con l\'elettronica' + (r.c.documentoScadenza ? ' (sul documento: ' + esc(r.c.documentoScadenza) + ')' : '') : '🪪 ' + (r.giorni < 0 ? 'scaduto il ' : 'scade il ') + esc(r.c.documentoScadenza) + (typeof annoScadenzaSbagliato === 'function' && annoScadenzaSbagliato(r.c.documentoScadenza) ? ' ⚠️ anno sbagliato? correggi la scheda' : '') + (r.giorni >= 0 ? ' (tra ' + r.giorni + ' giorn' + (r.giorni === 1 ? 'o' : 'i') + ')' : '')) + '</span>'
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
    + '<div class="sub2">Tutti i clienti dell\'archivio con il documento già scaduto o che scade entro ' + GIORNI_PREAVVISO_DOCUMENTO + ' giorni. Quando scrivi la nuova scadenza escono da soli dall\'elenco.</div></div>'
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
