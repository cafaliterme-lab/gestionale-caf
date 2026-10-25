/* ---------------- 👷 Lavoratore dei contratti colf e badanti ----------------
   Nei contratti colf e badanti il cliente della pratica è il datore di lavoro; al posto della congiunta
   (che esiste solo per i 730) si scrive il lavoratore: anagrafica, documento e permesso di soggiorno.
   Il lavoratore va anche in archivio, segnato «👷 lavoratore colf», con il permesso di soggiorno
   (che entra nell'elenco dei documenti scaduti o in scadenza). I messaggi della pratica vanno solo al datore. */

const CAMPI_LAV_MODULO = ['f-lav-cognome', 'f-lav-nome', 'f-lav-data', 'f-lav-comune', 'f-lav-cf', 'f-lav-tel', 'f-lav-doc-scad', 'f-lav-doc-num', 'f-lav-perm-scad', 'f-lav-perm-num', 'cli-cerca-lav'];

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
function usaLavoratore(c) {
  const metti = function (id, v) { const el = document.getElementById(id); if (el) el.value = v || ''; };
  metti('f-lav-cognome', String(c.cognome || '').toUpperCase());
  metti('f-lav-nome', String(c.nome || '').toUpperCase());
  metti('f-lav-data', c.dataNascita);
  metti('f-lav-comune', c.comuneNascita);
  metti('f-lav-cf', c.codiceFiscale);
  metti('f-lav-tel', c.telefono);
  metti('f-lav-doc-scad', c.documentoScadenza);
  metti('f-lav-doc-num', c.documentoNumero);
  metti('f-lav-perm-scad', c.permessoScadenza);
  metti('f-lav-perm-num', c.permessoNumero);
  metti('cli-cerca-lav', c.nomeCompleto);
  const t = document.getElementById('f-lav-doc-tipo'); if (t && typeof opzioniTipoDoc === 'function') t.innerHTML = opzioniTipoDoc(c.documentoTipo || '');
}
// lavoratore letto dal documento (📄 Leggi documento lavoratore)
function lavoratoreDaDocumento(d) {
  const metti = function (id, v) { const el = document.getElementById(id); if (el && v) el.value = v; };
  metti('f-lav-cognome', d.cognome); metti('f-lav-nome', d.nome); metti('f-lav-data', d.dataNascita);
  metti('f-lav-cf', d.codiceFiscale); metti('f-lav-doc-scad', d.scadenza); metti('f-lav-doc-num', d.numero);
  const com = (d.codiceFiscale && typeof cfValido === 'function' && cfValido(d.codiceFiscale) && typeof comuneDaCF === 'function' ? comuneDaCF(d.codiceFiscale) : '') || d.luogo;
  const elC = document.getElementById('f-lav-comune'); if (elC && com && !elC.value.trim()) elC.value = com;
  if (d.tipoDoc) { const t = document.getElementById('f-lav-doc-tipo'); if (t && typeof opzioniTipoDoc === 'function') t.innerHTML = opzioniTipoDoc(d.tipoDoc); }
  metti('cli-cerca-lav', ((d.cognome || '') + ' ' + (d.nome || '')).trim());
}
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
