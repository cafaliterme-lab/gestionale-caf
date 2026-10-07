/**
 * Guida del programma: si apre dal pulsante "📖 GUIDA DEL PROGRAMMA" in alto.
 * Ogni capitolo ha titolo, parole chiave e testo; la lente cerca in tutto e evidenzia le parole trovate.
 */
const GUIDA = [
  { id: 'inizio', icona: '🚀', titolo: 'Primi passi: accesso e schermata principale', parole: 'login accesso password entrare utente esci cambia utente anno protocollo menu orologio qr',
    testo: `
<p>Il programma si apre dal browser (consigliati <b>Chrome</b> o <b>Edge</b>) all'indirizzo <b>gestionale-caf.vercel.app</b>, oppure dall'icona <b>CAF CISL</b> se l'hai installato come app.</p>
<ol>
<li>Inserisci <b>e-mail</b> e <b>password</b> che ti ha dato l'amministratore e premi <b>Accedi</b>.</li>
<li>In alto trovi il logo, i <b>dati del CAF</b>, la <b>data e l'ora</b>, il <b>QR</b> per installare l'app sul telefono e i <b>contatori</b> delle pratiche 730.</li>
<li>Sotto c'è <b>Anno di protocollo</b>: sceglie l'anno che vedi nel Registro, in Contabilità e nei Grafici. Il numero di una pratica nuova dipende invece dal giorno in cui la inserisci.</li>
<li>Il <b>menu</b> colorato porta alle varie sezioni: Inserimento anagrafica, Registro di protocollo, Contabilità, Grafici, Versamenti CAF, Spese sede, Collaboratori, Scadenze, Messaggi, Modulistica, Utenti e permessi (solo amministratore).</li>
<li>In alto a destra: <b>📲 Installa app</b>, <b>📖 Guida</b>, <b>Cambia utente</b> e <b>🚪 Esci dal programma</b>.</li>
</ol>
<p class="g-nota">I dati sono salvati online: quello che inserisce un operatore lo vedono subito anche gli altri, su PC e telefono. Il programma si aggiorna da solo ogni pochi secondi.</p>` },

  { id: 'contatori', icona: '🔢', titolo: 'I contatori in alto', parole: 'contatori totale pratiche lavorate da lavorare operatore congiunta vale 2 730 rinuncia',
    testo: `
<p>I riquadri colorati in alto contano <b>solo le pratiche 730</b> (di tutti i tipi 730) dell'anno scelto:</p>
<ul>
<li><b>TOTALE PRATICHE</b>: tutte le pratiche 730.</li>
<li><b>Da lavorare</b>: quelle In arrivo, In lavorazione o Da lavorare scansionata.</li>
<li><b>Lavorate</b>: tutte le altre, tranne la rinuncia alla compilazione.</li>
<li>Un contatore per ogni <b>operatore</b> con le pratiche lavorate inserite da lui.</li>
</ul>
<p class="g-nota">Una dichiarazione <b>congiunta vale 2</b> pratiche in tutti i conteggi.</p>` },

  { id: 'inserimento', icona: '✍️', titolo: 'Inserire una nuova pratica (Inserimento anagrafica)', parole: 'nuova pratica inserire anagrafica cliente cognome nome data nascita salva pratica tipo pratica etichetta stato note',
    testo: `
<ol>
<li>Vai su <b>INSERIMENTO ANAGRAFICA</b>.</li>
<li>Se il cliente è già venuto, scrivi il cognome in <b>"Cerca cliente nell'archivio"</b> e sceglilo: i dati si compilano da soli (data di nascita, codice fiscale, telefoni, e-mail, scadenza documento). Sotto compare lo <b>storico delle sue pratiche</b>.</li>
<li>Altrimenti scrivi <b>Cognome</b>, <b>Nome</b>, <b>Data di nascita</b> e <b>Codice fiscale</b>, oppure usa <b>📄 Leggi documento</b>.</li>
<li>Scegli il <b>Tipo pratica</b> dal menu a tendina colorato.</li>
<li>Scrivi <b>Fattura</b>, <b>Pagato effettivo</b> e il tipo di <b>Pagamento</b> (predefinito CONTANTI).</li>
<li>Scegli l'<b>Etichetta</b> (lo stato della pratica, di solito "In arrivo").</li>
<li>Inserisci almeno un <b>telefono</b> (cellulare o fisso) e, se vuoi, l'<b>e-mail</b>.</li>
<li>Segna la <b>documentazione</b> presentata o mancante.</li>
<li>Premi <b>💾 Salva pratica</b>: compare la conferma con il <b>numero di protocollo</b> assegnato.</li>
</ol>
<p>Se il cliente non è in archivio compare la finestra <b>"Nuovo Contribuente – Inserisco in Anagrafica"</b>: confermando, viene salvato anche nell'archivio clienti per le volte successive.</p>
<p class="g-nota">Il programma non accetta un <b>doppione</b>: lo stesso cliente non può avere due pratiche dello stesso tipo nello stesso anno.</p>` },

  { id: 'obbligatori', icona: '❗', titolo: 'Campi obbligatori e controlli', parole: 'obbligatorio codice fiscale errore non valido coniuge telefono email errore finestra rossa',
    testo: `
<p>La pratica <b>non si salva</b> e compare una finestra rossa di errore se manca o è sbagliato:</p>
<ul>
<li>il <b>cognome</b> del contribuente;</li>
<li>il <b>codice fiscale</b> del contribuente (16 caratteri, viene controllato che sia corretto);</li>
<li>il <b>codice fiscale del coniuge</b>, se la dichiarazione è <b>congiunta</b>;</li>
<li>almeno un <b>telefono</b>, cellulare o fisso;</li>
<li>l'<b>e-mail</b>, solo se la scrivi ma non è valida (es. manca la @ o il dominio).</li>
</ul>
<p>Premendo <b>OK</b> il campo da correggere diventa rosso e il cursore ci va sopra.</p>` },

  { id: 'ocr', icona: '📄', titolo: 'Leggere i dati da un documento (OCR)', parole: 'leggi documento ocr carta identita cie tessera sanitaria patente fotocamera scansione codice fiscale scadenza',
    testo: `
<ol>
<li>Premi <b>📄 Leggi documento</b> accanto al codice fiscale (per il coniuge: <b>📄 Leggi documento coniuge</b>).</li>
<li>Fotografa il documento, oppure premi <b>📎 Carica foto o PDF</b> e scegli un'immagine o il <b>PDF</b> della scansione della <b>carta d'identità</b> (anche elettronica), della <b>tessera sanitaria</b> o della <b>patente</b>. Se il PDF ha due pagine (fronte e retro) vengono lette tutte e due e i dati si uniscono.</li>
<li>Il programma legge cognome, nome, data di nascita, <b>codice fiscale</b> e, se presente, la <b>scadenza del documento</b>, e li inserisce nei campi.</li>
</ol>
<p class="g-nota">Controlla sempre i dati letti: con foto sfocate o riflessi qualche carattere può essere sbagliato. Il codice fiscale viene comunque verificato prima del salvataggio.</p>` },

  { id: 'scadenzadoc', icona: '🪪', titolo: 'Scadenza del documento d\'identità', parole: 'scadenza documento identita scaduto valido verde rosso richiedi nuovo whatsapp',
    testo: `
<ul>
<li>Scrivi la data in <b>Scadenza documento d'identità</b> (o la legge l'OCR).</li>
<li>Il campo diventa <b style="color:#1a7f37">verde</b> se il documento è valido (con avviso se scade entro 60 giorni) e <b style="color:#c0392b">rosso</b> se è scaduto.</li>
<li>Se è scaduto compare <b>💬 Richiedi nuovo</b>: apre WhatsApp con il messaggio già pronto per chiedere al cliente il nuovo documento.</li>
<li>Nel Registro la pratica mostra il badge <b>🪪 scaduto</b> e il pulsante <b>💬 Richiedi nuovo documento</b>.</li>
</ul>` },

  { id: 'congiunta', icona: '👫', titolo: 'Dichiarazione congiunta', parole: 'congiunta coniuge marito moglie codice fiscale coniuge vale 2',
    testo: `
<ol>
<li>Spunta <b>Congiunta</b>.</li>
<li>Cerca il coniuge nell'archivio oppure scrivi cognome, nome, data di nascita, <b>codice fiscale del coniuge</b> (obbligatorio) e cellulare, o usa <b>📄 Leggi documento coniuge</b>.</li>
<li>Salva: il coniuge viene aggiunto anche all'archivio clienti.</li>
</ol>
<p class="g-nota">Nei conteggi una congiunta vale <b>2 pratiche</b>.</p>` },

  { id: 'documenti', icona: '📎', titolo: 'Documentazione presentata e mancante', parole: 'documenti documentazione presentati mancanti da portare spunta chip altro documento in arrivo',
    testo: `
<p>Nel riquadro <b>📎 Documentazione</b> tocca ogni documento:</p>
<ul>
<li><b>1 volta</b> = <span style="color:#1a7f37">✓ presentato</span> (verde);</li>
<li><b>2 volte</b> = <span style="color:#c0392b">✗ mancante</span>, da portare (rosso);</li>
<li><b>3 volte</b> = tolto.</li>
</ul>
<p>Con <b>+ Aggiungi</b> scrivi un documento che non è in elenco (es. ricevuta asilo nido).</p>
<p><b>Se manca anche un solo documento la pratica resta "In arrivo"</b>: non può passare agli stati successivi finché non lo porta. Provando a cambiare stato compare una finestra con l'elenco di ciò che manca.</p>
<p>Quando il cliente porta un documento, nel Registro apri la pratica e nel riquadro rosso <b>"Da portare"</b> metti la spunta: passa tra i presentati. Con <b>💬 Chiedi i documenti mancanti</b> mandi al cliente la lista su WhatsApp.</p>` },

  { id: 'cud', icona: '📋', titolo: 'Richieste CUD (Punto Fisco e Briguglio Santina)', parole: 'cud richiesta punto fisco briguglio santina tabulato whatsapp stampa elenco spunta arrivato',
    testo: `
<ol>
<li>Nella documentazione, nel riquadro blu <b>📋 Richieste CUD</b>, tocca <b>Richiesta CUD Punto Fisco</b> o <b>Richiesta CUD Briguglio Santina</b>: 1 tocco = <b>DA RICHIEDERE</b> (rosso), 2 tocchi = <b>ARRIVATO</b> (verde), 3 = tolto.</li>
<li>Nel <b>Registro</b> premi <b>📋 Richieste CUD</b> (il numero indica quante sono in sospeso).</li>
<li>Per ciascuno (Punto Fisco e Briguglio Santina) puoi:
<ul>
<li>salvare il <b>telefono WhatsApp predefinito</b> (💾 Salva numero) e controllarlo con <b>🔗 Prova su WhatsApp</b>;</li>
<li>mandare tutto l'elenco con <b>📤 Invia tabulato su WhatsApp</b> o un solo nome con <b>💬 Invia</b>;</li>
<li>per Punto Fisco anche <b>🖨️ Stampa elenco</b>.</li>
</ul></li>
<li>Dopo l'invio compare <b>"Richiesta andata a buon fine"</b>.</li>
<li>Quando il CUD arriva metti la <b>spunta ☑</b>: sparisce dall'elenco e passa tra i documenti presentati.</li>
</ol>
<p class="g-nota">Le richieste CUD <b>non compaiono sulla ricevuta</b> del cliente e non sono incluse nei messaggi "documenti mancanti" al cliente.</p>` },

  { id: 'convenzioni', icona: '💶', titolo: 'Pratiche in convenzione: 730 FPS e 730 FILCA', parole: 'fps filca convenzione importi predefinito fattura automatica singola congiunta reddito elenco fatture',
    testo: `
<ul>
<li>Scegliendo <b>730 FPS IN CONVENZIONE</b> o <b>730 FILCA</b>, la fattura si compila con l'<b>importo predefinito ★</b> impostato dall'amministratore (diverso per singola e congiunta). Sotto compaiono gli altri importi da scegliere con un tocco.</li>
<li>Senza importo la pratica entra in contabilità a <b>0 €</b>: la fattura si completa dopo dall'elenco in <b>Contabilità</b> ("fatture da inserire"), una per una o per selezione.</li>
<li>Gli importi si gestiscono in <b>Utenti e permessi → 💶 Importi 730 FPS / FILCA</b>: descrizione, importo, a chi si applica (tutte, singola, congiunta), fascia di reddito e ★ predefinito.</li>
</ul>` },

  { id: 'registro', icona: '📒', titolo: 'Registro di protocollo', parole: 'registro protocollo numero cerca filtro stato apri modifica tabella elenco pratiche',
    testo: `
<ul>
<li>Ci sono <b>due registri con numerazioni separate</b>: <b>📘 Registro 730</b> (protocolli <b>730-0001/2027</b>, 730-0002…) per tutte le dichiarazioni 730, e <b>📗 Registro altre pratiche</b> (protocolli <b>AP-0001/2027</b>, AP-0002…) per IMU, ISEE, affitti, colf e badanti, successioni, ecc. La serie la sceglie il programma in base al <b>tipo di pratica</b>; se cambi il tipo da 730 ad altra pratica (o viceversa) la pratica prende il numero successivo della nuova serie.</li>
<li>Ogni registro elenca tutte le pratiche dell'anno in ordine di numero, con apertura, fine lavorazione, cliente, tipo, stato e chi l'ha inserita (con <b>✏️ ultima modifica</b>).</li>
<li>Usa la <b>barra di ricerca</b> (nome, numero, tipo, telefono…) e il filtro <b>per stato</b>.</li>
<li>Puoi cambiare lo <b>stato</b> direttamente dal menu nella riga.</li>
<li><b>Apri</b> porta alla scheda completa della pratica; <b>🧾</b> stampa la ricevuta.</li>
<li>Più sotto le pratiche sono raggruppate <b>per tipo / collaboratore</b> (730 SEDE, 730 RICCA AGATINO, 730 BRIGUGLIO, 730 FARAONE…). Sulla barra colorata vedi il numero di pratiche, le fatture e l'incasso; <b>cliccandola</b> si apre:<ul><li>la <b>📊 contabilità del collaboratore</b> per l'anno scelto: pratiche, lavorate, da lavorare, fatture emesse, incasso, <b>da incassare</b>, provento, prezzo medio e incasso per tipo di pagamento (contanti, POS, bonifico);</li><li>l'<b>elenco di tutte le sue pratiche</b> (protocollo, data, cliente, stato, fattura, pagato, pagamento) con <b>Apri</b>;</li><li><b>📋 Schede complete delle pratiche</b> per modificarle, stampare la ricevuta, mandare WhatsApp o e-mail.</li><li><b>🖨️ Stampa</b>: in alto a destra della contabilità del collaboratore stampa (o salva in PDF) solo la sua contabilità e le sue pratiche dell'anno scelto;</li><li>per i tipi gratuiti (<b>ADI, INVCIV, RED, SEND, ISEE</b>) non vengono mostrate fatture e incasso, ma solo pratiche, lavorate e da lavorare;</li><li><b>💰 Pagamenti effettuati (acconti)</b>: col tasto <b>+ 💰 Acconto</b> registri i soldi che il collaboratore ti versa (data, importo, pagamento, note). Nella contabilità del collaboratore non finiscono nell'incasso ma nel riquadro <b>PAGAMENTI EFFETTUATI</b>, e il <b>PROVENTO</b> è la differenza fra i pagamenti effettuati e le fatture emesse (se è negativo, il collaboratore deve ancora versare). Nella contabilità generale gli acconti restano compresi nell'INCASSO TOTALE ("di cui acconti"). Per togliere un acconto premi ✕.</li></ul>Ogni pratica conta sia nella contabilità generale sia in quella del suo collaboratore, con <b>lo stesso numero di protocollo</b> del registro generale: la numerazione non cambia.</li>
</ul>` },

  { id: 'stati', icona: '🏷️', titolo: 'Stati (etichette) delle pratiche', parole: 'stato etichetta in arrivo lavorazione scansionata da pagare lavorata fatturare pagato ritirare non paga rinuncia',
    testo: `
<ul>
<li>⚪ <b>In arrivo</b> · 🟡 <b>In lavorazione</b> · 🟤 <b>Da lavorare scansionata</b>: pratiche ancora da lavorare.</li>
<li>🔵 <b>Lavorata</b> (la data di fine lavorazione si scrive da sola) · 🟣 <b>Lavorata da fatturare</b>.</li>
<li>🟠 <b>Da pagare</b> · 🟢 <b>Pagato</b> · 🟢 <b>Pagato da ritirare</b>.</li>
<li>🔴 <b>Non paga</b>, <b>FILCA non paga</b>, <b>FPS non paga</b>.</li>
<li>⚫ <b>Rinuncia alla compilazione</b>: non conta tra le lavorate.</li>
</ul>
<p class="g-nota">Con documenti mancanti la pratica resta sempre <b>In arrivo</b>.</p>` },

  { id: 'modifica', icona: '✏️', titolo: 'Modificare una pratica', parole: 'modifica correggi cambia dati pratica salva modifica ultima modifica',
    testo: `
<ol>
<li>Nel Registro apri la pratica e premi <b>Modifica</b>.</li>
<li>Correggi i dati (cliente, coniuge, telefoni, e-mail, tipo, importi, pagamento, numero fattura, note…).</li>
<li>Premi <b>Salva modifica</b>.</li>
</ol>
<p>Sotto la pratica compare <b>✏️ Ultima modifica: NOME il GG/MM alle HH:MM</b>, scritta dal sistema.</p>
<p class="g-nota">Le modifiche a telefoni, e-mail e scadenza documento vengono salvate anche nell'archivio clienti.</p>` },

  { id: 'annulla', icona: '🚫', titolo: 'Annullare una pratica (numero di protocollo)', parole: 'annulla cancella elimina pratica annullata ripristina numero protocollo buco',
    testo: `
<ul>
<li>Le pratiche <b>non si cancellano</b>: si <b>annullano</b> con <b>🚫 Annulla pratica</b> nella scheda, scrivendo se vuoi il motivo.</li>
<li>La pratica resta nel Registro <b>con il suo numero</b>, barrata e segnata <b>ANNULLATA</b> (con data, chi l'ha annullata e motivo), così la numerazione non ha buchi.</li>
<li>Non conta più nei totali, nei contatori e in contabilità.</li>
<li>Se l'hai annullata per errore, nel Registro premi <b>↩️ Ripristina</b>.</li>
<li>I numeri <b>non si riusano</b>: la pratica successiva prende sempre il numero seguente.</li>
</ul>` },

  { id: 'ricevuta', icona: '🧾', titolo: 'Ricevuta per il cliente', parole: 'ricevuta stampa cliente copia documenti presentati mancanti',
    testo: `
<p>Premi <b>🧾 Ricevuta</b> nella pratica (o 🧾 nel Registro): si apre la ricevuta da stampare con i dati del CAF, del cliente, il protocollo, gli importi con il tipo di pagamento, la <b>documentazione presentata</b> e quella <b>da portare</b>.</p>
<p class="g-nota">Le richieste CUD non compaiono sulla ricevuta.</p>` },

  { id: 'whatsapp', icona: '💬', titolo: 'Messaggi WhatsApp ai clienti', parole: 'whatsapp messaggio avviso ritiro pratica pronta multiplo modelli pc copia app scheda',
    testo: `
<ul>
<li>Il pulsante <b>💬</b> sulla pratica avvisa il cliente che la pratica è pronta, con il messaggio predefinito (si scelgono i modelli in <b>Messaggi</b>). La data dell'avviso resta scritta sulla pratica.</li>
<li><b>💬 WhatsApp multiplo</b> nel Registro avvisa in sequenza tutte le pratiche lavorate.</li>
<li>Un avviso in alto ricorda le pratiche lavorate e non ancora comunicate.</li>
</ul>
<p><b>Dal PC</b> la prima volta il programma chiede <b>come inviare</b>:</p>
<ul>
<li><b>📋 Copia il messaggio</b>: lo incolli (Ctrl+V) nella chat di WhatsApp Web già aperta;</li>
<li><b>💻 App WhatsApp per PC</b>: si apre l'app installata con il messaggio già scritto;</li>
<li><b>🌐 Nuova scheda di WhatsApp Web</b>.</li>
</ul>
<p>Per cambiare la scelta: <b>📋 Richieste CUD → ⚙️ WhatsApp su questo PC</b>. Dal telefono si apre direttamente WhatsApp.</p>` },

  { id: 'email', icona: '📧', titolo: 'E-mail ai clienti dalla casella del CAF', parole: 'email e-mail posta aruba invia ricevuta documenti mancanti pratica pronta scadenza accesso',
    testo: `
<p>Il programma spedisce le e-mail direttamente dalla casella del CAF <b>aliterme@cafcislsicilia.com</b> (Aruba): le trovi anche nella "Posta inviata" di Aruba.</p>
<ul>
<li><b>📧 E-mail</b> accanto a 💬 WhatsApp sulle pratiche lavorate: avvisa che la pratica è pronta.</li>
<li><b>📧 Ricevuta</b> nella scheda della pratica: manda la ricevuta al cliente.</li>
<li><b>📧 E-mail</b> nel riquadro "Da portare": chiede i documenti mancanti.</li>
<li><b>📧</b> accanto a "Richiedi nuovo" (documento scaduto), nel modulo e nella pratica.</li>
<li><b>📧 Avvisa</b> sulle scadenze colf e badanti.</li>
<li><b>📧 Invia dal programma</b> nella finestra "Invia accesso" degli utenti.</li>
</ul>
<p>Prima dell'invio si apre una finestra dove controlli e modifichi <b>destinatario, oggetto e testo</b>; poi <b>📤 Invia e-mail</b>. Se il cliente non ha l'e-mail salvata, scrivila lì: viene salvata nella pratica e nell'archivio. Sulla pratica resta scritto <b>"📧 E-mail inviata: … il GG/MM/AAAA"</b>.</p>
<p class="g-nota">Gli utenti in sola consultazione non possono inviare e-mail.</p>` },

  { id: 'messaggi', icona: '🗨️', titolo: 'Sezione Messaggi: dati del CAF e modelli', parole: 'messaggi dati caf indirizzo telefono email orari modelli predefinito stella segnaposto',
    testo: `
<ul>
<li>In <b>MESSAGGI</b> imposti <b>indirizzo, telefono, e-mail e orari</b> del CAF: compaiono nei messaggi, nelle stampe e nell'intestazione.</li>
<li>Puoi scrivere più <b>modelli di messaggio</b>; quello con <b>⭐</b> è il predefinito.</li>
<li>Nel testo puoi usare: {nome}, {pratica}, {tipo}, {protocollo}, {indirizzo}, {telefono}, {email}, {orari}.</li>
<li>Premi <b>💾 Salva dati del CAF e messaggi</b>.</li>
</ul>` },

  { id: 'contabilita', icona: '💰', titolo: 'Contabilità', parole: 'contabilita incasso fatture emesse pagamenti caf netto guadagno prezzo medio riepilogo tipo pratica',
    testo: `
<ul>
<li>Mostra per l'anno scelto: <b>fatture emesse</b>, <b>incasso</b>, <b>pagamenti al CAF</b>, netto e (se hai il permesso) il guadagno.</li>
<li><b>Dettaglio per tipo di pratica</b>: pratiche, fatture, incasso e provento per ogni tipo.</li>
<li><b>Incasso per tipo di pagamento</b>: contanti 💶, POS 💳, bonifico 🏦 (e "non indicato").</li>
<li>Gli elenchi <b>fatture da inserire</b> delle convenzioni FPS e FILCA.</li>
<li><b>🔎 Ricerca fatture</b> dal… al… con il tipo di pagamento (vedi il capitolo dedicato).</li>
<li>I riquadri <b>SPESE SEDE</b>, <b>GUADAGNO NETTO (meno spese sede)</b> e, se c'è, <b>DA RESTITUIRE AD ANGELO</b>.</li>
<li><b>🖨️ Stampa contabilità (Excel / PDF)</b>.</li>
</ul>` },

  { id: 'ricercafatture', icona: '🔎', titolo: 'Ricerca fatture dal… al… per tipo di pagamento', parole: 'ricerca fatture dal al periodo pagamento contanti pos bonifico incasso totale excel stampa',
    testo: `
<ul>
<li>In <b>CONTABILITÀ</b>, riquadro <b>🔎 Ricerca fatture</b>: scegli <b>Dal</b> e <b>Al</b> (o i pulsanti rapidi Oggi, Questo mese, Mese scorso, Quest'anno).</li>
<li><b>Riferimento</b>: per data di apertura, fine lavorazione o data fattura.</li>
<li><b>Tipo di pagamento</b>: tutti, 💶 contanti, 💳 POS, 🏦 bonifico o non indicato. Puoi cercare anche per cliente o numero di fattura.</li>
<li>In alto vedi i <b>totali</b> (fatture e incassato) divisi per tipo di pagamento, sotto l'elenco con il totale.</li>
<li><b>📊 Excel</b> scarica l'elenco, <b>🖨️ Stampa</b> lo stampa. La ricerca vale per tutti gli anni, non solo per l'anno di protocollo scelto.</li>
</ul>` },

  { id: 'stampe', icona: '🖨️', titolo: 'Stampe ed Excel', parole: 'stampa pdf excel filtri periodo tipo stato operatore cliente pagamento registro',
    testo: `
<p>Da <b>🖨️ Stampa registro</b> o <b>🖨️ Stampa contabilità</b> si apre la finestra di stampa con i filtri:</p>
<ul>
<li><b>anno</b> e <b>periodo</b> (per data di apertura o di fine lavorazione);</li>
<li><b>tipi di pratica</b> e <b>stati</b> (Tutti / Nessuno);</li>
<li><b>operatore</b>, <b>tipo di pagamento</b> e <b>cliente</b>.</li>
</ul>
<p>Poi scegli <b>📊 Excel</b> (file con riepilogo, elenco completo e un foglio per tipo) o <b>📄 PDF</b> (pagina da stampare o salvare). Nel registro stampato le pratiche annullate sono elencate a parte.</p>` },

  { id: 'grafici', icona: '📊', titolo: 'Grafici', parole: 'grafici statistiche andamento mese operatore confronto anni',
    testo: `<p>In <b>GRAFICI</b> trovi per l'anno scelto: riepilogo economico, pratiche per stato e per tipo, incasso 730 e altre, pratiche aperte e incasso per mese, provento per tipo, pratiche per operatore e il <b>confronto tra anni</b>.</p>` },

  { id: 'versamenti', icona: '🏦', titolo: 'Versamenti CAF', parole: 'versamenti caf pagamenti al caf importo data causale',
    testo: `<p>In <b>VERSAMENTI CAF</b> registri i pagamenti fatti al CAF (importo, data, causale). Vengono sottratti all'incasso per calcolare il <b>netto</b> in Contabilità.</p>` },

  { id: 'spese', icona: '🏢', titolo: 'Spese gestione sede (TARI, acqua, luce…)', parole: 'spese sede tari imu tasse comunali acqua luce gas affitto condominio guadagno netto conferma contabilita passaggi prelevati angelo restituiti restituire anticipati',
    testo: `
<p><b>Registrare una spesa</b></p>
<ol>
<li>Nel menu <b>SPESE SEDE</b> scrivi la <b>data</b> del pagamento (propone oggi) e l'<b>importo</b>.</li>
<li>Scegli la <b>voce di spesa</b>: TARI, IMU / tasse comunali, acqua, luce, gas, telefono / internet, affitto, condominio, pulizie, cancelleria, manutenzione, assicurazione, altro.</li>
<li>Scegli il <b>pagamento</b>: <b>CONTANTI</b> è già selezionato, cambialo se hai pagato con POS o bonifico.</li>
<li>Se vuoi, scrivi una <b>descrizione</b> (es. "TARI 1ª rata 2026").</li>
<li>Se l'hai pagata con i tuoi soldi, spunta <b>💰 Prelevati Angelo</b>.</li>
<li>Premi <b>+ Aggiungi spesa</b>.</li>
</ol>
<p><b>I passaggi di ogni spesa</b></p>
<p>Ogni spesa mostra tre passaggi colorati: <b>① ✓ Registrata</b> → <b>② ✓ Pagata – CONTANTI</b> → <b>③ Conferma: già inserita in contabilità</b>.</p>
<ul>
<li>Il terzo è un <b>tasto arancione</b>: premilo quando hai riportato la spesa in contabilità. Diventa <b>verde</b> con data e nome di chi ha confermato.</li>
<li>Il bordo della spesa è <b>arancione</b> finché non è confermata, <b>verde</b> dopo. Con <b>annulla</b> togli una conferma data per sbaglio.</li>
<li>In fondo vedi i totali <b>✔ In contabilità</b> e <b>⏳ Da confermare</b> (con quante spese mancano).</li>
</ul>
<p><b>Soldi anticipati da Angelo</b></p>
<ul>
<li>Le spese con la spunta <b>💰 Prelevati Angelo</b> sono pagate con i soldi di Angelo e vanno <b>restituite</b>. La spunta si può mettere o togliere anche dopo, su ogni spesa.</li>
<li>Su queste spese compare il tasto viola <b>💸 Restituiti ad Angelo</b>: premilo quando Angelo viene rimborsato; diventa verde con la data ("annulla" per togliere).</li>
<li>Il riquadro viola <b>💰 Da restituire ad Angelo</b>, in fondo, mostra il totale ancora da rimborsare (di tutti gli anni) e l'<b>elenco con la spunta "Restituite"</b>: spunta ogni voce quando Angelo viene rimborsato; passa in "Restituite di recente", barrata e con la data. Togliendo la spunta torna da restituire. Con <b>Spunta tutte come restituite</b> le segni tutte insieme.</li>
<li>In Contabilità, se c'è qualcosa da restituire, compare il riquadro <b>DA RESTITUIRE AD ANGELO</b>.</li>
</ul>
<p><b>Effetto sul guadagno</b></p>
<ul>
<li>Il totale delle spese dell'anno viene <b>tolto dal guadagno netto</b>: in Contabilità compaiono <b>SPESE SEDE</b> e <b>GUADAGNO NETTO (meno spese sede)</b>, e lo stesso nei Grafici, nell'Excel e nella stampa della contabilità.</li>
<li>Il rimborso ad Angelo <b>non cambia</b> il guadagno: la spesa è già tolta una volta.</li>
<li>Le spese contano nell'anno della loro data di pagamento: scegli l'anno giusto in "Anno di protocollo".</li>
<li>Con ✕ elimini una spesa sbagliata. La sezione si abilita per ogni utente in <b>Utenti e permessi</b> (voce "SPESE GESTIONE SEDE").</li>
</ul>` },

  { id: 'collaboratori', icona: '🧩', titolo: 'Collaboratori e tipi di pratica', parole: 'collaboratori tipi pratica aggiungi colore elenco tipi acconto acconti anticipo stampa collaboratore',
    testo: `<p>In <b>COLLABORATORI</b> gestisci l'elenco dei <b>tipi di pratica</b> e dei collaboratori (es. "730 BRIGUGLIO ANTONIO"): aggiungi un nuovo tipo con <b>+ Aggiungi</b>. Ogni tipo ha il suo colore, usato nel menu a tendina, nel Registro e nei grafici.</p>` },

  { id: 'scadenze', icona: '⏰', titolo: 'Scadenze e calendario', parole: 'scadenze calendario promemoria avviso giorni prima fatta riquadro arancione appuntamento',
    testo: `
<ol>
<li>In <b>SCADENZE</b> scrivi descrizione, <b>data</b>, quando avvisarti (da il giorno stesso a 30 giorni prima), cliente e note, poi <b>+ Aggiungi scadenza</b>.</li>
<li>Il calendario mostra i giorni con scadenze: rosso = scaduta, arancione = da avvisare, blu = in programma, grigio = fatta.</li>
<li>Le scadenze vicine compaiono nel <b>riquadro arancione 🔔</b> a destra finché non le segni come <b>Fatta</b>; il numero compare anche sul pulsante SCADENZE.</li>
</ol>` },

  { id: 'colf', icona: '🧹', titolo: 'Colf e badanti: scadenza, avviso e rinnovo', parole: 'colf badanti scadenza assistenza rinnova non rinnova avvisa whatsapp anno successivo',
    testo: `
<ul>
<li>Per <b>CONTRATTI COLF E BADANTI</b> al posto della fine lavorazione scrivi la <b>Scadenza assistenza</b>: viene creata da sola nel calendario con avviso 15 giorni prima.</li>
<li>Sulla scadenza trovi:
<ul>
<li><b>💬 Avvisa</b>: manda al cliente su WhatsApp il promemoria della scadenza; resta annotato "AVVISATO il …";</li>
<li><b>📧 Avvisa</b>: manda lo stesso promemoria per e-mail dalla casella del CAF; resta annotato "AVVISATO via e-mail il …";</li>
<li><b>🔁 Rinnova</b>: apre una nuova pratica già compilata con i dati del cliente; scrivi la nuova scadenza e l'importo e salva. La nuova pratica prende il numero dell'anno in corso e la vecchia scadenza diventa <b>🔁 rinnovata</b>;</li>
<li><b>Non rinnova</b>: chiude la scadenza se il cliente non prosegue.</li>
</ul></li>
<li>Cliente e scadenza passano all'anno successivo; la pratica resta nel registro dell'anno in cui è stata fatta.</li>
</ul>` },

  { id: 'archivio', icona: '🗂️', titolo: 'Archivio clienti (anagrafica) e nuovo cliente da documento', parole: 'archivio clienti anagrafica cerca telefono email importa csv elimina cliente nuovo cliente documento ocr scansione senza pratica',
    testo: `
<ul>
<li>Ogni cliente inserito resta nell'<b>archivio</b>, valido per tutti gli anni, con data di nascita, codice fiscale, telefoni, e-mail e scadenza documento.</li>
<li>Si cerca da <b>"Cerca cliente nell'archivio"</b> scrivendo cognome o nome.</li>
<li><b>📇 Nuovo cliente da documento</b> (in alto in Inserimento anagrafica): scansioni carta d'identità, tessera sanitaria o patente e il cliente viene salvato <b>solo nell'archivio, senza creare una pratica</b>. Nella finestra controlli i dati letti, aggiungi cellulare, telefono fisso ed e-mail e premi <b>💾 Salva in archivio</b>; oppure <b>✍️ Salva e apri nuova pratica</b> per compilare subito anche la pratica. Se il cliente c'è già, i suoi recapiti vengono aggiornati.</li>
<li>L'amministratore può importare clienti da file <b>CSV</b> (Utenti e permessi → Importa Clienti da CSV).</li>
</ul>` },

  { id: 'utenti', icona: '👥', titolo: 'Utenti, ruoli e permessi (amministratore)', parole: 'utenti permessi ruolo amministratore operatore consultazione nuovo utente password invia accesso',
    testo: `
<ul>
<li>In <b>UTENTI E PERMESSI</b> l'amministratore crea un <b>nuovo utente</b> (nome, e-mail, password, ruolo: operatore, consultazione o amministratore).</li>
<li>Per ogni utente sceglie quali <b>sezioni</b> vede e se può modificare; poi <b>💾 Salva permessi</b>.</li>
<li><b>Invia accesso</b> prepara il messaggio con link, e-mail e password da mandare su WhatsApp o per e-mail (anche Aruba Webmail).</li>
<li>In <b>La mia password</b> ognuno può cambiare la propria password.</li>
</ul>` },

  { id: 'backup', icona: '🛟', titolo: 'Backup e cartella Dropbox', parole: 'backup copia sicurezza dropbox cartella ripristino importa esporta json excel elimina',
    testo: `
<ul>
<li>Ogni <b>lunedì notte</b> il programma salva da solo un backup completo; si tengono le ultime 12 settimane. Viene fatto anche prima di svuotare il registro o importare un backup.</li>
<li><b>💾 Crea un backup adesso</b> ne fa uno subito; <b>⬇️ Scarica</b> scarica il file; <b>🗑️</b> lo elimina.</li>
<li><b>📁 Scegli la cartella</b> (es. Dropbox › Backup CAF, con Chrome o Edge sul PC): il programma tiene lì <b>un file per anno</b>, per esempio <b>salvataggi-2026.json</b>. Durante l'anno il file viene riscritto con il backup più recente; finito l'anno resta com'è, cioè il <b>salvataggio completo dell'anno</b>, e dal 1° gennaio si comincia <b>salvataggi-2027.json</b>. Dropbox li porta nel cloud.</li>
<li>Il <b>31 dicembre alle 23:30</b> il programma fa da solo il <b>salvataggio di fine anno</b> (🎆), che resta sul server per sempre.</li>
<li>In <b>Backup automatici</b> ci sono anche i pulsanti <b>⬇️ salvataggi-2026.json</b>… per scaricare a mano il salvataggio di ogni anno.</li>
<li><b>Esporta Backup (JSON)</b> / <b>Esporta Registro (Excel)</b> e <b>Importa Backup</b> per ripristinare.</li>
<li><b>Cancellare un solo anno</b> (solo amministratore, in Utenti e permessi → Zona pericolosa → <b>🗓️ Cancella un solo anno</b>): scegli l'anno e cosa cancellare (pratiche dei registri 730 e AP, versamenti CAF, spese sede, scadenze), poi scrivi l'anno per confermare. Prima viene fatto da solo un backup completo; l'archivio clienti non viene toccato.</li>
</ul>` },

  { id: 'modulistica', icona: '📂', titolo: 'Modulistica: moduli da scaricare, compilare e stampare', parole: 'modulistica moduli modulo word pdf excel carica scarica stampa editabile non editabile categoria delega privacy',
    testo: `
<ul>
<li>Nel menu <b>MODULISTICA</b> trovi i moduli del CAF divisi per <b>categoria</b> (es. 730, ISEE, Deleghe, Privacy).</li>
<li>Ogni modulo è segnato <b>✏️ Editabile</b> (si compila al computer: Word, Excel, PDF compilabile) o <b>🔒 Non editabile</b> (solo da stampare).</li>
<li><b>👁️ Apri</b> lo apre in una nuova scheda (da lì puoi anche stampare); <b>⬇️ Scarica</b> lo salva sul computer per compilarlo con Word o con il lettore PDF.</li>
<li>Con la <b>🔍 ricerca</b> e i filtri trovi subito il modulo per nome, categoria o descrizione.</li>
<li><b>⬆️ Carica un nuovo modulo</b>: scegli il file (fino a 20 MB), scrivi nome, categoria, tipo e descrizione e premi <b>Carica modulo</b>. Gli utenti in sola consultazione possono solo aprire e scaricare.</li>
<li><b>🗑️</b> elimina un modulo: può farlo l'amministratore o chi lo ha caricato.</li>
</ul>
<p class="g-nota">Dopo averlo compilato, il modulo va salvato sul tuo computer: la copia nella Modulistica resta sempre quella vuota, pronta per il cliente successivo.</p>` },

  { id: 'app', icona: '📲', titolo: 'Installare l\'app su telefono e PC', parole: 'installa app telefono iphone android pc icona schermata home qr safari',
    testo: `
<ul>
<li><b>PC / Android</b>: premi <b>📲 Installa app</b> e conferma.</li>
<li><b>iPhone</b>: apri il programma con <b>Safari</b> → <b>Condividi</b> → <b>Aggiungi alla schermata Home</b>.</li>
<li>Dal telefono puoi anche inquadrare il <b>QR</b> in alto: apre il programma con le istruzioni.</li>
<li>L'installazione vale per il singolo dispositivo: ogni telefono o PC si installa una volta.</li>
</ul>` },

  { id: 'aggiornamenti', icona: '🔄', titolo: 'Aggiornamenti del programma', parole: 'aggiorna nuova versione ricarica ctrl f5 barra blu',
    testo: `<p>Quando viene pubblicata una nuova versione compare in basso la barra blu <b>"🔄 È disponibile una nuova versione del programma — Aggiorna ora"</b>: premila. In alternativa premi <b>Ctrl+F5</b> sul PC. I dati non vengono toccati.</p>` },

  { id: 'problemi', icona: '🛠️', titolo: 'Problemi frequenti', parole: 'problema non funziona errore non vedo non salva lento dati non aggiornati',
    testo: `
<ul>
<li><b>Non vedo una novità</b>: premi "Aggiorna ora" o Ctrl+F5; usa l'indirizzo <b>gestionale-caf.vercel.app</b>.</li>
<li><b>La pratica non si salva</b>: leggi la finestra di errore (codice fiscale, telefono, doppione, documenti…).</li>
<li><b>Lo stato non cambia</b>: mancano documenti, la pratica resta In arrivo.</li>
<li><b>WhatsApp apre troppe schede</b>: scegli "Copia il messaggio" o "App per PC" in ⚙️ WhatsApp su questo PC.</li>
<li><b>Una sezione non compare</b>: chiedi all'amministratore di abilitarla nei permessi.</li>
</ul>` },
];

function apriGuida(cerca) {
  let ov = document.getElementById('guida-programma');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'guida-programma';
  ov.style.cssText = 'position:fixed; inset:0; z-index:500; background:rgba(15,27,45,.55); display:flex; align-items:center; justify-content:center; padding:12px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; max-width:860px; width:100%; height:min(92vh, 900px); display:flex; flex-direction:column; box-shadow:0 20px 50px rgba(0,0,0,.35); overflow:hidden">'
    + '<div style="padding:14px 16px 10px; border-bottom:1px solid var(--line); background:linear-gradient(90deg,#1d4f91,#00612f); color:#fff">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:10px"><div style="font-size:19px; font-weight:800">📖 GUIDA DEL PROGRAMMA</div>'
    + '<button type="button" onclick="chiudiGuida()" style="background:rgba(255,255,255,.18); color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:700; cursor:pointer">Chiudi ✕</button></div>'
    + '<div style="position:relative; margin-top:10px"><span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:16px">🔍</span>'
    + '<input id="guida-cerca" type="search" placeholder="Cerca nella guida: es. codice fiscale, CUD, rinnova, backup…" autocomplete="off" style="width:100%; padding:10px 12px 10px 38px; border-radius:999px; border:none; font-size:15px; color:#0f1b2d; background:#fff" oninput="filtraGuida(this.value)"></div>'
    + '<div id="guida-esito" style="font-size:12px; margin-top:6px; opacity:.9"></div></div>'
    + '<div style="display:flex; flex:1; min-height:0">'
    + '<div id="guida-indice" style="width:230px; flex:none; overflow-y:auto; border-right:1px solid var(--line); padding:8px; font-size:13px"></div>'
    + '<div id="guida-testo" style="flex:1; overflow-y:auto; padding:12px 18px; font-size:14px; line-height:1.55"></div></div></div>';
  ov.addEventListener('click', function (e) { if (e.target === ov) chiudiGuida(); });
  document.body.appendChild(ov);
  if (window.matchMedia('(max-width:640px)').matches) document.getElementById('guida-indice').style.display = 'none';
  const inp = document.getElementById('guida-cerca');
  inp.value = cerca || '';
  filtraGuida(inp.value);
  setTimeout(function () { inp.focus(); }, 50);
}
function chiudiGuida() { const ov = document.getElementById('guida-programma'); if (ov) ov.remove(); }
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.getElementById('guida-programma')) chiudiGuida(); });

function normalizzaGuida(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function testoSemplice(html) { const d = document.createElement('div'); d.innerHTML = html; return d.textContent || ''; }
// evidenzia le parole cercate solo nel testo, non dentro i tag
function evidenziaGuida(html, parole) {
  if (!parole.length) return html;
  const re = new RegExp('(' + parole.map(function (p) { return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi');
  return html.split(/(<[^>]+>)/).map(function (pezzo) {
    if (pezzo.charAt(0) === '<') return pezzo;
    return pezzo.replace(re, '<mark style="background:#ffe066; color:#0f1b2d; border-radius:3px; padding:0 2px">$1</mark>');
  }).join('');
}
function filtraGuida(q) {
  const parole = normalizzaGuida(q).split(/\s+/).filter(function (p) { return p.length > 1; });
  const trovati = GUIDA.filter(function (c) {
    if (!parole.length) return true;
    const dove = normalizzaGuida(c.titolo + ' ' + c.parole + ' ' + testoSemplice(c.testo));
    return parole.every(function (p) { return dove.indexOf(p) >= 0; });
  });
  // per evidenziare servono le parole come scritte (con accenti): si usano quelle digitate
  const daEvidenziare = String(q || '').trim().split(/\s+/).filter(function (p) { return p.length > 1; });
  const esito = document.getElementById('guida-esito');
  if (esito) esito.textContent = parole.length ? (trovati.length ? trovati.length + (trovati.length === 1 ? ' capitolo trovato' : ' capitoli trovati') : 'Nessun risultato: prova con un\'altra parola (es. "pratica", "WhatsApp", "stampa")') : GUIDA.length + ' capitoli · scrivi una parola per cercare';
  document.getElementById('guida-indice').innerHTML = trovati.map(function (c) {
    return '<a href="#" onclick="vaiCapitoloGuida(\'' + c.id + '\'); return false" style="display:block; padding:6px 8px; border-radius:8px; color:var(--ink); text-decoration:none">' + c.icona + ' ' + esc(c.titolo) + '</a>';
  }).join('');
  document.getElementById('guida-testo').innerHTML = trovati.length ? trovati.map(function (c) {
    return '<section id="guida-' + c.id + '" style="margin-bottom:18px; padding-bottom:12px; border-bottom:1px solid var(--line)">'
      + '<h3 style="margin:6px 0 8px; font-size:17px; color:#1d4f91">' + c.icona + ' ' + evidenziaGuida(esc(c.titolo), daEvidenziare) + '</h3>'
      + evidenziaGuida(c.testo, daEvidenziare) + '</section>';
  }).join('') : '<div class="empty" style="margin-top:30px">🔍 Nessun capitolo contiene "' + esc(q) + '"</div>';
  const primo = document.querySelector('#guida-testo mark');
  if (primo && parole.length) primo.scrollIntoView({ block: 'center' });
  else document.getElementById('guida-testo').scrollTop = 0;
}
function vaiCapitoloGuida(id) { const el = document.getElementById('guida-' + id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
