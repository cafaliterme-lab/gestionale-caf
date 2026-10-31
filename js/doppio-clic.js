/* ---------------- 🖱️ Niente doppio clic ----------------
   Il programma non usa mai il doppio clic, ma molti lo fanno per abitudine: il primo clic apre una finestra
   o cambia foglio, il secondo arriva un attimo dopo nello stesso punto e tocca quello che c'è ora sotto
   (es. apre il primo cliente dell'archivio, o porta dal foglio 2 al 3).
   Qui si ignora il secondo clic di un doppio clic e ogni clic che arriva meno di 0,3 secondi dopo il precedente.
   Valgono solo i clic veri del mouse o del dito: non i clic fatti dal programma (scaricare file…)
   né il tasto Invio, e non nei campi dove si scrive. */
(function () {
  let ultimo = 0;
  document.addEventListener('click', function (e) {
    if (!e.isTrusted || e.detail === 0) return;
    if (e.target && e.target.closest && e.target.closest('input, textarea, select')) return;
    const ora = Date.now();
    const troppoVicino = e.detail > 1 || ora - ultimo < 300;
    ultimo = ora;
    if (troppoVicino) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
})();
