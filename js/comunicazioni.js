/* ---------------- 📨 Registro delle comunicazioni con i clienti ----------------
   Ogni WhatsApp aperto e ogni e-mail inviata dal programma lascia una riga (tabella "comunicazioni"):
   quando, come, perché, a chi e chi l'ha mandata. Si vede nella scheda della persona (ricerca unica)
   e nell'archivio clienti, così si sa subito se il cliente è già stato avvisato. */

const COMUNICAZIONI = { lista: [], caricato: false };
// Chi sta per ricevere il messaggio (lo indica chi apre WhatsApp o l'e-mail); si usa una volta sola
let CONTESTO_COMUNICAZIONE = null;
function contestoComunicazione(c) { CONTESTO_COMUNICAZIONE = c ? Object.assign({ quando: Date.now() }, c) : null; }

// Perché è stato mandato il messaggio, dal testo
function motivoDaTesto(t) {
  t = String(t || '').toLowerCase();
  if (/appuntamento/.test(t) && /ricordiamo/.test(t)) return 'Promemoria appuntamento';
  if (/iniziata la campagna/.test(t)) return 'Avvio campagna 730';
  if (/ancora possibile presentare/.test(t)) return 'Richiamo 730';
  if (/documento d'identit|documento d’identit/.test(t)) return 'Richiesta documento d\'identità';
  if (/ci mancano ancora|documenti mancanti/.test(t)) return 'Documenti mancanti';
  if (/ricevuta/.test(t)) return 'Invio ricevuta';
  if (/da pagare|deve ancora|saldo|pagamento/.test(t)) return 'Sollecito pagamento';
  if (/pronta|ritir|può passare|e' pronta|è pronta/.test(t)) return 'Pratica pronta';
  if (/assistenza.*scade|scade il/.test(t)) return 'Avviso scadenza';
  return 'Messaggio';
}
function soloCifre(s) { return String(s || '').replace(/\D/g, '').replace(/^(00)?39(?=\d{9,10}$)/, ''); }
// Il cliente dal numero di telefono (archivio, poi pratiche)
function personaDaTelefono(num) {
  const n = soloCifre(num); if (!n) return null;
  const c = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).find(function (x) { return soloCifre(x.telefono) === n || soloCifre(x.telefonoFisso) === n; });
  if (c) return { nome: c.nomeCompleto, cf: c.codiceFiscale || '' };
  const p = (state.pratiche || []).slice().reverse().find(function (x) { return soloCifre(x.telefono) === n; });
  if (p) return { nome: p.nome, cf: p.codiceFiscale || '', praticaId: p.id };
  const q = (state.pratiche || []).slice().reverse().find(function (x) { return soloCifre(x.congTelefono) === n; });
  if (q) return { nome: (((q.congCognome || '') + ' ' + (q.congNome || '')).trim() || q.congiunta || ''), cf: q.congCodiceFiscale || '' };
  return null;
}
function personaDaEmail(a) {
  a = String(a || '').trim().toLowerCase(); if (!a) return null;
  const c = (typeof ARCHIVIO_CLIENTI !== 'undefined' ? ARCHIVIO_CLIENTI : []).find(function (x) { return String(x.email || '').toLowerCase() === a; });
  if (c) return { nome: c.nomeCompleto, cf: c.codiceFiscale || '' };
  const p = (state.pratiche || []).slice().reverse().find(function (x) { return String(x.email || '').toLowerCase() === a; });
  return p ? { nome: p.nome, cf: p.codiceFiscale || '', praticaId: p.id } : null;
}

async function registraComunicazione(r) {
  if (!r || !auth || !auth.profilo) return;
  const ctx = CONTESTO_COMUNICAZIONE && Date.now() - CONTESTO_COMUNICAZIONE.quando < 120000 ? CONTESTO_COMUNICAZIONE : null;
  CONTESTO_COMUNICAZIONE = null;
  const chi = (r.canale === 'email' ? personaDaEmail(r.email) : personaDaTelefono(r.telefono)) || {};
  const riga = {
    canale: r.canale, motivo: r.motivo || (ctx && ctx.motivo) || motivoDaTesto(r.testo),
    nome: String((ctx && ctx.nome) || r.nome || chi.nome || '').trim().toUpperCase() || null,
    codice_fiscale: (ctx && ctx.cf) || r.cf || chi.cf || null,
    telefono: r.telefono || null, email: r.email || null,
    pratica_id: (ctx && ctx.praticaId) || r.praticaId || chi.praticaId || null,
    testo: String(r.testo || '').slice(0, 400) || null,
    operatore: ((auth.profilo && auth.profilo.nome) || '').toUpperCase() || null,
  };
  if (!riga.nome && !riga.telefono && !riga.email) return;
  riga.quando = new Date().toISOString();
  COMUNICAZIONI.lista.unshift(riga);
  try {
    const x = await fetchSupabase('/rest/v1/comunicazioni', 'POST', riga, { Prefer: 'return=representation' });
    if (x && x.ok && Array.isArray(x.data) && x.data[0]) Object.assign(riga, x.data[0]);
  } catch (e) { /* senza rete la riga resta solo su questo dispositivo fino al prossimo caricamento */ }
  if (typeof disegnaSchedaPersona === 'function' && document.getElementById('popup-persona')) disegnaSchedaPersona();
}

async function caricaComunicazioni() {
  if (!(typeof puo === 'function' && (puo('anagrafica') || puo('registro')))) return;
  const da = new Date(Date.now() - 400 * 86400000).toISOString();
  try {
    const r = await fetchSupabase('/rest/v1/comunicazioni?select=*&quando=gte.' + encodeURIComponent(da) + '&order=quando.desc&limit=5000', 'GET');
    if (r && r.ok && Array.isArray(r.data)) { COMUNICAZIONI.lista = r.data; COMUNICAZIONI.caricato = true; }
  } catch (e) {}
}

function comunicazioniPersona(nome, cf) {
  nome = String(nome || '').trim().toUpperCase(); cf = String(cf || '').trim().toUpperCase();
  return COMUNICAZIONI.lista.filter(function (c) { return (cf && String(c.codice_fiscale || '').toUpperCase() === cf) || (nome && c.nome === nome); });
}
function quandoComunicazione(c) {
  const d = new Date(c.quando);
  return isNaN(d) ? '' : d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
function iconaCanale(c) { return c.canale === 'email' ? '📧' : '💬'; }
// Riga breve con l'ultimo contatto (archivio clienti)
function ultimoContattoHTML(nome, cf) {
  const l = comunicazioniPersona(nome, cf); if (!l.length) return '';
  const c = l[0];
  return '<div style="font-size:11.5px; color:#1d4f91; font-weight:700">📨 Ultimo contatto: ' + iconaCanale(c) + ' ' + esc(quandoComunicazione(c).split(' ')[0]) + ' · ' + esc(c.motivo || '') + (l.length > 1 ? ' <span style="color:var(--sub); font-weight:600">(' + l.length + ' in tutto)</span>' : '') + '</div>';
}
// Elenco completo (scheda della persona, modifica cliente)
function elencoComunicazioniHTML(nome, cf, max) {
  const l = comunicazioniPersona(nome, cf);
  if (!l.length) return '<div style="margin-bottom:10px; font-size:12.5px; color:var(--sub)">📨 Nessuna comunicazione registrata (WhatsApp ed e-mail mandati dal programma).</div>';
  const mostra = l.slice(0, max || 15);
  return '<details open style="margin-bottom:10px; padding:8px 12px; border-radius:10px; border:1.5px solid #1d4f91; background:color-mix(in srgb, #1d4f91 6%, var(--card))"><summary style="cursor:pointer; font-weight:800; color:#1d4f91">📨 Comunicazioni (' + l.length + ')</summary>'
    + mostra.map(function (c) {
      return '<div style="display:flex; gap:8px; padding:5px 0; border-bottom:1px solid var(--line); font-size:13px" title="' + esc(c.testo || '') + '"><span style="flex:none">' + iconaCanale(c) + '</span>'
        + '<span style="flex:1"><b>' + esc(c.motivo || 'Messaggio') + '</b> <span class="sub2">' + esc(quandoComunicazione(c)) + (c.operatore ? ' · da ' + esc(c.operatore) : '') + (c.canale === 'email' && c.email ? ' · ' + esc(c.email) : (c.telefono ? ' · ' + esc(c.telefono) : '')) + '</span></span></div>';
    }).join('') + (l.length > mostra.length ? '<div class="sub2" style="margin-top:4px">… e altre ' + (l.length - mostra.length) + '</div>' : '') + '</details>';
}
