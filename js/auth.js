/**
 * Autenticazione Supabase
 *
 * Gestisce login/logout e caricamento del profilo con permessi.
 * La sessione persiste automaticamente nel localStorage di Supabase.
 */

// Sessione dell'utente loggato
let auth = {
  session: null,
  profilo: null,  // { id, nome, email, ruolo, tabs, sola_lettura }
};

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

/**
 * Registrazione nuovo utente
 * @param {string} nome
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user, session, error}>}
 */
async function signup(nome, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Crea il profilo dell'utente nel database (ruolo: operatore, no tabs per default)
  const { error: errProfilo } = await supabase
    .from('profili')
    .insert([{
      id: data.user.id,
      nome,
      email,
      ruolo: 'operatore',
      tabs: {},
      sola_lettura: true,
    }]);

  if (errProfilo) {
    return { error: 'Utente creato ma profilo non salvato: ' + errProfilo.message };
  }

  auth.session = data.session;
  await caricaProfilo();

  return { user: data.user, session: data.session };
}

/**
 * Login con email e password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user, session, error}>}
 */
async function login(email, password) {
  const sb = await waitForSupabase();
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  auth.session = data.session;
  await caricaProfilo();

  return { user: data.user, session: data.session };
}

/**
 * Logout: distrugge la sessione
 * @returns {Promise<void>}
 */
async function logout() {
  const sb = await waitForSupabase();
  await sb.auth.signOut();
  auth.session = null;
  auth.profilo = null;
}

/**
 * Decodifica JWT token per estrarre l'ID dell'utente
 */
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Errore decodifica JWT:', e);
    return null;
  }
}

/**
 * Carica il profilo dell'utente loggato dal database
 * @returns {Promise<object|null>} il profilo, o null se non loggato
 */
async function caricaProfilo() {
  const sb = await waitForSupabase();
  const token = localStorage.getItem('auth_token');
  if (!token) {
    auth.profilo = null;
    return null;
  }

  const payload = parseJwt(token);
  if (!payload || !payload.sub) {
    console.error('Token non valido');
    auth.profilo = null;
    return null;
  }

  const { data, error } = await sb
    .from('profili')
    .select('*')
    .eq('id', payload.sub)
    .single();

  if (error) {
    console.error('Errore caricamento profilo:', error);
    return null;
  }

  auth.profilo = data;
  return data;
}

/**
 * Restituisce la sessione attuale
 * @returns {Session|null}
 */
function getSession() {
  return auth.session;
}

/**
 * Restituisce il profilo dell'utente loggato
 * @returns {object|null}
 */
function getProfilo() {
  return auth.profilo;
}

/**
 * Controlla se l'utente è admin
 * @returns {boolean}
 */
function isAdmin() {
  return auth.profilo?.ruolo === 'admin';
}

/**
 * Controlla se l'utente può accedere a una scheda (con opzione scrittura)
 * @param {string} tab - nome della scheda (e.g., 'registro', 'caf')
 * @param {boolean} scrittura - se richiede permesso di scrittura
 * @returns {boolean}
 */
function puo(tab, scrittura = false) {
  if (!auth.profilo) return false;

  // Admin può fare tutto
  if (auth.profilo.ruolo === 'admin') return true;

  // Operatore: controlla se ha la scheda e (se scrittura) che non sia in sola lettura
  const haTab = auth.profilo.tabs?.[tab] ?? false;
  if (!haTab) return false;

  if (scrittura && auth.profilo.sola_lettura) return false;

  return true;
}

/**
 * Cambia la password dell'utente loggato
 * @param {string} newPassword
 * @returns {Promise<{error?}>}
 */
async function cambiaPassword(newPassword) {
  const sb = await waitForSupabase();
  const { error } = await sb.auth.updateUser({
    password: newPassword,
  });

  return { error: error?.message };
}

/**
 * Carica tutti i profili (solo admin)
 * @returns {Promise<Array|null>}
 */
async function caricaTuttiProfili() {
  if (!isAdmin()) {
    console.error('Errore: solo admin può caricare tutti i profili');
    return null;
  }

  const sb = await waitForSupabase();
  const { data, error } = await sb
    .from('profili')
    .select('*')
    .order('nome');

  if (error) {
    console.error('Errore caricamento profili:', error);
    return null;
  }

  return data;
}

/**
 * Aggiorna i permessi di un profilo (solo admin)
 * @param {string} userId - ID dell'utente
 * @param {object} updates - { tabs, sola_lettura }
 * @returns {Promise<{error?}>}
 */
async function aggiornaProfilo(userId, updates) {
  if (!isAdmin()) {
    return { error: 'Solo admin può modificare i profili' };
  }

  const sb = await waitForSupabase();
  const { error } = await sb
    .from('profili')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('Errore aggiornamento profilo:', error);
    return { error: error.message };
  }

  return {};
}

/**
 * Al caricamento della pagina, ripristina la sessione se esiste
 */
async function initAuth() {
  const sb = await waitForSupabase();
  const { data } = await sb.auth.getSession();
  if (data.session) {
    auth.session = data.session;
    await caricaProfilo();
  }

  // Ascolta i cambiamenti di autenticazione
  if (sb.auth.onAuthStateChange) {
    sb.auth.onAuthStateChange(async (event, session) => {
      auth.session = session;
      if (session) {
        await caricaProfilo();
      } else {
        auth.profilo = null;
      }
    });
  }
}

// Esporta le funzioni (usate da app.js e dal login overlay)
// (In ambiente browser, questi sono globali; in moduli ES6 servirebbero export/import)
