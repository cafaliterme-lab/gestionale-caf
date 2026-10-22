-- Ruolo nella dichiarazione: dichiarante (titolare) o coniuge (coniuge dichiarante nella congiunta)
alter table public.clienti add column if not exists ruolo_dichiarazione text;
