-- Colf e badanti: motivo e data della cessazione del rapporto di lavoro
alter table public.pratiche add column if not exists cessazione_motivo text;
alter table public.pratiche add column if not exists cessazione_data text;
