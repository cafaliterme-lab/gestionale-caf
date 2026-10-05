/**
 * Funzioni aggiuntive: avviso ritiri non comunicati, ricevuta per il cliente, storico modifiche,
 * backup automatici e conferma scritta per le operazioni pericolose.
 */

/* ---------------- Conferma scritta (es. "SVUOTA") ---------------- */

function chiediConfermaScritta(titolo, testo, parola) {
  return new Promise(function (risolvi) {
    const ov = document.createElement('div');
    ov.className = 'conferma-scritta';
    ov.style.cssText = 'position:fixed; inset:0; z-index:450; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
    ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #c0392b; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:24px 26px; max-width:440px; width:100%; text-align:center">'
      + '<div style="font-size:34px">⚠️</div>'
      + '<div style="font-size:20px; font-weight:800; color:#c0392b; margin:4px 0 8px">' + esc(titolo) + '</div>'
      + '<div style="font-size:13.5px; margin-bottom:14px">' + esc(testo) + '</div>'
      + '<label style="display:block; font-size:13px; margin-bottom:6px">Per confermare scrivi <b>' + esc(parola) + '</b></label>'
      + '<input type="text" autocomplete="off" style="text-align:center; text-transform:uppercase; font-weight:700; letter-spacing:.1em">'
      + '<div style="display:flex; gap:10px; justify-content:center; margin-top:14px; flex-wrap:wrap">'
      + '<button type="button" data-r="no" style="background:var(--line); color:var(--ink); min-width:110px">Annulla</button>'
      + '<button type="button" data-r="si" disabled style="background:#c0392b; color:#fff; min-width:140px; opacity:.5">Conferma</button></div></div>';
    document.body.appendChild(ov);
    const inp = ov.querySelector('input'), si = ov.querySelector('[data-r="si"]');
    const fine = function (esito) { ov.remove(); risolvi(esito); };
    inp.addEventListener('input', function () {
      const giusto = inp.value.trim().toUpperCase() === parola;
      si.disabled = !giusto; si.style.opacity = giusto ? '1' : '.5';
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !si.disabled) fine(true); if (e.key === 'Escape') fine(false); });
    ov.addEventListener('click', function (e) {
      const b = e.target.closest('button[data-r]');
      if (b && !b.disabled) fine(b.dataset.r === 'si');
    });
    setTimeout(function () { inp.focus(); }, 50);
  });
}

/* ---------------- Avviso: pratiche lavorate e non ancora comunicate ---------------- */

const GIORNI_AVVISO_RITIRO = 7;
function giorniDa(dataIT) {
  const d = parseDataIT(dataIT);
  if (!d) return null;
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  return Math.round((oggi - new Date(d.a, d.m - 1, d.g)) / 864e5);
}
function praticheDaAvvisare(pratAnno) {
  return (pratAnno || []).filter(function (p) {
    if (p.stato !== 'lavorata' || p.whatsappInviato) return false;
    const g = giorniDa(p.dataFine);
    return g !== null && g > GIORNI_AVVISO_RITIRO;
  }).sort(function (a, b) { return a.numero - b.numero; });
}
function avvisoRitiriHTML(pratAnno) {
  const lista = praticheDaAvvisare(pratAnno);
  if (!lista.length) return '';
  const nomi = lista.slice(0, 6).map(function (p) { return esc(p.nome) + ' <span style="opacity:.75">(' + giorniDa(p.dataFine) + ' gg)</span>'; }).join(', ') + (lista.length > 6 ? ' e altri ' + (lista.length - 6) : '');
  return '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:12px; padding:12px 14px; border-radius:12px; background:color-mix(in srgb, #f08a24 16%, var(--card)); border:2px solid #f08a24">'
    + '<div style="font-size:26px">⏰</div>'
    + '<div style="flex:1; min-width:220px"><div style="font-weight:800; color:#b35f0c">' + lista.length + (lista.length === 1 ? ' pratica lavorata' : ' pratiche lavorate') + ' da più di ' + GIORNI_AVVISO_RITIRO + ' giorni senza avviso WhatsApp</div>'
    + '<div style="font-size:12.5px; margin-top:2px">' + nomi + '</div></div>'
    + '<button type="button" style="background:#25d366; color:#fff; border:none; border-radius:999px; padding:8px 16px; font-weight:700; cursor:pointer" onclick="apriInvioMultiplo()">💬 Avvisa ora</button></div>';
}

/* ---------------- Ricevuta da consegnare al cliente ---------------- */

function stampaRicevuta(id) {
  const p = (state.pratiche || []).find(function (x) { return x.id === id; });
  if (!p) { avviso('❌ Pratica non trovata: riprova tra qualche secondo.', true); return; }
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra della ricevuta: consenti i popup per questo sito e riprova.'); return; }
  const logo = document.querySelector('.hero-logo');
  const caf = (typeof datiCafStampa === 'function') ? datiCafStampa() : {};
  const doc = documentiPratica(p);
  const riga = function (etichetta, valore) { return valore ? '<tr><th>' + etichetta + '</th><td>' + esc(valore) + '</td></tr>' : ''; };
  const copia = function (perChi) {
    return '<div class="ric">'
      + '<div class="testa">' + (logo ? '<img src="' + logo.src + '" alt="">' : '') + '<div><h1>CAF CISL – Sede di Alì Terme</h1>'
      + '<div class="caf">' + [caf.indirizzo ? '📍 ' + esc(caf.indirizzo) : '', caf.telefono ? '📞 ' + esc(caf.telefono) : '', caf.email ? '✉️ ' + esc(caf.email) : ''].filter(Boolean).join(' · ') + '</div></div>'
      + '<div class="copia">' + perChi + '</div></div>'
      + '<div class="titolo">RICEVUTA DI PRESA IN CARICO</div>'
      + '<div class="proto">Protocollo n. <b>' + esc(formattaProtocollo(p)) + '</b> del ' + esc(p.data || '') + '</div>'
      + '<table>'
      + riga('Contribuente', p.nome) + riga('Nato/a il', p.cf) + riga('Codice fiscale', p.codiceFiscale)
      + riga('Coniuge (congiunta)', p.congiunta ? p.congiunta + (p.congData ? ' – nato/a il ' + p.congData : '') : '')
      + riga('Tipo di pratica', p.tipo)
      + riga('Importo', Number(p.compenso) ? fmtEuro(p.compenso) : '') + riga('Pagato', Number(p.pagato) ? fmtEuro(p.pagato) : '')
      + riga('Recapito', [p.telefono, p.telefonoFisso].filter(Boolean).join(' / '))
      + (p.documentoScadenza ? '<tr><th>Documento d\'identità</th><td>' + (statoScadenzaDocumento(p.documentoScadenza) && !statoScadenzaDocumento(p.documentoScadenza).valido ? '<b style="color:#c0392b">SCADUTO il ' + esc(p.documentoScadenza) + ' – portare il nuovo documento</b>' : 'valido fino al ' + esc(p.documentoScadenza)) + '</td></tr>' : '')
      + riga('Note', p.note)
      + '</table>'
      + (doc.presentati.length ? '<div class="docs"><b>Documentazione presentata</b><ul>' + doc.presentati.map(function (n) { return '<li>☑ ' + esc(n) + '</li>'; }).join('') + '</ul></div>' : '')
      + (doc.mancanti.length ? '<div class="docs mancanti"><b>Documentazione mancante – da portare</b><ul>' + doc.mancanti.map(function (n) { return '<li>☐ ' + esc(n) + '</li>'; }).join('') + '</ul></div>' : '')
      + (caf.orari ? '<div class="orari">🕘 Orari di apertura: ' + esc(caf.orari) + '</div>' : '')
      + '<div class="nota">Conservare la ricevuta e presentarla al ritiro della pratica. Verrà avvisato/a quando la pratica sarà pronta.</div>'
      + '<div class="firme"><div>L\'operatore<br><span>' + esc(p.inseritoDa || '') + '</span></div><div>Il contribuente</div></div>'
      + '</div>';
  };
  const html = '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ricevuta ' + esc(formattaProtocollo(p)) + '</title><style>'
    + '@page{size:A4 portrait; margin:10mm}'
    + 'body{font-family:Arial,Helvetica,sans-serif; color:#0f1b2d; background:#fff; margin:0; padding:12px; font-size:12px}'
    + '.ric{border:1px solid #cfd8e3; border-radius:10px; padding:14px 18px; page-break-inside:avoid}'
    + '.testa{display:flex; align-items:center; gap:12px; border-bottom:3px solid #1d4f91; padding-bottom:8px}'
    + '.testa img{width:48px}.testa h1{font-size:15px; margin:0; color:#1d4f91}.caf{font-size:10.5px; color:#445; margin-top:3px}'
    + '.copia{margin-left:auto; font-size:10px; font-weight:700; color:#5b6b82; text-transform:uppercase; border:1px solid #cfd8e3; border-radius:999px; padding:3px 10px; white-space:nowrap}'
    + '.titolo{text-align:center; font-size:15px; font-weight:800; letter-spacing:.06em; margin:10px 0 2px}'
    + '.proto{text-align:center; font-size:13px; margin-bottom:8px}'
    + 'table{width:100%; border-collapse:collapse}th,td{text-align:left; padding:4px 6px; border-bottom:1px solid #e3e8ef; vertical-align:top}th{width:34%; color:#5b6b82; font-weight:600}'
    + '.docs{margin-top:8px; font-size:11.5px}.docs ul{margin:3px 0 0; padding:0; list-style:none; columns:2; column-gap:20px}.docs li{padding:1px 0}'
    + '.docs.mancanti{border:1.5px solid #c0392b; border-radius:8px; padding:6px 10px}.docs.mancanti b{color:#c0392b}'
    + '.orari{margin-top:8px; font-size:11px}.nota{margin-top:6px; font-size:11px; color:#445}'
    + '.firme{display:flex; justify-content:space-between; gap:30px; margin-top:26px}.firme div{flex:1; border-top:1px solid #0f1b2d; padding-top:4px; text-align:center; font-size:11px}.firme span{color:#5b6b82}'
    + '.taglio{border:none; border-top:1px dashed #8a8f98; margin:18px 0; position:relative}.taglio:after{content:"✂ taglia qui"; position:absolute; left:50%; top:-8px; transform:translateX(-50%); background:#fff; padding:0 8px; font-size:10px; color:#8a8f98}'
    + '.barra{display:flex; gap:8px; margin-bottom:10px}.barra button{font-size:14px; padding:8px 16px; border:none; border-radius:999px; background:#1d4f91; color:#fff; cursor:pointer}.barra button.chiudi{background:#e3e8ef; color:#0f1b2d}'
    + '@media print{.barra{display:none} body{padding:0}}'
    + '</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button><button class="chiudi" onclick="window.close()">Chiudi</button></div>'
    + copia('Copia per il cliente') + '<hr class="taglio">' + copia('Copia per il CAF')
    + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>';
  w.document.open(); w.document.write(html); w.document.close();
}

/* ---------------- Storico delle modifiche ---------------- */

const ETICHETTE_CAMPI = {
  nome: 'Nominativo', stato: 'Stato', tipo: 'Tipo pratica', telefono: 'Cellulare', telefono_fisso: 'Telefono fisso',
  compenso: 'Fattura', pagato: 'Pagato', data: 'Data apertura', data_fine: 'Fine lavorazione', note: 'Note',
  num_fattura: 'N. fattura', data_fattura: 'Data fattura', fatt: 'Fatturazione', cf: 'Data di nascita', codice_fiscale: 'Codice fiscale',
  congiunta: 'Congiunta', cong_cognome: 'Cognome coniuge', cong_nome: 'Nome coniuge', cong_data: 'Nascita coniuge',
  cong_codice_fiscale: 'CF coniuge', cong_telefono: 'Cellulare coniuge', scadenza_assistenza: 'Scadenza assistenza',
  whatsapp_inviato: 'Avviso WhatsApp', inserito_da: 'Inserito da', numero: 'Numero', anno: 'Anno',
};
function valoreStorico(campo, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (campo === 'stato') return statoLabel(v);
  if (campo === 'compenso' || campo === 'pagato') return fmtEuro(v);
  return String(v);
}
function quandoStorico(ts) {
  const d = new Date(ts);
  return isNaN(d) ? '' : d.toLocaleDateString('it-IT') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function rigaStoricoHTML(r, conPratica) {
  const icona = r.azione === 'inserita' ? '🆕' : r.azione === 'eliminata' ? '🗑️' : '✏️';
  let dettagli = '';
  if (r.azione === 'modificata' && r.modifiche) {
    dettagli = Object.keys(r.modifiche).map(function (k) {
      const v = r.modifiche[k];
      return '<div style="margin-left:22px">• <b>' + esc(ETICHETTE_CAMPI[k] || k) + '</b>: ' + esc(valoreStorico(k, v[0])) + ' → <b>' + esc(valoreStorico(k, v[1])) + '</b></div>';
    }).join('');
  } else if (r.modifiche) {
    dettagli = '<div style="margin-left:22px; color:var(--sub)">' + esc([r.modifiche.tipo, valoreStorico('stato', r.modifiche.stato)].filter(Boolean).join(' · ')) + '</div>';
  }
  const pratica = conPratica ? ' · <b>' + esc(String(r.numero || '').padStart(4, '0') + (r.anno ? '/' + r.anno : '')) + '</b> ' + esc(r.nome || '') : '';
  return '<div style="padding:6px 0; border-bottom:1px solid var(--line); font-size:12.5px">'
    + icona + ' <span style="color:var(--sub)">' + esc(quandoStorico(r.quando)) + '</span> · <b>' + esc(r.chi || '') + '</b> ha ' + ({ inserita: 'inserito', modificata: 'modificato', eliminata: 'eliminato' }[r.azione] || esc(r.azione)) + ' la pratica' + pratica + dettagli + '</div>';
}
async function leggiStorico(filtro, limite) {
  const { data, ok } = await fetchSupabase('/rest/v1/pratiche_storico?select=*' + (filtro || '') + '&order=quando.desc&limit=' + (limite || 100));
  return ok && Array.isArray(data) ? data : null;
}
async function mostraStoricoPratica(id) {
  const box = document.getElementById('storico-' + id);
  if (!box) return;
  if (box.innerHTML) { box.innerHTML = ''; return; }
  box.innerHTML = '<div style="font-size:12.5px; color:var(--sub); padding:6px 0">Caricamento...</div>';
  const righe = await leggiStorico('&pratica_id=eq.' + encodeURIComponent(id), 200);
  box.innerHTML = '<div style="margin-top:8px; padding:8px 12px; border:1px solid var(--line); border-radius:10px; background:var(--bg)"><div style="font-weight:700; font-size:13px; margin-bottom:4px">📜 Storico modifiche</div>'
    + (righe === null ? '<div class="empty">Storico non disponibile</div>' : righe.length ? righe.map(function (r) { return rigaStoricoHTML(r, false); }).join('') : '<div style="font-size:12.5px; color:var(--sub)">Nessuna modifica registrata (lo storico è attivo dal 4 ottobre 2026).</div>')
    + '</div>';
}
async function renderStoricoGlobale() {
  const box = document.getElementById('storico-globale');
  if (!box) return;
  box.innerHTML = '<div style="font-size:12.5px; color:var(--sub)">Caricamento...</div>';
  const righe = await leggiStorico('', 100);
  box.innerHTML = righe === null ? '<div class="empty">Storico non disponibile</div>'
    : righe.length ? '<div style="max-height:420px; overflow-y:auto">' + righe.map(function (r) { return rigaStoricoHTML(r, true); }).join('') + '</div>'
      : '<div class="empty">Nessuna modifica registrata finora</div>';
}

/* ---------------- Backup automatici ---------------- */

const NOMI_BACKUP = { settimanale: '🗓️ Settimanale', manuale: '💾 Manuale', prima_di_svuotare: '🛡️ Prima di svuotare il registro', prima_di_importare: '🛡️ Prima di importare un backup' };
async function renderBackup() {
  const box = document.getElementById('backup-lista');
  if (!box) return;
  const { data, ok } = await fetchSupabase('/rest/v1/backup_automatici?select=id,creato_il,tipo,creato_da,n_pratiche&order=creato_il.desc');
  if (!ok || !Array.isArray(data)) { box.innerHTML = '<div class="empty">Elenco dei backup non disponibile</div>'; return; }
  box.innerHTML = data.length ? data.map(function (b) {
    return '<div style="display:flex; align-items:center; gap:10px; padding:7px 0; border-bottom:1px solid var(--line); font-size:13px; flex-wrap:wrap">'
      + '<span style="flex:1; min-width:200px"><b>' + esc(quandoStorico(b.creato_il)) + '</b> · ' + esc(NOMI_BACKUP[b.tipo] || b.tipo) + ' <span style="color:var(--sub)">(' + (b.n_pratiche || 0) + ' pratiche' + (b.creato_da ? ', ' + esc(b.creato_da) : '') + ')</span></span>'
      + '<button type="button" style="background:var(--line); color:var(--ink); border:none; border-radius:8px; padding:5px 12px; cursor:pointer" onclick="scaricaBackup(' + Number(b.id) + ')">⬇️ Scarica</button></div>';
  }).join('') : '<div class="empty">Nessun backup ancora</div>';
}
async function creaBackupOra() {
  const { error } = await supabase.rpc('crea_backup', { p_tipo: 'manuale' });
  if (error) { avviso('❌ Backup non riuscito: ' + error.message, true); return; }
  avviso('✓ Backup creato');
  renderBackup();
}
async function scaricaBackup(id) {
  const { data, ok } = await fetchSupabase('/rest/v1/backup_automatici?select=creato_il,dati&id=eq.' + Number(id));
  if (!ok || !data || !data.length) { avviso('❌ Backup non trovato', true); return; }
  const d = data[0].dati || {};
  const mappa = function (lista, schema) { return (lista || []).map(function (r) { return window.data.mappa(r, schema); }); };
  const s = window.data.schemi;
  const payload = {
    versione: 1,
    esportatoIl: data[0].creato_il,
    pratiche: mappa(d.pratiche, s.pratica),
    versamenti: mappa(d.versamenti, s.versamento),
    isee: mappa(d.isee, s.isee),
    clienti: mappa(d.clienti, s.cliente),
    scadenze: mappa(d.scadenze, s.scadenza),
    collaboratori: (d.collaboratori || []).map(function (c) { return c.nome; }),
    impostazioni: d.impostazioni || [],
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'backup-automatico-' + String(data[0].creato_il).slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
}
function renderBackupEStorico() {
  if (typeof isAdmin === 'function' && !isAdmin()) return;
  renderEditorImportiFPS();
  renderBackup();
  renderStoricoGlobale();
}

/* ---------------- Pratiche in convenzione (730 FPS e 730 FILCA) ---------------- */
// Importi gestiti dall'amministratore in Utenti e permessi; quello "predefinito" si compila da solo.
// Le pratiche senza importo entrano in contabilita' a 0 € e si completano dall'elenco in Contabilita'.

const CONVENZIONI = [
  { chiave: 'fps', nome: '730 FPS in convenzione', re: /^730\s+FPS\b/, impostazione: 'fps_importi' },
  { chiave: 'filca', nome: '730 FILCA', re: /^730\s+FILCA\b/, impostazione: 'filca_importi' },
];
const CONV_SOLO_DA_FATTURARE = { fps: true, filca: true };
function convenzioneDi(tipo) { const t = String(tipo || '').toUpperCase().trim(); return CONVENZIONI.find(function (c) { return c.re.test(t); }) || null; }
function convenzione(chiave) { return CONVENZIONI.find(function (c) { return c.chiave === chiave; }); }
function senzaFattura(p) { return !Number(p.compenso) && !String(p.numFattura || '').trim(); }

function importiConvenzione(conv) {
  try {
    const l = JSON.parse((typeof IMPOSTAZIONI !== 'undefined' && IMPOSTAZIONI[conv.impostazione]) || '[]');
    return Array.isArray(l) ? l.filter(function (x) { return x && !isNaN(Number(x.importo)); }) : [];
  } catch (e) { return []; }
}
// Importo che si compila da solo scegliendo il tipo: il predefinito, altrimenti 0 € (undefined = tipo normale)
function importoAutomaticoConvenzione(tipo) {
  const conv = convenzioneDi(tipo);
  if (!conv) return undefined;
  const pred = importiConvenzione(conv).find(function (x) { return x.predefinito; });
  return pred ? Number(pred.importo) : 0;
}
function etichettaImporto(x) { return (x.descrizione ? x.descrizione + ' – ' : '') + fmtEuro(x.importo); }
function selectImporti(conv, idCampo, compatto) {
  const l = importiConvenzione(conv);
  if (!l.length) return '';
  return (compatto ? '' : '<div><label style="font-size:11.5px">Importo convenzione</label>')
    + '<select style="' + (compatto ? 'margin-bottom:4px; ' : '') + 'width:100%; min-width:120px; padding:6px 8px" onchange="if(this.value!==\'\'){ document.getElementById(\'' + idCampo + '\').value = importoInCampo(this.value); this.value=\'\'; }">'
    + '<option value="">' + (compatto ? 'Scegli importo…' : '— scegli —') + '</option>'
    + l.map(function (x) { return '<option value="' + Number(x.importo) + '">' + esc(etichettaImporto(x)) + (x.predefinito ? ' ★' : '') + '</option>'; }).join('')
    + '</select>' + (compatto ? '' : '</div>');
}

// Modulo di inserimento: pulsanti con gli importi sotto "Fattura"
function mostraImportiFPSModulo(tipo) {
  const box = document.getElementById('f-fps-importi');
  if (!box) return;
  const conv = convenzioneDi(tipo);
  box.style.display = conv ? '' : 'none';
  if (!conv) { box.innerHTML = ''; return; }
  const l = importiConvenzione(conv);
  const attuale = parseImporto(document.getElementById('f-compenso').value);
  box.innerHTML = l.length
    ? '<div style="font-size:11.5px; color:var(--sub); margin-bottom:4px">Importo ' + esc(conv.nome) + ' (tocca per sceglierlo):</div><div class="doc-chips">'
      + l.map(function (x) { return '<span class="doc-chip' + (Number(x.importo) === attuale ? ' presentato' : '') + '" role="button" data-importo="' + Number(x.importo) + '" onclick="scegliImportoFPSModulo(this)">' + esc(etichettaImporto(x)) + '</span>'; }).join('')
      + '</div>'
    : '<div style="font-size:11.5px; color:var(--sub)">Nessun importo impostato per ' + esc(conv.nome) + ' (l\'amministratore li inserisce in Utenti e permessi). La pratica resta a 0 €.</div>';
}
function scegliImportoFPSModulo(chip) {
  const el = document.getElementById('f-compenso');
  el.value = importoInCampo(chip.dataset.importo);
  el.dataset.auto = '';
  document.querySelectorAll('#f-fps-importi .doc-chip').forEach(function (c) { c.classList.toggle('presentato', c === chip); });
}

// Contabilita': un elenco per ogni convenzione con le fatture da inserire
function renderElencoFPS(pratAnno) {
  CONVENZIONI.forEach(function (conv) { renderElencoConvenzione(conv, pratAnno); });
}
function renderElencoConvenzione(conv, pratAnno) {
  const box = document.getElementById('elenco-' + conv.chiave);
  if (!box) return;
  if (box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT' && document.activeElement.type !== 'checkbox') return;
  const tutte = (pratAnno || []).filter(function (p) { return conv.re.test(String(p.tipo || '').toUpperCase()); }).sort(function (a, b) { return a.numero - b.numero; });
  const visibile = tutte.length && (typeof vedeSezioneContabilita !== 'function' || vedeSezioneContabilita('cont_economici'));
  box.style.display = visibile ? '' : 'none';
  if (!visibile) { box.innerHTML = ''; return; }
  const k = conv.chiave;
  const daFatturare = tutte.filter(senzaFattura);
  const lista = CONV_SOLO_DA_FATTURARE[k] ? daFatturare : tutte;
  const totFatt = tutte.reduce(function (t, p) { return t + Number(p.compenso || 0); }, 0);
  const inp = 'style="width:100%; min-width:80px; padding:6px 8px"';
  box.innerHTML = '<div class="raff-title" style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap">'
    + '<span>🧾 ' + esc(conv.nome) + ' – fatture da inserire</span>'
    + '<span style="font-size:12.5px; font-weight:600; color:var(--sub)">' + tutte.length + ' pratiche · <b style="color:' + (daFatturare.length ? '#c0392b' : '#1a7f37') + '">' + daFatturare.length + ' senza fattura</b> · fatturato ' + fmtEuro(totFatt) + '</span></div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:8px">Le pratiche senza importo entrano in contabilità a 0 €. Quando arriva la fattura inserisci qui importo e numero: la contabilità si aggiorna da sola.</div>'
    + '<label style="display:flex; align-items:center; gap:8px; font-size:13px; margin:0 0 8px; cursor:pointer"><input type="checkbox" style="width:auto" ' + (CONV_SOLO_DA_FATTURARE[k] ? 'checked' : '') + ' onchange="CONV_SOLO_DA_FATTURARE[\'' + k + '\']=this.checked; render()"> Mostra solo quelle senza fattura</label>'
    + (lista.length ? '<div style="display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; padding:8px 10px; border-radius:10px; background:var(--bg); border:1px solid var(--line); margin-bottom:8px">'
      + '<div style="font-size:12.5px; font-weight:700; align-self:center">Per tutte le selezionate:</div>'
      + selectImporti(conv, k + '-imp-tutte')
      + '<div><label style="font-size:11.5px">Importo (€)</label><input id="' + k + '-imp-tutte" inputmode="decimal" placeholder="0,00" oninput="filtraImporto(this)" onblur="formattaCampoImporto(this)" ' + inp + '></div>'
      + '<div><label style="font-size:11.5px">N. fattura</label><input id="' + k + '-nf-tutte" ' + inp + '></div>'
      + '<button type="button" class="btn-add" style="margin:0" onclick="applicaFatturaSelezionate(\'' + k + '\')">Applica alle selezionate</button></div>' : '')
    + '<div class="tab-wrap"><table class="tab-proto"><thead><tr><th style="width:30px"><input type="checkbox" style="width:auto" title="Seleziona tutte" onchange="document.querySelectorAll(\'#elenco-' + k + ' input[data-sel]\').forEach(function(c){ c.checked = this.checked; }, this)"></th><th>N.</th><th>Contribuente</th><th>Stato</th><th>Fattura (€)</th><th>N. fattura</th><th></th></tr></thead><tbody>'
    + (lista.length ? lista.map(function (p) {
      return '<tr><td><input type="checkbox" style="width:auto" data-sel="' + p.id + '"></td><td class="n">' + esc(formattaProtocollo(p)) + '</td><td class="wrap">' + esc(p.nome || '') + (p.congiunta ? '<div class="sub2">Congiunta: ' + esc(p.congiunta) + '</div>' : '') + '</td>'
        + '<td>' + esc(statoLabel(p.stato)) + '</td>'
        + '<td>' + selectImporti(conv, k + '-imp-' + p.id, true) + '<input id="' + k + '-imp-' + p.id + '" inputmode="decimal" placeholder="0,00" value="' + (Number(p.compenso) ? importoInCampo(p.compenso) : '') + '" oninput="filtraImporto(this)" onblur="formattaCampoImporto(this)" ' + inp + '></td>'
        + '<td><input id="' + k + '-nf-' + p.id + '" value="' + esc(p.numFattura || '') + '" ' + inp + '></td>'
        + '<td><button type="button" style="background:var(--accent); color:var(--accent-ink); border:none; border-radius:6px; padding:6px 10px; cursor:pointer" onclick="salvaFatturaConvenzione(\'' + k + '\', \'' + p.id + '\')">💾 Salva</button></td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty">' + (CONV_SOLO_DA_FATTURARE[k] ? '✓ Tutte le pratiche ' + esc(conv.nome) + ' hanno la fattura' : 'Nessuna pratica') + '</td></tr>')
    + '</tbody></table></div>';
}
async function scriviFatturaConvenzione(id, importoTesto, numero) {
  const imp = parseImporto(importoTesto);
  const campi = { compenso: isNaN(imp) ? 0 : imp, numFattura: String(numero || '').trim() };
  campi.fatt = campi.numFattura ? 'fatturata' : 'dafatturare';
  return data.pratiche.aggiorna(id, campi);
}
async function salvaFatturaConvenzione(k, id) {
  const imp = document.getElementById(k + '-imp-' + id).value, nf = document.getElementById(k + '-nf-' + id).value;
  if (!imp.trim() && !nf.trim()) { avviso('❌ Inserisci l\'importo o il numero della fattura', true); return; }
  if (document.activeElement) document.activeElement.blur();
  const esito = await scriviFatturaConvenzione(id, imp, nf);
  if (esito && esito.error) return;
  avviso('✓ Fattura salvata');
  render();
}
async function applicaFatturaSelezionate(k) {
  const ids = Array.from(document.querySelectorAll('#elenco-' + k + ' input[data-sel]:checked')).map(function (c) { return c.dataset.sel; });
  const imp = document.getElementById(k + '-imp-tutte').value, nf = document.getElementById(k + '-nf-tutte').value;
  if (!ids.length) { avviso('❌ Seleziona almeno una pratica', true); return; }
  if (!imp.trim() && !nf.trim()) { avviso('❌ Inserisci l\'importo o il numero della fattura', true); return; }
  if (!confirm('Applicare ' + (imp ? 'importo ' + imp + ' €' : '') + (imp && nf ? ' e ' : '') + (nf ? 'fattura n. ' + nf : '') + ' a ' + ids.length + ' pratiche ' + convenzione(k).nome + '?')) return;
  if (document.activeElement) document.activeElement.blur();
  for (const id of ids) { await scriviFatturaConvenzione(id, imp, nf); }
  avviso('✓ Fattura applicata a ' + ids.length + (ids.length === 1 ? ' pratica' : ' pratiche'));
  render();
}

// Editor degli importi (solo amministratore) in Utenti e permessi
const IMPORTI_IN_MODIFICA = {};
function renderEditorImportiFPS() { CONVENZIONI.forEach(function (c) { renderEditorImporti(c.chiave); }); }
function renderEditorImporti(k) {
  const box = document.getElementById(k + '-importi-editor');
  if (!box) return;
  const conv = convenzione(k);
  if (!IMPORTI_IN_MODIFICA[k]) IMPORTI_IN_MODIFICA[k] = importiConvenzione(conv).map(function (x) { return { descrizione: x.descrizione || '', importo: importoInCampo(x.importo), predefinito: !!x.predefinito }; });
  const righe = IMPORTI_IN_MODIFICA[k];
  const rif = 'IMPORTI_IN_MODIFICA[\'' + k + '\']';
  box.innerHTML = (righe.length ? righe.map(function (r, i) {
    return '<div style="display:flex; gap:8px; align-items:center; margin-bottom:6px; flex-wrap:wrap">'
      + '<input placeholder="Descrizione (es. 730 singolo)" value="' + esc(r.descrizione) + '" oninput="' + rif + '[' + i + '].descrizione=this.value" style="flex:2; min-width:150px">'
      + '<input placeholder="0,00" inputmode="decimal" value="' + esc(r.importo) + '" oninput="filtraImporto(this); ' + rif + '[' + i + '].importo=this.value" onblur="formattaCampoImporto(this); ' + rif + '[' + i + '].importo=this.value" style="flex:1; min-width:90px">'
      + '<label title="Si compila da solo quando scegli il tipo di pratica" style="display:flex; align-items:center; gap:4px; font-size:12.5px; margin:0; cursor:pointer; white-space:nowrap"><input type="radio" name="pred-' + k + '" style="width:auto" ' + (r.predefinito ? 'checked' : '') + ' onchange="' + rif + '.forEach(function(x, j){ x.predefinito = j === ' + i + '; })"> ★ predefinito</label>'
      + '<button type="button" title="Togli" style="background:none; border:none; color:#c0392b; font-weight:800; font-size:16px; cursor:pointer" onclick="' + rif + '.splice(' + i + ',1); renderEditorImporti(\'' + k + '\')">✕</button></div>';
  }).join('') : '<div class="empty" style="margin-bottom:8px">Nessun importo impostato</div>')
    + '<div style="display:flex; gap:8px; flex-wrap:wrap"><button type="button" class="btn-add" style="background:var(--line); color:var(--ink); margin:0" onclick="' + rif + '.push({descrizione:\'\', importo:\'\', predefinito:false}); renderEditorImporti(\'' + k + '\')">+ Aggiungi importo</button>'
    + (righe.some(function (r) { return r.predefinito; }) ? '<button type="button" class="btn-add" style="background:var(--line); color:var(--ink); margin:0" onclick="' + rif + '.forEach(function(x){ x.predefinito = false; }); renderEditorImporti(\'' + k + '\')">Nessun predefinito (resta a 0 €)</button>' : '')
    + '<button type="button" class="btn-add" style="margin:0" onclick="salvaImporti(\'' + k + '\')">💾 Salva importi</button></div>';
}
async function salvaImporti(k) {
  const conv = convenzione(k);
  const lista = [];
  for (const r of IMPORTI_IN_MODIFICA[k] || []) {
    if (!String(r.importo).trim() && !String(r.descrizione).trim()) continue;
    const n = parseImporto(r.importo);
    if (isNaN(n)) { avviso('❌ Importo non valido: ' + (r.descrizione || r.importo), true); return; }
    lista.push({ descrizione: String(r.descrizione || '').trim(), importo: n, predefinito: !!r.predefinito });
  }
  const valore = JSON.stringify(lista);
  const { data: righe, error } = await supabase.from('impostazioni').update({ valore: valore, aggiornato_il: new Date().toISOString() }).eq('chiave', conv.impostazione).select('chiave');
  if (error || !righe || !righe.length) { avviso('❌ Importi non salvati' + (error ? ': ' + error.message : ''), true); return; }
  IMPOSTAZIONI[conv.impostazione] = valore;
  IMPORTI_IN_MODIFICA[k] = null;
  renderEditorImporti(k);
  mostraImportiFPSModulo(document.getElementById('f-tipo').value);
  render();
  avviso('✓ Importi ' + conv.nome + ' salvati');
}
