-- Codice fiscale nell'archivio clienti e nelle pratiche (letto dalla tessera sanitaria o inserito a mano).

alter table public.clienti add column if not exists codice_fiscale text;
alter table public.clienti drop constraint if exists clienti_codice_fiscale_formato;
alter table public.clienti add constraint clienti_codice_fiscale_formato
  check (codice_fiscale is null or codice_fiscale ~ '^[A-Z0-9]{16}$');
create unique index if not exists clienti_codice_fiscale_unico
  on public.clienti (codice_fiscale) where codice_fiscale is not null;

alter table public.pratiche add column if not exists codice_fiscale text not null default '';

-- Salva il codice fiscale di un cliente: lo aggiunge al cliente gia' archiviato
-- (stesso nome e data di nascita, ancora senza CF) oppure crea il cliente.
-- Serve una funzione perche' la modifica diretta di clienti e' riservata all'admin.
create or replace function public.salva_cliente_cf(
  p_nome_completo text, p_cognome text, p_nome text, p_data_nascita text, p_codice_fiscale text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.puo('anagrafica') or public.puo('registro')) then
    raise exception 'Permesso negato';
  end if;
  if p_codice_fiscale !~ '^[A-Z0-9]{16}$' then
    raise exception 'Codice fiscale non valido';
  end if;
  if exists (select 1 from public.clienti where codice_fiscale = p_codice_fiscale) then
    return;
  end if;
  update public.clienti set codice_fiscale = p_codice_fiscale
   where nome_completo = p_nome_completo and data_nascita = coalesce(p_data_nascita, '')
     and codice_fiscale is null;
  if found then
    return;
  end if;
  insert into public.clienti (nome_completo, cognome, nome, data_nascita, codice_fiscale)
  values (p_nome_completo, coalesce(p_cognome, ''), coalesce(p_nome, ''), coalesce(p_data_nascita, ''), p_codice_fiscale)
  on conflict (nome_completo, data_nascita) do nothing;
end;
$$;

revoke all on function public.salva_cliente_cf(text, text, text, text, text) from public;
grant execute on function public.salva_cliente_cf(text, text, text, text, text) to authenticated;
