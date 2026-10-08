-- Messaggi della chat interna che un utente ha tolto dalla propria vista (gli altri continuano a vederli)
create table if not exists public.messaggi_nascosti (
  utente_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  messaggio_id uuid not null references public.messaggi_interni(id) on delete cascade,
  nascosto_il timestamptz not null default now(),
  primary key (utente_id, messaggio_id)
);
alter table public.messaggi_nascosti enable row level security;
create policy mn_leggi on public.messaggi_nascosti for select using (utente_id = auth.uid());
create policy mn_scrivi on public.messaggi_nascosti for insert with check (utente_id = auth.uid());
create policy mn_cancella on public.messaggi_nascosti for delete using (utente_id = auth.uid());
grant select, insert, delete on public.messaggi_nascosti to authenticated;
