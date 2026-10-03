/**
 * Lettura di un documento d'identita' con la fotocamera (OCR con tesseract.js, tutto sul dispositivo).
 * Riconosce carta d'identita' (anche le righe MRZ del retro), tessera sanitaria e patente,
 * mostra i dati letti per la verifica e poi compila il modulo di inserimento.
 */

const OCR_BASE = 'js/vendor/tesseract/';
let ocrWorker = null;
let docLettura = { stream: null, dati: null, unisci: false };

/* ---------------- Motore OCR ---------------- */

function caricaScript(src) {
  return new Promise(function (ok, ko) {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = function () { ko(new Error('Impossibile caricare ' + src)); };
    document.head.appendChild(s);
  });
}

function wasmSimdSupportato() {
  try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch (e) { return false; }
}

async function preparaOCR(progresso) {
  if (ocrWorker) return ocrWorker;
  if (!window.Tesseract) await caricaScript(OCR_BASE + 'tesseract.min.js');
  const base = new URL(OCR_BASE, location.href).href;
  ocrWorker = await window.Tesseract.createWorker('ita', 1, {
    workerPath: base + 'worker.min.js',
    corePath: base + (wasmSimdSupportato() ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'),
    langPath: base.replace(/\/$/, ''),
    workerBlobURL: false,
    logger: function (m) { if (progresso) progresso(m); },
  });
  return ocrWorker;
}

// Ritaglio (zona del documento), ingrandimento per testi piccoli e contrasto.
// modo 'contrasto': grigi con livelli stirati; modo 'bn': bianco e nero (soglia di Otsu)
function preparaImmagine(sorgente, rett, modo) {
  const scala = Math.max(0.5, Math.min(3, 2400 / rett.w, Math.sqrt(9e6 / (rett.w * rett.h))));
  const w = Math.round(rett.w * scala), h = Math.round(rett.h * scala);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sorgente, rett.x, rett.y, rett.w, rett.h, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const istogramma = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = g;
    istogramma[g]++;
  }
  const n = w * h;
  let basso = 0, alto = 255, somma = 0;
  for (let v = 0; v < 256; v++) { somma += istogramma[v]; if (somma >= n * 0.02) { basso = v; break; } }
  somma = 0;
  for (let v = 255; v >= 0; v--) { somma += istogramma[v]; if (somma >= n * 0.02) { alto = v; break; } }
  const ampiezza = Math.max(1, alto - basso);
  let soglia = 128;
  if (modo === 'bn') {
    // soglia di Otsu sui valori gia' stirati
    const h2 = new Uint32Array(256);
    for (let v = 0; v < 256; v++) h2[Math.max(0, Math.min(255, Math.round((v - basso) * 255 / ampiezza)))] += istogramma[v];
    let sommaTot = 0; for (let v = 0; v < 256; v++) sommaTot += v * h2[v];
    let sB = 0, wB = 0, migliore = 0;
    for (let v = 0; v < 256; v++) {
      wB += h2[v]; if (!wB) continue;
      const wF = n - wB; if (!wF) break;
      sB += v * h2[v];
      const diff = sB / wB - (sommaTot - sB) / wF;
      const varianza = wB * wF * diff * diff;
      if (varianza > migliore) { migliore = varianza; soglia = v; }
    }
  }
  for (let i = 0; i < d.length; i += 4) {
    let g = Math.max(0, Math.min(255, Math.round((d[i] - basso) * 255 / ampiezza)));
    if (modo === 'bn') g = g > soglia ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(img, 0, 0);
  canvas.scala = scala;
  return canvas;
}

/* ---------------- Interpretazione del testo ---------------- */

const ETICHETTE = /\b(COGNOME|COGNOMI|SURNAME|NOME|NOMI|NAME|GIVEN|NAMES|LUOGO|DATA|NASCITA|BIRTH|DATE|PLACE|SESSO|SEX|STATURA|HEIGHT|CITTADINANZA|NATIONALITY|EMISSIONE|ISSUING|SCADENZA|EXPIRY|COMUNE|PROVINCIA|CODICE|FISCALE|FISCAL|CODE|TESSERA|SANITARIA|CARTA|IDENTITA|IDENTITY|CARD|REPUBBLICA|ITALIANA|PATENTE|GUIDA|FIRMA|SIGNATURE)\b/g;

function pulisciNome(s) {
  return String(s || '').toUpperCase()
    .replace(ETICHETTE, ' ')
    .replace(/[^A-ZÀ-Ü' ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function righeOCR(testo) {
  return String(testo || '').toUpperCase().split(/\r?\n/).map(function (r) { return r.trim(); }).filter(Boolean);
}

// Parole di collegamento rimaste da etichette come "LUOGO E DATA DI NASCITA / PLACE AND DATE OF BIRTH"
const SOLO_CONNETTORI = /^((E|DI|OF|AND|THE)\s*)*$/;

// Valore di un'etichetta: sulla stessa riga dopo l'etichetta, altrimenti nella riga successiva
function valoreEtichetta(righe, regex, escludi, conCifre) {
  for (let i = 0; i < righe.length; i++) {
    if (!regex.test(righe[i]) || (escludi && escludi.test(righe[i]))) continue;
    const stessa = pulisciNome(righe[i].replace(regex, ' '));
    if (stessa.length >= 2 && !SOLO_CONNETTORI.test(stessa)) return stessa;
    for (let j = i + 1; j < Math.min(i + 3, righe.length); j++) {
      const v = pulisciNome(righe[j]);
      if (v.length >= 2 && !SOLO_CONNETTORI.test(v) && (conCifre || !/\d{2}/.test(righe[j]))) return v;
    }
  }
  return '';
}

// Correzione degli scambi tipici dell'OCR nel codice fiscale, poi verifica del carattere di controllo
function correggiCF(grezzo) {
  const numeri = { O: '0', Q: '0', D: '0', I: '1', Z: '2', S: '5', B: '8', G: '6' };
  const lettere = { 0: 'O', 1: 'I', 2: 'Z', 5: 'S', 8: 'B', 6: 'G' };
  const posNum = [6, 7, 9, 10, 12, 13, 14];
  if (cfValido(grezzo)) return grezzo;
  const c = grezzo.split('').map(function (ch, i) {
    if (posNum.indexOf(i) >= 0) return /[0-9LMNPQRSTUV]/.test(ch) ? ch : (numeri[ch] || ch);
    return /[A-Z]/.test(ch) ? ch : (lettere[ch] || ch);
  }).join('');
  if (cfValido(c)) return c;
  // nelle posizioni numeriche anche le lettere di omocodia possono essere cifre lette male
  const solo = c.split('').map(function (ch, i) { return posNum.indexOf(i) >= 0 ? (numeri[ch] || ch) : ch; }).join('');
  return cfValido(solo) ? solo : '';
}

function cercaCF(righe) {
  const testo = righe.join(' ');
  const compatti = righe.map(function (r) { return r.replace(/[^A-Z0-9]/g, ''); }).concat([testo.replace(/[^A-Z0-9]/g, '')]);
  for (const t of compatti) {
    for (let i = 0; i + 16 <= t.length; i++) {
      const pezzo = t.slice(i, i + 16);
      if (!/^[A-Z]{3}/.test(pezzo)) continue;
      const cf = correggiCF(pezzo);
      if (cf) return cf;
    }
  }
  return '';
}

// Il codice letto anche se non valido: vicino all'etichetta "codice fiscale", altrimenti la parola piu' simile
function cercaCFGrezzo(righe) {
  const simile = function (t) {
    if (t.length < 15 || t.length > 17) return false;
    const comeLettera = function (c) { return /[A-Z0125689]/.test(c); };
    const comeCifra = function (c) { return /[0-9LMNPQRSTUVOIZSBGD]/.test(c); };
    // inizio (6 lettere, 2 cifre) e fine (lettera, 3 cifre, lettera): reggono anche se in mezzo manca un carattere
    const testa = 'LLLLLLCC', coda = 'LCCCL';
    let errori = 0;
    for (let i = 0; i < testa.length; i++) if (!(testa[i] === 'L' ? comeLettera(t[i]) : comeCifra(t[i]))) errori++;
    const fine = t.slice(-5);
    for (let i = 0; i < 5; i++) if (!(coda[i] === 'L' ? comeLettera(fine[i]) : comeCifra(fine[i]))) errori++;
    return errori <= 1 && /^[A-Z]{3}/.test(t);
  };
  const etichetta = righe.findIndex(function (r) { return /FISCALE|FISCAL/.test(r); });
  const zona = etichetta >= 0 ? righe.slice(etichetta, etichetta + 3).concat(righe) : righe;
  for (const r of zona) {
    const parole = r.replace(/FISCALE|FISCAL|CODICE|CODE/g, ' ').split(/[^A-Z0-9]+/);
    for (const p of parole) if (simile(p)) return p.slice(0, 16);
    const compatta = r.replace(/FISCALE|FISCAL|CODICE|CODE/g, '').replace(/[^A-Z0-9]/g, '');
    if (simile(compatta)) return compatta.slice(0, 16);
  }
  return '';
}

// Le prime 11 lettere del CF dipendono da cognome, nome, data e sesso: se questi sono certi
// (es. dalle righe MRZ) si ricostruiscono e si corregge solo il resto, verificando il carattere di controllo
function riparaCF(grezzo, d) {
  if (!grezzo || grezzo.length < 15 || grezzo.length > 17 || !d.cognome || !d.nome || !d.sesso || !/^\d{2}\/\d{2}\/\d{4}$/.test(d.dataNascita)) return '';
  const [g, m, a] = d.dataNascita.split('/');
  const giorno = String(+g + (d.sesso === 'F' ? 40 : 0)).padStart(2, '0');
  const inizio = codiceCognomeCF(d.cognome) + codiceNomeCF(d.nome) + a.slice(2) + CF_MESI[+m - 1] + giorno;
  return correggiCF(inizio + grezzo.slice(-5));
}

function annoQuattroCifre(a) {
  if (a.length === 4) return +a;
  const n = +a, oggi = new Date().getFullYear() % 100;
  return n > oggi ? 1900 + n : 2000 + n;
}

function cercaDate(testo) {
  const date = [];
  const re = /(\d{1,2})\s?[.\/\-]\s?(\d{1,2})\s?[.\/\-]\s?(\d{4}|\d{2})(?!\d)/g;
  let m;
  while ((m = re.exec(testo))) {
    const g = +m[1], me = +m[2], a = annoQuattroCifre(m[3]);
    if (g >= 1 && g <= 31 && me >= 1 && me <= 12 && a >= 1900 && a <= new Date().getFullYear() + 15) {
      date.push({ testo: String(g).padStart(2, '0') + '/' + String(me).padStart(2, '0') + '/' + a, anno: a, indice: m.index, fine: m.index + m[0].length });
    }
  }
  return date;
}

// Righe MRZ della carta d'identita' (formato TD1, 3 righe da 30 caratteri)
function cifraControlloMRZ(s) {
  const pesi = [7, 3, 1];
  let tot = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const v = c === '<' ? 0 : /\d/.test(c) ? +c : c.charCodeAt(0) - 55;
    tot += v * pesi[i % 3];
  }
  return String(tot % 10);
}
function leggiMRZ(righe) {
  const mrz = righe.map(function (r) { return r.replace(/\s/g, '').replace(/[«‹]/g, '<'); })
    .filter(function (r) { return (r.match(/</g) || []).length >= 2 && r.length >= 25; });
  const out = {};
  mrz.forEach(function (r) {
    const nascita = /^(\d{6})(\d)([MF<])(\d{6})(\d)/.exec(r.replace(/O/g, '0'));
    if (nascita && cifraControlloMRZ(nascita[1]) === nascita[2]) {
      const a = nascita[1].slice(0, 2), m = nascita[1].slice(2, 4), g = nascita[1].slice(4, 6);
      out.dataNascita = g + '/' + m + '/' + annoQuattroCifre(a);
      if (nascita[3] !== '<') out.sesso = nascita[3];
    }
    const nomi = /^([A-Z]+(?:<[A-Z]+)*)<<([A-Z]+(?:<[A-Z]+)*)<*$/.exec(r);
    if (nomi && !/^(C|I|ID)[A-Z<]?ITA/.test(r)) {
      out.cognome = nomi[1].replace(/</g, ' ');
      out.nome = nomi[2].replace(/</g, ' ');
    }
  });
  return out;
}

// Se il codice fiscale e' valido, sceglie tra le parole lette quelle coerenti con le sue lettere
function pezzoDiCF(valore, cf) {
  const v = String(valore || '').replace(/[^A-Z]/g, '');
  return !!cf && v.length >= 2 && cf.indexOf(v) >= 0;
}

function nomeDaCF(righe, cf, parte) {
  const codice = cf.slice(parte === 'cognome' ? 0 : 3, parte === 'cognome' ? 3 : 6);
  const fn = parte === 'cognome' ? codiceCognomeCF : codiceNomeCF;
  for (const r of righe) {
    const parole = pulisciNome(r).split(' ').filter(function (p) { return p.length >= 2; });
    for (let n = Math.min(3, parole.length); n >= 1; n--) {
      for (let i = 0; i + n <= parole.length; i++) {
        const v = parole.slice(i, i + n).join(' ');
        if (fn(v) === codice && !pezzoDiCF(v, cf)) return v;
      }
    }
  }
  return '';
}

// Carta d'identita' (fronte): i valori sono sempre in quest'ordine: cognome, nome, luogo e data di nascita, sesso statura cittadinanza
function campiPerPosizione(righe, nomeNoto) {
  const intestazione = /REPUBBLICA|ITALIANA|CARTA|IDENTIT|IDENTITY|MINISTERO|COMUNE|CARD|PATENTE|TESSERA|SANITARIA|COGNOME|SURNAME|NOME|NAME|LUOGO|NASCITA|PLACE|BIRTH|SESSO|SEX|STATURA|HEIGHT|CITTADINANZA|NATIONALITY|EMISSIONE|ISSUE|SCADENZA|EXPIRY|FIRMA|SIGNATURE/;
  const out = {};
  const rigaNascita = righe.findIndex(function (r) { return cercaDate(r).length && /[A-Z]{3,}/.test(r.split(/\d/)[0]); });
  const fino = rigaNascita >= 0 ? rigaNascita : righe.length;
  const nomi = righe.slice(0, fino)
    .map(function (r) { return r.replace(/[^A-ZÀ-Ü' ]/g, ' ').replace(/\s+/g, ' ').trim(); })
    .filter(function (r) { return r.length >= 2 && !intestazione.test(r) && r !== 'ITA' && /^[A-ZÀ-Ü' ]+$/.test(r); });
  const iNome = nomeNoto ? nomi.indexOf(nomeNoto) : -1;
  if (iNome > 0) { out.cognome = nomi[iNome - 1]; out.nome = nomeNoto; }
  else if (nomi.length >= 2) { out.cognome = nomi[nomi.length - 2]; out.nome = nomi[nomi.length - 1]; }
  if (rigaNascita >= 0) {
    const d = cercaDate(righe[rigaNascita])[0];
    out.dataNascita = d.testo;
    out.luogoNascita = pulisciNome(righe[rigaNascita].slice(0, d.indice));
  }
  const sesso = righe.map(function (r) { return /^([MF])\s+\d{2,3}\b/.exec(r) || /\b([MF])\s+\d{3}\s+[A-Z]{3}\b/.exec(r); }).find(Boolean);
  if (sesso) out.sesso = sesso[1];
  return out;
}

function estraiDatiDocumento(testo, cfCodiceBarre) {
  const righe = righeOCR(testo);
  const tutto = righe.join('\n');
  const dati = { tipo: 'Documento', cognome: '', nome: '', dataNascita: '', sesso: '', luogoNascita: '', codiceFiscale: '' };

  if (/PATENTE|DRIVING/.test(tutto)) dati.tipo = 'Patente';
  else if (/TESSERA|SANITARIA|SERVIZIO SANITARIO/.test(tutto)) dati.tipo = 'Tessera sanitaria';
  else if (/IDENTIT|IDENTITY|<</.test(tutto)) dati.tipo = "Carta d'identita'";

  dati.codiceFiscale = cfCodiceBarre || cercaCF(righe);
  dati.cfGrezzo = dati.codiceFiscale ? '' : cercaCFGrezzo(righe);

  // Patente: campi numerati 1. cognome, 2. nome, 3. data e luogo di nascita
  const campo = function (n) {
    const inizio = new RegExp('^' + n + '\\s?[.,]\\s*(?=\\S)|^' + n + '\\s+(?=[A-Z0-9])');
    const r = righe.find(function (x) { return inizio.test(x); });
    return r ? r.replace(inizio, '') : '';
  };
  if (dati.tipo === 'Patente') {
    dati.cognome = pulisciNome(campo(1));
    dati.nome = pulisciNome(campo(2));
    const c3 = campo(3);
    const d3 = cercaDate(c3)[0];
    if (d3) { dati.dataNascita = d3.testo; dati.luogoNascita = pulisciNome(c3.slice(d3.fine)); }
  }

  if (!dati.cognome) dati.cognome = valoreEtichetta(righe, /\b(COGNOME|COGNOMI|SURNAME)\b/);
  if (!dati.nome) dati.nome = valoreEtichetta(righe, /\b(NOME|NOMI|GIVEN NAMES?|NAME)\b/, /\b(COGNOME|COGNOMI|SURNAME)\b/);
  if (!dati.luogoNascita) dati.luogoNascita = valoreEtichetta(righe, /\b(LUOGO|PLACE)\b/, null, true);
  dati.luogoNascita = dati.luogoNascita.replace(/^((DI|E)\s+)+/, '');
  const sesso = /\b(SESSO|SEX)\b[^MF]{0,15}?\b([MF])\b/.exec(tutto);
  if (sesso) dati.sesso = sesso[2];

  // Data di nascita: quella sulla riga "nascita", altrimenti la piu' vecchia (le altre sono rilascio e scadenza)
  if (!dati.dataNascita) {
    const rigaNascita = righe.findIndex(function (r) { return /NASCITA|BIRTH/.test(r); });
    const vicine = rigaNascita >= 0 ? cercaDate(righe.slice(rigaNascita, rigaNascita + 3).join(' ')) : [];
    const tutte = cercaDate(tutto).filter(function (d) { return d.anno <= new Date().getFullYear(); });
    const scelta = vicine[0] || tutte.sort(function (a, b) { return a.anno - b.anno; })[0];
    if (scelta) dati.dataNascita = scelta.testo;
  }

  if (dati.tipo !== 'Patente' && dati.tipo !== 'Tessera sanitaria' && (!dati.cognome || !dati.nome)) {
    const pos = campiPerPosizione(righe, dati.nome);
    ['cognome', 'nome', 'luogoNascita', 'sesso'].forEach(function (k) { if (!dati[k] && pos[k]) dati[k] = pos[k]; });
    if (pos.dataNascita) dati.dataNascita = pos.dataNascita;
  }

  // Le righe MRZ hanno cifre di controllo: se lette, hanno la precedenza
  const mrz = leggiMRZ(righe);
  ['cognome', 'nome', 'dataNascita', 'sesso'].forEach(function (k) { if (mrz[k]) dati[k] = mrz[k]; });

  if (!dati.codiceFiscale && dati.cfGrezzo) dati.codiceFiscale = riparaCF(dati.cfGrezzo, dati);

  // Il codice fiscale valido corregge cognome, nome, data e sesso letti male
  if (dati.codiceFiscale) {
    if (pezzoDiCF(dati.cognome, dati.codiceFiscale)) dati.cognome = '';
    if (pezzoDiCF(dati.nome, dati.codiceFiscale)) dati.nome = '';
    const daCF = datiDaCF(dati.codiceFiscale);
    if (!dati.cognome || codiceCognomeCF(dati.cognome) !== dati.codiceFiscale.slice(0, 3)) dati.cognome = nomeDaCF(righe, dati.codiceFiscale, 'cognome') || dati.cognome;
    if (!dati.nome || codiceNomeCF(dati.nome) !== dati.codiceFiscale.slice(3, 6)) dati.nome = nomeDaCF(righe, dati.codiceFiscale, 'nome') || dati.nome;
    if (!dati.dataNascita || dati.dataNascita.slice(0, 6) !== daCF.dataNascita.slice(0, 6)) dati.dataNascita = daCF.dataNascita;
    dati.sesso = daCF.sesso;
  }
  return dati;
}

/* ---------------- Interfaccia ---------------- */

function messaggioDoc(testo, errore) {
  const el = document.getElementById('doc-msg');
  el.textContent = testo;
  el.style.color = errore ? '#c0392b' : 'var(--sub)';
}
function vistaDoc(vista) {
  document.getElementById('doc-cattura').style.display = vista === 'cattura' ? 'block' : 'none';
  document.getElementById('doc-revisione').style.display = vista === 'revisione' ? 'block' : 'none';
}
function fermaFotocameraDoc() {
  if (docLettura.stream) docLettura.stream.getTracks().forEach(function (t) { t.stop(); });
  docLettura.stream = null;
  document.getElementById('doc-video').srcObject = null;
}

// Legge l'altro lato dello stesso documento e unisce i dati (es. CF dal retro della carta d'identita')
function leggiAltroLato() {
  docLettura.dati = datiRevisione();
  docLettura.unisci = true;
  apriLetturaDocumento(true);
}
function datiRevisione() {
  const v = function (id) { return document.getElementById(id).value.trim(); };
  return { tipo: (docLettura.dati || {}).tipo || 'Documento', cognome: v('doc-cognome'), nome: v('doc-nome'), dataNascita: v('doc-nascita'), sesso: v('doc-sesso'),
    luogoNascita: v('doc-luogo'), codiceFiscale: cfValido(v('doc-cf')) ? normalizzaCF(v('doc-cf')) : '', cfGrezzo: v('doc-cf'), testo: (docLettura.dati || {}).testo || '' };
}

async function apriLetturaDocumento(altroLato) {
  if (altroLato !== true) docLettura.unisci = false;
  document.getElementById('doc-overlay').classList.add('open');
  vistaDoc('cattura');
  messaggioDoc('Avvio della fotocamera...');
  preparaOCR().catch(function () {}); // il motore si scarica intanto (solo la prima volta)
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    messaggioDoc('Fotocamera non disponibile: usa "Carica foto".', true);
    return;
  }
  try {
    docLettura.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } },
      audio: false,
    });
    const video = document.getElementById('doc-video');
    video.srcObject = docLettura.stream;
    await video.play().catch(function () {});
    messaggioDoc('Inquadra il documento dentro il riquadro, ben illuminato e senza riflessi, poi premi "Scatta".');
  } catch (e) {
    messaggioDoc('Accesso alla fotocamera negato o non disponibile: usa "Carica foto".', true);
  }
}

function chiudiLetturaDocumento() {
  fermaFotocameraDoc();
  document.getElementById('doc-overlay').classList.remove('open');
}

// Zona del fotogramma che corrisponde al riquadro guida (il video e' mostrato con object-fit: cover)
function rettangoloGuida(video) {
  const v = video.getBoundingClientRect();
  const g = document.querySelector('#doc-overlay .doc-guida').getBoundingClientRect();
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!v.width || !g.width || !vw) return null;
  const s = Math.max(v.width / vw, v.height / vh);
  const ox = (vw * s - v.width) / 2, oy = (vh * s - v.height) / 2;
  let x = (g.left - v.left + ox) / s, y = (g.top - v.top + oy) / s, w = g.width / s, h = g.height / s;
  x -= w * 0.06; y -= h * 0.06; w *= 1.12; h *= 1.12; // un po' di margine
  x = Math.max(0, x); y = Math.max(0, y);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(Math.min(w, vw - x)), h: Math.round(Math.min(h, vh - y)) };
}

async function scattaDocumento() {
  const video = document.getElementById('doc-video');
  if (!docLettura.stream || video.readyState < 2) { messaggioDoc('Fotocamera non pronta: attendi un momento o usa "Carica foto".', true); return; }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const guida = rettangoloGuida(video);
  fermaFotocameraDoc();
  await analizzaDocumento(canvas, canvas.width, canvas.height, guida);
}

async function caricaFotoDocumento(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  fermaFotocameraDoc();
  try {
    const img = await createImageBitmap(file);
    await analizzaDocumento(img, img.width, img.height);
  } catch (e) {
    messaggioDoc('❌ Foto non leggibile: ' + e.message, true);
  }
}

async function analizzaDocumento(sorgente, larghezza, altezza, ritaglio) {
  const pulsanti = document.querySelectorAll('#doc-cattura button, #doc-cattura label');
  pulsanti.forEach(function (b) { b.style.pointerEvents = 'none'; b.style.opacity = '.5'; });
  try {
    messaggioDoc('Preparazione della lettura (la prima volta scarica circa 6 MB)...');
    let passo = '';
    const worker = await preparaOCR(function (m) {
      if (m.status === 'recognizing text') messaggioDoc('Lettura del testo' + passo + '... ' + Math.round(m.progress * 100) + '%');
    });
    // Codice a barre (tessera sanitaria): da' il CF esatto; poi lo si copre perche' confonde l'OCR
    const codici = await creaLettoreCodiciBarre().then(function (det) { return det.detect(sorgente); }).catch(function () { return []; });
    const cfBarre = cfDaCodiciLetti(codici);
    const intera = { x: 0, y: 0, w: larghezza, h: altezza };
    const zona = ritaglio || intera;
    const tentativi = [[zona, 'contrasto', '6'], [zona, 'contrasto', '11'], [zona, 'bn', '6']];
    if (ritaglio) tentativi.push([intera, 'contrasto', '6']);

    let testo = '';
    let dati = null;
    for (let i = 0; i < tentativi.length; i++) {
      const [rett, modo, psm] = tentativi[i];
      passo = ' (tentativo ' + (i + 1) + ')';
      const immagine = preparaImmagine(sorgente, rett, modo);
      const ctx = immagine.getContext('2d');
      ctx.fillStyle = '#fff';
      codici.forEach(function (c) {
        const r = c.boundingBox;
        ctx.fillRect((r.x - rett.x - 10) * immagine.scala, (r.y - rett.y - 10) * immagine.scala, (r.width + 20) * immagine.scala, (r.height + 20) * immagine.scala);
      });
      await worker.setParameters({ tessedit_pageseg_mode: psm, user_defined_dpi: '300' });
      const { data: risultato } = await worker.recognize(immagine);
      testo += (testo ? '\n----\n' : '') + risultato.text;
      const nuovi = estraiDatiDocumento(risultato.text, cfBarre);
      if (!dati) dati = nuovi;
      else Object.keys(nuovi).forEach(function (k) { if (!dati[k] && nuovi[k]) dati[k] = nuovi[k]; });
      const serveCF = /FISCALE|FISCAL/.test(testo) && !dati.codiceFiscale;
      if (dati.cognome && dati.nome && dati.dataNascita && !serveCF) break;
    }
    // Secondo lato dello stesso documento: si completano i dati del primo
    if (docLettura.unisci && docLettura.dati) {
      const primo = docLettura.dati;
      Object.keys(dati).forEach(function (k) { if (k !== 'testo' && dati[k] && (!primo[k] || k === 'codiceFiscale')) primo[k] = dati[k]; });
      primo.testo = (primo.testo ? primo.testo + '\n====\n' : '') + testo;
      dati = primo;
      testo = primo.testo;
    }
    // CF letto con errori: si ripara con i dati raccolti da tutti i tentativi (es. MRZ)
    if (!dati.codiceFiscale && dati.cfGrezzo) dati.codiceFiscale = riparaCF(dati.cfGrezzo, dati);
    if (dati.tipo === 'Documento' && cfBarre) dati.tipo = 'Tessera sanitaria';
    dati.testo = testo;
    docLettura.dati = dati;
    mostraRevisioneDocumento(dati);
  } catch (e) {
    messaggioDoc('❌ Lettura non riuscita: ' + e.message, true);
  } finally {
    pulsanti.forEach(function (b) { b.style.pointerEvents = ''; b.style.opacity = ''; });
  }
}

function mostraRevisioneDocumento(d) {
  vistaDoc('revisione');
  document.getElementById('doc-tipo').textContent = d.tipo + ' — controlla e correggi i dati prima di usarli';
  document.getElementById('doc-cognome').value = d.cognome;
  document.getElementById('doc-nome').value = d.nome;
  document.getElementById('doc-nascita').value = d.dataNascita;
  document.getElementById('doc-sesso').value = d.sesso;
  document.getElementById('doc-luogo').value = d.luogoNascita;
  document.getElementById('doc-cf').value = d.codiceFiscale || d.cfGrezzo || '';
  document.getElementById('doc-testo').textContent = d.testo || '';
  verificaRevisioneDocumento();
}

function verificaRevisioneDocumento() {
  const el = document.getElementById('doc-verifica');
  const cf = normalizzaCF(document.getElementById('doc-cf').value);
  if (!cf) {
    el.style.color = '#b5842a';
    el.textContent = /identit/i.test((docLettura.dati || {}).tipo || '')
      ? 'Sul fronte della carta d\'identita\' il codice fiscale non c\'e\': premi "+ Leggi l\'altro lato" e inquadra il retro.'
      : 'Codice fiscale non trovato: puoi scriverlo a mano o premere "+ Leggi l\'altro lato".';
    return;
  }
  if (!cfValido(cf)) { el.style.color = '#c0392b'; el.textContent = '❌ Codice fiscale letto in modo incerto (' + cf.length + '/16 caratteri, controllo non valido): confrontalo con il documento e correggi il carattere sbagliato.'; return; }
  const avvisi = controllaCoerenzaCF(cf, document.getElementById('doc-cognome').value, document.getElementById('doc-nome').value, document.getElementById('doc-nascita').value);
  el.style.color = avvisi.length ? '#b5842a' : 'var(--accent)';
  el.textContent = avvisi.length ? '⚠️ ' + avvisi.join('; ') : '✓ Codice fiscale valido e coerente con nome, cognome e data';
}

function usaDatiDocumento() {
  const v = function (id) { return document.getElementById(id).value.trim(); };
  const cf = normalizzaCF(v('doc-cf'));
  if (cf && !cfValido(cf)) { verificaRevisioneDocumento(); return; }
  document.getElementById('f-cognome').value = v('doc-cognome').toUpperCase();
  document.getElementById('f-nome').value = v('doc-nome').toUpperCase();
  document.getElementById('f-cf').value = v('doc-nascita');
  document.getElementById('f-codfisc').value = cf;
  document.getElementById('cli-cerca').value = (v('doc-cognome') + ' ' + v('doc-nome')).trim().toUpperCase();
  chiudiLetturaDocumento();
  if (cf) onCFLetto(cf);
  else { controllaCampoCF(); aggiornaStoricoForm(); avviso('✓ Dati del documento inseriti nel modulo'); }
}
