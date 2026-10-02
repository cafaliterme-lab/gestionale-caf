#!/usr/bin/env node

/**
 * Script di importazione per migrare i dati dal vecchio sistema a Supabase
 * Uso: node scripts/importa-backup.mjs backup.json clienti.json
 *
 * Variabili d'ambiente richieste:
 *   SUPABASE_URL: URL del progetto Supabase (es. https://your-project.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY: Service role key (usare solo su server, mai client)
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Errore: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono obbligatori');
  console.error('Imposta le variabili d\'ambiente e riprova.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('❌ Uso: node scripts/importa-backup.mjs backup.json [clienti.json]');
    console.error('');
    console.error('Esempio:');
    console.error('  node scripts/importa-backup.mjs backup-2026-09-30.json clienti.json');
    process.exit(1);
  }

  const backupFile = args[0];
  const clientiFile = args[1] || null;

  // Leggi backup.json
  if (!fs.existsSync(backupFile)) {
    console.error(`❌ File non trovato: ${backupFile}`);
    process.exit(1);
  }

  console.log(`📂 Lettura backup da ${backupFile}...`);
  let backup;
  try {
    const content = fs.readFileSync(backupFile, 'utf-8');
    backup = JSON.parse(content);
  } catch (e) {
    console.error(`❌ Errore parsing JSON: ${e.message}`);
    process.exit(1);
  }

  // Leggi clienti.json (opzionale)
  let clientiExtra = [];
  if (clientiFile) {
    if (!fs.existsSync(clientiFile)) {
      console.error(`❌ File non trovato: ${clientiFile}`);
      process.exit(1);
    }

    console.log(`📂 Lettura clienti da ${clientiFile}...`);
    try {
      const content = fs.readFileSync(clientiFile, 'utf-8');
      clientiExtra = JSON.parse(content);
    } catch (e) {
      console.error(`❌ Errore parsing JSON: ${e.message}`);
      process.exit(1);
    }
  }

  // Prepara il payload per RPC
  const payload = {
    ...backup,
    clienti_extra: clientiExtra,
  };

  console.log(`\n📊 Dati da importare:`);
  console.log(`   - Pratiche: ${payload.pratiche?.length || 0}`);
  console.log(`   - Versamenti: ${payload.versamenti?.length || 0}`);
  console.log(`   - ISEE: ${payload.isee?.length || 0}`);
  console.log(`   - Clienti archivio: ${payload.clienti?.length || 0}`);
  console.log(`   - Clienti extra: ${clientiExtra.length}`);
  console.log(`   - Collaboratori: ${payload.collaboratori?.length || 0}`);

  console.log(`\n⏳ Importazione in corso...`);

  try {
    const { data, error } = await supabase.rpc('importa_backup', {
      dati: payload,
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log(`\n✅ Importazione completata!`);
    if (data) {
      console.log(`Risposta: ${JSON.stringify(data, null, 2)}`);
    }
  } catch (e) {
    console.error(`\n❌ Errore durante l'importazione: ${e.message}`);
    console.error(`\nSuggerimenti:`);
    console.error(`  1. Verifica che il progetto Supabase sia corretto`);
    console.error(`  2. Verifica che la migration 001_schema.sql sia stata eseguita`);
    console.error(`  3. Verifica che SUPABASE_SERVICE_ROLE_KEY sia corretta`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error(`❌ Errore non gestito: ${e.message}`);
  process.exit(1);
});
