-- Protocollo Pratiche CAF — schema del database (Supabase / Postgres)
-- Da eseguire una volta nel SQL Editor di Supabase (oppure con `supabase db push`).

-- ============================================================
-- Utenti e permessi
-- ============================================================
-- Le password NON stanno qui: le gestisce Supabase Auth (auth.users).
-- Ogni account ha un profilo con nome, ruolo e permessi per scheda.

create table if not exists public.profili (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text not null,
  email         text,
  ruolo         text not null default 'operatore' check (ruolo in ('admin', 'operatore')),
  tabs          jsonb not null default '{"anagrafica":true,"registro":true,"contabilita":false,"caf":false,"collaboratori":false}'::jsonb,
  sola_lettura  boolean not null default true,
  creato_il     timestamptz not null default now()
);

-- Alla creazione di un account (dal pannello Supabase o dalla scheda
-- "Utenti e permessi") nasce il suo profilo. Il primo account in assoluto
-- diventa amministratore.
create or replace function public.crea_profilo_nuovo_utente()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  primo boolean;
begin
  primo := not exists (select 1 from public.profili where ruolo = 'admin');
  insert into public.profili (id, nome, email, ruolo, tabs, sola_lettura)
  values (
    new.id,
    upper(coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1))),
    new.email,
    case when primo then 'admin' else 'operatore' end,
    case when primo
      then '{"anagrafica":true,"registro":true,"contabilita":true,"caf":true,"collaboratori":true}'::jsonb
      else '{"anagrafica":true,"registro":true,"contabilita":false,"caf":false,"collaboratori":false}'::jsonb
    end,
    not primo
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crea_profilo_nuovo_utente();

-- L'utente collegato e' amministratore?
create or replace function public.e_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profili where id = auth.uid() and ruolo = 'admin');
$$;

-- L'utente collegato puo' vedere la scheda `tab`? Con scrittura = true
-- serve anche che non sia in sola lettura. L'admin puo' tutto.
create or replace function public.puo(tab text, scrittura boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profili p
    where p.id = auth.uid()
      and (
        p.ruolo = 'admin'
        or (coalesce((p.tabs ->> tab)::boolean, false) and (not scrittura or not p.sola_lettura))
      )
  );
$$;

-- Nome dell'utente collegato (finisce in pratiche.inserito_da).
create or replace function public.nome_utente()
returns text language sql stable security definer set search_path = public as $$
  select nome from public.profili where id = auth.uid();
$$;

-- ============================================================
-- Dati
-- ============================================================

-- Anno ricavato da una data GG/MM/AAAA (come annoDiData nella pagina).
create or replace function public.anno_da_data(d text)
returns integer language sql immutable as $$
  select case when d ~ '^\s*\d{2}/\d{2}/\d{4}\s*$'
              then right(trim(d), 4)::integer
              else extract(year from now())::integer end;
$$;

create table if not exists public.pratiche (
  id            uuid primary key default gen_random_uuid(),
  numero        integer not null,
  anno          integer not null,
  nome          text not null default '',
  congiunta     text not null default '',
  cong_cognome  text not null default '',
  cong_nome     text not null default '',
  cong_data     text not null default '',
  telefono      text not null default '',
  cf            text not null default '',          -- data di nascita (GG/MM/AAAA), nome storico del campo
  tipo          text not null default '',
  compenso      numeric(10,2),                      -- importo fattura
  pagato        numeric(10,2),                      -- pagato effettivo
  data          text not null default '',          -- data apertura GG/MM/AAAA
  note          text not null default '',
  stato         text not null default 'arrivo',
  fatt          text not null default 'dafatturare',
  num_fattura   text not null default '',
  data_fattura  text not null default '',
  inserito_da   text,
  inserito_il   timestamptz,
  aggiornato_il timestamptz not null default now(),
  unique (anno, numero)
);
create index if not exists pratiche_anno_idx on public.pratiche (anno);

create table if not exists public.versamenti (
  id        uuid primary key default gen_random_uuid(),
  importo   numeric(10,2) not null,
  data      text not null default '',
  causale   text not null default '',
  creato_il timestamptz not null default now()
);

create table if not exists public.isee (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  importo   numeric(10,2) not null,
  data      text not null default '',
  pagato    boolean not null default false,
  creato_il timestamptz not null default now()
);

-- Archivio clienti per la ricerca nel modulo di inserimento
-- (sostituisce l'elenco incorporato nella pagina + "clienti_extra").
create table if not exists public.clienti (
  id            uuid primary key default gen_random_uuid(),
  nome_completo text not null,
  cognome       text not null default '',
  nome          text not null default '',
  data_nascita  text not null default '',
  creato_il     timestamptz not null default now(),
  unique (nome_completo, data_nascita)
);

-- Collaboratori / tipi di pratica, nell'ordine in cui compaiono.
create table if not exists public.collaboratori (
  nome   text primary key,
  ordine integer not null default 0
);
insert into public.collaboratori (nome, ordine)
select t.nome, t.ord::integer
from unnest(array[
  '730 SEDE','730 BRIGUGLIO ANTONIO','730 CAMINITI ANTONIO','730 CAMINITI LUIGI','730 RICCA AGATINO',
  '730 FILCA','730 CRISAFULLI ROBERTO','730 FARAONE ARTURO','730 DECEDUTI','730 INTEGRATIVI/RETTIFICATIVI',
  '730 TRIOLO CARMELA','730 DI BELLA SANTINO','CONTRATTI DI AFFITTO','CONTRATTI COLF E BADANTI'
]) with ordinality as t(nome, ord)
where not exists (select 1 from public.collaboratori);

-- Contatore del numero di protocollo, uno per anno.
create table if not exists public.contatori (
  anno integer primary key,
  next integer not null
);

-- ============================================================
-- Numerazione del protocollo e campi automatici
-- ============================================================
-- Il numero lo assegna il database, in modo atomico: due inserimenti
-- contemporanei da Angelo e Federica ricevono sempre numeri diversi.
create or replace function public.pratiche_prima_di_inserire()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  admin boolean := public.e_admin();
begin
  if new.anno is null then
    new.anno := public.anno_da_data(new.data);
  end if;

  -- Solo l'amministratore (es. importazione backup) puo' indicare
  -- numero, autore e data di inserimento.
  if not admin then
    new.numero := null;
    new.inserito_da := null;
    new.inserito_il := null;
  end if;

  if new.numero is null then
    insert into public.contatori as c (anno, next) values (new.anno, 2)
    on conflict (anno) do update set next = c.next + 1
    returning c.next - 1 into new.numero;
  else
    insert into public.contatori as c (anno, next) values (new.anno, new.numero + 1)
    on conflict (anno) do update set next = greatest(c.next, excluded.next);
  end if;

  new.inserito_da := coalesce(new.inserito_da, public.nome_utente());
  new.inserito_il := coalesce(new.inserito_il, now());
  new.aggiornato_il := now();
  return new;
end $$;

drop trigger if exists pratiche_numera on public.pratiche;
create trigger pratiche_numera
  before insert on public.pratiche
  for each row execute function public.pratiche_prima_di_inserire();

-- Numero, anno e autore non si cambiano con una modifica.
create or replace function public.pratiche_prima_di_aggiornare()
returns trigger language plpgsql as $$
begin
  new.numero := old.numero;
  new.anno := old.anno;
  new.inserito_da := old.inserito_da;
  new.inserito_il := old.inserito_il;
  new.aggiornato_il := now();
  return new;
end $$;

drop trigger if exists pratiche_aggiorna on public.pratiche;
create trigger pratiche_aggiorna
  before update on public.pratiche
  for each row execute function public.pratiche_prima_di_aggiornare();

-- ============================================================
-- Regole di accesso (Row Level Security)
-- ============================================================
-- Le stesse regole della pagina, ma applicate dal server:
--  * scheda nascosta  -> i dati di quella scheda non si leggono
--  * sola lettura     -> si possono solo inserire nuove pratiche
--                        (come nella pagina), non modificare o cancellare

alter table public.profili       enable row level security;
alter table public.pratiche      enable row level security;
alter table public.versamenti    enable row level security;
alter table public.isee          enable row level security;
alter table public.clienti       enable row level security;
alter table public.collaboratori enable row level security;
alter table public.contatori     enable row level security;

-- profili: ognuno vede il proprio, l'admin vede e modifica tutti.
drop policy if exists profili_leggi on public.profili;
create policy profili_leggi on public.profili for select to authenticated
  using (id = auth.uid() or public.e_admin());
drop policy if exists profili_modifica on public.profili;
create policy profili_modifica on public.profili for update to authenticated
  using (public.e_admin()) with check (public.e_admin());
drop policy if exists profili_elimina on public.profili;
create policy profili_elimina on public.profili for delete to authenticated
  using (public.e_admin() and id <> auth.uid());

-- pratiche
drop policy if exists pratiche_leggi on public.pratiche;
create policy pratiche_leggi on public.pratiche for select to authenticated
  using (public.puo('registro') or public.puo('anagrafica') or public.puo('contabilita'));
drop policy if exists pratiche_inserisci on public.pratiche;
create policy pratiche_inserisci on public.pratiche for insert to authenticated
  with check (public.puo('anagrafica') or public.puo('registro'));
drop policy if exists pratiche_modifica on public.pratiche;
create policy pratiche_modifica on public.pratiche for update to authenticated
  using (public.puo('registro', true)) with check (public.puo('registro', true));
drop policy if exists pratiche_elimina on public.pratiche;
create policy pratiche_elimina on public.pratiche for delete to authenticated
  using (public.puo('registro', true));

-- versamenti CAF
drop policy if exists versamenti_leggi on public.versamenti;
create policy versamenti_leggi on public.versamenti for select to authenticated
  using (public.puo('caf') or public.puo('contabilita'));
drop policy if exists versamenti_scrivi on public.versamenti;
create policy versamenti_scrivi on public.versamenti for all to authenticated
  using (public.puo('caf', true)) with check (public.puo('caf', true));

-- ISEE
drop policy if exists isee_leggi on public.isee;
create policy isee_leggi on public.isee for select to authenticated
  using (public.puo('caf') or public.puo('contabilita'));
drop policy if exists isee_scrivi on public.isee;
create policy isee_scrivi on public.isee for all to authenticated
  using (public.puo('caf', true)) with check (public.puo('caf', true));

-- clienti: chi inserisce pratiche puo' cercare e aggiungere clienti.
drop policy if exists clienti_leggi on public.clienti;
create policy clienti_leggi on public.clienti for select to authenticated
  using (public.puo('anagrafica') or public.puo('registro'));
drop policy if exists clienti_inserisci on public.clienti;
create policy clienti_inserisci on public.clienti for insert to authenticated
  with check (public.puo('anagrafica') or public.puo('registro'));
drop policy if exists clienti_admin on public.clienti;
create policy clienti_admin on public.clienti for all to authenticated
  using (public.e_admin()) with check (public.e_admin());

-- collaboratori: tutti gli utenti li leggono (servono nel modulo),
-- si modificano con salva_collaboratori().
drop policy if exists collaboratori_leggi on public.collaboratori;
create policy collaboratori_leggi on public.collaboratori for select to authenticated
  using (exists (select 1 from public.profili where id = auth.uid()));

-- contatori: nessun accesso diretto (li usa solo il trigger).
revoke all on public.contatori from anon, authenticated;

-- ============================================================
-- Operazioni
-- ============================================================

-- Sostituisce l'elenco dei collaboratori mantenendo l'ordine.
create or replace function public.salva_collaboratori(lista text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.puo('collaboratori', true) then
    raise exception 'Permesso negato' using errcode = '42501';
  end if;
  delete from public.collaboratori where true;
  insert into public.collaboratori (nome, ordine)
  select distinct on (upper(trim(t.nome))) upper(trim(t.nome)), t.ord::integer
  from unnest(lista) with ordinality as t(nome, ord)
  where trim(coalesce(t.nome, '')) <> ''
  order by upper(trim(t.nome)), t.ord;
end $$;

-- "Svuota registro": elimina tutte le pratiche e azzera i contatori.
create or replace function public.svuota_registro()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.e_admin() then
    raise exception 'Solo l''amministratore puo'' svuotare il registro' using errcode = '42501';
  end if;
  delete from public.pratiche where true;
  delete from public.contatori where true;
end $$;

-- "Importa backup": sostituisce pratiche, versamenti e collaboratori con
-- quelli del file JSON esportato dalla pagina (vecchia o nuova).
-- Gli account non si creano da qui; se il backup contiene i permessi degli
-- utenti, vengono applicati ai profili con lo stesso nome.
create or replace function public.importa_backup(dati jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n_pratiche integer;
  n_versamenti integer;
  num_text constant text := '^\s*-?\d+([.,]\d+)?\s*$';
begin
  if not public.e_admin() then
    raise exception 'Solo l''amministratore puo'' importare un backup' using errcode = '42501';
  end if;
  if jsonb_typeof(dati -> 'pratiche') is distinct from 'array' then
    raise exception 'Il file non sembra un backup valido';
  end if;

  delete from public.pratiche where true;
  delete from public.contatori where true;

  insert into public.pratiche (
    numero, anno, nome, congiunta, cong_cognome, cong_nome, cong_data, telefono, cf, tipo,
    compenso, pagato, data, note, stato, fatt, num_fattura, data_fattura, inserito_da, inserito_il
  )
  select
    (p ->> 'numero')::integer,
    coalesce(nullif(p ->> 'anno', '')::integer, public.anno_da_data(p ->> 'data')),
    coalesce(p ->> 'nome', ''),
    coalesce(p ->> 'congiunta', ''),
    coalesce(p ->> 'congCognome', ''),
    coalesce(p ->> 'congNome', ''),
    coalesce(p ->> 'congData', ''),
    coalesce(p ->> 'telefono', ''),
    coalesce(p ->> 'cf', ''),
    coalesce(p ->> 'tipo', ''),
    case when p ->> 'compenso' ~ num_text then replace(p ->> 'compenso', ',', '.')::numeric end,
    case when p ->> 'pagato'   ~ num_text then replace(p ->> 'pagato',   ',', '.')::numeric end,
    coalesce(p ->> 'data', ''),
    coalesce(p ->> 'note', ''),
    coalesce(nullif(p ->> 'stato', ''), 'arrivo'),
    coalesce(nullif(p ->> 'fatt', ''), 'dafatturare'),
    coalesce(p ->> 'numFattura', ''),
    coalesce(p ->> 'dataFattura', ''),
    nullif(p ->> 'inseritoDa', ''),
    nullif(p ->> 'inseritoIl', '')::timestamptz
  from jsonb_array_elements(dati -> 'pratiche') as p;
  get diagnostics n_pratiche = row_count;

  -- Il prossimo numero di ogni anno riparte dal massimo importato + 1.
  delete from public.contatori where true;
  insert into public.contatori (anno, next)
  select anno, max(numero) + 1 from public.pratiche group by anno;

  delete from public.versamenti where true;
  insert into public.versamenti (importo, data, causale)
  select replace(v ->> 'importo', ',', '.')::numeric, coalesce(v ->> 'data', ''), coalesce(v ->> 'causale', '')
  from jsonb_array_elements(coalesce(dati -> 'versamenti', '[]'::jsonb)) as v
  where v ->> 'importo' ~ num_text;
  get diagnostics n_versamenti = row_count;

  if jsonb_typeof(dati -> 'isee') = 'array' then
    delete from public.isee where true;
    insert into public.isee (nome, importo, data, pagato)
    select coalesce(i ->> 'nome', ''), replace(i ->> 'importo', ',', '.')::numeric,
           coalesce(i ->> 'data', ''), coalesce((i ->> 'pagato')::boolean, false)
    from jsonb_array_elements(dati -> 'isee') as i
    where i ->> 'importo' ~ num_text;
  end if;

  if jsonb_typeof(dati -> 'collaboratori') = 'array' and jsonb_array_length(dati -> 'collaboratori') > 0 then
    perform public.salva_collaboratori(array(select jsonb_array_elements_text(dati -> 'collaboratori')));
  end if;

  if jsonb_typeof(dati -> 'utenti') = 'array' then
    update public.profili pr
    set tabs = pr.tabs || (u -> 'permessi' -> 'tabs'),
        sola_lettura = coalesce((u -> 'permessi' ->> 'soloLettura')::boolean, pr.sola_lettura)
    from jsonb_array_elements(dati -> 'utenti') as u
    where upper(pr.nome) = upper(u ->> 'nome')
      and pr.ruolo <> 'admin'
      and jsonb_typeof(u -> 'permessi' -> 'tabs') = 'object';
  end if;

  return jsonb_build_object('pratiche', n_pratiche, 'versamenti', n_versamenti);
end $$;

-- Caricamento dell'archivio clienti (es. l'elenco che era incorporato
-- nella vecchia pagina). I duplicati vengono ignorati.
create or replace function public.importa_clienti(lista jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if not public.e_admin() then
    raise exception 'Solo l''amministratore puo'' importare clienti' using errcode = '42501';
  end if;
  insert into public.clienti (nome_completo, cognome, nome, data_nascita)
  select upper(trim(coalesce(c ->> 'nomeCompleto', concat_ws(' ', c ->> 'cognome', c ->> 'nome')))),
         upper(trim(coalesce(c ->> 'cognome', ''))),
         upper(trim(coalesce(c ->> 'nome', ''))),
         trim(coalesce(c ->> 'dataNascita', ''))
  from jsonb_array_elements(lista) as c
  on conflict (nome_completo, data_nascita) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.salva_collaboratori(text[]) from anon;
revoke execute on function public.svuota_registro() from anon;
revoke execute on function public.importa_backup(jsonb) from anon;
revoke execute on function public.importa_clienti(jsonb) from anon;

-- ============================================================
-- Aggiornamenti in tempo reale
-- ============================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.pratiche;      exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.versamenti;    exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.isee;          exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.clienti;       exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.collaboratori; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.profili;       exception when duplicate_object then null; end;
  end if;
end $$;
