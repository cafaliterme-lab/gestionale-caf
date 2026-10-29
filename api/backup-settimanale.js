// 💾 Ogni lunedì Vercel (vercel.json → crons) chiede a Supabase di mandare per e-mail alla casella del CAF
// l'ultimo backup compresso (funzione «backup-email»). La funzione manda solo alla casella del CAF e al massimo
// una volta ogni 5 giorni: questa chiamata usa solo la chiave pubblica del programma.
const SUPABASE_URL = 'https://mmaqmprukghyazlibphv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tYXFtcHJ1a2doeWF6bGlicGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDUyMTUsImV4cCI6MjEwNjUyMTIxNX0.ByRES--bYHZG6o_BX8Ha0YzqfcQIIr-D08Q-AbR8bhs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const r = await fetch(SUPABASE_URL + '/functions/v1/backup-email', { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } });
    const j = await r.json().catch(() => ({}));
    return res.status(r.ok ? 200 : 502).json(j);
  } catch (e) {
    return res.status(502).json({ error: String(e && e.message || e) });
  }
}
