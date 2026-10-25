/* ---------------- Codice fiscale calcolato da cognome, nome, data, sesso e comune di nascita ----------------
   Si compila da solo nell'inserimento della pratica quando il campo è vuoto (o era già stato calcolato).
   Va sempre controllato sulla tessera sanitaria: nei rari casi di omocodia il codice vero è diverso. */

function normComune(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/g, ''); }
let COMUNI_PER_NOME = null;
function elencoComuniPerNome() {
  if (COMUNI_PER_NOME || typeof COMUNI_CF_DATI === 'undefined') return COMUNI_PER_NOME || {};
  COMUNI_PER_NOME = {};
  COMUNI_CF_DATI.split('|').forEach(function (r) {
    const cod = r.slice(0, 4); let v = r.slice(4); const soppresso = /~$/.test(v); v = v.replace(/~$/, '');
    const i = v.lastIndexOf('/'); const nome = i > 0 ? v.slice(0, i) : v, pr = i > 0 ? v.slice(i + 1) : 'EE';
    const k = normComune(nome);
    (COMUNI_PER_NOME[k] = COMUNI_PER_NOME[k] || []).push({ cod: cod, pr: pr, nome: nome, soppresso: soppresso });
  });
  return COMUNI_PER_NOME;
}
// "MESSINA (ME)", "Messina", "ALI' TERME", "FRANCIA (stato estero)" → codice catastale; '' se non trovato o ambiguo
function codiceDaComune(testo) {
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(String(testo || '').trim());
  const nome = m ? m[1] : testo, pr = m ? m[2].toUpperCase().trim() : '';
  let l = elencoComuniPerNome()[normComune(nome)] || [];
  if (!l.length) return '';
  if (pr && pr !== 'STATO ESTERO') { const f = l.filter(function (x) { return x.pr === pr; }); if (f.length) l = f; }
  if (l.length > 1) { const attivi = l.filter(function (x) { return !x.soppresso; }); if (attivi.length) l = attivi; }
  return l.length === 1 ? l[0].cod : '';
}
// suggerimenti per la casella del comune (NOME (PR))
function suggerisciComuni(input) {
  const lista = document.getElementById('lista-comuni'); if (!lista) return;
  const q = normComune(input.value);
  if (q.length < 2) { lista.innerHTML = ''; return; }
  const el = elencoComuniPerNome(), out = [];
  Object.keys(el).some(function (k) {
    if (k.indexOf(q) !== 0) return false;
    el[k].forEach(function (x) { if (!x.soppresso) out.push(x.nome + ' (' + (x.pr === 'EE' ? 'stato estero' : x.pr) + ')'); });
    return out.length >= 15;
  });
  lista.innerHTML = out.slice(0, 15).map(function (t) { return '<option value="' + esc(t) + '">'; }).join('');
}

const NOMI_MASCHILI_IN_A = ['ANDREA', 'LUCA', 'NICOLA', 'MATTIA', 'ELIA', 'ENEA', 'TOBIA', 'ZACCARIA', 'BATTISTA', 'ISAIA', 'GEREMIA', 'GIONATA', 'SABA', 'COSTA', 'FRANCESCOPAOLA'];
const NOMI_FEMMINILI_NON_IN_A = ['IRENE', 'ADELE', 'BEATRICE', 'ALICE', 'AGNESE', 'MATILDE', 'CLOE', 'CHLOE', 'NOEMI', 'NOEMY', 'RACHELE', 'ESTER', 'ESTHER', 'MIRIAM', 'CARMEN', 'DOLORES', 'NICOLE', 'MICHELLE', 'ISABEL', 'RUTH', 'SOLE', 'GELTRUDE', 'GERTRUDE', 'IMMACOLATA', 'CONCETTA', 'ASSUNTA', 'MARY', 'JENNIFER', 'KATIUSCIA', 'DESIREE', 'INES', 'LUDOVICA', 'ELISABETH', 'CATERINE', 'ELEONOR', 'BERENICE', 'FENICE', 'CLARISSE', 'IRIS', 'ARIEL', 'LEONOR'];
function sessoDaNome(nome) {
  const n = String(nome || '').trim().toUpperCase().split(/\s+/)[0].replace(/[^A-Z]/g, '');
  if (!n) return '';
  if (NOMI_FEMMINILI_NON_IN_A.indexOf(n) >= 0) return 'F';
  if (NOMI_MASCHILI_IN_A.indexOf(n) >= 0) return 'M';
  return /A$/.test(n) ? 'F' : 'M';
}
function calcolaCF(cognome, nome, dataIT, sesso, codComune) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dataIT || '').trim());
  if (!String(cognome || '').trim() || !String(nome || '').trim() || !m || (sesso !== 'M' && sesso !== 'F') || !/^[A-Z]\d{3}$/.test(codComune || '')) return '';
  const giorno = +m[1] + (sesso === 'F' ? 40 : 0);
  const p = codiceCognomeCF(cognome) + codiceNomeCF(nome) + m[3].slice(2) + CF_MESI[+m[2] - 1] + String(giorno).padStart(2, '0') + codComune;
  return p.length === 15 && !/undefined/.test(p) ? p + carattereControlloCF(p) : '';
}

// Inserimento pratica: sesso proposto dal nome (se non scelto a mano) e codice fiscale calcolato.
// Stessa cosa per il titolare e per il coniuge della dichiarazione congiunta.
const CAMPI_CF_TITOLARE = { cognome: 'f-cognome', nome: 'f-nome', data: 'f-cf', sesso: 'f-sesso', comune: 'f-comune', cf: 'f-codfisc' };
const CAMPI_CF_CONIUGE = { cognome: 'f-cong-cognome', nome: 'f-cong-nome', data: 'f-cong-data', sesso: 'f-cong-sesso', comune: 'f-cong-comune', cf: 'f-cong-cf' };
function aggiornaSessoCampi(ids) {
  const s = document.getElementById(ids.sesso); if (!s || s.dataset.manuale === '1') return;
  const cfEl = document.getElementById(ids.cf);
  const cf = normalizzaCF((cfEl || {}).value || '');
  const v = cf.length === 16 && cfValido(cf) && cfEl.dataset.auto !== '1' ? datiDaCF(cf).sesso : sessoDaNome((document.getElementById(ids.nome) || {}).value);
  s.value = v || '';
}
function proponiCFCampi(ids) {
  const el = document.getElementById(ids.cf); if (!el) return;
  if (el.value.trim() && el.dataset.auto !== '1') return; // scritto a mano o letto dal documento: non si tocca
  aggiornaSessoCampi(ids);
  const g = function (id) { return ((document.getElementById(id) || {}).value || '').trim(); };
  const cf = calcolaCF(g(ids.cognome).toUpperCase(), g(ids.nome).toUpperCase(), g(ids.data), g(ids.sesso), codiceDaComune(g(ids.comune)));
  if (cf) { el.value = cf; el.dataset.auto = '1'; }
  else if (el.dataset.auto === '1') { el.value = ''; el.dataset.auto = ''; }
}
function aggiornaSessoModulo() { aggiornaSessoCampi(CAMPI_CF_TITOLARE); }
function proponiCFCalcolato() { proponiCFCampi(CAMPI_CF_TITOLARE); }
// Coniuge: calcolo, comune dal codice e messaggio di controllo sotto il codice fiscale
function controllaCFConiuge() {
  proponiCFCampi(CAMPI_CF_CONIUGE);
  if (typeof comuneNelCampo === 'function') comuneNelCampo('f-cong-cf', 'f-cong-comune');
  const el = document.getElementById('f-cong-cf-msg'); if (!el) return;
  const cfEl = document.getElementById('f-cong-cf');
  const cf = normalizzaCF(cfEl.value);
  if (!cf) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  if (cf.length < 16) { el.style.color = 'var(--sub)'; el.textContent = cf.length + '/16 caratteri'; return; }
  if (!cfValido(cf)) { el.style.color = '#c0392b'; el.textContent = '❌ Codice fiscale non valido (controlla i caratteri)'; return; }
  if (cfEl.dataset.auto !== '1') aggiornaSessoCampi(CAMPI_CF_CONIUGE);
  const g = function (id) { return ((document.getElementById(id) || {}).value || '').trim(); };
  const avvisi = controllaCoerenzaCF(cf, g('f-cong-cognome'), g('f-cong-nome'), g('f-cong-data'));
  if (avvisi.length) { el.style.color = '#b5842a'; el.textContent = '⚠️ Attenzione: ' + avvisi.join('; ') + '.'; return; }
  const d = datiDaCF(cf);
  el.style.color = 'var(--accent)';
  el.textContent = '✓ Codice valido · ' + (d.sesso === 'F' ? 'nata il ' : 'nato il ') + d.dataNascita + (typeof comuneDaCF === 'function' && comuneDaCF(cf) ? ' a ' + comuneDaCF(cf) : '')
    + (cfEl.dataset.auto === '1' ? ' · 🧮 calcolato in automatico: controllalo sulla tessera sanitaria' : '');
}
// Scadenza del documento del coniuge: verde se valido, rosso se scaduto (con il tasto per leggere il nuovo)
function coloraScadenzaConiuge() {
  const el = document.getElementById('f-cong-doc-scad'); if (!el) return;
  const msg = document.getElementById('f-cong-doc-scad-msg'), lg = document.getElementById('f-cong-doc-scad-leggi');
  const st = typeof statoScadenzaDocumento === 'function' ? statoScadenzaDocumento(el.value) : null;
  el.style.background = st ? (st.valido ? '#1a7f37' : '#c0392b') : '';
  el.style.color = st ? '#fff' : '';
  el.style.borderColor = st ? (st.valido ? '#1a7f37' : '#c0392b') : '';
  if (lg) lg.style.display = st && (!st.valido || st.giorni <= 30) ? '' : 'none';
  ['f-cong-doc-scad-wa', 'f-cong-doc-scad-mail'].forEach(function (id) { const b = document.getElementById(id); if (b) b.style.display = st && !st.valido ? '' : 'none'; });
  if (msg) {
    msg.style.color = st ? (st.valido ? '#1a7f37' : '#c0392b') : 'var(--sub)';
    msg.textContent = !st ? '' : st.valido
      ? '✓ Documento valido' + (st.giorni <= 60 ? ' (scade tra ' + st.giorni + (st.giorni === 1 ? ' giorno' : ' giorni') + ')' : '')
      : '✗ Documento del coniuge SCADUTO da ' + (-st.giorni) + (st.giorni === -1 ? ' giorno' : ' giorni') + ': leggi il nuovo con 📷 o chiedilo';
  }
}

// Numero del documento d'identità letto con l'OCR: dalle righe MRZ della carta d'identità elettronica, altrimenti dal testo
// Numero del documento dal testo letto. La lettura confonde spesso lettere e cifre (O/0, I/1, S/5, B/8, Z/2, G/6)
// e mette spazi in mezzo: si provano i formati italiani correggendo le lettere al posto delle cifre e viceversa.
//   carta d'identità elettronica CA12345AB · cartacea AX1234567 · passaporto YA1234567 · patente U1A23B456C o MI1234567X
function numeroDocumentoDaTesto(testo) {
  const T = String(testo || '').toUpperCase();
  const cifra = function (c) { return ({ O: '0', Q: '0', D: '0', I: '1', L: '1', T: '1', Z: '2', S: '5', B: '8', G: '6' })[c] || c; };
  const lettera = function (c) { return ({ '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G' })[c] || c; };
  const sistema = function (str, schema) { // schema: L = lettera, D = cifra, X = lettera o cifra
    let out = '';
    for (let k = 0; k < schema.length; k++) {
      const c = schema[k] === 'D' ? cifra(str[k]) : schema[k] === 'L' ? lettera(str[k]) : str[k];
      if (schema[k] === 'D' && !/\d/.test(c)) return null;
      if (schema[k] === 'L' && !/[A-Z]/.test(c)) return null;
      out += c;
    }
    return out;
  };
  // 1) righe MRZ del retro (le più sicure): CIITACA12345AB…  oppure IDITA…
  const righe = T.split(/\n/).map(function (r) { return r.replace(/\s/g, '').replace(/[«‹(\[{]/g, '<'); });
  for (const r of righe) {
    const m = /(?:^|[^A-Z])(?:C[A-Z<]|I[A-Z<]|ID)[I1]TA([A-Z0-9]{9})/.exec(r);
    if (m) { const n = sistema(m[1], 'LLDDDDDLL') || sistema(m[1], 'LLDDDDDDD'); if (n) return n; }
  }
  // 2) vicino alle scritte «N.», «NUMERO», «DOCUMENTO N.», «CARTA N.»
  const vicino = /(?:N[°º.]\s*|NUMERO|NUM\.|DOC(?:UMENTO)?\s*N[°º.]?|CARTA\s*N[°º.]?|PATENTE\s*N[°º.]?)\s*[:.]?\s*([A-Z0-9][A-Z0-9 ]{6,20})/g;
  const prova = function (grezzo) {
    const c = String(grezzo || '').replace(/[^A-Z0-9]/g, '');
    for (let len = Math.min(c.length, 10); len >= 9; len--) {
      const x = c.slice(0, len);
      const n = len === 9 ? (sistema(x, 'LLDDDDDLL') || sistema(x, 'LLDDDDDDD')) : (sistema(x, 'LDXXXXXXXL') || sistema(x, 'LLDDDDDDDL'));
      if (n && (len === 9 || /^U1/.test(n) || /^[A-Z]{2}\d{7}[A-Z]$/.test(n))) return n;
    }
    return '';
  };
  let m;
  while ((m = vicino.exec(T))) { const n = prova(m[1]); if (n) return n; }
  // 3) ovunque nel testo, formati esatti (con eventuali spazi)
  m = /\b([A-Z]{2})\s?(\d{5})\s?([A-Z]{2})\b/.exec(T); if (m) return m[1] + m[2] + m[3];            // CIE
  m = /\b(U1[A-Z0-9]{7}[A-Z])\b/.exec(T); if (m) return m[1];                                        // patente nuova
  m = /\b([A-Z]{2}\d{7}[A-Z])\b/.exec(T); if (m) return m[1];                                        // patente vecchia
  m = /\b([A-Z]{2})\s?(\d{7})\b/.exec(T); if (m) return m[1] + m[2];                                 // cartacea / passaporto
  // 4) ovunque, con le lettere e le cifre confuse (blocchi di 9 caratteri che sembrano un numero CIE)
  const blocchi = T.replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/);
  for (let k = 0; k < blocchi.length; k++) {
    const uniti = [blocchi[k], blocchi[k] + (blocchi[k + 1] || ''), blocchi[k] + (blocchi[k + 1] || '') + (blocchi[k + 2] || '')];
    for (const u of uniti) {
      if (u.length !== 9 || !/\d.*\d.*\d/.test(u)) continue;
      const n = sistema(u, 'LLDDDDDLL');
      if (n && /^[A-Z]{2}/.test(u)) return n;
    }
  }
  return '';
}

// ---- Calcolo automatico anche nelle schede dell'archivio clienti e nella finestra della lettura del documento ----
// Caselle sesso e comune per le schede che non le hanno (prefisso es. 'mc-', 'nc-', 'ca-')
function htmlSessoComune(prefisso, sesso, comune) {
  return '<div><label>Sesso</label><select id="' + prefisso + 'sesso" title="Serve per calcolare il codice fiscale (proposto dal nome)"><option value=""></option><option value="M"' + (sesso === 'M' ? ' selected' : '') + '>M</option><option value="F"' + (sesso === 'F' ? ' selected' : '') + '>F</option></select></div>'
    + (comune === null ? '' : '<div><label>Comune di nascita</label><input id="' + prefisso + 'comune" list="lista-comuni" autocomplete="off" placeholder="Es. MESSINA (ME)" value="' + esc(comune || '') + '" style="text-transform:uppercase"></div>');
}
// Codice fiscale scritto a mano (16 caratteri, valido): si compilano data di nascita, sesso e comune se sono vuoti
function datiAnagraficiDaCF(ids) {
  const el = function (k) { return ids[k] ? document.getElementById(ids[k]) : null; };
  const cfEl = el('cf'); if (!cfEl) return;
  const cf = normalizzaCF(cfEl.value);
  if (cf.length !== 16 || !cfValido(cf) || cfEl.dataset.auto === '1') return;
  const d = datiDaCF(cf);
  const da = el('data'); if (da && !da.value.trim()) da.value = d.dataNascita;
  const se = el('sesso'); if (se && !se.value) { se.value = d.sesso; se.dataset.manuale = '1'; }
  const co = el('comune'); if (co && (!co.value.trim() || co.dataset.auto === '1') && typeof comuneDaCF === 'function') { const c = comuneDaCF(cf); if (c) { co.value = c; co.dataset.auto = '1'; } }
}
// Collega le caselle: cambiando cognome, nome, data, sesso o comune il codice fiscale (se vuoto o già calcolato) si ricalcola
function collegaCFAuto(ids, dopo) {
  const el = function (k) { return document.getElementById(ids[k]); };
  const ricalcola = function () { proponiCFCampi(ids); if (typeof dopo === 'function') dopo(); };
  ['cognome', 'nome', 'data'].forEach(function (k) { const e = el(k); if (e) e.addEventListener('input', ricalcola); });
  const se = el('sesso'); if (se) se.addEventListener('change', function () { se.dataset.manuale = '1'; ricalcola(); });
  const co = el('comune'); if (co) { co.addEventListener('input', function () { co.value = co.value.toUpperCase(); co.dataset.auto = ''; suggerisciComuni(co); ricalcola(); }); co.addEventListener('change', ricalcola); }
  const cf = el('cf'); if (cf) cf.addEventListener('input', function () { cf.dataset.auto = ''; });
  if (se && se.value) se.dataset.manuale = '1';
  ricalcola();
}
// Finestra di controllo della lettura: se il codice fiscale non è stato letto, si calcola da nome, data, sesso e luogo di nascita
const CAMPI_CF_LETTURA = { cognome: 'doc-cognome', nome: 'doc-nome', data: 'doc-nascita', sesso: 'doc-sesso', comune: 'doc-luogo', cf: 'doc-cf' };
document.addEventListener('DOMContentLoaded', function () {
  if (!document.getElementById('doc-cf')) return;
  const ricalcola = function () { const cf = document.getElementById('doc-cf'); if (cf.value.trim() && cf.dataset.auto !== '1') return; proponiCFCampi(CAMPI_CF_LETTURA); if (typeof verificaRevisioneDocumento === 'function') verificaRevisioneDocumento(); };
  ['doc-cognome', 'doc-nome', 'doc-nascita', 'doc-luogo'].forEach(function (id) { const e = document.getElementById(id); if (e) e.addEventListener('input', ricalcola); });
  const se = document.getElementById('doc-sesso'); if (se) se.addEventListener('change', function () { se.dataset.manuale = '1'; ricalcola(); });
  const lu = document.getElementById('doc-luogo'); if (lu) { lu.setAttribute('list', 'lista-comuni'); lu.addEventListener('input', function () { suggerisciComuni(lu); }); }
  document.getElementById('doc-cf').addEventListener('input', function () { this.dataset.auto = ''; });
});

// ---- Tipo del documento d'identità ----
const TIPI_DOCUMENTO = ["Carta d'identità", 'Passaporto', 'Patente', 'Altro'];
// Carta d'identità elettronica (CIE, numero tipo CA12345AB) o cartacea (numero tipo AX1234567), dal numero del documento.
// La carta cartacea non ha la zona a lettura ottica: per il regolamento UE 2019/1157 non è più valida dal 3 agosto 2026.
function genereCartaIdentita(c) {
  const n = String((c && c.documentoNumero) || '').toUpperCase().replace(/\s+/g, '');
  const tipo = String((c && c.documentoTipo) || '');
  if (/^[A-Z]{2}\d{5}[A-Z]{2}$/.test(n)) return 'elettronica';
  if (/^[A-Z]{2}\d{7}$/.test(n) && (!tipo || /identit/i.test(tipo))) return 'cartacea';
  return '';
}
function categoriaDocumento(c) {
  const g = genereCartaIdentita(c);
  if (g) return g;
  const tipo = String((c && c.documentoTipo) || '');
  if (/patente/i.test(tipo)) return 'patente';
  if (/passap/i.test(tipo)) return 'passaporto';
  if (c && (c.documentoNumero || c.documentoScadenza || tipo)) return 'altro';
  return 'nessuno';
}
const CATEGORIE_DOCUMENTO = { elettronica: '💳 Carta d\'identità elettronica', cartacea: '📄 Carta d\'identità cartacea', patente: '🚗 Patente', passaporto: '🛂 Passaporto', altro: '❔ Altro / da controllare', nessuno: '— Senza documento' };
function opzioniTipoDoc(sel) {
  sel = String(sel || '');
  const extra = sel && TIPI_DOCUMENTO.indexOf(sel) < 0 ? [sel] : [];
  return '<option value="">Tipo…</option>' + TIPI_DOCUMENTO.concat(extra).map(function (t) { return '<option value="' + esc(t) + '"' + (t === sel ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
}
// tipo riconosciuto dalla lettura ("Carta d'identita'", "Patente", "Passaporto"); la tessera sanitaria non è un documento d'identità
function tipoDocDaLettura(t) {
  t = String(t || '');
  if (/passap/i.test(t)) return 'Passaporto';
  if (/patente/i.test(t)) return 'Patente';
  if (/identit/i.test(t)) return "Carta d'identità";
  return '';
}
document.addEventListener('DOMContentLoaded', function () {
  ['f-doc-tipo', 'f-cong-doc-tipo', 'f-lav-doc-tipo'].forEach(function (id) { const el = document.getElementById(id); if (el && !el.options.length) el.innerHTML = opzioniTipoDoc(''); });
});
