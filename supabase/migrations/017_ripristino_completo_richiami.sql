-- Ripristino COMPLETO da un backup (formato del database, come lo salva crea_backup):
-- rimette esattamente tutte le colonne di pratiche, versamenti, isee, clienti, scadenze, collaboratori,
-- impostazioni, spese sede, acconti, clienti da richiamare e conte di cassa, di tutti gli anni. I trigger sono spenti durante il ripristino
-- (numeri di protocollo, autori e date restano quelli del backup).
create or replace function public.ripristina_dati(d jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  tabelle text[] := array['pratiche','versamenti','isee','clienti','scadenze','collaboratori','impostazioni','spese_sede','acconti','richiami','conte_cassa'];
  t text;
  n integer;
  esito jsonb := '{}'::jsonb;
begin
  if not public.e_admin() then
    raise exception 'Solo l''amministratore puo'' ripristinare un backup' using errcode = '42501';
  end if;
  if jsonb_typeof(d -> 'pratiche') is distinct from 'array' then
    raise exception 'Il file non contiene un backup completo';
  end if;

  foreach t in array tabelle loop
    execute format('alter table public.%I disable trigger user', t);
  end loop;

  if jsonb_typeof(d -> 'scadenze') = 'array' then delete from public.scadenze where true; end if;
  foreach t in array tabelle loop
    if t <> 'scadenze' and jsonb_typeof(d -> t) = 'array' then
      execute format('delete from public.%I where true', t);
    end if;
  end loop;

  foreach t in array tabelle loop
    if jsonb_typeof(d -> t) = 'array' then
      execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1)', t, t) using d -> t;
      get diagnostics n = row_count;
      esito := esito || jsonb_build_object(t, n);
    end if;
  end loop;

  delete from public.contatori where true;
  insert into public.contatori (anno, serie, next)
  select anno, serie, max(numero) + 1 from public.pratiche where numero is not null group by anno, serie;

  foreach t in array tabelle loop
    execute format('alter table public.%I enable trigger user', t);
  end loop;
  return esito;
end $$;

revoke all on function public.ripristina_dati(jsonb) from public, anon;
grant execute on function public.ripristina_dati(jsonb) to authenticated;

-- Ripristino diretto da un backup salvato sul server (prima salva una copia dei dati attuali)
create or replace function public.ripristina_backup(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare d jsonb;
begin
  if not public.e_admin() then
    raise exception 'Solo l''amministratore puo'' ripristinare un backup' using errcode = '42501';
  end if;
  select dati into d from public.backup_automatici where id = p_id;
  if d is null then raise exception 'Backup non trovato'; end if;
  perform public.crea_backup('prima_di_importare');
  return public.ripristina_dati(d);
end $$;
revoke all on function public.ripristina_backup(bigint) from public, anon;
grant execute on function public.ripristina_backup(bigint) to authenticated;

-- Il backup salva anche i clienti da richiamare e le conte di cassa (i backup vecchi senza queste voci le lasciano come sono)
create or replace function public.dati_backup()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
 select jsonb_build_object('versione', 2,
 'pratiche', coalesce((select jsonb_agg(to_jsonb(t) order by t.anno, t.numero) from public.pratiche t), '[]'::jsonb),
 'versamenti', coalesce((select jsonb_agg(to_jsonb(t)) from public.versamenti t), '[]'::jsonb),
 'isee', coalesce((select jsonb_agg(to_jsonb(t)) from public.isee t), '[]'::jsonb),
 'clienti', coalesce((select jsonb_agg(to_jsonb(t)) from public.clienti t), '[]'::jsonb),
 'scadenze', coalesce((select jsonb_agg(to_jsonb(t)) from public.scadenze t), '[]'::jsonb),
 'collaboratori', coalesce((select jsonb_agg(to_jsonb(t) order by t.ordine) from public.collaboratori t), '[]'::jsonb),
 'impostazioni', coalesce((select jsonb_agg(to_jsonb(t)) from public.impostazioni t), '[]'::jsonb),
 'spese_sede', coalesce((select jsonb_agg(to_jsonb(t)) from public.spese_sede t), '[]'::jsonb),
 'acconti', coalesce((select jsonb_agg(to_jsonb(t)) from public.acconti t), '[]'::jsonb),
 'richiami', coalesce((select jsonb_agg(to_jsonb(t)) from public.richiami t), '[]'::jsonb),
 'conte_cassa', coalesce((select jsonb_agg(to_jsonb(t)) from public.conte_cassa t), '[]'::jsonb))
$function$;
revoke all on function public.dati_backup() from public, anon, authenticated;
