/**
 * Livello dati — sostituisce dbApi e embedState
 *
 * Fornisce le stesse operazioni che app.js chiama oggi, ma usando
 * Supabase in background. Gli oggetti hanno la stessa forma (camelCase),
 * la conversione da snake_case avviene qui.
 *
 * Usa la variabile globale 'state' dichiarata in app.js
 */

// Dichiara state globalmente se non esiste ancora (per gestire ordine di caricamento)
if (typeof state === 'undefined') {
  window.state = { pratiche: [], versamenti: [], isee: [], clienti: [], collaboratori: [], nextNum: 1 };
}

// Aspetta che supabase sia disponibile
async function waitForSupabase() {
  for (let i = 0; i < 100; i++) {
    if (typeof supabase !== 'undefined' && supabase.auth) {
      return supabase;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Supabase non disponibile');
}

// Aspetta che state sia disponibile (definito da app.js)
async function waitForState() {
  for (let i = 0; i < 100; i++) {
    if (typeof state !== 'undefined' && state !== null) {
      return state;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return { pratiche: [], versamenti: [], isee: [], clienti: [], collaboratori: [] };
}

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

// compenso/pagato sono numeric: un campo lasciato vuoto va salvato come null
function praticaToDb(pratica) {
  const db = mapToDb(pratica, schemas.pratica);
  for (const k of ['compenso', 'pagato']) {
    if (db[k] === '') db[k] = null;
  }
  delete db.annullata_il; delete db.annullata_da; delete db.modificato_da; delete db.serie;
  return db;
}

// Schemi di mapping
const schemas = {
  pratica: {
    id: 'id',
    numero: 'numero',
    serie: 'serie',
    anno: 'anno',
    nome: 'nome',
    congiunta: 'congiunta',
    congCognome: 'cong_cognome',
    congNome: 'cong_nome',
    congData: 'cong_data',
    telefono: 'telefono',
    telefonoFisso: 'telefono_fisso',
    email: 'email',
    whatsappInviato: 'whatsapp_inviato',
    cf: 'cf',
    tipo: 'tipo',
    compenso: 'compenso',
    pagato: 'pagato',
    data: 'data',
    note: 'note',
    stato: 'stato',
    fatt: 'fatt',
    numFattura: 'num_fattura',
    dataFine: 'data_fine',
    scadenzaAssistenza: 'scadenza_assistenza',
    dataFattura: 'data_fattura',
    inseritoDa: 'inserito_da',
    inseritoIl: 'inserito_il',
    aggiornatoIl: 'aggiornato_il',
    codiceFiscale: 'codice_fiscale',
    congCodiceFiscale: 'cong_codice_fiscale',
    congTelefono: 'cong_telefono',
    documentoScadenza: 'documento_scadenza',
    documenti: 'documenti',
    metodoPagamento: 'metodo_pagamento',
    annullata: 'annullata',
    annullataMotivo: 'annullata_motivo',
    annullataIl: 'annullata_il',
    annullataDa: 'annullata_da',
    modificatoDa: 'modificato_da',
    emailInviata: 'email_inviata',
  },
  acconto: {
    id: 'id',
    tipo: 'tipo',
    data: 'data',
    importo: 'importo',
    metodoPagamento: 'metodo_pagamento',
    note: 'note',
    creatoDa: 'creato_da',
    creatoIl: 'creato_il',
  },
  spesaSede: {
    id: 'id',
    data: 'data',
    categoria: 'categoria',
    descrizione: 'descrizione',
    importo: 'importo',
    metodoPagamento: 'metodo_pagamento',
    inContabilita: 'in_contabilita',
    inContabilitaIl: 'in_contabilita_il',
    inContabilitaDa: 'in_contabilita_da',
    prelevatiAngelo: 'prelevati_angelo',
    restituitoAngelo: 'restituito_angelo',
    restituitoIl: 'restituito_il',
    creatoDa: 'creato_da',
    creatoIl: 'creato_il',
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
    codiceFiscale: 'codice_fiscale',
    telefono: 'telefono',
    telefonoFisso: 'telefono_fisso',
    email: 'email',
    documentoScadenza: 'documento_scadenza',
  },
  scadenza: {
    id: 'id',
    titolo: 'titolo',
    data: 'data',
    avvisoGiorni: 'avviso_giorni',
    cliente: 'cliente',
    note: 'note',
    completata: 'completata',
    praticaId: 'pratica_id',
    creatoDa: 'creato_da',
    creatoIl: 'creato_il',
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
async function caricaTutto(opzioni) {
  try {
    // Aspetta che state e supabase siano disponibili
    await waitForState();
    const sb = await waitForSupabase();

    // Pratiche
    const { data: pratiche, error: errP } = await sb
      .from('pratiche')
      .select('*')
      .order('anno', { ascending: false })
      .order('numero', { ascending: false });

    if (errP) throw new Error('Errore pratiche: ' + errP.message);
    // Le pratiche annullate tengono il numero ma restano fuori da conteggi e contabilità
    const tutte = pratiche.map(p => mapFromDb(p, schemas.pratica));
    state.pratiche = tutte.filter(p => !p.annullata);
    state.annullate = tutte.filter(p => p.annullata);

    // Versamenti
    const { data: versamenti, error: errV } = await sb
      .from('versamenti')
      .select('*')
      .order('creato_il', { ascending: false });

    if (errV) throw new Error('Errore versamenti: ' + errV.message);
    state.versamenti = versamenti.map(v => mapFromDb(v, schemas.versamento));

    // Spese gestione sede (chi non ha il permesso riceve un elenco vuoto)
    const { data: spese, error: errSp } = await sb.from('spese_sede').select('*').order('creato_il', { ascending: false });
    state.speseSede = errSp ? [] : (spese || []).map(s => mapFromDb(s, schemas.spesaSede));

    // Acconti dei collaboratori (entrate non legate a una singola pratica)
    const { data: acc, error: errAcc } = await sb.from('acconti').select('*').order('creato_il', { ascending: false });
    state.acconti = errAcc ? [] : (acc || []).map(a => mapFromDb(a, schemas.acconto));

    // ISEE
    const { data: isee, error: errI } = await sb
      .from('isee')
      .select('*')
      .order('creato_il', { ascending: false });

    if (errI) throw new Error('Errore ISEE: ' + errI.message);
    state.isee = isee.map(i => mapFromDb(i, schemas.isee));

    // Clienti (archivio)
    const { data: clienti, error: errC } = await sb
      .from('clienti')
      .select('*')
      .order('nome_completo');

    if (errC) throw new Error('Errore clienti: ' + errC.message);
    state.clienti = clienti.map(c => mapFromDb(c, schemas.cliente));

    // Collaboratori
    const { data: collaboratori, error: errCo } = await sb
      .from('collaboratori')
      .select('*')
      .order('ordine');

    if (errCo) throw new Error('Errore collaboratori: ' + errCo.message);
    // app.js usa i collaboratori come semplici nomi (stringhe)
    state.collaboratori = collaboratori.map(c => c.nome);

    // Scadenze: se la tabella non e' leggibile il resto dell'app funziona lo stesso
    const { data: scadenze, error: errS } = await sb
      .from('scadenze')
      .select('*')
      .order('data');
    if (errS) console.error('Errore scadenze:', errS.message);
    state.scadenze = errS ? [] : scadenze.map(x => mapFromDb(x, schemas.scadenza));

    // Il client REST non ha il realtime: avvisa l'interfaccia che i dati sono cambiati
    if (!(opzioni && opzioni.silenzioso) && typeof window.onDatiAggiornati === 'function') window.onDatiAggiornati();

    return true;
  } catch (err) {
    if (!(opzioni && opzioni.silenzioso)) mostraErrore(err.message);
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

  // Il client REST in config.js non supporta il realtime
  if (typeof supabase.channel !== 'function') return;

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
    const db = praticaToDb(pratica);

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
    const db = praticaToDb(aggiornamenti);

    const { data: righe, error } = await supabase
      .from('pratiche')
      .update(db)
      .eq('id', id)
      .select('id');

    if (error) throw new Error(error.message);
    if (!righe || !righe.length) throw new Error('Permesso negato: modifica non salvata');

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
    const { data: righe, error } = await supabase
      .from('pratiche')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw new Error(error.message);
    if (!righe || !righe.length) throw new Error('Permesso negato: pratica non eliminata');

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
 * Spese gestione sede - Aggiungi / Elimina
 */
async function aggiungiSpesaSede(spesa) {
  try {
    const { data: righe, error } = await supabase.from('spese_sede').insert([mapToDb(spesa, schemas.spesaSede)]).select('id');
    if (error) throw new Error(error.message);
    if (!righe || !righe.length) throw new Error('Permesso negato');
    await caricaTutto();
    return {};
  } catch (err) { return { error: err.message }; }
}
async function aggiungiAcconto(acconto) {
  try {
    const { data: righe, error } = await supabase.from('acconti').insert([mapToDb(acconto, schemas.acconto)]).select('id');
    if (error) throw new Error(error.message);
    if (!righe || !righe.length) throw new Error('Permesso negato');
    await caricaTutto();
    return {};
  } catch (err) { return { error: err.message }; }
}
async function eliminaAcconto(id) {
  try {
    const { data: righe, error } = await supabase.from('acconti').delete().eq('id', id).select('id');
    if (error) throw new Error(error.message);
    if (!righe || !righe.length) throw new Error('Permesso negato');
    await caricaTutto();
    return {};
  } catch (err) { return { error: err.message }; }
}
async function aggiornaSpesaSede(id, campi) {
  try {
    const db = mapToDb(campi, schemas.spesaSede);
    delete db.in_contabilita_il; delete db.in_contabilita_da; delete db.restituito_il;
    const { data: righe, error } = await supabase.from('spese_sede').update(db).eq('id', id).select('id');
    if (error) throw new Error(error.message);
    if (!righe || !righe.length) throw new Error('Permesso negato');
    await caricaTutto();
    return {};
  } catch (err) { return { error: err.message }; }
}
async function eliminaSpesaSede(id) {
  try {
    const { data: righe, error } = await supabase.from('spese_sede').delete().eq('id', id).select('id');
    if (error) throw new Error(error.message);
    if (!righe || !righe.length) throw new Error('Permesso negato');
    await caricaTutto();
    return {};
  } catch (err) { return { error: err.message }; }
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
 * Clienti - Corregge i dati di un cliente gia' archiviato
 */
async function aggiornaCliente(id, campi) {
  try {
    const { data: righe, error } = await supabase
      .from('clienti')
      .update(mapToDb(campi, schemas.cliente))
      .eq('id', id)
      .select('id');

    if (error) throw new Error(error.message);
    if (!righe || !righe.length) throw new Error('Permesso negato: archivio non aggiornato');

    await caricaTutto();
    return {};
  } catch (err) {
    mostraErrore('Errore aggiornamento archivio clienti: ' + err.message);
    return { error: err.message };
  }
}

/**
 * Clienti - Elimina definitivamente un cliente dall'archivio (solo admin, per RLS)
 */
async function eliminaCliente(id) {
  try {
    const { data: righe, error } = await supabase
      .from('clienti')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw new Error(error.message);
    if (!righe || !righe.length) throw new Error('Permesso negato: cliente non eliminato');

    await caricaTutto();
    return {};
  } catch (err) {
    mostraErrore('Errore eliminazione cliente: ' + err.message);
    return { error: err.message };
  }
}

/**
 * Clienti - Salva il codice fiscale (aggiorna il cliente archiviato o lo crea)
 */
async function salvaClienteCF(cliente) {
  try {
    const { error } = await supabase.rpc('salva_cliente_cf', {
      p_nome_completo: cliente.nomeCompleto,
      p_cognome: cliente.cognome,
      p_nome: cliente.nome,
      p_data_nascita: cliente.dataNascita || '',
      p_codice_fiscale: cliente.codiceFiscale,
    });
    if (error) throw new Error(error.message);
    return {};
  } catch (err) {
    mostraErrore('Errore salvataggio codice fiscale: ' + err.message);
    return { error: err.message };
  }
}

/**
 * Clienti - Salva cellulare e telefono fisso nell'archivio (aggiorna il cliente o lo crea)
 */
async function salvaTelefonoCliente(cliente) {
  try {
    const { error } = await supabase.rpc('salva_recapiti_cliente', {
      p_nome_completo: cliente.nomeCompleto,
      p_cognome: cliente.cognome || '',
      p_nome: cliente.nome || '',
      p_data_nascita: cliente.dataNascita || '',
      p_codice_fiscale: cliente.codiceFiscale || '',
      p_telefono: cliente.telefono || '',
      p_telefono_fisso: cliente.telefonoFisso || '',
      p_documento_scadenza: cliente.documentoScadenza || '',
      p_email: cliente.email || '',
    });
    if (error) throw new Error(error.message);
    return {};
  } catch (err) {
    console.error('Errore salvataggio telefono cliente:', err.message);
    return { error: err.message };
  }
}

/**
 * Clienti - Importa una lista di clienti in batch
 */
async function aggiungiListaClienti(clienti) {
  try {
    if (!clienti || !Array.isArray(clienti) || clienti.length === 0) {
      return { error: 'Lista clienti vuota o non valida' };
    }

    const dbClienti = clienti.map(c => mapToDb(c, schemas.cliente));

    // Clienti gia' presenti (stesso nome_completo + data_nascita) vengono saltati
    const BLOCCO = 500;
    for (let i = 0; i < dbClienti.length; i += BLOCCO) {
      const { data, ok } = await fetchSupabase(
        '/rest/v1/clienti?on_conflict=nome_completo,data_nascita',
        'POST',
        dbClienti.slice(i, i + BLOCCO),
        { 'Prefer': 'resolution=ignore-duplicates,return=minimal' }
      );
      if (!ok) throw new Error(data?.message || 'Errore inserimento clienti');
    }

    await caricaTutto();
    return { success: true, count: clienti.length };
  } catch (err) {
    console.error('Errore importazione clienti:', err);
    return { error: err.message };
  }
}

/**
 * Scadenze - Aggiungi, aggiorna, elimina
 */
async function aggiungiScadenza(scadenza) {
  try {
    const { error } = await supabase.from('scadenze').insert([mapToDb(scadenza, schemas.scadenza)]);
    if (error) throw new Error(error.message);
    await caricaTutto();
    return {};
  } catch (err) {
    return { error: err.message };
  }
}

async function aggiornaScadenza(id, campi) {
  try {
    const { data: righe, error } = await supabase.from('scadenze').update(mapToDb(campi, schemas.scadenza)).eq('id', id).select('id');
    if (error) throw new Error(error.message);
    if (!righe || !righe.length) throw new Error('Permesso negato');
    await caricaTutto();
    return {};
  } catch (err) {
    return { error: err.message };
  }
}

async function eliminaScadenza(id) {
  try {
    const { data: righe, error } = await supabase.from('scadenze').delete().eq('id', id).select('id');
    if (error) throw new Error(error.message);
    if (!righe || !righe.length) throw new Error('Permesso negato');
    await caricaTutto();
    return {};
  } catch (err) {
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
    const sb = await waitForSupabase();
    // Prima di cancellare si salva sempre una copia completa sul server
    const { error: errBackup } = await sb.rpc('crea_backup', { p_tipo: 'prima_di_svuotare' });
    if (errBackup) throw new Error('backup di sicurezza non riuscito, registro NON svuotato (' + errBackup.message + ')');
    const { error } = await sb.rpc('svuota_registro');

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
    const sb = await waitForSupabase();
    // Copia di sicurezza dei dati attuali prima di sostituirli
    await sb.rpc('crea_backup', { p_tipo: 'prima_di_importare' });
    const { error } = await sb.rpc('importa_backup', {
      dati: dati,
    });

    if (error) throw new Error(error.message);
    // Campi aggiunti nelle versioni successive (CF, fine lavorazione, telefoni...), clienti e scadenze
    const { error: errCompleta } = await sb.rpc('completa_import_backup', { dati: dati });
    if (errCompleta) console.error('Completamento backup:', errCompleta.message);

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
  acconti: {
    aggiungi: aggiungiAcconto,
    elimina: eliminaAcconto,
  },
  speseSede: {
    aggiungi: aggiungiSpesaSede,
    aggiorna: aggiornaSpesaSede,
    elimina: eliminaSpesaSede,
  },
  isee: {
    aggiungi: aggiungiIsee,
    togglePagato: toggleIseePagato,
    elimina: eliminaIsee,
  },
  clienti: {
    aggiungi: aggiungiCliente,
    aggiorna: aggiornaCliente,
    elimina: eliminaCliente,
    salvaCF: salvaClienteCF,
    salvaTelefono: salvaTelefonoCliente,
    aggiungiLista: aggiungiListaClienti,
  },
  collaboratori: {
    salva: salvaCollaboratori,
  },
  scadenze: {
    aggiungi: aggiungiScadenza,
    aggiorna: aggiornaScadenza,
    elimina: eliminaScadenza,
  },
  admin: {
    svuota: svuotaRegistro,
    importa: importaBackup,
  },
  mappa: mapFromDb,
  schemi: schemas,
  scaricaFile,
};
