-- Dati di un documento letto con il telefono, da usare sul PC dello stesso utente (anagrafica)
create table if not exists public.documenti_letti (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dispositivo text not null default '',
  dati jsonb not null,
  usato boolean not null default false,
  creato_il timestamptz not null default now()
);
alter table public.documenti_letti enable row level security;
create policy dl_leggi on public.documenti_letti for select using (utente_id = auth.uid());
create policy dl_scrivi on public.documenti_letti for insert with check (utente_id = auth.uid());
create policy dl_aggiorna on public.documenti_letti for update using (utente_id = auth.uid()) with check (utente_id = auth.uid());
grant select, insert, update on public.documenti_letti to authenticated;
