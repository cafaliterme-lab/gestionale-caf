# Guida per Sviluppatori — Gestionale CAF su Supabase

Questa guida è per gli sviluppatori che vogliono:
- Testare l'applicazione localmente
- Importare dati dal vecchio sistema
- Contribuire a nuove funzionalità

## Prerequisiti

- **Node.js** v18+
- **Git** installato
- **Account Supabase** (gratuito su [supabase.com](https://app.supabase.com))
- **Supabase CLI** (opzionale, per `supabase start`)

## Setup Locale

### 1. Clonare il repository

```bash
git clone https://github.com/cafaliterme-lab/gestionale-caf.git
cd gestionale-caf
```

### 2. Installare dipendenze

```bash
npm install
```

Questo installa `@supabase/supabase-js` necessario per lo script di importazione.

### 3. Creazione progetto Supabase

1. Andare su https://app.supabase.com
2. Creare un nuovo progetto
3. Copiare **Project URL** e **anon key** (non service role key)
4. Salvare in `.env.local`:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

### 4. Eseguire la migration

1. Nel dashboard Supabase, andare a **SQL Editor**
2. Cliccare **New query**
3. Copiare il contenuto di `supabase/migrations/001_schema.sql`
4. Eseguire (**Run**)

### 5. Configurare js/config.js

Creare o modificare `js/config.js`:

```javascript
// js/config.js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

### 6. Aprire l'app

Servire localmente:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node http-server (installa con: npm install -g http-server)
http-server

# Con Ruby
ruby -run -ehttpd . -p8000
```

Aprire http://localhost:8000/index.html

### 7. Creare primo account

1. Cliccare il link di login
2. Cliccare "Crea nuovo account"
3. Inserire email e password
4. **Nota**: Il primo account diventa automaticamente **admin**

## Importazione Dati

Se hai un backup dal vecchio sistema:

### Preparare i file

1. **Esportare backup**: Dalla vecchia applicazione, cliccare "Esporta Backup (JSON)" e salvare come `backup.json`
2. **Esportare clienti** (opzionale): Se disponibile, salvare clienti in `clienti.json`

**⚠️ Attenzione**: Questi file contengono dati personali (nomi, date di nascita, telefoni). Non committarli a Git! (`.gitignore` li esclude automaticamente)

### Ottenere Service Role Key

La service role key deve stare solo sul server (non nel browser). Per l'importazione locale:

1. Nel dashboard Supabase, andare a **Settings** → **API**
2. Sotto **Project API keys**, trovare **Service role** (la chiave segreta)
3. Copiare la chiave

### Eseguire importazione

```bash
# Impostare le variabili d'ambiente
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Eseguire l'importazione
node scripts/importa-backup.mjs backup.json clienti.json

# O solo backup senza clienti
node scripts/importa-backup.mjs backup.json
```

**Output atteso**:
```
📂 Lettura backup da backup.json...
📂 Lettura clienti da clienti.json...

📊 Dati da importare:
   - Pratiche: 150
   - Versamenti: 45
   - ISEE: 30
   - Clienti archivio: 200
   - Clienti extra: 50
   - Collaboratori: 8

⏳ Importazione in corso...

✅ Importazione completata!
```

## Testing Locale con Supabase

Per testare con un database locale (senza account Supabase):

### Installare Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Linux (scarica da https://github.com/supabase/cli/releases)
# Windows (scarica dall'URL sopra o usa WSL)
```

### Avviare database locale

```bash
supabase start
```

Questo avvia:
- PostgreSQL locale su `localhost:54322`
- Supabase Studio su `http://localhost:54323`
- API su `http://localhost:54321`

**Nota**: Copia l'`anon key` e `service role key` mostrati dal comando

### Eseguire migration locale

Nella UI Supabase Studio (localhost:54323):
1. Andare a **SQL**
2. Eseguire il contenuto di `supabase/migrations/001_schema.sql`

### Configurare app per locale

Creare `js/config-local.js` o modificare `js/config.js`:

```javascript
const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // da supabase start
```

### Fermare Supabase local

```bash
supabase stop
```

Per eliminare il database:
```bash
supabase stop --remove-all
```

## Deployment Edge Function

La Edge Function `supabase/functions/admin-utenti/` gestisce operazioni admin server-side (crea utente, elimina, reset password).

### Deploy manuale

```bash
# Se usi Supabase CLI
supabase functions deploy admin-utenti --project-id your-project-id

# Oppure nel dashboard Supabase:
# 1. Andare a Edge Functions
# 2. Cliccare "Create a new function"
# 3. Copiare il contenuto di supabase/functions/admin-utenti/index.ts
```

### Test della Edge Function (locale)

```bash
supabase start

# In un altro terminale
supabase functions serve admin-utenti

# Testare con curl
curl -X POST http://localhost:54321/functions/v1/admin-utenti/create-user \
  -H "Authorization: Bearer your-access-token" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123", "nome": "Test User"}'
```

## Test End-to-End

Con Playwright (v18+):

```bash
# Installare Playwright (Chromium è già nel container)
npm install --save-dev @playwright/test

# Eseguire test
npx playwright test

# Con UI
npx playwright test --ui
```

Test scenario:
1. Login Angelo → diventa admin
2. Crea pratica, numero auto-assegnato
3. Cambio stato, versamento
4. Login Federica, vede solo schede assegnate
5. Realtime sync su due browser
6. Export Excel/Backup
7. RLS: Federica non legge versamenti senza permesso

## Struttura Progetto

```
gestionale-caf/
├── index.html                         ← UI (il file originale)
├── js/
│   ├── config.js                      ← Credenziali Supabase (edit qui!)
│   ├── auth.js                        ← Autenticazione e profili
│   ├── data.js                        ← CRUD e realtime
│   └── app.js                         ← Logica app (modificato)
├── supabase/
│   ├── migrations/
│   │   └── 001_schema.sql             ← Schema database
│   └── functions/
│       └── admin-utenti/
│           └── index.ts               ← Edge Function
├── scripts/
│   └── importa-backup.mjs             ← Import script
├── tests/
│   ├── db/
│   │   ├── test.sql                   ← Test unitari
│   │   ├── supabase-stub.sql          ← Mock auth layer
│   │   └── run.sh                     ← Test runner
│   └── e2e/
│       └── app.spec.ts                ← Test Playwright (TODO)
├── package.json                       ← Dipendenze
├── .gitignore                         ← PII protetto (backup*.json)
├── README.md                          ← User guide
└── DEVELOPMENT.md                     ← Questa guida
```

## Troubleshooting

### "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obbligatori"

Il server non trova le credenziali. Verifica:
```bash
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Se vuote, impostale:
export SUPABASE_URL="https://..."
export SUPABASE_SERVICE_ROLE_KEY="..."
```

### "Errore: tabella pratiche non trovata"

La migration non è stata eseguita. Ripeti il paso 4 (eseguire SQL).

### "Unauthorized" dal browser

- La `anon key` non è valida → copia di nuovo da Supabase
- La sessione è scaduta → logout e login di nuovo
- CORS bloccato → controlla che il dominio sia consentito

### "Error: SOCKET_TIMEOUT" con Supabase local

Il database local ha timeout. Prova:
```bash
supabase stop --remove-all
supabase start
```

### Test Playwright non si avvia

```bash
# Installa Playwright correttamente
npm install @playwright/test
npx playwright install

# Se usi container senza GUI:
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# Usa Chromium preinstallato in /opt/pw-browsers/
```

## Risorse

- [Supabase Docs](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security)
- [Realtime Subscriptions](https://supabase.com/docs/guides/realtime)
- [Playwright Docs](https://playwright.dev/)

## Contatti

Per problemi tecnici, aprire un issue su GitHub.

---

**Ultimo aggiornamento**: 2026-10-02  
**Branch**: `claude/great-albattani-2ox788`
