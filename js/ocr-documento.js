/**
 * Lettura di un documento d'identita' con la fotocamera (OCR con tesseract.js, tutto sul dispositivo).
 * Riconosce carta d'identita' (anche le righe MRZ del retro), tessera sanitaria e patente,
 * mostra i dati letti per la verifica e poi compila il modulo di inserimento.
 */

const OCR_BASE = 'js/vendor/tesseract/';
let ocrWorker = null;
let docLettura = { stream: null, dati: null, unisci: false, destinazione: 'titolare' };

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

// Quanti caratteri non sono del tipo giusto (lettera/cifra) prima di ogni correzione
function erroriStrutturaCF(t) {
  const schema = 'LLLLLLCCLCCLCCCL';
  let e = 0;
  for (let i = 0; i < 16; i++) {
    const c = t[i] || '';
    if (schema[i] === 'L' ? !/[A-Z]/.test(c) : !/[0-9LMNPQRSTUV]/.test(c)) e++;
  }
  return e;
}
function cfPlausibile(cf) {
  const g = +cfSenzaOmocodia(cf).slice(9, 11);
  return (g >= 1 && g <= 31) || (g >= 41 && g <= 71);
}
// Codice fiscale nel testo: si cerca riga per riga (mai unendo righe diverse, darebbe codici "validi" per caso)
// e si accettano solo pezzi gia' quasi giusti prima delle correzioni
function cercaCF(righe) {
  for (const r of righe) {
    const parole = r.split(/[^A-Z0-9]+/).filter(Boolean);
    const candidati = parole.slice();
    for (let i = 0; i + 1 < parole.length; i++) candidati.push(parole[i] + parole[i + 1]);
    for (const c of candidati) {
      if (c.length !== 16 || !/^[A-Z]{3}/.test(c) || erroriStrutturaCF(c) > 3) continue;
      const cf = correggiCF(c);
      if (cf && cfPlausibile(cf)) return cf;
    }
  }
  for (const r of righe) {
    const t = r.replace(/[^A-Z0-9]/g, '');
    for (let i = 0; i + 16 <= t.length; i++) {
      const pezzo = t.slice(i, i + 16);
      if (!/^[A-Z]{3}/.test(pezzo) || erroriStrutturaCF(pezzo) > 1) continue;
      const cf = correggiCF(pezzo);
      if (cf && cfPlausibile(cf)) return cf;
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
    if (/<</.test(r)) continue; // righe MRZ
    const parole = r.replace(/FISCALE|FISCAL|CODICE|CODE/g, ' ').split(/[^A-Z0-9]+/);
    for (const p of parole) if (simile(p)) return p.slice(0, 16);
    const compatta = r.replace(/FISCALE|FISCAL|CODICE|CODE/g, '').replace(/[^A-Z0-9]/g, '');
    if (simile(compatta)) return compatta.slice(0, 16);
  }
  return '';
}

// Le prime 11 lettere del CF dipendono da cognome, nome, data e sesso: se questi sono certi
// (es. dalle righe MRZ) si ricostruiscono e si corregge solo il resto, verificando il carattere di controllo
function prefissoCF(d) {
  if (!d.cognome || !d.nome || !d.sesso || !/^\d{2}\/\d{2}\/\d{4}$/.test(d.dataNascita)) return '';
  const [g, m, a] = d.dataNascita.split('/');
  const giorno = String(+g + (d.sesso === 'F' ? 40 : 0)).padStart(2, '0');
  return codiceCognomeCF(d.cognome) + codiceNomeCF(d.nome) + a.slice(2) + CF_MESI[+m - 1] + giorno;
}
function riparaCF(grezzo, d) {
  if (!grezzo || grezzo.length < 15 || grezzo.length > 17) return '';
  const inizio = prefissoCF(d);
  return inizio ? correggiCF(inizio + grezzo.slice(-5)) : '';
}
// Somiglianza tra un pezzo letto e l'inizio atteso del CF (scambi tipici lettera/cifra contano come uguali)
function somiglianzaCF(pezzo, atteso) {
  const uguali = { '0': 'OQD', '1': 'IL', '2': 'Z', '5': 'S', '6': 'G', '8': 'B' };
  let n = 0;
  for (let i = 0; i < atteso.length && i < pezzo.length; i++) {
    const a = atteso[i], p = pezzo[i];
    if (a === p || (uguali[a] && uguali[a].indexOf(p) >= 0) || (uguali[p] && uguali[p].indexOf(a) >= 0)) n++;
  }
  return n;
}
// Con l'inizio del CF ricavato dall'MRZ si cerca nel testo il pezzo piu' simile e se ne corregge la fine
function cfDaPrefisso(righe, d, soloGrezzo) {
  const inizio = prefissoCF(d);
  if (!inizio) return '';
  let grezzo = '', punti = 0;
  for (const r of righe) {
    const t = r.replace(/[^A-Z0-9]/g, '');
    for (let i = 0; i + 16 <= t.length; i++) {
      const p = somiglianzaCF(t.slice(i, i + 11), inizio);
      if (p >= 8 && p > punti) { punti = p; grezzo = inizio + t.slice(i + 11, i + 16); }
    }
  }
  if (soloGrezzo) return grezzo;
  for (const r of righe) {
    const t = r.replace(/[^A-Z0-9]/g, '');
    for (let i = 0; i + 14 <= t.length; i++) {
      if (somiglianzaCF(t.slice(i, i + 11), inizio) < 8) continue;
      for (const lung of [16, 15, 17]) {
        const pezzo = t.slice(i, i + lung);
        if (pezzo.length < lung) continue;
        const cf = correggiCF(inizio + pezzo.slice(-5));
        if (cf) return cf;
      }
    }
  }
  return '';
}

function annoQuattroCifre(a) {
  if (a.length === 4) return +a;
  const n = +a, oggi = new Date().getFullYear() % 100;
  return n > oggi ? 1900 + n : 2000 + n;
}

function cercaDate(testo) {
  const date = [];
  const re = /(\d{1,2})\s?[.\/\-:,]\s?(\d{1,2})\s?[.\/\-:,]\s?(\d{4}|\d{2})(?!\d)/g;
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
  const out = {};
  const cifra = function (t) { return t.replace(/[OQD]/g, '0').replace(/[IL]/g, '1').replace(/Z/g, '2').replace(/S/g, '5').replace(/B/g, '8').replace(/G/g, '6'); };
  righe.map(function (r) { return r.replace(/\s/g, '').replace(/[«‹(\[{]/g, '<'); }).forEach(function (r) {
    // riga 2: nascita AAMMGG + controllo, sesso, scadenza AAMMGG + controllo
    const re2 = /([0-9OQDILZSBG]{6})([0-9OQDILZSBG])([MF<])([0-9OQDILZSBG]{6})([0-9OQDILZSBG])/g;
    let m2;
    while ((m2 = re2.exec(r))) {
      const nascita = cifra(m2[1]), cn = cifra(m2[2]), scad = cifra(m2[4]), cs = cifra(m2[5]);
      if (cifraControlloMRZ(nascita) !== cn && cifraControlloMRZ(scad) !== cs) continue;
      if (cifraControlloMRZ(nascita) !== cn) continue;
      const mm = +nascita.slice(2, 4), gg = +nascita.slice(4, 6);
      if (mm < 1 || mm > 12 || gg < 1 || gg > 31) continue;
      out.dataNascita = nascita.slice(4, 6) + '/' + nascita.slice(2, 4) + '/' + annoQuattroCifre(nascita.slice(0, 2));
      if (m2[3] !== '<') out.sesso = m2[3];
      // scadenza del documento (anno sempre 20xx), solo se la sua cifra di controllo torna
      if (cifraControlloMRZ(scad) === cs && +scad.slice(2, 4) >= 1 && +scad.slice(2, 4) <= 12) out.scadenzaDocumento = scad.slice(4, 6) + '/' + scad.slice(2, 4) + '/20' + scad.slice(0, 2);
      break;
    }
    // riga 3: COGNOME<<NOME<SECONDO<<<<
    if (out.cognome || (r.match(/\d/g) || []).length > 2 || /^(C|I|ID|CI)[A-Z<]?ITA/.test(r) || r.length < 15) return;
    const m3 = /^[^A-Z]*([A-Z]+(?:<[A-Z]+)*)<<([A-Z<]*)/.exec(r);
    if (!m3) return;
    const nome = m3[2].split(/<<|KK/)[0].replace(/K+$/, function (k) { return k.length > 1 ? '' : k; }).replace(/</g, ' ').trim();
    const cognome = m3[1].replace(/</g, ' ').trim();
    if (cognome.length >= 2 && nome.length >= 2) { out.cognome = cognome; out.nome = nome; }
  });
  return out;
}

// Carta d'identita' elettronica (fronte): etichette bilingue spesso lette male ("NOMETNAME", "COGNOME 7-SURNAME"),
// si riconoscono dalle lettere e il valore e' nella riga successiva
function etichettaCIE(r) {
  const t = r.replace(/[^A-Z]/g, '');
  if (/COGNOM|SURNAM/.test(t)) return 'cognome';
  if (/LUOGO|NASCIT|BIRTH|PLACEAND/.test(t)) return 'nascita';
  if (/SESSO|STATUR|HEIGHT|CITTADIN|NATIONAL/.test(t)) return 'sesso';
  if (/EMISSION|ISSUING|SCADENZ|EXPIRY/.test(t)) return 'altro';
  if (/COMUNED|MUNICIPAL/.test(t)) return 'altro';
  if (/FIRMA|SIGNATUR|REPUBBLICA|MINISTERO|IDENTIT|IDENTITY/.test(t)) return 'altro';
  if (/CODICEFISC|FISCALCOD/.test(t)) return 'altro';
  if (/^(NOME|NOMI)|NOME.?NAME|GIVENNAME|^NAME/.test(t)) return 'nome';
  return null;
}
function pulisciValoreNome(r) {
  const parole = pulisciNome(r).split(' ').filter(Boolean);
  while (parole.length > 1 && parole[parole.length - 1].length <= 2) parole.pop();
  while (parole.length > 1 && parole[0].length === 1) parole.shift();
  return parole.join(' ');
}
function campiCIE(righe) {
  const out = {};
  let trovate = 0;
  righe.forEach(function (r, i) {
    const k = etichettaCIE(r);
    if (!k) return;
    trovate++;
    if (k === 'altro' || out[k]) return;
    // valore sulla stessa riga dopo l'etichetta (documenti cartacei), altrimenti nelle righe sotto
    const resto = r.replace(/COGNOM[EI]|SURNAME|NOM[EI]|GIVEN\s*NAMES?|NAME|LUOGO|DATA|NASCITA|PLACE|DATE|BIRTH|SESSO|SEX|STATURA|HEIGHT|CITTADINANZA|NATIONALITY|\b(E|DI|OF|AND)\b/g, ' ');
    const daProvare = [resto].concat(righe.slice(i + 1, i + 3));
    for (let j = 0; j < daProvare.length; j++) {
      if (j > 0 && etichettaCIE(daProvare[j])) break;
      const v = daProvare[j];
      if (k === 'cognome' || k === 'nome') {
        const n = pulisciValoreNome(v);
        if (/[A-Z]{3}/.test(n) && !/\d{2}/.test(v)) { out[k] = n; break; }
      } else if (k === 'nascita') {
        const date = cercaDate(v);
        if (date.length) {
          const d = date[date.length - 1];
          out.dataNascita = d.testo;
          out.luogoNascita = pulisciValoreNome(v.slice(0, d.indice));
          break;
        }
      } else if (k === 'sesso') {
        const s = /^[^A-Z0-9]*([MF])(?![A-Z])/.exec(v);
        if (s) { out.sesso = s[1]; break; }
      }
    }
  });
  return trovate >= 3 ? out : {};
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
  const dati = { tipo: 'Documento', cognome: '', nome: '', dataNascita: '', sesso: '', luogoNascita: '', codiceFiscale: '', scadenzaDocumento: '' };

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

  if (dati.tipo !== 'Patente' && dati.tipo !== 'Tessera sanitaria') {
    const cie = campiCIE(righe);
    ['cognome', 'nome', 'dataNascita', 'luogoNascita', 'sesso'].forEach(function (k) { if (cie[k]) dati[k] = cie[k]; });
    var dataDaCIE = !!cie.dataNascita;
  }
  if (!dati.cognome) dati.cognome = valoreEtichetta(righe, /\b(COGNOME|COGNOMI|SURNAME)\b/);
  if (!dati.nome) dati.nome = valoreEtichetta(righe, /\b(NOME|NOMI|GIVEN NAMES?|NAME)\b/, /\b(COGNOME|COGNOMI|SURNAME)\b/);
  if (!dati.luogoNascita) dati.luogoNascita = valoreEtichetta(righe, /\b(LUOGO|PLACE)\b/, null, true);
  dati.luogoNascita = dati.luogoNascita.replace(/^((DI|E)\s+)+/, '');
  const sesso = /\b(SESSO|SEX)\b[^MF]{0,15}?\b([MF])\b/.exec(tutto);
  if (sesso && !dati.sesso) dati.sesso = sesso[2];

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
    if (pos.dataNascita && !dataDaCIE) dati.dataNascita = pos.dataNascita;
  }

  dati.scadenzaDocumento = scadenzaDaEtichetta(righe, dati.tipo === 'Patente' ? campo('4B') || campo('4 B') : '');
  return rifinisciDati(dati, righe);
}
// Scadenza: riga "scadenza / expiry" (il valore e' la data piu' lontana nelle righe vicine), patente campo 4b
function scadenzaDaEtichetta(righe, campo4b) {
  const futura = function (date) { return date.filter(function (d) { return d.anno >= 2000; }).sort(function (a, b) { return b.anno - a.anno; })[0]; };
  if (campo4b) { const d = futura(cercaDate(campo4b)); if (d) return d.testo; }
  for (let i = 0; i < righe.length; i++) {
    if (!/SCADENZ|EXPIRY|EXPIRES|VALIDIT/.test(righe[i].replace(/[^A-Z]/g, ''))) continue;
    const d = futura(cercaDate(righe.slice(i, i + 3).join(' ')));
    if (d) return d.testo;
  }
  return '';
}

// MRZ (con cifre di controllo) e codice fiscale valido correggono i dati letti dalle etichette
function rifinisciDati(dati, righe) {
  dati.cognome = pulisciValoreNome(dati.cognome);
  dati.nome = pulisciValoreNome(dati.nome);
  const mrz = leggiMRZ(righe);
  ['cognome', 'nome', 'dataNascita', 'sesso', 'scadenzaDocumento'].forEach(function (k) { if (mrz[k]) dati[k] = mrz[k]; });
  // Un CF che contraddice la data dell'MRZ (che ha la cifra di controllo) e' stato letto male
  if (dati.codiceFiscale && mrz.dataNascita) {
    const d = datiDaCF(dati.codiceFiscale).dataNascita;
    if (d.slice(0, 6) + d.slice(8) !== mrz.dataNascita.slice(0, 6) + mrz.dataNascita.slice(8)) { dati.cfGrezzo = dati.codiceFiscale; dati.codiceFiscale = ''; }
  }

  if (!dati.codiceFiscale && dati.cfGrezzo) dati.codiceFiscale = riparaCF(dati.cfGrezzo, dati);
  if (!dati.codiceFiscale) dati.codiceFiscale = cfDaPrefisso(righe, dati);
  // Non verificabile: si mostra almeno l'inizio giusto (da MRZ) con la fine letta, da controllare a mano
  if (!dati.codiceFiscale) dati.cfGrezzo = cfDaPrefisso(righe, dati, true) || dati.cfGrezzo;

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
    luogoNascita: v('doc-luogo'), scadenzaDocumento: v('doc-scad'), codiceFiscale: cfValido(v('doc-cf')) ? normalizzaCF(v('doc-cf')) : '', cfGrezzo: v('doc-cf'), testo: (docLettura.dati || {}).testo || '' };
}

// Documento del titolare o del coniuge (dichiarazione congiunta)
function apriLetturaDocumentoPer(chi) {
  docLettura.destinazione = chi === 'coniuge' || chi === 'archivio' ? chi : 'titolare';
  document.getElementById('doc-titolo').textContent = chi === 'coniuge' ? '📄 Leggi documento del coniuge' : chi === 'archivio' ? '📇 Nuovo cliente in archivio da documento' : '📄 Leggi documento';
  apriLetturaDocumento();
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
  await leggiFileDocumento(file);
}
// Un file (PDF o foto) arrivato in qualsiasi modo: scelto, trascinato o incollato
async function leggiFileDocumento(file) {
  fermaFotocameraDoc();
  if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name) || /^image\//.test(file.type))) { messaggioDoc('❌ Questo file non è un PDF né una foto.', true); return; }
  try {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) { await leggiPdfDocumento(file); return; }
    const img = await createImageBitmap(file);
    await analizzaDocumento(img, img.width, img.height);
  } catch (e) {
    messaggioDoc('❌ File non leggibile: ' + e.message, true);
  }
}

// Finestra "Inserisci PDF": si trascina dentro il file (o si incolla con Ctrl+V, o si sceglie) senza fotocamera
function apriInserisciDocumento(chi) {
  docLettura.destinazione = chi === 'coniuge' || chi === 'archivio' ? chi : 'titolare';
  docLettura.unisci = false;
  const vecchio = document.getElementById('doc-drop'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'doc-drop';
  ov.style.cssText = 'position:fixed; inset:0; z-index:480; background:rgba(15,27,45,.55); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; padding:18px; width:min(520px, 100%); box-shadow:0 20px 50px rgba(0,0,0,.3)">'
    + '<div style="font-weight:800; font-size:17px; margin-bottom:10px">' + (chi === 'archivio' ? '📇 Nuovo cliente da PDF' : chi === 'coniuge' ? '📥 PDF del documento del coniuge' : '📥 Inserisci il PDF del documento') + '</div>'
    + '<label id="doc-drop-zona" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; min-height:200px; border:3px dashed #1d4f91; border-radius:14px; background:#eef3fa; color:#1d4f91; text-align:center; padding:18px; cursor:pointer; margin:0">'
    + '<span style="font-size:42px">📄</span><b style="font-size:16px">Trascina qui il PDF o la foto del documento</b>'
    + '<span style="font-size:13px; color:#3b5578">oppure copialo e incollalo qui con <b>Ctrl+V</b>, oppure tocca qui per sceglierlo</span>'
    + '<input id="doc-drop-file" type="file" accept="application/pdf,.pdf,image/*" style="display:none"></label>'
    + '<div style="font-size:11.5px; color:var(--sub); margin-top:8px">Carta d\'identità, tessera sanitaria o patente, anche fronte e retro nello stesso PDF. Il file resta sul computer: viene solo letto.</div>'
    + '<div style="text-align:right; margin-top:10px"><button type="button" id="doc-drop-chiudi" style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:7px 16px; cursor:pointer">Annulla</button></div></div>';
  document.body.appendChild(ov);
  const zona = ov.querySelector('#doc-drop-zona');
  const chiudi = function () { ov.remove(); document.removeEventListener('paste', incolla); };
  const usa = function (file) {
    if (!file) return;
    chiudi();
    document.getElementById('doc-titolo').textContent = chi === 'coniuge' ? '📄 Documento del coniuge' : chi === 'archivio' ? '📇 Nuovo cliente in archivio da documento' : '📄 Leggi documento';
    document.getElementById('doc-overlay').classList.add('open');
    vistaDoc('cattura');
    messaggioDoc('Lettura del file ' + (file.name || '') + '...');
    preparaOCR().catch(function () {});
    leggiFileDocumento(file);
  };
  const incolla = function (e) { const f = Array.from((e.clipboardData || {}).files || [])[0]; if (f) { e.preventDefault(); usa(f); } };
  document.addEventListener('paste', incolla);
  ov.querySelector('#doc-drop-file').onchange = function () { usa(this.files && this.files[0]); };
  ov.querySelector('#doc-drop-chiudi').onclick = chiudi;
  ov.addEventListener('click', function (e) { if (e.target === ov) chiudi(); });
  ['dragenter', 'dragover'].forEach(function (t) { zona.addEventListener(t, function (e) { e.preventDefault(); zona.style.background = '#d6e6fb'; }); });
  zona.addEventListener('dragleave', function () { zona.style.background = '#eef3fa'; });
  zona.addEventListener('drop', function (e) { e.preventDefault(); usa(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
}
// Si può trascinare un file anche dentro la finestra della fotocamera
document.addEventListener('DOMContentLoaded', function () {
  const ov = document.getElementById('doc-overlay');
  if (!ov) return;
  ['dragenter', 'dragover'].forEach(function (t) { ov.addEventListener(t, function (e) { e.preventDefault(); }); });
  ov.addEventListener('drop', function (e) { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) leggiFileDocumento(f); });
});

// PDF (es. scansione della carta d'identita'): ogni pagina diventa un'immagine; se ci sono due pagine
// (fronte e retro) i dati si uniscono come con "+ Leggi l'altro lato"
const PDFJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
async function leggiPdfDocumento(file) {
  messaggioDoc('Apertura del PDF...');
  if (!window.pdfjsLib) await caricaScript(PDFJS_BASE + 'pdf.min.js');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pagine = Math.min(pdf.numPages, 2);
  for (let n = 1; n <= pagine; n++) {
    const pagina = await pdf.getPage(n);
    const base = pagina.getViewport({ scale: 1 });
    // circa 2500 pixel sul lato lungo: abbastanza per leggere bene i caratteri piccoli
    const scala = Math.min(4, 2500 / Math.max(base.width, base.height));
    const vista = pagina.getViewport({ scale: scala });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vista.width); canvas.height = Math.round(vista.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvasContext: ctx, viewport: vista }).promise;
    if (n === 2) { docLettura.dati = datiRevisione(); docLettura.unisci = true; }
    messaggioDoc('Lettura della pagina ' + n + ' di ' + pagine + '...');
    await analizzaDocumento(canvas, canvas.width, canvas.height);
  }
}

// Righe lette con la loro posizione nella foto originale
function righeConPosizione(risultato, rett, scala) {
  const out = [];
  (risultato.blocks || []).forEach(function (b) {
    (b.paragraphs || []).forEach(function (p) {
      (p.lines || []).forEach(function (l) {
        out.push({ testo: String(l.text || '').toUpperCase().trim(), x0: rett.x + l.bbox.x0 / scala, y0: rett.y + l.bbox.y0 / scala, x1: rett.x + l.bbox.x1 / scala, y1: rett.y + l.bbox.y1 / scala });
      });
    });
  });
  return out;
}
function rettangoloDentro(x0, y0, x1, y1, w, h) {
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(w, Math.ceil(x1)); y1 = Math.min(h, Math.ceil(y1));
  return x1 - x0 > 20 && y1 - y0 > 10 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}
function rigaMRZ(t) { const c = t.replace(/\s/g, ''); return c.length >= 20 && (c.match(/</g) || []).length >= 3; }
// Zona delle 3 righe MRZ: dal tentativo che ne ha lette di piu', con un margine di una riga sopra e sotto
function trovaZonaMRZ(passate, w, h) {
  let migliori = [];
  passate.forEach(function (righe) { const m = righe.filter(function (r) { return rigaMRZ(r.testo); }); if (m.length > migliori.length) migliori = m; });
  if (!migliori.length) return null;
  const x0 = Math.min.apply(null, migliori.map(function (r) { return r.x0; })), x1 = Math.max.apply(null, migliori.map(function (r) { return r.x1; }));
  const y0 = Math.min.apply(null, migliori.map(function (r) { return r.y0; })), y1 = Math.max.apply(null, migliori.map(function (r) { return r.y1; }));
  const hr = (y1 - y0) / migliori.length;
  const sopra = migliori.length < 3 ? hr * (3 - migliori.length) * 1.3 : hr * 0.6;
  return rettangoloDentro(x0 - (x1 - x0) * 0.04, y0 - sopra, x1 + (x1 - x0) * 0.04, y1 + sopra, w, h);
}
// Zona del codice fiscale: la riga sotto l'etichetta "codice fiscale" (o la stessa riga, a destra)
function trovaZonaCF(passate, w, h) {
  for (const righe of passate) {
    const i = righe.findIndex(function (r) { return /FISCAL/.test(r.testo.replace(/[^A-Z]/g, '')); });
    if (i < 0) continue;
    const e = righe[i], he = e.y1 - e.y0, we = e.x1 - e.x0;
    const sotto = righe.slice(i + 1).find(function (r) { return r.y0 >= e.y1 - he * 0.3 && r.y0 < e.y1 + he * 3 && r.x0 < e.x1 && r.x1 > e.x0 - we * 0.2; });
    if (sotto) return rettangoloDentro(sotto.x0 - he, sotto.y0 - he * 0.5, sotto.x1 + he, sotto.y1 + he * 0.5, w, h);
    return rettangoloDentro(e.x0 - he, e.y1, e.x0 + Math.max(we * 1.4, he * 20), e.y1 + he * 3.2, w, h);
  }
  return null;
}
// Riga che somiglia all'inizio del CF atteso (ricavato dall'MRZ), quando l'etichetta non e' stata letta
function trovaRigaCFPerPrefisso(passate, d, w, h) {
  const inizio = prefissoCF(d);
  if (!inizio) return null;
  let migliore = null, punti = 5;
  passate.forEach(function (righe) {
    righe.forEach(function (r) {
      if (rigaMRZ(r.testo)) return;
      const t = r.testo.replace(/[^A-Z0-9]/g, '');
      for (let i = 0; i + 8 <= t.length; i++) {
        const p = somiglianzaCF(t.slice(i, i + 11), inizio);
        if (p > punti) { punti = p; migliore = r; }
      }
    });
  });
  if (!migliore) return null;
  const he = migliore.y1 - migliore.y0;
  return rettangoloDentro(migliore.x0 - he, migliore.y0 - he * 0.5, migliore.x1 + he * 2, migliore.y1 + he * 0.5, w, h);
}
async function leggiZona(worker, sorgente, zona, modo, psm, ammessi) {
  const immagine = preparaImmagine(sorgente, zona, modo);
  await worker.setParameters({ tessedit_pageseg_mode: psm, user_defined_dpi: '300', tessedit_char_whitelist: ammessi });
  const { data } = await worker.recognize(immagine);
  return data.text || '';
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
    const passate = []; // righe di ogni tentativo con la posizione nella foto
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
      await worker.setParameters({ tessedit_pageseg_mode: psm, user_defined_dpi: '300', tessedit_char_whitelist: '' });
      const { data: risultato } = await worker.recognize(immagine, {}, { text: true, blocks: true });
      passate.push(righeConPosizione(risultato, rett, immagine.scala));
      testo += (testo ? '\n----\n' : '') + risultato.text;
      const nuovi = estraiDatiDocumento(risultato.text, cfBarre);
      if (!dati) dati = nuovi;
      else Object.keys(nuovi).forEach(function (k) { if (!dati[k] && nuovi[k]) dati[k] = nuovi[k]; });
      const serveCF = (/FISCALE|FISCAL|<</.test(testo)) && !dati.codiceFiscale;
      const serveMRZ = /<</.test(testo) && !leggiMRZ(righeOCR(testo)).dataNascita;
      if (dati.cognome && dati.nome && dati.dataNascita && !serveCF && !serveMRZ) break;
    }

    // Letture mirate: righe MRZ e codice fiscale, ritagliate e lette solo con i caratteri ammessi
    const zonaMRZ = trovaZonaMRZ(passate, larghezza, altezza);
    if (zonaMRZ) {
      for (const modo of ['contrasto', 'bn']) {
        passo = ' (righe in basso)';
        const t = await leggiZona(worker, sorgente, zonaMRZ, modo, '6', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<');
        testo += '\n----\n' + t;
        const m = leggiMRZ(righeOCR(t));
        if (m.dataNascita && m.cognome) break;
      }
    }
    if (!cfBarre && /FISCAL|<</.test(testo) && !cercaCF(righeOCR(testo))) {
      const zonaCF = trovaZonaCF(passate, larghezza, altezza) || trovaRigaCFPerPrefisso(passate, estraiDatiDocumento(testo, null), larghezza, altezza);
      if (zonaCF) {
        for (const [modo, psm] of [['contrasto', '7'], ['bn', '7'], ['contrasto', '6']]) {
          passo = ' (codice fiscale)';
          const t = await leggiZona(worker, sorgente, zonaCF, modo, psm, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
          testo += '\n----\n' + t;
          if (cercaCF(righeOCR(t))) break;
        }
      }
    }
    await worker.setParameters({ tessedit_char_whitelist: '' });
    // Tutto il testo letto insieme: il codice fiscale, l'MRZ e le etichette si completano a vicenda
    const insieme = estraiDatiDocumento(testo, cfBarre);
    Object.keys(insieme).forEach(function (k) { if (insieme[k] && (!dati[k] || k === 'codiceFiscale' || k === 'cognome' || k === 'nome' || k === 'dataNascita' || k === 'sesso')) dati[k] = insieme[k]; });

    // Secondo lato dello stesso documento: si completano i dati del primo
    if (docLettura.unisci && docLettura.dati) {
      const primo = docLettura.dati;
      const mrz = leggiMRZ(righeOCR(testo));
      Object.keys(dati).forEach(function (k) {
        if (k === 'testo' || !dati[k]) return;
        // dal retro valgono di piu' il codice fiscale e le righe MRZ (hanno i controlli)
        if (!primo[k] || k === 'codiceFiscale' || mrz[k]) primo[k] = dati[k];
      });
      primo.testo = (primo.testo ? primo.testo + '\n====\n' : '') + testo;
      dati = primo;
      testo = primo.testo;
    }
    // Controllo finale con tutto il testo letto (anche dei due lati)
    const righeTutte = righeOCR(testo);
    if (!dati.codiceFiscale) dati.codiceFiscale = cfBarre || cercaCF(righeTutte);
    if (!dati.codiceFiscale && !dati.cfGrezzo) dati.cfGrezzo = cercaCFGrezzo(righeTutte);
    rifinisciDati(dati, righeTutte);
    if (dati.codiceFiscale) dati.cfGrezzo = '';
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
  document.getElementById('doc-scad').value = d.scadenzaDocumento || '';
  document.getElementById('doc-cf').value = d.codiceFiscale || d.cfGrezzo || '';
  document.getElementById('doc-testo').textContent = d.testo || '';
  verificaRevisioneDocumento();
}

// Codice fiscale ricostruito: le prime 11 lettere/cifre dai dati (cognome, nome, data, sesso),
// il codice del comune dal codice letto (anche con errori di lettura) e il carattere di controllo ricalcolato
function cfDaiDati(grezzo, cognome, nome, dataNascita, sesso) {
  grezzo = normalizzaCF(grezzo);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dataNascita || '').trim());
  if (!cognome || !nome || !m || grezzo.length < 15) return '';
  const giornoLetto = parseInt(cfSenzaOmocodia(grezzo.slice(0, 15) + 'X').slice(9, 11).replace(/O/g, '0'), 10);
  const f = sesso === 'F' || (!sesso && giornoLetto > 40);
  const giorno = +m[1] + (f ? 40 : 0);
  const numeri = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6', T: '7' };
  const lettere = { 0: 'O', 1: 'I', 2: 'Z', 5: 'S', 8: 'B', 6: 'G', 4: 'A' };
  let comune = grezzo.slice(11, 15).split('').map(function (ch, i) { return i === 0 ? (/[A-Z]/.test(ch) ? ch : (lettere[ch] || ch)) : (/[0-9]/.test(ch) ? ch : (numeri[ch] || ch)); }).join('');
  if (!/^[A-Z][0-9]{3}$/.test(comune)) return '';
  const primi15 = codiceCognomeCF(cognome) + codiceNomeCF(nome) + m[3].slice(2) + CF_MESI[+m[2] - 1] + String(giorno).padStart(2, '0') + comune;
  if (primi15.length !== 15 || /undefined/.test(primi15)) return '';
  const cf = primi15 + carattereControlloCF(primi15);
  return cfValido(cf) ? cf : '';
}
function usaCFCorretto(cf) {
  document.getElementById('doc-cf').value = cf;
  verificaRevisioneDocumento();
}
// Trasferisce comunque i dati nel modulo (anche con il codice fiscale da sistemare) e porta al campo da correggere
function usaDatiECorreggo() {
  docLettura.forza = true;
  usaDatiDocumento();
  docLettura.forza = false;
}

function verificaRevisioneDocumento() {
  const el = document.getElementById('doc-verifica');
  const cf = normalizzaCF(document.getElementById('doc-cf').value);
  const g = function (id) { return document.getElementById(id).value.trim(); };
  // proposta di correzione del codice fiscale (quando manca il controllo o non corrisponde ai dati)
  const proposta = cfDaiDati(cf, g('doc-cognome'), g('doc-nome'), g('doc-nascita'), g('doc-sesso'));
  const tastoProposta = proposta && proposta !== cf
    ? '<div style="margin-top:6px"><button type="button" onclick="usaCFCorretto(\'' + proposta + '\')" style="background:#1a7f37; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">🔧 Correggi in ' + proposta + '</button> <span style="color:var(--sub)">(ricostruito da cognome, nome, data e comune letto: controllalo sul documento)</span></div>' : '';
  const tastoForza = '<div style="margin-top:6px"><button type="button" onclick="usaDatiECorreggo()" style="background:#b35f0c; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">✏️ Usa i dati e correggo io il codice fiscale</button></div>';
  if (!cf) {
    el.style.color = '#b5842a';
    el.textContent = /identit/i.test((docLettura.dati || {}).tipo || '')
      ? 'Sul fronte della carta d\'identita\' il codice fiscale non c\'e\': premi "+ Leggi l\'altro lato" e inquadra il retro.'
      : 'Codice fiscale non trovato: puoi scriverlo a mano o premere "+ Leggi l\'altro lato".';
    el.innerHTML = esc(el.textContent) + '<div style="margin-top:6px"><button type="button" onclick="usaDatiECorreggo()" style="background:#b35f0c; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">✏️ Usa gli altri dati e scrivo io il codice fiscale</button></div>';
    return;
  }
  if (!cfValido(cf)) { el.style.color = '#c0392b'; el.innerHTML = '❌ Codice fiscale letto in modo incerto (' + cf.length + '/16 caratteri): uno o più caratteri sono sbagliati. Correggilo qui sopra oppure:' + tastoProposta + tastoForza; return; }
  const avvisi = controllaCoerenzaCF(cf, document.getElementById('doc-cognome').value, document.getElementById('doc-nome').value, document.getElementById('doc-nascita').value);
  el.style.color = avvisi.length ? '#b5842a' : 'var(--accent)';
  if (avvisi.length) el.innerHTML = '⚠️ ' + esc(avvisi.join('; ')) + ': controlla cognome, nome e data, o il codice.' + tastoProposta;
  else el.textContent = '✓ Codice fiscale valido e coerente con nome, cognome e data';
}

function usaDatiDocumento() {
  const v = function (id) { return document.getElementById(id).value.trim(); };
  const cf = normalizzaCF(v('doc-cf'));
  const forza = !!docLettura.forza;
  if (cf && !cfValido(cf) && !forza) { verificaRevisioneDocumento(); document.getElementById('doc-verifica').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
  if (docLettura.destinazione === 'archivio') {
    const dati = { cognome: v('doc-cognome').toUpperCase(), nome: v('doc-nome').toUpperCase(), dataNascita: v('doc-nascita'), codiceFiscale: cf, documentoScadenza: v('doc-scad') };
    chiudiLetturaDocumento();
    apriSchedaClienteArchivio(dati);
    return;
  }
  if (docLettura.destinazione === 'coniuge') {
    document.getElementById('f-cong-cognome').value = v('doc-cognome').toUpperCase();
    document.getElementById('f-cong-nome').value = v('doc-nome').toUpperCase();
    document.getElementById('f-cong-data').value = v('doc-nascita');
    if (cf) document.getElementById('f-cong-cf').value = cf;
    document.getElementById('cli-cerca-cong').value = (v('doc-cognome') + ' ' + v('doc-nome')).trim().toUpperCase();
    chiudiLetturaDocumento();
    avviso('✓ Dati del coniuge inseriti nel modulo');
    return;
  }
  document.getElementById('f-cognome').value = v('doc-cognome').toUpperCase();
  document.getElementById('f-nome').value = v('doc-nome').toUpperCase();
  document.getElementById('f-cf').value = v('doc-nascita');
  document.getElementById('f-codfisc').value = cf;
  if (v('doc-scad')) { document.getElementById('f-doc-scad').value = v('doc-scad'); coloraScadenzaDocumento(); }
  document.getElementById('cli-cerca').value = (v('doc-cognome') + ' ' + v('doc-nome')).trim().toUpperCase();
  chiudiLetturaDocumento();
  if (cf && cfValido(cf)) onCFLetto(cf);
  else {
    controllaCampoCF(); aggiornaStoricoForm();
    // si porta al codice fiscale da sistemare, evidenziato
    const campo = document.getElementById('f-codfisc');
    if (campo) { campo.scrollIntoView({ block: 'center', behavior: 'smooth' }); campo.focus(); campo.style.outline = '3px solid #b35f0c'; setTimeout(function () { campo.style.outline = ''; }, 6000); }
    avviso(cf ? '✏️ Dati inseriti: correggi il codice fiscale evidenziato' : '✏️ Dati inseriti: scrivi il codice fiscale evidenziato');
  }
}


/* ---------------- Cliente nuovo in archivio dal documento (senza creare una pratica) ---------------- */
function apriSchedaClienteArchivio(d) {
  const vecchio = document.getElementById('popup-cliente-archivio'); if (vecchio) vecchio.remove();
  const esiste = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).find(function (c) {
    return (d.codiceFiscale && c.codiceFiscale === d.codiceFiscale) || (c.nomeCompleto === (d.cognome + ' ' + d.nome).trim() && (c.dataNascita || '') === d.dataNascita);
  });
  const val = function (k) { return esc((esiste && esiste[k]) || ''); };
  const campo = function (id, etichetta, valore, extra) { return '<div><label style="font-size:12px">' + etichetta + '</label><input id="' + id + '" value="' + esc(valore || '') + '" ' + (extra || '') + '></div>'; };
  const ov = document.createElement('div');
  ov.id = 'popup-cliente-archivio';
  ov.style.cssText = 'position:fixed; inset:0; z-index:470; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #2f9e9e; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:20px 22px; max-width:560px; width:100%; max-height:92vh; overflow:auto">'
    + '<div style="font-size:19px; font-weight:800; color:#2f9e9e">📇 ' + (esiste ? 'Cliente già in archivio' : 'Nuovo cliente in archivio') + '</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin:2px 0 12px">' + (esiste ? 'Il cliente c\'è già: puoi completare telefoni, e-mail e scadenza del documento.' : 'Controlla i dati letti dal documento e aggiungi i recapiti. Non viene creata nessuna pratica.') + '</div>'
    + '<div class="grid" style="gap:8px">'
    + campo('ca-cognome', 'Cognome', d.cognome, 'style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"')
    + campo('ca-nome', 'Nome', d.nome, 'style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"')
    + campo('ca-nascita', 'Data di nascita', d.dataNascita, 'placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"')
    + campo('ca-cf', 'Codice fiscale *', d.codiceFiscale, 'maxlength="16" style="text-transform:uppercase; font-family:monospace" oninput="this.value=normalizzaCF(this.value)"')
    + campo('ca-scad', 'Scadenza documento', d.documentoScadenza || (esiste && esiste.documentoScadenza), 'placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"')
    + campo('ca-tel', 'Cellulare', esiste && esiste.telefono, 'type="tel" inputmode="tel"')
    + campo('ca-fisso', 'Telefono fisso', esiste && esiste.telefonoFisso, 'type="tel" inputmode="tel"')
    + campo('ca-email', 'E-mail', esiste && esiste.email, 'type="email" inputmode="email" style="text-transform:lowercase"')
    + '</div><div id="ca-esito" style="font-size:13px; margin-top:8px"></div>'
    + '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px; flex-wrap:wrap">'
    + '<button type="button" data-azione="no" style="background:var(--line); color:var(--ink)">Annulla</button>'
    + '<button type="button" data-azione="pratica" style="background:#1d4f91; color:#fff">✍️ Salva e apri nuova pratica</button>'
    + '<button type="button" data-azione="salva" style="background:#2f9e9e; color:#fff; font-weight:800">💾 Salva in archivio</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', async function (e) {
    const b = e.target.closest('button[data-azione]');
    if (!b && e.target !== ov) return;
    if (!b || b.dataset.azione === 'no') { ov.remove(); return; }
    const g = function (id) { return document.getElementById(id).value.trim(); };
    const c = { cognome: g('ca-cognome').toUpperCase(), nome: g('ca-nome').toUpperCase(), dataNascita: g('ca-nascita'), cf: normalizzaCF(g('ca-cf')),
      scad: g('ca-scad'), tel: g('ca-tel'), fisso: g('ca-fisso'), email: g('ca-email').toLowerCase() };
    const esito = document.getElementById('ca-esito');
    const errore = function (t) { esito.innerHTML = '<b style="color:#c0392b">❌ ' + t + '</b>'; };
    if (!c.cognome) return errore('Manca il cognome');
    if (!c.cf || !cfValido(c.cf)) return errore('Codice fiscale mancante o non valido (16 caratteri)');
    if (c.dataNascita && !parseDataIT(c.dataNascita)) return errore('Data di nascita nel formato GG/MM/AAAA');
    if (c.scad && !parseDataIT(c.scad)) return errore('Scadenza documento nel formato GG/MM/AAAA');
    if (c.email && !emailValida(c.email)) return errore('E-mail non valida');
    b.disabled = true;
    try {
      await registraClienteSeNuovo(c.cognome, c.nome, c.dataNascita, c.cf, c.tel, c.fisso, c.scad, c.email);
      if (typeof data !== 'undefined' && data.caricaTutto) await data.caricaTutto({ silenzioso: true });
      if (typeof caricaArchivioClienti === 'function') caricaArchivioClienti();
    } catch (err) { b.disabled = false; return errore('Non salvato: ' + (err.message || err)); }
    ov.remove();
    const nome = (c.cognome + ' ' + c.nome).trim();
    if (b.dataset.azione === 'pratica') {
      const metti = function (id, v) { const el = document.getElementById(id); if (el) el.value = v || ''; };
      metti('f-cognome', c.cognome); metti('f-nome', c.nome); metti('f-cf', c.dataNascita); metti('f-codfisc', c.cf);
      metti('f-doc-scad', c.scad); metti('f-tel', c.tel); metti('f-tel-fisso', c.fisso); metti('f-email', c.email); metti('cli-cerca', nome);
      if (typeof coloraScadenzaDocumento === 'function') coloraScadenzaDocumento();
      if (typeof controllaCampoCF === 'function') controllaCampoCF();
      if (typeof aggiornaStoricoForm === 'function') aggiornaStoricoForm();
      avviso('✓ ' + nome + ' salvato in archivio: completa la pratica e premi Salva');
    } else {
      avviso('📇 ' + nome + (esiste ? ': dati aggiornati in archivio' : ' aggiunto all\'archivio clienti'));
    }
  });
}
