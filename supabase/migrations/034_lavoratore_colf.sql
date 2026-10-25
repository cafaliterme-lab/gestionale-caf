-- Contratti colf e badanti: oltre al datore di lavoro (il cliente della pratica) si scrive il lavoratore.
-- In archivio il lavoratore è segnato come «lavoratore colf», con il permesso di soggiorno e la sua scadenza.
alter table public.pratiche
  add column if not exists lav_cognome text,
  add column if not exists lav_nome text,
  add column if not exists lav_codice_fiscale text,
  add column if not exists lav_data text,
  add column if not exists lav_comune_nascita text,
  add column if not exists lav_telefono text,
  add column if not exists lav_documento_tipo text,
  add column if not exists lav_documento_numero text,
  add column if not exists lav_documento_scadenza text,
  add column if not exists lav_permesso_numero text,
  add column if not exists lav_permesso_scadenza text;

alter table public.clienti
  add column if not exists lavoratore_colf boolean not null default false,
  add column if not exists permesso_numero text,
  add column if not exists permesso_scadenza text;
