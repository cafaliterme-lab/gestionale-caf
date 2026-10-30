/* ---------------- 🗄️ Anni con più di 5 anni: copia e cancellazione (decide l'amministratore) ----------------
   Nel controllo di fine anno compare la voce «Anni con più di 5 anni»: a dicembre 2032, per esempio, il 2027.
   Se l'amministratore non lo cancella, l'anno dopo la voce propone il 2027 e il 2028, e così via.
   Il programma NON cancella mai niente da solo. Per ogni anno ci sono due tasti:
   - «💾 Scarica la copia»: un file con solo i dati di quell'anno (pratiche con scadenze, buste paga e avvisi collegati,
     versamenti CAF, spese sede, scadenze dell'anno) da tenere sul PC o su una chiavetta;
   - «🗑️ Cancella»: la stessa cancellazione di «Cancella un solo anno» (prima fa da sola un backup completo); l'archivio clienti resta.
   Il file si rimette con Utenti e permessi → «Importa Backup»: riporta SOLO quell'anno e non tocca gli altri dati. */

const ANNI_DA_CONSERVARE = 5;
const COPIE_ANNO_SCARICATE = {};

// anni che hanno più di 5 anni rispetto all'anno da chiudere (a dicembre 2032: il 2027 e quelli prima, se ci sono ancora)
function anniDaConservareOltre(annoChiuso) {
  annoChiuso = annoChiuso || (typeof annoDaChiudere === 'function' ? annoDaChiudere() : new Date().getFullYear());
  const limite = annoChiuso - ANNI_DA_CONSERVARE;
  const inizio = typeof ANNO_INIZIO_PROTOCOLLO !== 'undefined' ? ANNO_INIZIO_PROTOCOLLO : 0;
  const anni = {};
  const conta = function (a, chiave) { if (a >= inizio && a <= limite) { anni[a] = anni[a] || { anno: a, pratiche: 0, versamenti: 0, spese: 0 }; anni[a][chiave]++; } };
  (state.pratiche || []).concat(state.annullate || []).forEach(function (p) { conta(annoPratica(p), 'pratiche'); });
  (state.versamenti || []).forEach(function (v) { if (parseDataIT(v.data)) conta(annoDiData(v.data), 'versamenti'); });
  (state.speseSede || []).forEach(function (x) { if (parseDataIT(x.data)) conta(annoDiData(x.data), 'spese'); });
  return Object.keys(anni).map(function (k) { return anni[k]; }).sort(function (a, b) { return a.anno - b.anno; });
}
function testoAnnoVecchio(x) {
  const n = function (q, uno, tanti) { return q ? q + ' ' + (q === 1 ? uno : tanti) : ''; };
  return [n(x.pratiche, 'pratica', 'pratiche'), n(x.versamenti, 'versamento', 'versamenti'), n(x.spese, 'spesa', 'spese')].filter(Boolean).join(', ');
}
// voce per il controllo di fine anno
function voceAnniVecchi(annoChiuso) {
  const vecchi = anniDaConservareOltre(annoChiuso);
  const nomi = vecchi.map(function (x) { return 'il ' + x.anno; }).join(', ').replace(/, (il \d+)$/, ' e $1');
  return { icona: '🗄️', titolo: 'Anni con più di ' + ANNI_DA_CONSERVARE + ' anni', ok: !vecchi.length,
    testo: vecchi.length
      ? nomi.charAt(0).toUpperCase() + nomi.slice(1) + (vecchi.length === 1 ? ' ha' : ' hanno') + ' più di ' + ANNI_DA_CONSERVARE + ' anni (' + vecchi.map(function (x) { return x.anno + ': ' + testoAnnoVecchio(x); }).join(' · ') + '). Se vuoi, scarica la copia e ' + (vecchi.length === 1 ? 'toglilo: decidi tu, se non lo cancelli resta.' : 'toglili: decidi tu, quelli che non cancelli restano.')
      : 'Si tengono gli ultimi ' + ANNI_DA_CONSERVARE + ' anni: nessun anno più vecchio da togliere.',
    azione: vecchi.length ? 'apriAnniVecchi(' + (annoChiuso || '') + ')' : '', testoAzione: '🗄️ Vedi gli anni' };
}

function apriAnniVecchi(annoChiuso) {
  const vecchio = document.getElementById('popup-anni-vecchi'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-anni-vecchi';
  ov.style.cssText = 'position:fixed; inset:0; z-index:462; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:10px';
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-chiudi]')) ov.remove(); });
  const tasto = 'border:none; border-radius:999px; padding:6px 12px; font-size:12.5px; font-weight:800; cursor:pointer; white-space:nowrap';
  const disegna = function () {
    const vecchi = anniDaConservareOltre(annoChiuso);
    ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:14px; border-top:6px solid #6b4f2a; max-width:640px; width:100%; max-height:92vh; overflow:auto; padding:14px 16px; box-shadow:0 10px 40px rgba(0,0,0,.3)">'
      + '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px"><b style="font-size:18px; color:#6b4f2a">🗄️ Anni con più di ' + ANNI_DA_CONSERVARE + ' anni</b>'
      + '<button type="button" data-chiudi style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:6px 12px; cursor:pointer">✕</button></div>'
      + '<div style="font-size:12.5px; color:var(--sub); margin:4px 0 10px">Si tengono gli ultimi ' + ANNI_DA_CONSERVARE + ' anni. Gli anni più vecchi puoi toglierli: <b>decidi tu</b>, se non li cancelli restano e l\'anno prossimo te li ripropone. '
      + 'Prima <b>scarica la copia</b> e tienila sul PC o su una chiavetta: in caso di bisogno si rimette con <b>Utenti e permessi → Importa Backup</b> e riporta solo quell\'anno. L\'archivio clienti non si cancella.</div>'
      + (vecchi.length ? vecchi.map(function (x) {
          const scaricata = COPIE_ANNO_SCARICATE[x.anno];
          return '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:10px 4px; border-bottom:1px solid var(--line)">'
            + '<span style="flex:1; min-width:160px"><b style="font-size:16px">' + x.anno + '</b><div style="font-size:12.5px; color:var(--sub)">' + esc(testoAnnoVecchio(x)) + (scaricata ? ' · <b style="color:#1a7f37">copia scaricata ✓</b>' : '') + '</div></span>'
            + '<button type="button" data-copia="' + x.anno + '" style="' + tasto + '; background:#1d4f91; color:#fff">💾 Scarica la copia del ' + x.anno + '</button>'
            + '<button type="button" data-cancella="' + x.anno + '" style="' + tasto + '; background:var(--line); color:#c0392b">🗑️ Cancella il ' + x.anno + '</button></div>';
        }).join('') : '<div style="padding:10px 4px; color:#1a7f37; font-weight:700">✅ Nessun anno più vecchio di ' + ANNI_DA_CONSERVARE + ' anni.</div>')
      + '</div>';
    ov.querySelectorAll('[data-copia]').forEach(function (b) { b.onclick = async function () { b.disabled = true; b.textContent = '⏳ Preparo la copia…'; if (await scaricaCopiaAnno(Number(b.dataset.copia))) disegna(); else { b.disabled = false; b.textContent = '💾 Scarica la copia del ' + b.dataset.copia; } }; });
    ov.querySelectorAll('[data-cancella]').forEach(function (b) { b.onclick = async function () { const a = Number(b.dataset.cancella); if (await cancellaAnnoVecchio(a, b)) disegna(); }; });
  };
  document.body.appendChild(ov);
  disegna();
}

// legge tutte le righe di una richiesta (a pagine di 1000)
async function leggiTutteLeRighe(percorso) {
  const righe = [];
  for (let da = 0; ; da += 1000) {
    const r = await fetchSupabase('/rest/v1/' + percorso + (percorso.indexOf('?') >= 0 ? '&' : '?') + 'limit=1000&offset=' + da);
    if (!r.ok) throw new Error((r.data && (r.data.message || r.data.hint)) || ('errore ' + r.status));
    righe.push.apply(righe, r.data || []);
    if (!r.data || r.data.length < 1000) return righe;
  }
}
// righe collegate alle pratiche (a gruppi, perché l'indirizzo non diventi troppo lungo)
async function righePerPratiche(tabella, ids) {
  const righe = [];
  for (let i = 0; i < ids.length; i += 80) righe.push.apply(righe, await leggiTutteLeRighe(tabella + '?select=*&pratica_id=in.(' + ids.slice(i, i + 80).join(',') + ')'));
  return righe;
}
// i dati di un anno così come sono nel database
async function datiDiUnAnno(anno) {
  const pratiche = await leggiTutteLeRighe('pratiche?select=*&anno=eq.' + anno + '&order=numero');
  const ids = pratiche.map(function (p) { return p.id; });
  const scadenze = {};
  (await righePerPratiche('scadenze', ids)).concat(await leggiTutteLeRighe('scadenze?select=*&data=gte.' + anno + '-01-01&data=lte.' + anno + '-12-31'))
    .forEach(function (s) { scadenze[s.id] = s; });
  return {
    pratiche: pratiche,
    scadenze: Object.keys(scadenze).map(function (k) { return scadenze[k]; }),
    buste_paga: await righePerPratiche('buste_paga', ids),
    pratiche_avvisi: await righePerPratiche('pratiche_avvisi', ids),
    versamenti: await leggiTutteLeRighe('versamenti?select=*&data=like.*%2F' + anno),
    spese_sede: await leggiTutteLeRighe('spese_sede?select=*&data=like.*%2F' + anno),
  };
}
async function scaricaCopiaAnno(anno) {
  try {
    const tabelle = await datiDiUnAnno(anno);
    const file = { versione: 'anno', anno: anno, esportatoIl: new Date().toISOString(),
      nota: 'Copia dei soli dati del ' + anno + ' del gestionale del CAF CISL di Alì Terme. Contiene dati dei clienti: tienila al sicuro. Si rimette con Utenti e permessi → Importa Backup (riporta solo il ' + anno + ').',
      tabelle: tabelle };
    const u = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = u; a.download = 'copia-anno-' + anno + '-gestionale-caf.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 2000);
    COPIE_ANNO_SCARICATE[anno] = true;
    avviso('💾 Copia del ' + anno + ' scaricata: ' + tabelle.pratiche.length + ' pratiche. Tienila sul PC o su una chiavetta.');
    return true;
  } catch (e) { avviso('❌ Copia del ' + anno + ' non riuscita: ' + e.message, true); return false; }
}
async function cancellaAnnoVecchio(anno, btn) {
  if (!COPIE_ANNO_SCARICATE[anno] && !confirm('Non hai ancora scaricato la copia del ' + anno + ' da tenere sul PC.\n\nIl programma fa comunque un backup completo prima di cancellare, ma è uno dei backup che col tempo vengono sostituiti dai nuovi.\n\nVuoi cancellare lo stesso?')) return false;
  return await eseguiSvuotaAnno(anno, { pratiche: true, versamenti: true, spese: true, scadenze: true }, btn, '🗑️ Cancella il ' + anno);
}

// Riporta nel programma un anno dalla copia scaricata, senza toccare gli altri dati.
// Le righe che ci sono già (stesso codice interno) si saltano: si può rifare senza creare doppioni.
async function riportaAnnoDaCopia(file) {
  const anno = Number(file && file.anno), t = (file && file.tabelle) || {};
  if (!anno || !Array.isArray(t.pratiche)) throw new Error('Il file non sembra una copia di un anno.');
  const ok = await chiediConfermaScritta('Riporta il ' + anno, 'Rimetto nel programma i dati del ' + anno + ' presi da questa copia: ' + t.pratiche.length + ' pratiche, ' + (t.versamenti || []).length + ' versamenti, ' + (t.spese_sede || []).length + ' spese. Gli altri anni non vengono toccati e quello che c\'è già non viene doppiato.', String(anno));
  if (!ok) return false;
  const inserisci = async function (tabella, righe, conId) {
    const nuovi = [];
    righe = Array.isArray(righe) ? righe : [];
    for (let i = 0; i < righe.length; i += 300) {
      const r = await fetchSupabase('/rest/v1/' + tabella + (conId ? '?select=id' : ''), 'POST', righe.slice(i, i + 300), { 'Prefer': 'resolution=ignore-duplicates,' + (conId ? 'return=representation' : 'return=minimal') });
      if (!r.ok) throw new Error(tabella.replace('_', ' ') + ': ' + ((r.data && (r.data.message || r.data.hint)) || ('errore ' + r.status)));
      if (conId) nuovi.push.apply(nuovi, (r.data || []).map(function (x) { return x.id; }));
    }
    return nuovi;
  };
  const nuove = await inserisci('pratiche', t.pratiche, true);
  // le pratiche appena rimesse creano da sole le loro scadenze: si tolgono e si rimettono quelle della copia
  for (let i = 0; i < nuove.length; i += 80) {
    const r = await fetchSupabase('/rest/v1/scadenze?pratica_id=in.(' + nuove.slice(i, i + 80).join(',') + ')', 'DELETE', null, { 'Prefer': 'return=minimal' });
    if (!r.ok) throw new Error('scadenze: errore ' + r.status);
  }
  await inserisci('scadenze', t.scadenze);
  await inserisci('buste_paga', t.buste_paga);
  await inserisci('pratiche_avvisi', t.pratiche_avvisi);
  await inserisci('versamenti', t.versamenti);
  await inserisci('spese_sede', t.spese_sede);
  await data.caricaTutto();
  if (typeof render === 'function') render();
  avviso('✅ Il ' + anno + ' è di nuovo nel programma: ' + nuove.length + ' pratiche rimesse' + (t.pratiche.length > nuove.length ? ' (' + (t.pratiche.length - nuove.length) + ' c\'erano già)' : '') + '.');
  return true;
}
