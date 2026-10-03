/**
 * Codice fiscale: validazione, dati ricavabili, coerenza con l'anagrafica
 * e lettura del codice a barre della tessera sanitaria con la fotocamera.
 */

const CF_MESI = 'ABCDEHLMPRST';
const CF_OMOCODIA = 'LMNPQRSTUV'; // cifre sostituite da lettere nei casi di omocodia
const CF_POSIZIONI_NUMERICHE = [6, 7, 9, 10, 12, 13, 14];
const CF_DISPARI = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

function normalizzaCF(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function carattereControlloCF(primi15) {
  let somma = 0;
  for (let i = 0; i < 15; i++) {
    const c = primi15[i];
    if (i % 2 === 0) somma += CF_DISPARI[c];
    else somma += /[0-9]/.test(c) ? +c : c.charCodeAt(0) - 65;
  }
  return String.fromCharCode(65 + (somma % 26));
}

function cfValido(cf) {
  cf = normalizzaCF(cf);
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) return false;
  return carattereControlloCF(cf.slice(0, 15)) === cf[15];
}

// Riporta a cifre le posizioni numeriche (omocodia)
function cfSenzaOmocodia(cf) {
  const c = cf.split('');
  CF_POSIZIONI_NUMERICHE.forEach(function (i) {
    const k = CF_OMOCODIA.indexOf(c[i]);
    if (k >= 0) c[i] = String(k);
  });
  return c.join('');
}

// { sesso: 'M'|'F', dataNascita: 'GG/MM/AAAA', codiceComune }
function datiDaCF(cf) {
  cf = cfSenzaOmocodia(normalizzaCF(cf));
  const aa = +cf.slice(6, 8);
  const mese = CF_MESI.indexOf(cf[8]) + 1;
  let giorno = +cf.slice(9, 11);
  const sesso = giorno > 40 ? 'F' : 'M';
  if (giorno > 40) giorno -= 40;
  const annoOggi = new Date().getFullYear();
  const anno = 2000 + aa > annoOggi ? 1900 + aa : 2000 + aa;
  return {
    sesso,
    dataNascita: String(giorno).padStart(2, '0') + '/' + String(mese).padStart(2, '0') + '/' + anno,
    codiceComune: cf.slice(11, 15),
  };
}

function lettereCF(s) {
  s = String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/g, '');
  return { consonanti: s.replace(/[AEIOU]/g, ''), vocali: s.replace(/[^AEIOU]/g, '') };
}

function codiceCognomeCF(cognome) {
  const l = lettereCF(cognome);
  return (l.consonanti + l.vocali + 'XXX').slice(0, 3);
}

function codiceNomeCF(nome) {
  const l = lettereCF(nome);
  if (l.consonanti.length >= 4) return l.consonanti[0] + l.consonanti[2] + l.consonanti[3];
  return (l.consonanti + l.vocali + 'XXX').slice(0, 3);
}

// Elenco di avvisi se il codice non corrisponde ai dati scritti nel modulo
function controllaCoerenzaCF(cf, cognome, nome, dataNascita) {
  const avvisi = [];
  cf = normalizzaCF(cf);
  if (cognome && codiceCognomeCF(cognome) !== cf.slice(0, 3)) avvisi.push('il cognome non corrisponde al codice fiscale');
  if (nome && codiceNomeCF(nome) !== cf.slice(3, 6)) avvisi.push('il nome non corrisponde al codice fiscale');
  // Il CF ha solo due cifre per l'anno (1926 e 2026 coincidono): si confrontano gg/mm/aa
  const daCF = datiDaCF(cf).dataNascita;
  if (dataNascita && /^\d{2}\/\d{2}\/\d{4}$/.test(dataNascita) && daCF.slice(0, 6) + daCF.slice(8) !== dataNascita.slice(0, 6) + dataNascita.slice(8)) {
    avvisi.push('la data di nascita non corrisponde al codice fiscale (' + daCF.slice(0, 6) + '..' + daCF.slice(8) + ')');
  }
  return avvisi;
}

/* ---------- Lettura del codice a barre (Code 39) della tessera sanitaria ---------- */

let scannerCF = { stream: null, timer: null, detector: null, onTrovato: null };

async function creaLettoreCodiciBarre() {
  const formati = ['code_39', 'code_128'];
  if ('BarcodeDetector' in window) {
    try {
      const supportati = await window.BarcodeDetector.getSupportedFormats();
      if (supportati.indexOf('code_39') >= 0) return new window.BarcodeDetector({ formats: formati });
    } catch (e) { /* si usa la libreria */ }
  }
  if (!window.BarcodeDetectionAPI) throw new Error('Lettore di codici a barre non disponibile');
  window.BarcodeDetectionAPI.setZXingModuleOverrides({
    locateFile: function (file) { return new URL('js/vendor/' + file, location.href).href; },
  });
  return new window.BarcodeDetectionAPI.BarcodeDetector({ formats: formati });
}

function cfDaCodiciLetti(codici) {
  for (const c of codici) {
    const cf = normalizzaCF(c.rawValue);
    if (cfValido(cf)) return cf;
  }
  return null;
}

function messaggioScanner(testo, errore) {
  const el = document.getElementById('scanner-msg');
  if (!el) return;
  el.textContent = testo;
  el.style.color = errore ? '#c0392b' : 'var(--sub)';
}

async function apriScannerCF(onTrovato) {
  scannerCF.onTrovato = onTrovato;
  document.getElementById('scanner-overlay').classList.add('open');
  messaggioScanner('Avvio della fotocamera...');
  try {
    scannerCF.detector = scannerCF.detector || await creaLettoreCodiciBarre();
  } catch (e) {
    messaggioScanner('❌ ' + e.message, true);
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    messaggioScanner('Fotocamera non disponibile su questo dispositivo: usa "Scatta una foto".', true);
    return;
  }
  try {
    scannerCF.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
  } catch (e) {
    messaggioScanner('Accesso alla fotocamera negato o non disponibile: usa "Scatta una foto".', true);
    return;
  }
  const video = document.getElementById('scanner-video');
  video.srcObject = scannerCF.stream;
  await video.play().catch(function () {});
  messaggioScanner('Avvicina la tessera sanitaria: il codice a barre deve riempire il riquadro, dritto e ben illuminato.');
  const cerca = async function () {
    if (!scannerCF.stream) return;
    try {
      if (video.readyState >= 2) {
        const cf = cfDaCodiciLetti(await scannerCF.detector.detect(video));
        if (cf) return trovatoCF(cf);
      }
    } catch (e) { /* fotogramma non leggibile, si riprova */ }
    scannerCF.timer = setTimeout(cerca, 250);
  };
  cerca();
}

async function leggiCFDaFoto(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  messaggioScanner('Lettura della foto...');
  try {
    scannerCF.detector = scannerCF.detector || await creaLettoreCodiciBarre();
    const immagine = await createImageBitmap(file);
    const cf = cfDaCodiciLetti(await scannerCF.detector.detect(immagine));
    if (cf) return trovatoCF(cf);
    messaggioScanner('Codice fiscale non trovato nella foto: scatta piu\' da vicino, con il codice a barre dritto e che riempie la foto.', true);
  } catch (e) {
    messaggioScanner('❌ ' + e.message, true);
  }
}

function trovatoCF(cf) {
  const cb = scannerCF.onTrovato;
  chiudiScannerCF();
  if (cb) cb(cf);
}

function chiudiScannerCF() {
  clearTimeout(scannerCF.timer);
  if (scannerCF.stream) scannerCF.stream.getTracks().forEach(function (t) { t.stop(); });
  scannerCF.stream = null;
  const video = document.getElementById('scanner-video');
  if (video) video.srcObject = null;
  document.getElementById('scanner-overlay').classList.remove('open');
}
