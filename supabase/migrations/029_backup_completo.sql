-- Backup COMPLETO: anche clienti da richiamare, conte di cassa, agenda (appuntamenti) e comunicazioni.
-- crea_backup ora usa dati_backup() (prima salvava solo le tabelle principali).
-- dati_backup e crea_backup: applicati dal programma; ripristina_dati: da incollare nell'editor SQL di Supabase.

create or replace function public.dati_backup()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
 select jsonb_build_object('versione', 3,
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
 'conte_cassa', coalesce((select jsonb_agg(to_jsonb(t)) from public.conte_cassa t), '[]'::jsonb),
 'appuntamenti', coalesce((select jsonb_agg(to_jsonb(t)) from public.appuntamenti t), '[]'::jsonb),
 'comunicazioni', coalesce((select jsonb_agg(to_jsonb(t)) from public.comunicazioni t), '[]'::jsonb))
$function$;
revoke all on function public.dati_backup() from public, anon, authenticated;

-- Ripristino COMPLETO da un backup (formato del database, come lo salva crea_backup):
-- rimette esattamente tutte le colonne di pratiche, versamenti, isee, clienti, scadenze, collaboratori,
-- impostazioni, spese sede, acconti, clienti da richiamare e conte di cassa, agenda e comunicazioni, di tutti gli anni. I trigger sono spenti durante il ripristino
-- (numeri di protocollo, autori e date restano quelli del backup).
create or replace function public.ripristina_dati(d jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  tabelle text[] := array['pratiche','versamenti','isee','clienti','scadenze','collaboratori','impostazioni','spese_sede','acconti','richiami','conte_cassa','appuntamenti','comunicazioni'];
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

create or replace function public.crea_backup(p_tipo text default 'manuale')
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare nuovo_id bigint; d jsonb; s integer; tipo text := coalesce(nullif(p_tipo, ''), 'manuale');
begin
  if auth.uid() is not null and not public.e_admin() then
    raise exception 'Solo l''amministratore puo'' creare un backup' using errcode = '42501';
  end if;
  -- tutte le tabelle dei dati (pratiche, clienti, cassa, richiami, agenda, comunicazioni…)
  d := public.dati_backup();
  -- posti a rotazione (si sovrascrive il piu' vecchio): 12 settimanali, 14 giornalieri, 8 per gli altri
  if tipo = 'fine_anno' then s := 1000 + extract(year from now())::integer;
  elsif tipo = 'settimanale' then s := (extract(week from now())::integer % 12); elsif tipo = 'giornaliero' then s := 200 + (extract(doy from now())::integer % 14);
  else s := 100 + (coalesce((select max(id) from public.backup_automatici), 0)::integer % 8); end if;
  insert into public.backup_automatici as b (slot, tipo, creato_il, creato_da, n_pratiche, dati)
  values (s, tipo, now(), coalesce(public.nome_utente(), 'AUTOMATICO'), jsonb_array_length(d -> 'pratiche'), d)
  on conflict (slot) do update set id = nextval('public.backup_automatici_id_seq'), tipo = excluded.tipo, creato_il = excluded.creato_il,
     creato_da = excluded.creato_da, n_pratiche = excluded.n_pratiche, dati = excluded.dati
  returning b.id into nuovo_id;
  return nuovo_id;
end $function$;
