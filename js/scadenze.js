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

// Avviso in alto e contatore sulla scheda per le scadenze scadute o entro il preavviso
function aggiornaAvvisiScadenze() {
  const box = document.getElementById('avvisi-scadenze');
  const btn = document.querySelector('.navmenu button[data-tab="scadenze"]');
  if (!box) return;
  const urgenti = puoVedereScadenze()
    ? (state.scadenze || []).filter(function (s) { const st = statoScadenza(s); return st === 'scaduta' || st === 'avviso'; })
    : [];
  if (btn) btn.innerHTML = 'SCADENZE' + (urgenti.length ? ' <span class="nav-conta">' + urgenti.length + '</span>' : '');
  if (!urgenti.length) { box.style.display = 'none'; return; }
  box.style.display = 'flex';
  box.innerHTML = '<span>🔔 <b>' + urgenti.length + (urgenti.length === 1 ? ' scadenza' : ' scadenze') + ' da gestire:</b> '
    + urgenti.slice(0, 4).map(function (s) {
        return '<span style="color:' + COLORI_SCADENZA[statoScadenza(s)] + '; font-weight:600">' + esc(s.titolo) + '</span>' + (s.cliente ? ' – ' + esc(s.cliente) : '') + ' (' + quandoScadenza(s) + ')';
      }).join(' · ')
    + (urgenti.length > 4 ? ' e altre ' + (urgenti.length - 4) : '') + '</span>'
    + '<button type="button" onclick="showTab(document.querySelector(\'.navmenu button[data-tab=&quot;scadenze&quot;]\'))">Apri calendario</button>';
  if (!popupScadenzeMostrato) { popupScadenzeMostrato = true; mostraPopupScadenze(urgenti); }
}

// Finestra di avviso, una volta per ogni apertura del programma
let popupScadenzeMostrato = false;
function mostraPopupScadenze(urgenti) {
  const ordinate = urgenti.slice().sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
  const ov = document.createElement('div');
  ov.id = 'popup-scadenze';
  ov.style.cssText = 'position:fixed; inset:0; z-index:200; background:rgba(15,27,45,.45); display:flex; align-items:center; justify-content:center; padding:16px';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:16px; max-width:520px; width:100%; max-height:80vh; overflow:auto; padding:20px; box-shadow:0 20px 50px rgba(0,0,0,.3)">'
    + '<div style="font-size:18px; font-weight:800; margin-bottom:4px">🔔 Scadenze da gestire</div>'
    + '<div style="font-size:13px; color:var(--sub); margin-bottom:12px">' + ordinate.length + (ordinate.length === 1 ? ' scadenza scaduta o in arrivo' : ' scadenze scadute o in arrivo') + '</div>'
    + ordinate.map(function (s) {
        return '<div style="display:flex; gap:10px; align-items:flex-start; padding:9px 0; border-bottom:1px solid var(--line)">'
          + '<span style="flex:none; width:10px; height:10px; border-radius:50%; margin-top:5px; background:' + COLORI_SCADENZA[statoScadenza(s)] + '"></span>'
          + '<div style="flex:1; min-width:0"><b>' + esc(s.titolo) + '</b>' + (s.cliente ? ' – ' + esc(s.cliente) : '')
          + '<div style="font-size:12.5px; color:var(--sub)">' + dataIT(s.data) + ' · <b style="color:' + COLORI_SCADENZA[statoScadenza(s)] + '">' + quandoScadenza(s) + '</b>' + (s.note ? ' · ' + esc(s.note) : '') + '</div></div></div>';
      }).join('')
    + '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:14px">'
    + '<button type="button" id="popup-sc-chiudi" style="background:var(--line); color:var(--ink)">Chiudi</button>'
    + '<button type="button" id="popup-sc-apri" style="background:#d4881c; color:#fff">Apri calendario</button></div></div>';
  document.body.appendChild(ov);
  const chiudi = function () { ov.remove(); };
  ov.addEventListener('click', function (e) { if (e.target === ov) chiudi(); });
  document.getElementById('popup-sc-chiudi').onclick = chiudi;
  document.getElementById('popup-sc-apri').onclick = function () { chiudi(); showTab(document.querySelector('.navmenu button[data-tab="scadenze"]')); };
}
