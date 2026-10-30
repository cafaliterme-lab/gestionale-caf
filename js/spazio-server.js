/* ---------------- 💽 Spazio sul server ----------------
   Solo per l'amministratore, in Utenti e permessi: quanto spazio occupa il database sui 500 MB del piano gratuito
   di Supabase, da cosa (barra a colori), quanto ne resta e, dal secondo mese, di quanto cresce e per quanti anni basta.
   I numeri li dà la funzione del database spazio_database(), che salva anche il valore di ogni mese.
   Se si supera il 70% compare anche un riquadro nella pagina Oggi. */

let SPAZIO_ULTIMO = null;
const GRUPPI_SPAZIO = [
  ['clienti', '👥 Archivio clienti', '#1d4f91'],
  ['pratiche', '📋 Pratiche e scadenze', '#2f9e5f'],
  ['contabilita', '💶 Contabilità', '#d98b1e'],
  ['messaggi', '💬 Messaggi, richiami e agenda', '#8e5bd6'],
  ['backup', '🛟 Copie di sicurezza', '#c0392b'],
  ['moduli', '📄 Modulistica', '#2f9e9e'],
  ['altro', '⚙️ Utenti, accessi e impostazioni', '#5a6b3b'],
  ['base', '🏗️ Base del server (fissa, di Supabase)', '#9aa5b1'],
];
function fmtSpazio(byte) {
  const mb = (Number(byte) || 0) / 1048576;
  if (mb > 0 && mb < 0.05) return 'meno di 0,1 MB';
  return (mb >= 100 ? Math.round(mb) : mb.toLocaleString('it-IT', { maximumFractionDigits: 1 })) + ' MB';
}
async function caricaSpazio() {
  const { data, error } = await supabase.rpc('spazio_database');
  if (error || !data) return null;
  SPAZIO_ULTIMO = data;
  return data;
}
// crescita al mese, dai valori salvati ogni mese (serve almeno un mese di distanza)
function crescitaSpazio(d) {
  const mesi = Object.keys((d && d.mesi) || {}).sort();
  if (mesi.length < 2) return null;
  const primo = mesi[0], ultimo = mesi[mesi.length - 1];
  const n = (Number(ultimo.slice(0, 4)) - Number(primo.slice(0, 4))) * 12 + Number(ultimo.slice(5)) - Number(primo.slice(5));
  if (n < 1) return null;
  return Math.max(0, (d.mesi[ultimo] - d.mesi[primo]) / n);
}
function percentualeSpazio(d) { return d && d.limite ? d.totale / d.limite * 100 : 0; }
function coloreSpazio(p) { return p >= 85 ? '#c0392b' : p >= 70 ? '#b35f0c' : '#1a7f37'; }

function spazioHTML(d) {
  if (!d) return '<div class="empty">Spazio sul server non disponibile</div>';
  const gruppi = Object.assign({}, d.gruppi || {});
  const dati = Object.keys(gruppi).reduce(function (t, k) { return t + Number(gruppi[k] || 0); }, 0);
  gruppi.base = Math.max(0, d.totale - dati);
  const p = percentualeSpazio(d), resta = Math.max(0, d.limite - d.totale), colore = coloreSpazio(p);
  const cresce = crescitaSpazio(d);
  let previsione;
  if (cresce === null) previsione = '📈 Dal prossimo mese ti dico anche di quanto cresce al mese e per quanti anni basta lo spazio.';
  else if (cresce < 1048576 / 10) previsione = '📈 Negli ultimi mesi è cresciuto pochissimo (meno di 0,1 MB al mese): lo spazio basta per moltissimi anni.';
  else {
    const anni = resta / cresce / 12;
    previsione = '📈 Cresce di circa <b>' + fmtSpazio(cresce) + ' al mese</b> (' + fmtSpazio(cresce * 12) + ' all\'anno): con questo ritmo lo spazio basta per circa <b>' + (anni >= 50 ? 'più di 50 anni' : anni >= 1 ? Math.floor(anni) + (Math.floor(anni) === 1 ? ' anno' : ' anni') : Math.max(1, Math.floor(anni * 12)) + (Math.floor(anni * 12) <= 1 ? ' mese' : ' mesi')) + '</b>.';
  }
  const barra = GRUPPI_SPAZIO.map(function (g) {
    const w = (gruppi[g[0]] || 0) / d.limite * 100;
    return w > 0 ? '<span title="' + esc(g[1] + ': ' + fmtSpazio(gruppi[g[0]])) + '" style="display:block; height:100%; width:' + Math.max(w, 0.4).toFixed(2) + '%; background:' + g[2] + '"></span>' : '';
  }).join('');
  const elenco = GRUPPI_SPAZIO.filter(function (g) { return gruppi[g[0]] > 0; }).map(function (g) {
    return '<div style="display:flex; align-items:center; gap:8px; font-size:13px; padding:3px 0"><span style="width:12px; height:12px; border-radius:3px; flex:none; background:' + g[2] + '"></span><span style="flex:1">' + esc(g[1]) + '</span><b>' + fmtSpazio(gruppi[g[0]]) + '</b></div>';
  }).join('');
  return '<div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px; flex-wrap:wrap">'
    + '<div style="font-size:15px">Usati <b style="color:' + colore + '">' + fmtSpazio(d.totale) + '</b> su <b>' + fmtSpazio(d.limite) + '</b> (' + p.toLocaleString('it-IT', { maximumFractionDigits: 1 }) + '%)</div>'
    + '<div style="font-size:15px">Restano <b style="color:' + colore + '">' + fmtSpazio(resta) + '</b></div></div>'
    + '<div style="display:flex; height:22px; border-radius:999px; overflow:hidden; background:color-mix(in srgb, var(--line) 70%, var(--card)); margin:8px 0 10px; border:1px solid var(--line)">' + barra + '</div>'
    + elenco
    + '<div style="font-size:12.5px; margin-top:8px">' + previsione + '</div>'
    + '<div style="font-size:12px; color:var(--sub); margin-top:6px">' + (p >= 85 ? '🔴 <b>Lo spazio sta finendo.</b> Togli gli anni con più di 5 anni (🧹 Controllo di fine anno) oppure passa al piano a pagamento di Supabase (8 GB).'
      : p >= 70 ? '🟠 Più di due terzi usati: valuta di togliere gli anni con più di 5 anni (🧹 Controllo di fine anno).'
      : '🟢 Tutto a posto. I documenti PDF dei clienti non stanno sul server, quindi lo spazio cresce poco.') + '</div>';
}
async function renderSpazio() {
  const box = document.getElementById('spazio-server');
  if (!box || (typeof isAdmin === 'function' && !isAdmin())) return;
  box.innerHTML = '<div class="sub2">⏳ Misuro lo spazio…</div>';
  box.innerHTML = spazioHTML(await caricaSpazio());
}
// voce per il controllo di fine anno
async function voceSpazioFineAnno() {
  const d = await caricaSpazio();
  if (!d) return null;
  const p = percentualeSpazio(d);
  return { icona: '💽', titolo: 'Spazio sul server', ok: p < 70,
    testo: 'Usati ' + fmtSpazio(d.totale) + ' su ' + fmtSpazio(d.limite) + ' (' + Math.round(p) + '%), restano ' + fmtSpazio(Math.max(0, d.limite - d.totale)) + '.' + (p >= 70 ? ' Valuta di togliere gli anni con più di 5 anni.' : ''),
    azione: p >= 70 ? "fineAnnoChiudi(); oggiTab('permessi')" : '', testoAzione: 'Vedi lo spazio' };
}
// riquadro in Oggi solo se lo spazio supera il 70%
function tileSpazio(tile) {
  if (!SPAZIO_ULTIMO || !(typeof isAdmin === 'function' && isAdmin())) return '';
  const p = percentualeSpazio(SPAZIO_ULTIMO);
  if (p < 70) return '';
  return tile('💽', Math.round(p) + '%', 'Spazio sul server usato', coloreSpazio(p), "oggiTab('permessi')", 'restano ' + fmtSpazio(Math.max(0, SPAZIO_ULTIMO.limite - SPAZIO_ULTIMO.totale)) + ' su ' + fmtSpazio(SPAZIO_ULTIMO.limite));
}
// una misura per sessione appena entra l'amministratore (per il riquadro in Oggi e il valore del mese)
(function () {
  let fatto = false;
  const prova = function () { if (!fatto && typeof isAdmin === 'function' && isAdmin() && typeof supabase !== 'undefined') { fatto = true; caricaSpazio().catch(function () { fatto = false; }); } };
  setInterval(prova, 20000); setTimeout(prova, 5000);
})();
