-- Coniuge dichiarante: data di nascita del dichiarante
alter table public.clienti add column if not exists dichiarante_nascita text;
