-- Pagamenti ricevuti con bonifico da detrarre dal versamento al CAF, con le note
alter table public.versamenti add column if not exists bonifico numeric(12,2) not null default 0;
alter table public.versamenti add column if not exists bonifico_note text;
