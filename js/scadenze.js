/**
 * Calendario delle scadenze e avvisi (scheda SCADENZE).
 * Le scadenze sono in state.scadenze (caricate da data.js).
 */

const MESI_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
let meseCalendario = null; // { anno, mese (0-11) }

function isoLocale(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function oggiISO() { return isoLocale(new Date()); }
function giorniDaOggi(iso) {
  const [a, m, g] = iso.split('-').map(Number);
  const oggi = new Date();
  return Math.round((Date.UTC(a, m - 1, g) - Date.UTC(oggi.getFullYear(), oggi.getMonth(), oggi.getDate())) / 86400000);
}
function dataIT(iso) { const [a, m, g] = iso.split('-'); return g + '/' + m + '/' + a; }

// fatta | scaduta | avviso (entro i giorni di preavviso) | futura
function statoScadenza(s) {
  if (s.completata) return 'fatta';
  const d = giorniDaOggi(s.data);
  if (d < 0) return 'scaduta';
  if (d <= (s.avvisoGiorni || 0)) return 'avviso';
  return 'futura';
}
function quandoScadenza(s) {
  const d = giorniDaOggi(s.data);
  if (d === 0) return 'oggi';
  if (d === 1) return 'domani';
  if (d > 1) return 'tra ' + d + ' giorni';
  if (d === -1) return 'scaduta ieri';
  return 'scaduta da ' + (-d) + ' giorni';
}
const COLORI_SCADENZA = { scaduta: '#c0392b', avviso: '#d4881c', futura: '#2f7de1', fatta: '#8a96a8' };

function puoVedereScadenze() {
  const u = auth.profilo;
  return !!u && (u.ruolo === 'admin' || !!(u.tabs && u.tabs.scadenze));
}

function cambiaMeseCalendario(delta) {
  meseCalendario.mese += delta;
  if (meseCalendario.mese < 0) { meseCalendario.mese = 11; meseCalendario.anno--; }
  if (meseCalendario.mese > 11) { meseCalendario.mese = 0; meseCalendario.anno++; }
  renderScadenze();
}
function scegliGiornoCalendario(iso) {
  document.getElementById('sc-data').value = iso;
  document.getElementById('sc-titolo').focus();
}

function renderScadenze() {
  const cal = document.getElementById('cal-scadenze');
  if (!cal) return;
  if (!meseCalendario) { const o = new Date(); meseCalendario = { anno: o.getFullYear(), mese: o.getMonth() }; }
  const scadenze = state.scadenze || [];
  const perGiorno = {};
  scadenze.forEach(function (s) { (perGiorno[s.data] = perGiorno[s.data] || []).push(s); });

  const { anno, mese } = meseCalendario;
  const primo = new Date(anno, mese, 1);
  const vuotiIniziali = (primo.getDay() + 6) % 7; // settimana da lunedi'
  const giorniMese = new Date(anno, mese + 1, 0).getDate();
  const oggi = oggiISO();
  let celle = '';
  for (let i = 0; i < vuotiIniziali; i++) celle += '<div class="cal-cella vuota"></div>';
  for (let g = 1; g <= giorniMese; g++) {
    const iso = isoLocale(new Date(anno, mese, g));
    const lista = perGiorno[iso] || [];
    const dow = new Date(anno, mese, g).getDay();
    celle += '<div class="cal-cella' + (dow === 0 || dow === 6 ? ' weekend' : '') + (iso === oggi ? ' oggi' : '') + '" onclick="scegliGiornoCalendario(\'' + iso + '\')">'
      + '<div class="cal-num">' + g + '</div>'
      + lista.slice(0, 3).map(function (s) {
          return '<div class="cal-ev" style="background:' + COLORI_SCADENZA[statoScadenza(s)] + '" title="' + esc(s.titolo) + '">' + esc(s.titolo) + '</div>';
        }).join('')
      + (lista.length > 3 ? '<div class="cal-piu">+' + (lista.length - 3) + '</div>' : '')
      + '</div>';
  }
  cal.innerHTML = '<div class="cal-testa">'
    + '<button type="button" onclick="cambiaMeseCalendario(-1)">‹</button>'
    + '<b>' + MESI_IT[mese] + ' ' + anno + '</b>'
    + '<button type="button" onclick="cambiaMeseCalendario(1)">›</button></div>'
    + '<div class="cal-griglia">' + ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(function (d) { return '<div class="cal-gs' + (d === 'Sab' || d === 'Dom' ? ' weekend' : '') + '">' + d + '</div>'; }).join('') + celle + '</div>'
    + '<div class="cal-legenda"><span style="background:#c0392b"></span>Scaduta <span style="background:#d4881c"></span>Da avvisare <span style="background:#2f7de1"></span>In programma <span style="background:#8a96a8"></span>Fatta</div>';

  const daFare = scadenze.filter(function (s) { return !s.completata; });
  const fatte = scadenze.filter(function (s) { return s.completata; }).slice(-10).reverse();
  const riga = function (s) {
    const st = statoScadenza(s);
    return '<div class="sc-riga">'
      + '<span class="dot" style="background:' + COLORI_SCADENZA[st] + '"></span>'
      + '<div style="flex:1; min-width:0"><b>' + esc(s.titolo) + '</b>' + (s.cliente ? ' · ' + esc(s.cliente) : '')
      + '<div class="sub2">' + dataIT(s.data) + ' · ' + (s.completata ? 'fatta' : quandoScadenza(s)) + (s.avvisoGiorni ? ' · avviso ' + s.avvisoGiorni + ' gg prima' : ' · avviso il giorno stesso') + (s.note ? ' · ' + esc(s.note) : '') + '</div></div>'
      + '<label class="chk sc-fatta"><input type="checkbox" ' + (s.completata ? 'checked' : '') + ' onchange="segnaScadenza(\'' + s.id + '\', this.checked)"> Fatta</label>'
      + '<button type="button" class="sc-elimina" onclick="rimuoviScadenza(\'' + s.id + '\')">✕</button>'
      + '</div>';
  };
  document.getElementById('lista-scadenze').innerHTML =
    (daFare.length ? daFare.map(riga).join('') : '<div class="empty">Nessuna scadenza in programma.</div>')
    + (fatte.length ? '<div class="raff-title" style="margin-top:14px">Completate di recente</div>' + fatte.map(riga).join('') : '');
}

async function aggiungiScadenzaForm() {
  const cliente = document.getElementById('sc-cliente').value.trim().toUpperCase();
  const note = document.getElementById('sc-note').value.trim();
  const titolo = document.getElementById('sc-titolo').value.trim() || note || (cliente ? 'Appuntamento ' + cliente : '');
  const dataIso = document.getElementById('sc-data').value;
  if (!dataIso) { avviso('⚠️ Scegli la data della scadenza', true); return; }
  if (!titolo) { avviso('⚠️ Scrivi una descrizione, una nota o il cliente', true); return; }
  const r = await data.scadenze.aggiungi({
    titolo: titolo,
    data: dataIso,
    avvisoGiorni: parseInt(document.getElementById('sc-avviso').value, 10) || 0,
    cliente: cliente,
    note: note,
  });
  if (r.error) { avviso('❌ Scadenza non salvata: ' + r.error, true); return; }
  ['sc-titolo', 'sc-cliente', 'sc-note'].forEach(function (id) { document.getElementById(id).value = ''; });
  avviso('✓ Scadenza aggiunta');
}
async function segnaScadenza(id, fatta) {
  const r = await data.scadenze.aggiorna(id, { completata: fatta });
  if (r.error) { avviso('❌ ' + r.error, true); renderScadenze(); return; }
  avviso(fatta ? '✓ Scadenza segnata come fatta' : 'Scadenza riaperta');
}
async function rimuoviScadenza(id) {
  const s = (state.scadenze || []).find(function (x) { return x.id === id; });
  if (!s || !confirm('Eliminare la scadenza "' + s.titolo + '" del ' + dataIT(s.data) + '?')) return;
  const r = await data.scadenze.elimina(id);
  avviso(r.error ? '❌ ' + r.error : '✓ Scadenza eliminata', !!r.error);
}

// Riquadro fisso a destra con le scadenze scadute o entro il preavviso: resta finche' non sono segnate come fatte
let pannelloScadenzeRidotto = false;
function aggiornaAvvisiScadenze() {
  const btn = document.querySelector('.navmenu button[data-tab="scadenze"]');
  const vecchioBanner = document.getElementById('avvisi-scadenze');
  if (vecchioBanner) vecchioBanner.style.display = 'none';
  const urgenti = puoVedereScadenze()
    ? (state.scadenze || []).filter(function (s) { const st = statoScadenza(s); return st === 'scaduta' || st === 'avviso'; })
        .sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; })
    : [];
  if (btn) btn.innerHTML = 'SCADENZE' + (urgenti.length ? ' <span class="nav-conta">' + urgenti.length + '</span>' : '');
  let pan = document.getElementById('pannello-scadenze');
  if (!urgenti.length) { if (pan) pan.remove(); return; }
  if (!pan) {
    pan = document.createElement('div');
    pan.id = 'pannello-scadenze';
    document.body.appendChild(pan);
  }
  pan.style.cssText = 'position:fixed; right:10px; z-index:45; width:min(320px, calc(100vw - 20px)); background:var(--card); color:var(--ink); border:2px solid #d4881c; border-radius:14px; box-shadow:0 10px 30px rgba(0,0,0,.18); font-size:13px; overflow:hidden';
  const testa = '<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; background:#d4881c; color:#fff; padding:8px 12px; font-weight:800; cursor:pointer" onclick="pannelloScadenzeRidotto=!pannelloScadenzeRidotto; aggiornaAvvisiScadenze()">'
    + '<span>🔔 ' + urgenti.length + (urgenti.length === 1 ? ' scadenza da gestire' : ' scadenze da gestire') + '</span>'
    + '<span title="' + (pannelloScadenzeRidotto ? 'Espandi' : 'Riduci') + '">' + (pannelloScadenzeRidotto ? '▾' : '▴') + '</span></div>';
  pan.innerHTML = testa + (pannelloScadenzeRidotto ? '' : '<div style="max-height:min(50vh, 420px); overflow-y:auto; padding:4px 12px">'
    + urgenti.map(function (s) {
        const col = COLORI_SCADENZA[statoScadenza(s)];
        return '<div style="display:flex; gap:8px; align-items:flex-start; padding:8px 0; border-bottom:1px solid var(--line)">'
          + '<span style="flex:none; width:10px; height:10px; border-radius:50%; margin-top:4px; background:' + col + '"></span>'
          + '<div style="flex:1; min-width:0"><b>' + esc(s.titolo) + '</b>' + (s.cliente ? '<br>' + esc(s.cliente) : '')
          + '<div style="font-size:12px; color:var(--sub)">' + dataIT(s.data) + ' · <b style="color:' + col + '">' + quandoScadenza(s) + '</b>' + (s.note ? ' · ' + esc(s.note) : '') + '</div></div>'
          + '<label style="flex:none; display:flex; align-items:center; gap:4px; font-size:12px; font-weight:700; color:#2f9e5f; cursor:pointer; margin:0"><input type="checkbox" style="width:auto" onchange="this.disabled=true; segnaScadenza(\'' + s.id + '\', true)"> Fatta</label>'
          + '</div>';
      }).join('')
    + '<div style="padding:8px 0; text-align:right"><button type="button" style="background:none; border:none; color:#d4881c; font-weight:700; font-size:12px; cursor:pointer; padding:0" onclick="showTab(document.querySelector(\'.navmenu button[data-tab=&quot;scadenze&quot;]\'))">Apri calendario ›</button></div></div>');
  posizionaPannelloScadenze();
}
function posizionaPannelloScadenze() {
  const pan = document.getElementById('pannello-scadenze');
  if (!pan) return;
  const badge = document.getElementById('badge-lavorate');
  const sotto = badge ? badge.getBoundingClientRect().bottom : 0;
  pan.style.top = Math.max(10, Math.round(sotto) + 10) + 'px';
}
window.addEventListener('resize', posizionaPannelloScadenze);
