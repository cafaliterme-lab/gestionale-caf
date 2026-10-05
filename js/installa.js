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

function istruzioniInstallazione() {
  const iphone = eIPhone();
  const passi = iphone
    ? ['Apri questa pagina con <b>Safari</b> (non con Chrome o altri).',
      'Tocca il pulsante <b>Condividi</b> <span style="font-size:18px">⬆️</span> in basso al centro.',
      'Scorri e tocca <b>"Aggiungi alla schermata Home"</b>.',
      'Tocca <b>"Aggiungi"</b> in alto a destra: sulla schermata compare l\'icona <b>CAF CISL</b>.']
    : /android/i.test(navigator.userAgent)
      ? ['Apri questa pagina con <b>Chrome</b>.',
        'Tocca il menu <b>⋮</b> in alto a destra.',
        'Tocca <b>"Installa app"</b> (oppure "Aggiungi a schermata Home").',
        'Conferma con <b>"Installa"</b>: l\'icona <b>CAF CISL</b> compare tra le app.']
      : ['Apri questa pagina con <b>Chrome</b> o <b>Edge</b>.',
        'Nella barra dell\'indirizzo, a destra, clicca l\'icona <b>Installa</b> <span style="font-size:16px">⊕</span> (oppure menu ⋮ → "Trasmetti, salva e condividi" → "Installa pagina come app").',
        'Conferma con <b>"Installa"</b>: il programma si apre in una sua finestra e trovi l\'icona sul desktop e nel menu Start.'];
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed; inset:0; z-index:450; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #00612f; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:22px 24px; max-width:440px; width:100%">'
    + '<div style="display:flex; align-items:center; gap:12px; margin-bottom:10px"><img src="icone/icona-192.png" alt="" style="width:56px; height:56px; border-radius:14px">'
    + '<div><div style="font-size:19px; font-weight:800; color:#00612f">Installa l\'app CAF CISL</div><div style="font-size:12.5px; color:var(--sub)">' + (iphone ? 'iPhone / iPad' : /android/i.test(navigator.userAgent) ? 'Android' : 'Computer') + '</div></div></div>'
    + '<ol style="margin:0 0 12px; padding-left:20px; font-size:14px; line-height:1.55">' + passi.map(function (p) { return '<li style="margin-bottom:6px">' + p + '</li>'; }).join('') + '</ol>'
    + '<div style="font-size:12px; color:var(--sub); margin-bottom:12px">La prima volta che apri l\'app inserisci email e password: poi resti collegato.</div>'
    + '<div style="text-align:right"><button type="button" style="background:#00612f; color:#fff; min-width:110px">Ho capito</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.tagName === 'BUTTON') ov.remove(); });
}
