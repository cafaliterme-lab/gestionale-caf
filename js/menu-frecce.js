/* ---------------- ‹ › Frecce del menu sul telefono ----------------
   Sul telefono i tasti delle pagine stanno su una riga che scorre col dito: due freccette ai lati
   fanno capire che ce ne sono altri e, toccandole, scorrono il menu. Compaiono solo se da quel lato c'è altro. */
(function () {
  function prepara() {
    const nav = document.getElementById('navmenu'), barra = document.getElementById('barra-fissa');
    if (!nav || !barra || document.getElementById('nav-freccia-sx')) return;
    const crea = function (id, testo, verso) {
      const b = document.createElement('button');
      b.type = 'button'; b.id = id; b.className = 'nav-freccia'; b.textContent = testo;
      b.setAttribute('aria-label', verso < 0 ? 'Pagine precedenti del menu' : 'Altre pagine del menu');
      b.addEventListener('click', function () { nav.scrollBy({ left: verso * Math.round(nav.clientWidth * 0.7), behavior: 'smooth' }); });
      barra.appendChild(b);
      return b;
    };
    const sx = crea('nav-freccia-sx', '‹', -1), dx = crea('nav-freccia-dx', '›', 1);
    const aggiorna = function () {
      const scorre = nav.scrollWidth > nav.clientWidth + 4;
      const meta = nav.offsetTop + nav.offsetHeight / 2 - 15;
      sx.style.top = dx.style.top = meta + 'px';
      sx.style.display = scorre && nav.scrollLeft > 4 ? '' : 'none';
      dx.style.display = scorre && nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4 ? '' : 'none';
    };
    nav.addEventListener('scroll', aggiorna, { passive: true });
    window.addEventListener('resize', aggiorna);
    // il menu cambia quando compaiono le pagine permesse all'utente
    setInterval(aggiorna, 1000);
    aggiorna();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prepara); else prepara();
})();
