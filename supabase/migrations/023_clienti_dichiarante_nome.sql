-- Coniuge dichiarante: cognome e nome del dichiarante (titolare della congiunta)
alter table public.clienti add column if not exists dichiarante_nome text;
