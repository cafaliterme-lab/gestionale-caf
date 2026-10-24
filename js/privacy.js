/* ---------------- Privacy: informativa e consenso al trattamento dei dati (Reg. UE 2016/679 – GDPR) ---------------- */
// Modulo da far firmare al cliente (anche al coniuge per la congiunta) e spunta "Consenso firmato" nella pratica.

const CONSENSI_PRIVACY = [
  { k: 'pratica', testo: 'al trattamento dei miei dati personali, compresi quelli particolari (es. sanitari) contenuti nei documenti consegnati, per lo svolgimento della pratica richiesta', obbligatorio: true },
  { k: 'archivio', testo: 'alla conservazione dei miei dati e documenti nell\'archivio informatico della sede, anche per le pratiche degli anni successivi' },
  { k: 'contatti', testo: 'a essere contattato/a al cellulare (anche WhatsApp/SMS) o per e-mail per avvisi sulla pratica, ritiro, documenti mancanti e scadenze' }
];

function testoInformativaPrivacy() {
  const caf = (typeof datiCafStampa === 'function') ? datiCafStampa() : {};
  const recapiti = [caf.indirizzo, caf.telefono ? 'tel. ' + caf.telefono : '', caf.email].filter(Boolean).join(' – ');
  return '<p><b>Titolare del trattamento</b>: CAF CISL – Sede di Alì Terme' + (recapiti ? ' (' + esc(recapiti) + ')' : '') + ', per conto del CAF CISL di cui è sede operativa.</p>'
    + '<p><b>Dati trattati</b>: dati anagrafici e di contatto (nome, cognome, data di nascita, codice fiscale, telefono, e-mail), dati reddituali e patrimoniali, e gli eventuali dati particolari (es. spese sanitarie) presenti nei documenti consegnati.</p>'
    + '<p><b>Finalità</b>: svolgimento della pratica richiesta (dichiarazione dei redditi, ISEE, IMU, successioni, contratti, ecc.), adempimenti di legge e fiscali, assistenza e comunicazioni relative alla pratica; inoltre avvisi sulle scadenze, sull\'avvio della campagna 730 e auguri nelle festività, via telefono, WhatsApp o e-mail (il cliente può chiedere in ogni momento di non riceverli più).</p>'
    + '<p><b>Modalità</b>: i dati sono trattati su carta e con strumenti informatici protetti (accesso con credenziali personali, solo da parte di operatori autorizzati) e conservati su server sicuri nell\'Unione Europea.</p>'
    + '<p><b>Comunicazione</b>: i dati possono essere comunicati all\'Agenzia delle Entrate, all\'INPS, ai Comuni e agli altri enti previsti dalla legge per la pratica richiesta, e al CAF CISL; non sono diffusi né usati per pubblicità.</p>'
    + '<p><b>Conservazione</b>: per il tempo necessario alla pratica e per i termini previsti dalla legge fiscale (in genere 10 anni).</p>'
    + '<p><b>Diritti</b>: l\'interessato può chiedere in ogni momento accesso, rettifica, cancellazione o limitazione dei dati, opporsi al trattamento e revocare il consenso, rivolgendosi alla sede; può inoltre presentare reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).</p>';
}

function bloccoConsensiHTML(nome) {
  return '<div class="consensi"><div class="ctit">CONSENSO AL TRATTAMENTO DEI DATI PERSONALI</div>'
    + '<div>Io sottoscritto/a <b>' + esc(nome || '______________________________') + '</b>, ricevuta l\'informativa ai sensi dell\'art. 13 del Regolamento UE 2016/679:</div>'
    + CONSENSI_PRIVACY.map(function (c) {
      return '<div class="cons"><span class="sc">☐ ACCONSENTO &nbsp; ☐ NON ACCONSENTO</span> ' + c.testo + (c.obbligatorio ? ' <i>(necessario per svolgere la pratica)</i>' : '') + '</div>';
    }).join('')
    + '<div class="firme"><div>Data ______________</div><div>Firma del contribuente</div></div></div>';
}

function stampaPrivacy(id) {
  const p = (state.pratiche || []).find(function (x) { return x.id === id; });
  if (!p) { avviso('❌ Pratica non trovata', true); return; }
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra: consenti i popup per questo sito e riprova.'); return; }
  const persone = [p.nome].concat(p.congiunta ? [p.congiunta] : []);
  const pagina = function (nome) {
    return '<div class="foglio"><h1>INFORMATIVA E CONSENSO AL TRATTAMENTO DEI DATI PERSONALI</h1>'
      + '<div class="sotto">Regolamento UE 2016/679 (GDPR) e D.Lgs. 196/2003 · Pratica ' + esc(formattaProtocollo(p)) + ' – ' + esc(p.tipo || '') + '</div>'
      + '<div class="info">' + testoInformativaPrivacy() + '</div>' + bloccoConsensiHTML(nome) + '</div>';
  };
  w.document.open();
  w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Privacy ' + esc(p.nome || '') + '</title><style>'
    + '@page{size:A4 portrait; margin:12mm} body{font-family:Arial,Helvetica,sans-serif; color:#0f1b2d; font-size:11.5px; margin:0; padding:10px}'
    + '.foglio{page-break-after:always} .foglio:last-child{page-break-after:auto} h1{font-size:15px; text-align:center; color:#1d4f91; margin:0 0 2px} .sotto{text-align:center; font-size:10.5px; color:#5b6b82; margin-bottom:8px}'
    + '.info p{margin:4px 0; line-height:1.35} .consensi{margin-top:10px; border:2px solid #1d4f91; border-radius:8px; padding:8px 12px} .ctit{font-weight:800; color:#1d4f91; margin-bottom:4px}'
    + '.cons{margin:6px 0; line-height:1.35} .sc{font-weight:700; white-space:nowrap} .firme{display:flex; justify-content:space-between; gap:30px; margin-top:28px} .firme div{flex:1; border-top:1px solid #0f1b2d; padding-top:4px; text-align:center}'
    + '.barra{margin-bottom:10px} .barra button{font-size:14px; padding:8px 16px; margin-right:6px} @media print{.barra{display:none} body{padding:0}}'
    + '</style></head><body><div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button><button onclick="window.close()">Chiudi</button></div>'
    + persone.map(pagina).join('') + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
  w.document.close();
}

// Spunta nella pratica: consenso firmato (data) oppure da far firmare
async function segnaConsensoPrivacy(id, firmato) {
  const valore = firmato ? todayIT() : '';
  const r = await data.pratiche.aggiorna(id, { consensoPrivacy: valore });
  if (r && r.error) return;
  avviso(firmato ? '✓ Consenso privacy segnato come firmato' : 'Consenso privacy da far firmare');
  render();
}
function bottoniPrivacyHTML(p) {
  const firmato = !!p.consensoPrivacy;
  return '<button onclick="stampaPrivacy(\'' + p.id + '\')" title="Informativa e consenso privacy da far firmare al cliente">🔏 Modulo privacy</button>'
    + '<label class="chk" style="display:inline-flex; align-items:center; gap:4px; font-size:12.5px; padding:4px 10px; border-radius:999px; background:' + (firmato ? '#e8f6ee' : '#fdecea') + '; color:' + (firmato ? '#1a7f37' : '#c0392b') + '; font-weight:700; margin:0">'
    + '<input type="checkbox" ' + (firmato ? 'checked' : '') + ' onchange="segnaConsensoPrivacy(\'' + p.id + '\', this.checked)" style="width:auto; margin:0"> ' + (firmato ? 'Consenso firmato il ' + esc(p.consensoPrivacy) : 'Consenso privacy da firmare') + '</label>';
}
