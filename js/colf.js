/* ---------------- Colf e badanti: trasferimento delle pratiche attive all'anno successivo ---------------- */
// Le pratiche "Pratica attiva" di un anno vengono ricreate nell'anno dopo (registro altre pratiche, nuovo numero AP)
// con la stessa scadenza dell'assistenza; la pratica vecchia resta nello storico, segnata "Trasferita nel …",
// e la sua scadenza passa alla pratica nuova.

function colfDaTrasferire(annoDa) {
  return (state.pratiche || []).filter(function (p) {
    return eColf(p.tipo) && annoPratica(p) === annoDa && p.stato === 'pratica_attiva' && !p.annullata && !p.trasferitaIn;
  }).sort(function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || '')); });
}

// Avviso in cima al Registro: pratiche colf attive dell'anno precedente non ancora portate nell'anno di protocollo
function avvisoTrasferimentoColfHTML() {
  if (!auth.profilo || document.body.classList.contains('sola-lettura')) return '';
  const da = annoAttivo() - 1, n = colfDaTrasferire(da).length;
  if (!n) return '';
  return '<div style="margin-bottom:12px; padding:10px 14px; border-radius:12px; background:#e8f6f1; border:2px solid #1f8a70; display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between">'
    + '<span><b style="color:#1f8a70">🧹 Colf e badanti:</b> ' + n + ' pratiche <b>attive</b> del ' + da + ' non sono ancora state trasferite nel ' + annoAttivo() + '.</span>'
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
    + '<div style="font-size:13px; color:var(--sub); margin:2px 0 10px">Per ogni pratica spuntata viene creata una nuova pratica nel <b>' + annoA + '</b> (registro altre pratiche, nuovo numero) con gli stessi dati, stato <b>Pratica attiva</b>, la stessa <b>scadenza dell\'assistenza</b> e la stessa fattura (da pagare). La pratica del ' + annoDa + ' resta nello storico come "Trasferita nel ' + annoA + '".</div>'
    + '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px"><button type="button" data-tutte="1" style="padding:5px 12px">☑ Seleziona tutte</button><button type="button" data-tutte="0" style="padding:5px 12px">☐ Nessuna</button></div>'
    + '<div style="overflow:auto; flex:1; border:1px solid var(--line); border-radius:10px">'
    + lista.map(function (p) {
      return '<label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid var(--line); cursor:pointer; margin:0">'
        + '<input type="checkbox" class="tc-chk" value="' + p.id + '" checked style="width:auto; margin:0">'
        + '<span style="flex:1"><b>' + esc((p.nome || '').toUpperCase()) + '</b><div class="sub2">' + formattaProtocollo(p) + (p.telefono ? ' · 📱 ' + esc(p.telefono) : '') + '</div></span>'
        + '<span style="white-space:nowrap; text-align:right">' + (p.scadenzaAssistenza ? '⏰ ' + esc(p.scadenzaAssistenza) : '<span style="color:#c0392b">senza scadenza</span>') + '<div class="sub2">fattura ' + fmtEuro(p.compenso) + '</div></span></label>';
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
    const oggi = todayIT();
    const dataNuova = annoDiData(oggi) === annoA ? oggi : '01/01/' + annoA;
    let fatte = 0, saltate = 0;
    for (const p of scelte) {
      esito.textContent = 'Trasferimento ' + (fatte + saltate + 1) + ' di ' + scelte.length + '…';
      // se nel nuovo anno c'è già una pratica colf dello stesso cliente non si crea un doppione
      const gia = await cercaDoppione(annoA, p.nome, p.tipo, p.codiceFiscale, null);
      if (gia) { await supabase.from('pratiche').update({ trasferita_in: gia }).eq('id', p.id).select('id'); p.trasferitaIn = gia; saltate++; continue; }
      const nuova = {
        anno: annoA, data: dataNuova, tipo: p.tipo, stato: 'pratica_attiva',
        nome: p.nome, cf: p.cf, codiceFiscale: p.codiceFiscale, telefono: p.telefono, telefonoFisso: p.telefonoFisso, email: p.email,
        documentoScadenza: p.documentoScadenza, documenti: p.documenti,
        congiunta: p.congiunta, congCognome: p.congCognome, congNome: p.congNome, congData: p.congData, congCodiceFiscale: p.congCodiceFiscale, congTelefono: p.congTelefono,
        compenso: p.compenso, pagato: 0, metodoPagamento: '', scadenzaAssistenza: p.scadenzaAssistenza || '',
        note: 'Trasferita dal ' + annoDa + ' (' + formattaProtocollo(p) + ')',
        fatt: 'dafatturare', numFattura: '', dataFattura: '',
        inseritoDa: ((auth.profilo && auth.profilo.nome) || '').toUpperCase(), inseritoIl: new Date().toISOString()
      };
      const db = praticaToDb(nuova); delete db.numero;
      const ins = await supabase.from('pratiche').insert([db]).select('id,numero,anno,serie');
      if (ins.error || !ins.data || !ins.data.length) { esito.innerHTML = '<b style="color:#c0392b">❌ ' + esc((p.nome || '')) + ' non trasferita' + (ins.error ? ': ' + esc(ins.error.message) : '') + '</b>'; b.disabled = false; break; }
      const r = ins.data[0];
      const numeroNuovo = formattaProtocollo({ anno: r.anno, serie: r.serie, numero: r.numero, tipo: p.tipo });
      const upd = await supabase.from('pratiche').update({ trasferita_in: numeroNuovo }).eq('id', p.id).select('id');
      if (upd.error) { esito.innerHTML = '<b style="color:#c0392b">❌ ' + esc(upd.error.message) + '</b>'; b.disabled = false; break; }
      p.trasferitaIn = numeroNuovo;
      fatte++;
    }
    if (typeof caricaTutto === 'function') await caricaTutto();
    if (fatte + saltate === scelte.length) {
      ov.remove();
      avviso('➡️ ' + fatte + ' pratiche colf trasferite nel ' + annoA + (saltate ? ' · ' + saltate + ' già presenti nel ' + annoA + ' (non duplicate)' : ''));
    }
    render();
  });
}
