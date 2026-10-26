/* ---------------- 🏠 Contratti di affitto: inquilini, regime e scadenze ----------------
   Il cliente della pratica è il proprietario (locatore) che registra il contratto; nel riquadro si scrivono
   uno o più inquilini (con ricerca nell'archivio e lettura del documento), il regime (cedolare secca agevolata,
   cedolare secca normale, senza cedolare) e le date del contratto. Le scadenze le crea il database
   (sincronizza_scadenza_assistenza): annualità per i contratti senza cedolare, fine contratto per la cedolare.
   I contratti non passano all'anno nuovo: restano nell'anno in cui sono registrati, con le loro scadenze. */

const TIPO_AFFITTO = 'CONTRATTI DI AFFITTO';
function eAffitto(tipo) { return String(tipo || '').trim().toUpperCase() === TIPO_AFFITTO; }
const REGIMI_AFFITTO = { cedolare_agevolato: '🟢 Cedolare secca agevolata', cedolare_normale: '🔵 Cedolare secca normale', senza_cedolare: '🟠 Senza cedolare secca' };
const DURATE_AFFITTO = { '4+4': '4+4 anni (libero)', '3+2': '3+2 anni (concordato)', 'transitorio': 'Transitorio (scrivi la fine)', 'altro': 'Altra durata (scrivi la fine)' };

// k = 'f' nel modulo di inserimento, oppure l'id della pratica nella finestra di modifica
function idAff(nome, k) { return 'aff-' + nome + '-' + k; }

function affittoBoxHTML(k, p) {
  p = p || {};
  const regime = p.affittoRegime || '';
  return '<div style="font-weight:800; color:#a0522d; margin-bottom:6px">🏠 Contratto di affitto <span style="font-weight:600; font-size:12px; color:var(--sub)">· il cliente in alto è il proprietario (locatore)</span></div>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px">' + Object.keys(REGIMI_AFFITTO).map(function (r) {
      return '<label class="chk" style="margin:0; padding:6px 10px; border:2px solid ' + (r === regime ? '#a0522d' : 'var(--line)') + '; border-radius:10px; cursor:pointer"><input type="radio" name="' + idAff('regime', k) + '" value="' + r + '"' + (r === regime ? ' checked' : '') + ' onchange="coloraRegimeAffitto(\'' + k + '\')"> ' + REGIMI_AFFITTO[r] + '</label>';
    }).join('') + '</div>'
    + '<div class="grid">'
    + '<div><label>Inizio del contratto *</label><input id="' + idAff('inizio', k) + '" value="' + esc(p.affittoInizio || '') + '" placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this); calcolaFineAffitto(\'' + k + '\')"></div>'
    + '<div><label>Durata</label><select id="' + idAff('durata', k) + '" onchange="calcolaFineAffitto(\'' + k + '\')"><option value="">—</option>' + Object.keys(DURATE_AFFITTO).map(function (d) { return '<option value="' + d + '"' + (d === p.affittoDurata ? ' selected' : '') + '>' + DURATE_AFFITTO[d] + '</option>'; }).join('') + '</select></div>'
    + '<div><label>Fine del contratto (scadenza naturale)</label><input id="' + idAff('fine', k) + '" value="' + esc(p.affittoFine || '') + '" placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"></div>'
    + '</div>'
    + '<div style="font-weight:800; color:#a0522d; margin:10px 0 4px">👥 Inquilini</div>'
    + '<div id="' + idAff('inq', k) + '">' + (Array.isArray(p.inquilini) && p.inquilini.length ? p.inquilini : [{}]).map(function (q, i) { return rigaInquilinoHTML(k, i, q); }).join('') + '</div>'
    + '<button type="button" onclick="aggiungiInquilino(\'' + k + '\')" style="background:#a0522d; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">➕ Aggiungi inquilino</button>';
}
function coloraRegimeAffitto(k) {
  document.querySelectorAll('input[name="' + idAff('regime', k) + '"]').forEach(function (r) { r.closest('label').style.borderColor = r.checked ? '#a0522d' : 'var(--line)'; });
}
// fine del contratto dalla durata: 4+4 → dopo 4 anni, 3+2 → dopo 3 anni (il giorno prima dell'anniversario)
function calcolaFineAffitto(k) {
  const ini = parseDataIT((document.getElementById(idAff('inizio', k)) || {}).value || ''), dur = (document.getElementById(idAff('durata', k)) || {}).value || '';
  const fine = document.getElementById(idAff('fine', k));
  const anni = dur === '4+4' ? 4 : dur === '3+2' ? 3 : 0;
  if (!ini || !anni || !fine) return;
  const d = new Date(ini.a + anni, ini.m - 1, ini.g); d.setDate(d.getDate() - 1);
  fine.value = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

// una riga per inquilino
const AFF_RIS = {};
function rigaInquilinoHTML(k, i, q) {
  q = q || {};
  const c = function (cl, etichetta, val, attr) { return '<div><label>' + etichetta + '</label><input class="' + cl + '" value="' + esc(val || '') + '" ' + (attr || '') + '></div>'; };
  const up = 'style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"', data = 'placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"';
  return '<div class="aff-inq" data-i="' + i + '" style="border:1.5px solid #a0522d; border-radius:10px; padding:8px 10px; margin-bottom:8px; background:rgba(160,82,45,.05)">'
    + '<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end; margin-bottom:6px"><b style="color:#a0522d">Inquilino ' + (i + 1) + '</b>'
    + '<input class="i-cerca" autocomplete="off" placeholder="Cerca nell\'archivio (cognome o nome)…" style="flex:1 1 200px" oninput="cercaInquilino(\'' + k + '\', ' + i + ', this.value)">'
    + '<button type="button" class="btn-scan-cf" onclick="leggiDocInquilino(\'' + k + '\', ' + i + ')" title="Leggi i dati dell\'inquilino da una foto o dal PDF del documento">📄 Leggi documento (foto o PDF)</button>'
    + '<button type="button" onclick="togliInquilino(\'' + k + '\', ' + i + ')" title="Togli questo inquilino" style="background:none; border:none; font-size:18px; cursor:pointer">🗑️</button>'
    + '<div class="i-ris" style="flex:1 1 100%; max-height:200px; overflow:auto; border-radius:8px; background:var(--card)"></div></div>'
    + '<div class="grid">' + c('i-cognome', 'Cognome', q.cognome, up) + c('i-nome', 'Nome', q.nome, up) + c('i-data', 'Data di nascita', q.dataNascita, data)
    + c('i-comune', 'Luogo di nascita', q.comuneNascita, up)
    + c('i-cf', 'Codice fiscale', q.codiceFiscale, 'maxlength="16" style="text-transform:uppercase; font-family:monospace" oninput="this.value=normalizzaCF(this.value); compilaInquilinoDaCF(this)"')
    + c('i-tel', 'Cellulare', q.telefono, 'type="tel" inputmode="tel"')
    + '<div><label>Tipo documento</label><select class="i-doctipo">' + (typeof opzioniTipoDoc === 'function' ? opzioniTipoDoc(q.documentoTipo || '') : '') + '</select></div>'
    + c('i-docscad', 'Scadenza documento', q.documentoScadenza, data) + c('i-docnum', 'N. documento', q.documentoNumero, up)
    + '</div></div>';
}
function righeInquilini(k) { const box = document.getElementById(idAff('inq', k)); return box ? Array.prototype.slice.call(box.querySelectorAll('.aff-inq')) : []; }
function leggiRigaInquilino(r) {
  const v = function (cl) { const el = r.querySelector('.' + cl); return el ? String(el.value || '').trim() : ''; };
  return { cognome: v('i-cognome').toUpperCase().replace(/\s+/g, ' '), nome: v('i-nome').toUpperCase().replace(/\s+/g, ' '), dataNascita: v('i-data'), comuneNascita: v('i-comune').toUpperCase(),
    codiceFiscale: typeof normalizzaCF === 'function' ? normalizzaCF(v('i-cf')) : v('i-cf').toUpperCase(), telefono: v('i-tel'),
    documentoTipo: v('i-doctipo'), documentoScadenza: v('i-docscad'), documentoNumero: v('i-docnum').toUpperCase() };
}
function disegnaInquilini(k, lista) {
  const box = document.getElementById(idAff('inq', k)); if (!box) return;
  if (!lista.length) lista = [{}];
  box.innerHTML = lista.map(function (q, i) { return rigaInquilinoHTML(k, i, q); }).join('');
}
function aggiungiInquilino(k) { const l = righeInquilini(k).map(leggiRigaInquilino); l.push({}); disegnaInquilini(k, l); }
function togliInquilino(k, i) { const l = righeInquilini(k).map(leggiRigaInquilino); l.splice(i, 1); disegnaInquilini(k, l); }
function cercaInquilino(k, i, q) {
  const r = righeInquilini(k)[i]; if (!r) return; const box = r.querySelector('.i-ris');
  const kq = chiaveRicerca(q || '');
  if (kq.length < 2) { box.innerHTML = ''; return; }
  const lista = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).filter(function (c) { return !c.decedutoIl && (chiaveRicerca(c.nomeCompleto) + '|' + chiaveRicerca(c.codiceFiscale)).indexOf(kq) >= 0; }).slice(0, 8);
  AFF_RIS[k + '|' + i] = lista;
  box.innerHTML = lista.length ? lista.map(function (c, j) { return '<div class="cli-row" style="cursor:pointer; padding:6px 8px; border-bottom:1px solid var(--line)" onclick="scegliInquilino(\'' + k + '\', ' + i + ', ' + j + ')"><b>' + esc(c.nomeCompleto) + '</b>' + (typeof badgeRuolo === 'function' ? badgeRuolo(c) : '') + '<div class="sub2">' + (c.dataNascita ? 'Nato/a il ' + esc(c.dataNascita) : '') + (c.telefono ? ' · 📞 ' + esc(c.telefono) : '') + '</div></div>'; }).join('')
    : '<div class="sub2" style="padding:6px 8px">Nessun cliente trovato: scrivi i dati qui sotto.</div>';
}
function mettiInquilino(k, i, q) {
  const r = righeInquilini(k)[i]; if (!r) return;
  const metti = function (cl, v) { const el = r.querySelector('.' + cl); if (el && v) el.value = v; };
  metti('i-cognome', String(q.cognome || '').toUpperCase()); metti('i-nome', String(q.nome || '').toUpperCase()); metti('i-data', q.dataNascita);
  metti('i-comune', q.comuneNascita); metti('i-cf', q.codiceFiscale); metti('i-tel', q.telefono);
  metti('i-docscad', q.documentoScadenza); metti('i-docnum', q.documentoNumero); metti('i-cerca', q.nomeCompleto || ((q.cognome || '') + ' ' + (q.nome || '')).trim());
  if (q.documentoTipo) { const t = r.querySelector('.i-doctipo'); if (t && typeof opzioniTipoDoc === 'function') t.innerHTML = opzioniTipoDoc(q.documentoTipo); }
  const box = r.querySelector('.i-ris'); if (box) box.innerHTML = '';
}
function scegliInquilino(k, i, j) { const c = (AFF_RIS[k + '|' + i] || [])[j]; if (c) mettiInquilino(k, i, c); }
let AFF_DEST = null;
function leggiDocInquilino(k, i) { AFF_DEST = { k: k, i: i }; apriLetturaDocumentoPer('inquilino'); }
// inquilino letto dal documento
function inquilinoDaDocumento(d) {
  const dest = AFF_DEST; AFF_DEST = null; if (!dest) return;
  const com = (d.codiceFiscale && typeof cfValido === 'function' && cfValido(d.codiceFiscale) && typeof comuneDaCF === 'function' ? comuneDaCF(d.codiceFiscale) : '') || d.luogo;
  mettiInquilino(dest.k, dest.i, { cognome: d.cognome, nome: d.nome, dataNascita: d.dataNascita, codiceFiscale: d.codiceFiscale, documentoScadenza: d.scadenza, documentoNumero: d.numero, documentoTipo: d.tipoDoc, comuneNascita: com });
}

// riquadro nel modulo di inserimento: visibile solo per i contratti di affitto
function mostraAffittoModulo(tipo) {
  const w = document.getElementById('aff-wrap-f'); if (!w) return;
  if (!eAffitto(tipo)) { w.style.display = 'none'; w.innerHTML = ''; return; }
  if (!w.innerHTML) w.innerHTML = affittoBoxHTML('f', {});
  w.style.display = '';
}
function pulisciAffittoModulo() { const w = document.getElementById('aff-wrap-f'); if (w) { w.innerHTML = ''; w.style.display = 'none'; } mostraAffittoModulo((document.getElementById('f-tipo') || {}).value); }
// riquadro nella finestra di modifica della pratica
function affittoEditHTML(p) {
  return '<div class="full" id="aff-editwrap-' + p.id + '" style="display:' + (eAffitto(p.tipo) ? '' : 'none') + '; border:2px solid #a0522d; border-radius:12px; padding:8px 10px; background:rgba(160,82,45,.06)">' + affittoBoxHTML(p.id, p) + '</div>';
}
function mostraAffittoEdit(id, tipo) { const w = document.getElementById('aff-editwrap-' + id); if (w) w.style.display = eAffitto(tipo) ? '' : 'none'; }
// dati del contratto (vuoti se la pratica non è un contratto di affitto)
function datiAffitto(k, tipo, vecchia) {
  if (!eAffitto(tipo)) return { inquilini: [], affittoRegime: '', affittoInizio: '', affittoDurata: '', affittoFine: '', affittoProssima: '' };
  const v = function (n) { return String((document.getElementById(idAff(n, k)) || {}).value || '').trim(); };
  const r = document.querySelector('input[name="' + idAff('regime', k) + '"]:checked');
  const inquilini = righeInquilini(k).map(leggiRigaInquilino).filter(function (q) { return q.cognome || q.nome; });
  const inizio = v('inizio');
  // l'annualità già pagata resta, a meno che non cambino l'inizio o il regime
  const prossima = vecchia && vecchia.affittoInizio === inizio && vecchia.affittoRegime === (r ? r.value : '') ? (vecchia.affittoProssima || '') : '';
  return { inquilini: inquilini, affittoRegime: r ? r.value : '', affittoInizio: inizio, affittoDurata: v('durata'), affittoFine: v('fine'), affittoProssima: prossima };
}
// controllo prima di salvare: regime e inizio servono per le scadenze
function erroreAffitto(d) {
  if (!d.affittoRegime) return 'Scegli il tipo di contratto: cedolare secca agevolata, cedolare secca normale o senza cedolare secca.';
  if (!parseDataIT(d.affittoInizio)) return 'Scrivi la data di inizio del contratto (GG/MM/AAAA): serve per le scadenze.';
  if (d.affittoFine && !parseDataIT(d.affittoFine)) return 'La fine del contratto non è una data valida (GG/MM/AAAA).';
  if (d.affittoRegime !== 'senza_cedolare' && !d.affittoFine) return 'Con la cedolare secca serve la fine del contratto (scegli la durata o scrivi la data): l\'avviso arriva alla scadenza naturale.';
  if (!d.inquilini.length) return 'Scrivi almeno un inquilino.';
  return '';
}
// gli inquilini vanno anche in archivio, segnati «🏠 inquilino»
async function registraInquiliniArchivio(lista) {
  for (const q of (lista || [])) {
    if (!q.cognome && !q.nome) continue;
    const nc = (q.cognome + ' ' + q.nome).trim();
    try { await registraClienteSeNuovo(q.cognome, q.nome, q.dataNascita, q.codiceFiscale, q.telefono, '', q.documentoScadenza, ''); } catch (e) { console.error('archivio inquilino', e); }
    if (q.documentoNumero || q.comuneNascita || q.documentoTipo) { try { await data.clienti.salvaDocumento({ codiceFiscale: q.codiceFiscale, nomeCompleto: nc, dataNascita: q.dataNascita, documentoNumero: q.documentoNumero, comuneNascita: q.comuneNascita, documentoTipo: q.documentoTipo }); } catch (e) { console.error('documento inquilino', e); } }
    await data.clienti.segnaLavoratore({ inquilino: true, codiceFiscale: q.codiceFiscale, nomeCompleto: nc, dataNascita: q.dataNascita });
    const rec = trovaInArchivio(nc, q.dataNascita, q.codiceFiscale); if (rec) rec.inquilino = true;
  }
}
function nomiInquilini(p) { return (Array.isArray(p && p.inquilini) ? p.inquilini : []).map(function (q) { return ((q.cognome || '') + ' ' + (q.nome || '')).trim(); }).filter(Boolean); }
// riga sulla scheda della pratica nel registro
function affittoCardHTML(p) {
  if (!p || !eAffitto(p.tipo)) return '';
  const n = nomiInquilini(p);
  const sc = (state.scadenze || []).find(function (s) { return s.praticaId === p.id && !s.completata; });
  return '<div class="meta" style="margin-top:4px"><b style="color:#a0522d">🏠 ' + esc(REGIMI_AFFITTO[p.affittoRegime] || 'Regime non indicato') + '</b>'
    + (p.affittoInizio ? ' · dal ' + esc(p.affittoInizio) : '') + (p.affittoFine ? ' al ' + esc(p.affittoFine) : '') + (p.affittoDurata ? ' (' + esc(p.affittoDurata) + ')' : '')
    + (n.length ? '<br><b style="color:#a0522d">👥 Inquilin' + (n.length > 1 ? 'i' : 'o') + ':</b> ' + esc(n.join(', ')) : '')
    + (sc ? '<br>⏰ ' + esc(sc.titolo) + ': <b>' + esc(dataIT(sc.data)) + '</b>' : '')
    + '</div>';
}
// annualità pagata (senza cedolare): la scadenza passa all'anno dopo; dopo l'ultima resta la fine del contratto
async function annualitaAffittoPagata(s) {
  const p = (state.pratiche || []).concat(state.annullate || []).find(function (x) { return x.id === s.praticaId; });
  if (!p) return false;
  const d = new Date(String(s.data).slice(0, 10) + 'T12:00:00'); d.setFullYear(d.getFullYear() + 1);
  const prossima = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  if (!confirm('Annualità del ' + dataIT(s.data) + ' pagata.\n\nLa prossima scadenza diventa il ' + prossima + (p.affittoFine ? ' (o la fine del contratto, ' + p.affittoFine + ', se viene prima)' : '') + '.')) return true;
  const r = await data.pratiche.aggiorna(p.id, { affittoProssima: prossima });
  if (r && r.error) { avviso('❌ ' + r.error, true); return true; }
  p.affittoProssima = prossima;
  avviso('✓ Annualità pagata: prossima scadenza ' + prossima);
  return true;
}
function eScadenzaAffitto(s) { return /affitto/i.test((s && s.titolo) || ''); }
function eAnnualitaAffitto(s) { return /^annualit/i.test((s && s.titolo) || '') && eScadenzaAffitto(s); }
// codice fiscale dell'inquilino scritto a mano: dati dall'archivio (se c'è) e data e comune dal codice
function compilaInquilinoDaCF(input) {
  const r = input.closest('.aff-inq'); if (!r) return;
  const cf = normalizzaCF(input.value);
  if (cf.length !== 16 || !cfValido(cf)) return;
  const metti = function (cl, v) { const el = r.querySelector('.' + cl); if (el && v && !String(el.value || '').trim()) el.value = v; };
  const c = typeof personaDaCF === 'function' ? personaDaCF(cf) : null;
  if (c) {
    metti('i-cognome', String(c.cognome || '').toUpperCase()); metti('i-nome', String(c.nome || '').toUpperCase()); metti('i-tel', c.telefono);
    metti('i-docscad', c.documentoScadenza); metti('i-docnum', c.documentoNumero); metti('i-cerca', c.nomeCompleto);
  }
  const d = typeof datiDaCF === 'function' ? datiDaCF(cf) : null;
  metti('i-data', (c && c.dataNascita) || (d && d.dataNascita));
  metti('i-comune', (c && c.comuneNascita) || (typeof comuneDaCF === 'function' ? comuneDaCF(cf) : ''));
}
