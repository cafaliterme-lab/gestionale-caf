-- Calendario delle scadenze con avviso anticipato.

create table if not exists public.scadenze (
  id            uuid primary key default gen_random_uuid(),
  titolo        text not null check (length(trim(titolo)) > 0),
  data          date not null,
  avviso_giorni integer not null default 7 check (avviso_giorni between 0 and 365),
  cliente       text not null default '',
  note          text not null default '',
  completata    boolean not null default false,
  creato_da     text default public.nome_utente(),
  creato_il     timestamptz not null default now()
);
create index if not exists scadenze_data_idx on public.scadenze (data);

alter table public.scadenze enable row level security;

drop policy if exists scadenze_leggi on public.scadenze;
create policy scadenze_leggi on public.scadenze for select to authenticated
  using (public.puo('scadenze'));
drop policy if exists scadenze_inserisci on public.scadenze;
create policy scadenze_inserisci on public.scadenze for insert to authenticated
  with check (public.puo('scadenze', true));
drop policy if exists scadenze_modifica on public.scadenze;
create policy scadenze_modifica on public.scadenze for update to authenticated
  using (public.puo('scadenze', true)) with check (public.puo('scadenze', true));
drop policy if exists scadenze_elimina on public.scadenze;
create policy scadenze_elimina on public.scadenze for delete to authenticated
  using (public.puo('scadenze', true));
