/* ---------------- 🔔 Sollecito di ritiro ----------------
   Dal 7 ottobre dell'anno della campagna, le pratiche già pronte (lavorate) e non ancora consegnate:
   un WhatsApp per ricordare al cliente di passare a ritirarle. Uno per volta, come il WhatsApp multiplo;
   le pratiche con lo stesso cellulare partono in un solo messaggio. Ogni invio resta nelle comunicazioni
   («Sollecito ritiro»), così si vede chi è già stato sollecitato e quando. */

const SOLLECITO_DAL_MESE = 10, SOLLECITO_DAL_GIORNO = 7; // 7 ottobre
const SOLLECITO = { lista: [], scelti: {}, coda: [], pos: 0, inviati: {}, fase: 'scelta' };

function sollecitoRitiroAttivo(anno) {
  anno = anno || annoAttivo();
  return new Date() >= new Date(anno, SOLLECITO_DAL_MESE - 1, SOLLECITO_DAL_GIORNO);
}
// pronte e non ritirate: come il riquadro «Pronte da consegnare» (senza colf e badanti)
function praticheDaSollecitare(anno) {
  anno = anno || annoAttivo();
  return (state.pratiche || []).filter(function (p) {
    return !p.annullata && annoPratica(p) === anno && !eDaLavorare(p) && !eConsegnata(p) && !eRinuncia(p) && !eColf(p.tipo);
  }).sort(function (a, b) { return (a.nome || '').localeCompare(b.nome || ''); });
}
// ultimo sollecito mandato a questa pratica (registro delle comunicazioni)
function ultimoSollecitoRitiro(p) {
  if (typeof COMUNICAZIONI === 'undefined') return null;
  return COMUNICAZIONI.lista.find(function (c) {
    return c.motivo === 'Sollecito ritiro' && (String(c.pratica_id || '') === String(p.id) || (!c.pratica_id && String(c.nome || '').toUpperCase() === String(p.nome || '').toUpperCase()));
  }) || null;
}
function cosaPratica(p) { return /^730/.test(p.tipo || '') ? 'dichiarazione 730' : (p.tipo || 'pratica').toLowerCase(); }
function codaSollecito() {
  return (IMPOSTAZIONI.caf_indirizzo ? ', in ' + IMPOSTAZIONI.caf_indirizzo : '') + '.'
    + (IMPOSTAZIONI.caf_orari ? ' Orari di apertura: ' + IMPOSTAZIONI.caf_orari + '.' : '')
    + (IMPOSTAZIONI.caf_telefono ? ' Per informazioni può chiamare il ' + IMPOSTAZIONI.caf_telefono + '.' : '')
    + '\nGrazie.\nCAF CISL Alì Terme';
}
function messaggioSollecitoRitiro(pratiche) {
  if (pratiche.length === 1) {
    const p = pratiche[0];
    return 'Gentile ' + nomeProprio(p.nome) + ', le ricordiamo che la sua ' + cosaPratica(p) + ' (protocollo n. ' + formattaProtocollo(p) + ') è pronta già da tempo e non è ancora stata ritirata.'
      + ' La preghiamo di passare a ritirarla il prima possibile presso il CAF CISL di Alì Terme' + codaSollecito();
  }
  return 'Buongiorno, le ricordiamo che queste pratiche sono pronte già da tempo e non sono ancora state ritirate:\n'
    + pratiche.map(rigaPraticaMessaggio).join('\n')
    + '\n\nVi preghiamo di passare a ritirarle il prima possibile presso il CAF CISL di Alì Terme' + codaSollecito();
}

function apriSollecitoRitiro(annoScelto) {
  const anno = annoScelto || annoAttivo();
  const lista = praticheDaSollecitare(anno);
  if (!lista.length) { avviso('Nessuna pratica pronta da ritirare nel ' + anno); return; }
  SOLLECITO.anno = anno; SOLLECITO.lista = lista; SOLLECITO.scelti = {}; SOLLECITO.coda = []; SOLLECITO.pos = 0; SOLLECITO.inviati = {}; SOLLECITO.fase = 'scelta';
  // già selezionate: con il cellulare e non sollecitate negli ultimi 15 giorni
  lista.forEach(function (p) { const u = ultimoSollecitoRitiro(p); if (numeroWhatsApp(p.telefono) && !(u && Date.now() - Date.parse(u.quando) < 15 * 86400000)) SOLLECITO.scelti[p.id] = true; });
  let ov = document.getElementById('popup-sollecito'); if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'popup-sollecito';
  ov.style.cssText = 'position:fixed; inset:0; z-index:400; background:rgba(15,27,45,.45); display:flex; align-items:center; justify-content:center; padding:16px';
  document.body.appendChild(ov);
  disegnaSollecitoRitiro();
}
function chiudiSollecitoRitiro() { const ov = document.getElementById('popup-sollecito'); if (ov) ov.remove(); }
function disegnaSollecitoRitiro() {
  const ov = document.getElementById('popup-sollecito'); if (!ov) return;
  const st = SOLLECITO;
  let corpo = '';
  if (st.fase === 'scelta') {
    const scelte = st.lista.filter(function (p) { return st.scelti[p.id] && numeroWhatsApp(p.telefono); });
    const nMsg = Object.keys(scelte.reduce(function (o, p) { o[numeroWhatsApp(p.telefono)] = 1; return o; }, {})).length;
    corpo = '<div style="font-size:18px; font-weight:800; margin-bottom:2px; color:#b35f0c">🔔 Sollecito di ritiro</div>'
      + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:10px">Pratiche del ' + (st.anno || annoAttivo()) + ' già pronte e non ancora ritirate. Sono già selezionate quelle con il cellulare non sollecitate negli ultimi 15 giorni. Le pratiche con lo stesso cellulare partono in un solo messaggio.</div>'
      + '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px">'
      + '<button type="button" style="background:var(--line); color:var(--ink); padding:6px 10px; font-size:12.5px" onclick="selezionaSollecito(true)">Seleziona tutti</button>'
      + '<button type="button" style="background:var(--line); color:var(--ink); padding:6px 10px; font-size:12.5px" onclick="selezionaSollecito(false)">Nessuno</button></div>'
      + (st.lista.length > 1 && typeof campoRicercaElenco === 'function' ? campoRicercaElenco('popup-sollecito', 'Cerca un nome o un protocollo…') : '')
      + '<div style="max-height:45vh; overflow-y:auto; border:1px solid var(--line); border-radius:10px">'
      + st.lista.map(function (p) {
          const num = numeroWhatsApp(p.telefono), u = ultimoSollecitoRitiro(p), g = typeof giorniDa === 'function' ? giorniDa(p.dataFine) : null;
          return '<label class="el-riga" style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid var(--line); margin:0; font-size:13px; color:var(--ink); cursor:' + (num ? 'pointer' : 'default') + '">'
            + '<input type="checkbox" style="width:auto" ' + (st.scelti[p.id] ? 'checked' : '') + (num ? '' : ' disabled') + ' onchange="SOLLECITO.scelti[\'' + p.id + '\']=this.checked; disegnaSollecitoRitiro()">'
            + '<span style="flex:1; min-width:0"><b>' + esc(formattaProtocollo(p)) + '</b> · ' + esc(p.nome || '') + ' <span style="color:var(--sub)">(' + esc(p.tipo || '') + ')</span><br>'
            + '<span style="font-size:12px; color:var(--sub)">' + (num ? '📱 ' + esc(p.telefono) : '⚠️ senza cellulare' + (p.telefonoFisso ? ': chiamare il ☎️ ' + esc(p.telefonoFisso) : '')) + (g !== null && g > 0 ? ' · pronta da ' + g + ' giorni' : '') + '</span>'
            + (p.whatsappInviato ? ' <span style="font-size:12px; color:var(--sub)">· avvisato il ' + esc(p.whatsappInviato) + '</span>' : '')
            + (u ? ' <span style="font-size:12px; color:#b35f0c; font-weight:700">· sollecitato il ' + esc(quandoComunicazione(u).split(' ')[0]) + '</span>' : '') + '</span></label>';
        }).join('') + '</div>'
      + '<div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px">'
      + '<button type="button" style="background:var(--line); color:var(--ink)" onclick="chiudiSollecitoRitiro()">Annulla</button>'
      + '<button type="button" style="background:#25d366; color:#fff"' + (scelte.length ? '' : ' disabled') + ' onclick="avviaSollecitoRitiro()">Avanti: ' + nMsg + (nMsg === 1 ? ' messaggio' : ' messaggi') + (nMsg < scelte.length ? ' per ' + scelte.length + ' pratiche' : '') + ' ›</button></div>';
  } else {
    const tot = st.coda.length, prossimo = st.coda[st.pos];
    corpo = '<div style="font-size:18px; font-weight:800; margin-bottom:2px; color:#b35f0c">🔔 Sollecito in corso: ' + Math.min(st.pos, tot) + ' di ' + tot + '</div>'
      + '<div style="font-size:12.5px; color:var(--sub); margin-bottom:10px">Per ogni cliente si apre WhatsApp con il messaggio già scritto: premi Invio in WhatsApp, poi torna qui e clicca il successivo.</div>'
      + (prossimo
          ? '<button type="button" style="display:block; width:100%; background:#25d366; color:#fff; font-size:16px; padding:14px" onclick="inviaProssimoSollecito()">💬 Apri WhatsApp per ' + esc(prossimo.pratiche.map(function (p) { return nomeProprio(p.nome); }).join(', ')) + (prossimo.pratiche.length > 1 ? ' (un solo messaggio)' : '') + '</button>'
            + '<div style="text-align:right; margin-top:6px"><button type="button" style="background:none; color:var(--sub); font-size:12.5px; padding:4px 0" onclick="SOLLECITO.pos++; disegnaSollecitoRitiro()">Salta questo cliente ›</button></div>'
          : '<div style="padding:14px; border-radius:10px; background:color-mix(in srgb, #25d366 15%, var(--card)); font-weight:700; text-align:center">✅ Finito: aperte ' + Object.keys(st.inviati).length + ' chat su ' + tot + '</div>')
      + '<div style="max-height:40vh; overflow-y:auto; margin-top:10px; border:1px solid var(--line); border-radius:10px">'
      + st.coda.map(function (g, i) {
          const stato = st.inviati[g.id] ? '<span style="color:#1a9e4b; font-weight:700">✓ aperto</span>' : (i < st.pos ? '<span style="color:var(--sub)">saltato</span>' : (i === st.pos ? '<span style="color:#d4881c; font-weight:700">● prossimo</span>' : '<span style="color:var(--sub)">in attesa</span>'));
          return '<div style="display:flex; justify-content:space-between; gap:8px; padding:7px 10px; border-bottom:1px solid var(--line); font-size:13px"><span>' + (i + 1) + '. ' + esc(g.pratiche.map(function (p) { return p.nome || ''; }).join(', ')) + '</span>' + stato + '</div>';
        }).join('') + '</div>'
      + '<div style="display:flex; justify-content:flex-end; margin-top:12px"><button type="button" style="background:var(--line); color:var(--ink)" onclick="chiudiSollecitoRitiro()">' + (prossimo ? 'Interrompi' : 'Chiudi') + '</button></div>';
  }
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; border-top:6px solid #b35f0c; max-width:600px; width:100%; max-height:90vh; overflow:auto; padding:18px 20px; box-shadow:0 20px 50px rgba(0,0,0,.3)">' + corpo + '</div>';
}
function selezionaSollecito(tutti) {
  SOLLECITO.lista.forEach(function (p) { SOLLECITO.scelti[p.id] = tutti && !!numeroWhatsApp(p.telefono); });
  disegnaSollecitoRitiro();
}
function avviaSollecitoRitiro() {
  const st = SOLLECITO, gruppi = {};
  st.coda = [];
  st.lista.filter(function (p) { return st.scelti[p.id] && numeroWhatsApp(p.telefono); }).forEach(function (p) {
    const k = numeroWhatsApp(p.telefono);
    if (!gruppi[k]) { gruppi[k] = { id: 'g' + st.coda.length, num: k, pratiche: [] }; st.coda.push(gruppi[k]); }
    gruppi[k].pratiche.push(p);
  });
  st.pos = 0; st.fase = 'invio';
  disegnaSollecitoRitiro();
}
function inviaProssimoSollecito() {
  const st = SOLLECITO, g = st.coda[st.pos];
  if (!g) return;
  const testo = messaggioSollecitoRitiro(g.pratiche), p0 = g.pratiche[0];
  if (typeof contestoComunicazione === 'function') contestoComunicazione({ nome: p0.nome, cf: p0.codiceFiscale || '', nascita: p0.cf || '', praticaId: p0.id, motivo: 'Sollecito ritiro' });
  apriChatWhatsApp(g.num, testo);
  // le altre pratiche dello stesso messaggio: una riga nelle comunicazioni per ogni cliente
  g.pratiche.slice(1).forEach(function (p) {
    if (typeof registraComunicazione === 'function') registraComunicazione({ canale: 'whatsapp', telefono: g.num, testo: testo, nome: p.nome, cf: p.codiceFiscale || '', nascita: p.cf || '', praticaId: p.id, motivo: 'Sollecito ritiro', senzaContesto: true });
  });
  st.inviati[g.id] = true;
  st.pos++;
  disegnaSollecitoRitiro();
}
// Riquadro nella pagina Oggi (solo dal 7 ottobre): quante pratiche pronte non sono ancora state ritirate
function tileSollecitoRitiro(tile) {
  if (!sollecitoRitiroAttivo()) return '';
  const l = praticheDaSollecitare();
  if (!l.length) return '';
  const da = l.filter(function (p) { const u = ultimoSollecitoRitiro(p); return numeroWhatsApp(p.telefono) && !(u && Date.now() - Date.parse(u.quando) < 15 * 86400000); }).length;
  return tile('🔔', l.length, 'Pronte non ritirate: sollecito', '#b35f0c', 'apriSollecitoRitiro()', da ? da + ' da sollecitare su WhatsApp' : 'tutte già sollecitate di recente');
}
