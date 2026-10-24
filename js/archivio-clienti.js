/* ---------- Archivio clienti: cerca e modifica l'anagrafica senza fare una pratica ----------
   Si completano i dati mancanti (codice fiscale, telefoni, e-mail, scadenza documento…)
   direttamente nell'archivio, che è quello usato da tutte le ricerche del programma. */

// filtri: { senzaCf, senzaTel, doc, conPratiche } per aprire l'archivio già filtrato (es. dal riquadro "Oggi")
function apriArchivioClienti(testo, filtri) {
  filtri = filtri || {};
  ARCHIVIO_VISTA.venuti = ''; ARCHIVIO_VISTA.foglio = 0;
  const vecchio = document.getElementById('popup-archivio'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-archivio';
  ov.style.cssText = 'position:fixed; inset:0; z-index:455; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:12px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid #1d4f91; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:16px 18px; max-width:900px; width:100%; max-height:92vh; display:flex; flex-direction:column">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px"><div style="font-size:19px; font-weight:800; color:#1d4f91">🗂️ Archivio clienti – modifica anagrafica</div>'
    + '<span style="display:flex; gap:6px; flex-wrap:wrap"><button type="button" onclick="apriAuguri()" title="Auguri di Natale e fine anno o di Pasqua a tutti i clienti" style="background:#c0392b; color:#fff; border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer">🎄 Auguri</button><button type="button" data-az="nuovo" style="background:#1a7f37; color:#fff; border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer">➕ Nuovo cliente</button>'
    + '<button type="button" data-az="chiudi" style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:7px 14px; font-weight:700; cursor:pointer">✕ Chiudi</button></span></div>'
    + '<input id="arc-cerca" type="search" placeholder="Cerca per cognome, nome, codice fiscale o telefono…" autocomplete="off" value="' + esc(testo || '') + '" style="margin-bottom:6px">'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; font-size:12.5px">'
    + '<label class="chk" style="margin:0"><input type="checkbox" id="arc-senza-cf"' + (filtri.senzaCf ? ' checked' : '') + '> Senza codice fiscale</label>'
    + '<label class="chk" style="margin:0"><input type="checkbox" id="arc-senza-tel"' + (filtri.senzaTel ? ' checked' : '') + '> Senza cellulare</label>'
    + '<label class="chk" style="margin:0"><input type="checkbox" id="arc-doc"' + (filtri.doc ? ' checked' : '') + '> Documento scaduto o mancante</label>'
    + '<label class="chk" style="margin:0"><input type="checkbox" id="arc-con-pratiche"' + (filtri.conPratiche ? ' checked' : '') + '> Solo clienti con pratiche (quest\'anno e l\'anno scorso)</label>'
    + '<label class="chk" style="margin:0"><input type="checkbox" id="arc-deceduti"' + (filtri.deceduti ? ' checked' : '') + '> ✝️ Solo deceduti</label>'
    + '<select id="arc-ruolo" style="width:auto; padding:4px 8px; font-size:12.5px" title="Dichiaranti o coniugi"><option value="">Dichiaranti e coniugi</option><option value="dichiarante">👤 Solo dichiaranti</option><option value="coniuge">💑 Solo coniugi dichiaranti</option></select>'
    + '<select id="arc-collab" style="width:auto; padding:4px 8px; font-size:12.5px" title="Solo i clienti di un collaboratore"><option value="">🤝 Tutti i collaboratori</option><option value="-">Senza collaboratore</option>' + getTipiList().map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('') + '</select>'
    + (function () {
      // riferimento: chi ha portato il cliente, con quanti clienti ha portato
      const n = {};
      (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).forEach(function (c) { const r = String(c.riferimento || '').trim().toUpperCase(); if (r) n[r] = (n[r] || 0) + 1; });
      const l = Object.keys(n).sort(function (a, b) { return (n[b] - n[a]) || a.localeCompare(b); });
      return l.length ? '<select id="arc-rif" style="width:auto; padding:4px 8px; font-size:12.5px" title="Solo i clienti portati da una persona"><option value="">👤 Tutti i riferimenti</option>' + l.map(function (r) { return '<option value="' + esc(r) + '"' + (filtri.rif === r ? ' selected' : '') + '>' + esc(r) + ' (' + n[r] + ')</option>'; }).join('') + '</select>' : '';
    })() + '</div>'
    + '<div id="arc-collab-conta" style="display:none; margin-bottom:8px; font-size:13px"></div>'
    + '<div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center; margin-bottom:6px; font-size:12.5px"><b style="color:var(--sub)">📄 Quanti per foglio:</b>'
    + [80, 300, 500, 0].map(function (n) { return '<button type="button" data-perfoglio="' + n + '" style="padding:3px 11px; border-radius:999px; font-size:12px; font-weight:700; cursor:pointer; border:2px solid #1d4f91"></button>'; }).join('') + '</div>'
    + '<div id="arc-lista" style="overflow:auto; flex:1; border:1px solid var(--line); border-radius:10px"></div>'
    + '<div id="arc-fogli" style="display:flex; gap:8px; justify-content:center; align-items:center; flex-wrap:wrap; margin-top:6px"></div>'
    + '<div id="arc-conta" style="font-size:12px; color:var(--sub); margin-top:6px"></div></div>';
  document.body.appendChild(ov);
  const disegna = function () {
    const q = (document.getElementById('arc-cerca').value || '').trim().toUpperCase();
    const senzaCf = document.getElementById('arc-senza-cf').checked, senzaTel = document.getElementById('arc-senza-tel').checked, doc = document.getElementById('arc-doc').checked;
    const conPrat = document.getElementById('arc-con-pratiche').checked, deceduti = document.getElementById('arc-deceduti').checked, collab = document.getElementById('arc-collab').value, ruolo = document.getElementById('arc-ruolo').value;
    const rif = (document.getElementById('arc-rif') || {}).value || '';
    const recenti = conPrat ? clientiConPraticheRecenti() : null;
    const oggi = typeof dataNum === 'function' ? dataNum(todayIT()) : 0;
    const tutti = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []);
    const filtrati = tutti.filter(function (c) {
      // i deceduti si vedono con «Solo deceduti» o cercandoli per nome; non contano nei dati da completare
      if (deceduti) { if (!c.decedutoIl) return false; }
      else if (c.decedutoIl && (!q || senzaCf || senzaTel || doc || conPrat)) return false;
      if (ruolo && c.ruoloDichiarazione !== ruolo) return false;
      if (rif && String(c.riferimento || '').trim().toUpperCase() !== rif) return false;
      if (collab === '-' ? !!c.collaboratore : (collab && c.collaboratore !== collab)) return false;
      if (recenti && !(c.codiceFiscale && recenti.cf[c.codiceFiscale]) && !recenti.nome[String(c.nomeCompleto || '').toUpperCase()]) return false;
      if (senzaCf && c.codiceFiscale) return false;
      if (senzaTel && c.telefono) return false;
      if (doc && c.documentoScadenza && (dataNum(c.documentoScadenza) || 0) >= oggi) return false;
      if (!q) return true;
      if ([c.nomeCompleto, c.codiceFiscale, c.telefono, c.telefonoFisso, c.email, c.riferimento].join(' ').toUpperCase().indexOf(q) >= 0) return true;
      const kq = typeof chiaveRicerca === 'function' ? chiaveRicerca(q) : '';
      return !!kq && (chiaveRicerca(c.nomeCompleto) + '|' + chiaveRicerca(c.nome) + chiaveRicerca(c.cognome) + '|' + chiaveRicerca(c.codiceFiscale) + '|' + chiaveRicerca(c.telefono) + '|' + chiaveRicerca(c.telefonoFisso)).indexOf(kq) >= 0;
    });
    // filtro per collaboratore: chi ha già fatto la pratica nell'anno e chi non ancora
    const box = document.getElementById('arc-collab-conta');
    let lista = filtrati;
    if (collab && collab !== '-') {
      const anno = annoAttivo(), qui = clientiConPraticheAnno(anno);
      const venuto = function (c) { return (c.codiceFiscale && qui.cf[c.codiceFiscale]) || qui.nome[String(c.nomeCompleto || '').toUpperCase()]; };
      const si = filtrati.filter(venuto).length, no = filtrati.length - si;
      if (ARCHIVIO_VISTA.venuti === 'si') lista = filtrati.filter(venuto);
      if (ARCHIVIO_VISTA.venuti === 'no') lista = filtrati.filter(function (c) { return !venuto(c); });
      const chip = function (k, testo, n, col) { const on = ARCHIVIO_VISTA.venuti === k; return '<button type="button" data-venuti="' + k + '" style="padding:4px 12px; border-radius:999px; font-size:12.5px; font-weight:700; cursor:pointer; border:2px solid ' + col + '; background:' + (on ? col : 'transparent') + '; color:' + (on ? '#fff' : col) + '">' + testo + ' <b>' + n + '</b></button>'; };
      box.style.display = 'flex'; box.style.cssText += '; gap:6px; flex-wrap:wrap; align-items:center';
      box.innerHTML = '<b>🤝 ' + esc(collab) + ':</b> ' + filtrati.length + ' clienti, di cui'
        + chip('si', '✅ già venuti nel ' + anno, si, '#1a7f37') + chip('no', '⏳ non ancora', no, '#c0392b') + chip('', 'Tutti', filtrati.length, '#374151');
      lista.forEach(function (c) { c._venuto = !!venuto(c); });
    } else { box.style.display = 'none'; box.innerHTML = ''; filtrati.forEach(function (c) { c._venuto = undefined; }); }
    // sempre in ordine alfabetico, a fogli (80, 300, 500 per foglio o tutti)
    lista = lista.slice().sort(function (a, b) { return String(a.nomeCompleto || '').localeCompare(String(b.nomeCompleto || ''), 'it'); });
    const perFoglio = clientiPerFoglio(), fogli = perFoglio ? Math.max(1, Math.ceil(lista.length / perFoglio)) : 1;
    if (ARCHIVIO_VISTA.foglio >= fogli) ARCHIVIO_VISTA.foglio = fogli - 1;
    const inizio = perFoglio ? ARCHIVIO_VISTA.foglio * perFoglio : 0;
    const mostra = perFoglio ? lista.slice(inizio, inizio + perFoglio) : lista;
    document.querySelectorAll('#popup-archivio button[data-perfoglio]').forEach(function (b) {
      const on = Number(b.dataset.perfoglio) === perFoglio;
      b.textContent = b.dataset.perfoglio === '0' ? 'Tutti' : b.dataset.perfoglio;
      b.style.background = on ? '#1d4f91' : 'transparent'; b.style.color = on ? '#fff' : '#1d4f91';
    });
    const nomeBreve = function (c) { return c ? esc(String(c.nomeCompleto || '').split(' ')[0]) : ''; };
    const bFoglio = function (dir, testo, attivo) { return '<button type="button" data-foglio="' + dir + '"' + (attivo ? '' : ' disabled') + ' style="padding:6px 14px; border-radius:999px; font-weight:800; cursor:pointer; border:none; background:#1d4f91; color:#fff; opacity:' + (attivo ? 1 : .35) + '">' + testo + '</button>'; };
    document.getElementById('arc-fogli').innerHTML = fogli > 1
      ? bFoglio(-1, '◀ Foglio precedente', ARCHIVIO_VISTA.foglio > 0)
        + '<b style="font-size:13.5px">Foglio ' + (ARCHIVIO_VISTA.foglio + 1) + ' di ' + fogli + '</b> <span class="sub2">(da ' + nomeBreve(mostra[0]) + ' a ' + nomeBreve(mostra[mostra.length - 1]) + ')</span>'
        + bFoglio(1, 'Foglio successivo ▶', ARCHIVIO_VISTA.foglio < fogli - 1)
      : '';
    document.getElementById('arc-lista').innerHTML = mostra.length ? mostra.map(function (c) {
      const manca = [!c.codiceFiscale ? 'CF' : '', !c.telefono && !c.telefonoFisso ? 'telefono' : '', !c.documentoScadenza ? 'scad. documento' : ''].filter(Boolean);
      const scaduto = c.documentoScadenza && (dataNum(c.documentoScadenza) || 0) < oggi;
      return '<div data-id="' + esc(String(c.id || '')) + '" data-nome="' + esc(c.nomeCompleto) + '" style="display:flex; gap:10px; align-items:center; padding:8px 10px; border-bottom:1px solid var(--line); cursor:pointer' + (c.decedutoIl ? '; background:color-mix(in srgb, #6b7280 12%, var(--card))' : '') + '">'
        + '<span style="flex:1"><b>' + esc(c.nomeCompleto) + '</b>' + badgeCollaboratore(c) + badgeRuolo(c) + badgeRiferimento(c) + (c.noWhatsapp ? ' <span style="font-size:11.5px; font-weight:800; color:#b35f0c" title="Il cellulare non ha WhatsApp">📵 senza WhatsApp</span>' : '') + (c.noMessaggi ? ' <span style="font-size:11.5px; font-weight:800; color:#c0392b" title="Non vuole ricevere messaggi">🚫 no messaggi</span>' : '') + (c._venuto === true ? ' <span style="font-size:11.5px; font-weight:800; color:#1a7f37">✅ pratica ' + annoAttivo() + '</span>' : (c._venuto === false ? ' <span style="font-size:11.5px; font-weight:800; color:#c0392b">⏳ non ancora venuto</span>' : '')) + (c.decedutoIl ? ' <span style="display:inline-block; background:#374151; color:#fff; border-radius:999px; padding:1px 8px; font-size:11.5px; font-weight:700">✝️ deceduto/a il ' + esc(c.decedutoIl) + '</span>' : '') + '<div style="font-size:12px; color:var(--sub)">'
        + (c.dataNascita ? 'nato/a il ' + esc(c.dataNascita) : 'data di nascita mancante') + ((c.comuneNascita || (c.codiceFiscale && typeof comuneDaCF === 'function' && comuneDaCF(c.codiceFiscale))) ? ' a ' + esc(c.comuneNascita || comuneDaCF(c.codiceFiscale)) : '') + (c.codiceFiscale ? ' · CF ' + esc(c.codiceFiscale) : '')
        + (c.telefono || c.telefonoFisso ? ' · 📞 ' + esc(c.telefono || c.telefonoFisso) : '') + (c.email ? ' · ✉️ ' + esc(c.email) : '')
        + (c.documentoScadenza ? ' · 🪪 ' + esc(c.documentoScadenza) + (scaduto ? ' <b style="color:#c0392b">scaduto</b>' : '') : '') + '</div>'
        // documento scaduto o mancante: richiesta diretta del nuovo documento
        + ((scaduto || !c.documentoScadenza) && !c.decedutoIl && c.id ? '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px"><button type="button" data-az="doc-wa" data-cid="' + esc(String(c.id)) + '" title="Chiedi il nuovo documento su WhatsApp" style="background:#25d366; color:#fff; border:none; border-radius:999px; padding:3px 10px; font-size:11.5px; font-weight:700; cursor:pointer">💬 Chiedi documento</button>'
          + '<button type="button" data-az="doc-mail" data-cid="' + esc(String(c.id)) + '" title="Chiedi il nuovo documento per e-mail" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:3px 10px; font-size:11.5px; font-weight:700; cursor:pointer">📧 E-mail</button></div>' : '')
        + (typeof ultimoContattoHTML === 'function' ? ultimoContattoHTML(c.nomeCompleto, c.codiceFiscale) : '')
        + (manca.length && !c.decedutoIl ? '<div style="font-size:11.5px; color:#b35f0c; font-weight:700">Manca: ' + manca.join(', ') + '</div>' : '') + '</span>'
        + '<span style="background:#1d4f91; color:#fff; border-radius:999px; padding:5px 12px; font-size:12.5px; font-weight:700; white-space:nowrap">✏️ Modifica</span></div>';
    }).join('') : '<div class="empty" style="padding:14px">Nessun cliente trovato</div>';
    const nDec = tutti.filter(function (c) { return c.decedutoIl; }).length;
    document.getElementById('arc-conta').textContent = lista.length + ' clienti' + (lista.length > mostra.length ? ' (ne vedi ' + mostra.length + ': dal ' + (inizio + 1) + '° al ' + (inizio + mostra.length) + '°)' : '') + ' · archivio: ' + tutti.length + ' clienti' + (nDec ? ' (di cui ' + nDec + ' deceduti, nascosti: si vedono cercandoli per nome o con «Solo deceduti»)' : '');
  };
  disegna();
  setTimeout(function () { const el = document.getElementById('arc-cerca'); if (el) el.focus(); }, 50);
  ov.addEventListener('input', function (e) { if (e.target.id === 'arc-cerca') { ARCHIVIO_VISTA.foglio = 0; disegna(); } });
  ov.addEventListener('change', function (e) { if (e.target.id === 'arc-collab') ARCHIVIO_VISTA.venuti = ''; if (/^arc-/.test(e.target.id) && e.target.id !== 'arc-cerca') { ARCHIVIO_VISTA.foglio = 0; disegna(); } });
  ov.addEventListener('click', function (e) {
    const bv = e.target.closest('button[data-venuti]');
    if (bv) { ARCHIVIO_VISTA.venuti = bv.dataset.venuti; ARCHIVIO_VISTA.foglio = 0; disegna(); return; }
    const bp = e.target.closest('button[data-perfoglio]');
    if (bp) { try { localStorage.setItem('archivio-per-foglio', bp.dataset.perfoglio); } catch (x) {} ARCHIVIO_VISTA.foglio = 0; disegna(); document.getElementById('arc-lista').scrollTop = 0; return; }
    const bf = e.target.closest('button[data-foglio]');
    if (bf) { ARCHIVIO_VISTA.foglio += Number(bf.dataset.foglio); disegna(); document.getElementById('arc-lista').scrollTop = 0; return; }
    const b = e.target.closest('button[data-az]');
    if (e.target === ov || (b && b.dataset.az === 'chiudi')) { ov.remove(); return; }
    if (b && (b.dataset.az === 'doc-wa' || b.dataset.az === 'doc-mail')) { if (typeof richiediDocumentoCliente === 'function') richiediDocumentoCliente(b.dataset.cid, b.dataset.az === 'doc-mail' ? 'email' : 'wa'); return; }
    if (b && b.dataset.az === 'nuovo') { if (typeof nuovoClienteArchivio === 'function') nuovoClienteArchivio(document.getElementById('arc-cerca').value, function () { disegna(); }); return; }
    const r = e.target.closest('div[data-nome]');
    if (!r) return;
    const c = (ARCHIVIO_CLIENTI || []).find(function (x) { return r.dataset.id ? String(x.id) === r.dataset.id : x.nomeCompleto === r.dataset.nome; });
    if (c) modificaClienteArchivio(c, disegna);
  });
}

const ARCHIVIO_VISTA = { venuti: '', foglio: 0 };
// Quanti clienti per foglio nell'archivio (0 = tutti); il programma lo ricorda
function clientiPerFoglio() {
  let n = 80; try { const v = localStorage.getItem('archivio-per-foglio'); if (v !== null && [80, 300, 500, 0].indexOf(Number(v)) >= 0) n = Number(v); } catch (e) {}
  return n;
}
// Elenco dei nomi dell'archivio da proporre scrivendo (es. il dichiarante del coniuge)
function datalistNomiArchivio() {
  const vecchio = document.getElementById('lista-nomi-archivio'); if (vecchio) vecchio.remove();
  return '<datalist id="lista-nomi-archivio">' + (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).filter(function (x) { return !x.decedutoIl && x.nomeCompleto; }).map(function (x) { return '<option value="' + esc(String(x.nomeCompleto).toUpperCase()) + '">'; }).join('') + '</datalist>';
}
// Clienti con una pratica (titolare o coniuge, non annullata) nell'anno indicato
function clientiConPraticheAnno(anno) {
  const cf = {}, nome = {};
  (state.pratiche || []).forEach(function (p) {
    if (p.annullata || annoPratica(p) !== anno) return;
    if (p.codiceFiscale) cf[String(p.codiceFiscale).toUpperCase()] = true;
    if (p.nome) nome[String(p.nome).trim().toUpperCase()] = true;
    if (p.congCodiceFiscale) cf[String(p.congCodiceFiscale).toUpperCase()] = true;
    const con = ((p.congCognome || '') + ' ' + (p.congNome || '')).trim() || p.congiunta;
    if (con) nome[String(con).trim().toUpperCase()] = true;
  });
  return { cf: cf, nome: nome };
}
// Clienti che hanno pratiche nell'anno in corso o in quello prima (per completare prima i dati di chi viene davvero)
function clientiConPraticheRecenti() {
  const da = annoAttivo() - 1, cf = {}, nome = {};
  (state.pratiche || []).concat(state.annullate || []).forEach(function (p) {
    if (annoPratica(p) < da) return;
    if (p.codiceFiscale) cf[String(p.codiceFiscale).toUpperCase()] = true;
    if (p.nome) nome[String(p.nome).trim().toUpperCase()] = true;
    if (p.congCodiceFiscale) cf[String(p.congCodiceFiscale).toUpperCase()] = true;
    const con = ((p.congCognome || '') + ' ' + (p.congNome || '')).trim() || p.congiunta;
    if (con) nome[String(con).trim().toUpperCase()] = true;
  });
  return { cf: cf, nome: nome };
}
function modificaClienteArchivio(c, dopo) {
  if (!c.id) { avviso('Cliente appena inserito: riapri l\'archivio tra qualche secondo per modificarlo', true); return; }
  const vecchio = document.getElementById('popup-mod-cliente'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-mod-cliente';
  ov.style.cssText = 'position:fixed; inset:0; z-index:475; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:14px';
  const campo = function (id, etichetta, valore, attr) { return '<div><label>' + etichetta + '</label><input id="mc-' + id + '" value="' + esc(valore || '') + '" ' + (attr || '') + '></div>'; };
  const pratiche = (state.pratiche || []).filter(function (p) { return (p.codiceFiscale && p.codiceFiscale === c.codiceFiscale) || (p.nome || '').toUpperCase() === (c.nomeCompleto || '').toUpperCase(); });
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid #1d4f91; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:12px 18px; max-width:1100px; width:100%; max-height:96vh; overflow:auto">'
    + '<div style="font-size:19px; font-weight:800; color:#1d4f91">✏️ ' + esc(c.nomeCompleto) + '</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:10px">Modifichi la scheda dell\'archivio: i nuovi dati si useranno nelle prossime pratiche e in tutte le ricerche.'
    + (pratiche.length ? ' Ha ' + pratiche.length + (pratiche.length === 1 ? ' pratica' : ' pratiche') + ' nell\'anno caricato.' : '') + '</div>'
    + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px">'
    + '<button type="button" onclick="apriLetturaDocumentoPer(\'modifica\')" style="background:#2f9e9e; color:#fff; border:none; border-radius:999px; padding:7px 14px; font-weight:800; cursor:pointer">📷 Leggi documento</button>'
    + '<button type="button" onclick="apriInserisciDocumento(\'modifica\')" style="background:#1d4f91; color:#fff; border:none; border-radius:999px; padding:7px 14px; font-weight:800; cursor:pointer">📥 Inserisci PDF / foto</button>'
    + '<span style="font-size:12px; color:var(--sub); align-self:center">i dati della carta d\'identità o della tessera sanitaria aggiornano questa scheda</span></div>'
    + '<div class="grid grid-largo">'
    + campo('cognome', 'Cognome *', c.cognome, 'style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"')
    + campo('nome', 'Nome *', c.nome, 'style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"')
    + campo('cf', 'Codice fiscale', c.codiceFiscale, 'maxlength="16" style="text-transform:uppercase; font-family:monospace" oninput="this.value=normalizzaCF(this.value); comuneNelCampo(\'mc-cf\', \'mc-comune\'); datiAnagraficiDaCF({ cf: \'mc-cf\', data: \'mc-nascita\', sesso: \'mc-sesso\', comune: \'mc-comune\' })"')
    + campo('nascita', 'Data di nascita', c.dataNascita, 'placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"')
    + (typeof htmlSessoComune === 'function' ? htmlSessoComune('mc-', '', null) : '')
    + campo('comune', 'Comune di nascita', c.comuneNascita || (c.codiceFiscale && typeof comuneDaCF === 'function' ? comuneDaCF(c.codiceFiscale) : ''), 'list="lista-comuni" autocomplete="off" placeholder="Es. MESSINA (ME)" style="text-transform:uppercase"' + (c.comuneNascita ? '' : ' data-auto="1"') + ' oninput="this.value=this.value.toUpperCase(); this.dataset.auto=\'\'"')
    + campo('tel', 'Cellulare', c.telefono, 'type="tel" inputmode="tel"')
    + campo('fisso', 'Telefono fisso', c.telefonoFisso, 'type="tel" inputmode="tel"')
    + campo('email', 'E-mail', c.email, 'type="email" inputmode="email" style="text-transform:lowercase"')
    + campo('scad', 'Scadenza documento', c.documentoScadenza, 'placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)"')
    + '<div><label>Tipo documento</label><select id="mc-doctipo">' + (typeof opzioniTipoDoc === 'function' ? opzioniTipoDoc(c.documentoTipo || '') : '') + '</select></div>'
    + campo('docnum', 'N. documento', c.documentoNumero, 'style="text-transform:uppercase; font-family:monospace" oninput="this.value=this.value.toUpperCase().replace(/\\s+/g, \'\')"')
    + '<div><label>Ruolo nella dichiarazione</label><select id="mc-ruolo" onchange="document.getElementById(\'mc-dich-box\').style.display = this.value === \'coniuge\' ? \'\' : \'none\'">' + opzioniRuoloDichiarazione(c.ruoloDichiarazione || '') + '</select></div>'
    + '<div><label title="A chi appartiene il cliente: nelle nuove pratiche il tipo si propone da solo">🤝 Collaboratore</label><select id="mc-collab">' + opzioniCollaboratore(c.collaboratore || '') + '</select></div>'
    + '<div class="full" id="mc-dich-box" style="' + (c.ruoloDichiarazione === 'coniuge' ? '' : 'display:none') + '"><label>💑 Dichiarante (titolare della congiunta): cognome e nome, data di nascita</label>' + campiDichiaranteHTML('mc-', c.dichiaranteNome || coniugeDiCliente(c) || '', nascitaDichiaranteCliente(c)) + '</div>'
    + '<div><label>👤 Riferimento <span style="font-weight:600; color:var(--sub)">(chi ha portato il cliente)</span></label><input id="mc-riferimento" list="lista-nomi-archivio" value="' + esc(c.riferimento || '') + '" placeholder="Facoltativo: cognome e nome" autocomplete="off" style="text-transform:uppercase"></div>'
    + '<div class="largo2"><label>📝 Note</label><textarea id="mc-note" rows="1" placeholder="Facoltative" style="width:100%; resize:vertical; font-family:inherit">' + esc(c.note || '') + '</textarea></div>'
    + '<div class="full" style="margin-top:4px"><label class="chk" style="margin:0; font-size:13px; color:var(--ink)"><input type="checkbox" id="mc-no-whatsapp"' + (c.noWhatsapp ? ' checked' : '') + '> 📵 <b>Il cellulare non ha WhatsApp</b> <span style="color:var(--sub)">(i messaggi a tutti useranno l\'e-mail; si toglie da solo se cambi il cellulare)</span></label></div>'
    + '<div class="full" style="margin-top:4px"><label class="chk" style="margin:0; font-size:13px; color:var(--ink)"><input type="checkbox" id="mc-no-messaggi"' + (c.noMessaggi ? ' checked' : '') + '> 🚫 <b>Non vuole ricevere messaggi</b> <span style="color:var(--sub)">(niente auguri, avvio campagna e richiami a tutti)</span></label></div>'
    + '<div class="full" style="margin-top:4px; padding:8px 10px; border-radius:10px; border:1.5px dashed #6b7280"><label>✝️ Deceduto/a il <span style="font-weight:600; color:var(--sub)">(lascia vuoto se in vita)</span></label><input id="mc-deceduto" value="' + esc(c.decedutoIl || '') + '" placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)" style="max-width:180px"><div style="font-size:11.5px; color:var(--sub); margin-top:3px">La scheda resta in archivio, ma non compare più nelle ricerche normali, tra i clienti da richiamare e tra i dati da completare.</div></div>'
    + '</div>'
    + (typeof elencoComunicazioniHTML === 'function' ? '<div style="margin-top:10px">' + elencoComunicazioniHTML(c.nomeCompleto, c.codiceFiscale, 8) + '</div>' : '')
    + '<label class="chk" style="margin-top:8px; font-size:13px"><input type="checkbox" id="mc-pratiche"' + (pratiche.length ? ' checked' : ' disabled') + '> Aggiorna telefoni, e-mail e scadenza documento anche nelle sue pratiche (' + pratiche.length + ')</label>'
    + '<div id="mc-msg" style="color:#c0392b; font-size:12.5px; font-weight:700; margin-top:8px"></div>'
    + '<div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; margin-top:12px"><button type="button" data-az="no" style="background:var(--line); color:var(--ink)">Annulla</button>'
    + '<button type="button" data-az="si" style="background:#1d4f91; color:#fff; font-weight:800">💾 Salva modifiche</button></div></div>';
  document.body.appendChild(ov);
  // codice fiscale vuoto: si calcola da cognome, nome, data, sesso e comune
  if (typeof collegaCFAuto === 'function') collegaCFAuto({ cognome: 'mc-cognome', nome: 'mc-nome', data: 'mc-nascita', sesso: 'mc-sesso', comune: 'mc-comune', cf: 'mc-cf' });
  ov.addEventListener('click', async function (e) {
    const b = e.target.closest('button[data-az]');
    if (e.target === ov || (b && b.dataset.az === 'no')) { ov.remove(); return; }
    if (!b) return;
    const v = function (id) { return (document.getElementById('mc-' + id).value || '').trim(); };
    const msg = document.getElementById('mc-msg');
    const cognome = v('cognome').toUpperCase(), nome = v('nome').toUpperCase(), cf = normalizzaCF(v('cf'));
    let nascita = v('nascita');
    const tel = v('tel'), fisso = v('fisso'), email = v('email').toLowerCase(), scad = v('scad'), comune = v('comune').toUpperCase(), docnum = v('docnum').toUpperCase().replace(/\s+/g, ''), doctipo = v('doctipo');
    if (!cognome || !nome) { msg.textContent = 'Cognome e nome sono obbligatori.'; return; }
    if (cf && !cfValido(cf)) { msg.textContent = 'Il codice fiscale non è valido: controllalo o lascialo vuoto.'; return; }
    if (cf && !nascita) nascita = datiDaCF(cf).dataNascita;
    if (nascita && !parseDataIT(nascita)) { msg.textContent = 'La data di nascita deve essere GG/MM/AAAA.'; return; }
    if (scad && !parseDataIT(scad)) { msg.textContent = 'La scadenza del documento deve essere GG/MM/AAAA.'; return; }
    const deceduto = v('deceduto');
    if (v('ruolo') === 'coniuge' && v('dichiarante-nascita') && !parseDataIT(v('dichiarante-nascita'))) { msg.textContent = 'La data di nascita del dichiarante deve essere GG/MM/AAAA.'; return; }
    if (deceduto && !parseDataIT(deceduto)) { msg.textContent = 'La data del decesso deve essere GG/MM/AAAA.'; return; }
    if (deceduto && typeof dataNum === 'function' && dataNum(deceduto) > dataNum(todayIT())) { msg.textContent = 'La data del decesso non può essere nel futuro.'; return; }
    if (email && !emailValida(email)) { msg.textContent = 'L\'e-mail non è corretta.'; return; }
    if (tel && typeof cellulareSospetto === 'function' && cellulareSospetto(tel) && !confirm(cellulareSospetto(tel) + '\n\nSalvo lo stesso?')) return;
    const altro = cf && (ARCHIVIO_CLIENTI || []).find(function (x) { return x.codiceFiscale === cf && x !== c; });
    if (altro) { msg.textContent = 'Questo codice fiscale è già di ' + altro.nomeCompleto + ' in archivio.'; return; }
    if (cf && typeof controllaCoerenzaCF === 'function') {
      const avvisi = controllaCoerenzaCF(cf, cognome, nome, nascita);
      if (avvisi.length && !confirm('Attenzione: ' + avvisi.join('; ') + '.\n\nSalvo lo stesso?')) return;
    }
    const campi = { nomeCompleto: (cognome + ' ' + nome).trim(), cognome: cognome, nome: nome, dataNascita: nascita || '', codiceFiscale: cf || null, telefono: tel || null, telefonoFisso: fisso || null, email: email || null, documentoScadenza: scad || null, comuneNascita: comune || null, documentoNumero: docnum || null, documentoTipo: doctipo || null, decedutoIl: deceduto || null, collaboratore: v('collab') || null, ruoloDichiarazione: v('ruolo') || null, dichiaranteNome: v('ruolo') === 'coniuge' ? (v('dichiarante').toUpperCase() || null) : null, dichiaranteNascita: v('ruolo') === 'coniuge' ? (v('dichiarante-nascita') || null) : null, noMessaggi: !!(document.getElementById('mc-no-messaggi') && document.getElementById('mc-no-messaggi').checked),
      // cellulare cambiato: si riprova con WhatsApp
      riferimento: v('riferimento').toUpperCase() || null, note: ((document.getElementById('mc-note') || {}).value || '').trim().slice(0, 2000) || null,
      noWhatsapp: !!(document.getElementById('mc-no-whatsapp') && document.getElementById('mc-no-whatsapp').checked) && numeroWhatsApp(tel) === numeroWhatsApp(c.telefono) };
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
        if (docnum && docnum !== p.documentoNumero) cp.documentoNumero = docnum;
        if (doctipo && doctipo !== p.documentoTipo) cp.documentoTipo = doctipo;
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
