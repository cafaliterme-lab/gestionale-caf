/* ---------- Accesso con QR (come WhatsApp Web) ----------
   PC: nella schermata di accesso compare un QR che cambia ogni 2 minuti.
   Telefono (già entrato nel programma): "📷 Fai entrare un PC" → inquadra il QR → conferma →
   il PC entra con lo stesso utente del telefono. Funzione sul server: "accesso-qr". */

const QR_ACCESSO = { id: null, segreto: null, scade: 0, timer: null, giri: 0, attivo: false, gen: 0 };
let QR_DA_APPROVARE = null; // codice arrivato aprendo il link del QR (fotocamera del telefono)

async function chiamaAccessoQr(corpo, conUtente, giaRinnovato) {
  if (conUtente && !giaRinnovato) {
    const t0 = localStorage.getItem('auth_token'), exp = t0 && typeof scadenzaToken === 'function' ? scadenzaToken(t0) : 0;
    if (exp && exp * 1000 < Date.now() + 30000 && typeof rinnovaToken === 'function') await rinnovaToken();
  }
  const tok = conUtente ? localStorage.getItem('auth_token') : null;
  return fetch(SUPABASE_URL + '/functions/v1/accesso-qr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (tok || SUPABASE_ANON_KEY) },
    body: JSON.stringify(corpo),
  }).then(async function (r) {
    // accesso del telefono scaduto (dura circa un'ora): si rinnova e si riprova una volta
    if (r.status === 401 && conUtente && !giaRinnovato && typeof rinnovaToken === 'function' && await rinnovaToken()) return chiamaAccessoQr(corpo, true, true);
    return r.json().catch(function () { return {}; }).then(function (d) {
      if (!r.ok || d.error) throw new Error(d.error || d.message || ('errore ' + r.status));
      return d;
    });
  });
}

function nomeDispositivo() {
  const ua = navigator.userAgent || '';
  const so = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Linux/.test(ua) ? 'Linux' : 'PC';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'browser';
  return so + ' · ' + br;
}
function schermoGrande() { return window.matchMedia && window.matchMedia('(pointer: fine) and (min-width: 900px)').matches; }

/* ---------- PC: QR nella schermata di accesso ---------- */

function boxAccessoQrHTML() {
  return '<div id="qr-accesso-box" style="margin:14px 0 4px; padding:12px; border:2px solid #1d4f91; border-radius:14px; background:color-mix(in srgb, #1d4f91 5%, var(--card)); text-align:center">'
    + '<div style="font-weight:800; color:#1d4f91; font-size:15px">📱 Entra con il telefono</div>'
    + '<div id="qr-accesso-corpo">'
    + '<div style="font-size:12.5px; color:var(--sub); margin:4px 0 8px">Inquadra il QR con la <b>fotocamera del telefono</b> e tocca il link che compare.</div>'
    + '<button type="button" class="login-btn" style="background:#1d4f91; color:#fff; border:none; width:100%" onclick="avviaQrAccesso()">Mostra il QR</button></div></div>';
}

function avviaQrAccesso() {
  fermaQrAccesso();
  QR_ACCESSO.attivo = true;
  QR_ACCESSO.giri = 0;
  nuovoQrAccesso(QR_ACCESSO.gen);
}
// ogni avvio ha il suo numero: un controllo rimasto in sospeso da un avvio precedente si ferma da solo
function fermaQrAccesso() {
  QR_ACCESSO.gen++;
  QR_ACCESSO.attivo = false;
  if (QR_ACCESSO.timer) clearTimeout(QR_ACCESSO.timer);
  QR_ACCESSO.timer = null;
}
function corpoQr(html) { const c = document.getElementById('qr-accesso-corpo'); if (c) c.innerHTML = html; return !!c; }

async function nuovoQrAccesso(gen) {
  if (gen !== QR_ACCESSO.gen) return;
  if (QR_ACCESSO.timer) clearTimeout(QR_ACCESSO.timer);
  if (!corpoQr('<div style="font-size:13px; color:var(--sub); padding:30px 0">Preparo il QR…</div>')) return fermaQrAccesso();
  try {
    const d = await chiamaAccessoQr({ azione: 'crea', dispositivo: nomeDispositivo() });
    if (gen !== QR_ACCESSO.gen) return;
    QR_ACCESSO.id = d.id; QR_ACCESSO.segreto = d.segreto;
    QR_ACCESSO.scade = Date.now() + (d.secondi || 120) * 1000;
    QR_ACCESSO.giri++;
    corpoQr('<div style="width:200px; height:200px; margin:8px auto; background:#fff; padding:6px; border-radius:10px">' + qrSvg(indirizzoApp() + '?qr=' + d.codice) + '</div>'
      + '<div style="font-size:12.5px; color:var(--sub)">Inquadra il QR con la <b>fotocamera del telefono</b>, tocca il link e conferma.<br>Il PC entra con l\'utente del telefono.</div>'
      + '<div id="qr-accesso-stato" style="font-size:12px; margin-top:6px; color:var(--sub)"></div>');
    controllaQrAccesso(gen);
  } catch (e) {
    if (gen !== QR_ACCESSO.gen) return;
    corpoQr('<div style="font-size:12.5px; color:#c0392b; margin:8px 0">❌ ' + esc(e.message) + '</div><button type="button" class="login-btn" style="background:#1d4f91; color:#fff; border:none; width:100%" onclick="avviaQrAccesso()">Riprova</button>');
    fermaQrAccesso();
  }
}

async function controllaQrAccesso(gen) {
  if (!QR_ACCESSO.attivo || gen !== QR_ACCESSO.gen) return;
  const overlay = document.getElementById('login-overlay');
  if (!overlay || overlay.style.display === 'none' || !document.getElementById('qr-accesso-corpo')) return fermaQrAccesso();
  const restano = Math.max(0, Math.round((QR_ACCESSO.scade - Date.now()) / 1000));
  const st = document.getElementById('qr-accesso-stato');
  if (st) st.textContent = 'Il QR cambia tra ' + restano + ' secondi';
  if (!document.hidden) {
    try {
      const d = await chiamaAccessoQr({ azione: 'stato', id: QR_ACCESSO.id, segreto: QR_ACCESSO.segreto });
      if (gen !== QR_ACCESSO.gen) return;
      if (d.stato === 'ok') return entraConQr(d);
      if (d.stato === 'scaduto' || restano <= 0) {
        // si rinnova da solo per un po'; poi serve un clic (così il PC lasciato acceso non chiama il server all'infinito)
        if (QR_ACCESSO.giri < 15) return nuovoQrAccesso(gen);
        corpoQr('<div style="font-size:12.5px; color:var(--sub); margin:8px 0">Il QR è scaduto.</div><button type="button" class="login-btn" style="background:#1d4f91; color:#fff; border:none; width:100%" onclick="avviaQrAccesso()">🔄 Nuovo QR</button>');
        return fermaQrAccesso();
      }
    } catch (e) { /* rete assente: si riprova */ }
  }
  QR_ACCESSO.timer = setTimeout(function () { controllaQrAccesso(gen); }, 2000);
}

async function entraConQr(d) {
  fermaQrAccesso();
  corpoQr('<div style="font-size:14px; font-weight:800; color:#2f9e5f; padding:24px 0">✓ Confermato dal telefono: entro…</div>');
  const verifica = function (tipo) { return fetchSupabase('/auth/v1/verify', 'POST', { type: tipo, token_hash: d.token_hash }); };
  try {
    let r = await verifica(d.tipo || 'magiclink');
    if (!r.ok || !r.data || !r.data.access_token) r = await verifica('email');
    if (!r.ok || !r.data || !r.data.access_token) throw new Error((r.data && (r.data.msg || r.data.error_description || r.data.message)) || 'accesso non riuscito');
    localStorage.setItem('auth_token', r.data.access_token);
    localStorage.setItem('auth_refresh', r.data.refresh_token);
    await initSupabase();
    if (document.getElementById('login-overlay').style.display !== 'none') throw new Error('profilo non trovato');
    avviso('✓ Entrato con il QR');
  } catch (e) {
    corpoQr('<div style="font-size:12.5px; color:#c0392b; margin:8px 0">❌ ' + esc(e.message) + '</div><button type="button" class="login-btn" style="background:#1d4f91; color:#fff; border:none; width:100%" onclick="avviaQrAccesso()">🔄 Nuovo QR</button>');
  }
}

// Si aggiunge il riquadro sotto il modulo di accesso (sul PC il QR parte da solo)
function aggiungiQrAlLogin() {
  const wrap = document.getElementById('login-lista');
  if (!wrap) return;
  // telefono aperto dal QR ma non ancora entrato: si spiega cosa fare (solo la prima volta)
  let haAccesso = false;
  try { haAccesso = !!localStorage.getItem('auth_token'); } catch (e) { /* niente */ }
  if (QR_DA_APPROVARE && !haAccesso && !chiaveTelefono() && !document.getElementById('qr-primo-accesso')) {
    const av = document.createElement('div');
    av.id = 'qr-primo-accesso';
    av.style.cssText = 'margin:0 0 12px; padding:10px 12px; border-radius:12px; background:#fff4e5; border:2px solid #d98b1e; color:#7a4a05; font-size:13px; text-align:left';
    av.innerHTML = '<b>📱 Stai facendo entrare un PC.</b><br>Su questo telefono non sei ancora entrato: entra qui con email e password <b>solo questa volta</b>. Poi confermi l\'accesso del PC; le prossime volte basterà inquadrare il QR.';
    wrap.insertBefore(av, wrap.firstChild);
  }
  if (document.getElementById('qr-accesso-box') || QR_DA_APPROVARE) return;
  const crea = wrap.querySelector('button[onclick="toggleCreaAccount()"]');
  const div = document.createElement('div');
  div.innerHTML = boxAccessoQrHTML();
  if (crea) crea.parentNode.insertBefore(div.firstChild, crea); else wrap.appendChild(div.firstChild);
  if (schermoGrande()) avviaQrAccesso();
}
new MutationObserver(function () {
  const ov = document.getElementById('login-overlay');
  if (ov && ov.style.display !== 'none') aggiungiQrAlLogin();
}).observe(document.documentElement, { childList: true, subtree: true });

/* ---------- Telefono: inquadrare il QR e confermare ---------- */

function codiceDaTestoQr(t) {
  const m = /[?&]qr=([A-Za-z0-9_-]{10,})/.exec(String(t || ''));
  return m ? m[1] : null;
}

async function creaLettoreQR() {
  if ('BarcodeDetector' in window) {
    try {
      const s = await window.BarcodeDetector.getSupportedFormats();
      if (s.indexOf('qr_code') >= 0) return new window.BarcodeDetector({ formats: ['qr_code'] });
    } catch (e) { /* si usa la libreria */ }
  }
  if (!window.BarcodeDetectionAPI) throw new Error('Lettore di QR non disponibile su questo dispositivo');
  window.BarcodeDetectionAPI.setZXingModuleOverrides({ locateFile: function (file) { return new URL('js/vendor/' + file, location.href).href; } });
  return new window.BarcodeDetectionAPI.BarcodeDetector({ formats: ['qr_code'] });
}

const LETTORE_QR = { stream: null, attivo: false };
function chiudiLettoreQR() {
  LETTORE_QR.attivo = false;
  if (LETTORE_QR.stream) LETTORE_QR.stream.getTracks().forEach(function (t) { t.stop(); });
  LETTORE_QR.stream = null;
  const ov = document.getElementById('lettore-qr'); if (ov) ov.remove();
}

async function apriLettoreQR() {
  chiudiLettoreQR();
  const ov = document.createElement('div');
  ov.id = 'lettore-qr';
  ov.style.cssText = 'position:fixed; inset:0; z-index:480; background:rgba(10,20,36,.92); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px; color:#fff; text-align:center';
  ov.innerHTML = '<div style="font-size:18px; font-weight:800; margin-bottom:6px">📷 Fai entrare un PC</div>'
    + '<div style="font-size:13px; opacity:.9; margin-bottom:10px">Inquadra il QR che vedi sulla schermata di accesso del PC</div>'
    + '<div style="position:relative; width:min(80vw,320px); aspect-ratio:1; border-radius:16px; overflow:hidden; background:#000; border:3px solid #fff">'
    + '<video id="lettore-qr-video" playsinline muted style="width:100%; height:100%; object-fit:cover"></video></div>'
    + '<div id="lettore-qr-msg" style="font-size:13px; margin-top:10px; min-height:18px"></div>'
    + '<button type="button" onclick="chiudiLettoreQR()" style="margin-top:12px; background:#fff; color:#0f1b2d; border:none; border-radius:999px; padding:10px 22px; font-weight:800">Annulla</button>';
  document.body.appendChild(ov);
  const msg = document.getElementById('lettore-qr-msg');
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Fotocamera non disponibile: apri il programma con Chrome o Safari');
    LETTORE_QR.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    const v = document.getElementById('lettore-qr-video');
    if (!v) return chiudiLettoreQR();
    v.srcObject = LETTORE_QR.stream;
    await v.play();
    const lettore = await creaLettoreQR();
    LETTORE_QR.attivo = true;
    const giro = async function () {
      if (!LETTORE_QR.attivo) return;
      try {
        const codici = await lettore.detect(v);
        for (const c of codici || []) {
          const cod = codiceDaTestoQr(c.rawValue);
          if (cod) { chiudiLettoreQR(); return confermaAccessoPC(cod); }
        }
        if (codici && codici.length) msg.textContent = 'Questo non è il QR di accesso del programma';
      } catch (e) { /* fotogramma non leggibile */ }
      setTimeout(giro, 250);
    };
    giro();
  } catch (e) {
    msg.innerHTML = '❌ ' + esc(e.message || 'Fotocamera non disponibile') + '<br><span style="opacity:.85">Puoi anche inquadrare il QR con la fotocamera del telefono e aprire il link.</span>';
  }
}

// Chiave del telefono: dopo il primo accesso col QR il telefono resta abilitato (anche se nel programma si preme Esci)
function chiaveTelefono() { try { return JSON.parse(localStorage.getItem('qr_telefono') || 'null'); } catch (e) { return null; } }
function salvaChiaveTelefono(k) { try { localStorage.setItem('qr_telefono', JSON.stringify({ id: k.id, segreto: k.segreto })); } catch (e) { /* niente */ } }
function togliChiaveTelefono() { try { localStorage.removeItem('qr_telefono'); } catch (e) { /* niente */ } }
function utenteEntrato() { return typeof auth !== 'undefined' && auth && !!auth.profilo; }

// Messaggio sopra a tutto (anche sopra la schermata di accesso), si chiude da solo
function esitoQR(testo, ok) {
  const v = document.getElementById('esito-qr'); if (v) v.remove();
  const d = document.createElement('div');
  d.id = 'esito-qr';
  d.style.cssText = 'position:fixed; left:50%; top:20px; transform:translateX(-50%); z-index:500; max-width:92vw; padding:14px 20px; border-radius:14px; font-size:15px; font-weight:800; color:#fff; box-shadow:0 10px 30px rgba(0,0,0,.3); background:' + (ok ? '#2f9e5f' : '#c0392b');
  d.textContent = testo;
  document.body.appendChild(d);
  setTimeout(function () { d.remove(); }, ok ? 4000 : 7000);
}

async function confermaAccessoPC(codice) {
  let chiave = chiaveTelefono();
  const entrato = utenteEntrato();
  if (!chiave && !entrato) {
    QR_DA_APPROVARE = codice;
    esitoQR('Entra nel programma su questo telefono (solo la prima volta): poi confermi l\'accesso del PC', false);
    return;
  }
  const corpo = function (azione) { return { azione: azione, codice: codice, telefono: chiave || undefined, conAccesso: entrato }; };
  let info;
  try { info = await chiamaAccessoQr(corpo('info'), entrato); }
  catch (e) {
    if (chiave && /telefono_non_valido/.test(e.message)) {
      // chiave non più valida (es. tolta dall'amministratore): serve di nuovo email e password
      togliChiaveTelefono();
      QR_DA_APPROVARE = codice;
      esitoQR('Questo telefono va riabilitato: entra con email e password, poi confermi', false);
      return;
    }
    esitoQR('❌ ' + e.message, false); return;
  }
  const nome = info.nome || (entrato && auth.profilo.nome) || 'il tuo utente';
  const ok = await new Promise(function (risolvi) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed; inset:0; z-index:490; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
    ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #1d4f91; padding:22px 24px; max-width:380px; width:100%; text-align:center">'
      + '<div style="font-size:38px">💻</div><div style="font-size:19px; font-weight:800; color:#1d4f91; margin:4px 0">Far entrare questo PC?</div>'
      + '<div style="font-size:14px; margin-bottom:4px"><b>' + esc(info.dispositivo || 'PC') + '</b></div>'
      + '<div style="font-size:13px; color:var(--sub); margin-bottom:14px">Il PC entrerà nel programma come <b>' + esc(nome) + '</b>, con i tuoi permessi. Conferma solo se il PC è davanti a te.</div>'
      + '<div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap"><button type="button" data-r="no" style="background:var(--line); color:var(--ink); min-width:110px">Annulla</button>'
      + '<button type="button" data-r="si" style="background:#2f9e5f; color:#fff; min-width:150px; font-weight:800">✓ Sì, fai entrare</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      const b = e.target.closest('button[data-r]');
      if (!b && e.target !== ov) return;
      ov.remove(); risolvi(!!b && b.dataset.r === 'si');
    });
  });
  if (!ok) return;
  try {
    await chiamaAccessoQr(corpo('approva'), entrato);
    esitoQR('✓ Fatto: il PC sta entrando come ' + nome, true);
  } catch (e) { esitoQR('❌ ' + e.message, false); return; }
  // primo accesso da questo telefono: si abilita, così le prossime volte basta inquadrare
  if (!chiave && entrato) {
    try { salvaChiaveTelefono(await chiamaAccessoQr({ azione: 'registra_telefono', nome: nomeDispositivo() }, true)); } catch (e) { /* si riproverà la prossima volta */ }
  }
}

// Aperto dal link del QR (fotocamera del telefono)
(function () {
  const cod = codiceDaTestoQr(location.search);
  if (!cod) return;
  QR_DA_APPROVARE = cod;
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* niente */ }
})();
setInterval(function () {
  if (!QR_DA_APPROVARE) return;
  // telefono già abilitato: si chiede subito la conferma, senza aspettare di entrare nel programma
  if (!chiaveTelefono()) {
    if (!utenteEntrato()) return;
    const ov = document.getElementById('login-overlay');
    if (ov && ov.style.display !== 'none') return;
  }
  const c = QR_DA_APPROVARE; QR_DA_APPROVARE = null;
  confermaAccessoPC(c);
}, 700);
