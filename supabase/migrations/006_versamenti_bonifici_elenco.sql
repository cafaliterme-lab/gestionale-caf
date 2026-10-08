-- Elenco dei singoli bonifici (chi ha pagato, data, importo) detratti dal versamento al CAF
alter table public.versamenti add column if not exists bonifici_elenco jsonb not null default '[]'::jsonb;
