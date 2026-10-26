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

- **Piano Free di Supabase.** Se il programma non viene usato per circa 7 giorni, il progetto va in pausa (arriva prima un'e-mail di avviso). Si riattiva dal sito di Supabase con «Resume project», entro 90 giorni; i dati non si perdono.
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
  - `scadenza-730.js`: avviso di settembre con i 730 da definire entro il 30/09;
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

## Cose rimaste da fare

- Correggere a mano in archivio 6 cellulari finti e 2 date di nascita con l'anno sbagliato. I nomi si trovano con una query sul database; non sono scritti qui per riservatezza.
- Unire con «🔗 Unisci con un'altra scheda» i 3 clienti doppi per uno spazio in più nel nome.
- Completare cellulari, e-mail e codici fiscali man mano che i clienti vengono; segnare i deceduti.
- Prima della campagna 2027: cancellare le pratiche di prova del 2026 (lo fa Angelo).
- Idee non ancora fatte: nessuna richiesta aperta.
