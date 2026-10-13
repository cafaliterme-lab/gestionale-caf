-- Cliente già in archivio senza codice fiscale / telefono: quando si salva con il CF (anche dalla scansione
-- del documento) si aggiorna il cliente esistente invece di crearne un altro.
-- Le due funzioni usano la stessa ricerca di archivia_cliente: per CF, poi per nome + data di nascita,
-- poi per nome con data di nascita vuota e senza CF.
create or replace function public.salva_cliente_cf(p_nome_completo text, p_cognome text, p_nome text, p_data_nascita text, p_codice_fiscale text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not (public.puo('anagrafica') or public.puo('registro')) then
    raise exception 'Permesso negato';
  end if;
  if p_codice_fiscale !~ '^[A-Z0-9]{16}$' then
    raise exception 'Codice fiscale non valido';
  end if;
  perform public.archivia_cliente(p_nome_completo, p_cognome, p_nome, p_data_nascita, p_codice_fiscale, null, null, null, null, false);
end $$;

create or replace function public.salva_recapiti_cliente(p_nome_completo text, p_cognome text, p_nome text, p_data_nascita text, p_codice_fiscale text, p_telefono text, p_telefono_fisso text, p_documento_scadenza text, p_email text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not (public.puo('anagrafica', true) or public.puo('registro', true)) then
    raise exception 'Permesso negato';
  end if;
  if coalesce(p_telefono, '') = '' and coalesce(p_telefono_fisso, '') = '' and coalesce(p_documento_scadenza, '') = '' and coalesce(p_email, '') = '' then return; end if;
  perform public.archivia_cliente(p_nome_completo, p_cognome, p_nome, p_data_nascita, p_codice_fiscale, p_telefono, p_telefono_fisso, p_email, p_documento_scadenza, false);
end $$;
