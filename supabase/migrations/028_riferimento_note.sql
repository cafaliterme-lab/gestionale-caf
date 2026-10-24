-- Riferimento (persona che ha portato il cliente) e note nella scheda del cliente; riferimento anche nella pratica
alter table public.clienti add column if not exists riferimento text;
alter table public.clienti add column if not exists note text;
alter table public.pratiche add column if not exists riferimento text;
