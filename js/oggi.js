/* ---------------- 📅 Oggi: riepilogo di cosa c'è da fare, in cima alla schermata di inserimento ----------------
   Ogni riquadro si tocca e porta dove serve (registro, invio WhatsApp, morosi, scadenze, archivio clienti). */

function oggiAperto() { try { return localStorage.getItem('oggi-chiuso') !== '1'; } catch (e) { return true; } }
function renderOggi() {
  const box = document.getElementById('box-oggi');
  if (!box) return;
  if (!auth.profilo || (typeof puo === 'function' && !puo('registro') && !puo('anagrafica'))) { box.innerHTML = ''; return; }
  const anno = annoAttivo();
  const pratAnno = (state.pratiche || []).filter(function (p) { return annoPratica(p) === anno && !p.annullata; });
  const daLavorare = pratAnno.filter(function (p) { return eDaLavorare(p) && !eConsegnata(p); });
  const daConsegnare = pratAnno.filter(function (p) { return !eDaLavorare(p) && !eConsegnata(p) && !eRinuncia(p) && !eColf(p.tipo); });
  const daAvvisare = typeof praticheDaAvvisare === 'function' ? praticheDaAvvisare(pratAnno) : [];
  const nonPagate = typeof morosiAnno === 'function' ? morosiAnno(anno).length + morosiAnno(0).length : 0;
  const scad = (state.scadenze || []).filter(function (s) {
    if (s.completata || !s.data || typeof giorniDaOggi !== 'function') return false;
    const g = giorniDaOggi(String(s.data).slice(0, 10)); return g <= 7;
  });
  const scadutePassate = scad.filter(function (s) { return giorniDaOggi(String(s.data).slice(0, 10)) < 0; }).length;
  // archivio: clienti venuti quest'anno o l'anno scorso con dati mancanti
  const rec = typeof clientiConPraticheRecenti === 'function' ? clientiConPraticheRecenti() : { cf: {}, nome: {} };
  const recenti = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).filter(function (c) { return (c.codiceFiscale && rec.cf[c.codiceFiscale]) || rec.nome[String(c.nomeCompleto || '').toUpperCase()]; });
  const oggiN = typeof dataNum === 'function' ? dataNum(todayIT()) : 0;
  const senzaTel = recenti.filter(function (c) { return !c.telefono && !c.telefonoFisso; }).length;
  const docScad = recenti.filter(function (c) { return !c.documentoScadenza || (dataNum(c.documentoScadenza) || 0) < oggiN; }).length;
  const senzaCfTutti = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).filter(function (c) { return !c.codiceFiscale; }).length;

  const tile = function (icona, n, testo, colore, onclick, nota) {
    const vuoto = !n;
    return '<button type="button" onclick="' + onclick + '" style="flex:1 1 150px; min-width:140px; text-align:left; border:2px solid ' + (vuoto ? 'var(--line)' : colore) + '; background:' + (vuoto ? 'var(--card)' : 'color-mix(in srgb, ' + colore + ' 10%, var(--card))') + '; color:var(--ink); border-radius:14px; padding:10px 12px; cursor:pointer">'
      + '<div style="display:flex; align-items:center; gap:8px"><span style="font-size:22px">' + icona + '</span><b style="font-size:24px; color:' + (vuoto ? 'var(--sub)' : colore) + '">' + n + '</b></div>'
      + '<div style="font-size:12.5px; font-weight:700; margin-top:2px">' + testo + '</div>'
      + (nota ? '<div style="font-size:11px; color:var(--sub); margin-top:1px">' + nota + '</div>' : '') + '</button>';
  };
  const oggiTesto = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  box.innerHTML = '<details class="card" style="padding:10px 14px; margin-bottom:12px; border:2px solid #1d4f91"' + (oggiAperto() ? ' open' : '') + ' ontoggle="try{localStorage.setItem(\'oggi-chiuso\', this.open ? \'0\' : \'1\')}catch(e){}">'
    + '<summary style="cursor:pointer; font-weight:800; font-size:16px; color:#1d4f91">📅 Oggi, ' + esc(oggiTesto) + ' <span style="font-weight:600; font-size:12.5px; color:var(--sub)">· cosa c\'è da fare (anno ' + anno + ')</span></summary>'
    + '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px">'
    + tile('📥', daLavorare.length, 'Da lavorare', '#c0392b', "oggiVaiRegistro('aperte')", 'in arrivo, scansionate, in lavorazione')
    + tile('📦', daConsegnare.length, 'Pronte da consegnare', '#8d5a3b', "oggiVaiRegistro('aperte')", 'lavorate, non ancora consegnate')
    + tile('💬', daAvvisare.length, 'Da avvisare su WhatsApp', '#25a35a', 'apriInvioMultiplo()', 'lavorate da più di ' + (typeof GIORNI_AVVISO_RITIRO !== 'undefined' ? GIORNI_AVVISO_RITIRO : 7) + ' giorni')
    + tile('💸', nonPagate, 'Non pagate', '#e67e22', 'oggiVaiMorosi()', 'quest\'anno e anni precedenti')
    + tile('⏰', scad.length, 'Scadenze entro 7 giorni', '#7b3fa0', 'oggiVaiScadenze()', scadutePassate ? scadutePassate + ' già passate' : '')
    + tile('📞', senzaTel, 'Clienti senza telefono', '#1d4f91', "apriArchivioClienti('', { conPratiche: true, senzaTel: true })", 'venuti quest\'anno o l\'anno scorso')
    + tile('🪪', docScad, 'Documenti scaduti o mancanti', '#c0392b', "apriArchivioClienti('', { conPratiche: true, doc: true })", 'clienti venuti di recente')
    + '</div>'
    + (senzaCfTutti ? '<div style="font-size:12px; color:var(--sub); margin-top:8px">📋 Archivio da completare: <a href="#" onclick="apriArchivioClienti(\'\', { senzaCf: true }); return false" style="font-weight:700">' + senzaCfTutti + ' clienti senza codice fiscale</a> · completali quando vengono: <b>✏️ Modifica</b> → <b>📷 Leggi documento</b></div>' : '')
    + '</details>';
}
function oggiTab(nome) { const b = document.querySelector('.navmenu button[data-tab="' + nome + '"]'); if (b && b.style.display !== 'none' && typeof showTab === 'function') { showTab(b); return true; } return false; }
function oggiVaiRegistro(modo) {
  if (!oggiTab('registro')) return;
  if (typeof azzeraFiltriRegistro === 'function') azzeraFiltriRegistro();
  if (modo && typeof impostaArchivio === 'function') impostaArchivio(modo);
  setTimeout(function () { const el = document.getElementById('tabella'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
}
function oggiVaiMorosi() {
  if (!oggiTab('registro')) return;
  if (typeof MOROSI_CORR !== 'undefined') MOROSI_CORR.aperto = true;
  render();
  setTimeout(function () { const el = document.getElementById('morosi-corrente-box'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
}
function oggiVaiScadenze() { oggiTab('scadenze'); }
