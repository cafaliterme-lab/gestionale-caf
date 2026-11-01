-- 📨 Sportello online «Scrivi al CAF» (pagina pubblica scrivici.html, gestione in js/richieste.js).
-- Il cliente, senza password, può SOLO mandare una richiesta tramite la funzione invia_richiesta_cliente:
-- non può leggere niente. Le richieste le vedono l'amministratore e gli operatori con il permesso «richieste».
-- L'amministratore accende/spegne lo sportello (impostazioni.sportello_attivo = 'si'); parte SPENTO.
create table if not exists public.richieste_clienti (
  id uuid primary key default gen_random_uuid(),
  creato_il timestamptz not null default now(),
  nome text not null,
  telefono text not null,
  email text,
  tipo text,
  messaggio text not null,
  consenso boolean not null default false,
  stato text not null default 'nuova',
  gestita_da text,
  gestita_il timestamptz,
  note text
);
alter table public.richieste_clienti enable row level security;
create policy richieste_leggi on public.richieste_clienti for select using (public.puo('richieste'));
create policy richieste_modifica on public.richieste_clienti for update using (public.puo('richieste', true)) with check (public.puo('richieste', true));
create policy richieste_elimina on public.richieste_clienti for delete using (public.e_admin());
create index if not exists richieste_clienti_creato on public.richieste_clienti (creato_il desc);

-- stato dello sportello e recapiti del CAF per la pagina pubblica (solo queste informazioni)
create or replace function public.stato_sportello()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'attivo', coalesce((select valore from public.impostazioni where chiave = 'sportello_attivo'), '') = 'si',
    'telefono', coalesce((select valore from public.impostazioni where chiave = 'caf_telefono'), ''),
    'orari', coalesce((select valore from public.impostazioni where chiave = 'caf_orari'), ''),
    'indirizzo', coalesce((select valore from public.impostazioni where chiave = 'caf_indirizzo'), ''));
$$;

-- unica porta d'ingresso dall'esterno: controlli e limiti contro lo spam
create or replace function public.invia_richiesta_cliente(p_nome text, p_telefono text, p_email text, p_tipo text, p_messaggio text, p_consenso boolean, p_controllo text default '')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  tel text := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g');
  cifre text := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
begin
  if coalesce((select valore from public.impostazioni where chiave = 'sportello_attivo'), '') <> 'si' then
    return jsonb_build_object('ok', false, 'errore', 'Il servizio in questo momento non è attivo: chiamaci in ufficio.');
  end if;
  -- campo nascosto: le persone lo lasciano vuoto, i programmi automatici lo riempiono
  if coalesce(p_controllo, '') <> '' then return jsonb_build_object('ok', true); end if;
  if not coalesce(p_consenso, false) then return jsonb_build_object('ok', false, 'errore', 'Serve il consenso al trattamento dei dati.'); end if;
  if length(trim(coalesce(p_nome, ''))) < 3 then return jsonb_build_object('ok', false, 'errore', 'Scrivi nome e cognome.'); end if;
  if length(cifre) < 9 or length(cifre) > 15 then return jsonb_build_object('ok', false, 'errore', 'Il numero di telefono non sembra giusto.'); end if;
  if length(trim(coalesce(p_messaggio, ''))) < 5 then return jsonb_build_object('ok', false, 'errore', 'Scrivi la tua richiesta.'); end if;
  if coalesce(p_email, '') <> '' and p_email !~* '^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$' then return jsonb_build_object('ok', false, 'errore', 'L''e-mail non è corretta (puoi anche lasciarla vuota).'); end if;
  if (select count(*) from public.richieste_clienti where regexp_replace(telefono, '\D', '', 'g') = cifre and creato_il > now() - interval '1 day') >= 5 then
    return jsonb_build_object('ok', false, 'errore', 'Hai già mandato diverse richieste oggi: ti ricontatteremo al più presto.');
  end if;
  if (select count(*) from public.richieste_clienti where creato_il > now() - interval '1 day') >= 100 then
    return jsonb_build_object('ok', false, 'errore', 'In questo momento non possiamo ricevere altre richieste: chiamaci in ufficio.');
  end if;
  insert into public.richieste_clienti (nome, telefono, email, tipo, messaggio, consenso)
  values (left(upper(trim(p_nome)), 80), left(tel, 20), nullif(left(lower(trim(coalesce(p_email, ''))), 120), ''), left(coalesce(p_tipo, ''), 60), left(trim(p_messaggio), 2000), true);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.stato_sportello() from public;
revoke all on function public.invia_richiesta_cliente(text, text, text, text, text, boolean, text) from public;
grant execute on function public.stato_sportello() to anon, authenticated;
grant execute on function public.invia_richiesta_cliente(text, text, text, text, text, boolean, text) to anon, authenticated;
