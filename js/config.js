/**
 * Configurazione Supabase
 *
 * Usa Supabase Auth API v1 direttamente via fetch
 */

const SUPABASE_URL = 'https://mmaqmprukghyazlibphv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tYXFtcHJ1a2doeWF6bGlicGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDUyMTUsImV4cCI6MjEwNjUyMTIxNX0.ByRES--bYHZG6o_BX8Ha0YzqfcQIIr-D08Q-AbR8bhs';

async function rinnovaToken() {
  const refresh = localStorage.getItem('auth_refresh');
  if (!refresh) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('auth_refresh', data.refresh_token);
    return true;
  } catch (e) {
    return false;
  }
}

async function fetchSupabase(endpoint, method = 'GET', body = null, extraHeaders = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  let res = await fetch(`${SUPABASE_URL}${endpoint}`, options);
  // Token scaduto (dura ~1 ora): rinnova con il refresh token e riprova una volta
  if (res.status === 401 && token && !endpoint.startsWith('/auth/v1/token') && await rinnovaToken()) {
    headers['Authorization'] = `Bearer ${localStorage.getItem('auth_token')}`;
    res = await fetch(`${SUPABASE_URL}${endpoint}`, options);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  return { data, status: res.status, ok: res.ok };
}

function messaggioErroreAccesso(data) {
  const testo = String((data && (data.error_description || data.msg || data.message || (data.error && data.error.message) || data.error)) || '');
  if (/invalid login credentials|invalid_grant/i.test(testo)) return 'Email o password errati';
  if (/email not confirmed/i.test(testo)) return 'Email non ancora confermata: apri il link ricevuto via email';
  if (/rate limit|too many/i.test(testo)) return 'Troppi tentativi: riprova tra qualche minuto';
  return testo ? 'Accesso non riuscito: ' + testo : 'Accesso non riuscito';
}

const authMethods = {
  signUp: async (credentials) => {
    try {
      console.log('📝 SignUp:', credentials.email);
      const { data, ok } = await fetchSupabase('/auth/v1/signup', 'POST', {
        email: credentials.email,
        password: credentials.password,
        data: credentials.options?.data || credentials.user_metadata || {},
      });

      if (!ok || data.error) {
        console.error('SignUp error:', data.error || data);
        return { data: null, error: { message: data.error?.message || 'Registrazione fallita' } };
      }

      if (data.session) {
        localStorage.setItem('auth_token', data.session.access_token);
        localStorage.setItem('auth_refresh', data.session.refresh_token);
      }

      console.log('✓ SignUp success:', data.user?.email);
      return { data: { user: data.user, session: data.session }, error: null };
    } catch (err) {
      console.error('SignUp exception:', err);
      return { data: null, error: { message: err.message } };
    }
  },

  signInWithPassword: async (credentials) => {
    try {
      console.log('🔐 SignIn:', credentials.email);
      const { data, ok } = await fetchSupabase('/auth/v1/token?grant_type=password', 'POST', {
        email: credentials.email,
        password: credentials.password,
      });

      if (!ok || data.error) {
        console.error('SignIn error:', data.error || data);
        return { data: null, error: { message: messaggioErroreAccesso(data) } };
      }

      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('auth_refresh', data.refresh_token);

      console.log('✓ SignIn success');
      return { data: { user: data.user, session: { access_token: data.access_token } }, error: null };
    } catch (err) {
      console.error('SignIn exception:', err);
      return { data: null, error: { message: err.message } };
    }
  },

  signOut: async () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_refresh');
    console.log('✓ SignOut');
  },

  getSession: async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return { data: { session: null }, error: null };
    return { data: { session: { access_token: token } }, error: null };
  },

  onAuthStateChange: (callback) => {
    const token = localStorage.getItem('auth_token');
    if (callback) callback(token ? 'SIGNED_IN' : 'SIGNED_OUT', token ? { access_token: token } : null);
  },

  updateUser: async (updates) => {
    try {
      const { data, ok } = await fetchSupabase('/auth/v1/user', 'PUT', updates);
      if (!ok) return { error: { message: data.error?.message || 'Update failed' } };
      return { error: null };
    } catch (err) {
      return { error: { message: err.message } };
    }
  },

  getUser: async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return { data: { user: null }, error: null };
      const { data, ok } = await fetchSupabase('/auth/v1/user', 'GET');
      if (!ok) return { data: { user: null }, error: { message: data.error?.message || 'Errore' } };
      return { data: { user: data }, error: null };
    } catch (err) {
      return { data: { user: null }, error: { message: err.message } };
    }
  },
};

// Query builder minimale stile supabase-js: la query parte quando viene awaited.
const fromTable = (table) => {
  let metodo = 'GET';
  let corpo = null;
  let colonne = '*';
  let restituisci = false;
  let singolo = false;
  const filtri = [];
  const ordini = [];

  const errore = (data) => ({ message: data?.message || data?.error || 'Errore' });

  async function esegui() {
    const parti = [];
    if (metodo === 'GET' || restituisci) parti.push(`select=${colonne}`);
    parti.push(...filtri);
    if (ordini.length) parti.push(`order=${ordini.join(',')}`);
    const url = `/rest/v1/${table}?${parti.join('&')}`;

    if (metodo === 'GET') {
      // PostgREST restituisce al massimo ~1000 righe per richiesta: si legge a pagine
      const PAGINA = 1000;
      let righe = [];
      for (let offset = 0; ; offset += PAGINA) {
        const { data, ok } = await fetchSupabase(`${url}&limit=${PAGINA}&offset=${offset}`);
        if (!ok) return { data: null, error: errore(data) };
        righe = righe.concat(data);
        if (singolo || data.length < PAGINA) break;
      }
      if (singolo) {
        return righe.length ? { data: righe[0], error: null } : { data: null, error: { message: 'Non trovato' } };
      }
      return { data: righe, error: null };
    }

    const prefer = restituisci ? 'return=representation' : 'return=minimal';
    const { data, ok } = await fetchSupabase(url, metodo, corpo, { Prefer: prefer });
    if (!ok) return { data: null, error: errore(data) };
    return { data: restituisci ? data : null, error: null };
  }

  const builder = {
    select(cols = '*') {
      colonne = cols;
      if (metodo !== 'GET') restituisci = true;
      return builder;
    },
    insert(records) {
      metodo = 'POST';
      corpo = Array.isArray(records) ? records : [records];
      return builder;
    },
    update(valori) {
      metodo = 'PATCH';
      corpo = valori;
      return builder;
    },
    delete() {
      metodo = 'DELETE';
      return builder;
    },
    eq(col, val) {
      filtri.push(`${col}=eq.${encodeURIComponent(val)}`);
      return builder;
    },
    order(col, opts) {
      const asc = typeof opts === 'string' ? opts !== 'desc' : (opts?.ascending ?? true);
      ordini.push(`${col}.${asc ? 'asc' : 'desc'}`);
      return builder;
    },
    single() {
      singolo = true;
      return builder;
    },
    execute: esegui,
    then(onOk, onErr) {
      return esegui().then(onOk, onErr);
    },
  };
  return builder;
};

const rpcCall = async (name, params) => {
  const { data, ok } = await fetchSupabase(`/rest/v1/rpc/${name}`, 'POST', params);
  return { data, error: ok ? null : { message: data?.message || data?.error || 'RPC error' } };
};

window.supabase = {
  auth: authMethods,
  from: fromTable,
  rpc: rpcCall,
};

console.log('✓ Supabase API REST configurato');
