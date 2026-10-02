/**
 * Configurazione Supabase
 *
 * Durante l'installazione:
 * 1. Andare su https://app.supabase.com e creare un nuovo progetto
 * 2. Copiare l'URL del progetto e la chiave anonima
 * 3. Sostituire i valori qui sotto
 *
 * La chiave anonima è pubblica per natura (sta nell'HTML client).
 * Le operazioni sensibili (creazione utenti, reimposta password) usano
 * una service-role key che sta solo nel server (Edge Function).
 */

const SUPABASE_URL = 'https://mmaqmprukghyazlibphv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tYXFtcHJ1a2doeWF6bGlicGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDUyMTUsImV4cCI6MjEwNjUyMTIxNX0.ByRES--bYHZG6o_BX8Ha0YzqfcQIIr-D08Q-AbR8bhs';

// Importa Supabase da CDN - con polling robusto
let supabase;
let supabaseReady = false;

async function initSupabase() {
  // Polling per aspettare che Supabase sia disponibile
  for (let i = 0; i < 50; i++) {
    if (window.supabase?.createClient) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      supabaseReady = true;
      console.log('✓ Supabase inizializzato correttamente');
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.error('CRITICO: Supabase non disponibile dopo 5 secondi');
  document.body.innerHTML = '<div style="padding:20px; color:red; font-family:sans-serif;"><h2>Errore di connessione</h2><p>Non riesco a caricare la libreria Supabase. Prova:</p><ol><li>Ricarica la pagina</li><li>Controlla la tua connessione Internet</li><li>Svuota la cache del browser (Ctrl+Shift+Delete)</li></ol></div>';
  return false;
}

// Inizializza subito
initSupabase();
