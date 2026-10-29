/* ---------------- 💶 Anno precedente del cliente ----------------
   Nell'inserimento di una pratica, appena si sceglie il cliente (dall'archivio o scrivendo il codice fiscale),
   se ha avuto pratiche nell'anno prima compare un piccolo riquadro: tipo, fatturato, richiesto e pagato
   dell'anno precedente, per confrontare con quello che si sta protocollando. Solo informativo: si chiude con OK.
   Una volta per cliente in ogni sessione. */

const ANNO_PREC_VISTI = {};
function praticheAnnoPrecedenteCliente(cf, nome) {
  const prec = annoAttivo() - 1;
  cf = String(cf || '').trim().toUpperCase(); nome = String(nome || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!cf && !nome) return [];
  const stesso = function (pcf, pnome) {
    pcf = String(pcf || '').toUpperCase();
    if (cf && pcf) return pcf === cf;
    return !!nome && String(pnome || '').trim().toUpperCase().replace(/\s+/g, ' ') === nome;
  };
  return (state.pratiche || []).filter(function (p) {
    if (annoPratica(p) !== prec || eRinuncia(p)) return false;
    if (stesso(p.codiceFiscale, p.nome)) return true;
    return (p.congCognome || p.congNome) && stesso(p.congCodiceFiscale, ((p.congCognome || '') + ' ' + (p.congNome || '')).trim());
  }).sort(function (a, b) { return (a.numero || 0) - (b.numero || 0); });
}
function avvisoAnnoPrecedente(c) {
  if (!c) return;
  const cf = c.codiceFiscale || '', nome = c.nomeCompleto || ((c.cognome || '') + ' ' + (c.nome || '')).trim();
  const chiave = annoAttivo() + '|' + (String(cf).toUpperCase() || String(nome).toUpperCase());
  if (ANNO_PREC_VISTI[chiave]) return;
  const lista = praticheAnnoPrecedenteCliente(cf, nome);
  if (!lista.length) return;
  ANNO_PREC_VISTI[chiave] = true;
  const titolo = nome || lista[0].nome || '';
  const prec = annoAttivo() - 1, euro = function (v) { return v === null || v === undefined || v === '' ? '—' : fmtEuro(Number(v) || 0); };
  const tot = lista.reduce(function (t, p) { t.f += Number(p.compenso || 0); t.r += Number(p.richiesto || 0); t.p += Number(p.pagato || 0); return t; }, { f: 0, r: 0, p: 0 });
  const vecchio = document.getElementById('popup-anno-prec'); if (vecchio) vecchio.remove();
  const ov = document.createElement('div');
  ov.id = 'popup-anno-prec';
  ov.style.cssText = 'position:fixed; inset:0; z-index:465; background:rgba(15,27,45,.45); display:flex; align-items:center; justify-content:center; padding:14px';
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-chiudi]')) ov.remove(); });
  const td = 'padding:5px 6px; border-bottom:1px solid var(--line)';
  ov.innerHTML = '<div style="background:var(--card); color:var(--ink); border-radius:14px; border-top:6px solid #b35f0c; max-width:620px; width:100%; max-height:90vh; overflow:auto; padding:14px 16px; box-shadow:0 10px 40px rgba(0,0,0,.3)">'
    + '<div style="font-size:17px; font-weight:800; color:#b35f0c">💶 Attenzione: ' + esc(nome) + ' nel ' + prec + '</div>'
    + '<div style="font-size:12.5px; color:var(--sub); margin:2px 0 10px">Pratiche dell\'anno precedente, per confrontare con quella che stai inserendo.</div>'
    + '<table style="width:100%; border-collapse:collapse; font-size:13px"><tr style="text-align:left; color:var(--sub)"><th style="' + td + '">Protocollo</th><th style="' + td + '">Tipo</th><th style="' + td + '; text-align:right">Fatturato</th><th style="' + td + '; text-align:right">Richiesto</th><th style="' + td + '; text-align:right">Pagato</th></tr>'
    + lista.map(function (p) {
        const coniuge = !(String(p.codiceFiscale || '').toUpperCase() === String(cf).toUpperCase() && cf) && String(p.nome || '').toUpperCase() !== String(nome).toUpperCase();
        return '<tr><td style="' + td + '"><b>' + esc(formattaProtocollo(p)) + '</b></td><td style="' + td + '">' + esc(p.tipo || '') + (coniuge ? ' <span style="font-size:11.5px; color:var(--sub)">(come coniuge di ' + esc(p.nome || '') + ')</span>' : '') + '</td>'
          + '<td style="' + td + '; text-align:right">' + euro(p.compenso) + '</td><td style="' + td + '; text-align:right">' + euro(p.richiesto) + '</td><td style="' + td + '; text-align:right; font-weight:700">' + euro(p.pagato) + '</td></tr>';
      }).join('')
    + (lista.length > 1 ? '<tr style="font-weight:800"><td style="' + td + '" colspan="2">Totale ' + prec + '</td><td style="' + td + '; text-align:right">' + fmtEuro(tot.f) + '</td><td style="' + td + '; text-align:right">' + fmtEuro(tot.r) + '</td><td style="' + td + '; text-align:right">' + fmtEuro(tot.p) + '</td></tr>' : '')
    + '</table>'
    + '<div style="text-align:right; margin-top:12px"><button type="button" data-chiudi style="background:#b35f0c; color:#fff; border:none; border-radius:999px; padding:7px 22px; font-weight:800; cursor:pointer">OK</button></div></div>';
  document.body.appendChild(ov);
}
