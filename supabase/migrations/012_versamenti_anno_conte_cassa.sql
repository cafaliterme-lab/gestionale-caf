-- Anno delle fatture pagate col versamento (es. versamento di gennaio per fatture di dicembre):
-- se vuoto si usa l'anno della data del versamento.
alter table public.versamenti add column if not exists anno integer;

-- Conta dei contanti nel cassetto, confrontata con i contanti calcolati dal programma
create table if not exists public.conte_cassa (
  id uuid primary key default gen_random_uuid(),
  anno integer not null,
  contati numeric(12,2) not null,
  calcolati numeric(12,2),
  note text,
  creato_da text,
  creato_il timestamptz not null default now()
);
alter table public.conte_cassa enable row level security;
create policy conte_cassa_leggi on public.conte_cassa for select using (public.puo('caf') or public.puo('contabilita'));
create policy conte_cassa_scrivi on public.conte_cassa for insert with check (public.puo('caf', true));
create policy conte_cassa_cancella on public.conte_cassa for delete using (public.puo('caf', true));
grant select, insert, delete on public.conte_cassa to authenticated;
