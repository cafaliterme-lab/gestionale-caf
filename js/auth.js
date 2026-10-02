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

/**
 * Login con email e password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user, session, error}>}
 */
async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
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
  await supabase.auth.signOut();
  auth.session = null;
  auth.profilo = null;
}

/**
 * Carica il profilo dell'utente loggato dal database
 * @returns {Promise<object|null>} il profilo, o null se non loggato
 */
async function caricaProfilo() {
  if (!supabase.auth.user?.id) {
    auth.profilo = null;
    return null;
  }

  const { data, error } = await supabase
    .from('profili')
    .select('*')
    .eq('id', supabase.auth.user.id)
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
  const { error } = await supabase.auth.updateUser({
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

  const { data, error } = await supabase
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

  const { error } = await supabase
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
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    auth.session = data.session;
    await caricaProfilo();
  }

  // Ascolta i cambiamenti di autenticazione
  supabase.auth.onAuthStateChange(async (event, session) => {
    auth.session = session;
    if (session) {
      await caricaProfilo();
    } else {
      auth.profilo = null;
    }
  });
}

// Esporta le funzioni (usate da app.js e dal login overlay)
// (In ambiente browser, questi sono globali; in moduli ES6 servirebbero export/import)
