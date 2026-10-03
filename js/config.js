/**
 * Configurazione Supabase
 *
 * Usa Supabase Auth API v1 direttamente via fetch
 */

const SUPABASE_URL = 'https://mmaqmprukghyazlibphv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tYXFtcHJ1a2doeWF6bGlicGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDUyMTUsImV4cCI6MjEwNjUyMTIxNX0.ByRES--bYHZG6o_BX8Ha0YzqfcQIIr-D08Q-AbR8bhs';

async function fetchSupabase(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem('auth_token');
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${SUPABASE_URL}${endpoint}`, options);
  const data = await res.json();

  return { data, status: res.status, ok: res.ok };
}

const authMethods = {
  signUp: async (credentials) => {
    try {
      console.log('📝 SignUp:', credentials.email);
      const { data, ok } = await fetchSupabase('/auth/v1/signup', 'POST', {
        email: credentials.email,
        password: credentials.password,
        data: credentials.user_metadata || {},
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
        return { data: null, error: { message: data.error?.message || 'Login fallito' } };
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

const fromTable = (table) => ({
  select: (columns = '*') => {
    const selectBuilder = {
      order: (col, dir = 'asc') => fetchSupabase(`/rest/v1/${table}?select=${columns}&order=${col}.${dir}`).then(({ data, ok }) => ({ data: ok ? data : [], error: ok ? null : { message: 'Errore' } })),
      execute: async () => {
        const { data, ok } = await fetchSupabase(`/rest/v1/${table}?select=${columns}`);
        return { data: ok ? data : [], error: ok ? null : { message: 'Errore' } };
      },
      eq: (col, val) => ({
        single: async () => {
          const { data, ok } = await fetchSupabase(`/rest/v1/${table}?${col}=eq.${val}`);
          return { data: data?.[0] || null, error: ok ? null : { message: 'Errore' } };
        },
      }),
    };
    return selectBuilder;
  },

  update: (updates) => ({
    eq: (col, val) => ({
      async execute() {
        const { data, ok } = await fetchSupabase(`/rest/v1/${table}?${col}=eq.${val}`, 'PATCH', updates);
        return { error: ok ? null : { message: data?.error || 'Errore' } };
      },
    }),
  }),

  insert: (records) => ({
    select: () => ({
      async execute() {
        const { data, ok } = await fetchSupabase(`/rest/v1/${table}`, 'POST', Array.isArray(records) ? records : [records]);
        return { data, error: ok ? null : { message: 'Errore' } };
      },
    }),
  }),
});

const rpcCall = async (name, params) => {
  const { data, ok } = await fetchSupabase(`/rest/v1/rpc/${name}`, 'POST', params);
  return { data, error: ok ? null : { message: data?.error || 'RPC error' } };
};

window.supabase = {
  auth: authMethods,
  from: fromTable,
  rpc: rpcCall,
};

console.log('✓ Supabase API REST configurato');
