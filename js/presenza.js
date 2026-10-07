/* ---------------- Chi è collegato (solo amministratore) ---------------- */
// Ogni programma aperto segnala al server la sua presenza ogni minuto (una "sessione" per apertura).
// L'amministratore vede in Utenti e permessi chi è collegato ora e l'ultimo collegamento di ognuno.

const SESSIONE_ID = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
const PRESENZA_MINUTI_ONLINE = 3;

function dispositivoAttuale() {
  const ua = navigator.userAgent || '';
  const so = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone/iPad' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : '';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  const tipo = /Mobi|Android|iPhone/i.test(ua) ? '📱' : '💻';
  return (tipo + ' ' + [so, br].filter(Boolean).join(' · ')).trim();
}

async function segnaPresenza() {
  if (typeof auth === 'undefined' || !auth.profilo || document.visibilityState === 'hidden') return;
  try { await supabase.rpc('segna_presenza', { p_sessione: SESSIONE_ID, p_dispositivo: dispositivoAttuale() }); } catch (e) { /* non blocca il lavoro */ }
}
setInterval(segnaPresenza, 60 * 1000);
setTimeout(segnaPresenza, 4000);
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') segnaPresenza(); });

function dataOraIT(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT') + ' alle ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
function tempoFa(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'adesso';
  if (min < 60) return min + ' min fa';
  const ore = Math.round(min / 60);
  if (ore < 24) return ore + (ore === 1 ? ' ora fa' : ' ore fa');
  const g = Math.round(ore / 24);
  return g + (g === 1 ? ' giorno fa' : ' giorni fa');
}
function durata(inizio, fine) {
  const min = Math.max(1, Math.round((new Date(fine) - new Date(inizio)) / 60000));
  return min < 60 ? min + ' min' : Math.floor(min / 60) + ' h ' + (min % 60) + ' min';
}

async function renderPresenze() {
  const box = document.getElementById('presenze-lista');
  if (!box) return;
  if (!auth.profilo || auth.profilo.ruolo !== 'admin') { box.innerHTML = ''; return; }
  const [sess, profili] = await Promise.all([
    supabase.from('sessioni').select('*').order('ultimo', { ascending: false }),
    typeof caricaTuttiProfili === 'function' ? caricaTuttiProfili() : Promise.resolve([])
  ]);
  if (sess.error) { box.innerHTML = '<div class="empty">Errore nel caricamento: ' + esc(sess.error.message) + '</div>'; return; }
  const sessioni = sess.data || [];
  const limite = Date.now() - PRESENZA_MINUTI_ONLINE * 60000;
  const online = function (s) { return new Date(s.ultimo).getTime() >= limite; };
  const utenti = (profili || []).map(function (u) {
    const sue = sessioni.filter(function (s) { return s.utente_id === u.id; });
    return { u: u, ultima: sue[0] || null, attive: sue.filter(online) };
  }).sort(function (a, b) {
    return (b.attive.length - a.attive.length) || (new Date((b.ultima || {}).ultimo || 0) - new Date((a.ultima || {}).ultimo || 0));
  });
  const nOnline = utenti.filter(function (x) { return x.attive.length; }).length;
  box.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px">'
    + '<b style="font-size:15px">🟢 Collegati ora: ' + nOnline + '</b>'
    + '<button type="button" onclick="renderPresenze()" style="padding:5px 12px">🔄 Aggiorna</button></div>'
    + '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th>Utente</th><th>Stato</th><th>Ultimo collegamento</th><th>Dispositivo</th></tr></thead><tbody>'
    + utenti.map(function (x) {
      const s = x.attive[0] || x.ultima;
      return '<tr><td><b>' + esc(x.u.nome || x.u.email || '') + '</b><div class="sub2">' + esc(x.u.ruolo === 'admin' ? 'Amministratore' : (x.u.sola_lettura ? 'Sola consultazione' : 'Operatore')) + '</div></td>'
        + '<td style="white-space:nowrap">' + (x.attive.length ? '<b style="color:#2f9e5f">🟢 Collegato</b><div class="sub2">da ' + durata(x.attive[x.attive.length - 1].inizio, new Date().toISOString()) + '</div>' : '<span style="color:var(--sub)">⚪ Non collegato</span>') + '</td>'
        + '<td>' + (x.ultima ? dataOraIT(x.ultima.ultimo) + '<div class="sub2">' + tempoFa(x.ultima.ultimo) + '</div>' : '<span style="color:var(--sub)">Mai collegato</span>') + '</td>'
        + '<td>' + (s ? esc(s.dispositivo || '-') + (x.attive.length > 1 ? '<div class="sub2">aperto su ' + x.attive.length + ' dispositivi</div>' : '') : '-') + '</td></tr>';
    }).join('') + '</tbody></table></div>'
    + '<details style="margin-top:10px"><summary style="cursor:pointer; font-weight:700; color:var(--sub)">📋 Ultimi accessi (' + Math.min(30, sessioni.length) + ')</summary>'
    + (sessioni.length ? '<div class="tab-wrap" style="margin-top:6px"><table class="tab-proto"><thead><tr><th>Utente</th><th>Entrato</th><th>Ultima attività</th><th>Durata</th><th>Dispositivo</th></tr></thead><tbody>'
      + sessioni.slice(0, 30).map(function (s) {
        return '<tr><td>' + (online(s) ? '🟢 ' : '') + esc(s.nome || '') + '</td><td>' + dataOraIT(s.inizio) + '</td><td>' + dataOraIT(s.ultimo) + '</td><td>' + durata(s.inizio, s.ultimo) + '</td><td>' + esc(s.dispositivo || '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty">Nessun accesso registrato</div>')
    + '</details>'
    + '<div style="font-size:12px; color:var(--sub); margin-top:8px">"Collegato" = programma aperto negli ultimi ' + PRESENZA_MINUTI_ONLINE + ' minuti. Gli accessi si registrano da quando è attiva questa funzione.</div>';
}
// Mentre l'amministratore guarda Utenti e permessi l'elenco si aggiorna da solo
setInterval(function () {
  const sez = document.getElementById('tab-permessi');
  if (sez && sez.classList.contains('active') && document.visibilityState === 'visible') renderPresenze();
}, 60 * 1000);
