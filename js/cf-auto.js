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
  if (msg) {
    msg.style.color = st ? (st.valido ? '#1a7f37' : '#c0392b') : 'var(--sub)';
    msg.textContent = !st ? '' : st.valido
      ? '✓ Documento valido' + (st.giorni <= 60 ? ' (scade tra ' + st.giorni + (st.giorni === 1 ? ' giorno' : ' giorni') + ')' : '')
      : '✗ Documento del coniuge SCADUTO da ' + (-st.giorni) + (st.giorni === -1 ? ' giorno' : ' giorni') + ': leggi il nuovo con 📷 o chiedilo';
  }
}

// Numero del documento d'identità letto con l'OCR: dalle righe MRZ della carta d'identità elettronica, altrimenti dal testo
function numeroDocumentoDaTesto(testo) {
  const righe = String(testo || '').toUpperCase().split(/\n/).map(function (r) { return r.replace(/\s/g, '').replace(/[«‹(\[{]/g, '<'); });
  for (const r of righe) {
    const m = /(?:^|[^A-Z])(?:C[A-Z<]|I[A-Z<]|ID)ITA([A-Z0-9]{2}\d{5}[A-Z0-9]{2})/.exec(r);
    if (m && /^[A-Z]{2}\d{5}[A-Z]{2}$/.test(m[1])) return m[1];
  }
  const t = String(testo || '').toUpperCase();
  let m = /\b([A-Z]{2})\s?(\d{5})\s?([A-Z]{2})\b/.exec(t);           // carta d'identità elettronica: CA12345AB
  if (m) return m[1] + m[2] + m[3];
  m = /\b(A[A-Z])\s?(\d{7})\b/.exec(t);                               // carta d'identità cartacea: AX 1234567
  if (m) return m[1] + m[2];
  m = /\b([A-Z]{2}\d{7})\b/.exec(t);                                  // passaporto: YA1234567
  if (m) return m[1];
  m = /\b(U1[A-Z0-9]{7}[A-Z])\b/.exec(t);                             // patente: U1ABC1234D
  if (m) return m[1];
  return '';
}
