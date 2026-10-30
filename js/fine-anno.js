/* ---------------- 🧹 Controllo di fine anno: «Pronti per il nuovo anno?» ----------------
   Dal 15 dicembre al 31 gennaio, solo per l'amministratore: un riquadro nella pagina Oggi apre una lista di controllo
   per chiudere bene l'anno e partire puliti con il nuovo. Ogni voce è ✅ se è a posto o ⚠️ se c'è da fare, con il tasto
   per sistemarla. Non cancella e non cambia niente da sola: ogni passo lo decide l'amministratore.
   Tra le voci ci sono gli anni con più di 5 anni (js/anni-vecchi.js), da scaricare e togliere se lo decide l'amministratore.
   Si apre anche in ogni momento da Utenti e permessi («🧹 Controllo di fine anno»). */

// periodo del riquadro: dal 15/12 al 31/01
function periodoFineAnno(oggi) {
  oggi = oggi || new Date();
  return (oggi.getMonth() === 11 && oggi.getDate() >= 15) || oggi.getMonth() === 0;
}
// l'anno da chiudere: a dicembre quello in corso, a gennaio (e nel resto dell'anno) quello passato
function annoDaChiudere(oggi) {
  oggi = oggi || new Date();
  return oggi.getMonth() === 11 ? oggi.getFullYear() : oggi.getFullYear() - 1;
}

// Voci che si calcolano subito dai dati già caricati
function vociFineAnno(anno) {
  const nuovo = anno + 1;
  const pratAnno = (state.pratiche || []).filter(function (p) { return !p.annullata && annoPratica(p) === anno; });
  const voci = [];
  const voce = function (icona, titolo, n, dettaglioOk, dettaglioDaFare, azione, testoAzione) {
    voci.push({ icona: icona, titolo: titolo, ok: !n, testo: n ? dettaglioDaFare : dettaglioOk, azione: n ? azione : '', testoAzione: testoAzione || 'Apri' });
  };
  // anno di prova (prima dell'inizio vero del programma): le pratiche sono solo prove
  if (typeof ANNO_INIZIO_PROTOCOLLO !== 'undefined' && anno < ANNO_INIZIO_PROTOCOLLO) {
    voce('🧪', 'Pratiche di prova del ' + anno, pratAnno.length, 'Nessuna pratica di prova rimasta.',
      pratAnno.length + (pratAnno.length === 1 ? ' pratica' : ' pratiche') + ' del ' + anno + ' sono solo prove: vanno tolte prima di partire, con «🗓️ Cancella un solo anno» (fa prima da solo una copia di sicurezza) oppure azzerando come hai previsto tu. L\'archivio clienti resta.',
      'fineAnnoVaiCancellaAnno(' + anno + ')', '🗓️ Vai a «Cancella un solo anno»');
  }
  const daLavorare = pratAnno.filter(function (p) { return eDaLavorare(p) && !eRinuncia(p); });
  voce('📥', 'Pratiche del ' + anno + ' ancora da lavorare', daLavorare.length, 'Tutte lavorate.',
    daLavorare.length + ' ancora in arrivo, scansionate o in lavorazione: chiudile o segna la rinuncia.', "fineAnnoChiudi(); oggiVaiRegistro('aperte')");
  const nonRitirate = typeof praticheDaSollecitare === 'function' ? praticheDaSollecitare(anno) : [];
  voce('📦', 'Pratiche pronte non ritirate', nonRitirate.length, 'Tutte consegnate.',
    nonRitirate.length + ' pronte e non ancora ritirate: manda il sollecito.', 'fineAnnoChiudi(); apriSollecitoRitiro(' + anno + ')', '🔔 Sollecito');
  const nonPagate = typeof morosiAnno === 'function' ? morosiAnno(anno) : [];
  voce('💸', 'Pratiche non pagate del ' + anno, nonPagate.length, 'Nessuna pratica da incassare.',
    nonPagate.length + ' consegnate e non pagate del tutto: sollecita o segna «Non paga».', 'fineAnnoChiudi(); oggiVaiMorosi()');
  const daFatturare = pratAnno.filter(function (p) { return p.stato === 'lavorata_da_fatturare'; });
  voce('🧾', 'Pratiche da fatturare', daFatturare.length, 'Nessuna fattura in sospeso.',
    daFatturare.length + ' in «Lavorata da fatturare»: emetti le fatture entro il 31/12.', "fineAnnoChiudi(); oggiVaiStato('lavorata_da_fatturare')");
  const colf = typeof colfDaTrasferire === 'function' ? colfDaTrasferire(anno) : [];
  voce('👷', 'Contratti colf e badanti da portare nel ' + nuovo, colf.length, 'Nessun contratto da trasferire.',
    colf.length + ' contratti attivi del ' + anno + ' da far continuare nel ' + nuovo + ' (stesso protocollo).', 'fineAnnoChiudi(); apriTrasferimentoColf(' + anno + ')', '➡️ Trasferisci');
  const docDaAvvisare = typeof clientiDocumentoDaRinnovare === 'function' ? clientiDocumentoDaRinnovare().filter(function (r) { return !(typeof avvisoDocumentoInviato === 'function' && avvisoDocumentoInviato(r.c)); }) : [];
  voce('🪪', 'Documenti scaduti o in scadenza da chiedere', docDaAvvisare.length, 'Tutti i clienti con il documento da rinnovare sono stati avvisati.',
    docDaAvvisare.length + ' clienti da avvisare: meglio farlo prima della campagna, così portano il documento nuovo.', 'fineAnnoChiudi(); apriDocumentiInScadenza()');
  const sospetti = typeof datiSospettiCliente === 'function' ? (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).filter(function (c) { return !c.decedutoIl && datiSospettiCliente(c).length; }) : [];
  voce('⚠️', 'Dati da controllare in archivio', sospetti.length, 'Nessuna scadenza con l\'anno sbagliato e nessun cellulare incompleto.',
    sospetti.length + ' clienti con una scadenza dall\'anno sbagliato o un cellulare con cifre mancanti.', "fineAnnoChiudi(); apriArchivioClienti('', { sospetti: true })");
  const mancaCaf = [['caf_indirizzo', 'indirizzo'], ['caf_telefono', 'telefono'], ['caf_orari', 'orari']].filter(function (x) { return !String(IMPOSTAZIONI[x[0]] || '').trim(); }).map(function (x) { return x[1]; });
  voce('📞', 'Dati del CAF nei messaggi ai clienti', mancaCaf.length, 'Indirizzo, telefono e orari ci sono: controlla solo che gli orari del ' + nuovo + ' siano giusti.',
    'Mancano: ' + mancaCaf.join(', ') + '. Senza, i messaggi ai clienti non li riportano.', "fineAnnoChiudi(); oggiTab('messaggi')");
  const ultimaMail = Date.parse(IMPOSTAZIONI.backup_email_ultimo || '') || 0;
  voce('📧', 'Copia di sicurezza settimanale per e-mail', Date.now() - ultimaMail > 8 * 86400000 ? 1 : 0,
    'Ultima copia per e-mail: ' + new Date(ultimaMail).toLocaleDateString('it-IT') + '.',
    ultimaMail ? 'L\'ultima copia per e-mail è del ' + new Date(ultimaMail).toLocaleDateString('it-IT') + ': quella automatica del lunedì non sta partendo (controlla le attività automatiche su Vercel). Intanto mandala a mano.' : 'Nessuna copia per e-mail ancora partita: controlla le attività automatiche su Vercel. Intanto mandala a mano.',
    'inviaBackupEmailOra(this)', '📧 Manda ora');
  // anni con più di 5 anni: li propone, li cancella solo l'amministratore
  if (typeof voceAnniVecchi === 'function') voci.push(voceAnniVecchi(anno));
  return voci;
}
// Voci che chiedono dati al server: ultima copia di sicurezza e utenti
async function vociFineAnnoServer() {
  const voci = [];
  try {
    const r = await fetchSupabase('/rest/v1/backup_automatici?select=creato_il&order=creato_il.desc&limit=1', 'GET');
    const ultimo = r && r.ok && r.data && r.data[0] ? Date.parse(r.data[0].creato_il) : 0;
    const vecchio = !ultimo || Date.now() - ultimo > 2 * 86400000;
    voci.push({ icona: '💾', titolo: 'Copia di sicurezza nel programma', ok: !vecchio,
      testo: (ultimo ? 'Ultima copia: ' + new Date(ultimo).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + '. ' : 'Nessuna copia trovata. ')
        + (vecchio ? 'La copia automatica di ogni notte non risulta: fanne una adesso.' : 'Ogni notte se ne fa una; il 31/12 il programma salva anche la copia di fine anno, conservata per sempre.'),
      azione: vecchio ? 'creaBackupOra()' : '', testoAzione: '💾 Fai una copia adesso' });
  } catch (e) {}
  try {
    const [profili, login] = await Promise.all([typeof caricaTuttiProfili === 'function' ? caricaTuttiProfili() : [], supabase.rpc('ultimi_accessi').then(function (r) { return r; }, function () { return {}; })]);
    if (!Array.isArray(profili) || !profili.length) return voci;
    const ultimo = {}; ((login && login.data) || []).forEach(function (x) { ultimo[x.id] = Date.parse(x.ultimo_login) || 0; });
    const limite = Date.now() - 90 * 86400000;
    const fermi = (profili || []).filter(function (u) { return u.id !== (auth.profilo && auth.profilo.id) && (ultimo[u.id] || 0) < limite; });
    const admin = (profili || []).filter(function (u) { return u.ruolo === 'admin'; });
    voci.push({ icona: '👥', titolo: 'Utenti del programma', ok: !fermi.length,
      testo: (profili || []).length + ' utenti, di cui ' + admin.length + ' amministratori (' + admin.map(function (u) { return u.nome; }).join(', ') + '). '
        + (fermi.length ? 'Non entrano da più di 3 mesi: ' + fermi.map(function (u) { return u.nome; }).join(', ') + '. Se non lavorano più al CAF, togli il loro accesso.' : 'Tutti hanno usato il programma negli ultimi 3 mesi.'),
      azione: fermi.length ? "fineAnnoChiudi(); oggiTab('permessi')" : '', testoAzione: 'Utenti e permessi' });
  } catch (e) {}
  try { const v = typeof voceSpazioFineAnno === 'function' ? await voceSpazioFineAnno() : null; if (v) voci.push(v); } catch (e) {}
  return voci;
}

function rigaVoceFineAnno(v) {
  return '<div style="display:flex; gap:10px; align-items:flex-start; padding:9px 4px; border-bottom:1px solid var(--line)">'
    + '<span style="font-size:20px; flex:none">' + (v.ok ? '✅' : v.icona) + '</span>'
    + '<span style="flex:1; min-width:0"><b style="color:' + (v.ok ? '#1a7f37' : '#b35f0c') + '">' + esc(v.titolo) + '</b><div style="font-size:12.5px; color:var(--sub)">' + esc(v.testo) + '</div></span>'
    + (v.azione ? '<button type="button" onclick="' + esc(v.azione) + '" style="flex:none; background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:6px 12px; font-size:12.5px; font-weight:800; cursor:pointer; white-space:nowrap">' + esc(v.testoAzione) + '</button>' : '')
    + '</div>';
}
async function apriControlloFineAnno(anno) {
  anno = anno || annoDaChiudere();
  const nuovo = anno + 1;
  fineAnnoChiudi();
  const ov = document.createElement('div');
  ov.id = 'popup-fine-anno';
  ov.style.cssText = 'position:fixed; inset:0; z-index:458; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:10px';
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-chiudi]')) fineAnnoChiudi(); });
  const disegna = function (server) {
    const voci = vociFineAnno(anno).concat(server || []);
    const daFare = voci.filter(function (v) { return !v.ok; }).length;
    ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:14px; border-top:6px solid #1d4f91; max-width:760px; width:100%; max-height:92vh; overflow:auto; padding:14px 16px; box-shadow:0 10px 40px rgba(0,0,0,.3)">'
      + '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px"><b style="font-size:18px; color:#1d4f91">🧹 Pronti per il ' + nuovo + '?</b>'
      + '<button type="button" data-chiudi style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:6px 12px; cursor:pointer">✕</button></div>'
      + '<div style="font-size:13px; margin:4px 0 8px">' + (daFare ? '<b style="color:#b35f0c">' + daFare + (daFare === 1 ? ' cosa da sistemare' : ' cose da sistemare') + '</b>' : '<b style="color:#1a7f37">Tutto a posto: si può partire.</b>')
      + ' · Il programma non cancella e non cambia niente da solo: ogni tasto apre la pagina dove decidi tu.</div>'
      + '<div style="padding:8px 10px; border-radius:10px; background:color-mix(in srgb, #1d4f91 8%, var(--card)); font-size:12.5px; margin-bottom:6px">🔢 Dal <b>1° gennaio ' + nuovo + '</b> la numerazione riparte da sola: le nuove pratiche saranno <b>730-0001/' + nuovo + '</b> e <b>AP-0001/' + nuovo + '</b>. Le pratiche del ' + anno + ' restano consultabili scegliendo l\'anno in alto.</div>'
      + voci.map(rigaVoceFineAnno).join('')
      + (server ? '' : '<div class="sub2" style="padding:8px 4px">⏳ Controllo copie di sicurezza e utenti…</div>')
      + '</div>';
  };
  document.body.appendChild(ov);
  disegna(null);
  const server = await vociFineAnnoServer();
  if (document.getElementById('popup-fine-anno') === ov) disegna(server);
}
function fineAnnoChiudi() { const v = document.getElementById('popup-fine-anno'); if (v) v.remove(); }
// porta a «Cancella un solo anno» in Utenti e permessi con l'anno già scelto
function fineAnnoVaiCancellaAnno(anno) {
  fineAnnoChiudi();
  if (typeof oggiTab === 'function' && !oggiTab('permessi')) return;
  setTimeout(function () {
    const sel = document.getElementById('sva-anno');
    if (sel) { if (![].some.call(sel.options, function (o) { return o.value === String(anno); })) sel.add(new Option(String(anno), String(anno))); sel.value = String(anno); sel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, 150);
}
// Riquadro nella pagina Oggi: solo per l'amministratore, dal 15 dicembre al 31 gennaio
function tileFineAnno(tile) {
  if (!periodoFineAnno() || !(typeof isAdmin === 'function' && isAdmin())) return '';
  const anno = annoDaChiudere(), daFare = vociFineAnno(anno).filter(function (v) { return !v.ok; }).length;
  return tile('🧹', daFare, 'Pronti per il ' + (anno + 1) + '?', daFare ? '#b35f0c' : '#1a7f37', 'apriControlloFineAnno()', daFare ? 'cose da sistemare prima del nuovo anno' : 'tutto a posto');
}
