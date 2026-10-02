# Protocollo Pratiche CAF — Gestionale su Supabase

Un gestionale per il Centro Assistenza Fiscale (CAF) che gestisce pratiche di protocollo, versamenti, ISEE e collaboratori. Funziona su un database **Supabase/PostgreSQL** con autenticazione email+password e controllo dei permessi lato server via **Row Level Security (RLS)**.

## Caratteristiche

- **Database reale (Supabase)**: Dati condivisi tra Angelo e Federica in tempo reale
- **Autenticazione email+password**: Login via Supabase Auth
- **Controllo permessi server-side**: RLS protegge i dati in base a ruolo e permessi per scheda
- **Sincronizzazione realtime**: I dati si aggiornano in tempo reale su tutti i dispositivi connessi
- **Numerazione atomica**: I numeri di protocollo sono assegnati dal database (no conflitti)
- **Admin edge function**: Creazione/modifica/eliminazione utenti e reset password via Edge Function
- **Interfaccia originale**: Moduli, calcoli, export Excel, grafici rimangono identici

## Prerequisiti

- Account **Supabase** (gratuito con 500MB di storage)
- **Git** installato localmente
- **Node.js** (v18+) per lo script di importazione

## Installazione

### 1. Creare il progetto Supabase

1. Andare su [https://app.supabase.com](https://app.supabase.com) e creare un account (se non presente)
2. Cliccare "New Project"
3. Scegliere:
   - **Name**: "Gestionale CAF" (o a piacere)
   - **Database password**: una password forte (servirà solo per setup)
   - **Region**: Europa (o la più vicina)
4. Attendere il completamento della creazione (~1 minuto)

### 2. Eseguire la migration

1. Nel menu Supabase, cliccare **SQL Editor** (icona <> a sinistra)
2. Cliccare **"New query"**
3. Copiare tutto il contenuto di `supabase/migrations/001_schema.sql`
4. Incollare nell'editor
5. Cliccare **"Run"** (in basso a destra)
6. Attendere il completamento (il risultato dovrebbe mostrare "Query executed successfully")

### 3. Ottenere le credenziali Supabase

1. Cliccare su **Settings** (icona ingranaggio a sinistra)
2. Cliccare **API**
3. Copiare:
   - **Project URL** (es. `https://your-project.supabase.co`)
   - **Anon/public key** (la chiave lunga sotto "Project API keys", riga "anon")

### 4. Configurare il file `js/config.js`

1. Aprire il file `js/config.js` nel vostro editor
2. Sostituire i placeholder:
   ```javascript
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key-here';
   ```
   con i valori copiati al passo precedente

### 5. Creare il primo account (Angelo)

1. Aprire `index.html` nel browser (locale o deployato)
2. Cliccare sul pulsante "Accedi" (oppure il form di login se non autenticato)
3. Nella sezione "Crea un nuovo account", inserire:
   - **Email**: l'email di Angelo (es. `angelo@example.com`)
   - **Password**: una password forte
4. Cliccare "Crea account"
5. Dopo il login, Angelo sarà automaticamente **admin** (il primo account diventa sempre admin)

### 6. Creare il secondo account (Federica)

1. Effettuare il logout (pulsante in basso a sinistra della scheda "Permessi")
2. Tornare al login e ripetere il passo 5, ma con i dati di Federica
3. Federica sarà un **operatore** (con permessi limitati di default)

### 7. Configurare i permessi di Federica (opzionale)

1. Effettuare il login come Angelo
2. Andare alla scheda **"Permessi"** (in basso)
3. Trovare Federica nell'elenco e spuntare le schede che deve vedere (es. "Registro", "CAF")
4. Se necessario, spuntare "Sola lettura" per impedirle di modificare i dati

### 8. Importare i dati attuali (opzionale)

Se hai un backup del sistema vecchio:

1. Dalla pagina vecchia (quella locale), cliccare **"Esporta Backup (JSON)"** e salvare il file
2. Nella nuova pagina, andare alla scheda **"Permessi"** (solo Angelo può farlo)
3. Cliccare **"Importa Backup"**, scegliere il file esportato
4. Attendere il completamento

I dati verranno importati e i numeri di protocollo continueranno dal valore più alto.

## Deployment

### GitHub Pages (gratuito, senza server)

1. Creare un repository pubblico su GitHub: `gestionale-caf`
2. Pushare il codice:
   ```bash
   git remote add origin https://github.com/your-username/gestionale-caf.git
   git branch -M main
   git push -u origin main
   ```
3. Nel repository, andare a **Settings → Pages**
4. Sotto "Source", selezionare "Deploy from a branch"
5. Selezionare il branch `main` e la cartella `/ (root)`
6. Cliccare "Save"
7. La pagina sarà disponibile a `https://your-username.github.io/gestionale-caf/`

### Netlify (opzionale)

1. Collegare il repository GitHub a [Netlify](https://netlify.com)
2. Impostare:
   - **Build command**: (nessuno — è un sito statico)
   - **Publish directory**: `.` (la radice)
3. Cliccare "Deploy"

## Struttura del progetto

```
index.html                    ← L'interfaccia (HTML + CSS inline)
js/
  config.js                   ← Configurazione Supabase (da compilare)
  auth.js                     ← Autenticazione e gestione profilo
  data.js                     ← Livello dati (CRUD + realtime)
  app.js                      ← Logica applicativa (il codice originale, modificato)
supabase/
  migrations/
    001_schema.sql            ← Schema del database (tabelle, RLS, funzioni)
README.md                     ← Questo file
```

## Tabelle del database

- `profili` — Utenti e loro permessi (id, nome, email, ruolo, tabs, sola_lettura)
- `pratiche` — Registro di protocollo (numero, anno, nome, cf, congiunta, ..., stato, ...)
- `versamenti` — Versamenti CAF (importo, data, causale)
- `isee` — Attestazioni ISEE (nome, importo, data, pagato)
- `clienti` — Archivio clienti (nome_completo, cognome, nome, data_nascita)
- `collaboratori` — Elenco tipi di pratica / collaboratori (nome, ordine)
- `contatori` — Contatori per numeri di protocollo (anno, next)

## Controllo dei permessi (RLS)

- **Admin**: accesso totale a tutto
- **Operatore**:
  - Vede solo le schede che gli sono state assegnate (in "Permessi" → spunta)
  - Se **sola lettura**: può solo inserire nuove pratiche, non può modificare o eliminare
  - Senza sola lettura: accesso completo alle schede visibili

## FAQ

### P: Come cambio la mia password?
**R**: Nella scheda "Permessi", sezione "La mia password", inserisci la nuova password e clicca Salva.

### P: Come reset la password di un altro utente?
**R**: Solo l'admin. Nella scheda "Permessi", trovare l'utente e cliccare il pulsante "Salva" accanto a "Nuova password".

### P: Dove vedo l'archivio clienti?
**R**: L'archivio si popola automaticamente quando aggiungi nuove pratiche. I campi "Cognome" e "Nome nascita" della ricerca cliente usano questo archivio.

### P: I dati sono al sicuro?
**R**: Sì. Il database è protetto da:
- **RLS**: Nessuno può leggere i dati di altri utenti se non autorizzato
- **HTTPS**: Supabase cripta la connessione
- **Password**: Gestite da Supabase Auth (non memorizzate in chiaro)

### P: Posso usare la pagina offline?
**R**: No, la pagina richiede una connessione Internet per accedere a Supabase.

## Troubleshooting

### "Errore: tabella pratiche non trovata"
**Causa**: La migration non è stata eseguita.
**Soluzione**: Ripetere il passo 2 (Eseguire la migration).

### "Errore di autenticazione / account non creato"
**Causa**: Possibilmente la password è troppo debole o l'email non è valida.
**Soluzione**: 
- Assicurati che la password sia almeno 6 caratteri
- Usa un'email valida
- Prova a fare refresh della pagina

### "I dati non si sincronizzano su un altro dispositivo"
**Causa**: Supabase realtime non è attivo o c'è un problema di connessione.
**Soluzione**: 
- Ricarica la pagina
- Assicurati che la connessione Internet sia stabile
- Controlla che il browser sia aggiornato (no IE11)

### "Come rimuovo un utente?"
**R**: Solo l'admin. Nella scheda "Permessi", cliccare il bottone rosso "Elimina utente" accanto al nome.

## Supporto

Per problemi, domande, o suggerimenti, contatta l'amministratore del CAF o apri un issue nel repository GitHub.

---

**Versione**: 1.0 (Supabase)  
**Ultimo aggiornamento**: 2026-10-02
