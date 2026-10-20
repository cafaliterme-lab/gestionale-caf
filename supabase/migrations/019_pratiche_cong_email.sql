-- E-mail del coniuge nelle pratiche congiunte (facoltativa)
alter table public.pratiche add column if not exists cong_email text;
