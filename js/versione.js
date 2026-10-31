/* ---------------- 🏷️ Versione del programma ----------------
   Numero della versione e storia delle novità. Si vede nell'intestazione verde accanto al titolo, in alto nella Guida
   e in Utenti e permessi (toccandola si aprono le novità).
   Come si numera: correzioni piccole → 1.0.1, 1.0.2…; funzioni nuove → 1.1, 1.2…; cambi grandi → 2.0.
   A ogni aggiornamento: nuova voce IN CIMA a STORIA_VERSIONI (la prima è la versione attuale) e tag git «vX.Y.Z». */

const STORIA_VERSIONI = [
  { versione: '1.1', data: '31/10/2026', titolo: 'Bilanci e confronto tra gli anni',
    novita: [
      'Contabilità → 📒 Bilanci e confronto tra gli anni: il bilancio di ogni anno salvato per sempre, tabella di tutti gli anni con le variazioni e grafici, stampa/PDF',
      'Il bilancio dell\'anno appena finito si salva da solo da gennaio a marzo; voce anche nel controllo di fine anno',
      'Ripristino delle copie di sicurezza: i bilanci entrano nelle copie',
    ] },
  { versione: '1.0.1', data: '31/10/2026', titolo: 'Correzione',
    novita: [
      'Archivio clienti: «Foglio successivo» e «Foglio precedente» vanno sempre di un foglio alla volta',
      'Doppio clic: il programma ignora il secondo clic (prima apriva per sbaglio il primo cliente dell\'archivio o saltava un foglio)',
      '«Svuota registro» diventa «🧨 Azzera tutti gli anni»: toglie anche versamenti, spese, acconti, ISEE, conte di cassa e scadenze; l\'archivio clienti resta',
    ] },
  { versione: '1.0', data: '31/10/2026', titolo: 'Prima versione completa, pronta per il 2027',
    novita: [
      'Registro di protocollo 730 e altre pratiche, numerazione per anno, congiunte, annullate, contratti colf e affitti',
      'Archivio clienti con documenti, scadenze, dati da controllare e anno precedente del cliente',
      'Contabilità, versamenti al CAF, spese sede, guadagno netto e confronto con l\'anno prima',
      'Messaggi WhatsApp ed e-mail: pratiche pronte, solleciti, documenti, campagna 730, auguri (un solo messaggio per numero)',
      'Scadenze colf e badanti con «Non rinnova» che chiude anche il contratto',
      'Copie di sicurezza ogni notte, ogni lunedì per e-mail e a fine anno; casella e-mail di riserva',
      'Battito del server da Vercel e da Supabase, controllo del mattino, spazio sul server, anni con più di 5 anni',
    ] },
];
const VERSIONE_PROGRAMMA = STORIA_VERSIONI[0].versione;
const DATA_VERSIONE = STORIA_VERSIONI[0].data;

function testoVersione() { return 'Versione ' + VERSIONE_PROGRAMMA + ' del ' + DATA_VERSIONE; }

function apriNovitaVersioni() {
  const vecchio = document.getElementById('popup-versioni'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-versioni';
  ov.style.cssText = 'position:fixed; inset:0; z-index:520; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:12px';
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-chiudi]')) ov.remove(); });
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:14px; border-top:6px solid #1d4f91; max-width:620px; width:100%; max-height:88vh; overflow:auto; padding:14px 16px; box-shadow:0 10px 40px rgba(0,0,0,.3)">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px"><b style="font-size:18px; color:#1d4f91">🏷️ Versioni del programma</b>'
    + '<button type="button" data-chiudi style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:6px 12px; cursor:pointer">✕</button></div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin:4px 0 8px">Stai usando la <b>versione ' + esc(VERSIONE_PROGRAMMA) + '</b>. Correzioni piccole: 1.0.1, 1.0.2…; funzioni nuove: 1.1, 1.2…</div>'
    + STORIA_VERSIONI.map(function (v, i) {
        return '<div style="padding:10px 4px; border-top:1px solid var(--line)"><b style="font-size:15px">' + esc(v.versione) + '</b> <span style="color:var(--sub); font-size:12.5px">del ' + esc(v.data) + (i === 0 ? ' · attuale' : '') + '</span>'
          + '<div style="font-weight:700; margin:2px 0 4px">' + esc(v.titolo) + '</div>'
          + '<ul style="margin:0; padding-left:20px; font-size:13px">' + v.novita.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>';
      }).join('')
    + '</div>';
  document.body.appendChild(ov);
}
// scritta del tasto in Utenti e permessi e della pastiglia nell'intestazione verde
document.addEventListener('DOMContentLoaded', function () {
  const el = document.getElementById('versione-programma'); if (el) el.textContent = testoVersione();
  const h = document.getElementById('hero-versione'); if (h) h.textContent = 'v' + VERSIONE_PROGRAMMA;
});
