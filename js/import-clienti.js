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

    // Parse: "COGNOME NOME DATA_NASCITA",Tipo,Sede,Importo,Data
    // The first field contains full name + birth date separated by space
    const nomeDatiStr = parti[0].trim();

    // Extract last word as birthdate (DD/MM/YYYY format)
    // Names can have multiple parts, so work backwards
    const tokens = nomeDatiStr.split(' ');
    let dataNascita = '';
    let nomeCompleto = '';

    if (tokens.length >= 3) {
      // Last token should be date if it matches DD/MM/YYYY pattern
      const ultimoToken = tokens[tokens.length - 1];
      if (/\d{2}\/\d{2}\/\d{4}/.test(ultimoToken)) {
        dataNascita = ultimoToken;
        nomeCompleto = tokens.slice(0, -1).join(' ');
      } else {
        nomeCompleto = nomeDatiStr;
      }
    } else {
      nomeCompleto = nomeDatiStr;
    }

    if (!nomeCompleto || !dataNascita) return;

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

async function elaboraImportazione(file, msg = document.getElementById('import-clienti-msg'), btn = document.getElementById('btn-importa-clienti')) {

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
      syncDataFromSupabase();
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
