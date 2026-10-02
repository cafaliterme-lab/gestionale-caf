/**
 * Livello dati — sostituisce dbApi e embedState
 *
 * Fornisce le stesse operazioni che app.js chiama oggi, ma usando
 * Supabase in background. Gli oggetti hanno la stessa forma (camelCase),
 * la conversione da snake_case avviene qui.
 */

// Lo stato globale (come state.js nella pagina)
const state = {
  pratiche: [],
  versamenti: [],
  isee: [],
  clienti: [],           // anagrafica + quelli aggiunti
  collaboratori: [],

  // Flag di UI (usati da app.js per non rigenerare durante edits)
  _editingPracticeId: null,
  _deletingPracticeId: null,
};

// Gestori di event realtime (da app.js: render(), ecc.)
let subscribers = {
  pratiche: [],
  versamenti: [],
  isee: [],
  collaboratori: [],
};

// Canali realtime (per sottoscriversi e annullare)
let subscriptions = {};

/**
 * Mappa snake_case (DB) → camelCase (JS)
 */
function mapFromDb(row, schema) {
  const result = {};
  for (const [camel, snake] of Object.entries(schema)) {
    if (snake in row) {
      result[camel] = row[snake];
    }
  }
  return result;
}

/**
 * Mappa camelCase (JS) → snake_case (DB)
 */
function mapToDb(obj, schema) {
  const result = {};
  for (const [camel, snake] of Object.entries(schema)) {
    if (camel in obj) {
      result[snake] = obj[camel];
    }
  }
  return result;
}

// Schemi di mapping
const schemas = {
  pratica: {
    id: 'id',
    numero: 'numero',
    anno: 'anno',
    nome: 'nome',
    congiunta: 'congiunta',
    congCognome: 'cong_cognome',
    congNome: 'cong_nome',
    congData: 'cong_data',
    telefono: 'telefono',
    cf: 'cf',
    tipo: 'tipo',
    compenso: 'compenso',
    pagato: 'pagato',
    data: 'data',
    note: 'note',
    stato: 'stato',
    fatt: 'fatt',
    numFattura: 'num_fattura',
    dataFattura: 'data_fattura',
    inseritoDa: 'inserito_da',
    inseritoIl: 'inserito_il',
    aggiornatoIl: 'aggiornato_il',
  },
  versamento: {
    id: 'id',
    importo: 'importo',
    data: 'data',
    causale: 'causale',
    creatoDa: 'creato_da',
    creatoIl: 'creato_il',
  },
  isee: {
    id: 'id',
    nome: 'nome',
    importo: 'importo',
    data: 'data',
    pagato: 'pagato',
    creatoDa: 'creato_da',
    creatoIl: 'creato_il',
  },
  cliente: {
    id: 'id',
    nomeCompleto: 'nome_completo',
    cognome: 'cognome',
    nome: 'nome',
    dataNascita: 'data_nascita',
  },
  collaboratore: {
    nome: 'nome',
    ordine: 'ordine',
  },
};

/**
 * Mostra un errore a schermo (nel div #db-avviso)
 */
function mostraErrore(messaggio) {
  const avviso = document.getElementById('db-avviso');
  if (avviso) {
    avviso.textContent = messaggio;
    avviso.style.display = 'block';
    setTimeout(() => {
      avviso.style.display = 'none';
    }, 5000);
  }
  console.error('[data.js]', messaggio);
}

/**
 * Carica tutti i dati dal database
 */
async function caricaTutto() {
  try {
    // Pratiche
    const { data: pratiche, error: errP } = await supabase
      .from('pratiche')
      .select('*')
      .order('anno', { ascending: false })
      .order('numero', { ascending: false });

    if (errP) throw new Error('Errore pratiche: ' + errP.message);
    state.pratiche = pratiche.map(p => mapFromDb(p, schemas.pratica));

    // Versamenti
    const { data: versamenti, error: errV } = await supabase
      .from('versamenti')
      .select('*')
      .order('creato_il', { ascending: false });

    if (errV) throw new Error('Errore versamenti: ' + errV.message);
    state.versamenti = versamenti.map(v => mapFromDb(v, schemas.versamento));

    // ISEE
    const { data: isee, error: errI } = await supabase
      .from('isee')
      .select('*')
      .order('creato_il', { ascending: false });

    if (errI) throw new Error('Errore ISEE: ' + errI.message);
    state.isee = isee.map(i => mapFromDb(i, schemas.isee));

    // Clienti (archivio)
    const { data: clienti, error: errC } = await supabase
      .from('clienti')
      .select('*')
      .order('nome_completo');

    if (errC) throw new Error('Errore clienti: ' + errC.message);
    state.clienti = clienti.map(c => mapFromDb(c, schemas.cliente));

    // Collaboratori
    const { data: collaboratori, error: errCo } = await supabase
      .from('collaboratori')
      .select('*')
      .order('ordine');

    if (errCo) throw new Error('Errore collaboratori: ' + errCo.message);
    state.collaboratori = collaboratori.map(c => mapFromDb(c, schemas.collaboratore));

    return true;
  } catch (err) {
    mostraErrore(err.message);
    return false;
  }
}

/**
 * Sottoscrivi alle modifiche realtime
 * @param {string} tabella - 'pratiche', 'versamenti', 'isee', 'collaboratori'
 * @param {function} callback - funzione da chiamare a ogni modifica (es. render)
 */
async function sottoscrivi(tabella, callback) {
  if (!callback) return;

  // Salva il callback
  if (!subscribers[tabella]) subscribers[tabella] = [];
  subscribers[tabella].push(callback);

  // Se già sottoscritto, non creare un altro canale
  if (subscriptions[tabella]) return;

  // Sottoscrivi ai cambiamenti realtime
  subscriptions[tabella] = supabase
    .channel(`${tabella}-changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: tabella,
      },
      async (payload) => {
        // Ricarica la tabella dal server
        await caricaTutto();

        // Chiama tutti i callback
        for (const cb of subscribers[tabella]) {
          try {
            cb();
          } catch (e) {
            console.error(`Errore callback ${tabella}:`, e);
          }
        }
      }
    )
    .subscribe();
}

/**
 * Pratica - Aggiungi una nuova pratica
 * @param {object} pratica - { numero (auto), anno, nome, congiunta, ... }
 * @returns {Promise<{id?, error?}>}
 */
async function aggiungiPratica(pratica) {
  try {
    const db = mapToDb(pratica, schemas.pratica);

    // Il numero è auto-assegnato dal trigger se non fornito
    if (!db.numero) delete db.numero;

    const { data, error } = await supabase
      .from('pratiche')
      .insert([db])
      .select();

    if (error) throw new Error(error.message);

    // Ricarica (l'evento realtime lo farà comunque)
    await caricaTutto();

    return { id: data[0].id };
  } catch (err) {
    mostraErrore('Errore inserimento pratica: ' + err.message);
    return { error: err.message };
  }
}

/**
 * Pratica - Aggiorna una pratica esistente
 * @param {string} id - UUID della pratica
 * @param {object} aggiornamenti - campi da modificare
 * @returns {Promise<{error?}>}
 */
async function aggiornaPratica(id, aggiornamenti) {
  try {
    const db = mapToDb(aggiornamenti, schemas.pratica);

    const { error } = await supabase
      .from('pratiche')
      .update(db)
      .eq('id', id);

    if (error) throw new Error(error.message);

    await caricaTutto();
    return {};
  } catch (err) {
    mostraErrore('Errore aggiornamento pratica: ' + err.message);
    return { error: err.message };
  }
}

/**
 * Pratica - Elimina una pratica
 * @param {string} id - UUID della pratica
 * @returns {Promise<{error?}>}
 */
async function eliminaPratica(id) {
  try {
    const { error } = await supabase
      .from('pratiche')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    await caricaTutto();
    return {};
  } catch (err) {
    mostraErrore('Errore eliminazione pratica: ' + err.message);
    return { error: err.message };
  }
}

/**
 * Versamento - Aggiungi
 */
async function aggiungiVersamento(versamento) {
  try {
    const db = mapToDb(versamento, schemas.versamento);

    const { error } = await supabase
      .from('versamenti')
      .insert([db]);

    if (error) throw new Error(error.message);

    await caricaTutto();
    return {};
  } catch (err) {
    mostraErrore('Errore versamento: ' + err.message);
    return { error: err.message };
  }
}

/**
 * Versamento - Elimina
 */
async function eliminaVersamento(id) {
  try {
    const { error } = await supabase
      .from('versamenti')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    await caricaTutto();
    return {};
  } catch (err) {
    mostraErrore('Errore eliminazione versamento: ' + err.message);
    return { error: err.message };
  }
}

/**
 * ISEE - Aggiungi
 */
async function aggiungiIsee(isee) {
  try {
    const db = mapToDb(isee, schemas.isee);

    const { error } = await supabase
      .from('isee')
      .insert([db]);

    if (error) throw new Error(error.message);

    await caricaTutto();
    return {};
  } catch (err) {
    mostraErrore('Errore ISEE: ' + err.message);
    return { error: err.message };
  }
}

/**
 * ISEE - Toggle pagato
 */
async function toggleIseePagato(id, pagato) {
  try {
    const { error } = await supabase
      .from('isee')
      .update({ pagato })
      .eq('id', id);

    if (error) throw new Error(error.message);

    await caricaTutto();
    return {};
  } catch (err) {
    mostraErrore('Errore aggiornamento ISEE: ' + err.message);
    return { error: err.message };
  }
}

/**
 * ISEE - Elimina
 */
async function eliminaIsee(id) {
  try {
    const { error } = await supabase
      .from('isee')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    await caricaTutto();
    return {};
  } catch (err) {
    mostraErrore('Errore eliminazione ISEE: ' + err.message);
    return { error: err.message };
  }
}

/**
 * Clienti - Aggiungi un nuovo cliente
 */
async function aggiungiCliente(cliente) {
  try {
    const db = mapToDb(cliente, schemas.cliente);

    const { error } = await supabase
      .from('clienti')
      .insert([db]);

    if (error) throw new Error(error.message);

    await caricaTutto();
    return {};
  } catch (err) {
    mostraErrore('Errore inserimento cliente: ' + err.message);
    return { error: err.message };
  }
}

/**
 * Collaboratori - Salva l'elenco (chiama RPC salva_collaboratori)
 */
async function salvaCollaboratori(lista) {
  try {
    const { error } = await supabase
      .rpc('salva_collaboratori', {
        lista: lista.map(c => c.nome || c),
      });

    if (error) throw new Error(error.message);

    await caricaTutto();
    return {};
  } catch (err) {
    mostraErrore('Errore salvataggio collaboratori: ' + err.message);
    return { error: err.message };
  }
}

/**
 * Admin - Svuota registro (elimina tutte le pratiche)
 */
async function svuotaRegistro() {
  try {
    const { error } = await supabase.rpc('svuota_registro');

    if (error) throw new Error(error.message);

    await caricaTutto();
    return {};
  } catch (err) {
    mostraErrore('Errore svuotamento registro: ' + err.message);
    return { error: err.message };
  }
}

/**
 * Admin - Importa un backup (JSON)
 */
async function importaBackup(dati) {
  try {
    const { error } = await supabase.rpc('importa_backup', {
      dati: dati,
    });

    if (error) throw new Error(error.message);

    await caricaTutto();
    return {};
  } catch (err) {
    mostraErrore('Errore importazione: ' + err.message);
    return { error: err.message };
  }
}

/**
 * Scarica un file (substituto per claude.use('downloads'))
 */
function scaricaFile(nomeFile, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Esporta (come namespace globale in HTML)
window.data = {
  state,
  caricaTutto,
  sottoscrivi,
  pratiche: {
    aggiungi: aggiungiPratica,
    aggiorna: aggiornaPratica,
    elimina: eliminaPratica,
  },
  versamenti: {
    aggiungi: aggiungiVersamento,
    elimina: eliminaVersamento,
  },
  isee: {
    aggiungi: aggiungiIsee,
    togglePagato: toggleIseePagato,
    elimina: eliminaIsee,
  },
  clienti: {
    aggiungi: aggiungiCliente,
  },
  collaboratori: {
    salva: salvaCollaboratori,
  },
  admin: {
    svuota: svuotaRegistro,
    importa: importaBackup,
  },
  scaricaFile,
};
