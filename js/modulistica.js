/**
 * MODULISTICA: archivio di moduli da scaricare, compilare o stampare (Word, PDF, Excel, immagini...).
 * I file stanno nello spazio "modulistica" del server (privato: solo gli utenti del programma),
 * le informazioni (nome, categoria, editabile o no) nella tabella "moduli".
 */
let MODULI = [];
let MODULI_CARICATI = false;

const ESTENSIONI_EDITABILI = ['doc', 'docx', 'odt', 'rtf', 'xls', 'xlsx', 'ods', 'txt'];
function estensione(nome) { const m = String(nome || '').toLowerCase().match(/\.([a-z0-9]+)$/); return m ? m[1] : ''; }
function iconaModulo(nome) {
  const e = estensione(nome);
  if (['doc', 'docx', 'odt', 'rtf'].indexOf(e) >= 0) return '📝';
  if (e === 'pdf') return '📕';
  if (['xls', 'xlsx', 'ods', 'csv'].indexOf(e) >= 0) return '📊';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].indexOf(e) >= 0) return '🖼️';
  return '📄';
}
function dimensioneLeggibile(b) { b = Number(b) || 0; return b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB'; }
function puoCaricareModuli() { return !!auth.profilo && (auth.profilo.ruolo === 'admin' || !auth.profilo.sola_lettura); }
function puoEliminareModulo(m) { return !!auth.profilo && (auth.profilo.ruolo === 'admin' || (m.caricato_da && m.caricato_da === auth.profilo.nome)); }

function intestazioniStorage(extra) {
  return Object.assign({ 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '') }, extra || {});
}
async function caricaModuli() {
  const { data, ok } = await fetchSupabase('/rest/v1/moduli?select=*&order=categoria.asc,nome.asc');
  MODULI = ok && Array.isArray(data) ? data : [];
  MODULI_CARICATI = true;
}

async function renderModulistica() {
  const sec = document.getElementById('tab-modulistica');
  if (!sec) return;
  if (!sec.dataset.pronta) {
    sec.dataset.pronta = '1';
    sec.innerHTML = '<div class="card">'
      + '<div class="raff-title">📂 Modulistica</div>'
      + '<p style="font-size:12.5px; color:var(--sub); margin:0 0 10px">Moduli del CAF da scaricare, compilare o stampare. <b>✏️ Editabile</b> = si compila al computer (Word, PDF compilabile, Excel); <b>🔒 Non editabile</b> = solo da stampare o consegnare.</p>'
      + '<div id="mod-carica"></div>'
      + '<div style="display:flex; gap:8px; flex-wrap:wrap; margin:12px 0 6px">'
      + '<div class="search-box" style="flex:1; min-width:220px; margin:0"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>'
      + '<input id="mod-cerca" type="search" placeholder="Cerca un modulo: nome, categoria, descrizione…" oninput="disegnaModuli()"></div>'
      + '<select id="mod-cat" style="width:auto" onchange="disegnaModuli()"></select>'
      + '<select id="mod-tipo" style="width:auto" onchange="disegnaModuli()"><option value="">Tutti</option><option value="si">✏️ Editabili</option><option value="no">🔒 Non editabili</option></select></div>'
      + '<div id="mod-lista"></div></div>';
  }
  disegnaFormModulo();
  if (!MODULI_CARICATI) { document.getElementById('mod-lista').innerHTML = '<div class="empty">Caricamento…</div>'; await caricaModuli(); }
  disegnaModuli();
}

function disegnaFormModulo() {
  const box = document.getElementById('mod-carica');
  if (!box) return;
  if (!puoCaricareModuli()) { box.innerHTML = ''; return; }
  if (box.dataset.pronto) { aggiornaCategorieForm(); return; }
  box.dataset.pronto = '1';
  box.innerHTML = '<div style="padding:12px; border:2px dashed #1d4f91; border-radius:12px">'
    + '<div style="font-weight:800; color:#1d4f91; margin-bottom:8px">⬆️ Carica un nuovo modulo</div>'
    + '<div class="grid" style="gap:8px">'
    + '<div class="full"><label>File (Word, PDF, Excel, immagini · max 20 MB)</label><input id="mod-file" type="file" accept=".doc,.docx,.odt,.rtf,.pdf,.xls,.xlsx,.ods,.csv,.txt,.jpg,.jpeg,.png" onchange="fileModuloScelto()"></div>'
    + '<div><label>Nome del modulo</label><input id="mod-nome" placeholder="Es. Delega 730"></div>'
    + '<div><label>Categoria</label><input id="mod-categoria" list="mod-categorie" placeholder="Es. 730, ISEE, Deleghe, Privacy"><datalist id="mod-categorie"></datalist></div>'
    + '<div><label>Tipo</label><select id="mod-editabile"><option value="si">✏️ Editabile (da compilare al computer)</option><option value="no">🔒 Non editabile (solo stampa)</option></select></div>'
    + '<div><label>Descrizione (facoltativa)</label><input id="mod-descr" placeholder="A cosa serve, quando si usa…"></div></div>'
    + '<div style="display:flex; align-items:center; gap:10px; margin-top:10px"><button type="button" class="btn-add" style="margin:0" id="mod-btn" onclick="caricaModulo()">⬆️ Carica modulo</button><span id="mod-esito" style="font-size:13px"></span></div></div>';
  aggiornaCategorieForm();
}
function aggiornaCategorieForm() {
  const cats = categorieModuli();
  const dl = document.getElementById('mod-categorie');
  if (dl) dl.innerHTML = cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('');
}
function categorieModuli() {
  const s = {};
  MODULI.forEach(function (m) { s[m.categoria || 'Generale'] = 1; });
  return Object.keys(s).sort(function (a, b) { return a.localeCompare(b, 'it'); });
}
function fileModuloScelto() {
  const f = (document.getElementById('mod-file').files || [])[0];
  if (!f) return;
  const nome = document.getElementById('mod-nome');
  if (!nome.value.trim()) nome.value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  // proposta: Word/Excel editabili, PDF e immagini da stampare (si puo' cambiare)
  document.getElementById('mod-editabile').value = ESTENSIONI_EDITABILI.indexOf(estensione(f.name)) >= 0 ? 'si' : 'no';
}

async function caricaModulo() {
  const f = (document.getElementById('mod-file').files || [])[0];
  const esito = document.getElementById('mod-esito');
  const btn = document.getElementById('mod-btn');
  if (!f) { esito.innerHTML = '<b style="color:#c0392b">Scegli prima il file</b>'; return; }
  if (f.size > 20 * 1048576) { esito.innerHTML = '<b style="color:#c0392b">Il file supera 20 MB</b>'; return; }
  const nome = document.getElementById('mod-nome').value.trim() || f.name;
  const categoria = document.getElementById('mod-categoria').value.trim() || 'Generale';
  const percorso = Date.now() + '-' + f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');
  btn.disabled = true; esito.textContent = '⏳ Caricamento in corso…';
  try {
    await rinnovaToken();
    const r = await fetch(SUPABASE_URL + '/storage/v1/object/modulistica/' + encodeURIComponent(percorso), {
      method: 'POST', headers: intestazioniStorage({ 'Content-Type': f.type || 'application/octet-stream', 'x-upsert': 'false' }), body: f,
    });
    if (!r.ok) { let m = ''; try { m = (await r.json()).message; } catch (e) {} throw new Error(m || ('errore ' + r.status)); }
    const { error } = await supabase.from('moduli').insert([{
      nome: nome, categoria: categoria, editabile: document.getElementById('mod-editabile').value === 'si',
      descrizione: document.getElementById('mod-descr').value.trim(), percorso: percorso, nome_file: f.name,
      tipo_mime: f.type || '', dimensione: f.size,
    }]).select('id');
    if (error) throw new Error(error.message);
    ['mod-file', 'mod-nome', 'mod-descr'].forEach(function (id) { document.getElementById(id).value = ''; });
    esito.innerHTML = '<b style="color:#1a7f37">✓ "' + esc(nome) + '" caricato</b>';
    await caricaModuli(); disegnaModuli(); aggiornaCategorieForm();
  } catch (e) {
    esito.innerHTML = '<b style="color:#c0392b">❌ Non caricato: ' + esc(e.message) + '</b>';
  } finally { btn.disabled = false; }
}

function disegnaModuli() {
  const lista = document.getElementById('mod-lista');
  if (!lista) return;
  const sel = document.getElementById('mod-cat');
  const catScelta = sel ? sel.value : '';
  if (sel) sel.innerHTML = '<option value="">Tutte le categorie</option>' + categorieModuli().map(function (c) { return '<option' + (c === catScelta ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
  const q = normalizzaGuida((document.getElementById('mod-cerca') || {}).value || '').split(/\s+/).filter(Boolean);
  const tipo = (document.getElementById('mod-tipo') || {}).value || '';
  const visibili = MODULI.filter(function (m) {
    if (catScelta && (m.categoria || 'Generale') !== catScelta) return false;
    if (tipo === 'si' && !m.editabile) return false;
    if (tipo === 'no' && m.editabile) return false;
    const testo = normalizzaGuida([m.nome, m.categoria, m.descrizione, m.nome_file].join(' '));
    return q.every(function (p) { return testo.indexOf(p) >= 0; });
  });
  if (!visibili.length) { lista.innerHTML = '<div class="empty">' + (MODULI.length ? 'Nessun modulo trovato' : 'Nessun modulo caricato' + (puoCaricareModuli() ? ': usa "Carica un nuovo modulo" qui sopra.' : '.')) + '</div>'; return; }
  const gruppi = {};
  visibili.forEach(function (m) { (gruppi[m.categoria || 'Generale'] = gruppi[m.categoria || 'Generale'] || []).push(m); });
  const btn = 'border:none; border-radius:999px; padding:5px 11px; font-size:12px; font-weight:700; cursor:pointer';
  lista.innerHTML = Object.keys(gruppi).sort(function (a, b) { return a.localeCompare(b, 'it'); }).map(function (cat) {
    return '<div style="margin-top:12px"><div style="font-weight:800; color:#1d4f91; margin-bottom:4px">📁 ' + esc(cat) + ' <span style="color:var(--sub); font-weight:600">(' + gruppi[cat].length + ')</span></div>'
      + gruppi[cat].map(function (m) {
        return '<div style="display:flex; align-items:center; gap:10px; padding:9px 10px; border:1px solid var(--line); border-radius:10px; margin-bottom:6px; flex-wrap:wrap">'
          + '<span style="font-size:24px">' + iconaModulo(m.nome_file) + '</span>'
          + '<div style="flex:1; min-width:180px"><b>' + esc(m.nome) + '</b> '
          + (m.editabile ? '<span style="background:#1a7f37; color:#fff; border-radius:999px; padding:1px 8px; font-size:11px; font-weight:700">✏️ Editabile</span>' : '<span style="background:#6b7280; color:#fff; border-radius:999px; padding:1px 8px; font-size:11px; font-weight:700">🔒 Non editabile</span>')
          + (m.descrizione ? '<div style="font-size:12.5px">' + esc(m.descrizione) + '</div>' : '')
          + '<div style="font-size:11.5px; color:var(--sub)">' + esc(m.nome_file) + ' · ' + dimensioneLeggibile(m.dimensione) + (m.caricato_da ? ' · caricato da ' + esc(m.caricato_da) : '') + ' il ' + new Date(m.caricato_il).toLocaleDateString('it-IT') + '</div></div>'
          + '<div style="display:flex; gap:6px; flex-wrap:wrap">'
          + '<button type="button" style="' + btn + '; background:#1d4f91; color:#fff" onclick="apriModulo(' + m.id + ', false)" title="Apri il modulo">👁️ Apri</button>'
          + '<button type="button" style="' + btn + '; background:#00612f; color:#fff" onclick="apriModulo(' + m.id + ', true)" title="Scarica il file sul computer per compilarlo">⬇️ Scarica</button>'
          + (puoEliminareModulo(m) ? '<button type="button" style="' + btn + '; background:var(--line); color:#c0392b" onclick="eliminaModulo(' + m.id + ')" title="Elimina il modulo">🗑️</button>' : '')
          + '</div></div>';
      }).join('') + '</div>';
  }).join('');
}

async function apriModulo(id, scarica) {
  const m = MODULI.find(function (x) { return x.id === id; });
  if (!m) return;
  // la finestra si apre subito (altrimenti il browser la blocca), poi si riempie
  const w = scarica ? null : window.open('', '_blank');
  try {
    await rinnovaToken();
    const r = await fetch(SUPABASE_URL + '/storage/v1/object/authenticated/modulistica/' + encodeURIComponent(m.percorso), { headers: intestazioniStorage() });
    if (!r.ok) throw new Error('file non trovato (' + r.status + ')');
    const blob = await r.blob();
    const url = URL.createObjectURL(new Blob([blob], { type: m.tipo_mime || blob.type || 'application/octet-stream' }));
    if (scarica || !w) {
      const a = document.createElement('a'); a.href = url; a.download = m.nome_file;
      document.body.appendChild(a); a.click(); a.remove();
      if (w) w.close();
    } else {
      w.location.href = url;
    }
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  } catch (e) {
    if (w) w.close();
    avviso('❌ Modulo non aperto: ' + e.message, true);
  }
}

async function eliminaModulo(id) {
  const m = MODULI.find(function (x) { return x.id === id; });
  if (!m || !confirm('Eliminare il modulo "' + m.nome + '"?\nIl file verrà cancellato e non si potrà recuperare.')) return;
  try {
    await rinnovaToken();
    await fetch(SUPABASE_URL + '/storage/v1/object/modulistica/' + encodeURIComponent(m.percorso), { method: 'DELETE', headers: intestazioniStorage() });
    const { data: righe, error } = await supabase.from('moduli').delete().eq('id', id).select('id');
    if (error || !righe || !righe.length) throw new Error(error ? error.message : 'permesso negato');
    avviso('🗑️ Modulo eliminato');
    await caricaModuli(); disegnaModuli();
  } catch (e) { avviso('❌ Modulo non eliminato: ' + e.message, true); }
}
