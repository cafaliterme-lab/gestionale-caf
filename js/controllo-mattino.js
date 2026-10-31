/* ---------------- 💓 Controllo del mattino (solo amministratore) ----------------
   Al primo accesso del giorno (su ogni PC o telefono) compare in basso a destra un riquadro con lo stato
   delle cose automatiche che tengono vivo e al sicuro il programma:
   - 💓 battito di Vercel (api/battito.js → impostazioni.battito_vercel) e di riserva quello di Supabase stesso
     (pg_cron «battito-supabase» → impostazioni.battito_supabase): tengono sveglio Supabase, basta che ne parta uno;
   - 💾 copia di sicurezza notturna (backup_automatici);
   - 📧 copia per e-mail del lunedì (impostazioni.backup_email_ultimo);
   - 💽 spazio sul server.
   Se è tutto a posto è verde e si chiude da solo; se qualcosa non va resta aperto, in rosso, con cosa fare.
   Si apre anche a mano da Utenti e permessi («💓 Controllo del mattino»). */

const ORE_BATTITO_OK = 36, ORE_BACKUP_OK = 36, GIORNI_EMAIL_OK = 8;

function quandoMattino(t) {
  if (!t) return 'mai';
  const d = new Date(t), oggi = new Date(), ieri = new Date(); ieri.setDate(ieri.getDate() - 1);
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === oggi.toDateString()) return 'oggi alle ' + ora;
  if (d.toDateString() === ieri.toDateString()) return 'ieri alle ' + ora;
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) + ' alle ' + ora;
}
async function vociControlloMattino() {
  const voci = [];
  const leggi = async function (chiave) {
    const r = await fetchSupabase('/rest/v1/impostazioni?select=valore&chiave=eq.' + chiave);
    return r && r.ok && r.data && r.data[0] ? Date.parse(r.data[0].valore) || 0 : 0;
  };
  const ore = function (t) { return t ? (Date.now() - t) / 3600000 : Infinity; };
  try {
    // due battiti: Vercel (prima delle 6) e, di riserva, Supabase stesso (verso le 6:23); basta che ne parta uno
    const tv = await leggi('battito_vercel'), ts = await leggi('battito_supabase');
    const vOk = ore(tv) < ORE_BATTITO_OK, sOk = ore(ts) < ORE_BATTITO_OK;
    const riga = function (nome, t) { return nome + ' ' + (t ? quandoMattino(t) : 'non ancora registrato'); };
    voci.push({ icona: '💓', titolo: 'Battito del server', ok: vOk || sOk,
      testo: riga('Vercel', tv) + ' · ' + riga('Supabase', ts) + '. '
        + (vOk && sOk ? 'Il server resta sveglio.'
          : vOk || sOk ? 'Il server resta sveglio, ma il battito di ' + (vOk ? 'Supabase' : 'Vercel') + ' non è partito: ' + (vOk ? 'se domani è ancora così, controlla in Supabase → Integrations → Cron.' : 'quando puoi controlla Vercel → progetto gestionale-caf → Settings → Cron Jobs («/api/battito» attivo).')
          : 'Nessuno dei due battiti è partito: controlla Vercel → Settings → Cron Jobs. Finché usi il programma ogni giorno il server resta sveglio lo stesso.') });
  } catch (e) {}
  try {
    const r = await fetchSupabase('/rest/v1/backup_automatici?select=creato_il&order=creato_il.desc&limit=1');
    const t = r && r.ok && r.data && r.data[0] ? Date.parse(r.data[0].creato_il) : 0;
    voci.push({ icona: '💾', titolo: 'Copia di sicurezza notturna', ok: ore(t) < ORE_BACKUP_OK,
      testo: ore(t) < ORE_BACKUP_OK ? 'Fatta ' + quandoMattino(t) + '.' : 'L\'ultima è di ' + quandoMattino(t) + ': fanne una adesso da Utenti e permessi → 💾 Crea un backup adesso.' });
  } catch (e) {}
  try {
    const t = await leggi('backup_email_ultimo');
    voci.push({ icona: '📧', titolo: 'Copia per e-mail del lunedì', ok: ore(t) < GIORNI_EMAIL_OK * 24,
      testo: ore(t) < GIORNI_EMAIL_OK * 24 ? 'Ultima partita ' + quandoMattino(t) + '.' : 'L\'ultima è partita ' + quandoMattino(t) + ': mandala a mano da Utenti e permessi → 📧 Copia per e-mail.' });
  } catch (e) {}
  try {
    const d = typeof caricaSpazio === 'function' ? await caricaSpazio() : null;
    if (d) { const p = percentualeSpazio(d); voci.push({ icona: '💽', titolo: 'Spazio sul server', ok: p < 70, testo: 'Usati ' + fmtSpazio(d.totale) + ' su ' + fmtSpazio(d.limite) + ' (' + Math.round(p) + '%).' + (p >= 70 ? ' Valuta di togliere gli anni con più di 5 anni.' : '') }); }
  } catch (e) {}
  return voci;
}
async function apriControlloMattino(aMano) {
  const id = 'controllo-mattino';
  const vecchio = document.getElementById(id); if (vecchio) vecchio.remove();
  const voci = await vociControlloMattino();
  if (!voci.length) return;
  const male = voci.filter(function (v) { return !v.ok; }).length;
  const colore = male ? '#c0392b' : '#1a7f37';
  const box = document.createElement('div');
  box.id = id;
  box.style.cssText = 'position:fixed; right:16px; bottom:16px; z-index:386; width:min(430px, calc(100vw - 24px)); background:var(--card); color:var(--ink); border:2px solid ' + colore + '; border-radius:14px; box-shadow:0 10px 30px rgba(0,0,0,.25); padding:12px 14px; font-size:13px; max-height:80vh; overflow:auto';
  box.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px"><b style="font-size:15px; color:' + colore + '">' + (male ? '⚠️ Controllo del mattino: ' + male + (male === 1 ? ' cosa da guardare' : ' cose da guardare') : '✅ Controllo del mattino: tutto a posto') + '</b>'
    + '<button type="button" data-chiudi style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:4px 10px; cursor:pointer">✕</button></div>'
    + voci.map(function (v) {
        return '<div style="display:flex; gap:8px; padding:6px 0; border-top:1px solid var(--line)"><span style="font-size:17px">' + (v.ok ? '✅' : v.icona) + '</span><span><b style="color:' + (v.ok ? '#1a7f37' : '#c0392b') + '">' + esc(v.titolo) + '</b><div style="color:var(--sub)">' + esc(v.testo) + '</div></span></div>';
      }).join('');
  box.querySelector('[data-chiudi]').onclick = function () { box.remove(); };
  document.body.appendChild(box);
  // tutto a posto: si chiude da solo dopo 20 secondi (se non lo si apre a mano)
  if (!male && !aMano) setTimeout(function () { if (box.isConnected) box.remove(); }, 20000);
}
// al primo accesso del giorno dell'amministratore, una volta per ogni PC o telefono
(function () {
  const oggi = function () { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const prova = function () {
    if (typeof isAdmin !== 'function' || !isAdmin() || document.hidden) return;
    let visto = ''; try { visto = localStorage.getItem('controllo-mattino-giorno') || ''; } catch (e) {}
    if (visto === oggi()) return;
    try { localStorage.setItem('controllo-mattino-giorno', oggi()); } catch (e) {}
    apriControlloMattino(false);
  };
  setTimeout(prova, 6000); setInterval(prova, 60000);
})();
