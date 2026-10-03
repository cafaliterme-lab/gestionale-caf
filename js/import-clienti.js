/**
 * Script di importazione clienti da CSV Money
 * Converte il formato Money in dati compatibili con gestionale-caf
 */

async function importaClientiDaCSV(csvText) {
  const righe = csvText.trim().split('\n');
  const clienti = [];
  const visti = new Set();

  righe.forEach((riga, idx) => {
    if (!riga.trim()) return;

    const parti = riga.split(',');
    if (parti.length < 4) return;

    // Parse: COGNOME NOME | Data | Tipo | Sede | Importo | Data
    const nomeCompleto = parti[0].trim();
    const dataNascita = parti[1].trim();

    // Evita duplicati (stesso nome + data nascita)
    const key = `${nomeCompleto}|${dataNascita}`;
    if (visti.has(key)) return;
    visti.add(key);

    // Splitta cognome e nome
    const nomeParts = nomeCompleto.split(' ');
    const cognome = nomeParts[0] || '';
    const nome = nomeParts.slice(1).join(' ') || '';

    clienti.push({
      nomeCompleto: nomeCompleto,
      cognome: cognome,
      nome: nome,
      dataNascita: dataNascita
    });
  });

  console.log(`Estratti ${clienti.length} clienti unici da ${righe.length} righe`);
  return clienti;
}

async function salvaClientiInSupabase(clienti) {
  if (!auth.session) {
    alert('❌ Non autenticato. Accedi prima.');
    return { error: 'Non autenticato' };
  }

  try {
    // Usa data.clienti.aggiungiLista se esiste, altrimenti salva uno per uno
    const result = await data.clienti.aggiungiLista(clienti);
    if (result.error) {
      console.error('Errore importazione:', result.error);
      return { error: result.error };
    }

    return { success: true, count: clienti.length };
  } catch (e) {
    console.error('Errore:', e);
    return { error: e.message };
  }
}

async function elaboraImportazione(file) {
  const msg = document.getElementById('import-clienti-msg');
  const btn = document.getElementById('btn-importa-clienti');

  if (!msg) {
    alert('⚠️ Elemento non trovato');
    return;
  }

  msg.style.display = 'none';
  if (btn) btn.disabled = true;

  try {
    const testo = await file.text();
    const clienti = await importaClientiDaCSV(testo);

    if (!clienti.length) {
      msg.textContent = '⚠️ Nessun cliente trovato nel file.';
      msg.style.color = '#c0392b';
      msg.style.display = 'block';
      return;
    }

    const result = await salvaClientiInSupabase(clienti);

    if (result.error) {
      msg.textContent = '❌ Errore: ' + result.error;
      msg.style.color = '#c0392b';
    } else {
      msg.textContent = `✅ ${result.count} clienti importati con successo!`;
      msg.style.color = 'var(--accent)';
    }
    msg.style.display = 'block';
  } catch (e) {
    msg.textContent = '❌ Errore nel caricamento: ' + e.message;
    msg.style.color = '#c0392b';
    msg.style.display = 'block';
  } finally {
    if (btn) btn.disabled = false;
  }
}
