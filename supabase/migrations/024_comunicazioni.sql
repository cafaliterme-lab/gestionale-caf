-- Registro delle comunicazioni con i clienti: ogni WhatsApp aperto e ogni e-mail inviata dal programma
create table if not exists public.comunicazioni (
  id uuid primary key default gen_random_uuid(),
  quando timestamptz not null default now(),
  canale text not null,
  motivo text,
  nome text,
  codice_fiscale text,
  telefono text,
  email text,
  pratica_id text,
  testo text,
  operatore text
);
create index if not exists comunicazioni_quando_idx on public.comunicazioni (quando desc);
create index if not exists comunicazioni_nome_idx on public.comunicazioni (nome);
alter table public.comunicazioni enable row level security;
create policy comunicazioni_leggi on public.comunicazioni for select to authenticated
  using (public.puo('anagrafica') or public.puo('registro'));
create policy comunicazioni_inserisci on public.comunicazioni for insert to authenticated
  with check (public.puo('anagrafica', true) or public.puo('registro', true) or public.puo('messaggi', true));
create policy comunicazioni_elimina on public.comunicazioni for delete to authenticated
  using (public.e_admin());
grant select, insert, delete on public.comunicazioni to authenticated;
