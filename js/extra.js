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
  const html = ricevutaHTML(p, false);
  w.document.open(); w.document.write(html); w.document.close();
}
// Pagina della ricevuta: per la stampa due copie (cliente e CAF), per l'e-mail solo quella del cliente
function ricevutaHTML(p, perEmail) {
  const logo = document.querySelector('.hero-logo');
  const caf = (typeof datiCafStampa === 'function') ? datiCafStampa() : {};
  const doc = documentiPratica(p);
  // le richieste CUD sono interne al CAF: non vanno sulla ricevuta del cliente
  if (typeof senzaCUD === 'function') { doc.presentati = senzaCUD(doc.presentati); doc.mancanti = senzaCUD(doc.mancanti); }
  const riga = function (etichetta, valore) { return valore ? '<tr><th>' + etichetta + '</th><td>' + esc(valore) + '</td></tr>' : ''; };
  const copia = function (perChi) {
    return '<div class="ric">'
      + '<div class="testa">' + (logo ? '<img src="' + (perEmail ? location.origin + location.pathname.replace(/[^\/]*$/, '') + 'icone/icona-192.png' : logo.src) + '" alt="">' : '') + '<div><h1>CAF CISL – Sede di Alì Terme</h1>'
      + '<div class="caf">' + [caf.indirizzo ? '📍 ' + esc(caf.indirizzo) : '', caf.telefono ? '📞 ' + esc(caf.telefono) : '', caf.email ? '✉️ ' + esc(caf.email) : ''].filter(Boolean).join(' · ') + '</div></div>'
      + '<div class="copia">' + perChi + '</div></div>'
      + '<div class="titolo">RICEVUTA DI PRESA IN CARICO</div>'
      + '<div class="proto">Protocollo n. <b>' + esc(formattaProtocollo(p)) + '</b> del ' + esc(p.data || '') + '</div>'
      + '<table>'
      + riga('Contribuente', p.nome) + riga('Nato/a il', p.cf) + riga('Codice fiscale', p.codiceFiscale)
      + riga('Coniuge (congiunta)', p.congiunta ? p.congiunta + (p.congData ? ' – nato/a il ' + p.congData : '') : '')
      + riga('Tipo di pratica', p.tipo)
      + riga('Importo', Number(p.compenso) ? fmtEuro(p.compenso) : '') + riga('Pagato', Number(p.pagato) ? fmtEuro(p.pagato) + (p.metodoPagamento ? ' – ' + p.metodoPagamento : '') : '')
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
    + (perEmail ? copia('Copia per il cliente') + '</body></html>'
      : '<div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button><button class="chiudi" onclick="window.close()">Chiudi</button></div>'
      + copia('Copia per il cliente') + '<hr class="taglio">' + copia('Copia per il CAF')
      + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
  return html;
}

/* ---------------- Storico delle modifiche ---------------- */

const ETICHETTE_CAMPI = {
  nome: 'Nominativo', stato: 'Stato', tipo: 'Tipo pratica', telefono: 'Cellulare', telefono_fisso: 'Telefono fisso',
  compenso: 'Fattura', pagato: 'Pagato', metodo_pagamento: 'Tipo di pagamento', annullata: 'Annullata', annullata_motivo: 'Motivo annullamento', data: 'Data apertura', data_fine: 'Fine lavorazione', note: 'Note',
  num_fattura: 'N. fattura', data_fattura: 'Data fattura', fatt: 'Fatturazione', cf: 'Data di nascita', codice_fiscale: 'Codice fiscale',
  congiunta: 'Congiunta', cong_cognome: 'Cognome coniuge', cong_nome: 'Nome coniuge', cong_data: 'Nascita coniuge',
  cong_codice_fiscale: 'CF coniuge', cong_telefono: 'Cellulare coniuge', scadenza_assistenza: 'Scadenza assistenza',
  whatsapp_inviato: 'Avviso WhatsApp', inserito_da: 'Inserito da', numero: 'Numero', anno: 'Anno',
};
function valoreStorico(campo, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (campo === 'stato') return statoLabel(v);
  if (campo === 'annullata') return v === true || v === 'true' ? 'SÌ' : 'NO';
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

const NOMI_BACKUP = { fine_anno: '🎆 Fine anno (31/12, conservato per sempre)', settimanale: '🗓️ Settimanale', manuale: '💾 Manuale', prima_di_svuotare: '🛡️ Prima di svuotare il registro', prima_di_importare: '🛡️ Prima di importare un backup' };
async function renderBackup() {
  const box = document.getElementById('backup-lista');
  if (!box) return;
  sincronizzaCartellaBackup(false);
  const { data, ok } = await fetchSupabase('/rest/v1/backup_automatici?select=id,creato_il,tipo,creato_da,n_pratiche&order=creato_il.desc');
  if (!ok || !Array.isArray(data)) { box.innerHTML = '<div class="empty">Elenco dei backup non disponibile</div>'; return; }
  const perAnno = ultimiBackupPerAnno(data);
  const bottoniAnno = Object.keys(perAnno).sort().reverse().map(function (anno) {
    return '<button type="button" style="background:#1d4f91; color:#fff; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; font-size:13px; font-weight:700" onclick="scaricaSalvataggiAnno(' + Number(perAnno[anno].id) + ', ' + Number(anno) + ')" title="Ultimo backup del ' + anno + ' (' + esc(quandoStorico(perAnno[anno].creato_il)) + ')">⬇️ ' + nomeFileAnno(anno) + '</button>';
  }).join(' ');
  box.innerHTML = (bottoniAnno ? '<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-bottom:8px"><span style="font-size:12.5px; font-weight:700">📦 Salvataggi per anno:</span>' + bottoniAnno + '</div>' : '') + (data.length ? data.map(function (b) {
    return '<div style="display:flex; align-items:center; gap:10px; padding:7px 0; border-bottom:1px solid var(--line); font-size:13px; flex-wrap:wrap">'
      + '<span style="flex:1; min-width:200px"><b>' + esc(quandoStorico(b.creato_il)) + '</b> · ' + esc(NOMI_BACKUP[b.tipo] || b.tipo) + ' <span style="color:var(--sub)">(' + (b.n_pratiche || 0) + ' pratiche' + (b.creato_da ? ', ' + esc(b.creato_da) : '') + ')</span></span>'
      + '<button type="button" style="background:var(--line); color:var(--ink); border:none; border-radius:8px; padding:5px 12px; cursor:pointer" onclick="scaricaBackup(' + Number(b.id) + ')">⬇️ Scarica</button>'
      + '<button type="button" title="Rimetti tutti i dati come erano in questo backup" style="background:#fdf1e6; color:#b35f0c; border:1px solid #b35f0c; border-radius:8px; padding:5px 12px; cursor:pointer; font-weight:700" onclick="ripristinaBackupServer(' + Number(b.id) + ', \'' + esc(quandoStorico(b.creato_il)) + '\')">↩️ Ripristina</button>'
      + '<button type="button" title="Elimina questo backup" style="background:var(--line); color:#c0392b; border:none; border-radius:8px; padding:5px 10px; cursor:pointer" onclick="eliminaBackup(' + Number(b.id) + ', \'' + esc(quandoStorico(b.creato_il)) + '\')">🗑️</button></div>';
  }).join('') : '<div class="empty">Nessun backup ancora</div>');
}
async function scaricaSalvataggiAnno(id, anno) {
  const f = await preparaBackup(id);
  if (!f) { avviso('❌ Backup non trovato', true); return; }
  const url = URL.createObjectURL(new Blob([f.testo], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = nomeFileAnno(anno);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
}
async function eliminaBackup(id, quando) {
  if (!confirm('Eliminare il backup del ' + quando + '?\nNon si potrà recuperare.')) return;
  const { data: righe, error } = await supabase.from('backup_automatici').delete().eq('id', Number(id)).select('id');
  if (error || !righe || !righe.length) { avviso('❌ Backup non eliminato' + (error ? ': ' + error.message : ''), true); return; }
  avviso('🗑️ Backup eliminato');
  renderBackup();
}
// Ripristino completo da un backup del server (tutti gli anni, tutti i campi); prima salva i dati attuali
async function ripristinaBackupServer(id, quando) {
  const ok = await chiediConfermaScritta('Ripristina il backup del ' + quando, 'Tutti i dati attuali (pratiche di tutti gli anni, versamenti, clienti, scadenze, spese sede, acconti, tipi e impostazioni) verranno sostituiti con quelli del backup del ' + quando + '. Prima il programma salva una copia dei dati di adesso in "Backup automatici".', 'RIPRISTINA');
  if (!ok) return;
  let { data: esito, error } = await supabase.rpc('ripristina_backup', { p_id: Number(id) });
  if (error && /could not find|does not exist|schema cache/i.test(error.message)) {
    // la funzione del database non c'e': il ripristino lo fa il programma
    const attesa = mostraAttesaRipristino();
    try {
      const { data: righe, error: e1 } = await supabase.from('backup_automatici').select('dati').eq('id', Number(id)).single();
      if (e1 || !righe || !righe.dati) throw new Error('backup non trovato');
      const { error: e2 } = await supabase.rpc('crea_backup', { p_tipo: 'prima_di_importare' });
      if (e2) throw new Error('copia di sicurezza non riuscita: ' + e2.message);
      esito = await window.data.admin.ripristinoCompleto(righe.dati, function (t) { attesa.testo(t); });
      error = null;
    } catch (e) { error = { message: e.message + ' — i dati di prima sono nel backup "Prima di importare un backup"' }; }
    attesa.chiudi();
  }
  if (error) { avviso('❌ Ripristino non riuscito: ' + error.message, true); renderBackup(); return; }
  avviso('✓ Backup ripristinato: ' + ((esito && esito.pratiche) || 0) + ' pratiche');
  if (typeof caricaTutto === 'function') await caricaTutto();
  if (typeof render === 'function') render();
  renderBackup();
}
function mostraAttesaRipristino() {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed; inset:0; z-index:500; background:rgba(15,27,45,.55); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; padding:20px 24px; max-width:380px; text-align:center"><div style="font-size:28px">⏳</div><div style="font-weight:800; margin:6px 0">Ripristino in corso</div><div class="att" style="font-size:13px; color:var(--sub)">Non chiudere la pagina…</div></div>';
  document.body.appendChild(ov);
  return { testo: function (t) { const el = ov.querySelector('.att'); if (el) el.textContent = t + ' Non chiudere la pagina.'; }, chiudi: function () { ov.remove(); } };
}
async function creaBackupOra() {
  const { error } = await supabase.rpc('crea_backup', { p_tipo: 'manuale' });
  if (error) { avviso('❌ Backup non riuscito: ' + error.message, true); return; }
  avviso('✓ Backup creato');
  renderBackup();
}
// Prepara il file di un backup del server (stesso formato di "Esporta backup")
async function preparaBackup(id) {
  const { data, ok } = await fetchSupabase('/rest/v1/backup_automatici?select=creato_il,tipo,dati&id=eq.' + Number(id));
  if (!ok || !data || !data.length) return null;
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
    speseSede: s.spesaSede ? mappa(d.spese_sede, s.spesaSede) : (d.spese_sede || []),
    acconti: s.acconto ? mappa(d.acconti, s.acconto) : (d.acconti || []),
    // copia esatta di tutte le tabelle: serve per il ripristino completo (tutti gli anni, tutti i campi)
    datiCompleti: d,
  };
  return { nome: nomeFileBackup(data[0]), testo: JSON.stringify(payload, null, 2) };
}
function nomeFileBackup(b) {
  const d = new Date(b.creato_il);
  const due = function (n) { return String(n).padStart(2, '0'); };
  return 'backup-caf-' + d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate()) + '-' + due(d.getHours()) + due(d.getMinutes()) + (b.tipo ? '-' + b.tipo : '') + '.json';
}
async function scaricaBackup(id) {
  const f = await preparaBackup(id);
  if (!f) { avviso('❌ Backup non trovato', true); return; }
  const blob = new Blob([f.testo], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = f.nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
}

/* --- Cartella dei backup sul PC (es. la cartella Dropbox): il programma ci salva i file da solo --- */
// Funziona con Chrome o Edge sul computer. La cartella scelta si ricorda (IndexedDB) su quel PC.
function dbCartella() {
  return new Promise(function (ok, ko) {
    const r = indexedDB.open('caf-backup', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('h'); };
    r.onsuccess = function () { ok(r.result); };
    r.onerror = function () { ko(r.error); };
  });
}
async function leggiCartellaBackup() {
  try { const db = await dbCartella(); return await new Promise(function (ok) { const q = db.transaction('h').objectStore('h').get('cartella'); q.onsuccess = function () { ok(q.result || null); }; q.onerror = function () { ok(null); }; }); } catch (e) { return null; }
}
async function scriviCartellaBackup(h) {
  try { const db = await dbCartella(); await new Promise(function (ok) { const t = db.transaction('h', 'readwrite'); if (h) t.objectStore('h').put(h, 'cartella'); else t.objectStore('h').delete('cartella'); t.oncomplete = ok; t.onerror = ok; }); } catch (e) {}
}
async function permessoCartella(h, chiedi) {
  try {
    if (await h.queryPermission({ mode: 'readwrite' }) === 'granted') return true;
    return chiedi ? (await h.requestPermission({ mode: 'readwrite' })) === 'granted' : false;
  } catch (e) { return false; }
}
async function scegliCartellaBackup() {
  if (!window.showDirectoryPicker) { alert('Per salvare direttamente in una cartella usa Google Chrome o Microsoft Edge sul computer.'); return; }
  let h;
  try { h = await window.showDirectoryPicker({ id: 'backup-caf', mode: 'readwrite' }); } catch (e) { return; }
  if (!(await permessoCartella(h, true))) { avviso('❌ Permesso sulla cartella non concesso', true); return; }
  await scriviCartellaBackup(h);
  avviso('✓ Cartella dei backup: ' + h.name);
  await sincronizzaCartellaBackup(true);
}
async function dimenticaCartellaBackup() {
  if (!confirm('Non salvare più i backup nella cartella di questo PC?')) return;
  await scriviCartellaBackup(null);
  renderBackup();
}
// Nella cartella c'e' un solo file, sempre lo stesso nome: si riscrive con il backup piu' recente
// Nella cartella c'e' un file per anno, "salvataggi-2026.json": durante l'anno viene riscritto con il backup
// piu' recente di quell'anno; finito l'anno resta com'e' (= salvataggio completo al 31 dicembre) e si passa al file nuovo
function nomeFileAnno(anno) { return 'salvataggi-' + anno + '.json'; }
const NOME_FILE_COMPLETO = 'backup-completo.json';
function annoBackup(b) { return new Date(b.creato_il).getFullYear(); }
// l'ultimo backup di ogni anno (l'elenco arriva dal piu' recente)
function ultimiBackupPerAnno(lista) {
  const per = {};
  (lista || []).forEach(function (b) { const a = annoBackup(b); if (!per[a]) per[a] = b; });
  return per;
}
let SINCRO_BACKUP_IN_CORSO = false;
async function sincronizzaCartellaBackup(chiedi) {
  if (SINCRO_BACKUP_IN_CORSO) return;
  const h = await leggiCartellaBackup();
  if (!h || !(await permessoCartella(h, chiedi))) { disegnaStatoCartella(); return; }
  SINCRO_BACKUP_IN_CORSO = true;
  const scritti = []; let errore = '';
  try {
    const { data, ok } = await fetchSupabase('/rest/v1/backup_automatici?select=id,creato_il,tipo&order=creato_il.desc');
    if (ok && Array.isArray(data)) {
      // un file unico, sempre con il backup completo piu' recente (tutti gli anni): e' quello da usare per ripristinare
      if (data.length) {
        const ult = data[0], chiaveU = 'backup-completo-ultimo';
        let giaU = ''; try { giaU = localStorage.getItem(chiaveU) || ''; } catch (e) {}
        let esisteU = true; try { await h.getFileHandle(NOME_FILE_COMPLETO); } catch (e) { esisteU = false; }
        if (chiedi || !esisteU || giaU !== String(ult.id) + '|' + ult.creato_il) {
          const fU = await preparaBackup(ult.id);
          if (fU) {
            const fhU = await h.getFileHandle(NOME_FILE_COMPLETO, { create: true });
            const wU = await fhU.createWritable(); await wU.write(fU.testo); await wU.close();
            scritti.push(NOME_FILE_COMPLETO);
            try { localStorage.setItem(chiaveU, String(ult.id) + '|' + ult.creato_il); } catch (e) {}
          }
        }
      }
      const per = ultimiBackupPerAnno(data);
      for (const anno of Object.keys(per)) {
        const b = per[anno], nome = nomeFileAnno(anno), chiave = 'backup-anno-' + anno;
        let gia = '';
        try { gia = localStorage.getItem(chiave) || ''; } catch (e) {}
        let esiste = true;
        try { await h.getFileHandle(nome); } catch (e) { esiste = false; }
        if (!(chiedi || !esiste || gia !== String(b.id) + '|' + b.creato_il)) continue;
        const f = await preparaBackup(b.id);
        if (!f) continue;
        const fh = await h.getFileHandle(nome, { create: true });
        const w = await fh.createWritable();
        await w.write(f.testo); await w.close();
        scritti.push(nome);
        try { localStorage.setItem(chiave, String(b.id) + '|' + b.creato_il); localStorage.setItem('backup-cartella-data-' + anno, b.creato_il); } catch (e) {}
      }
    }
  } catch (e) { errore = e.message || String(e); }
  SINCRO_BACKUP_IN_CORSO = false;
  try { localStorage.setItem('backup-cartella-ultimo', new Date().toISOString()); } catch (e) {}
  if (errore) avviso('❌ Backup nella cartella non salvato: ' + errore, true);
  else if (scritti.length || chiedi) avviso('✓ ' + h.name + ': ' + (scritti.length ? scritti.join(', ') + ' aggiornato' : 'salvataggi già aggiornati'));
  disegnaStatoCartella();
  if (typeof controllaAvvisoBackupCartella === 'function') controllaAvvisoBackupCartella();
}
function dataCopiato(anno) { try { return localStorage.getItem('backup-cartella-data-' + (anno || new Date().getFullYear())) || ''; } catch (e) { return ''; } }
async function disegnaStatoCartella() {
  const box = document.getElementById('backup-cartella');
  if (!box) return;
  const stile = 'background:var(--line); color:var(--ink); border:none; border-radius:8px; padding:6px 12px; cursor:pointer; font-size:13px';
  if (!window.showDirectoryPicker) {
    box.innerHTML = '<div style="font-size:12.5px; color:var(--sub)">📁 Per salvare i backup direttamente in una cartella (es. Dropbox) apri il programma con <b>Chrome</b> o <b>Edge</b> sul computer.</div>';
    return;
  }
  const h = await leggiCartellaBackup();
  if (!h) {
    box.innerHTML = '<div style="padding:10px 12px; border-radius:10px; border:2px dashed #0061fe">'
      + '<div style="font-weight:800; color:#0061fe; margin-bottom:4px">📁 Salva i backup in una cartella del PC (es. Dropbox)</div>'
      + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:8px">Scegli una volta la cartella, per esempio <b>Dropbox › Backup CAF</b>: il programma ci terrà <b>un file per anno</b>, per esempio <b>salvataggi-2026.json</b>, riscritto durante l\'anno con il backup più recente; finito l\'anno resta il salvataggio completo dell\'anno. Dropbox lo porterà nel cloud.</div>'
      + '<button type="button" style="background:#0061fe; color:#fff; border:none; border-radius:8px; padding:7px 14px; cursor:pointer; font-weight:700" onclick="scegliCartellaBackup()">📁 Scegli la cartella</button></div>';
    return;
  }
  const attiva = await permessoCartella(h, false);
  let ultimo = '';
  try { ultimo = localStorage.getItem('backup-cartella-ultimo') || ''; } catch (e) {}
  box.innerHTML = '<div style="padding:10px 12px; border-radius:10px; border:2px solid ' + (attiva ? '#1a7f37' : '#b35f0c') + '">'
    + '<div style="font-weight:800; color:' + (attiva ? '#1a7f37' : '#b35f0c') + '">📁 Cartella dei backup: ' + esc(h.name) + (attiva ? ' ✓' : '') + '</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin:2px 0 8px">' + (attiva
      ? 'Qui c\'è <b>' + NOME_FILE_COMPLETO + '</b>, sempre aggiornato con il backup più recente di <b>tutti gli anni</b> (è quello da usare per ripristinare tutto), e un file per anno (<b>' + nomeFileAnno(new Date().getFullYear()) + '</b>…) che a fine anno resta come fotografia al 31 dicembre. Ogni file contiene tutti i dati, non solo quell\'anno.' + (dataCopiato() ? ' Ultimo aggiornamento: backup del <b>' + esc(quandoStorico(dataCopiato())) + '</b>.' : '')
      : 'Il browser chiede di riconfermare l\'accesso alla cartella: premi "Riattiva" e poi "Consenti".') + '</div>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap">'
    + (attiva ? '<button type="button" style="' + stile + '" onclick="sincronizzaCartellaBackup(true)">🔄 Aggiorna ora i salvataggi</button>'
      : '<button type="button" style="background:#b35f0c; color:#fff; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; font-weight:700" onclick="sincronizzaCartellaBackup(true)">🔓 Riattiva</button>')
    + '<button type="button" style="' + stile + '" onclick="scegliCartellaBackup()">Cambia cartella</button>'
    + '<button type="button" style="' + stile + '" onclick="dimenticaCartellaBackup()">Non usare più</button></div></div>';
}
function renderBackupEStorico() {
  if (typeof isAdmin === 'function' && !isAdmin()) return;
  renderEditorImportiFPS();
  renderBackup();
  renderStoricoGlobale();
  preparaSvuotaAnno();
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
function categoriaModulo() { const c = document.getElementById('f-congiunta-on'); return c && c.checked ? 'congiunta' : 'singola'; }
function valePer(x, cat) { return !x.applica || x.applica === 'tutte' || x.applica === cat; }
function importoAutomaticoConvenzione(tipo, cat) {
  const conv = convenzioneDi(tipo);
  if (!conv) return undefined;
  cat = cat || categoriaModulo();
  const l = importiConvenzione(conv).filter(function (x) { return x.predefinito; });
  const pred = l.find(function (x) { return x.applica === cat; }) || l.find(function (x) { return valePer(x, cat); });
  return pred ? Number(pred.importo) : 0;
}
const NOMI_APPLICA = { singola: 'singola', congiunta: 'congiunta' };
function etichettaImporto(x) {
  const extra = [NOMI_APPLICA[x.applica], x.reddito].filter(Boolean).join(', ');
  return (x.descrizione ? x.descrizione : '') + (extra ? (x.descrizione ? ' ' : '') + '(' + extra + ')' : '') + (x.descrizione || extra ? ' – ' : '') + fmtEuro(x.importo);
}
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
  const cat = categoriaModulo();
  const l = importiConvenzione(conv).filter(function (x) { return valePer(x, cat); });
  const attuale = parseImporto(document.getElementById('f-compenso').value);
  box.innerHTML = l.length
    ? '<div style="font-size:11.5px; color:var(--sub); margin-bottom:4px">Importo ' + esc(conv.nome) + ' – dichiarazione <b>' + cat + '</b> (tocca per sceglierlo):</div><div class="doc-chips">'
      + l.map(function (x) { return '<span class="doc-chip' + (Number(x.importo) === attuale ? ' presentato' : '') + '" role="button" data-importo="' + Number(x.importo) + '" onclick="scegliImportoFPSModulo(this)">' + esc(etichettaImporto(x)) + '</span>'; }).join('')
      + '</div>'
    : '<div style="font-size:11.5px; color:var(--sub)">Nessun importo impostato per ' + esc(conv.nome) + ' (dichiarazione ' + cat + '): l\'amministratore li inserisce in Utenti e permessi. La pratica resta a 0 €.</div>';
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
  if (!IMPORTI_IN_MODIFICA[k]) IMPORTI_IN_MODIFICA[k] = importiConvenzione(conv).map(function (x) { return { descrizione: x.descrizione || '', importo: importoInCampo(x.importo), applica: x.applica || 'tutte', reddito: x.reddito || '', predefinito: !!x.predefinito }; });
  const righe = IMPORTI_IN_MODIFICA[k];
  const rif = 'IMPORTI_IN_MODIFICA[\'' + k + '\']';
  const campo = 'padding:7px 9px; width:100%';
  // ogni campo ha la sua etichetta: sul telefono le colonne vanno a capo e non si confondono
  const cella = function (etichetta, html) { return '<label class="imp-cella" style="margin:0; display:block"><span class="imp-cap">' + etichetta + '</span>' + html + '</label>'; };
  box.innerHTML = (righe.length
    ? righe.map(function (r, i) {
        return '<div class="importi-griglia" data-riga="' + i + '" style="display:grid; grid-template-columns:minmax(120px,2fr) minmax(90px,1fr) minmax(110px,1fr) minmax(130px,1.6fr) auto auto; gap:6px 8px; align-items:end; margin-bottom:8px; padding:8px; border:1px solid var(--line); border-radius:10px">'
          + cella('Descrizione', '<input placeholder="es. 730 base" value="' + esc(r.descrizione) + '" oninput="' + rif + '[' + i + '].descrizione=this.value" style="' + campo + '">')
          + cella('Importo €', '<input class="imp-importo" placeholder="es. 15,00" inputmode="decimal" value="' + esc(r.importo) + '" oninput="filtraImporto(this); this.style.borderColor=\'\'; ' + rif + '[' + i + '].importo=this.value" onblur="formattaCampoImporto(this); ' + rif + '[' + i + '].importo=this.value" style="' + campo + '; font-weight:700">')
          + cella('Dichiarazione', '<select onchange="' + rif + '[' + i + '].applica=this.value; correggiPredefiniti(\'' + k + '\', ' + i + ')" style="' + campo + '">'
            + [['tutte', 'Tutte'], ['singola', 'Singola'], ['congiunta', 'Congiunta']].map(function (o) { return '<option value="' + o[0] + '"' + (r.applica === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>')
          + cella('Fascia di reddito (facoltativa)', '<input placeholder="es. fino a 15.000 €" value="' + esc(r.reddito) + '" oninput="' + rif + '[' + i + '].reddito=this.value" style="' + campo + '">')
          + '<label title="Si compila da solo quando scegli il tipo di pratica (uno per singola e uno per congiunta)" style="display:flex; align-items:center; gap:4px; font-size:12.5px; margin:0 0 8px; cursor:pointer; white-space:nowrap"><input type="checkbox" style="width:auto" ' + (r.predefinito ? 'checked' : '') + ' onchange="' + rif + '[' + i + '].predefinito=this.checked; correggiPredefiniti(\'' + k + '\', ' + i + ')"> ★ predefinito</label>'
          + '<button type="button" title="Togli" style="background:none; border:none; color:#c0392b; font-weight:800; font-size:16px; cursor:pointer; margin-bottom:6px" onclick="' + rif + '.splice(' + i + ',1); renderEditorImporti(\'' + k + '\')">✕</button></div>';
      }).join('')
    : '<div class="empty" style="margin-bottom:8px">Nessun importo impostato</div>')
    + '<div style="font-size:11.5px; color:var(--sub); margin:2px 0 8px">★ = si compila da solo. Puoi averne uno per le <b>singole</b> e uno per le <b>congiunte</b> (oppure uno per "Tutte"). Gli importi per fascia di reddito si scelgono a mano dai pulsanti.</div>'
    + '<div style="display:flex; gap:8px; flex-wrap:wrap"><button type="button" class="btn-add" style="background:var(--line); color:var(--ink); margin:0" onclick="' + rif + '.push({descrizione:\'\', importo:\'\', applica:\'tutte\', reddito:\'\', predefinito:false}); renderEditorImporti(\'' + k + '\')">+ Aggiungi importo</button>'
    + '<button type="button" class="btn-add" style="margin:0" onclick="salvaImporti(\'' + k + '\')">💾 Salva importi</button></div>';
}
// Un solo predefinito per ogni tipo di dichiarazione (singola, congiunta, tutte)
function correggiPredefiniti(k, i) {
  const righe = IMPORTI_IN_MODIFICA[k], r = righe[i];
  if (r.predefinito) righe.forEach(function (x, j) { if (j !== i && x.predefinito && (x.applica || 'tutte') === (r.applica || 'tutte')) x.predefinito = false; });
  renderEditorImporti(k);
}
async function salvaImporti(k) {
  const conv = convenzione(k);
  const lista = [];
  // prima si leggono i valori scritti nei campi (anche se non si e' ancora usciti dal campo)
  document.querySelectorAll('#' + k + '-importi-editor .importi-griglia').forEach(function (riga) {
    const r = (IMPORTI_IN_MODIFICA[k] || [])[+riga.dataset.riga];
    const el = riga.querySelector('.imp-importo');
    if (r && el) r.importo = el.value;
  });
  const righeModifica = IMPORTI_IN_MODIFICA[k] || [];
  for (let i = 0; i < righeModifica.length; i++) {
    const r = righeModifica[i];
    const vuota = !String(r.importo).trim() && !String(r.descrizione).trim() && !String(r.reddito || '').trim() && !r.predefinito;
    if (vuota) continue;
    const n = parseImporto(String(r.importo).replace(/[^0-9,.]/g, ''));
    if (isNaN(n)) {
      const el = document.querySelector('#' + k + '-importi-editor .importi-griglia[data-riga="' + i + '"] .imp-importo');
      if (el) { el.style.borderColor = '#c0392b'; el.focus(); }
      avviso('❌ Manca l\'importo nella riga ' + (i + 1) + (r.descrizione ? ' (' + r.descrizione + ')' : '') + ': scrivilo nel campo "Importo €", es. 15,00', true);
      return;
    }
    lista.push({ descrizione: String(r.descrizione || '').trim(), importo: n, applica: r.applica || 'tutte', reddito: String(r.reddito || '').trim(), predefinito: !!r.predefinito });
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

/* ---------------- Invio delle credenziali al nuovo utente ---------------- */

const NOMI_RUOLO = { operatore: 'Operatore', consultazione: 'Sola consultazione', admin: 'Amministratore' };
function messaggioAccesso(u) {
  const link = indirizzoApp() + '?installa=1';
  return 'Ciao ' + nomeProprio(u.nome) + ', ti ho creato l\'accesso al programma *Protocollo CAF CISL Alì Terme*.\n\n'
    + '🔗 Link: ' + link + '\n'
    + '📧 Email: ' + u.email + '\n'
    + '🔑 Password: ' + (u.password || '(quella che ti ho comunicato)') + '\n'
    + '👤 Ruolo: ' + (NOMI_RUOLO[u.ruolo] || 'Operatore') + '\n\n'
    + 'Apri il link dal telefono: si apre la guida per installare l\'app con l\'icona CAF CISL (su iPhone usa Safari). '
    + 'Poi entra con la tua email e la password.';
}
function inviaAccessoUtente(u) {
  const testo = messaggioAccesso(u);
  const vecchio = document.getElementById('popup-accesso');
  if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-accesso';
  ov.style.cssText = 'position:fixed; inset:0; z-index:450; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #2f9e5f; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:22px 24px; max-width:480px; width:100%; max-height:90vh; overflow:auto">'
    + (u.passwordCambiata ? '<div style="text-align:center; font-size:15px; font-weight:800; color:#2f9e5f; margin-bottom:8px">✓ Password di ' + esc(u.nome) + ' cambiata</div>' : '')
    + (u.nuovo ? '<div style="text-align:center"><div style="width:56px; height:56px; margin:0 auto 6px; border-radius:50%; background:#2f9e5f; color:#fff; font-size:30px; line-height:56px; font-weight:800">✓</div>'
      + '<div style="font-size:20px; font-weight:800; color:#2f9e5f">Utente creato</div>'
      + '<div style="font-size:14px; margin:2px 0 12px"><b>' + esc(u.nome) + '</b> · ' + esc(NOMI_RUOLO[u.ruolo] || 'Operatore') + ' · può già accedere</div></div>'
      : '<div style="font-size:19px; font-weight:800; margin-bottom:10px">📨 Invia l\'accesso a ' + esc(u.nome) + '</div>')
    + '<div style="font-size:13px; font-weight:700; margin-bottom:4px">Messaggio da inviare:</div>'
    + '<textarea id="accesso-testo" rows="9" style="width:100%; font-size:13px; line-height:1.4">' + esc(testo) + '</textarea>'
    + (u.password ? '' : '<div style="font-size:12px; color:#b5842a; margin-top:4px">La password non è nel messaggio perché il programma non la conosce (per sicurezza non viene salvata). Per mandarla: chiudi, scrivi una nuova password nella sua scheda e premi <b>Salva</b>: questa finestra si riapre con la password già inserita.</div>')
    + '<div style="display:flex; gap:8px; align-items:flex-end; margin-top:10px; flex-wrap:wrap">'
    + '<div style="flex:1; min-width:160px"><label style="font-size:12px">Cellulare</label><input id="accesso-tel" type="tel" inputmode="tel" value="' + esc(u.telefono || '') + '" placeholder="Numero del nuovo utente"></div>'
    + '<button type="button" data-azione="wa" style="background:#25d366; color:#fff">💬 Invia su WhatsApp</button></div>'
    + '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:10px; flex-wrap:wrap; align-items:center">'
    + '<span style="font-size:12.5px; font-weight:700; align-self:center">✉️ Email con:</span>'
    + '<button type="button" data-azione="dalprogramma" style="background:#00612f; color:#fff; font-weight:800" title="Invia subito dalla casella del CAF aliterme@cafcislsicilia.com">📧 Invia dal programma</button>'
    + '<button type="button" data-azione="email" style="background:#1d4f91; color:#fff" title="Outlook, Mail o il programma di posta del computer">Programma di posta</button>'
    + '<button type="button" data-azione="aruba" style="background:#e2001a; color:#fff; font-weight:800" title="Posta del CAF su Aruba">Aruba Webmail</button>'
    + '<button type="button" data-azione="gmail" style="background:#c5221f; color:#fff" title="Posta Gmail o Google Workspace aperta nel browser">Gmail</button>'
    + '<button type="button" data-azione="outlookweb" style="background:#0f6cbd; color:#fff" title="Posta Outlook / Microsoft 365 aperta nel browser">Outlook web</button>'
    + '<button type="button" data-azione="copia" style="background:var(--line); color:var(--ink)">📋 Copia</button>'
    + '<button type="button" data-azione="chiudi" style="background:var(--line); color:var(--ink)">Chiudi</button></div>'
    + '<div id="aruba-guida" style="display:none; margin-top:12px; padding:12px 14px; border-radius:12px; border:2px solid #e2001a; background:color-mix(in srgb, #e2001a 6%, var(--card))">'
    + '<div style="font-weight:800; color:#e2001a; margin-bottom:6px">📮 Invio con Aruba Webmail</div>'
    + '<div style="font-size:13px; line-height:1.5">Si è aperta la webmail Aruba in un\'altra scheda (entra con la mail del CAF se te lo chiede). Premi <b>Scrivi</b> / <b>Nuovo messaggio</b>, poi usa questi pulsanti e incolla (tasto destro → Incolla, oppure Ctrl+V) nel campo giusto:</div>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px">'
    + '<button type="button" data-copia="dest" style="background:#fff; color:#0f1b2d; border:1.5px solid #e2001a">1. Copia destinatario</button>'
    + '<button type="button" data-copia="ogg" style="background:#fff; color:#0f1b2d; border:1.5px solid #e2001a">2. Copia oggetto</button>'
    + '<button type="button" data-copia="testo" style="background:#fff; color:#0f1b2d; border:1.5px solid #e2001a">3. Copia testo</button>'
    + '<button type="button" data-azione="aruba-apri" style="background:var(--line); color:var(--ink)">Riapri webmail</button></div></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', async function (e) {
    const c = e.target.closest('button[data-copia]');
    if (c) {
      const valori = { dest: u.email || '', ogg: 'Accesso al programma CAF CISL Alì Terme', testo: document.getElementById('accesso-testo').value.replace(/\*/g, '') };
      const etichetta = c.textContent.replace(/^✓ /, '');
      try { await navigator.clipboard.writeText(valori[c.dataset.copia]); c.textContent = '✓ ' + etichetta.replace(/^\d\. Copia/, 'Copiato:').replace('Copiato:', 'Copiato'); }
      catch (err) { prompt('Copia questo testo:', valori[c.dataset.copia]); }
      return;
    }
    const b = e.target.closest('button[data-azione]');
    if (!b) { if (e.target === ov) ov.remove(); return; }
    const t = document.getElementById('accesso-testo').value;
    if (b.dataset.azione === 'chiudi') ov.remove();
    if (b.dataset.azione === 'dalprogramma') { ov.remove(); emailAccessoUtente(u, t.replace(/\*/g, '')); return; }
    if (b.dataset.azione === 'wa') {
      const tel = document.getElementById('accesso-tel').value;
      const num = numeroWhatsApp(tel);
      apriChatWhatsApp(num || '', t);
    }
    const oggetto = 'Accesso al programma CAF CISL Alì Terme', corpo = t.replace(/\*/g, '');
    if (b.dataset.azione === 'aruba' || b.dataset.azione === 'aruba-apri') {
      window.open('https://webmail.aruba.it/', '_blank');
      document.getElementById('aruba-guida').style.display = '';
      try { await navigator.clipboard.writeText(u.email || ''); } catch (err) {}
    }
    if (b.dataset.azione === 'gmail') {
      window.open('https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(u.email || '') + '&su=' + encodeURIComponent(oggetto) + '&body=' + encodeURIComponent(corpo), '_blank');
    }
    if (b.dataset.azione === 'outlookweb') {
      window.open('https://outlook.office.com/mail/deeplink/compose?to=' + encodeURIComponent(u.email || '') + '&subject=' + encodeURIComponent(oggetto) + '&body=' + encodeURIComponent(corpo), '_blank');
    }
    if (b.dataset.azione === 'email') {
      location.href = 'mailto:' + encodeURIComponent(u.email || '') + '?subject=' + encodeURIComponent('Accesso al programma CAF CISL Alì Terme') + '&body=' + encodeURIComponent(t.replace(/\*/g, ''));
    }
    if (b.dataset.azione === 'copia') {
      try { await navigator.clipboard.writeText(t); b.textContent = '✓ Copiato'; } catch (err) { document.getElementById('accesso-testo').select(); }
    }
  });
}

// Avviso a video per l'amministratore (Chrome/Edge sul computer) quando la copia in Dropbox non funziona:
// cartella mai scelta su questo PC, oppure accesso alla cartella da riconfermare (Chrome lo toglie quando si riapre)
async function controllaAvvisoBackupCartella() {
  const vecchio = document.getElementById('avviso-backup-cartella');
  if (typeof isAdmin !== 'function' || !isAdmin() || !window.showDirectoryPicker) { if (vecchio) vecchio.remove(); return; }
  const h = await leggiCartellaBackup();
  const attiva = h ? await permessoCartella(h, false) : false;
  let rimandato = 0; try { rimandato = Number(localStorage.getItem('avviso-backup-rimandato') || 0); } catch (e) {}
  if (attiva || Date.now() - rimandato < 20 * 3600 * 1000) { if (vecchio) vecchio.remove(); return; }
  if (vecchio) return;
  const box = document.createElement('div');
  box.id = 'avviso-backup-cartella';
  box.style.cssText = 'position:fixed; left:50%; bottom:16px; transform:translateX(-50%); z-index:380; width:min(560px, calc(100vw - 24px)); background:#fff7e6; color:#5c3d00; border:2px solid #b35f0c; border-radius:14px; box-shadow:0 10px 30px rgba(0,0,0,.25); padding:10px 14px; display:flex; flex-wrap:wrap; gap:8px; align-items:center';
  box.innerHTML = '<div style="flex:1; min-width:220px; font-size:13.5px"><b>🛟 La copia dei backup in Dropbox è ferma.</b><br>' + (h ? 'Chrome chiede di riconfermare l\'accesso alla cartella <b>' + esc(h.name) + '</b>.' : 'Su questo computer non è stata scelta la cartella dove salvarli.') + '</div>'
    + '<button type="button" data-az="ok" style="background:#b35f0c; color:#fff; border:none; border-radius:999px; padding:8px 14px; font-weight:800; cursor:pointer">' + (h ? '🔓 Riattiva' : '📁 Scegli la cartella') + '</button>'
    + '<button type="button" data-az="dopo" style="background:none; border:1px solid #b35f0c; color:#b35f0c; border-radius:999px; padding:7px 12px; cursor:pointer">Domani</button>';
  box.addEventListener('click', async function (e) {
    const az = e.target.getAttribute && e.target.getAttribute('data-az');
    if (az === 'dopo') { try { localStorage.setItem('avviso-backup-rimandato', String(Date.now())); } catch (er) {} box.remove(); }
    else if (az === 'ok') { if (h) await sincronizzaCartellaBackup(true); else await scegliCartellaBackup(); controllaAvvisoBackupCartella(); }
  });
  document.body.appendChild(box);
}
setTimeout(controllaAvvisoBackupCartella, 8000);

// Promemoria (solo amministratore, dal computer) finché nel database manca il "ripristino completo":
// si toglie da solo appena la modifica è applicata
async function promemoriaRipristinoCompleto() {
  const id = 'promemoria-ripristino';
  const vecchio = document.getElementById(id);
  const computer = window.matchMedia && window.matchMedia('(pointer: fine)').matches && window.innerWidth >= 900;
  if (typeof isAdmin !== 'function' || !isAdmin() || !computer) { if (vecchio) vecchio.remove(); return; }
  try {
    const { error } = await supabase.rpc('ripristina_backup', { p_id: -1 });
    // la funzione c'è (risponde "Backup non trovato"): niente promemoria
    if (!error || !/could not find|does not exist|schema cache/i.test(error.message)) { if (vecchio) vecchio.remove(); return; }
  } catch (e) { return; }
  if (vecchio) return;
  const box = document.createElement('div');
  box.id = id;
  box.style.cssText = 'position:fixed; top:12px; right:12px; z-index:390; width:min(420px, calc(100vw - 24px)); background:#e8f0fb; color:#0f1b2d; border:2px solid #1d4f91; border-radius:14px; box-shadow:0 10px 30px rgba(0,0,0,.25); padding:12px 14px; font-size:13.5px';
  box.innerHTML = '<div style="font-weight:800; color:#1d4f91; margin-bottom:4px">📌 Promemoria: ripristino completo dei backup</div>'
    + 'Sei al computer: apri la chat con Claude (app Claude o claude.ai) e scrivi <b>"applica la modifica al database"</b>, poi premi <b>Consenti</b>. Questo avviso sparisce da solo appena è fatto.'
    + '<div style="text-align:right; margin-top:8px"><button type="button" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:6px 14px; cursor:pointer; font-weight:700">Ok, chiudi per ora</button></div>';
  box.querySelector('button').onclick = function () { box.remove(); };
  document.body.appendChild(box);
}
// (promemoria non più necessario: il ripristino completo lo fa ora il programma)
setInterval(function () { if (!document.hidden) controllaAvvisoBackupCartella(); }, 10 * 60 * 1000);

// All'apertura del programma (e poi ogni 6 ore) l'amministratore copia da solo i nuovi backup nella cartella scelta
setInterval(function () {
  if (typeof isAdmin !== 'function' || !isAdmin() || !window.showDirectoryPicker || document.hidden) return;
  let ultimo = 0;
  try { ultimo = Date.parse(localStorage.getItem('backup-cartella-ultimo') || '') || 0; } catch (e) {}
  if (Date.now() - ultimo > 6 * 3600 * 1000) sincronizzaCartellaBackup(false);
}, 60 * 1000);


/* ---------------- Cancellazione di un solo anno (solo amministratore, con backup prima) ---------------- */
function preparaSvuotaAnno() {
  const sel = document.getElementById('sva-anno');
  if (!sel) return;
  const scelto = sel.value;
  const anni = typeof elencoAnniDisponibili === 'function' ? elencoAnniDisponibili() : [];
  sel.innerHTML = anni.map(function (a) { return '<option value="' + a + '"' + (String(a) === scelto ? ' selected' : '') + '>' + a + '</option>'; }).join('');
}
async function svuotaAnno() {
  const anno = parseInt(document.getElementById('sva-anno').value, 10);
  const cosa = { pratiche: document.getElementById('sva-pratiche').checked, versamenti: document.getElementById('sva-versamenti').checked,
    spese: document.getElementById('sva-spese').checked, scadenze: document.getElementById('sva-scadenze').checked };
  if (!anno) return;
  if (!cosa.pratiche && !cosa.versamenti && !cosa.spese && !cosa.scadenze) { avviso('⚠️ Scegli cosa cancellare', true); return; }
  const nP = (state.pratiche || []).concat(state.annullate || []).filter(function (p) { return annoPratica(p) === anno; }).length;
  const nV = (state.versamenti || []).filter(function (v) { return annoDiData(v.data) === anno; }).length;
  const nS = (state.speseSede || []).filter(function (x) { return annoDiData(x.data) === anno; }).length;
  const nSc = (state.scadenze || []).filter(function (x) { return String(x.data || '').slice(0, 4) === String(anno); }).length;
  const elenco = [cosa.pratiche ? nP + ' pratiche' : '', cosa.versamenti ? nV + ' versamenti CAF' : '', cosa.spese ? nS + ' spese sede' : '', cosa.scadenze ? nSc + ' scadenze' : ''].filter(Boolean).join(', ');
  const ok = await chiediConfermaScritta('Cancella l\'anno ' + anno, 'Verranno eliminati DEFINITIVAMENTE i dati del ' + anno + ': ' + elenco + '. Prima di cancellare il programma salva da solo un backup completo (lo trovi in "Backup automatici").', String(anno));
  if (!ok) return;
  const btn = document.getElementById('btn-svuota-anno');
  btn.disabled = true; btn.textContent = 'Backup e cancellazione in corso...';
  try {
    const { error: eb } = await supabase.rpc('crea_backup', { p_tipo: 'prima_di_svuotare' });
    if (eb) throw new Error('backup di sicurezza non riuscito, NIENTE è stato cancellato (' + eb.message + ')');
    const cancella = async function (percorso) {
      const r = await fetchSupabase('/rest/v1/' + percorso, 'DELETE', null, { 'Prefer': 'return=minimal' });
      if (!r.ok) throw new Error((r.data && (r.data.message || r.data.hint)) || ('errore ' + r.status));
    };
    if (cosa.pratiche) await cancella('pratiche?anno=eq.' + anno);
    if (cosa.versamenti) await cancella('versamenti?data=like.*%2F' + anno);
    if (cosa.spese) await cancella('spese_sede?data=like.*%2F' + anno);
    if (cosa.scadenze) await cancella('scadenze?data=gte.' + anno + '-01-01&data=lte.' + anno + '-12-31');
    await data.caricaTutto();
    avviso('🗑️ Dati del ' + anno + ' cancellati. Il backup di sicurezza è in "Backup automatici".');
    if (typeof render === 'function') render();
    if (typeof renderBackup === 'function') renderBackup();
  } catch (e) {
    avviso('❌ Cancellazione non completata: ' + e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = '🗑️ Cancella i dati dell\'anno scelto';
    preparaSvuotaAnno();
  }
}
