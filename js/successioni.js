/* ---------------- ⚱️ Successioni: il dante causa (v1.8) ----------------
   Il cliente della pratica è il DICHIARANTE (l'erede che viene al CAF); nel riquadro si scrivono i dati del
   DANTE CAUSA, cioè la persona deceduta: cognome, nome, data e luogo di nascita, codice fiscale e data di morte
   (obbligatoria). Ricerca nell'archivio (anche tra i deceduti) e lettura del documento come per gli inquilini.
   Doppioni: una sola successione per defunto (non per dichiarante: lo stesso erede può farne più di una).
   Dopo il salvataggio, se il defunto è nell'archivio clienti, si propone di segnarlo «✝️ deceduto il …»
   (così non riceve auguri, campagna 730 e altri messaggi). */

function eSuccessione(tipo) { return /SUCCESSION/.test(String(tipo || '').toUpperCase()); }
// k = 'f' nel modulo di inserimento, oppure l'id della pratica nella modifica
function idDc(nome, k) { return 'dc-' + nome + '-' + k; }

function successioneBoxHTML(k, p) {
  p = p || {};
  const up = 'style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"', data = 'placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"';
  const c = function (n, etichetta, val, attr, pieno) { return '<div' + (pieno ? ' class="full"' : '') + '><label>' + etichetta + '</label><input id="' + idDc(n, k) + '" value="' + esc(val || '') + '" ' + (attr || '') + '></div>'; };
  return '<div style="font-weight:800; color:#4b5563; margin-bottom:6px">⚱️ Dante causa (la persona deceduta) <span style="font-weight:600; font-size:12px; color:var(--sub)">· il cliente in alto è il dichiarante (l\'erede che viene al CAF)</span></div>'
    + '<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end; margin-bottom:6px">'
    + '<input id="' + idDc('cerca', k) + '" autocomplete="off" placeholder="Cerca nell\'archivio (cognome o nome)…" style="flex:1 1 220px" oninput="cercaDefunto(\'' + k + '\', this.value)">'
    + '<button type="button" class="btn-scan-cf" onclick="leggiDocDefunto(\'' + k + '\')" title="Leggi i dati del defunto da una foto o dal PDF del documento">📄 Leggi documento (foto o PDF)</button>'
    + '<div id="' + idDc('ris', k) + '" style="flex:1 1 100%; max-height:200px; overflow:auto; border-radius:8px; background:var(--card)"></div></div>'
    + '<div class="grid">'
    + c('cognome', 'Cognome *', p.dcCognome, up) + c('nome', 'Nome *', p.dcNome, up)
    + c('cf', 'Codice fiscale', p.dcCodiceFiscale, 'maxlength="16" style="text-transform:uppercase; font-family:monospace" oninput="this.value=normalizzaCF(this.value); compilaDefuntoDaCF(\'' + k + '\')"')
    + c('nascita', 'Data di nascita', p.dcDataNascita, data) + c('luogo', 'Luogo di nascita', p.dcLuogoNascita, up)
    + '<div><label style="color:#374151">✝️ Data di morte *</label><input id="' + idDc('morte', k) + '" value="' + esc(p.dcDataMorte || '') + '" ' + data + ' style="border:2px solid #4b5563"></div>'
    + '</div>';
}

// ricerca nell'archivio: anche tra i clienti già segnati deceduti
const DC_RIS = {};
function cercaDefunto(k, q) {
  const box = document.getElementById(idDc('ris', k)); if (!box) return;
  const kq = chiaveRicerca(q || '');
  if (kq.length < 2) { box.innerHTML = ''; return; }
  const lista = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).filter(function (c) { return (chiaveRicerca(c.nomeCompleto) + '|' + chiaveRicerca(c.codiceFiscale)).indexOf(kq) >= 0; }).slice(0, 8);
  DC_RIS[k] = lista;
  box.innerHTML = lista.length ? lista.map(function (c, j) {
    return '<div class="cli-row" style="cursor:pointer; padding:6px 8px; border-bottom:1px solid var(--line)" onclick="scegliDefunto(\'' + k + '\', ' + j + ')"><b>' + esc(c.nomeCompleto) + '</b>'
      + (c.decedutoIl ? ' <span style="font-size:11.5px; background:#374151; color:#fff; border-radius:999px; padding:1px 8px">✝️ ' + esc(c.decedutoIl) + '</span>' : '')
      + '<div class="sub2">' + (c.dataNascita ? 'Nato/a il ' + esc(c.dataNascita) : '') + (c.codiceFiscale ? ' · CF ' + esc(c.codiceFiscale) : '') + '</div></div>';
  }).join('') : '<div class="sub2" style="padding:6px 8px">Nessun cliente trovato: scrivi i dati qui sotto.</div>';
}
function mettiDefunto(k, q) {
  const metti = function (n, v) { const el = document.getElementById(idDc(n, k)); if (el && v) el.value = v; };
  metti('cognome', String(q.cognome || '').toUpperCase()); metti('nome', String(q.nome || '').toUpperCase());
  metti('nascita', q.dataNascita); metti('luogo', String(q.comuneNascita || '').toUpperCase()); metti('cf', q.codiceFiscale);
  if (q.decedutoIl) metti('morte', q.decedutoIl);
  metti('cerca', q.nomeCompleto || ((q.cognome || '') + ' ' + (q.nome || '')).trim());
  const box = document.getElementById(idDc('ris', k)); if (box) box.innerHTML = '';
  if (typeof aggiornaColoriModulo === 'function') aggiornaColoriModulo();
}
function scegliDefunto(k, j) {
  const c = (DC_RIS[k] || [])[j]; if (!c) return;
  // in archivio il nome è tutto insieme: si prova a dividerlo con i dati del cliente
  let cognome = c.cognome || '', nome = c.nome || '';
  if (!cognome && !nome) { const parti = String(c.nomeCompleto || '').split(' '); cognome = parti.shift() || ''; nome = parti.join(' '); }
  mettiDefunto(k, { cognome: cognome, nome: nome, dataNascita: c.dataNascita, comuneNascita: c.comuneNascita, codiceFiscale: c.codiceFiscale, decedutoIl: c.decedutoIl, nomeCompleto: c.nomeCompleto });
}
// codice fiscale scritto a mano: data e luogo di nascita dal codice (e dati dall'archivio se c'è)
function compilaDefuntoDaCF(k) {
  const el = document.getElementById(idDc('cf', k)); if (!el) return;
  const cf = normalizzaCF(el.value);
  if (cf.length !== 16 || typeof cfValido !== 'function' || !cfValido(cf)) return;
  const metti = function (n, v) { const x = document.getElementById(idDc(n, k)); if (x && v && !String(x.value || '').trim()) x.value = v; };
  const c = typeof personaDaCF === 'function' ? personaDaCF(cf) : null;
  if (c) { metti('cognome', String(c.cognome || '').toUpperCase()); metti('nome', String(c.nome || '').toUpperCase()); if (c.decedutoIl) metti('morte', c.decedutoIl); }
  const d = typeof datiDaCF === 'function' ? datiDaCF(cf) : null;
  metti('nascita', (c && c.dataNascita) || (d && d.dataNascita));
  metti('luogo', (c && c.comuneNascita) || (typeof comuneDaCF === 'function' ? comuneDaCF(cf) : ''));
}
let DC_DEST = null;
function leggiDocDefunto(k) { DC_DEST = k; apriLetturaDocumentoPer('defunto'); }
function defuntoDaDocumento(d) {
  const k = DC_DEST; DC_DEST = null; if (!k) return;
  const com = (d.codiceFiscale && typeof cfValido === 'function' && cfValido(d.codiceFiscale) && typeof comuneDaCF === 'function' ? comuneDaCF(d.codiceFiscale) : '') || d.luogo;
  mettiDefunto(k, { cognome: d.cognome, nome: d.nome, dataNascita: d.dataNascita, codiceFiscale: d.codiceFiscale, comuneNascita: com });
}

// riquadro nel modulo di inserimento: solo per le successioni
function mostraSuccessioneModulo(tipo) {
  const w = document.getElementById('dc-wrap-f'); if (!w) return;
  if (!eSuccessione(tipo)) { w.style.display = 'none'; w.innerHTML = ''; return; }
  if (!w.innerHTML) w.innerHTML = successioneBoxHTML('f', {});
  w.style.display = '';
}
function pulisciSuccessioneModulo() { const w = document.getElementById('dc-wrap-f'); if (w) { w.innerHTML = ''; w.style.display = 'none'; } mostraSuccessioneModulo((document.getElementById('f-tipo') || {}).value); }
// riquadro nella modifica della pratica
function successioneEditHTML(p) {
  return '<div class="full" id="dc-editwrap-' + p.id + '" style="display:' + (eSuccessione(p.tipo) ? '' : 'none') + '; border:2px solid #4b5563; border-radius:12px; padding:8px 10px; background:rgba(75,85,99,.06)">' + successioneBoxHTML(p.id, p) + '</div>';
}
function mostraSuccessioneEdit(id, tipo) { const w = document.getElementById('dc-editwrap-' + id); if (w) w.style.display = eSuccessione(tipo) ? '' : 'none'; }
// dati del defunto (vuoti se la pratica non è una successione)
function datiSuccessione(k, tipo) {
  const vuoti = { dcCognome: '', dcNome: '', dcDataNascita: '', dcLuogoNascita: '', dcCodiceFiscale: '', dcDataMorte: '' };
  if (!eSuccessione(tipo) || !document.getElementById(idDc('cognome', k))) return eSuccessione(tipo) ? {} : vuoti;
  const v = function (n) { return String((document.getElementById(idDc(n, k)) || {}).value || '').trim(); };
  return { dcCognome: v('cognome').toUpperCase().replace(/\s+/g, ' '), dcNome: v('nome').toUpperCase().replace(/\s+/g, ' '), dcDataNascita: v('nascita'),
    dcLuogoNascita: v('luogo').toUpperCase(), dcCodiceFiscale: typeof normalizzaCF === 'function' ? normalizzaCF(v('cf')) : v('cf').toUpperCase(), dcDataMorte: v('morte') };
}
// controllo prima di salvare. inModifica: le successioni vecchie senza defunto si possono ancora modificare (solo un avviso)
function erroreSuccessione(d, inModifica) {
  const vuoto = !d.dcCognome && !d.dcNome && !d.dcDataMorte && !d.dcCodiceFiscale && !d.dcDataNascita;
  if (inModifica && vuoto) return '';
  if (!d.dcCognome || !d.dcNome) return 'Scrivi cognome e nome del dante causa (la persona deceduta).';
  if (!parseDataIT(d.dcDataMorte)) return 'Scrivi la data di morte del dante causa (GG/MM/AAAA): è obbligatoria.';
  const morte = parseDataIT(d.dcDataMorte), oggi = new Date();
  if (new Date(morte.a, morte.m - 1, morte.g) > oggi) return 'La data di morte è nel futuro: controllala.';
  if (d.dcDataNascita) {
    const nas = parseDataIT(d.dcDataNascita);
    if (!nas) return 'La data di nascita del dante causa non è valida (GG/MM/AAAA).';
    if (new Date(nas.a, nas.m - 1, nas.g) > new Date(morte.a, morte.m - 1, morte.g)) return 'La data di nascita del dante causa è dopo la data di morte: controllale.';
  }
  if (d.dcCodiceFiscale && typeof cfValido === 'function' && !cfValido(d.dcCodiceFiscale)) return 'Il codice fiscale del dante causa non è valido: correggilo o lascialo vuoto.';
  return '';
}
function nomeDefunto(p) { return ((p && p.dcCognome || '') + ' ' + (p && p.dcNome || '')).trim(); }

// doppione: una sola successione per defunto (stesso codice fiscale, o stesso nome e data di nascita), in qualsiasi anno
async function cercaDoppioneSuccessione(d, escludiId) {
  const nome = ((d.dcCognome || '') + ' ' + (d.dcNome || '')).trim().toUpperCase();
  if (!nome && !d.dcCodiceFiscale) return null;
  let elenco = (state.pratiche || []).filter(function (p) { return eSuccessione(p.tipo); });
  try {
    const r = await fetchSupabase('/rest/v1/pratiche?select=id,numero,anno,serie,tipo,nome,annullata,dc_cognome,dc_nome,dc_data_nascita,dc_codice_fiscale&tipo=ilike.*SUCCESSION*');
    if (r && r.ok && Array.isArray(r.data)) elenco = r.data.map(function (x) { return { id: x.id, numero: x.numero, anno: x.anno, serie: x.serie, tipo: x.tipo, nome: x.nome, annullata: x.annullata, dcCognome: x.dc_cognome, dcNome: x.dc_nome, dcDataNascita: x.dc_data_nascita, dcCodiceFiscale: x.dc_codice_fiscale }; });
  } catch (e) { console.error('doppioni successioni', e); }
  const t = elenco.find(function (p) {
    if (p.id === escludiId || p.annullata) return false;
    if (d.dcCodiceFiscale && p.dcCodiceFiscale) return p.dcCodiceFiscale === d.dcCodiceFiscale;
    if (nomeDefunto(p).toUpperCase() !== nome) return false;
    return !(d.dcDataNascita && p.dcDataNascita && d.dcDataNascita !== p.dcDataNascita);
  });
  return t ? (typeof serieDi === 'function' ? serieDi(t) : 'AP') + '-' + String(t.numero).padStart(4, '0') + '/' + t.anno + ' (dichiarante ' + (t.nome || '') + ')' : null;
}

// il defunto è nell'archivio clienti e non è segnato deceduto: si chiede se segnarlo (niente più messaggi)
async function proponiDecessoArchivio(d) {
  if (!d || !d.dcDataMorte) return;
  const nome = ((d.dcCognome || '') + ' ' + (d.dcNome || '')).trim().toUpperCase();
  const arch = typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : [];
  const c = arch.find(function (x) { return d.dcCodiceFiscale && x.codiceFiscale === d.dcCodiceFiscale; })
    || arch.find(function (x) { return x.nomeCompleto === nome && (!d.dcDataNascita || !x.dataNascita || x.dataNascita === d.dcDataNascita); });
  if (!c || !c.id || c.decedutoIl) return;
  if (!confirm('⚱️ ' + c.nomeCompleto + ' è nell\'archivio clienti.\n\nLo segno «✝️ deceduto il ' + d.dcDataMorte + '»?\nCosì non riceverà più auguri, campagna 730 e altri messaggi.')) return;
  const r = await data.clienti.aggiorna(c.id, { decedutoIl: d.dcDataMorte });
  if (r && r.error) { avviso('❌ Archivio non aggiornato: ' + r.error, true); return; }
  c.decedutoIl = d.dcDataMorte;
  avviso('✓ ' + c.nomeCompleto + ' segnato deceduto/a nell\'archivio');
}

// riga sulla scheda della pratica nel registro
function successioneCardHTML(p) {
  if (!p || !eSuccessione(p.tipo)) return '';
  const n = nomeDefunto(p);
  if (!n) return '<div class="meta" style="margin-top:4px; color:#b35f0c; font-weight:700">⚱️ Dante causa non indicato: aggiungilo con ✏️ Modifica</div>';
  return '<div class="meta" style="margin-top:4px"><b style="color:#374151">⚱️ Dante causa: ' + esc(n) + '</b>'
    + (p.dcDataNascita ? ' · nato/a il ' + esc(p.dcDataNascita) : '') + (p.dcLuogoNascita ? ' a ' + esc(p.dcLuogoNascita) : '')
    + (p.dcDataMorte ? ' · <b>✝️ deceduto/a il ' + esc(p.dcDataMorte) + '</b>' : '')
    + (p.dcCodiceFiscale ? '<br><span style="font-family:monospace">CF ' + esc(p.dcCodiceFiscale) + '</span>' : '') + '</div>';
}
