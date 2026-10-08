/* ---------------- Chat interna e compiti da spuntare (fra gli utenti del programma) ---------------- */
// Tasto 💬 in basso a destra: messaggi a tutti o a una persona; i "📌 compiti" restano in evidenza
// sullo schermo di chi li riceve finché qualcuno non li spunta come fatti.

let CHAT = { messaggi: [], utenti: [], aperta: false, scheda: 'chat', ultimoVisto: null, avvisati: {} };

// L'amministratore la usa sempre; gli altri se è attiva (Utenti e permessi) e se non gli è stata tolta
function chatAbilitataQui() {
  const u = auth.profilo;
  if (!u) return false;
  if (u.ruolo === 'admin') return true;
  return (typeof IMPOSTAZIONI === 'undefined' || IMPOSTAZIONI.chat_attiva !== 'no') && !(u.tabs && u.tabs.chat === false);
}
// Sollecito: un compito non fatto entro un giorno diventa rosso e ricompare a video
function giorniRitardo(m) {
  if (!m.compito || m.fatto) return 0;
  return Math.floor((Date.now() - new Date(m.creato_il).getTime()) / 86400000);
}
function chatLetti() { try { return localStorage.getItem('chat-letti-' + ((auth.profilo || {}).id || '')) || ''; } catch (e) { return ''; } }
function chatSegnaLetti() {
  const ultimo = CHAT.messaggi.length ? CHAT.messaggi[0].creato_il : '';
  try { if (ultimo) localStorage.setItem('chat-letti-' + auth.profilo.id, ultimo); } catch (e) { }
}
function chatPerMe(m) { return !m.a_id || m.a_id === auth.profilo.id; }
function chatCompitiAperti() { return CHAT.messaggi.filter(function (m) { return m.compito && !m.fatto && chatPerMe(m); }); }
// compiti che ho mandato ad altri e che non sono ancora stati fatti
function chatCompitiInviatiAperti() { return CHAT.messaggi.filter(function (m) { return m.compito && !m.fatto && m.da_id === auth.profilo.id && m.a_id && m.a_id !== auth.profilo.id; }); }
function chatNonLetti() {
  const l = chatLetti();
  return CHAT.messaggi.filter(function (m) { return m.da_id !== auth.profilo.id && chatPerMe(m) && (!l || m.creato_il > l); });
}
function oraChat(iso) {
  const d = new Date(iso), oggi = new Date();
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === oggi.toDateString() ? ora : d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) + ' ' + ora;
}

async function caricaChat() {
  if (typeof auth === 'undefined' || !auth.profilo || !chatAbilitataQui()) { chiudiChat(); disegnaBottoneChat(); disegnaCompitiAVideo(); return; }
  // cambio di utente sullo stesso PC: si riparte da zero
  if (CHAT.chi !== auth.profilo.id) { CHAT = { messaggi: [], utenti: [], aperta: false, scheda: 'chat', avvisati: {}, chi: auth.profilo.id }; const p = document.getElementById('chat-pannello'); if (p) p.remove(); }
  try {
    const r = await fetchSupabase('/rest/v1/messaggi_interni?select=*&order=creato_il.desc&limit=300', 'GET');
    if (!r.ok || !Array.isArray(r.data)) return;
    const prima = CHAT.messaggi.length ? CHAT.messaggi[0].creato_il : null;
    // messaggi che ho tolto dalla mia chat (gli altri li vedono ancora)
    const n = await fetchSupabase('/rest/v1/messaggi_nascosti?select=messaggio_id', 'GET');
    if (n.ok && Array.isArray(n.data)) CHAT.nascosti = n.data.map(function (x) { return x.messaggio_id; });
    const nasc = CHAT.nascosti || [];
    CHAT.messaggi = r.data.filter(function (m) { return nasc.indexOf(m.id) < 0; });
    const u = await fetchSupabase('/rest/v1/rpc/elenco_utenti', 'POST', {});
    if (u.ok && Array.isArray(u.data)) CHAT.utenti = u.data;
    // messaggio nuovo arrivato mentre la chat è chiusa: avviso a video
    if (prima && !CHAT.aperta) {
      const nuovi = CHAT.messaggi.filter(function (m) { return m.creato_il > prima && m.da_id !== auth.profilo.id && chatPerMe(m) && !m.compito; });
      if (nuovi.length && typeof avviso === 'function') avviso('💬 ' + nuovi[0].da_nome + ': ' + nuovi[0].testo.slice(0, 80));
    }
    controllaRicevuteCompiti();
    disegnaBottoneChat();
    disegnaCompitiAVideo();
    if (CHAT.aperta) disegnaChat();
  } catch (e) { /* la chat non deve bloccare il lavoro */ }
}
setInterval(function () { if (document.visibilityState === 'visible') caricaChat(); }, 15000);
setTimeout(caricaChat, 3000);
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') caricaChat(); });

function disegnaBottoneChat() {
  let b = document.getElementById('chat-bottone');
  if (typeof auth === 'undefined' || !auth.profilo || !chatAbilitataQui()) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement('button');
    b.id = 'chat-bottone';
    b.type = 'button';
    b.onclick = function () { if (CHAT.aperta) chiudiChat(); else apriChat(); };
    // in alto, accanto all'anno di protocollo (se lo spazio non c'e' resta in basso a destra)
    const slot = document.getElementById('chat-slot');
    b.style.cssText = slot
      ? 'width:100%; border:none; border-radius:12px; padding:10px 16px; background:linear-gradient(90deg,#1d4f91,#00612f); color:#fff; font-weight:800; font-size:16px; box-shadow:0 6px 18px rgba(29,79,145,.3); cursor:pointer; text-align:left'
      : 'position:fixed; right:16px; bottom:16px; z-index:350; border:none; border-radius:999px; padding:12px 18px; background:#1d4f91; color:#fff; font-weight:800; font-size:15px; box-shadow:0 8px 24px rgba(0,0,0,.25); cursor:pointer';
    (slot || document.body).appendChild(b);
  }
  const n = chatNonLetti().length, c = chatCompitiAperti().length, sol = chatCompitiAperti().filter(function (m) { return giorniRitardo(m) >= 1; }).length;
  const inv = chatCompitiInviatiAperti().length;
  // il contatore cambia colore per un attimo quando aumenta o diminuisce
  const tot = c + inv;
  if (CHAT.ultimoTot != null && CHAT.ultimoTot !== tot) { b.style.transition = 'box-shadow .3s'; b.style.boxShadow = '0 0 0 4px ' + (tot > CHAT.ultimoTot ? '#d4881c' : '#2f9e5f'); setTimeout(function () { b.style.boxShadow = '0 6px 18px rgba(29,79,145,.3)'; }, 1500); }
  CHAT.ultimoTot = tot;
  b.innerHTML = '💬 CHAT INTERNA' + (n ? ' <span style="background:#c0392b; border-radius:999px; padding:1px 9px; margin:2px 0 2px 6px; display:inline-block; white-space:nowrap; font-size:14px">' + n + ' nuov' + (n === 1 ? 'o' : 'i') + '</span>' : '') + (c ? ' <span style="background:#d4881c; border-radius:999px; padding:1px 9px; margin:2px 0 2px 6px; display:inline-block; white-space:nowrap; font-size:14px">📌 ' + c + ' da fare</span>' : '') + (inv ? ' <span style="background:#6b7280; border-radius:999px; padding:1px 9px; margin:2px 0 2px 6px; display:inline-block; white-space:nowrap; font-size:14px" title="Compiti che hai mandato e non sono ancora stati fatti">📤 ' + inv + ' in attesa</span>' : '') + (sol ? ' <span style="background:#c0392b; border-radius:999px; padding:1px 9px; margin:2px 0 2px 6px; display:inline-block; white-space:nowrap; font-size:14px">⏰ ' + sol + ' sollecit' + (sol === 1 ? 'o' : 'i') + '</span>' : '') + '<span style="float:right; opacity:.85; font-size:13px">' + (CHAT.aperta ? 'chiudi ✕' : 'apri ›') + '</span>';
}

// I compiti da fare compaiono a video (in alto) finché non vengono spuntati
function disegnaCompitiAVideo() {
  let box = document.getElementById('chat-compiti-video');
  if (typeof auth === 'undefined' || !auth.profilo || !chatAbilitataQui()) { if (box) box.remove(); return; }
  // "Più tardi" nasconde il compito; se è un sollecito (più di un giorno) ricompare dopo un'ora
  const lista = chatCompitiAperti().filter(function (m) { const t = CHAT.avvisati[m.id]; return !t || (giorniRitardo(m) >= 1 && Date.now() - t > 60 * 60000); })
    .sort(function (a, b) { return giorniRitardo(b) - giorniRitardo(a); });
  if (!lista.length || CHAT.aperta) { if (box) box.remove(); return; }
  if (!box) {
    box = document.createElement('div');
    box.id = 'chat-compiti-video';
    box.style.cssText = 'position:fixed; top:12px; left:50%; transform:translateX(-50%); z-index:360; width:min(560px, calc(100vw - 24px)); display:flex; flex-direction:column; gap:8px';
    document.body.appendChild(box);
  }
  box.innerHTML = lista.slice(0, 3).map(function (m) {
    const g = giorniRitardo(m);
    return '<div style="background:' + (g ? '#fdecea' : '#fff7e6') + '; color:' + (g ? '#7f1d1d' : '#5c3d00') + '; border:' + (g ? '3px solid #c0392b' : '2px solid #d4881c') + '; border-radius:14px; padding:10px 12px; box-shadow:0 10px 30px rgba(0,0,0,.2)">'
      + (g ? '<div style="font-size:13px; font-weight:900; color:#c0392b; letter-spacing:.03em">⏰ SOLLECITO – non ancora fatto da ' + g + (g === 1 ? ' giorno' : ' giorni') + '</div>' : '')
      + '<div style="font-size:12px; font-weight:700">📌 Compito da ' + esc(m.da_nome) + (m.a_id ? '' : ' (per tutti)') + ' · ' + oraChat(m.creato_il) + '</div>'
      + '<div style="font-size:15px; font-weight:700; margin:4px 0 8px; white-space:pre-wrap">' + esc(m.testo) + '</div>'
      + '<div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end">'
      + '<button type="button" onclick="CHAT.avvisati[\'' + m.id + '\']=Date.now(); disegnaCompitiAVideo()" style="padding:5px 12px; background:var(--line); color:#333">Più tardi</button>'
      + '<button type="button" onclick="apriChat(\'compiti\')" style="padding:5px 12px; background:#1d4f91; color:#fff">💬 Rispondi</button>'
      + '<button type="button" onclick="segnaCompito(\'' + m.id + '\', true)" style="padding:5px 12px; background:#2f9e5f; color:#fff; font-weight:800">✓ Fatto</button></div></div>';
  }).join('') + (lista.length > 3 ? '<div style="text-align:center; font-size:12px; background:#fff7e6; border-radius:10px; padding:4px">… e altri ' + (lista.length - 3) + ' compiti nella chat</div>' : '');
}

// Ricevuta per chi ha mandato il compito: quando un altro lo spunta come fatto compare un avviso a video
function controllaRicevuteCompiti() {
  const chiave = 'chat-ricevute-' + auth.profilo.id;
  const miei = CHAT.messaggi.filter(function (m) { return m.compito && m.fatto && m.da_id === auth.profilo.id; });
  let visti = null;
  try { visti = JSON.parse(localStorage.getItem(chiave) || 'null'); } catch (e) { }
  if (!Array.isArray(visti)) {   // prima volta su questo PC: non si avvisa per i compiti già fatti in passato
    try { localStorage.setItem(chiave, JSON.stringify(miei.map(function (m) { return m.id; }))); } catch (e) { }
    return;
  }
  const nuovi = miei.filter(function (m) { return visti.indexOf(m.id) < 0 && m.fatto_da && m.fatto_da.toUpperCase() !== (auth.profilo.nome || '').toUpperCase(); });
  if (!nuovi.length) return;
  try { localStorage.setItem(chiave, JSON.stringify(visti.concat(nuovi.map(function (m) { return m.id; })).slice(-500))); } catch (e) { }
  mostraRicevuteCompiti(nuovi);
}
function mostraRicevuteCompiti(lista) {
  let ov = document.getElementById('chat-ricevute');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'chat-ricevute';
  ov.style.cssText = 'position:fixed; inset:0; z-index:495; background:rgba(15,27,45,.45); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #2f9e5f; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:20px 22px; max-width:460px; width:100%">'
    + '<div style="font-size:20px; font-weight:800; color:#2f9e5f; margin-bottom:8px">✅ Compito' + (lista.length > 1 ? 'i' : '') + ' eseguit' + (lista.length > 1 ? 'i' : 'o') + '</div>'
    + lista.map(function (m) {
      return '<div style="padding:8px 10px; border-radius:10px; background:#e8f6ee; margin-bottom:8px"><div style="font-size:15px; font-weight:700; white-space:pre-wrap">' + esc(m.testo) + '</div>'
        + '<div style="font-size:12.5px; color:#1f6b40">✓ Fatto da <b>' + esc(m.fatto_da) + '</b>' + (m.fatto_il ? ' il ' + oraChat(m.fatto_il) : '') + '</div></div>';
    }).join('')
    + '<div style="text-align:right; margin-top:6px"><button type="button" style="background:#2f9e5f; color:#fff; font-weight:800; min-width:100px">OK</button></div></div>';
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.tagName === 'BUTTON') ov.remove(); });
  document.body.appendChild(ov);
}

// Riepilogo numerico dei compiti: sale quando se ne inseriscono, scende quando vengono fatti
function contatoreCompitiHTML() {
  const perMe = chatCompitiAperti().length, inviati = chatCompitiInviatiAperti().length;
  const oggi = new Date().toDateString();
  const fattiOggi = CHAT.messaggi.filter(function (m) { return m.compito && m.fatto && m.fatto_il && new Date(m.fatto_il).toDateString() === oggi && (chatPerMe(m) || m.da_id === auth.profilo.id); }).length;
  const casella = function (n, t, col) { return '<div style="flex:1; text-align:center; padding:6px 4px; border-radius:10px; background:' + col + '; color:#fff"><div style="font-size:20px; font-weight:900; line-height:1.1">' + n + '</div><div style="font-size:10.5px; font-weight:700; text-transform:uppercase">' + t + '</div></div>'; };
  return '<div style="display:flex; gap:6px; padding:8px 10px; background:var(--card); border-bottom:1px solid var(--line)">'
    + casella(perMe, 'Da fare per te', perMe ? '#d4881c' : '#8a8f98')
    + casella(inviati, 'Inviati in attesa', inviati ? '#6b7280' : '#8a8f98')
    + casella(fattiOggi, 'Fatti oggi', fattiOggi ? '#2f9e5f' : '#8a8f98') + '</div>';
}

function apriChat(scheda) {
  CHAT.aperta = true;
  if (scheda) CHAT.scheda = scheda;
  let ov = document.getElementById('chat-pannello');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'chat-pannello';
    ov.style.cssText = 'position:fixed; right:16px; bottom:16px; z-index:370; width:min(420px, calc(100vw - 32px)); height:min(620px, calc(100vh - 32px)); background:var(--card); color:var(--ink); border-radius:18px; box-shadow:0 20px 60px rgba(0,0,0,.35); display:flex; flex-direction:column; overflow:hidden; border:1px solid var(--line)';
    document.body.appendChild(ov);
  }
  disegnaChat();
  chatSegnaLetti();
  disegnaBottoneChat();
  disegnaCompitiAVideo();
  setTimeout(function () { const t = document.getElementById('chat-testo'); if (t) t.focus(); }, 50);
}
function chiudiChat() {
  CHAT.aperta = false;
  const ov = document.getElementById('chat-pannello'); if (ov) ov.remove();
  disegnaBottoneChat();
  disegnaCompitiAVideo();
}

function disegnaChat() {
  const ov = document.getElementById('chat-pannello');
  if (!ov) return;
  const io = auth.profilo.id;
  const bozza = document.getElementById('chat-testo') ? document.getElementById('chat-testo').value : '';
  const dest = document.getElementById('chat-a') ? document.getElementById('chat-a').value : '';
  const comp = document.getElementById('chat-compito') ? document.getElementById('chat-compito').checked : false;
  const compiti = CHAT.messaggi.filter(function (m) { return m.compito; });
  const aperti = compiti.filter(function (m) { return !m.fatto; });
  const lista = CHAT.scheda === 'compiti' ? compiti.slice().sort(function (a, b) { return (a.fatto - b.fatto) || (a.creato_il < b.creato_il ? 1 : -1); }) : CHAT.messaggi.slice().reverse();
  const scheda = function (k, t) { return '<button type="button" onclick="CHAT.scheda=\'' + k + '\'; disegnaChat()" style="flex:1; padding:8px; border:none; border-bottom:3px solid ' + (CHAT.scheda === k ? '#fff' : 'transparent') + '; background:none; color:#fff; font-weight:800; cursor:pointer">' + t + '</button>'; };
  ov.innerHTML = '<div style="background:linear-gradient(90deg,#1d4f91,#00612f); color:#fff; padding:10px 12px 0">'
    + '<div style="display:flex; justify-content:space-between; align-items:center"><b style="font-size:16px">💬 Chat interna</b><span style="display:flex; gap:6px"><button type="button" onclick="pulisciChat()" title="Togli dalla tua chat tutti i messaggi (i compiti ancora da fare restano)" style="background:rgba(255,255,255,.2); color:#fff; border:none; border-radius:999px; padding:4px 12px; cursor:pointer; font-size:13px">🧹 Pulisci</button><button type="button" onclick="chiudiChat()" style="background:rgba(255,255,255,.2); color:#fff; border:none; border-radius:999px; padding:4px 12px; cursor:pointer">✕</button></span></div>'
    + '<div style="display:flex; margin-top:6px">' + scheda('chat', '💬 Messaggi') + scheda('compiti', '📌 Da fare' + (aperti.length ? ' (' + aperti.length + ')' : '')) + '</div></div>'
    + contatoreCompitiHTML()
    + '<div id="chat-lista" style="flex:1; overflow-y:auto; padding:10px; background:var(--bg); display:flex; flex-direction:column; gap:8px">'
    + (lista.length ? lista.map(function (m) {
      const mio = m.da_id === io;
      const verso = m.a_id ? (mio ? '→ ' + esc(m.a_nome || '') : '→ te') : '→ tutti';
      return '<div style="align-self:' + (mio ? 'flex-end' : 'flex-start') + '; max-width:85%; background:' + (m.compito ? (m.fatto ? '#e8f6ee' : '#fff7e6') : (mio ? '#dcf2ff' : 'var(--card)')) + '; border:1px solid ' + (m.compito && !m.fatto ? '#d4881c' : 'var(--line)') + '; border-radius:12px; padding:7px 10px; color:#0f1b2d">'
        + '<div style="font-size:11px; color:#5b6b82; font-weight:700">' + (mio ? 'Tu' : esc(m.da_nome)) + ' ' + verso + ' · ' + oraChat(m.creato_il) + '</div>'
        + (m.compito ? '<div style="font-size:11px; font-weight:800; color:' + (m.fatto ? '#2f9e5f' : (giorniRitardo(m) ? '#c0392b' : '#b35f0c')) + '">' + (m.fatto ? '✓ FATTO da ' + esc(m.fatto_da) + (m.fatto_il ? ' · ' + oraChat(m.fatto_il) : '') : (giorniRitardo(m) ? '⏰ SOLLECITO: da fare da ' + giorniRitardo(m) + (giorniRitardo(m) === 1 ? ' giorno' : ' giorni') : '📌 COMPITO DA FARE')) + '</div>' : '')
        + '<div style="font-size:14px; white-space:pre-wrap; word-break:break-word">' + esc(m.testo) + '</div>'
        + '<div style="display:flex; gap:6px; justify-content:flex-end; margin-top:4px">'
        + (m.compito ? (m.fatto ? '<button type="button" onclick="segnaCompito(\'' + m.id + '\', false)" style="padding:2px 8px; font-size:11px">↺ Da rifare</button>' : '<button type="button" onclick="segnaCompito(\'' + m.id + '\', true)" style="padding:3px 10px; font-size:12px; background:#2f9e5f; color:#fff; font-weight:800">✓ Fatto</button>') : '')
        + (mio || !(m.compito && !m.fatto) ? '<button type="button" title="Elimina" onclick="eliminaMessaggioChat(\'' + m.id + '\')" style="padding:2px 8px; font-size:11px; background:none; color:#c0392b">🗑️</button>' : '')
        + '</div></div>';
    }).join('') : '<div style="text-align:center; color:var(--sub); margin-top:30px">' + (CHAT.scheda === 'compiti' ? 'Nessun compito' : 'Nessun messaggio: scrivi il primo!') + '</div>')
    + '</div>'
    + '<div style="padding:8px 10px; border-top:1px solid var(--line)">'
    + (CHAT.utenti.filter(function (u) { return u.id !== io; }).length ? '' : '<div style="font-size:12px; color:#c0392b; font-weight:700; margin-bottom:6px">⚠️ Nessun altro utente può usare la chat: ' + (auth.profilo.ruolo === 'admin' ? 'accendila in Utenti e permessi (💬 Chat interna → Attiva per tutti) e controlla che l\'utente abbia la spunta "Abilitata".' : 'chiedi all\'amministratore di attivarla.') + '</div>')
    + '<div style="display:flex; gap:6px; align-items:center; margin-bottom:6px; flex-wrap:wrap">'
    + '<select id="chat-a" style="width:auto; flex:1; padding:5px 8px; font-size:13px"><option value="">👥 A tutti</option>'
    + CHAT.utenti.filter(function (u) { return u.id !== io; }).map(function (u) { return '<option value="' + u.id + '"' + (u.id === dest ? ' selected' : '') + '>👤 ' + esc(u.nome) + '</option>'; }).join('') + '</select>'
    + '<label class="chk" style="font-size:13px; white-space:nowrap"><input type="checkbox" id="chat-compito" ' + (comp || CHAT.scheda === 'compiti' ? 'checked' : '') + '> 📌 Compito da spuntare</label></div>'
    + '<div style="display:flex; gap:6px"><textarea id="chat-testo" rows="2" placeholder="Scrivi un messaggio…" style="flex:1; resize:none; font-size:14px" onkeydown="if(event.key===\'Enter\' && !event.shiftKey){ event.preventDefault(); inviaMessaggioChat(); }">' + esc(bozza) + '</textarea>'
    + '<button type="button" onclick="inviaMessaggioChat()" style="background:#1d4f91; color:#fff; font-weight:800; padding:0 14px">➤</button></div></div>';
  const l = document.getElementById('chat-lista');
  if (l && CHAT.scheda === 'chat') l.scrollTop = l.scrollHeight;
}

async function inviaMessaggioChat() {
  const t = document.getElementById('chat-testo');
  const testo = (t.value || '').trim();
  if (!testo) return;
  const a = document.getElementById('chat-a').value || null;
  const compito = document.getElementById('chat-compito').checked;
  t.value = '';
  const r = await fetchSupabase('/rest/v1/messaggi_interni', 'POST', { testo: testo.slice(0, 2000), a_id: a, compito: compito }, { 'Prefer': 'return=minimal' });
  if (!r.ok) { t.value = testo; avviso('❌ Messaggio non inviato', true); return; }
  await caricaChat();
  chatSegnaLetti();
  disegnaBottoneChat();
}
async function segnaCompito(id, fatto) {
  const r = await fetchSupabase('/rest/v1/messaggi_interni?id=eq.' + id, 'PATCH', { fatto: fatto }, { 'Prefer': 'return=minimal' });
  if (!r.ok) { avviso('❌ Non salvato', true); return; }
  if (fatto) avviso('✓ Compito segnato come fatto');
  await caricaChat();
}
// Elimina un messaggio: il mio lo posso cancellare per tutti o solo dalla mia chat; quello di un altro lo tolgo solo dalla mia
function eliminaMessaggioChat(id) {
  const m = CHAT.messaggi.find(function (x) { return x.id === id; });
  if (!m) return;
  const mio = m.da_id === auth.profilo.id, admin = auth.profilo.ruolo === 'admin';
  const vecchio = document.getElementById('chat-elimina'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'chat-elimina';
  ov.style.cssText = 'position:fixed; inset:0; z-index:490; background:rgba(15,27,45,.45); display:flex; align-items:center; justify-content:center; padding:16px';
  const tasto = function (az, testo, col) { return '<button type="button" data-az="' + az + '" style="width:100%; margin-top:8px; padding:10px; border:none; border-radius:10px; font-weight:800; cursor:pointer; background:' + col + '; color:#fff">' + testo + '</button>'; };
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; padding:18px 20px; max-width:380px; width:100%; box-shadow:0 20px 50px rgba(0,0,0,.3)">'
    + '<div style="font-size:17px; font-weight:800; margin-bottom:6px">🗑️ Eliminare il messaggio?</div>'
    + '<div style="font-size:13px; color:var(--sub); white-space:pre-wrap; max-height:90px; overflow:hidden; border-left:3px solid var(--line); padding-left:8px">' + esc(m.testo) + '</div>'
    + tasto('me', 'Togli solo dalla mia chat', '#1d4f91')
    + (mio || admin ? tasto('tutti', 'Elimina per tutti', '#c0392b') : '<div style="font-size:12px; color:var(--sub); margin-top:6px">Gli altri continueranno a vederlo.</div>')
    + '<button type="button" data-az="no" style="width:100%; margin-top:8px; padding:9px; border-radius:10px; background:none; border:1px solid var(--line); color:var(--ink); cursor:pointer">Annulla</button></div>';
  ov.addEventListener('click', async function (e) {
    const az = e.target.getAttribute && e.target.getAttribute('data-az');
    if (e.target !== ov && !az) return;
    ov.remove();
    if (az === 'me') await nascondiMessaggiChat([id]);
    else if (az === 'tutti') {
      const r = await fetchSupabase('/rest/v1/messaggi_interni?id=eq.' + id, 'DELETE', null, { 'Prefer': 'return=minimal' });
      if (!r.ok) { avviso('❌ Non eliminato', true); return; }
      avviso('✓ Messaggio eliminato per tutti');
      await caricaChat();
    }
  });
  document.body.appendChild(ov);
}
async function nascondiMessaggiChat(ids) {
  if (!ids.length) return;
  const r = await fetchSupabase('/rest/v1/messaggi_nascosti', 'POST', ids.map(function (i) { return { messaggio_id: i }; }), { 'Prefer': 'return=minimal,resolution=ignore-duplicates' });
  if (!r.ok) { avviso('❌ Non eliminato', true); return; }
  CHAT.nascosti = (CHAT.nascosti || []).concat(ids);
  CHAT.messaggi = CHAT.messaggi.filter(function (m) { return ids.indexOf(m.id) < 0; });
  avviso(ids.length === 1 ? '✓ Messaggio tolto dalla tua chat' : '✓ ' + ids.length + ' messaggi tolti dalla tua chat');
  disegnaBottoneChat();
  disegnaCompitiAVideo();
  if (CHAT.aperta) disegnaChat();
}
// Svuota la mia chat in un colpo solo (i compiti ancora da fare per me restano)
function pulisciChat() {
  const ids = CHAT.messaggi.filter(function (m) { return !(m.compito && !m.fatto && chatPerMe(m)); }).map(function (m) { return m.id; });
  if (!ids.length) { avviso('Non ci sono messaggi da togliere'); return; }
  if (!confirm('Togliere dalla tua chat ' + (ids.length === 1 ? 'il messaggio' : 'tutti i ' + ids.length + ' messaggi') + '?\nI compiti ancora da fare restano. Gli altri utenti continuano a vedere i messaggi.')) return;
  nascondiMessaggiChat(ids);
}
