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
      + riga('Note', p.note)
      + '</table>'
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
  renderBackup();
  renderStoricoGlobale();
}
