-- 💽 Spazio sul server: quanto occupa il database (piano Free di Supabase: 500 MB) e da cosa.
-- Solo amministratore. Ogni volta che si chiama salva anche il valore del mese (impostazioni.spazio_mesi),
-- così il programma può dire di quanto cresce e per quanti anni basta lo spazio.
create or replace function public.spazio_database()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  totale bigint := pg_database_size(current_database());
  gruppi jsonb := '{}'::jsonb;
  mesi jsonb;
  mese text := to_char(now(), 'YYYY-MM');
  r record;
begin
  if not public.e_admin() then
    raise exception 'Solo l''amministratore può vedere lo spazio sul server' using errcode = '42501';
  end if;
  for r in
    select case
        when c.relname = 'clienti' then 'clienti'
        when c.relname in ('pratiche', 'scadenze', 'pratiche_storico', 'pratiche_avvisi', 'buste_paga', 'contatori') then 'pratiche'
        when c.relname in ('versamenti', 'spese_sede', 'acconti', 'isee', 'conte_cassa') then 'contabilita'
        when c.relname in ('comunicazioni', 'richiami', 'appuntamenti', 'messaggi_interni', 'messaggi_nascosti') then 'messaggi'
        when c.relname = 'backup_automatici' then 'backup'
        when c.relname = 'moduli' then 'moduli'
        else 'altro' end as gruppo,
      sum(pg_total_relation_size(c.oid))::bigint as byte
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    group by 1
  loop
    gruppi := gruppi || jsonb_build_object(r.gruppo, r.byte);
  end loop;
  -- valore del mese (uno per mese, l'ultimo letto)
  select coalesce(nullif(valore, '')::jsonb, '{}'::jsonb) into mesi from public.impostazioni where chiave = 'spazio_mesi';
  mesi := coalesce(mesi, '{}'::jsonb) || jsonb_build_object(mese, totale);
  insert into public.impostazioni (chiave, valore, aggiornato_il) values ('spazio_mesi', mesi::text, now())
  on conflict (chiave) do update set valore = excluded.valore, aggiornato_il = excluded.aggiornato_il;
  return jsonb_build_object('totale', totale, 'limite', 500 * 1024 * 1024, 'gruppi', gruppi, 'mesi', mesi,
    'file', (select coalesce(sum((metadata ->> 'size')::bigint), 0) from storage.objects));
end $$;

revoke all on function public.spazio_database() from public, anon;
grant execute on function public.spazio_database() to authenticated;
