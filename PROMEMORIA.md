# Promemoria tecnico – Gestionale CAF CISL Alì Terme

Questo file serve a chi riprende il programma: Claude in una nuova sessione o un altro tecnico.
Va letto **prima** di modificare qualcosa. Aggiornato al 24/10/2026. L'uso vero del programma inizia nel 2027.

## Chi lo usa e come parlargli

- **Angelo** è l'amministratore del CAF CISL di Alì Terme.
  - Scrive a voce (dettatura), quindi i messaggi possono arrivare storpiati: vanno interpretati, e se il senso non è chiaro si chiede.
  - Rispondere sempre in **italiano semplice, senza parole tecniche**.
  - **Prima di una modifica importante o poco chiara, spiegare cosa si farà e chiedere conferma.**
- Regole fisse:
  - la password SMTP sta solo nel segreto `SMTP_PASS` di Supabase e **non va mai scritta in chat**;
  - non fare deploy manuali su Vercel e non cancellare trigger senza il suo ok;
  - non aprire pull request se non le chiede;
  - **non cancellare mai dati o backup**: lo fa lui dal programma, per esempio le pratiche di prova del 2026 da Utenti e permessi → Backup → «Cancella i dati dell'anno scelto».

## Dove vive il programma (tutto gratuito, account di Angelo)

| Parte | Servizio | Note |
|---|---|---|
| Codice | GitHub `cafaliterme-lab/gestionale-caf` | ramo pubblicato: `claude/great-albattani-2ox788`, copiato anche su `main` |
| Sito | Vercel, progetto `gestionale-caf` (gestionale-caf.vercel.app) | si pubblica da solo a ogni push sul ramo sopra |
| Dati | Supabase, progetto `mmaqmprukghyazlibphv` (eu-west-1, piano Free) | database, accesso utenti, funzioni `accesso-qr`, `admin-utenti`, `invia-email`, `recupera-password` |

- **Piano Free di Supabase.** Il battito quotidiano (`api/battito.js`, cron Vercel) evita la pausa. Senza battito, se il programma non viene usato per circa 7 giorni, il progetto va in pausa (arriva prima un'e-mail di avviso). Si riattiva dal sito di Supabase con «Resume project», entro 90 giorni; i dati non si perdono.
- **Copia per e-mail**: ogni lunedì `api/backup-settimanale.js` (cron Vercel) chiama la Edge Function `backup-email`, che manda l'ultimo backup compresso alla casella del CAF (max una ogni 5 giorni, `impostazioni.backup_email_ultimo`). Si importa con «Importa Backup» (.json.gz).
- **Caselle e-mail**: principale Aruba `aliterme@cafcislsicilia.com`, riserva `cafcislaliterme@tim.it` (smtp.tim.it, 587 STARTTLS, segreto SMTP2_PASS messo da Angelo il 29/10, prova riuscita). L'admin sceglie la casella in Utenti e permessi («📧 Casella da cui partono le e-mail», `impostazioni.casella_invio` = caf|riserva); nella finestra di ogni e-mail c'è «Da:» per cambiarla solo per quell'invio. `mandaMail` in invia-email/recupera-password/backup-email parte dalla scelta e, se fallisce, prova l'altra (`cambiata: true` → avviso). Tasto «🧪 Prova la casella di riserva» nei Backup.
- **Backup automatici** (pg_cron): ogni notte, ogni lunedì e il 31 dicembre, nella tabella `backup_automatici`.
  - `crea_backup()` usa `dati_backup()`, che salva tutte le tabelle dei dati, compresi richiami, conte di cassa, appuntamenti e comunicazioni.
  - Il ripristino è `ripristina_dati(d)` (solo admin).
  - Conviene scaricare ogni tanto un backup sul PC, perché i backup stanno nello stesso database.

## Com'è fatto

- **Pagina unica** `index.html` più i file in `js/`, senza compilazione.
  - Ogni volta che cambia un file JS, aumentare `?v=` nel tag `<script>` di `index.html`: altrimenti i browser tengono la versione vecchia.
- **Collegamento al database.** `js/config.js` ha un client REST minimale (`supabase.from().select/update/eq/not/is…`) e `fetchSupabase(endpoint, metodo, corpo, intestazioni)`.
  - `js/data.js` traduce i campi da `snake_case` (database) a `camelCase` (programma): vedi `schemas`.
  - **Ogni nuova colonna va aggiunta lì**, altrimenti non viene letta né salvata.
- **Permessi.** Sono controllati nel database (RLS) con le funzioni `puo(tab, scrittura)` ed `e_admin()`. Le funzioni pericolose (svuotare, importare, ripristinare) controllano `e_admin()`.
- **Collegamento delle persone.** Le persone si collegano per **codice fiscale**, altrimenti per **nome e data di nascita**: 968 clienti su 1115 non hanno il codice fiscale, e ci sono 37 gruppi di omonimi.
  - Le comunicazioni salvano anche `data_nascita`.
  - `comunicazioniPersona(nome, cf, nascita)` non attribuisce una riga senza data a un omonimo.
  - Quando un nome cambia, `propagaNomeCliente()` (in `archivio-clienti.js`) lo aggiorna in pratiche, coniuge, agenda, comunicazioni, richiami, dichiarante e riferimenti.
  - `unisciSchedeClienti()` unisce due schede doppie.
- **File principali**:
  - `app.js`: registro, inserimento pratica (congiunta automatica, riferimento), WhatsApp, filtri, Excel;
  - `archivio-clienti.js`: archivio, modifica scheda, fogli, unisci, propagazione dei nomi;
  - `richiami.js`: campagna 730 e richiami (invio a tutti, raggruppato per numero, scelta del canale);
  - `auguri.js`: auguri di Natale e Pasqua;
  - contratti colf in continuazione (trasferiti o rinnovati): `continuazione = true`, serie interna `CT` decisa dal trigger, si mostrano con `protocollo_origine`; `pesoPratica` = 0, quindi non contano tra le pratiche ma gli incassi restano in contabilità;
  - `ricerca-elenchi.js`: casella «Cerca» comune agli elenchi delle finestre (righe con classe `el-riga`);
  - `confronto-anni.js`: confronto pratiche/incasso/clienti con l'anno prima (tasto in Contabilità);
  - `api/battito.js` + `vercel.json` crons: battito quotidiano su Supabase perché il piano gratuito non vada in pausa;
  - `scadenza-730.js`: avviso di settembre con i 730 da definire entro il 30/09;
- `js/sollecito-ritiro.js`: 🔔 sollecito di ritiro dal 7 ottobre (riquadro in Oggi, WhatsApp uno per volta, stesso cellulare = un messaggio, motivo «Sollecito ritiro» nelle comunicazioni).
- `js/fine-anno.js`: 🧹 controllo di fine anno «Pronti per il nuovo anno?» (riquadro Oggi solo admin dal 15/12 al 31/01, tasto in Utenti e permessi). Solo lista di controllo con tasti verso le pagine: non cancella niente da sola.
- `js/spazio-server.js`: 💽 «Spazio sul server» in Utenti e permessi (sopra i backup): RPC `spazio_database()` (migrazione 037, solo admin) dà totale, limite 500 MB, spazio per gruppo di tabelle e salva il valore del mese in `impostazioni.spazio_mesi` (serve per la crescita al mese e gli anni che restano). Riquadro in Oggi e voce nel controllo di fine anno solo oltre il 70%. Il 30/10/2026: 14,8 MB, di cui 12,3 di base fissa di Supabase.
- `js/anni-vecchi.js`: 🗄️ «Anni con più di 5 anni» (ANNI_DA_CONSERVARE=5), voce del controllo di fine anno. Per ogni anno ≤ anno chiuso − 5: «💾 Scarica la copia» (file `copia-anno-AAAA-…json`, versione 'anno', solo righe di quell'anno: pratiche, scadenze, buste_paga, pratiche_avvisi, versamenti, spese_sede) e «🗑️ Cancella» (`eseguiSvuotaAnno` in extra.js, backup prima). Mai automatico: se non cancella, l'anno dopo li ripropone tutti. «Importa Backup» con un file `copia-anno-*` chiama `riportaAnnoDaCopia`: rimette solo quell'anno (ignore-duplicates), senza toccare il resto.
- `js/anno-precedente.js`: 💶 nell'inserimento, scelto il cliente (archivio o CF scritto), riquadro con le sue pratiche dell'anno prima (fatturato/richiesto/pagato, anche come coniuge); una volta per cliente per sessione.
- `js/menu-frecce.js`: freccette ‹ › ai lati del menu che scorre sul telefono. Guadagno netto (Oggi e Contabilità) con la riga «💡 quando avrai consegnato tutto» = guadagno − fatture in attesa di consegna.
- `js/documenti.js`: avviso arancione per scadenze più lontane di 11 anni; `datiSospettiCliente` (scadenze sbagliate, cellulari <9 cifre) usato dal filtro archivio «⚠️ Dati da controllare» e dal riquadro in Oggi.
- ♾️ Carta d'identità a validità illimitata (dai 70 anni): tasto «♾️ Illimitata» accanto alle scadenze del documento d'identità (`aggiornaTastiIllimitata` in `js/documenti.js`); si salva 31/12/2099, qualsiasi data del 2099 vale come illimitata e si mostra «♾️ illimitata». Esclusa da dati sospetti e scadenze.
  - `affitti.js`: contratti di affitto (inquilini in `pratiche.inquilini` jsonb, `affitto_regime/inizio/durata/fine/prossima`; scadenze create dal trigger `sincronizza_scadenza_assistenza`, una per pratica; `clienti.inquilino`);
  - `lavoratore-colf.js`: lavoratore dei contratti colf e badanti (campi `lav_*` in pratiche; `lavoratore_colf` e permesso di soggiorno in clienti);
  - `comunicazioni.js`: storico dei messaggi, «Non ha WhatsApp», cancellazione degli sbagli;
  - `agenda.js`, `ricerca-unica.js`, `oggi.js`, `documenti-scadenza.js`, `stampe.js`, `extra.js` (backup), `accesso-qr.js` (QR, più `api/telefono-qr.js` su Vercel per il cookie dell'iPhone);
  - `guida.js`: la guida dentro il programma, da aggiornare a ogni novità.
- **Migrazioni** in `supabase/migrations/`, numerate.
  - Se lo strumento automatico si blocca su comandi «distruttivi» (`drop`, `delete`), si prepara il file e Angelo lo incolla nell'editor SQL di Supabase.
  - Esempio: `supabase/incolla-in-supabase.sql`.

## Come provare e pubblicare

1. Avviare il sito in locale con `python3 -m http.server 8765` dalla cartella del programma.
2. Fare le prove con Playwright simulando Supabase (le richieste a `supabase.co` intercettate).
3. Prima di ogni pubblicazione controllare che il programma si apra senza errori in tutte le schede.
4. Pubblicare:
   - `git fetch origin && git merge --ff-only origin/claude/great-albattani-2ox788`;
   - commit;
   - push su `claude/great-albattani-2ox788` e su `main`.

## Ripartenza (abbonamento sospeso dal 2/11/2026?)

- Angelo potrebbe sospendere l'abbonamento a Claude dal 2/11/2026 e riattivarlo più avanti. Il programma funziona da solo (copie notturne e di fine anno con pg_cron, battito e copia del lunedì con i cron di Vercel, casella di riserva).
- Al ritorno: rileggere questo file, fare un controllo generale da esperto (database, backup, battito, `backup_email_ultimo`, log, advisor), poi chiedere ad Angelo cosa serve. Ha una guida «Gestionale CAF: come ripartire con Claude» con il primo messaggio da incollare.
- Rischio noto: archivio GitHub **pubblico** (nessun dato clienti, ma in `tests/db/test.sql` ci sono nomi di prova). Renderlo privato può fermare i deploy automatici di Vercel Hobby (archivio di un'organizzazione): da decidere con Angelo.

## Cose rimaste da fare

- **Metodo richiesto da Angelo**: per controlli, modifiche e consigli ragionare sempre «da utente esperto» e spiegargli prima cosa cambia, rischi e consiglio.
- Riassunto mensile per e-mail (idea 3): da fare dopo che Angelo sistema Vercel. Idea da proporre: spostare battito e copia del lunedì da Vercel a pg_cron + pg_net di Supabase (i backup notturni e di fine anno girano già con pg_cron).

- Correggere a mano in archivio 6 cellulari finti e 2 date di nascita con l'anno sbagliato. I nomi si trovano con una query sul database; non sono scritti qui per riservatezza.
- Unire con «🔗 Unisci con un'altra scheda» i 3 clienti doppi per uno spazio in più nel nome.
- Completare cellulari, e-mail e codici fiscali man mano che i clienti vengono; segnare i deceduti.
- Prima della campagna 2027: cancellare le pratiche di prova del 2026 (lo fa Angelo).
- (FATTO il 29/10, manca solo la password SMTP2_PASS che mette Angelo) casella e-mail di riserva per l'invio (se quella Aruba del CAF ha problemi). Aspetta da lui: quale indirizzo (consigliata una seconda casella Aruba, oppure Alice/Libero; Gmail e Yahoo vogliono la «password per le app», Outlook non va) e se automatico (consigliato: se Aruba rifiuta, riprova con la riserva) o a mano (interruttore in Utenti e permessi). La password la mette lui nei segreti di Supabase (es. SMTP2_USER, SMTP2_HOST, SMTP2_PASS), mai in chat. Riguarda invia-email, recupera-password e backup-email.
- Idee non ancora fatte: nessuna richiesta aperta.
