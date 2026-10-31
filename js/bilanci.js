/* ---------------- 📒 Bilancio dell'anno e 📈 confronto tra gli anni (solo amministratore) ----------------
   Il bilancio di un anno (pratiche, clienti, conti, pagamenti) si calcola con le stesse regole della Contabilità
   e si salva per sempre nella tabella bilanci_annuali: resta anche quando, dopo 5 anni, si cancellano le pratiche
   di un anno vecchio. Si salva:
   - da solo, al primo accesso dell'amministratore dal 1° gennaio al 31 marzo, per l'anno appena finito
     (si aggiorna a ogni accesso in quel periodo, così entrano i pagamenti arrivati in ritardo; poi resta fermo);
   - a mano, con «💾 Salva il bilancio» (nella pagina e nel controllo di fine anno).
   La pagina «Bilanci e confronto tra gli anni» mette tutti gli anni salvati uno accanto all'altro, con la
   variazione rispetto all'anno prima, e i grafici; si stampa o si salva in PDF.
   Gli anni di prova (prima di ANNO_INIZIO_PROTOCOLLO) non si salvano da soli. */

let BILANCI_SALVATI = null;   // { anno: { dati, salvato_il, salvato_da } }
const GRAFICI_BILANCI = {};

function calcolaBilancioAnno(anno) {
  const r = datiResocontoAnnuale(anno);
  const somma = function (l, f) { return l.reduce(function (t, p) { return t + Number(f(p) || 0); }, 0); };
  const prat = (state.pratiche || []).filter(function (p) { return !p.annullata && !eRinuncia(p) && annoPratica(p) === anno; });
  const perTipo = {};
  prat.forEach(function (p) { const k = p.tipo || 'SENZA TIPO'; const t = perTipo[k] || (perTipo[k] = { n: 0, incasso: 0 }); t.n += pesoPratica(p); t.incasso += Number(p.pagato || 0); });
  const perMese = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  prat.forEach(function (p) { const d = parseDataIT(p.data); if (d) perMese[d.m - 1] += pesoPratica(p); });
  const metodi = {};
  prat.forEach(function (p) { if (Number(p.pagato) > 0) { const k = String(p.metodoPagamento || 'NON INDICATO').toUpperCase(); metodi[k] = (metodi[k] || 0) + Number(p.pagato); } });
  const consegnate = prat.filter(eConsegnata);
  const dovuto = somma(consegnate, dovutoPratica), pagatoCons = somma(consegnate, function (p) { return Math.min(Number(p.pagato || 0), dovutoPratica(p)); });
  const nonPagate = consegnate.filter(function (p) { return typeof eMorosa === 'function' && eMorosa(p); });
  // clienti: titolare e coniuge, una volta sola
  const persone = function (a) {
    const out = {};
    (state.pratiche || []).forEach(function (p) {
      if (p.annullata || eRinuncia(p) || annoPratica(p) !== a) return;
      out[chiavePersonaConfronto(p.nome, p.cf, p.codiceFiscale)] = true;
      const con = ((p.congCognome || '') + ' ' + (p.congNome || '')).trim() || p.congiunta;
      if (con) out[chiavePersonaConfronto(con, p.congData, p.congCodiceFiscale)] = true;
    });
    return out;
  };
  const ora = persone(anno), prima = persone(anno - 1);
  const kOra = Object.keys(ora), kPrima = Object.keys(prima);
  const tornati = kOra.filter(function (k) { return prima[k]; }).length;
  return {
    versione: 1, anno: anno, calcolatoIl: new Date().toISOString(),
    pratiche: { totale: r.g730.n + r.gAltre.n, n730: r.g730.n, altre: r.gAltre.n, congiunte: prat.filter(function (p) { return e730(p) && (p.congCognome || p.congNome); }).length,
      rinunce: r.gRin.n, annullate: r.annullate, consegnate: consegnate.length, perTipo: perTipo, perMese: perMese },
    clienti: { totale: kOra.length, tornati: tornati, nuovi: kOra.length - tornati, persi: kPrima.length ? kPrima.filter(function (k) { return !ora[k]; }).length : null, annoPrimaConDati: kPrima.length > 0 },
    conti: { fatture: r.fattureTot, incasso: r.incassoTot, versatoCaf: r.versato, daVersareCaf: r.daVersare, speseSede: r.spese, lordo: r.lordo, netto: r.netto,
      fattureInAttesa: r.g730.attesa + r.gAltre.attesa, medio730: r.g730.medioI, medioAltre: r.gAltre.medioI },
    pagamenti: { dovuto: dovuto, pagato: pagatoCons, percentuale: dovuto > 0 ? pagatoCons / dovuto * 100 : null, nonPagate: nonPagate.length,
      daIncassare: somma(nonPagate, function (p) { return typeof residuoPratica === 'function' ? residuoPratica(p) : 0; }), metodi: metodi },
  };
}

async function caricaBilanci() {
  const r = await fetchSupabase('/rest/v1/bilanci_annuali?select=anno,dati,salvato_il,salvato_da&order=anno');
  if (!r.ok) throw new Error((r.data && r.data.message) || ('errore ' + r.status));
  BILANCI_SALVATI = {};
  (r.data || []).forEach(function (b) { BILANCI_SALVATI[b.anno] = b; });
  return BILANCI_SALVATI;
}
async function salvaBilancioAnno(anno, zitto) {
  const dati = calcolaBilancioAnno(anno);
  if (!dati.pratiche.totale && !dati.conti.incasso && !dati.conti.fatture) { if (!zitto) avviso('Nel ' + anno + ' non ci sono pratiche né conti da salvare', true); return false; }
  const riga = { anno: anno, dati: dati, salvato_il: new Date().toISOString(), salvato_da: (auth.profilo && auth.profilo.nome) || '' };
  const r = await fetchSupabase('/rest/v1/bilanci_annuali?on_conflict=anno', 'POST', [riga], { Prefer: 'resolution=merge-duplicates,return=minimal' });
  if (!r.ok) { if (!zitto) avviso('❌ Bilancio non salvato: ' + ((r.data && r.data.message) || r.status), true); return false; }
  if (BILANCI_SALVATI) BILANCI_SALVATI[anno] = riga;
  if (!zitto) avviso('📒 Bilancio del ' + anno + ' salvato');
  return true;
}

// ---- pagina ----
const RIGHE_BILANCIO = [
  ['📋 Pratiche', null],
  ['Pratiche totali', function (d) { return d.pratiche.totale; }, 'n', 1],
  ['di cui 730', function (d) { return d.pratiche.n730; }, 'n', 1],
  ['di cui altre pratiche', function (d) { return d.pratiche.altre; }, 'n', 1],
  ['730 congiunte', function (d) { return d.pratiche.congiunte; }, 'n', 1],
  ['Rinunce', function (d) { return d.pratiche.rinunce; }, 'n', -1],
  ['👥 Clienti', null],
  ['Clienti dell\'anno', function (d) { return d.clienti.totale; }, 'n', 1],
  ['tornati dall\'anno prima', function (d) { return d.clienti.annoPrimaConDati ? d.clienti.tornati : null; }, 'n', 1],
  ['nuovi', function (d) { return d.clienti.nuovi; }, 'n', 1],
  ['persi (venuti l\'anno prima, non quest\'anno)', function (d) { return d.clienti.persi; }, 'n', -1],
  ['💶 Conti', null],
  ['Fatture emesse', function (d) { return d.conti.fatture; }, 'e', 0],
  ['Incassato', function (d) { return d.conti.incasso; }, 'e', 1],
  ['Versato al CAF', function (d) { return d.conti.versatoCaf; }, 'e', 0],
  ['Spese della sede', function (d) { return d.conti.speseSede; }, 'e', -1],
  ['GUADAGNO NETTO', function (d) { return d.conti.netto; }, 'e', 1, true],
  ['Prezzo medio 730', function (d) { return d.conti.medio730; }, 'e', 1],
  ['Prezzo medio altre pratiche', function (d) { return d.conti.medioAltre; }, 'e', 1],
  ['💳 Pagamenti', null],
  ['Pagato sul dovuto (pratiche consegnate)', function (d) { return d.pagamenti.percentuale; }, '%', 1, true],
  ['Pratiche consegnate non pagate', function (d) { return d.pagamenti.nonPagate; }, 'n', -1],
  ['Ancora da incassare', function (d) { return d.pagamenti.daIncassare; }, 'e', -1],
];
function valoreBilancio(v, tipo) {
  if (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) return '—';
  if (tipo === 'e') return fmtEuro(v);
  if (tipo === '%') return v.toLocaleString('it-IT', { maximumFractionDigits: 1 }) + '%';
  return Number(v).toLocaleString('it-IT');
}
function variazioneBilancio(a, b, tipo, verso) {
  if (a === null || a === undefined || b === null || b === undefined || verso === 0) return '';
  const diff = b - a;
  if (Math.abs(diff) < 0.005) return '<div style="font-size:11px; color:var(--sub)">=</div>';
  const meglio = verso > 0 ? diff > 0 : diff < 0;
  const testo = tipo === '%' ? (diff > 0 ? '+' : '') + diff.toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' punti'
    : a ? (diff > 0 ? '+' : '') + Math.round(diff / Math.abs(a) * 100) + '%' : (diff > 0 ? '+' : '') + (tipo === 'e' ? fmtEuro(diff) : diff);
  return '<div style="font-size:11px; font-weight:800; color:' + (meglio ? '#1a7f37' : '#c0392b') + '">' + (diff > 0 ? '▲ ' : '▼ ') + testo + '</div>';
}
function tabellaBilanci(anni) {
  const td = 'padding:6px 8px; border-bottom:1px solid var(--line); text-align:right; vertical-align:top';
  return '<div style="overflow-x:auto"><table style="width:100%; border-collapse:collapse; font-size:13px">'
    + '<tr><th style="' + td + '; text-align:left"></th>' + anni.map(function (a) { return '<th style="' + td + '; font-size:15px; color:#1d4f91">' + a + '</th>'; }).join('') + '</tr>'
    + RIGHE_BILANCIO.map(function (r) {
        if (!r[1]) return '<tr><td colspan="' + (anni.length + 1) + '" style="padding:10px 8px 4px; font-weight:800; color:#1d4f91">' + r[0] + '</td></tr>';
        return '<tr' + (r[4] ? ' style="background:color-mix(in srgb, #1d4f91 6%, var(--card))"' : '') + '><td style="' + td + '; text-align:left' + (r[4] ? '; font-weight:800' : '') + '">' + esc(r[0]) + '</td>'
          + anni.map(function (a, i) {
              const v = r[1](BILANCI_SALVATI[a].dati), prima = i ? r[1](BILANCI_SALVATI[anni[i - 1]].dati) : null;
              return '<td style="' + td + (r[4] ? '; font-weight:800' : '') + '">' + valoreBilancio(v, r[2]) + (i ? variazioneBilancio(prima, v, r[2], r[3]) : '') + '</td>';
            }).join('') + '</tr>';
      }).join('')
    + '</table></div>';
}
const MESI_BREVI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const COLORI_TORTA = ['#1d4f91', '#2f9e5f', '#d98b1e', '#8e5bd6', '#c0392b', '#2f9e9e', '#5a6b3b', '#b5486b'];
function disegnaGraficiBilanci(anni) {
  Object.keys(GRAFICI_BILANCI).forEach(function (k) { try { GRAFICI_BILANCI[k].destroy(); } catch (e) {} delete GRAFICI_BILANCI[k]; });
  if (typeof Chart === 'undefined') { const g = document.getElementById('bil-grafici'); if (g) g.innerHTML = '<div class="sub2">I grafici non sono disponibili senza collegamento a Internet.</div>'; return; }
  const d = function (a) { return BILANCI_SALVATI[a].dati; };
  const crea = function (id, config) { const cv = document.getElementById(id); if (!cv) return; config.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom' } } }, config.options || {}); GRAFICI_BILANCI[id] = new Chart(cv, config); };
  const euro = { ticks: { callback: function (v) { return v.toLocaleString('it-IT') + ' €'; } } };
  crea('bil-g-pratiche', { type: 'bar', data: { labels: anni, datasets: [
    { label: '730', data: anni.map(function (a) { return d(a).pratiche.n730; }), backgroundColor: '#1d4f91' },
    { label: 'Altre pratiche', data: anni.map(function (a) { return d(a).pratiche.altre; }), backgroundColor: '#2f9e5f' }] },
    options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }, plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Pratiche per anno' } } } });
  crea('bil-g-conti', { type: anni.length > 1 ? 'line' : 'bar', data: { labels: anni, datasets: [
    { label: 'Fatture', data: anni.map(function (a) { return d(a).conti.fatture; }), borderColor: '#d98b1e', backgroundColor: '#d98b1e' },
    { label: 'Incassato', data: anni.map(function (a) { return d(a).conti.incasso; }), borderColor: '#8e5bd6', backgroundColor: '#8e5bd6' },
    { label: 'Guadagno netto', data: anni.map(function (a) { return d(a).conti.netto; }), borderColor: '#c2185b', backgroundColor: '#c2185b' }] },
    options: { scales: { y: Object.assign({ beginAtZero: true }, euro) }, plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Fatture, incasso e guadagno' } } } });
  crea('bil-g-pagati', { type: 'bar', data: { labels: anni, datasets: [
    { label: '% pagato sul dovuto', data: anni.map(function (a) { const p = d(a).pagamenti.percentuale; return p === null ? 0 : Math.round(p * 10) / 10; }), backgroundColor: '#1a7f37' }] },
    options: { scales: { y: { beginAtZero: true, max: 100, ticks: { callback: function (v) { return v + '%'; } } } }, plugins: { legend: { display: false }, title: { display: true, text: 'Percentuale pagata dai clienti' } } } });
  crea('bil-g-mesi', { type: 'line', data: { labels: MESI_BREVI, datasets: anni.map(function (a, i) {
      const c = typeof coloreAnno === 'function' ? coloreAnno(a) : COLORI_TORTA[i % COLORI_TORTA.length]; return { label: String(a), data: d(a).pratiche.perMese, borderColor: c, backgroundColor: c, tension: .25 }; }) },
    options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Pratiche mese per mese' } } } });
  const ultimo = anni[anni.length - 1], met = d(ultimo).pagamenti.metodi || {};
  crea('bil-g-metodi', { type: 'doughnut', data: { labels: Object.keys(met), datasets: [{ data: Object.keys(met).map(function (k) { return Math.round(met[k] * 100) / 100; }), backgroundColor: COLORI_TORTA }] },
    options: { plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Come pagano i clienti (' + ultimo + ')' } } } });
}

async function apriBilanci() {
  if (!(typeof isAdmin === 'function' && isAdmin())) { avviso('Solo l\'amministratore vede i bilanci', true); return; }
  chiudiBilanci();
  const ov = document.createElement('div');
  ov.id = 'popup-bilanci';
  ov.style.cssText = 'position:fixed; inset:0; z-index:458; background:rgba(15,27,45,.5); display:flex; align-items:center; justify-content:center; padding:10px';
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-chiudi]')) chiudiBilanci(); });
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:14px; border-top:6px solid #1d4f91; max-width:1000px; width:100%; max-height:94vh; overflow:auto; padding:14px 16px"><div class="sub2">⏳ Carico i bilanci…</div></div>';
  document.body.appendChild(ov);
  try { await caricaBilanci(); } catch (e) { ov.firstChild.innerHTML = '<div style="color:#c0392b">❌ Bilanci non disponibili: ' + esc(e.message) + '</div><button type="button" data-chiudi>Chiudi</button>'; return; }
  disegnaBilanci();
}
function chiudiBilanci() {
  Object.keys(GRAFICI_BILANCI).forEach(function (k) { try { GRAFICI_BILANCI[k].destroy(); } catch (e) {} delete GRAFICI_BILANCI[k]; });
  const v = document.getElementById('popup-bilanci'); if (v) v.remove();
}
function disegnaBilanci() {
  const ov = document.getElementById('popup-bilanci'); if (!ov) return;
  const anni = Object.keys(BILANCI_SALVATI || {}).map(Number).sort();
  const daSalvare = (typeof elencoAnniDisponibili === 'function' ? elencoAnniDisponibili() : [annoAttivo()]).map(Number).sort().reverse();
  const tasto = 'border:none; border-radius:999px; padding:6px 12px; font-size:12.5px; font-weight:800; cursor:pointer';
  ov.firstChild.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap"><b style="font-size:18px; color:#1d4f91">📒 Bilanci e confronto tra gli anni</b>'
    + '<span style="display:flex; gap:6px; flex-wrap:wrap">' + (anni.length ? '<button type="button" onclick="stampaBilanci()" style="' + tasto + '; background:#1d4f91; color:#fff">🖨️ Stampa / PDF</button>' : '')
    + '<button type="button" data-chiudi style="' + tasto + '; background:var(--line); color:var(--ink)">✕</button></span></div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin:4px 0 10px">Il bilancio di ogni anno si salva da solo da gennaio a marzo (con i pagamenti arrivati in ritardo) e resta <b>per sempre</b>, anche quando cancelli le pratiche di un anno vecchio. Puoi salvarlo o aggiornarlo anche a mano.</div>'
    + '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-bottom:10px"><select id="bil-anno" style="width:auto">' + daSalvare.map(function (a) { return '<option value="' + a + '">' + a + (BILANCI_SALVATI[a] ? ' (salvato)' : '') + '</option>'; }).join('') + '</select>'
    + '<button type="button" id="bil-salva" style="' + tasto + '; background:#2f9e5f; color:#fff">💾 Salva / aggiorna il bilancio</button></div>'
    + (anni.length
        ? '<div style="font-size:12px; color:var(--sub); margin-bottom:6px">' + anni.map(function (a) { const b = BILANCI_SALVATI[a]; return a + ': salvato il ' + new Date(b.salvato_il).toLocaleDateString('it-IT') + (b.salvato_da ? ' da ' + esc(b.salvato_da) : ''); }).join(' · ') + '</div>'
          + tabellaBilanci(anni)
          + (anni.length === 1 ? '<div style="font-size:12.5px; color:var(--sub); margin-top:6px">Il confronto con le frecce ▲▼ comparirà quando ci sarà anche il bilancio dell\'anno dopo.</div>' : '')
          + '<div id="bil-grafici" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:14px; margin-top:14px">'
          + ['bil-g-pratiche', 'bil-g-conti', 'bil-g-pagati', 'bil-g-mesi', 'bil-g-metodi'].map(function (id) { return '<div style="height:260px; position:relative"><canvas id="' + id + '"></canvas></div>'; }).join('') + '</div>'
        : '<div class="empty" style="padding:14px">Nessun bilancio salvato. Il primo si salverà da solo a gennaio; puoi salvarne uno ora scegliendo l\'anno qui sopra.</div>');
  ov.querySelector('#bil-salva').onclick = async function () {
    const a = Number(ov.querySelector('#bil-anno').value);
    if (BILANCI_SALVATI[a] && !confirm('Il bilancio del ' + a + ' c\'è già: lo aggiorno con i dati di adesso?')) return;
    this.disabled = true;
    if (await salvaBilancioAnno(a)) disegnaBilanci(); else this.disabled = false;
  };
  if (anni.length) disegnaGraficiBilanci(anni);
}
function stampaBilanci() {
  const anni = Object.keys(BILANCI_SALVATI || {}).map(Number).sort();
  const img = Object.keys(GRAFICI_BILANCI).map(function (k) { try { return '<img src="' + GRAFICI_BILANCI[k].toBase64Image() + '" style="width:48%; margin:1%">'; } catch (e) { return ''; } }).join('');
  const w = window.open('', '_blank');
  if (!w) { avviso('Il browser ha bloccato la finestra di stampa', true); return; }
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Bilanci ' + anni.join('-') + '</title><style>body{font-family:Arial,sans-serif; color:#0f1b2d; margin:16px} :root{--line:#ccd5e0; --sub:#5b6b82; --card:#fff} table{page-break-inside:auto} tr{page-break-inside:avoid}</style></head><body>'
    + '<h2 style="color:#1d4f91; margin:0 0 4px">📒 CAF CISL Alì Terme – bilanci e confronto tra gli anni</h2><div style="font-size:12px; color:#5b6b82; margin-bottom:10px">Stampato il ' + todayIT() + '</div>'
    + tabellaBilanci(anni) + '<div style="margin-top:12px">' + img + '</div></body></html>');
  w.document.close();
  setTimeout(function () { w.print(); }, 500);
}

// voce per il controllo di fine anno: il bilancio dell'anno da chiudere
async function voceBilancioFineAnno(anno) {
  try { if (!BILANCI_SALVATI) await caricaBilanci(); } catch (e) { return null; }
  const b = BILANCI_SALVATI[anno];
  return { icona: '📒', titolo: 'Bilancio del ' + anno, ok: !!b,
    testo: b ? 'Salvato il ' + new Date(b.salvato_il).toLocaleDateString('it-IT') + '. Fino al 31 marzo si aggiorna da solo con i pagamenti in ritardo. Il confronto con gli altri anni è in Contabilità → 📒 Bilanci.'
      : 'Non ancora salvato: si salva da solo dal 1° gennaio, oppure salvalo adesso. Resta per sempre e serve per il confronto tra gli anni.',
    azione: b ? '' : "fineAnnoChiudi(); salvaBilancioAnno(" + anno + ")", testoAzione: '💾 Salva il bilancio' };
}

// dal 1° gennaio al 31 marzo, al primo accesso dell'amministratore: si salva/aggiorna il bilancio dell'anno appena finito
(function () {
  let fatto = false;
  const prova = async function () {
    if (fatto || typeof isAdmin !== 'function' || !isAdmin() || !(state.pratiche || []).length) return;
    fatto = true;
    const oggi = new Date(), anno = oggi.getFullYear() - 1;
    if (oggi.getMonth() > 2) return;
    if (typeof ANNO_INIZIO_PROTOCOLLO !== 'undefined' && anno < ANNO_INIZIO_PROTOCOLLO) return;
    try { await salvaBilancioAnno(anno, true); } catch (e) { fatto = false; }
  };
  setTimeout(prova, 15000); setInterval(prova, 60000);
})();
