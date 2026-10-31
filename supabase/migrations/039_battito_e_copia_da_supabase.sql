-- 🛡️ Battito e copia per e-mail del lunedì anche da Supabase (pg_cron + pg_net), come riserva di quelli di Vercel.
-- Supabase chiama il proprio indirizzo pubblico come farebbe Vercel, quindi la chiamata passa dall'API come un accesso vero.
-- Ognuno segna la sua ora: battito_vercel / battito_supabase (e battito_ultimo = il più recente), così il controllo
-- del mattino (js/controllo-mattino.js) sa se uno dei due si è fermato.
-- La copia per e-mail parte al massimo una volta ogni 5 giorni (regola di backup-email): se Vercel l'ha già mandata,
-- quella di Supabase risponde «già inviato» e non manda niente.
-- (Si aggiunge una funzione nuova invece di cambiare quella vecchia, così non serve la conferma per i comandi «distruttivi».)
create extension if not exists pg_net;

-- il battito di Vercel (stessa funzione di prima) segna anche battito_vercel
create or replace function public.registra_battito()
returns timestamptz
language sql
security definer
set search_path to 'public'
as $$
  insert into public.impostazioni (chiave, valore, aggiornato_il)
  values ('battito_ultimo', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), now()),
         ('battito_vercel', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), now())
  on conflict (chiave) do update set valore = excluded.valore, aggiornato_il = excluded.aggiornato_il
  returning aggiornato_il;
$$;

-- battito di riserva fatto da Supabase stesso
create or replace function public.registra_battito_supabase()
returns timestamptz
language sql
security definer
set search_path to 'public'
as $$
  insert into public.impostazioni (chiave, valore, aggiornato_il)
  values ('battito_ultimo', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), now()),
         ('battito_supabase', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), now())
  on conflict (chiave) do update set valore = excluded.valore, aggiornato_il = excluded.aggiornato_il
  returning aggiornato_il;
$$;
revoke all on function public.registra_battito_supabase() from public;
grant execute on function public.registra_battito_supabase() to anon, authenticated;

-- ogni giorno alle 5:23 UTC (6:23 o 7:23 in Italia), dopo quello di Vercel; chiave pubblica (la stessa di js/config.js)
select cron.schedule('battito-supabase', '23 5 * * *', $c$
  select net.http_post(
    url := 'https://mmaqmprukghyazlibphv.supabase.co/rest/v1/rpc/registra_battito_supabase',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tYXFtcHJ1a2doeWF6bGlicGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDUyMTUsImV4cCI6MjEwNjUyMTIxNX0.ByRES--bYHZG6o_BX8Ha0YzqfcQIIr-D08Q-AbR8bhs',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tYXFtcHJ1a2doeWF6bGlicGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDUyMTUsImV4cCI6MjEwNjUyMTIxNX0.ByRES--bYHZG6o_BX8Ha0YzqfcQIIr-D08Q-AbR8bhs'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000)
$c$);

-- copia per e-mail di riserva: ogni lunedì alle 8:13 UTC, dopo quella di Vercel (6:41 UTC)
select cron.schedule('copia-email-supabase', '13 8 * * 1', $c$
  select net.http_post(
    url := 'https://mmaqmprukghyazlibphv.supabase.co/functions/v1/backup-email',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tYXFtcHJ1a2doeWF6bGlicGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDUyMTUsImV4cCI6MjEwNjUyMTIxNX0.ByRES--bYHZG6o_BX8Ha0YzqfcQIIr-D08Q-AbR8bhs',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tYXFtcHJ1a2doeWF6bGlicGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDUyMTUsImV4cCI6MjEwNjUyMTIxNX0.ByRES--bYHZG6o_BX8Ha0YzqfcQIIr-D08Q-AbR8bhs'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000)
$c$);
