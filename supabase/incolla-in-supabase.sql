-- DA INCOLLARE NELL'EDITOR SQL DI SUPABASE (SQL Editor → New query → incolla tutto → Run)
-- 1) Il ripristino di un backup rimette anche agenda (appuntamenti) e comunicazioni
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

-- 2) Nomi dei clienti sempre senza spazi doppi («ROSSI  MARIO» = «ROSSI MARIO»)
create or replace function public.clienti_pulisci_nome()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.nome_completo := regexp_replace(btrim(coalesce(new.nome_completo, '')), '\s+', ' ', 'g');
  if new.cognome is not null then new.cognome := regexp_replace(btrim(new.cognome), '\s+', ' ', 'g'); end if;
  if new.nome is not null then new.nome := regexp_replace(btrim(new.nome), '\s+', ' ', 'g'); end if;
  if new.dichiarante_nome is not null then new.dichiarante_nome := nullif(regexp_replace(btrim(new.dichiarante_nome), '\s+', ' ', 'g'), ''); end if;
  if new.riferimento is not null then new.riferimento := nullif(regexp_replace(btrim(new.riferimento), '\s+', ' ', 'g'), ''); end if;
  return new;
end $$;
drop trigger if exists clienti_pulisci_nome on public.clienti;
create trigger clienti_pulisci_nome before insert or update on public.clienti
  for each row execute function public.clienti_pulisci_nome();

-- 3) Si sistemano i nomi già scritti con spazi doppi (tranne i 3 doppioni, da unire con «🔗 Unisci con un'altra scheda»)
update public.clienti c set nome_completo = c.nome_completo
where (c.nome_completo ~ '\s{2,}|^\s|\s$' or c.cognome ~ '\s{2,}|^\s|\s$' or c.nome ~ '\s{2,}|^\s|\s$')
  and not exists (select 1 from public.clienti d where d.id <> c.id and d.nome_completo = regexp_replace(btrim(c.nome_completo), '\s+', ' ', 'g') and d.data_nascita is not distinct from c.data_nascita);
