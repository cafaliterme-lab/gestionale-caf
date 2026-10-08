/**
 * SPESE GESTIONE SEDE: pagamenti della sede (TARI, IMU, acqua, luce, affitto...).
 * Il totale dell'anno viene tolto dal guadagno netto in Contabilità, nei Grafici e nelle stampe.
 */
const CATEGORIE_SPESE = ['TARI', 'IMU / tasse comunali', 'Acqua', 'Luce', 'Gas', 'Telefono / Internet', 'Affitto', 'Condominio', 'Pulizie', 'Cancelleria', 'Manutenzione', 'Assicurazione', 'Altro'];

function speseAnno(anno) { return (state.speseSede || []).filter(function (s) { return annoDiData(s.data) === anno; }); }
function totaleSpeseSede(anno) { return speseAnno(anno).reduce(function (t, s) { return t + Number(s.importo || 0); }, 0); }
function puoScrivereSpese() { return typeof puo === 'function' && puo('spese', true); }

function renderSpese() {
  const box = document.getElementById('spese-card');
  if (!box) return;
  const anno = annoAttivo();
  const lista = speseAnno(anno).slice().sort(function (a, b) { return (dataNum(b.data) || 0) - (dataNum(a.data) || 0); });
  const tot = lista.reduce(function (t, s) { return t + Number(s.importo || 0); }, 0);
  const perCat = {};
  lista.forEach(function (s) { perCat[s.categoria || 'Altro'] = (perCat[s.categoria || 'Altro'] || 0) + Number(s.importo || 0); });
  const scrivi = puoScrivereSpese();
  const daConf = { si: 0, no: 0, n: 0, angelo: 0 };
  lista.forEach(function (s) { const v = Number(s.importo || 0); if (s.inContabilita) daConf.si += v; else { daConf.no += v; daConf.n++; } if (s.prelevatiAngelo) daConf.angelo += v; });
  const debito = debitoAngelo();
  // il modulo resta com'e' (non si perde quello che si sta scrivendo) se c'e' gia'
  if (!document.getElementById('sp-importo') || !scrivi) {
    box.innerHTML = '<div class="raff-title">🏢 Spese gestione sede – ' + anno + '</div>'
      + '<p style="font-size:12.5px; color:var(--sub); margin:0 0 10px">Registra i pagamenti della sede (TARI, tasse comunali, acqua, luce, affitto…). Il totale dell\'anno viene <b>tolto dal guadagno netto</b> in Contabilità.</p>'
      + (scrivi ? '<div class="grid">'
        + '<div><label>Data pagamento</label><input id="sp-data" placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)" value="' + todayIT() + '"></div>'
        + '<div><label>Importo (€)</label><input id="sp-importo" type="text" inputmode="decimal" placeholder="0,00" oninput="filtraImporto(this)" onblur="formattaCampoImporto(this)" style="font-weight:800"></div>'
        + '<div><label>Voce di spesa</label><select id="sp-cat">' + CATEGORIE_SPESE.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></div>'
        + '<div><label>Pagamento</label><select id="sp-metodo"><option value="">—</option><option selected>CONTANTI</option><option>POS</option><option>BONIFICO</option></select></div>'
        + '<div class="full"><label>Descrizione (es. "TARI 1ª rata 2026", "bolletta acqua giugno")</label><input id="sp-descr" placeholder="Facoltativa"></div>'
        + '<div class="full"><label class="chk" style="font-weight:700; color:#8e5bd6"><input type="checkbox" id="sp-angelo"> 💰 Prelevati Angelo (soldi anticipati / prelevati da Angelo)</label></div></div>'
        + '<div style="text-align:left"><button class="btn-add" onclick="aggiungiSpesa()">+ Aggiungi spesa</button></div>'
        + '<div id="sp-msg" style="color:#c0392b; font-size:12px; margin:4px 0 8px; display:none"></div>' : '')
      + '<div id="sp-riepilogo"></div><div id="sp-lista"></div>';
  } else {
    const t = box.querySelector('.raff-title'); if (t) t.textContent = '🏢 Spese gestione sede – ' + anno;
  }
  document.getElementById('sp-riepilogo').innerHTML = Object.keys(perCat).length ? '<div style="display:flex; gap:6px; flex-wrap:wrap; margin:10px 0">'
    + Object.keys(perCat).sort().map(function (c) { return '<span style="background:var(--line); border-radius:999px; padding:3px 10px; font-size:12px">' + esc(c) + ': <b>' + fmtEuro(perCat[c]) + '</b></span>'; }).join('') + '</div>' : '';
  document.getElementById('sp-lista').innerHTML = (lista.length ? lista.map(rigaSpesaHTML).join('') : '<div class="empty">Nessuna spesa registrata nel ' + anno + '</div>')
    + '<div class="caf-tot"><span>Totale spese sede ' + anno + '</span><span>' + fmtEuro(tot) + '</span></div>'
    + '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; font-size:13px">'
    + '<span style="padding:4px 10px; border-radius:999px; background:color-mix(in srgb, #1a7f37 14%, var(--card))">✔ In contabilità: <b>' + fmtEuro(daConf.si) + '</b></span>'
    + '<span style="padding:4px 10px; border-radius:999px; background:color-mix(in srgb, #d4881c 18%, var(--card))">⏳ Da confermare: <b>' + fmtEuro(daConf.no) + '</b> (' + daConf.n + ')</span>'
    + '<span style="padding:4px 10px; border-radius:999px; background:color-mix(in srgb, #8e5bd6 16%, var(--card))">💰 Anticipati da Angelo nel ' + anno + ': <b>' + fmtEuro(daConf.angelo) + '</b></span></div>'
    + riquadroDebitoAngelo(debito, scrivi);
}
// Ogni spesa mostra i passaggi: 1 registrata → 2 pagata → 3 inserita in contabilità (con il tasto di conferma)
function rigaSpesaHTML(s) {
  const scrivi = puoScrivereSpese();
  const passo = function (n, testo, fatto, colore) {
    return '<span style="display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:700; '
      + (fatto ? 'background:' + colore + '; color:#fff' : 'background:var(--line); color:var(--sub)') + '"><span style="display:inline-block; width:17px; height:17px; line-height:17px; text-align:center; border-radius:50%; background:rgba(255,255,255,.3)">' + (fatto ? '✓' : n) + '</span>' + testo + '</span>';
  };
  const freccia = '<span style="color:var(--sub)">→</span>';
  const conf = s.inContabilita
    ? passo(3, 'In contabilità' + (s.inContabilitaIl ? ' il ' + new Date(s.inContabilitaIl).toLocaleDateString('it-IT') : '') + (s.inContabilitaDa ? ' (' + esc(s.inContabilitaDa) + ')' : ''), true, '#1a7f37')
      + (scrivi ? ' <button type="button" onclick="confermaSpesaContabilita(\'' + s.id + '\', false)" style="background:none; border:none; color:var(--sub); font-size:11px; cursor:pointer; text-decoration:underline">annulla</button>' : '')
    : (scrivi ? '<button type="button" onclick="confermaSpesaContabilita(\'' + s.id + '\', true)" style="background:#d4881c; color:#fff; border:none; border-radius:999px; padding:4px 12px; font-size:12px; font-weight:800; cursor:pointer">③ ✔ Conferma: già inserita in contabilità</button>' : passo(3, 'Da inserire in contabilità', false));
  return '<div style="padding:9px 10px; border:1px solid var(--line); border-left:5px solid ' + (s.inContabilita ? '#1a7f37' : '#d4881c') + '; border-radius:10px; margin-bottom:7px">'
    + '<div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap"><span>' + esc(s.data || '-') + ' · <b>' + esc(s.categoria || '') + '</b>' + (s.descrizione ? ' · ' + esc(s.descrizione) : '')
    + (function () { const v = typeof speseGiaDetratte === 'function' ? speseGiaDetratte()[s.id] : null; return v ? ' <span style="font-size:11.5px; color:#1d4f91; font-weight:700">· 🏦 detratta nel versamento CAF del ' + esc(v.data || '') + '</span>' : ''; })() + '</span>'
    + '<span><b>' + fmtEuro(s.importo) + '</b>' + (scrivi ? ' <button onclick="rimuoviSpesa(\'' + s.id + '\')" style="background:none;border:none;color:#c0392b;cursor:pointer;font-weight:700;margin-left:6px" title="Elimina">✕</button>' : '') + '</span></div>'
    + '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:6px">'
    + passo(1, 'Registrata', true, '#1d4f91') + freccia
    + passo(2, 'Pagata' + (s.metodoPagamento ? ' – ' + esc(s.metodoPagamento) : ''), true, '#2f7de1') + freccia + conf
    + '<label class="chk" style="margin:0 0 0 auto; font-size:12px; font-weight:700; color:#8e5bd6; cursor:' + (scrivi ? 'pointer' : 'default') + '"><input type="checkbox" ' + (s.prelevatiAngelo ? 'checked' : '') + (scrivi ? '' : ' disabled') + ' onchange="segnaPrelevatiAngelo(\'' + s.id + '\', this.checked)"> 💰 Prelevati Angelo</label>'
    + (s.prelevatiAngelo ? (s.restituitoAngelo
      ? '<span style="padding:3px 10px; border-radius:999px; font-size:12px; font-weight:700; background:#1a7f37; color:#fff">✓ Restituiti ad Angelo' + (s.restituitoIl ? ' il ' + new Date(s.restituitoIl).toLocaleDateString('it-IT') : '') + '</span>'
        + (scrivi ? ' <button type="button" onclick="restituitoAngelo(\'' + s.id + '\', false)" style="background:none; border:none; color:var(--sub); font-size:11px; cursor:pointer; text-decoration:underline">annulla</button>' : '')
      : (scrivi ? '<button type="button" onclick="restituitoAngelo(\'' + s.id + '\', true)" style="background:#8e5bd6; color:#fff; border:none; border-radius:999px; padding:4px 12px; font-size:12px; font-weight:800; cursor:pointer">💸 Restituiti ad Angelo</button>'
        : '<span style="padding:3px 10px; border-radius:999px; font-size:12px; font-weight:700; background:#8e5bd6; color:#fff">Da restituire ad Angelo</span>')) : '')
    + '</div></div>';
}
async function confermaSpesaContabilita(id, si) {
  if (!si && !confirm('Togliere la conferma "inserita in contabilità"?')) return;
  const r = await data.speseSede.aggiorna(id, { inContabilita: si });
  if (r.error) { avviso('❌ ' + r.error, true); return; }
  avviso(si ? '✔ Spesa confermata: inserita in contabilità' : 'Conferma tolta');
  render();
}
async function segnaPrelevatiAngelo(id, si) {
  const r = await data.speseSede.aggiorna(id, { prelevatiAngelo: si });
  if (r.error) { avviso('❌ ' + r.error, true); render(); return; }
  avviso(si ? '💰 Segnata come prelevati Angelo' : 'Tolto "prelevati Angelo"');
  render();
}

async function aggiungiSpesa() {
  const msg = document.getElementById('sp-msg');
  const dataS = document.getElementById('sp-data').value.trim();
  const importo = parseImporto(document.getElementById('sp-importo').value);
  msg.style.display = 'none';
  if (!parseDataIT(dataS)) { msg.textContent = '⚠️ Scrivi la data nel formato GG/MM/AAAA'; msg.style.display = 'block'; return; }
  if (!importo || importo <= 0) { msg.textContent = '⚠️ Scrivi l\'importo pagato'; msg.style.display = 'block'; return; }
  const r = await data.speseSede.aggiungi({ data: dataS, importo: importo, categoria: document.getElementById('sp-cat').value,
    metodoPagamento: document.getElementById('sp-metodo').value, descrizione: document.getElementById('sp-descr').value.trim(),
    prelevatiAngelo: document.getElementById('sp-angelo').checked });
  if (r.error) { msg.textContent = '❌ Spesa non salvata: ' + r.error; msg.style.display = 'block'; return; }
  document.getElementById('sp-importo').value = ''; document.getElementById('sp-descr').value = ''; document.getElementById('sp-angelo').checked = false;
  avviso('✓ Spesa registrata: ' + fmtEuro(importo));
  render();
}
async function rimuoviSpesa(id) {
  const s = (state.speseSede || []).find(function (x) { return x.id === id; });
  if (!s || !confirm('Eliminare la spesa "' + (s.categoria || '') + (s.descrizione ? ' – ' + s.descrizione : '') + '" di ' + fmtEuro(s.importo) + '?')) return;
  const r = await data.speseSede.elimina(id);
  if (r.error) { avviso('❌ ' + r.error, true); return; }
  avviso('✓ Spesa eliminata');
  render();
}

/* ---- Soldi anticipati da Angelo: debito del CAF verso Angelo finché non vengono restituiti ---- */
function debitoAngelo() {
  const aperte = (state.speseSede || []).filter(function (s) { return s.prelevatiAngelo && !s.restituitoAngelo; });
  return { lista: aperte, totale: aperte.reduce(function (t, s) { return t + Number(s.importo || 0); }, 0) };
}
function riquadroDebitoAngelo(d, scrivi) {
  const restituite = (state.speseSede || []).filter(function (s) { return s.prelevatiAngelo && s.restituitoAngelo; })
    .sort(function (a, b) { return String(b.restituitoIl || '').localeCompare(String(a.restituitoIl || '')); }).slice(0, 10);
  const riga = function (s, fatta) {
    return '<label style="display:flex; align-items:center; gap:10px; padding:7px 10px; border-bottom:1px solid var(--line); font-size:13.5px; margin:0; cursor:' + (scrivi ? 'pointer' : 'default') + (fatta ? '; color:var(--sub)' : '') + '">'
      + '<input type="checkbox" style="width:auto; transform:scale(1.25)" ' + (fatta ? 'checked' : '') + (scrivi ? '' : ' disabled') + ' onchange="restituitoAngelo(\'' + s.id + '\', this.checked)">'
      + '<span style="flex:1">' + esc(s.data || '') + ' · <b>' + esc(s.categoria || '') + '</b>' + (s.descrizione ? ' · ' + esc(s.descrizione) : '')
      + (fatta && s.restituitoIl ? ' <span style="font-size:12px">— restituite il ' + new Date(s.restituitoIl).toLocaleDateString('it-IT') + '</span>' : '') + '</span>'
      + '<b style="' + (fatta ? 'text-decoration:line-through' : 'color:#8e5bd6') + '">' + fmtEuro(s.importo) + '</b>'
      + '<span style="font-size:12px; font-weight:700; color:' + (fatta ? '#1a7f37' : 'var(--sub)') + '; min-width:72px; text-align:right">' + (fatta ? '✓ Restituite' : 'Restituite') + '</span></label>';
  };
  return '<div style="margin-top:12px; padding:12px 14px; border-radius:12px; border:2px solid #8e5bd6; background:color-mix(in srgb, #8e5bd6 7%, var(--card))">'
    + '<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap">'
    + '<div><div style="font-weight:800; color:#8e5bd6">💰 Da restituire ad Angelo</div><div style="font-size:12px; color:var(--sub)">Spunta "Restituite" quando Angelo viene rimborsato (tutti gli anni)</div></div>'
    + '<div style="font-size:22px; font-weight:800; color:' + (d.totale ? '#8e5bd6' : '#1a7f37') + '">' + fmtEuro(d.totale) + '</div></div>'
    + '<div style="margin-top:8px; border:1px solid var(--line); border-radius:10px; background:var(--card); overflow:hidden">'
    + (d.lista.length ? d.lista.map(function (s) { return riga(s, false); }).join('') : '<div style="padding:8px 10px; font-size:13px; color:#1a7f37">✓ Nessun importo da restituire</div>')
    + '</div>'
    + (d.lista.length > 1 && scrivi ? '<div style="margin-top:6px; text-align:right"><button type="button" onclick="restituisciTuttoAngelo()" style="background:none; border:none; color:#8e5bd6; font-weight:700; font-size:12.5px; cursor:pointer; text-decoration:underline">Spunta tutte come restituite</button></div>' : '')
    + (restituite.length ? '<div style="font-size:12px; font-weight:700; color:var(--sub); margin:10px 0 4px">Restituite di recente</div><div style="border:1px solid var(--line); border-radius:10px; background:var(--card); overflow:hidden">' + restituite.map(function (s) { return riga(s, true); }).join('') + '</div>' : '')
    + '</div>';
}
async function restituitoAngelo(id, si) {
  if (!si && !confirm('Togliere la spunta "Restituite"? L\'importo tornerà tra quelli da restituire.')) { render(); return; }
  const r = await data.speseSede.aggiorna(id, { restituitoAngelo: si });
  if (r.error) { avviso('❌ ' + r.error, true); return; }
  avviso(si ? '💸 Segnato come restituito ad Angelo' : 'Tornato tra quelli da restituire');
  render();
}
async function restituisciTuttoAngelo() {
  const d = debitoAngelo();
  if (!d.lista.length || !confirm('Confermi di aver restituito ad Angelo ' + fmtEuro(d.totale) + ' (' + d.lista.length + ' spese)?')) return;
  for (const s of d.lista) {
    const r = await data.speseSede.aggiorna(s.id, { restituitoAngelo: true });
    if (r.error) { avviso('❌ ' + r.error, true); render(); return; }
  }
  avviso('💸 Restituiti ad Angelo ' + fmtEuro(d.totale));
  render();
}
