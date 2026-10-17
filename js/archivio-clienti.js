/* ---------- Archivio clienti: cerca e modifica l'anagrafica senza fare una pratica ----------
   Si completano i dati mancanti (codice fiscale, telefoni, e-mail, scadenza documento…)
   direttamente nell'archivio, che è quello usato da tutte le ricerche del programma. */

function apriArchivioClienti(testo) {
  const vecchio = document.getElementById('popup-archivio'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-archivio';
  ov.style.cssText = 'position:fixed; inset:0; z-index:455; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:12px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid #1d4f91; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:16px 18px; max-width:900px; width:100%; max-height:92vh; display:flex; flex-direction:column">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px"><div style="font-size:19px; font-weight:800; color:#1d4f91">🗂️ Archivio clienti – modifica anagrafica</div>'
    + '<span style="display:flex; gap:6px"><button type="button" data-az="nuovo" style="background:#1a7f37; color:#fff; border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer">➕ Nuovo cliente</button>'
    + '<button type="button" data-az="chiudi" style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer">✕ Chiudi</button></span></div>'
    + '<input id="arc-cerca" type="search" placeholder="Cerca per cognome, nome, codice fiscale o telefono…" autocomplete="off" value="' + esc(testo || '') + '" style="margin-bottom:6px">'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; font-size:12.5px">'
    + '<label class="chk" style="margin:0"><input type="checkbox" id="arc-senza-cf"> Senza codice fiscale</label>'
    + '<label class="chk" style="margin:0"><input type="checkbox" id="arc-senza-tel"> Senza cellulare</label>'
    + '<label class="chk" style="margin:0"><input type="checkbox" id="arc-doc"> Documento scaduto o mancante</label></div>'
    + '<div id="arc-lista" style="overflow:auto; flex:1; border:1px solid var(--line); border-radius:10px"></div>'
    + '<div id="arc-conta" style="font-size:12px; color:var(--sub); margin-top:6px"></div></div>';
  document.body.appendChild(ov);
  const disegna = function () {
    const q = (document.getElementById('arc-cerca').value || '').trim().toUpperCase();
    const senzaCf = document.getElementById('arc-senza-cf').checked, senzaTel = document.getElementById('arc-senza-tel').checked, doc = document.getElementById('arc-doc').checked;
    const oggi = typeof dataNum === 'function' ? dataNum(todayIT()) : 0;
    const tutti = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []);
    const filtrati = tutti.filter(function (c) {
      if (senzaCf && c.codiceFiscale) return false;
      if (senzaTel && c.telefono) return false;
      if (doc && c.documentoScadenza && (dataNum(c.documentoScadenza) || 0) >= oggi) return false;
      if (!q) return true;
      if ([c.nomeCompleto, c.codiceFiscale, c.telefono, c.telefonoFisso, c.email].join(' ').toUpperCase().indexOf(q) >= 0) return true;
      const kq = typeof chiaveRicerca === 'function' ? chiaveRicerca(q) : '';
      return !!kq && (chiaveRicerca(c.nomeCompleto) + '|' + chiaveRicerca(c.nome) + chiaveRicerca(c.cognome) + '|' + chiaveRicerca(c.codiceFiscale) + '|' + chiaveRicerca(c.telefono) + '|' + chiaveRicerca(c.telefonoFisso)).indexOf(kq) >= 0;
    });
    const mostra = filtrati.slice(0, 80);
    document.getElementById('arc-lista').innerHTML = mostra.length ? mostra.map(function (c) {
      const manca = [!c.codiceFiscale ? 'CF' : '', !c.telefono && !c.telefonoFisso ? 'telefono' : '', !c.documentoScadenza ? 'scad. documento' : ''].filter(Boolean);
      const scaduto = c.documentoScadenza && (dataNum(c.documentoScadenza) || 0) < oggi;
      return '<div data-id="' + esc(String(c.id || '')) + '" data-nome="' + esc(c.nomeCompleto) + '" style="display:flex; gap:10px; align-items:center; padding:8px 10px; border-bottom:1px solid var(--line); cursor:pointer">'
        + '<span style="flex:1"><b>' + esc(c.nomeCompleto) + '</b><div style="font-size:12px; color:var(--sub)">'
        + (c.dataNascita ? 'nato/a il ' + esc(c.dataNascita) : 'data di nascita mancante') + ((c.comuneNascita || (c.codiceFiscale && typeof comuneDaCF === 'function' && comuneDaCF(c.codiceFiscale))) ? ' a ' + esc(c.comuneNascita || comuneDaCF(c.codiceFiscale)) : '') + (c.codiceFiscale ? ' · CF ' + esc(c.codiceFiscale) : '')
        + (c.telefono || c.telefonoFisso ? ' · 📞 ' + esc(c.telefono || c.telefonoFisso) : '') + (c.email ? ' · ✉️ ' + esc(c.email) : '')
        + (c.documentoScadenza ? ' · 🪪 ' + esc(c.documentoScadenza) + (scaduto ? ' <b style="color:#c0392b">scaduto</b>' : '') : '') + '</div>'
        + (manca.length ? '<div style="font-size:11.5px; color:#b35f0c; font-weight:700">Manca: ' + manca.join(', ') + '</div>' : '') + '</span>'
        + '<span style="background:#1d4f91; color:#fff; border-radius:999px; padding:5px 12px; font-size:12.5px; font-weight:700; white-space:nowrap">✏️ Modifica</span></div>';
    }).join('') : '<div class="empty" style="padding:14px">Nessun cliente trovato</div>';
    document.getElementById('arc-conta').textContent = filtrati.length + ' clienti' + (filtrati.length > mostra.length ? ' (ne vedi ' + mostra.length + ': scrivi nella ricerca per trovare gli altri)' : '') + ' · archivio: ' + tutti.length + ' clienti';
  };
  disegna();
  setTimeout(function () { const el = document.getElementById('arc-cerca'); if (el) el.focus(); }, 50);
  ov.addEventListener('input', function (e) { if (e.target.id === 'arc-cerca') disegna(); });
  ov.addEventListener('change', function (e) { if (/^arc-/.test(e.target.id)) disegna(); });
  ov.addEventListener('click', function (e) {
    const b = e.target.closest('button[data-az]');
    if (e.target === ov || (b && b.dataset.az === 'chiudi')) { ov.remove(); return; }
    if (b && b.dataset.az === 'nuovo') { if (typeof nuovoClienteArchivio === 'function') nuovoClienteArchivio(document.getElementById('arc-cerca').value, function () { disegna(); }); return; }
    const r = e.target.closest('div[data-nome]');
    if (!r) return;
    const c = (ARCHIVIO_CLIENTI || []).find(function (x) { return r.dataset.id ? String(x.id) === r.dataset.id : x.nomeCompleto === r.dataset.nome; });
    if (c) modificaClienteArchivio(c, disegna);
  });
}

function modificaClienteArchivio(c, dopo) {
  if (!c.id) { avviso('Cliente appena inserito: riapri l\'archivio tra qualche secondo per modificarlo', true); return; }
  const vecchio = document.getElementById('popup-mod-cliente'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-mod-cliente';
  ov.style.cssText = 'position:fixed; inset:0; z-index:475; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:14px';
  const campo = function (id, etichetta, valore, attr) { return '<div><label>' + etichetta + '</label><input id="mc-' + id + '" value="' + esc(valore || '') + '" ' + (attr || '') + '></div>'; };
  const pratiche = (state.pratiche || []).filter(function (p) { return (p.codiceFiscale && p.codiceFiscale === c.codiceFiscale) || (p.nome || '').toUpperCase() === (c.nomeCompleto || '').toUpperCase(); });
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid #1d4f91; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:16px 18px; max-width:580px; width:100%; max-height:92vh; overflow:auto">'
    + '<div style="font-size:19px; font-weight:800; color:#1d4f91">✏️ ' + esc(c.nomeCompleto) + '</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:10px">Modifichi la scheda dell\'archivio: i nuovi dati si useranno nelle prossime pratiche e in tutte le ricerche.'
    + (pratiche.length ? ' Ha ' + pratiche.length + (pratiche.length === 1 ? ' pratica' : ' pratiche') + ' nell\'anno caricato.' : '') + '</div>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px">'
    + '<button type="button" onclick="apriLetturaDocumentoPer(\'modifica\')" style="background:#2f9e9e; color:#fff; border:none; border-radius:999px; padding:7px 14px; font-weight:800; cursor:pointer">📷 Leggi documento</button>'
    + '<button type="button" onclick="apriInserisciDocumento(\'modifica\')" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:7px 14px; font-weight:800; cursor:pointer">📥 Inserisci PDF / foto</button>'
    + '<span style="font-size:12px; color:var(--sub); align-self:center">i dati della carta d\'identità o della tessera sanitaria aggiornano questa scheda</span></div>'
    + '<div class="grid">'
    + campo('cognome', 'Cognome *', c.cognome, 'style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"')
    + campo('nome', 'Nome *', c.nome, 'style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"')
    + campo('cf', 'Codice fiscale', c.codiceFiscale, 'maxlength="16" style="text-transform:uppercase; font-family:monospace" oninput="this.value=normalizzaCF(this.value); comuneNelCampo(\'mc-cf\', \'mc-comune\')"')
    + campo('nascita', 'Data di nascita', c.dataNascita, 'placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"')
    + campo('comune', 'Comune di nascita', c.comuneNascita || (c.codiceFiscale && typeof comuneDaCF === 'function' ? comuneDaCF(c.codiceFiscale) : ''), 'placeholder="Si compila dal codice fiscale" style="text-transform:uppercase"' + (c.comuneNascita ? '' : ' data-auto="1"') + ' oninput="this.value=this.value.toUpperCase(); this.dataset.auto=\'\'"')
    + campo('tel', 'Cellulare', c.telefono, 'type="tel" inputmode="tel"')
    + campo('fisso', 'Telefono fisso', c.telefonoFisso, 'type="tel" inputmode="tel"')
    + campo('email', 'E-mail', c.email, 'type="email" inputmode="email" style="text-transform:lowercase"')
    + campo('scad', 'Scadenza documento', c.documentoScadenza, 'placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"')
    + '</div>'
    + '<label class="chk" style="margin-top:8px; font-size:13px"><input type="checkbox" id="mc-pratiche"' + (pratiche.length ? ' checked' : ' disabled') + '> Aggiorna telefoni, e-mail e scadenza documento anche nelle sue pratiche (' + pratiche.length + ')</label>'
    + '<div id="mc-msg" style="color:#c0392b; font-size:12.5px; font-weight:700; margin-top:8px"></div>'
    + '<div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; margin-top:12px"><button type="button" data-az="no" style="background:var(--line); color:var(--ink)">Annulla</button>'
    + '<button type="button" data-az="si" style="background:#1d4f91; color:#fff; font-weight:800">💾 Salva modifiche</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', async function (e) {
    const b = e.target.closest('button[data-az]');
    if (e.target === ov || (b && b.dataset.az === 'no')) { ov.remove(); return; }
    if (!b) return;
    const v = function (id) { return (document.getElementById('mc-' + id).value || '').trim(); };
    const msg = document.getElementById('mc-msg');
    const cognome = v('cognome').toUpperCase(), nome = v('nome').toUpperCase(), cf = normalizzaCF(v('cf'));
    let nascita = v('nascita');
    const tel = v('tel'), fisso = v('fisso'), email = v('email').toLowerCase(), scad = v('scad'), comune = v('comune').toUpperCase();
    if (!cognome || !nome) { msg.textContent = 'Cognome e nome sono obbligatori.'; return; }
    if (cf && !cfValido(cf)) { msg.textContent = 'Il codice fiscale non è valido: controllalo o lascialo vuoto.'; return; }
    if (cf && !nascita) nascita = datiDaCF(cf).dataNascita;
    if (nascita && !parseDataIT(nascita)) { msg.textContent = 'La data di nascita deve essere GG/MM/AAAA.'; return; }
    if (scad && !parseDataIT(scad)) { msg.textContent = 'La scadenza del documento deve essere GG/MM/AAAA.'; return; }
    if (email && !emailValida(email)) { msg.textContent = 'L\'e-mail non è corretta.'; return; }
    if (tel && typeof cellulareSospetto === 'function' && cellulareSospetto(tel) && !confirm(cellulareSospetto(tel) + '\n\nSalvo lo stesso?')) return;
    const altro = cf && (ARCHIVIO_CLIENTI || []).find(function (x) { return x.codiceFiscale === cf && x !== c; });
    if (altro) { msg.textContent = 'Questo codice fiscale è già di ' + altro.nomeCompleto + ' in archivio.'; return; }
    if (cf && typeof controllaCoerenzaCF === 'function') {
      const avvisi = controllaCoerenzaCF(cf, cognome, nome, nascita);
      if (avvisi.length && !confirm('Attenzione: ' + avvisi.join('; ') + '.\n\nSalvo lo stesso?')) return;
    }
    const campi = { nomeCompleto: (cognome + ' ' + nome).trim(), cognome: cognome, nome: nome, dataNascita: nascita || '', codiceFiscale: cf || null, telefono: tel || null, telefonoFisso: fisso || null, email: email || null, documentoScadenza: scad || null, comuneNascita: comune || null };
    b.disabled = true; b.textContent = 'Salvataggio…';
    const r = await data.clienti.aggiorna(c.id, campi);
    if (r && r.error) {
      b.disabled = false; b.textContent = '💾 Salva modifiche';
      msg.textContent = /duplicate|unique/i.test(r.error) ? 'C\'è già in archivio un cliente con lo stesso nome e data di nascita, o con lo stesso codice fiscale.' : 'Non salvato: ' + r.error;
      return;
    }
    // recapiti aggiornati anche nelle sue pratiche (se scelto)
    const aggPratiche = document.getElementById('mc-pratiche') && document.getElementById('mc-pratiche').checked;
    if (aggPratiche) {
      for (const p of pratiche) {
        const cp = {};
        if (tel && tel !== p.telefono) cp.telefono = tel;
        if (fisso && fisso !== p.telefonoFisso) cp.telefonoFisso = fisso;
        if (email && email !== p.email) cp.email = email;
        if (scad && scad !== p.documentoScadenza) cp.documentoScadenza = scad;
        if (cf && !p.codiceFiscale) cp.codiceFiscale = cf;
        if (Object.keys(cp).length) await data.pratiche.aggiorna(p.id, cp);
      }
    }
    Object.assign(c, campi);
    ov.remove();
    avviso('✓ Anagrafica di ' + campi.nomeCompleto + ' aggiornata');
    if (typeof syncDataFromSupabase === 'function') syncDataFromSupabase();
    if (typeof dopo === 'function') dopo();
  });
}
