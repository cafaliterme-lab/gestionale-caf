-- ⚱️ Successioni (v1.8): dati del dante causa (la persona deceduta) nella pratica. Solo aggiunte.
alter table public.pratiche add column if not exists dc_cognome text;
alter table public.pratiche add column if not exists dc_nome text;
alter table public.pratiche add column if not exists dc_data_nascita text;
alter table public.pratiche add column if not exists dc_luogo_nascita text;
alter table public.pratiche add column if not exists dc_codice_fiscale text;
alter table public.pratiche add column if not exists dc_data_morte text;
