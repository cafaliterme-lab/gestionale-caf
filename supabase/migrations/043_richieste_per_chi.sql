-- 📨 Sportello online, v1.7: «La richiesta è per…» (me stesso, il coniuge, un familiare…).
-- Solo aggiunte: una colonna nuova e una funzione nuova; la funzione vecchia resta com'è (nessun DROP).
alter table public.richieste_clienti add column if not exists per_chi text;

create or replace function public.invia_richiesta_cliente2(p_nome text, p_telefono text, p_email text, p_tipo text, p_messaggio text, p_consenso boolean, p_controllo text default '', p_per_chi text default '')
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
  insert into public.richieste_clienti (nome, telefono, email, tipo, messaggio, consenso, per_chi)
  values (left(upper(trim(p_nome)), 80), left(tel, 20), nullif(left(lower(trim(coalesce(p_email, ''))), 120), ''), left(coalesce(p_tipo, ''), 60), left(trim(p_messaggio), 2000), true,
          nullif(left(upper(trim(coalesce(p_per_chi, ''))), 120), ''));
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.invia_richiesta_cliente2(text, text, text, text, text, boolean, text, text) from public;
grant execute on function public.invia_richiesta_cliente2(text, text, text, text, text, boolean, text, text) to anon, authenticated;
