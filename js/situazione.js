/* ---------------- Contabilità > Situazione alla data: fatture, incassi e versamenti al CAF ---------------- */
// Dal… al… (di solito dall'inizio dell'anno a oggi): quanto è stato fatturato, quanto incassato,
// quanto versato al CAF Regionale, e le differenze; sotto, il dettaglio mese per mese con i progressivi.

const SIT = { da: '', a: '', rif: 'apertura' };

function isoDaNum(n) { const s = String(n); return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8); }
function dataPraticaSit(p) { return SIT.rif === 'fattura' ? (p.dataFattura || '') : SIT.rif === 'fine' ? (p.dataFine || '') : (p.data || ''); }

function renderSituazioneData() {
  const box = document.getElementById('situazione-data');
  if (!box) return;
  if (!box.dataset.pronta) {
    box.dataset.pronta = '1';
    const anno = annoAttivo(), oggi = isoOggi();
    SIT.da = SIT.da || anno + '-01-01';
    SIT.a = SIT.a || fineSituazione(anno);
    box.innerHTML = '<div class="raff-title">⚖️ Situazione alla data: fatture, incassi e versamenti al CAF</div>'
      + '<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end">'
      + '<div><label>Dal</label><input id="sit-da" type="date" style="width:auto" value="' + SIT.da + '" onchange="SIT.da=this.value; aggiornaSituazioneData()"></div>'
      + '<div><label>Fino al</label><input id="sit-a" type="date" style="width:auto" value="' + SIT.a + '" onchange="SIT.a=this.value; aggiornaSituazioneData()"></div>'
      + '<div><label>Pratiche per data di</label><select style="width:auto" onchange="SIT.rif=this.value; aggiornaSituazioneData()"><option value="apertura">Apertura</option><option value="fine">Fine lavorazione</option><option value="fattura">Fattura</option></select></div>'
      + '<button type="button" style="background:var(--line); color:var(--ink); border:none; border-radius:999px; padding:6px 12px; font-size:12px; cursor:pointer; margin-bottom:6px" onclick="situazioneAnnoAOggi()">Dall\'inizio dell\'anno a oggi</button>'
      + '<span style="flex:1"></span><button type="button" style="background:#c0392b; color:#fff; border:none; border-radius:999px; padding:5px 14px; font-size:12.5px; font-weight:700; cursor:pointer; margin-bottom:6px" onclick="stampaSituazioneData()">🖨️ Stampa</button></div>'
      + '<div id="sit-risultato" style="margin-top:10px"></div>';
  }
  aggiornaSituazioneData();
}

function fineSituazione(anno) { const oggi = isoOggi(); return Number(oggi.slice(0, 4)) === anno ? oggi : anno + '-12-31'; }
function situazioneAnnoAOggi() {
  const anno = annoAttivo();
  SIT.da = anno + '-01-01'; SIT.a = fineSituazione(anno);
  document.getElementById('sit-da').value = SIT.da; document.getElementById('sit-a').value = SIT.a;
  aggiornaSituazioneData();
}
function calcolaSituazioneData() {
  const da = isoNum(SIT.da) || 0, a = isoNum(SIT.a) || 99999999;
  const dentro = function (n) { return n != null && n >= da && n <= a; };
  const pratiche = (state.pratiche || []).filter(function (p) { return !p.annullata && dentro(dataNum(dataPraticaSit(p))); });
  const versamenti = (state.versamenti || []).filter(function (v) { return dentro(dataNum(v.data)); });
  const mesi = {};
  const mese = function (n) { const k = Math.floor(n / 100); return mesi[k] || (mesi[k] = { fatt: 0, inc: 0, vers: 0 }); };
  pratiche.forEach(function (p) { const m = mese(dataNum(dataPraticaSit(p))); m.fatt += Number(p.compenso || 0); m.inc += Number(p.pagato || 0); });
  versamenti.forEach(function (v) { mese(dataNum(v.data)).vers += Number(v.importo || 0); });
  const tot = { fatt: 0, inc: 0, vers: 0 };
  Object.keys(mesi).forEach(function (k) { tot.fatt += mesi[k].fatt; tot.inc += mesi[k].inc; tot.vers += mesi[k].vers; });
  return { pratiche: pratiche, versamenti: versamenti, mesi: mesi, tot: tot };
}

const NOMI_MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function situazioneDataHTML(r, perStampa) {
  const t = r.tot;
  const tile = function (valore, etichetta, colore, nota) {
    return '<div style="flex:1; min-width:150px; padding:10px 12px; border-radius:12px; background:' + colore + '; color:#fff"><div style="font-size:20px; font-weight:900">' + fmtEuro(valore) + '</div><div style="font-size:11px; font-weight:800; text-transform:uppercase">' + etichetta + '</div>' + (nota ? '<div style="font-size:11px; opacity:.9">' + nota + '</div>' : '') + '</div>';
  };
  const diffTile = function (valore, etichetta, formula) {
    const col = valore > 0.004 ? '#1f8a70' : valore < -0.004 ? '#c0392b' : '#6b7280';
    return '<div style="flex:1; min-width:180px; padding:10px 12px; border-radius:12px; border:2px solid ' + col + '; background:var(--card, #fff)"><div style="font-size:20px; font-weight:900; color:' + col + '">' + fmtEuro(valore) + '</div><div style="font-size:11.5px; font-weight:800; text-transform:uppercase">' + etichetta + '</div><div style="font-size:11px; color:#5b6b82">' + formula + '</div></div>';
  };
  const guadagni = typeof vedeGuadagni !== 'function' || vedeGuadagni();
  let progF = 0, progI = 0, progV = 0;
  const righe = Object.keys(r.mesi).sort().map(function (k) {
    const m = r.mesi[k];
    progF += m.fatt; progI += m.inc; progV += m.vers;
    const nome = NOMI_MESI[Number(String(k).slice(4, 6)) - 1] + ' ' + String(k).slice(0, 4);
    const num = function (v, colora) { return '<td style="text-align:right' + (colora ? '; font-weight:700; color:' + (v < -0.004 ? '#c0392b' : v > 0.004 ? '#1f8a70' : 'inherit') : '') + '">' + fmtEuro(v) + '</td>'; };
    return '<tr><td><b>' + nome + '</b></td>' + num(m.fatt) + num(m.inc) + num(m.vers) + num(progF) + num(progI) + num(progV) + num(progI - progV, true) + num(progF - progV, true) + '</tr>';
  }).join('');
  return '<div style="display:flex; gap:8px; flex-wrap:wrap">'
    + tile(t.fatt, 'Fatture emesse', '#2f9e5f', r.pratiche.length + ' pratiche')
    + tile(t.inc, 'Introiti (incassato)', '#8e5bd6', '')
    + tile(t.vers, 'Versamenti al CAF', '#2f7de1', r.versamenti.length + ' versamenti')
    + '</div>'
    + '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px">'
    + diffTile(t.inc - t.vers, 'Introiti − versamenti', 'soldi incassati rimasti dopo i versamenti al CAF')
    + diffTile(t.fatt - t.vers, 'Fatture − versamenti', 'fatturato non ancora coperto dai versamenti al CAF')
    + (guadagni ? diffTile(t.inc - t.fatt, 'Introiti − fatture', 'incassato in più (o in meno) rispetto al fatturato') : '')
    + '</div>'
    + (righe ? '<div class="tab-wrap" style="margin-top:12px"><table class="tab-proto"><thead><tr><th>Mese</th><th style="text-align:right">Fatture</th><th style="text-align:right">Introiti</th><th style="text-align:right">Versamenti CAF</th><th style="text-align:right">Fatture progr.</th><th style="text-align:right">Introiti progr.</th><th style="text-align:right">Versam. progr.</th><th style="text-align:right">Introiti − vers.</th><th style="text-align:right">Fatture − vers.</th></tr></thead><tbody>' + righe + '</tbody></table></div>'
      + '<div style="font-size:12px; color:#5b6b82; margin-top:6px">Le colonne "progr." sommano i mesi dall\'inizio del periodo fino a quel mese: l\'ultima riga è la situazione alla data scelta.</div>'
      : '<div class="empty">Nessuna pratica o versamento nel periodo scelto</div>');
}

function aggiornaSituazioneData() {
  const el = document.getElementById('sit-risultato');
  if (!el) return;
  el.innerHTML = situazioneDataHTML(calcolaSituazioneData());
}

function stampaSituazioneData() {
  const w = window.open('', '_blank');
  if (!w) { alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
  const it = function (iso) { return iso ? iso.split('-').reverse().join('/') : ''; };
  w.document.open();
  w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Situazione al ' + it(SIT.a) + '</title><style>@page{size:A4 landscape; margin:10mm} body{font-family:Arial,Helvetica,sans-serif; font-size:11.5px; color:#0f1b2d; -webkit-print-color-adjust:exact; print-color-adjust:exact} h1{font-size:16px; color:#1d4f91; margin:0 0 4px} table{width:100%; border-collapse:collapse} th,td{border:1px solid #cfd8e3; padding:4px 6px; text-align:left} th{background:#1d4f91; color:#fff} .tab-wrap{margin-top:10px} .empty{color:#5b6b82} .barra button{padding:8px 16px; margin:0 6px 10px 0} @media print{.barra{display:none}}</style></head><body>'
    + '<div class="barra"><button onclick="window.print()">🖨️ Stampa / Salva come PDF</button><button onclick="window.close()">Chiudi</button></div>'
    + '<h1>CAF CISL Alì Terme – Situazione fatture, introiti e versamenti al CAF</h1><div style="margin-bottom:8px; color:#5b6b82">Dal ' + it(SIT.da) + ' al ' + it(SIT.a) + ' · pratiche per data di ' + ({ apertura: 'apertura', fine: 'fine lavorazione', fattura: 'fattura' })[SIT.rif] + ' · stampato il ' + new Date().toLocaleDateString('it-IT') + '</div>'
    + situazioneDataHTML(calcolaSituazioneData(), true) + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
  w.document.close();
}
