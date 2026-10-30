// 💓 Battito quotidiano: Vercel lo chiama ogni giorno (vercel.json → crons) e fa una piccola lettura su Supabase.
// Così il progetto gratuito di Supabase non va in pausa dopo 7 giorni senza uso (Natale, agosto, chiusure lunghe).
// Usa solo la chiave pubblica del programma (la stessa di js/config.js): non legge né cambia dati riservati.
// Segna l'ora del battito (funzione registra_battito → impostazioni.battito_ultimo): il programma la mostra
// all'amministratore nel controllo del mattino (js/controllo-mattino.js).
const SUPABASE_URL = 'https://mmaqmprukghyazlibphv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tYXFtcHJ1a2doeWF6bGlicGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDUyMTUsImV4cCI6MjEwNjUyMTIxNX0.ByRES--bYHZG6o_BX8Ha0YzqfcQIIr-D08Q-AbR8bhs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const inizio = Date.now();
  try {
    const h = { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    let r = await fetch(SUPABASE_URL + '/rest/v1/rpc/registra_battito', { method: 'POST', headers: h, body: '{}' });
    // se la funzione non risponde, basta una piccola lettura per tenere sveglio il progetto
    if (!r.ok) r = await fetch(SUPABASE_URL + '/rest/v1/impostazioni?select=chiave&limit=1', { headers: h });
    return res.status(200).json({ ok: r.ok, stato: r.status, ms: Date.now() - inizio, quando: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ ok: false, errore: String(e && e.message || e) });
  }
}
