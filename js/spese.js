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
  // il modulo resta com'e' (non si perde quello che si sta scrivendo) se c'e' gia'
  if (!document.getElementById('sp-importo') || !scrivi) {
    box.innerHTML = '<div class="raff-title">🏢 Spese gestione sede – ' + anno + '</div>'
      + '<p style="font-size:12.5px; color:var(--sub); margin:0 0 10px">Registra i pagamenti della sede (TARI, tasse comunali, acqua, luce, affitto…). Il totale dell\'anno viene <b>tolto dal guadagno netto</b> in Contabilità.</p>'
      + (scrivi ? '<div class="grid">'
        + '<div><label>Data pagamento</label><input id="sp-data" placeholder="GG/MM/AAAA" inputmode="numeric" oninput="autoSlashData(this)" value="' + todayIT() + '"></div>'
        + '<div><label>Importo (€)</label><input id="sp-importo" type="text" inputmode="decimal" placeholder="0,00" oninput="filtraImporto(this)" onblur="formattaCampoImporto(this)" style="font-weight:800"></div>'
        + '<div><label>Voce di spesa</label><select id="sp-cat">' + CATEGORIE_SPESE.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></div>'
        + '<div><label>Pagamento</label><select id="sp-metodo"><option value="">—</option><option>CONTANTI</option><option>POS</option><option selected>BONIFICO</option></select></div>'
        + '<div class="full"><label>Descrizione (es. "TARI 1ª rata 2026", "bolletta acqua giugno")</label><input id="sp-descr" placeholder="Facoltativa"></div></div>'
        + '<div style="text-align:left"><button class="btn-add" onclick="aggiungiSpesa()">+ Aggiungi spesa</button></div>'
        + '<div id="sp-msg" style="color:#c0392b; font-size:12px; margin:4px 0 8px; display:none"></div>' : '')
      + '<div id="sp-riepilogo"></div><div id="sp-lista"></div>';
  } else {
    const t = box.querySelector('.raff-title'); if (t) t.textContent = '🏢 Spese gestione sede – ' + anno;
  }
  document.getElementById('sp-riepilogo').innerHTML = Object.keys(perCat).length ? '<div style="display:flex; gap:6px; flex-wrap:wrap; margin:10px 0">'
    + Object.keys(perCat).sort().map(function (c) { return '<span style="background:var(--line); border-radius:999px; padding:3px 10px; font-size:12px">' + esc(c) + ': <b>' + fmtEuro(perCat[c]) + '</b></span>'; }).join('') + '</div>' : '';
  document.getElementById('sp-lista').innerHTML = (lista.length ? lista.map(function (s) {
    return '<div class="caf-row"><span>' + esc(s.data || '-') + ' · <b>' + esc(s.categoria || '') + '</b>' + (s.descrizione ? ' · ' + esc(s.descrizione) : '') + (s.metodoPagamento ? ' <span style="color:var(--sub)">(' + esc(s.metodoPagamento) + ')</span>' : '') + '</span>'
      + '<span>' + fmtEuro(s.importo) + (scrivi ? ' <button onclick="rimuoviSpesa(\'' + s.id + '\')" style="background:none;border:none;color:#c0392b;cursor:pointer;font-weight:700;margin-left:6px" title="Elimina">✕</button>' : '') + '</span></div>';
  }).join('') : '<div class="empty">Nessuna spesa registrata nel ' + anno + '</div>')
    + '<div class="caf-tot"><span>Totale spese sede ' + anno + '</span><span>' + fmtEuro(tot) + '</span></div>';
}

async function aggiungiSpesa() {
  const msg = document.getElementById('sp-msg');
  const dataS = document.getElementById('sp-data').value.trim();
  const importo = parseImporto(document.getElementById('sp-importo').value);
  msg.style.display = 'none';
  if (!parseDataIT(dataS)) { msg.textContent = '⚠️ Scrivi la data nel formato GG/MM/AAAA'; msg.style.display = 'block'; return; }
  if (!importo || importo <= 0) { msg.textContent = '⚠️ Scrivi l\'importo pagato'; msg.style.display = 'block'; return; }
  const r = await data.speseSede.aggiungi({ data: dataS, importo: importo, categoria: document.getElementById('sp-cat').value,
    metodoPagamento: document.getElementById('sp-metodo').value, descrizione: document.getElementById('sp-descr').value.trim() });
  if (r.error) { msg.textContent = '❌ Spesa non salvata: ' + r.error; msg.style.display = 'block'; return; }
  document.getElementById('sp-importo').value = ''; document.getElementById('sp-descr').value = '';
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
