-- Avviso delle pratiche ferme da più di un mese: rimandato fino a una data o tolto (vale per tutti)
create table if not exists public.pratiche_avvisi (
  pratica_id uuid primary key references public.pratiche(id) on delete cascade,
  rimanda_al date,
  nascosto boolean not null default false,
  chi text,
  quando timestamptz not null default now()
);
alter table public.pratiche_avvisi enable row level security;
create policy pratiche_avvisi_leggi on public.pratiche_avvisi for select to authenticated using (puo('registro'));
create policy pratiche_avvisi_inserisci on public.pratiche_avvisi for insert to authenticated with check (puo('registro', true));
create policy pratiche_avvisi_modifica on public.pratiche_avvisi for update to authenticated using (puo('registro', true)) with check (puo('registro', true));
-- comunicazioni: si può correggere il nome (cambio nome, schede unite)
create policy comunicazioni_modifica_nome on public.comunicazioni for update to authenticated
  using (puo('anagrafica', true) or puo('registro', true)) with check (puo('anagrafica', true) or puo('registro', true));
