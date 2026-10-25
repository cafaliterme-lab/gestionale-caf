-- Buste paga colf e badanti: una riga per contratto (pratica attiva) e mese compilato
create table if not exists public.buste_paga (
  pratica_id uuid not null references public.pratiche(id) on delete cascade,
  mese text not null check (mese ~ '^\d{4}-\d{2}$'),
  fatta_il timestamptz not null default now(),
  chi text,
  primary key (pratica_id, mese)
);
alter table public.buste_paga enable row level security;
create policy buste_paga_leggi on public.buste_paga for select to authenticated using (puo('registro'));
create policy buste_paga_inserisci on public.buste_paga for insert to authenticated with check (puo('registro', true));
create policy buste_paga_togli on public.buste_paga for delete to authenticated using (puo('registro', true));
-- il backup salva anche buste paga e avvisi delle pratiche ferme (dati_backup aggiornata dal programma)
