-- Consegna della pratica al cliente (data e chi l'ha consegnata)
alter table public.pratiche add column if not exists consegnata_il text;
alter table public.pratiche add column if not exists consegnata_da text;
