-- Archivio clienti sempre aggiornato dal database:
-- ogni pratica salvata o modificata copia nell'archivio clienti codice fiscale, telefoni,
-- e-mail e scadenza del documento (titolare e coniuge). Cancellare pratiche non tocca l'archivio.

create or replace function public.archivia_cliente(
  p_nome_completo text, p_cognome text, p_nome text, p_data_nascita text, p_cf text,
  p_tel text, p_fisso text, p_email text, p_scad text, p_solo_vuoti boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; nc text; dn text; cf text; cg text; nm text;
  tel text; fis text; em text; sc text;
begin
  nc := upper(btrim(coalesce(p_nome_completo, '')));
  if nc = '' then return; end if;
  dn := btrim(coalesce(p_data_nascita, ''));
  cf := upper(btrim(coalesce(p_cf, '')));
  if cf !~ '^[A-Z0-9]{16}$' then cf := ''; end if;
  tel := nullif(btrim(coalesce(p_tel, '')), '');
  fis := nullif(btrim(coalesce(p_fisso, '')), '');
  em := nullif(btrim(coalesce(p_email, '')), '');
  sc := nullif(btrim(coalesce(p_scad, '')), '');

  if cf <> '' then select id into v_id from clienti where codice_fiscale = cf limit 1; end if;
  if v_id is null then
    select id into v_id from clienti where upper(nome_completo) = nc and data_nascita = dn limit 1;
  end if;
  if v_id is null and dn <> '' then
    select id into v_id from clienti where upper(nome_completo) = nc and coalesce(data_nascita, '') = '' and codice_fiscale is null limit 1;
  end if;

  if v_id is null then
    cg := upper(btrim(coalesce(p_cognome, '')));
    nm := upper(btrim(coalesce(p_nome, '')));
    if cg = '' and nm = '' then
      nm := coalesce(substring(nc from '(\S+)$'), '');
      cg := btrim(regexp_replace(nc, '\s*\S+$', ''));
      if cg = '' then cg := nc; nm := ''; end if;
    end if;
    insert into clienti (nome_completo, cognome, nome, data_nascita, codice_fiscale, telefono, telefono_fisso, email, documento_scadenza)
    values (nc, cg, nm, dn, nullif(cf, ''), tel, fis, em, sc)
    on conflict do nothing;
    return;
  end if;

  update clienti c set
    codice_fiscale = case when c.codice_fiscale is null and cf <> ''
                           and not exists (select 1 from clienti x where x.codice_fiscale = cf) then cf else c.codice_fiscale end,
    data_nascita = case when coalesce(c.data_nascita, '') = '' and dn <> ''
                         and not exists (select 1 from clienti x where x.nome_completo = c.nome_completo and x.data_nascita = dn) then dn else c.data_nascita end,
    telefono = case when p_solo_vuoti then coalesce(c.telefono, tel) else coalesce(tel, c.telefono) end,
    telefono_fisso = case when p_solo_vuoti then coalesce(c.telefono_fisso, fis) else coalesce(fis, c.telefono_fisso) end,
    email = case when p_solo_vuoti then coalesce(c.email, em) else coalesce(em, c.email) end,
    documento_scadenza = case when p_solo_vuoti then coalesce(c.documento_scadenza, sc) else coalesce(sc, c.documento_scadenza) end
  where c.id = v_id;
exception when others then
  raise warning 'archivia_cliente %: %', nc, sqlerrm;
end $$;

revoke all on function public.archivia_cliente(text, text, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;

create or replace function public.pratiche_archivia_clienti()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.archivia_cliente(new.nome::text, null, null, new.cf::text, new.codice_fiscale::text,
    new.telefono::text, new.telefono_fisso::text, new.email::text, new.documento_scadenza::text, false);
  if coalesce(new.cong_cognome::text, '') <> '' or coalesce(new.cong_nome::text, '') <> '' then
    perform public.archivia_cliente(btrim(coalesce(new.cong_cognome::text, '') || ' ' || coalesce(new.cong_nome::text, '')),
      new.cong_cognome::text, new.cong_nome::text, new.cong_data::text, new.cong_codice_fiscale::text,
      new.cong_telefono::text, null, null, null, false);
  end if;
  return new;
exception when others then
  raise warning 'pratiche_archivia_clienti: %', sqlerrm;
  return new;
end $$;

create or replace trigger pratiche_archivia_clienti after insert or update on public.pratiche
  for each row execute function public.pratiche_archivia_clienti();

-- Unisce all'archivio un elenco di clienti (es. da un backup) senza cancellare nessuno
-- e senza sovrascrivere i dati piu' recenti: riempie solo i campi vuoti.
create or replace function public.unisci_clienti(lista jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare e jsonb; n integer := 0;
begin
  if not (public.puo('anagrafica') or public.puo('registro') or public.e_admin()) then
    raise exception 'Permesso negato';
  end if;
  for e in select * from jsonb_array_elements(coalesce(lista, '[]'::jsonb)) loop
    perform public.archivia_cliente(e->>'nome_completo', e->>'cognome', e->>'nome', e->>'data_nascita', e->>'codice_fiscale',
      e->>'telefono', e->>'telefono_fisso', e->>'email', e->>'documento_scadenza', true);
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function public.unisci_clienti(jsonb) to authenticated;
