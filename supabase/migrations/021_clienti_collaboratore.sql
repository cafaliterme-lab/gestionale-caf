-- Collaboratore a cui appartiene il cliente (si propone come tipo nelle nuove pratiche)
alter table public.clienti add column if not exists collaboratore text;
