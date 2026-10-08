-- Descrizione scritta a mano quando il tipo di pratica è "ALTRE PRATICHE"
alter table public.pratiche add column if not exists descrizione_tipo text not null default '';
