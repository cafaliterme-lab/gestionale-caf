-- Agenda appuntamenti: chi viene in ufficio, in che giorno e a che ora (campagna 730 e non solo)
create table if not exists public.appuntamenti (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  ora text not null,
  nome text not null,
  codice_fiscale text,
  telefono text,
  email text,
  tipo text,
  note text,
  stato text not null default 'prenotato',
  promemoria_il timestamptz,
  creato_da text,
  creato_il timestamptz not null default now()
);
create index if not exists appuntamenti_data_idx on public.appuntamenti (data);
alter table public.appuntamenti enable row level security;
create policy appuntamenti_leggi on public.appuntamenti for select to authenticated
  using (public.puo('anagrafica') or public.puo('registro'));
create policy appuntamenti_inserisci on public.appuntamenti for insert to authenticated
  with check (public.puo('anagrafica', true) or public.puo('registro', true));
create policy appuntamenti_modifica on public.appuntamenti for update to authenticated
  using (public.puo('anagrafica', true) or public.puo('registro', true))
  with check (public.puo('anagrafica', true) or public.puo('registro', true));
create policy appuntamenti_elimina on public.appuntamenti for delete to authenticated
  using (public.puo('anagrafica', true) or public.puo('registro', true));
grant select, insert, update, delete on public.appuntamenti to authenticated;
-- durata di ogni appuntamento in minuti (la cambia l'amministratore dall'agenda)
insert into public.impostazioni (chiave, valore) values ('agenda_durata', '30') on conflict (chiave) do nothing;
