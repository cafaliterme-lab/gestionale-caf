/* ---------------- Colf e badanti: trasferimento delle pratiche attive all'anno successivo ---------------- */
// Le pratiche colf in corso (non «Pratica cessata») di un anno vengono ricreate nell'anno dopo (registro altre pratiche, nuovo numero AP)
// con la stessa scadenza dell'assistenza; la pratica vecchia resta nello storico, segnata "Trasferita nel …",
// e la sua scadenza passa alla pratica nuova.

function colfDaTrasferire(annoDa) {
  return (state.pratiche || []).filter(function (p) {
    // contratto in corso: qualsiasi stato tranne «Pratica cessata» (come per le buste paga)
    return eColf(p.tipo) && annoPratica(p) === annoDa && p.stato !== 'pratica_cessata' && !p.annullata && !p.trasferitaIn;
  }).sort(function (a, b) {
    // stesso cliente con più pratiche (es. rinnovo durante l'anno): prima quella con la scadenza più lontana,
    // così passa al nuovo anno quella giusta e le altre risultano già presenti (non duplicate)
    return String(a.nome || '').localeCompare(String(b.nome || '')) || ((dataNum(b.scadenzaAssistenza) || 0) - (dataNum(a.scadenzaAssistenza) || 0));
  });
}

// Avviso in cima al Registro: pratiche colf attive dell'anno precedente non ancora portate nell'anno di protocollo
function avvisoTrasferimentoColfHTML() {
  if (!auth.profilo || document.body.classList.contains('sola-lettura')) return '';
  const da = annoAttivo() - 1, n = colfDaTrasferire(da).length;
  if (!n) return '';
  if (trasferimentoColfAutomatico()) setTimeout(trasferisciColfAutomatico, 1500);
  return '<div style="margin-bottom:12px; padding:10px 14px; border-radius:12px; background:#e8f6f1; border:2px solid #1f8a70; display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between">'
    + '<span><b style="color:#1f8a70">🧹 Colf e badanti:</b> ' + n + ' pratiche <b>in corso</b> del ' + da + ' non sono ancora state trasferite nel ' + annoAttivo() + '.</span>'
    + '<button type="button" onclick="apriTrasferimentoColf(' + da + ')" style="background:#1f8a70; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:800; cursor:pointer">➡️ Trasferisci nel ' + annoAttivo() + '</button></div>';
}

// Tasto nel gruppo colf del Registro: trasferisce le attive dell'anno di protocollo all'anno successivo
function bottoneTrasferimentoColf(k) {
  if (!eColf(k) || document.body.classList.contains('sola-lettura')) return '';
  const da = colfDaTrasferire(annoAttivo() - 1).length ? annoAttivo() - 1 : annoAttivo();
  return '<button type="button" onclick="apriTrasferimentoColf(' + da + ')" style="background:#1f8a70; color:#fff; border:none; border-radius:999px; padding:5px 14px; font-weight:800; cursor:pointer; margin-right:6px">➡️ Trasferisci attive nel ' + (da + 1) + '</button>';
}

function apriTrasferimentoColf(annoDa) {
  const annoA = annoDa + 1;
  const lista = colfDaTrasferire(annoDa);
  if (!lista.length) { avviso('Nessuna pratica colf e badanti "Pratica attiva" del ' + annoDa + ' da trasferire'); return; }
  const vecchio = document.getElementById('popup-trasf-colf'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-trasf-colf';
  ov.style.cssText = 'position:fixed; inset:0; z-index:470; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:18px; border:3px solid #1f8a70; box-shadow:0 20px 50px rgba(0,0,0,.3); padding:18px 20px; max-width:680px; width:100%; max-height:92vh; display:flex; flex-direction:column">'
    + '<div style="font-size:19px; font-weight:800; color:#1f8a70">➡️ Trasferisci colf e badanti dal ' + annoDa + ' al ' + annoA + '</div>'
    + '<div style="font-size:13px; color:var(--sub); margin:2px 0 10px">Per ogni pratica spuntata il contratto continua nel <b>' + annoA + '</b> come <b>🔁 continuazione</b>: <b>nessun numero nuovo</b> (resta il protocollo d\'origine, es. AP-0002/' + annoDa + '), non conta tra le pratiche nuove dell\'anno, con gli stessi dati e lavoratore, stato <b>Pratica attiva</b>, la stessa <b>scadenza dell\'assistenza</b> e la stessa fattura (da pagare). I pagamenti del ' + annoA + ' entrano nella contabilità del ' + annoA + '. La pratica del ' + annoDa + ' resta nello storico come "Trasferita".</div>'
    + '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px"><button type="button" data-tutte="1" style="padding:5px 12px">☑ Seleziona tutte</button><button type="button" data-tutte="0" style="padding:5px 12px">☐ Nessuna</button></div>'
    + '<div style="overflow:auto; flex:1; border:1px solid var(--line); border-radius:10px">'
    + lista.map(function (p) {
      return '<label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid var(--line); cursor:pointer; margin:0">'
        + '<input type="checkbox" class="tc-chk" value="' + p.id + '" checked style="width:auto; margin:0">'
        + '<span style="flex:1"><b>' + esc((p.nome || '').toUpperCase()) + '</b><div class="sub2">' + formattaProtocollo(p) + (p.telefono ? ' · 📱 ' + esc(p.telefono) : '') + (p.lavCognome || p.lavNome ? ' · 👷 ' + esc(((p.lavCognome || '') + ' ' + (p.lavNome || '')).trim()) : '') + ' · ' + esc(statoLabel(p.stato)) + '</div></span>'
        + '<span style="white-space:nowrap; text-align:right">' + (p.scadenzaAssistenza ? ((dataNum(p.scadenzaAssistenza) || 0) < dataNum(todayIT()) ? '<span style="color:#c0392b; font-weight:800" title="Scadenza passata: controlla se è stata rinnovata o se il contratto è cessato">⚠️ scaduta il ' + esc(p.scadenzaAssistenza) + '</span>' : '⏰ ' + esc(p.scadenzaAssistenza)) : '<span style="color:#c0392b">senza scadenza</span>') + '<div class="sub2">fattura ' + fmtEuro(p.compenso) + '</div></span></label>';
    }).join('') + '</div>'
    + '<div id="tc-esito" style="font-size:13px; margin-top:8px"></div>'
    + '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:10px"><button type="button" data-azione="no" style="background:var(--line); color:var(--ink)">Annulla</button><button type="button" data-azione="si" style="background:#1f8a70; color:#fff; font-weight:800">➡️ Trasferisci</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', async function (e) {
    const t = e.target.closest('button[data-tutte]');
    if (t) { ov.querySelectorAll('.tc-chk').forEach(function (c) { c.checked = t.dataset.tutte === '1'; }); return; }
    const b = e.target.closest('button[data-azione]');
    if (!b && e.target !== ov) return;
    if (!b || b.dataset.azione === 'no') { ov.remove(); return; }
    const scelte = Array.from(ov.querySelectorAll('.tc-chk')).filter(function (c) { return c.checked; }).map(function (c) { return lista.find(function (p) { return p.id === c.value; }); });
    const esito = document.getElementById('tc-esito');
    if (!scelte.length) { esito.innerHTML = '<b style="color:#c0392b">Spunta almeno una pratica</b>'; return; }
    b.disabled = true;
    const esitoT = await eseguiTrasferimentoColf(scelte, annoDa, function (n) { esito.textContent = 'Trasferimento ' + n + ' di ' + scelte.length + '…'; });
    const fatte = esitoT.fatte, saltate = esitoT.saltate;
    if (esitoT.errore) { esito.innerHTML = '<b style="color:#c0392b">❌ ' + esc(esitoT.errore) + '</b>'; b.disabled = false; }
    if (typeof caricaTutto === 'function') await caricaTutto();
    if (fatte + saltate === scelte.length) {
      ov.remove();
      avviso('➡️ ' + fatte + ' pratiche colf trasferite nel ' + annoA + (saltate ? ' · ' + saltate + ' già presenti nel ' + annoA + ' (non duplicate)' : ''));
    }
    render();
  });
}

// Trasferisce all'anno dopo i contratti dati (dal tasto ➡️ Trasferisci o in automatico a inizio anno)
async function eseguiTrasferimentoColf(scelte, annoDa, avanzamento) {
  const annoA = annoDa + 1;
  const oggi = todayIT();
  const dataNuova = annoDiData(oggi) === annoA ? oggi : '01/01/' + annoA;
  let fatte = 0, saltate = 0;
  for (const p of scelte) {
    if (avanzamento) avanzamento(fatte + saltate + 1);
    // se nel nuovo anno c'è già una pratica colf dello stesso cliente non si crea un doppione
    const gia = await cercaDoppione(annoA, p.nome, p.tipo, p.codiceFiscale, null);
    if (gia) { await supabase.from('pratiche').update({ trasferita_in: gia }).eq('id', p.id).select('id'); p.trasferitaIn = gia; saltate++; continue; }
    // continuazione: niente numero nuovo della serie AP, resta il protocollo d'origine del contratto
    const origine = protocolloOrigineDi(p);
    const nuova = {
      continuazione: true, protocolloOrigine: origine,
      anno: annoA, data: dataNuova, tipo: p.tipo, stato: 'pratica_attiva',
      nome: p.nome, cf: p.cf, codiceFiscale: p.codiceFiscale, telefono: p.telefono, telefonoFisso: p.telefonoFisso, email: p.email,
      documentoScadenza: p.documentoScadenza, documenti: p.documenti,
      comuneNascita: p.comuneNascita, documentoNumero: p.documentoNumero, documentoTipo: p.documentoTipo, riferimento: p.riferimento,
      // il lavoratore passa con il contratto (la congiunta non esiste per le colf)
      lavCognome: p.lavCognome, lavNome: p.lavNome, lavCodiceFiscale: p.lavCodiceFiscale, lavData: p.lavData, lavComuneNascita: p.lavComuneNascita, lavTelefono: p.lavTelefono,
      lavDocumentoTipo: p.lavDocumentoTipo, lavDocumentoNumero: p.lavDocumentoNumero, lavDocumentoScadenza: p.lavDocumentoScadenza, lavPermessoNumero: p.lavPermessoNumero, lavPermessoScadenza: p.lavPermessoScadenza,
      compenso: p.compenso, pagato: 0, metodoPagamento: '', scadenzaAssistenza: p.scadenzaAssistenza || '',
      note: 'Continuazione nel ' + annoA + ' del contratto ' + origine,
      fatt: 'dafatturare', numFattura: '', dataFattura: '',
      inseritoDa: ((auth.profilo && auth.profilo.nome) || '').toUpperCase(), inseritoIl: new Date().toISOString()
    };
    const db = praticaToDb(nuova); delete db.numero;
    const ins = await supabase.from('pratiche').insert([db]).select('id,numero,anno,serie');
    if (ins.error || !ins.data || !ins.data.length) return { fatte: fatte, saltate: saltate, errore: (p.nome || '') + ' non trasferita' + (ins.error ? ': ' + ins.error.message : '') };
    const numeroNuovo = origine + ' (continuazione ' + annoA + ')';
    const upd = await supabase.from('pratiche').update({ trasferita_in: numeroNuovo }).eq('id', p.id).select('id');
    if (upd.error) return { fatte: fatte, saltate: saltate, errore: upd.error.message };
    p.trasferitaIn = numeroNuovo;
    fatte++;
  }
  return { fatte: fatte, saltate: saltate, errore: '' };
}

// ⚙️ Impostazione dell'amministratore (Utenti e permessi): trasferimento automatico a inizio anno, spento finché non lo accende
function trasferimentoColfAutomatico() { return typeof IMPOSTAZIONI !== 'undefined' && IMPOSTAZIONI.colf_trasferimento_auto === 'si'; }
async function impostaTrasferimentoColfAutomatico(si) {
  const valore = si ? 'si' : 'no';
  const { data: righe, error } = await supabase.from('impostazioni').upsert([{ chiave: 'colf_trasferimento_auto', valore: valore, aggiornato_il: new Date().toISOString() }], { onConflict: 'chiave' }).select('chiave');
  if (error || !righe || !righe.length) { avviso('❌ Non salvato' + (error ? ': ' + error.message : ''), true); return; }
  IMPOSTAZIONI.colf_trasferimento_auto = valore;
  avviso(si ? '✓ Colf e badanti: a inizio anno i contratti attivi passeranno da soli all\'anno nuovo' : '✓ Colf e badanti: il passaggio d\'anno si fa a mano con il tasto ➡️ Trasferisci');
  render();
}
function rigaImpostazioneColfHTML() {
  return '<div class="perm-row" style="margin-bottom:12px; padding:10px 12px; border-radius:12px; background:var(--bg); border:1px solid var(--line)"><span><b>🧹 Colf e badanti: passaggio all\'anno nuovo</b> <span style="font-size:12px; color:var(--sub)">spento = lo fai tu con il tasto ➡️ Trasferisci (controllando l\'elenco); acceso = a inizio anno i contratti non cessati passano da soli quando entra l\'amministratore</span></span>'
    + '<label class="chk"><input type="checkbox" ' + (trasferimentoColfAutomatico() ? 'checked' : '') + ' onchange="impostaTrasferimentoColfAutomatico(this.checked)"> Automatico</label></div>';
}
// a inizio anno, se acceso: lo fa l'amministratore appena entra (una volta sola per sessione), poi mostra il riepilogo
let TRASF_COLF_AUTO_FATTO = false;
async function trasferisciColfAutomatico() {
  if (TRASF_COLF_AUTO_FATTO || !trasferimentoColfAutomatico() || !auth.profilo || auth.profilo.ruolo !== 'admin') return;
  const da = annoAttivo() - 1;
  if (new Date().getFullYear() < annoAttivo()) return; // solo quando l'anno nuovo è davvero cominciato
  const lista = colfDaTrasferire(da);
  if (!lista.length) return;
  TRASF_COLF_AUTO_FATTO = true;
  const esito = await eseguiTrasferimentoColf(lista, da, null);
  if (typeof caricaTutto === 'function') await caricaTutto();
  render();
  const scadute = lista.filter(function (p) { return p.scadenzaAssistenza && (dataNum(p.scadenzaAssistenza) || 0) < dataNum(todayIT()); });
  alert('🧹 Colf e badanti: passaggio automatico al ' + (da + 1) + '\n\n'
    + esito.fatte + ' contratti trasferiti come continuazione (stesso protocollo d\'origine)' + (esito.saltate ? '\n' + esito.saltate + ' già presenti nel ' + (da + 1) + ' (non duplicati)' : '')
    + (esito.errore ? '\n\n❌ Fermato per un errore: ' + esito.errore + '\nRiprova con il tasto ➡️ Trasferisci.' : '')
    + (scadute.length ? '\n\n⚠️ Con la scadenza dell\'assistenza già passata (controlla se rinnovare o cessare):\n' + scadute.map(function (p) { return '• ' + p.nome + ' – ' + p.scadenzaAssistenza; }).join('\n') : ''));
}
