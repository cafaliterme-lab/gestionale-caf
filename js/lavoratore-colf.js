/* ---------------- 👷 Lavoratore dei contratti colf e badanti ----------------
   Nei contratti colf e badanti il cliente della pratica è il datore di lavoro; al posto della congiunta
   (che esiste solo per i 730) si scrive il lavoratore: anagrafica, documento e permesso di soggiorno.
   Il lavoratore va anche in archivio, segnato «👷 lavoratore colf», con il permesso di soggiorno
   (che entra nell'elenco dei documenti scaduti o in scadenza). I messaggi della pratica vanno solo al datore. */

const CAMPI_LAV_MODULO = ['f-lav-cognome', 'f-lav-nome', 'f-lav-data', 'f-lav-comune', 'f-lav-cf', 'f-lav-tel', 'f-lav-doc-scad', 'f-lav-doc-num', 'f-lav-perm-scad', 'f-lav-perm-num', 'cli-cerca-lav'];

// campi del lavoratore: nel modulo di inserimento (id vuoto) o nella finestra di modifica della pratica (id della pratica)
const ID_LAV_MODULO = { cognome: 'f-lav-cognome', nome: 'f-lav-nome', data: 'f-lav-data', comune: 'f-lav-comune', cf: 'f-lav-cf', tel: 'f-lav-tel', docscad: 'f-lav-doc-scad', docnum: 'f-lav-doc-num', doctipo: 'f-lav-doc-tipo', permscad: 'f-lav-perm-scad', permnum: 'f-lav-perm-num', cerca: 'cli-cerca-lav' };
function campoLav(k, id) { return document.getElementById(id ? 'e-lav' + k + '-' + id : ID_LAV_MODULO[k]); }
let LAV_DEST = null; // pratica aperta in modifica a cui va il documento letto (null = modulo di inserimento)
function apriLetturaLavoratore(id) { LAV_DEST = id || null; apriLetturaDocumentoPer('lavoratore'); }
function pulisciLavoratoreModulo() {
  CAMPI_LAV_MODULO.forEach(function (id) { const el = document.getElementById(id); if (el) el.value = ''; });
  const t = document.getElementById('f-lav-doc-tipo'); if (t && typeof opzioniTipoDoc === 'function') t.innerHTML = opzioniTipoDoc('');
}
// riquadro visibile solo per i contratti colf e badanti; per gli altri tipi si svuota
function mostraLavoratoreModulo(tipo) {
  const w = document.getElementById('f-lav-wrap'); if (!w) return;
  const si = eColf(tipo);
  w.style.display = si ? '' : 'none';
  if (!si) pulisciLavoratoreModulo();
}
// lavoratore scelto dall'archivio
function usaLavoratore(c, id) {
  const metti = function (k, v) { const el = campoLav(k, id); if (el) el.value = v || ''; };
  metti('cognome', String(c.cognome || '').toUpperCase()); metti('nome', String(c.nome || '').toUpperCase());
  metti('data', c.dataNascita); metti('comune', c.comuneNascita); metti('cf', c.codiceFiscale); metti('tel', c.telefono);
  metti('docscad', c.documentoScadenza); metti('docnum', c.documentoNumero); metti('permscad', c.permessoScadenza); metti('permnum', c.permessoNumero);
  metti('cerca', c.nomeCompleto);
  const t = campoLav('doctipo', id); if (t && typeof opzioniTipoDoc === 'function') t.innerHTML = opzioniTipoDoc(c.documentoTipo || '');
  const box = document.getElementById(id ? 'e-lavris-' + id : 'cli-results-lav'); if (box) { box.classList.remove('open'); if (id) box.innerHTML = ''; }
}
// lavoratore letto dal documento (📄 Leggi documento lavoratore), nel modulo o nella pratica aperta in modifica
function lavoratoreDaDocumento(d) {
  const id = LAV_DEST && document.getElementById('e-lavcognome-' + LAV_DEST) ? LAV_DEST : null;
  LAV_DEST = null;
  const metti = function (k, v) { const el = campoLav(k, id); if (el && v) el.value = v; };
  metti('cognome', d.cognome); metti('nome', d.nome); metti('data', d.dataNascita);
  metti('cf', d.codiceFiscale); metti('docscad', d.scadenza); metti('docnum', d.numero);
  const com = (d.codiceFiscale && typeof cfValido === 'function' && cfValido(d.codiceFiscale) && typeof comuneDaCF === 'function' ? comuneDaCF(d.codiceFiscale) : '') || d.luogo;
  const elC = campoLav('comune', id); if (elC && com && !elC.value.trim()) elC.value = com;
  if (d.tipoDoc) { const t = campoLav('doctipo', id); if (t && typeof opzioniTipoDoc === 'function') t.innerHTML = opzioniTipoDoc(d.tipoDoc); }
  metti('cerca', ((d.cognome || '') + ' ' + (d.nome || '')).trim());
}
// ricerca del lavoratore nell'archivio dalla finestra di modifica della pratica
function cercaLavoratoreEdit(id, q) {
  const box = document.getElementById('e-lavris-' + id); if (!box) return;
  const kq = chiaveRicerca(q || '');
  if (kq.length < 2) { box.innerHTML = ''; return; }
  const lista = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).filter(function (c) { return !c.decedutoIl && (chiaveRicerca(c.nomeCompleto) + '|' + chiaveRicerca(c.codiceFiscale)).indexOf(kq) >= 0; }).slice(0, 8);
  LAV_RISULTATI[id] = lista;
  box.innerHTML = lista.length ? lista.map(function (c, i) { return '<div class="cli-row" style="cursor:pointer; padding:6px 8px; border-bottom:1px solid var(--line)" onclick="usaLavoratore(LAV_RISULTATI[\'' + id + '\'][' + i + '], \'' + id + '\')"><b>' + esc(c.nomeCompleto) + '</b>' + (typeof badgeRuolo === 'function' ? badgeRuolo(c) : '') + '<div class="sub2">' + (c.dataNascita ? 'Nato/a il ' + esc(c.dataNascita) : '') + (c.telefono ? ' · 📞 ' + esc(c.telefono) : '') + '</div></div>'; }).join('')
    : '<div class="sub2" style="padding:6px 8px">Nessun cliente trovato: scrivi i dati qui sotto.</div>';
}
const LAV_RISULTATI = {};
// dati del lavoratore dal modulo (vuoti se la pratica non è colf)
function datiLavoratoreModulo(tipo) {
  const v = function (id) { return ((document.getElementById(id) || {}).value || '').trim(); };
  const vuoto = { lavCognome: '', lavNome: '', lavCodiceFiscale: '', lavData: '', lavComuneNascita: '', lavTelefono: '', lavDocumentoTipo: '', lavDocumentoNumero: '', lavDocumentoScadenza: '', lavPermessoNumero: '', lavPermessoScadenza: '' };
  if (!eColf(tipo)) return vuoto;
  const cognome = v('f-lav-cognome').toUpperCase().replace(/\s+/g, ' '), nome = v('f-lav-nome').toUpperCase().replace(/\s+/g, ' ');
  if (!cognome && !nome) return vuoto;
  return {
    lavCognome: cognome, lavNome: nome,
    lavCodiceFiscale: typeof normalizzaCF === 'function' ? normalizzaCF(v('f-lav-cf')) : v('f-lav-cf').toUpperCase(),
    lavData: v('f-lav-data'), lavComuneNascita: v('f-lav-comune').toUpperCase(), lavTelefono: v('f-lav-tel'),
    lavDocumentoTipo: v('f-lav-doc-tipo'), lavDocumentoNumero: v('f-lav-doc-num').toUpperCase(), lavDocumentoScadenza: v('f-lav-doc-scad'),
    lavPermessoNumero: v('f-lav-perm-num').toUpperCase(), lavPermessoScadenza: v('f-lav-perm-scad')
  };
}
// il lavoratore va in archivio (se non c'è), con il documento, il segno «lavoratore colf» e il permesso di soggiorno
async function registraLavoratoreArchivio(l) {
  if (!l || (!l.lavCognome && !l.lavNome)) return;
  const nc = (l.lavCognome + ' ' + l.lavNome).trim();
  try { await registraClienteSeNuovo(l.lavCognome, l.lavNome, l.lavData, l.lavCodiceFiscale, l.lavTelefono, '', l.lavDocumentoScadenza, ''); } catch (e) { console.error('archivio lavoratore', e); }
  if (l.lavDocumentoNumero || l.lavComuneNascita || l.lavDocumentoTipo) { try { await data.clienti.salvaDocumento({ codiceFiscale: l.lavCodiceFiscale, nomeCompleto: nc, dataNascita: l.lavData, documentoNumero: l.lavDocumentoNumero, comuneNascita: l.lavComuneNascita, documentoTipo: l.lavDocumentoTipo }); } catch (e) { console.error('documento lavoratore', e); } }
  await data.clienti.segnaLavoratore({ codiceFiscale: l.lavCodiceFiscale, nomeCompleto: nc, dataNascita: l.lavData, permessoNumero: l.lavPermessoNumero, permessoScadenza: l.lavPermessoScadenza });
  const rec = trovaInArchivio(nc, l.lavData, l.lavCodiceFiscale);
  if (rec) { rec.lavoratoreColf = true; if (l.lavPermessoScadenza) rec.permessoScadenza = l.lavPermessoScadenza; if (l.lavPermessoNumero) rec.permessoNumero = l.lavPermessoNumero; }
}
function nomeLavoratore(p) { return ((p && (p.lavCognome || '')) + ' ' + ((p && p.lavNome) || '')).trim(); }
// riga sulla scheda della pratica nel registro
function lavoratoreCardHTML(p) {
  const n = nomeLavoratore(p); if (!n || !eColf(p.tipo)) return '';
  const st = p.lavPermessoScadenza && typeof statoScadenzaDocumento === 'function' ? statoScadenzaDocumento(p.lavPermessoScadenza) : null;
  return '<div class="meta" style="margin-top:4px"><b style="color:#8e44ad">👷 Lavoratore:</b> ' + esc(n)
    + (p.lavData ? ' <span class="sub2">(nato/a il ' + esc(p.lavData) + ')</span>' : '')
    + (p.lavTelefono ? ' · 📱 ' + esc(p.lavTelefono) : '')
    + (p.lavPermessoScadenza ? ' · <span style="font-weight:700; color:' + (st && st.giorni < 0 ? '#c0392b' : st && st.giorni <= 60 ? '#b35f0c' : '#1a7f37') + '">🛂 permesso ' + (st && st.giorni < 0 ? 'scaduto il ' : 'fino al ') + esc(p.lavPermessoScadenza) + '</span>' : '')
    + '</div>';
}
// campi del lavoratore nella finestra di modifica della pratica (registro)
function lavoratoreEditHTML(p) {
  const c = function (k, etichetta, val, attr) { return '<div><label>' + etichetta + '</label><input id="e-' + k + '-' + p.id + '" value="' + esc(val || '') + '" ' + (attr || '') + '></div>'; };
  const up = 'style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"', data = 'placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"';
  return '<div class="full" id="e-lavwrap-' + p.id + '" style="display:' + (eColf(p.tipo) ? '' : 'none') + '; border:2px solid #8e44ad; border-radius:12px; padding:8px 10px; background:rgba(142,68,173,.06)">'
    + '<div style="font-weight:800; color:#8e44ad; margin-bottom:6px">👷 Lavoratore (colf o badante)</div><div class="grid">'
    + '<div class="full" style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end"><div style="flex:1 1 240px"><label>Cerca il lavoratore nell\'archivio (cognome o nome)</label><input id="e-lavcerca-' + p.id + '" autocomplete="off" placeholder="Scrivi per cercare tra i clienti già archiviati..." oninput="cercaLavoratoreEdit(\'' + p.id + '\', this.value)"></div>'
    + '<button type="button" class="btn-scan-cf" onclick="apriLetturaLavoratore(\'' + p.id + '\')" title="Leggi i dati del lavoratore da una foto o dal PDF del documento">📄 Leggi documento (foto o PDF)</button>'
    + '<div id="e-lavris-' + p.id + '" style="flex:1 1 100%; max-height:220px; overflow:auto; border-radius:8px; background:var(--card)"></div></div>'
    + c('lavcognome', 'Cognome', p.lavCognome, up) + c('lavnome', 'Nome', p.lavNome, up)
    + c('lavdata', 'Data di nascita', p.lavData, data) + c('lavcomune', 'Luogo di nascita', p.lavComuneNascita, up)
    + c('lavcf', 'Codice fiscale', p.lavCodiceFiscale, 'maxlength="16" style="text-transform:uppercase; font-family:monospace" oninput="this.value=normalizzaCF(this.value)"')
    + c('lavtel', 'Cellulare', p.lavTelefono, 'type="tel" inputmode="tel"')
    + '<div><label>Tipo documento</label><select id="e-lavdoctipo-' + p.id + '">' + (typeof opzioniTipoDoc === 'function' ? opzioniTipoDoc(p.lavDocumentoTipo || '') : '') + '</select></div>'
    + c('lavdocscad', 'Scadenza documento', p.lavDocumentoScadenza, data) + c('lavdocnum', 'N. documento', p.lavDocumentoNumero, up)
    + c('lavpermscad', 'Permesso di soggiorno: scadenza', p.lavPermessoScadenza, data) + c('lavpermnum', 'Permesso di soggiorno: numero', p.lavPermessoNumero, up)
    + '</div></div>';
}
function mostraLavoratoreEdit(id, tipo) { const w = document.getElementById('e-lavwrap-' + id); if (w) w.style.display = eColf(tipo) ? '' : 'none'; }
// dati del lavoratore dalla finestra di modifica (vuoti se il tipo non è colf)
function datiLavoratoreEdit(id, tipo) {
  const v = function (k) { const el = document.getElementById('e-' + k + '-' + id); return el ? String(el.value || '').trim() : ''; };
  const cognome = v('lavcognome').toUpperCase().replace(/\s+/g, ' '), nome = v('lavnome').toUpperCase().replace(/\s+/g, ' ');
  if (!eColf(tipo) || (!cognome && !nome)) return { lavCognome: '', lavNome: '', lavCodiceFiscale: '', lavData: '', lavComuneNascita: '', lavTelefono: '', lavDocumentoTipo: '', lavDocumentoNumero: '', lavDocumentoScadenza: '', lavPermessoNumero: '', lavPermessoScadenza: '' };
  return {
    lavCognome: cognome, lavNome: nome, lavCodiceFiscale: typeof normalizzaCF === 'function' ? normalizzaCF(v('lavcf')) : v('lavcf').toUpperCase(),
    lavData: v('lavdata'), lavComuneNascita: v('lavcomune').toUpperCase(), lavTelefono: v('lavtel'),
    lavDocumentoTipo: v('lavdoctipo'), lavDocumentoNumero: v('lavdocnum').toUpperCase(), lavDocumentoScadenza: v('lavdocscad'),
    lavPermessoNumero: v('lavpermnum').toUpperCase(), lavPermessoScadenza: v('lavpermscad')
  };
}
// contratto in continuazione (trasferito nell'anno nuovo o rinnovato): protocollo d'origine, non conta tra le pratiche nuove
function continuazioneCardHTML(p) {
  if (!p || !p.continuazione) return '';
  return '<div class="meta" style="margin-top:4px"><span style="display:inline-block; background:#1f8a70; color:#fff; border-radius:999px; padding:1px 9px; font-size:12px; font-weight:800">🔁 Contratto in continuazione</span> '
    + 'protocollo d\'origine <b>' + esc(p.protocolloOrigine || '') + '</b> · non conta tra le pratiche nuove del ' + esc(String(annoPratica(p))) + '</div>';
}
