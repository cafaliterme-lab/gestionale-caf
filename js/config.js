/**
 * Configurazione Supabase
 *
 * Usa l'API REST di Supabase direttamente via fetch()
 * Non richiede la libreria JS, evita problemi di CDN
 */

const SUPABASE_URL = 'https://mmaqmprukghyazlibphv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tYXFtcHJ1a2doeWF6bGlicGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDUyMTUsImV4cCI6MjEwNjUyMTIxNX0.ByRES--bYHZG6o_BX8Ha0YzqfcQIIr-D08Q-AbR8bhs';

// Simula l'oggetto supabase usando l'API REST
var supabase = {
  auth: {
    signInWithPassword: async (credentials) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        const data = await res.json();
        if (!res.ok) return { data: null, error: { message: data.error_description || 'Errore di login' } };

        localStorage.setItem('auth_token', data.access_token);
        localStorage.setItem('auth_refresh', data.refresh_token);
        return { data: { user: data.user, session: data }, error: null };
      } catch (error) {
        return { data: null, error: { message: error.message } };
      }
    },

    signUp: async (credentials) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
            user_metadata: credentials.user_metadata || {},
          }),
        });

        const data = await res.json();
        if (!res.ok) return { data: null, error: { message: data.error_description || 'Errore di registrazione' } };

        localStorage.setItem('auth_token', data.session?.access_token);
        localStorage.setItem('auth_refresh', data.session?.refresh_token);
        return { data: { user: data.user, session: data.session }, error: null };
      } catch (error) {
        return { data: null, error: { message: error.message } };
      }
    },

    signOut: async () => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_refresh');
    },

    getSession: async () => {
      const token = localStorage.getItem('auth_token');
      return token ? { data: { session: { access_token: token } }, error: null } : { data: { session: null }, error: null };
    },

    onAuthStateChange: (callback) => {
      // Semplice implementazione: controlla il token nel localStorage
      const token = localStorage.getItem('auth_token');
      callback(token ? 'SIGNED_IN' : 'SIGNED_OUT', token ? { access_token: token } : null);
    },
  },

  from: (table) => ({
    select: (columns = '*') => ({
      eq: (col, val) => ({
        single: async () => {
          const token = localStorage.getItem('auth_token');
          const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${val}`, {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${token}`,
            },
          });
          const data = await res.json();
          return { data: data[0], error: res.ok ? null : { message: 'Errore' } };
        },
      }),
      async () {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await res.json();
        return { data, error: res.ok ? null : { message: 'Errore' } };
      },
    }),

    insert: (records) => ({
      async select() {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(records),
        });
        const data = await res.json();
        return { data, error: res.ok ? null : { message: 'Errore' } };
      },
    }),
  }),
};

console.log('✓ Supabase API REST configurato (nessun CDN esterno)');
