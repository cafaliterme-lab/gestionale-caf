/**
 * Installazione come app sul telefono o sul computer (Android, iPhone, Windows, Mac).
 * Mostra il pulsante "Installa app" vicino a "Cambia utente" finche' il programma non e' installato.
 */
let promptInstallazione = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('service worker', e); });
  });
}
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  promptInstallazione = e;
  mostraPulsanteInstalla();
});
window.addEventListener('appinstalled', function () {
  promptInstallazione = null;
  const b = document.getElementById('btn-installa');
  if (b) b.remove();
  if (typeof avviso === 'function') avviso('✓ App installata: la trovi tra le app del telefono o del computer');
});

function appGiaInstallata() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
}
function eIPhone() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function mostraPulsanteInstalla() {
  if (appGiaInstallata()) return;
  const bar = document.getElementById('userbar');
  if (!bar || !bar.innerHTML.trim() || document.getElementById('btn-installa')) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.id = 'btn-installa';
  b.textContent = '📲 Installa app';
  b.style.cssText = 'background:#00612f; color:#fff; border-color:#00612f; font-weight:700';
  b.onclick = installaApp;
  bar.insertBefore(b, bar.firstChild.nextSibling);
}
// la barra utente viene ridisegnata dopo l'accesso: si ricontrolla ogni tanto
setInterval(mostraPulsanteInstalla, 1500);

async function installaApp() {
  if (promptInstallazione) {
    promptInstallazione.prompt();
    const scelta = await promptInstallazione.userChoice.catch(function () { return null; });
    if (scelta && scelta.outcome === 'accepted') promptInstallazione = null;
    return;
  }
  istruzioniInstallazione();
}

// Icone disegnate come quelle dei telefoni, per riconoscere subito dove toccare
const ICONA = {
  condividi: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#007aff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
  aggiungi: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#0f1b2d" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
  puntini: '<svg viewBox="0 0 24 24" width="22" height="22" fill="#0f1b2d"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  installa: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#0f1b2d" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 8v6M9 11l3 3 3-3"/><path d="M8 21h8"/></svg>',
};
function passoHTML(n, icona, testo) {
  return '<div style="display:flex; align-items:center; gap:12px; padding:10px 12px; margin-bottom:8px; border-radius:12px; background:var(--bg); border:1px solid var(--line)">'
    + '<div style="flex:none; width:28px; height:28px; border-radius:50%; background:#00612f; color:#fff; font-weight:800; display:flex; align-items:center; justify-content:center">' + n + '</div>'
    + '<div style="flex:1; font-size:14.5px; line-height:1.4">' + testo + '</div>'
    + (icona ? '<div style="flex:none; width:40px; height:40px; border-radius:10px; background:#fff; border:1px solid #d6dde6; display:flex; align-items:center; justify-content:center">' + icona + '</div>' : '')
    + '</div>';
}
function eSafariIPhone() { return eIPhone() && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(navigator.userAgent); }

function istruzioniInstallazione() {
  const iphone = eIPhone(), android = /android/i.test(navigator.userAgent);
  const link = location.origin + location.pathname.replace(/index\.html$/, '');
  let corpo = '', freccia = '';
  if (iphone && !eSafariIPhone()) {
    corpo = passoHTML(1, '', 'Su iPhone l\'app si installa solo da <b>Safari</b>. Tocca <b>"Copia il link"</b> qui sotto.')
      + passoHTML(2, '', 'Apri <b>Safari</b>, tocca la barra dell\'indirizzo e scegli <b>Incolla e vai</b>.')
      + passoHTML(3, '', 'Entra nel programma e tocca di nuovo <b>📲 Installa app</b>.')
      + '<button type="button" data-azione="copia" style="width:100%; background:#007aff; color:#fff; font-size:15px; padding:12px; margin-top:4px">📋 Copia il link</button>';
  } else if (iphone) {
    const ver = parseInt((/OS (\d+)_/.exec(navigator.userAgent) || [])[1] || '0', 10);
    const nuovo = ver >= 26; // da iOS 26 il pulsante Condividi e' dentro al menu •••
    corpo = '<div style="font-size:13px; padding:10px 12px; margin-bottom:10px; border-radius:12px; background:color-mix(in srgb, #f08a24 15%, var(--card)); border:1.5px solid #f08a24">'
        + '<b>Prima di tutto:</b> se hai aperto il link da <b>WhatsApp, email, Claude</b> o un\'altra app, "Aggiungi alla schermata Home" <b>non compare</b>. '
        + 'Tocca <b>"Copia il link"</b> qui sotto, apri l\'app <b>Safari</b> 🧭 e incollalo nella barra dell\'indirizzo.</div>'
      + (nuovo
        ? passoHTML(1, ICONA.puntini.replace('<svg', '<svg style="transform:rotate(90deg)"'), 'In Safari tocca <b>•••</b> in basso a destra (la freccia te lo indica), poi tocca <b>Condividi</b> ' + ICONA.condividi.replace('width="22" height="22"', 'width="16" height="16" style="vertical-align:-2px"') + '.')
          + passoHTML(2, ICONA.aggiungi, 'Nella finestra che si apre <b>scorri verso il basso</b> (o tocca <b>"Mostra altro"</b>) e tocca <b>"Aggiungi alla schermata Home"</b>.')
          + passoHTML(3, '', 'Lascia attivo <b>"Apri come app web"</b> e tocca <b>"Aggiungi"</b>. Fatto: trovi l\'icona <b>CAF CISL</b> sulla schermata Home.')
        : passoHTML(1, ICONA.condividi, 'In Safari tocca <b>Condividi</b> nella barra in basso, al centro (la freccia te lo indica).')
          + passoHTML(2, ICONA.aggiungi, 'Nella finestra che si apre <b>scorri verso il basso</b> e tocca <b>"Aggiungi alla schermata Home"</b>.')
          + passoHTML(3, '', 'Tocca <b>"Aggiungi"</b> in alto a destra. Fatto: trovi l\'icona <b>CAF CISL</b> sulla schermata Home.'))
      + '<button type="button" data-azione="copia" style="width:100%; background:#007aff; color:#fff; font-size:15px; padding:12px; margin-top:4px">📋 Copia il link</button>';
    freccia = nuovo
      ? '<div class="freccia-installa" style="position:fixed; right:14px; bottom:6px; z-index:460; text-align:center; color:#fff; font-weight:800; font-size:14px; text-shadow:0 1px 4px rgba(0,0,0,.6); pointer-events:none">Tocca ••• qui<div style="font-size:44px; line-height:1; animation:rimbalzo 1s infinite">⬇️</div></div>'
      : '<div class="freccia-installa" style="position:fixed; left:50%; bottom:6px; transform:translateX(-50%); z-index:460; text-align:center; color:#fff; font-weight:800; font-size:14px; text-shadow:0 1px 4px rgba(0,0,0,.6); pointer-events:none">Tocca Condividi qui<div style="font-size:44px; line-height:1; animation:rimbalzo 1s infinite">⬇️</div></div>';
  } else if (android) {
    corpo = passoHTML(1, ICONA.puntini, 'Tocca il menu <b>⋮</b> in alto a destra di Chrome. Te lo indica la freccia.')
      + passoHTML(2, ICONA.installa, 'Tocca <b>"Installa app"</b> (oppure <b>"Aggiungi a schermata Home"</b>).')
      + passoHTML(3, '', 'Conferma con <b>"Installa"</b>. Fatto: l\'icona <b>CAF CISL</b> è tra le tue app.');
    freccia = '<div class="freccia-installa" style="position:fixed; right:8px; top:4px; z-index:460; text-align:center; color:#fff; font-weight:800; font-size:14px; text-shadow:0 1px 4px rgba(0,0,0,.6); pointer-events:none"><div style="font-size:44px; line-height:1; animation:rimbalzo-su 1s infinite">⬆️</div>Menu ⋮</div>';
  } else {
    corpo = passoHTML(1, ICONA.installa, 'Clicca l\'icona <b>Installa</b> che compare a destra nella barra dell\'indirizzo di Chrome o Edge (in alto). Te la indica la freccia.')
      + passoHTML(2, ICONA.puntini, 'Se non la vedi: menu <b>⋮</b> → <b>"Trasmetti, salva e condividi"</b> → <b>"Installa pagina come app"</b>.')
      + passoHTML(3, '', 'Conferma con <b>"Installa"</b>: il programma si apre in una sua finestra e trovi l\'icona sul desktop.');
    freccia = '<div class="freccia-installa" style="position:fixed; right:120px; top:4px; z-index:460; text-align:center; color:#fff; font-weight:800; font-size:14px; text-shadow:0 1px 4px rgba(0,0,0,.6); pointer-events:none"><div style="font-size:44px; line-height:1; animation:rimbalzo-su 1s infinite">⬆️</div>Installa</div>';
  }
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed; inset:0; z-index:450; background:rgba(15,27,45,.55); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<style>@keyframes rimbalzo{0%,100%{transform:translateY(0)}50%{transform:translateY(10px)}}@keyframes rimbalzo-su{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}</style>'
    + '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #00612f; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:20px 20px 16px; max-width:440px; width:100%; max-height:85vh; overflow:auto">'
    + '<div style="display:flex; align-items:center; gap:12px; margin-bottom:12px"><img src="icone/icona-192.png" alt="" style="width:54px; height:54px; border-radius:14px">'
    + '<div><div style="font-size:19px; font-weight:800; color:#00612f">Installa l\'app CAF CISL</div><div style="font-size:12.5px; color:var(--sub)">' + (iphone ? 'iPhone / iPad' : android ? 'Android' : 'Computer') + ' · segui i passaggi</div></div></div>'
    + corpo
    + '<div style="font-size:12px; color:var(--sub); margin:10px 0 12px">La prima volta che apri l\'app inserisci email e password: poi resti collegato.</div>'
    + '<div style="text-align:right"><button type="button" data-azione="chiudi" style="background:#00612f; color:#fff; min-width:110px">Ho capito</button></div></div>'
    + freccia;
  document.body.appendChild(ov);
  ov.addEventListener('click', async function (e) {
    const b = e.target.closest('[data-azione]');
    if (e.target === ov || (b && b.dataset.azione === 'chiudi')) { ov.remove(); return; }
    if (!b) return;
    if (b.dataset.azione === 'copia') {
      try { await navigator.clipboard.writeText(link); b.textContent = '✓ Link copiato: ora aprilo in Safari'; }
      catch (err) { prompt('Copia questo link e aprilo in Safari:', link); }
    }
    if (b.dataset.azione === 'condividi') {
      try { await navigator.share({ title: 'CAF CISL Alì Terme', url: link }); } catch (err) { /* annullato */ }
    }
  });
}
