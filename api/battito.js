// 💓 Battito quotidiano: Vercel lo chiama ogni giorno (vercel.json → crons) e fa una piccola lettura su Supabase.
// Così il progetto gratuito di Supabase non va in pausa dopo 7 giorni senza uso (Natale, agosto, chiusure lunghe).
// Usa solo la chiave pubblica del programma (la stessa di js/config.js): non legge né cambia dati riservati.
const SUPABASE_URL = 'https://mmaqmprukghyazlibphv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tYXFtcHJ1a2doeWF6bGlicGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDUyMTUsImV4cCI6MjEwNjUyMTIxNX0.ByRES--bYHZG6o_BX8Ha0YzqfcQIIr-D08Q-AbR8bhs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const inizio = Date.now();
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/impostazioni?select=chiave&limit=1', {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY }
    });
    return res.status(200).json({ ok: r.ok, stato: r.status, ms: Date.now() - inizio, quando: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ ok: false, errore: String(e && e.message || e) });
  }
}
