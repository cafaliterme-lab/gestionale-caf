-- 📒 Bilancio di ogni anno, salvato per sempre (js/bilanci.js): pratiche, clienti, conti e pagamenti dell'anno,
-- calcolati dal programma con le stesse regole della Contabilità. Resta anche quando, dopo 5 anni, si cancellano
-- le pratiche di un anno vecchio, così il confronto tra gli anni non si perde. Solo l'amministratore.
create table if not exists public.bilanci_annuali (
  anno integer primary key,
  dati jsonb not null,
  salvato_il timestamptz not null default now(),
  salvato_da text
);
alter table public.bilanci_annuali enable row level security;
create policy bilanci_leggi on public.bilanci_annuali for select using (public.e_admin());
create policy bilanci_inserisci on public.bilanci_annuali for insert with check (public.e_admin());
create policy bilanci_modifica on public.bilanci_annuali for update using (public.e_admin()) with check (public.e_admin());

-- i bilanci entrano nelle copie di sicurezza
create or replace function public.dati_backup()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
 select jsonb_build_object('versione', 3,
 'pratiche', coalesce((select jsonb_agg(to_jsonb(t) order by t.anno, t.numero) from public.pratiche t), '[]'::jsonb),
 'versamenti', coalesce((select jsonb_agg(to_jsonb(t)) from public.versamenti t), '[]'::jsonb),
 'isee', coalesce((select jsonb_agg(to_jsonb(t)) from public.isee t), '[]'::jsonb),
 'clienti', coalesce((select jsonb_agg(to_jsonb(t)) from public.clienti t), '[]'::jsonb),
 'scadenze', coalesce((select jsonb_agg(to_jsonb(t)) from public.scadenze t), '[]'::jsonb),
 'collaboratori', coalesce((select jsonb_agg(to_jsonb(t) order by t.ordine) from public.collaboratori t), '[]'::jsonb),
 'impostazioni', coalesce((select jsonb_agg(to_jsonb(t)) from public.impostazioni t), '[]'::jsonb),
 'spese_sede', coalesce((select jsonb_agg(to_jsonb(t)) from public.spese_sede t), '[]'::jsonb),
 'acconti', coalesce((select jsonb_agg(to_jsonb(t)) from public.acconti t), '[]'::jsonb),
 'richiami', coalesce((select jsonb_agg(to_jsonb(t)) from public.richiami t), '[]'::jsonb),
 'conte_cassa', coalesce((select jsonb_agg(to_jsonb(t)) from public.conte_cassa t), '[]'::jsonb),
 'appuntamenti', coalesce((select jsonb_agg(to_jsonb(t)) from public.appuntamenti t), '[]'::jsonb),
 'comunicazioni', coalesce((select jsonb_agg(to_jsonb(t)) from public.comunicazioni t), '[]'::jsonb),
 'buste_paga', coalesce((select jsonb_agg(to_jsonb(t)) from public.buste_paga t), '[]'::jsonb),
 'pratiche_avvisi', coalesce((select jsonb_agg(to_jsonb(t)) from public.pratiche_avvisi t), '[]'::jsonb),
 'bilanci_annuali', coalesce((select jsonb_agg(to_jsonb(t) order by t.anno) from public.bilanci_annuali t), '[]'::jsonb))
$function$;
