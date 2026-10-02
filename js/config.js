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

// Importa Supabase da CDN
const { createClient } = window.supabase;

// Crea il client Supabase (public/anon key - ok, perchè RLS protegge i dati)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
