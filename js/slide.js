/* ---------------- Guide a slide: guida dell'operatore e guida dell'amministratore ---------------- */
// Ogni slide: titolo, icona, frase introduttiva, passi numerati, e un piccolo "disegno" dei tasti da premere.

function tastoFinto(testo, colore, chiaro) {
  return '<span style="display:inline-block; padding:6px 12px; border-radius:999px; font-weight:800; font-size:13px; margin:3px 4px 3px 0; '
    + (chiaro ? 'background:' + colore + '22; color:' + colore + '; border:1.5px solid ' + colore + '66' : 'background:' + colore + '; color:#fff') + '">' + testo + '</span>';
}
function riquadroFinto(valore, etichetta, colore) {
  return '<span style="display:inline-flex; flex-direction:column; align-items:center; min-width:96px; padding:8px 10px; border-radius:10px; margin:3px; background:' + colore + '; color:#fff"><b style="font-size:16px">' + valore + '</b><span style="font-size:10px; font-weight:700; text-transform:uppercase">' + etichetta + '</span></span>';
}

const SLIDE_OPERATORE = [
  { icona: '👋', titolo: 'Benvenuto nel Protocollo CAF CISL Alì Terme', intro: 'Questa guida a slide ti accompagna passo passo nelle operazioni di tutti i giorni. Usa le frecce ◀ ▶ (o la tastiera) per andare avanti e indietro.',
    passi: ['Accedi con la tua e-mail e la tua password.', 'In alto trovi il <b>menu colorato</b>: ogni tasto apre una sezione.', 'Il tasto <b>📖 GUIDA DEL PROGRAMMA</b> apre anche la guida completa con la ricerca.'],
    disegno: tastoFinto('INSERIMENTO ANAGRAFICA', '#1d4f91', true) + tastoFinto('REGISTRO DI PROTOCOLLO', '#2f9e5f', true) + tastoFinto('CONTABILITA\'', '#8e5bd6', true) + tastoFinto('SCADENZE', '#c0392b', true) },
  { icona: '✍️', titolo: 'Inserire una nuova pratica', intro: 'Tutto parte dalla sezione INSERIMENTO ANAGRAFICA.',
    passi: ['Scrivi <b>cognome, nome, data di nascita</b> e <b>codice fiscale</b> (obbligatorio).', 'Scegli il <b>tipo di pratica</b> (730 SEDE, IMU, ISEE…) e lo <b>stato</b>.', 'Spunta i <b>documenti presentati</b>: quelli mancanti tengono la pratica "In arrivo".', 'Scrivi fattura e pagato, scegli il <b>pagamento</b> (contanti, POS, bonifico) e premi <b>Salva</b>.'],
    disegno: tastoFinto('📄 Leggi documento', '#2f7de1') + tastoFinto('💾 Salva pratica', '#2f9e5f') },
  { icona: '📄', titolo: 'Leggere i dati dal documento', intro: 'Non serve scrivere tutto a mano.',
    passi: ['Premi <b>📄 Leggi documento</b> e fotografa o carica la carta d\'identità o la tessera sanitaria (anche in PDF).', 'Il programma compila nome, data di nascita, codice fiscale e scadenza del documento.', 'Controlla sempre i dati letti prima di salvare.'],
    disegno: tastoFinto('📷 Foto', '#1d4f91') + tastoFinto('📎 Carica file / PDF', '#1d4f91', true) },
  { icona: '⚠️', titolo: 'Clienti che devono ancora pagare', intro: 'Quando scrivi il nome di un cliente, sotto compare il suo storico.',
    passi: ['Se ha pratiche degli anni precedenti non pagate, compare un <b>riquadro rosso</b> "Deve ancora pagare…".', 'Se paga subito premi <b>✓ Pagato</b>: il pagamento va nella pratica dell\'anno giusto.', 'Altrimenti inserisci la nuova pratica: il debito resta nel Tabulato morosi.'],
    disegno: '<div style="padding:10px 12px; border-radius:10px; background:#fdecea; border:2px solid #c0392b; color:#7f1d1d; font-weight:800">⚠️ Deve ancora pagare 40,00 € ' + tastoFinto('✓ Pagato', '#2f9e5f') + '</div>' },
  { icona: '📒', titolo: 'Il Registro di protocollo', intro: 'Qui trovi tutte le pratiche dell\'anno, con due numerazioni separate.',
    passi: ['<b>📘 Registro 730</b>: protocolli 730-0001, 730-0002…', '<b>📗 Registro altre pratiche</b>: protocolli AP-0001, AP-0002…', 'Cerca per nome, numero o tipo nella barra di ricerca; filtra per stato.', 'Cambia lo <b>stato</b> direttamente dal menu a tendina della riga.'],
    disegno: tastoFinto('730-0001/2027', '#1d4f91') + tastoFinto('AP-0001/2027', '#6b7280') },
  { icona: '🧩', titolo: 'Le pratiche divise per collaboratore', intro: 'Sotto il registro le pratiche sono raggruppate per tipo e collaboratore.',
    passi: ['Clicca sulla barra colorata (es. 730 RICCA AGATINO) per aprirla.', 'Vedi la sua <b>contabilità</b>, l\'elenco delle pratiche e le schede complete.', '<b>🖨️ Stampa</b> stampa solo le pratiche di quel collaboratore.'],
    disegno: '<div style="display:inline-block; padding:10px 14px; border-radius:12px; background:#1f8a70; color:#fff; font-weight:800">▸ 730 RICCA AGATINO <span style="background:rgba(255,255,255,.3); border-radius:999px; padding:1px 8px">12</span><div style="font-size:11px; font-weight:600">Fatture 360,00 € · Incasso 300,00 €</div></div>' },
  { icona: '✏️', titolo: 'Modificare o annullare una pratica', intro: 'Apri la scheda della pratica dal Registro.',
    passi: ['<b>Modifica</b>: correggi i dati e premi Salva modifica.', '<b>🚫 Annulla</b>: la pratica resta nel registro barrata, con il motivo; il numero non si riusa.', 'In ogni pratica vedi chi l\'ha inserita e chi l\'ha modificata per ultimo.'],
    disegno: tastoFinto('✏️ Modifica', '#1d4f91') + tastoFinto('🚫 Annulla', '#c0392b', true) + tastoFinto('🧾 Ricevuta', '#374151', true) },
  { icona: '💬', titolo: 'Avvisare il cliente', intro: 'Dalla pratica puoi contattare il cliente in un attimo.',
    passi: ['<b>💬 WhatsApp</b>: messaggio già pronto (pratica pronta, documenti mancanti…).', '<b>📧 E-mail</b>: parte dalla casella del CAF.', '<b>🧾 Ricevuta</b>: da stampare o da mandare al cliente.'],
    disegno: tastoFinto('💬 WhatsApp', '#25d366') + tastoFinto('📧 E-mail', '#2f7de1') + tastoFinto('🧾 Ricevuta', '#374151') },
  { icona: '🏷️', titolo: 'Gli stati delle pratiche', intro: 'Il colore dice a che punto è la pratica.',
    passi: ['⚪ <b>In arrivo</b> → 🟡 <b>In lavorazione</b> → 🔵 <b>Lavorata</b> → 🟢 <b>Pagato</b>.', 'Con documenti mancanti la pratica resta "In arrivo".', 'Per colf e badanti: 🟢 Pratica attiva e ⚫ Pratica cessata.'],
    disegno: tastoFinto('⚪ In arrivo', '#8a8f98') + tastoFinto('🟡 In lavorazione', '#c99a00') + tastoFinto('🔵 Lavorata', '#2f7de1') + tastoFinto('🟢 Pagato', '#2f9e5f') },
  { icona: '💸', titolo: 'Il Tabulato morosi', intro: 'In cima al Registro, la barra rossa elenca chi deve ancora pagare l\'anno precedente.',
    passi: ['Aprila e cerca il cliente.', 'Quando paga premi <b>✓ Pagato</b> e scegli il tipo di pagamento.', 'Dal menu <b>Anno</b> puoi vedere anche gli anni più vecchi o <b>Tutti gli anni</b>.'],
    disegno: '<div style="display:inline-block; padding:10px 14px; border-radius:12px; background:#c0392b; color:#fff; font-weight:800">💸 TABULATO MOROSI 2026 · Da pagare 130,00 €</div>' },
  { icona: '⏰', titolo: 'Scadenze e colf e badanti', intro: 'Il calendario delle scadenze ti avvisa per tempo.',
    passi: ['Per colf e badanti scrivi la <b>scadenza dell\'assistenza</b>: va nel calendario con avviso 15 giorni prima.', 'Dalla scadenza: <b>Rinnova</b>, <b>Non rinnova</b> o <b>💬 Avvisa</b> il cliente.', 'A inizio anno: <b>➡️ Trasferisci</b> le pratiche attive nel nuovo anno.'],
    disegno: tastoFinto('🔄 Rinnova', '#2f9e5f') + tastoFinto('Non rinnova', '#6b7280', true) + tastoFinto('💬 Avvisa', '#25d366') },
  { icona: '🖨️', titolo: 'Stampe ed Excel', intro: 'Ogni elenco si può stampare o salvare.',
    passi: ['Nel Registro: <b>🖨️ Stampa registro</b> con i filtri (periodo, tipo, stato, pagamento).', 'Si può salvare in <b>PDF</b> dalla finestra di stampa o scaricare in <b>Excel</b>.', 'Anche il tabulato morosi e ogni collaboratore hanno la loro stampa.'],
    disegno: tastoFinto('🖨️ Stampa registro', '#1d4f91') + tastoFinto('⬇️ Excel', '#2f9e5f', true) },
  { icona: '📂', titolo: 'Modulistica', intro: 'I moduli più usati sempre a portata di mano.',
    passi: ['Apri <b>MODULISTICA</b> dal menu.', 'Scarica, compila e stampa il modulo che ti serve.'],
    disegno: tastoFinto('MODULISTICA', '#b35f0c', true) },
  { icona: '✅', titolo: 'Buon lavoro!', intro: 'Hai visto le operazioni principali.',
    passi: ['Per qualsiasi dubbio apri <b>📖 GUIDA DEL PROGRAMMA</b> e cerca una parola (es. "CUD", "ricevuta").', 'Se compare la scritta <b>🔄 È disponibile una nuova versione</b>, premila per aggiornare.'],
    disegno: tastoFinto('📖 GUIDA DEL PROGRAMMA', '#1d4f91') }
];

const SLIDE_AMMINISTRATORE = [
  { icona: '🔐', titolo: 'Guida dell\'amministratore', intro: 'Questa guida la vede solo l\'amministratore: spiega le funzioni riservate.',
    passi: ['Tutte le impostazioni si trovano nel tasto <b>UTENTI E PERMESSI</b> del menu.', 'Le modifiche valgono per tutti gli utenti.'],
    disegno: tastoFinto('UTENTI E PERMESSI', '#4b5563') },
  { icona: '👥', titolo: 'Creare un nuovo utente', intro: 'Nel riquadro "Nuovo utente".',
    passi: ['Scrivi nome, e-mail e password (almeno 6 caratteri).', 'Scegli il <b>ruolo</b>: Operatore, Sola consultazione o Amministratore.', 'Premi <b>+ Crea utente</b> e mandagli l\'accesso con 💬 WhatsApp o 📧 e-mail.'],
    disegno: tastoFinto('+ Crea utente', '#1d4f91') + tastoFinto('💬 Invia accesso', '#25d366') },
  { icona: '🟢', titolo: 'Chi è collegato', intro: 'In cima a Utenti e permessi.',
    passi: ['Per ogni utente vedi se è <b>🟢 collegato adesso</b> e da quanto tempo.', 'L\'<b>ultimo collegamento</b>: data, ora e "x min fa", con il dispositivo (💻 o 📱).', '<b>📋 Ultimi accessi</b>: gli ultimi 30 collegamenti con entrata e durata.'],
    disegno: '<b style="color:#2f9e5f">🟢 Collegato</b> · FEDERICA · 💻 Windows &nbsp;&nbsp; <span style="color:#6b7280">⚪ MARCO · ultimo collegamento 1 giorno fa</span>' },
  { icona: '🧑‍💼', titolo: 'Permessi di ogni utente', intro: 'In "Utenti e permessi" ogni utente ha la sua scheda.',
    passi: ['Spunta le <b>sezioni visibili</b> (Registro, Contabilità, Scadenze…).', 'Nella Contabilità scegli quali parti vede; il <b>🔒 Guadagno netto</b> solo se autorizzato.', 'Puoi cambiare ruolo, password o eliminare l\'utente.'],
    disegno: '<span class="chk" style="display:inline-flex; gap:6px; align-items:center">☑ Registro ☑ Contabilità ☐ 🔒 Guadagno netto</span>' },
  { icona: '🏷️', titolo: 'Tipi di pratica', intro: 'Riquadro "Tipi di pratica ed etichette".',
    passi: ['<b>Aggiungi</b>, <b>rinomina</b>, <b>riordina</b> (↑ ↓) o <b>elimina</b> (✕) un tipo.', 'Scegli il <b>colore</b>, se ha <b>€ Fatture e incasso</b> e il <b>💰 Tasto Acconto</b>.', '<b>🏷️ Stati</b>: quali stati si usano per quel tipo e lo <b>⭐ stato all\'apertura</b>.', 'Alla fine premi <b>💾 Salva tipi di pratica</b>.'],
    disegno: tastoFinto('🏷️ Stati (6) ⭐ Pratica attiva', '#1f8a70', true) + tastoFinto('💾 Salva tipi di pratica', '#2f9e5f') },
  { icona: '🎨', titolo: 'Etichette del menu e stati', intro: 'Puoi personalizzare nomi e colori.',
    passi: ['<b>Etichette del menu</b>: nome e colore di ogni tasto in alto.', '<b>Stati delle pratiche</b>: nome, colore e pallino; con <b>+ Aggiungi stato</b> ne crei di nuovi.', '<b>↺ Originale</b> riporta tutto come era.'],
    disegno: tastoFinto('↺ Originale', '#374151', true) + tastoFinto('+ Aggiungi stato', '#1d4f91') },
  { icona: '💰', titolo: 'Collaboratori: acconti e morosi', intro: 'Nel Registro, dentro il riquadro di ogni collaboratore.',
    passi: ['<b>+ 💰 Acconto</b>: registra i soldi che il collaboratore ti versa (Pagamenti effettuati).', '<b>Da incassare</b> = incasso − pagamenti effettuati.', '<b>✓ Togli dai morosi</b>: le pratiche regolate col collaboratore escono dal tabulato, senza cambiare i conti.'],
    disegno: riquadroFinto('300,00 €', 'Incasso', '#8e5bd6') + riquadroFinto('250,00 €', 'Pagamenti effettuati', '#0e7c86') + riquadroFinto('50,00 €', 'Da incassare', '#c0392b') },
  { icona: '📊', titolo: 'Contabilità e guadagno netto', intro: 'La sezione CONTABILITA\' riassume l\'anno.',
    passi: ['Fatture emesse, incasso, <b>versamenti CAF</b> e netto.', '<b>Guadagno netto</b> = incasso − versamenti CAF − fatture − spese sede.', 'Blocchi <b>SOLO 730</b> e <b>ALTRE PRATICHE</b>; ricerca fatture per periodo e pagamento.'],
    disegno: riquadroFinto('5.000 €', 'Incasso', '#8e5bd6') + riquadroFinto('1.200 €', 'Versamenti CAF', '#2f7de1') + riquadroFinto('900 €', 'Guadagno netto', '#374151') },
  { icona: '🏢', titolo: 'Spese sede e versamenti CAF', intro: 'Le uscite della sede.',
    passi: ['<b>VERSAMENTI CAF</b>: la data si compila da sola con oggi.', '<b>SPESE GESTIONE SEDE</b>: TARI, acqua, luce… con i passaggi e la conferma "in contabilità".', '<b>Prelevati Angelo</b>: elenco da spuntare quando vengono restituiti.'],
    disegno: tastoFinto('VERSAMENTI CAF', '#2f7de1', true) + tastoFinto('SPESE SEDE', '#a0522d', true) },
  { icona: '🛟', titolo: 'Backup e fine anno', intro: 'In fondo a "Utenti e permessi".',
    passi: ['Il programma fa <b>backup automatici</b>, anche il 31 dicembre ("salvataggi anno").', 'Puoi scaricare il backup o il registro in Excel quando vuoi.', 'La <b>cancellazione per anno</b> chiede una conferma scritta: fai prima il salvataggio.', 'Se un anno si svuota del tutto, la numerazione riparte da 1.'],
    disegno: tastoFinto('⬇️ Esporta Backup', '#1d4f91') + tastoFinto('🗑️ Svuota anno', '#c0392b', true) },
  { icona: '📅', titolo: 'Il passaggio al nuovo anno', intro: 'Cosa succede il 1° gennaio.',
    passi: ['L\'<b>anno di protocollo</b> passa da solo al nuovo anno: i numeri ripartono da 0001.', 'Il <b>Tabulato morosi</b> mostra l\'anno appena finito.', 'Un avviso verde ricorda di <b>➡️ trasferire</b> le colf e badanti attive.'],
    disegno: tastoFinto('➡️ Trasferisci nel 2028', '#1f8a70') + tastoFinto('💸 Morosi 2027', '#c0392b') }
];

let SLIDE_ATTUALI = null, SLIDE_INDICE = 0, SLIDE_TITOLO = '';

function apriSlide(quale) {
  if (quale === 'admin' && !(auth.profilo && auth.profilo.ruolo === 'admin')) { avviso('❌ Guida riservata all\'amministratore', true); return; }
  SLIDE_ATTUALI = quale === 'admin' ? SLIDE_AMMINISTRATORE : SLIDE_OPERATORE;
  SLIDE_TITOLO = quale === 'admin' ? '🔐 Guida amministratore' : '🎞️ Guida a slide';
  SLIDE_INDICE = 0;
  if (typeof chiudiGuida === 'function') chiudiGuida();
  let ov = document.getElementById('slide-guida');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'slide-guida';
  ov.style.cssText = 'position:fixed; inset:0; z-index:520; background:rgba(15,27,45,.6); display:flex; align-items:center; justify-content:center; padding:12px';
  ov.addEventListener('click', function (e) { if (e.target === ov) chiudiSlide(); });
  let x0 = null;
  ov.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  ov.addEventListener('touchend', function (e) { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) vaiSlide(dx < 0 ? 1 : -1); x0 = null; });
  document.body.appendChild(ov);
  disegnaSlide();
}
function chiudiSlide() { const ov = document.getElementById('slide-guida'); if (ov) ov.remove(); }
function vaiSlide(d) {
  if (!SLIDE_ATTUALI) return;
  SLIDE_INDICE = Math.max(0, Math.min(SLIDE_ATTUALI.length - 1, SLIDE_INDICE + d));
  disegnaSlide();
}
function disegnaSlide() {
  const ov = document.getElementById('slide-guida');
  if (!ov) return;
  const s = SLIDE_ATTUALI[SLIDE_INDICE], n = SLIDE_ATTUALI.length, admin = SLIDE_ATTUALI === SLIDE_AMMINISTRATORE;
  const colore = admin ? '#4b5563' : '#1d4f91';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:20px; max-width:820px; width:100%; min-height:min(560px, 90vh); max-height:94vh; display:flex; flex-direction:column; box-shadow:0 24px 60px rgba(0,0,0,.4); overflow:hidden">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:12px 16px; background:linear-gradient(90deg,' + colore + ',' + (admin ? '#111827' : '#00612f') + '); color:#fff">'
    + '<b style="font-size:15px">' + SLIDE_TITOLO + ' · ' + (SLIDE_INDICE + 1) + ' di ' + n + '</b>'
    + '<button type="button" onclick="chiudiSlide()" style="background:rgba(255,255,255,.18); color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:700; cursor:pointer">Chiudi ✕</button></div>'
    + '<div style="flex:1; overflow:auto; padding:22px 28px">'
    + '<div style="font-size:54px; line-height:1">' + s.icona + '</div>'
    + '<div style="font-size:26px; font-weight:900; color:' + colore + '; margin:8px 0 6px">' + s.titolo + '</div>'
    + '<div style="font-size:16px; color:var(--sub); margin-bottom:14px">' + s.intro + '</div>'
    + '<ol style="font-size:17px; line-height:1.6; padding-left:24px; margin:0 0 16px">' + s.passi.map(function (p) { return '<li style="margin-bottom:6px">' + p + '</li>'; }).join('') + '</ol>'
    + (s.disegno ? '<div style="padding:14px; border-radius:14px; background:var(--bg, #f3f6fa); border:1px dashed var(--line)"><div style="font-size:11px; color:var(--sub); font-weight:700; margin-bottom:6px">COSÌ LO VEDI NEL PROGRAMMA</div>' + s.disegno + '</div>' : '')
    + '</div>'
    + '<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 16px; border-top:1px solid var(--line)">'
    + '<button type="button" onclick="vaiSlide(-1)" ' + (SLIDE_INDICE === 0 ? 'disabled style="opacity:.4"' : '') + ' style="padding:10px 18px; border-radius:999px; font-weight:800">◀ Indietro</button>'
    + '<span style="display:flex; gap:6px; flex-wrap:wrap; justify-content:center">' + SLIDE_ATTUALI.map(function (x, i) { return '<span onclick="SLIDE_INDICE=' + i + '; disegnaSlide()" title="' + esc(x.titolo) + '" style="width:10px; height:10px; border-radius:50%; cursor:pointer; background:' + (i === SLIDE_INDICE ? colore : 'var(--line)') + '"></span>'; }).join('') + '</span>'
    + (SLIDE_INDICE === n - 1
      ? '<button type="button" onclick="chiudiSlide()" style="padding:10px 18px; border-radius:999px; font-weight:800; background:#2f9e5f; color:#fff; border:none">Fine ✓</button>'
      : '<button type="button" onclick="vaiSlide(1)" style="padding:10px 18px; border-radius:999px; font-weight:800; background:' + colore + '; color:#fff; border:none">Avanti ▶</button>')
    + '</div></div>';
}
document.addEventListener('keydown', function (e) {
  if (!document.getElementById('slide-guida')) return;
  if (e.key === 'ArrowRight') vaiSlide(1);
  else if (e.key === 'ArrowLeft') vaiSlide(-1);
  else if (e.key === 'Escape') chiudiSlide();
});
