-- 💓 Il battito quotidiano di Vercel (api/battito.js) segna l'ora in impostazioni.battito_ultimo:
-- così il programma, al primo accesso del giorno dell'amministratore, può dire se il battito è partito.
-- La chiama Vercel con la chiave pubblica: scrive SOLO l'ora del battito, nient'altro.
create or replace function public.registra_battito()
returns timestamptz
language sql
security definer
set search_path to 'public'
as $$
  insert into public.impostazioni (chiave, valore, aggiornato_il) values ('battito_ultimo', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), now())
  on conflict (chiave) do update set valore = excluded.valore, aggiornato_il = excluded.aggiornato_il
  returning aggiornato_il;
$$;

revoke all on function public.registra_battito() from public;
grant execute on function public.registra_battito() to anon, authenticated;
