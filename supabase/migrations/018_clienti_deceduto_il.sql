-- Data del decesso nella scheda del cliente: la scheda resta in archivio ma esce dalle ricerche e dai promemoria
alter table public.clienti add column if not exists deceduto_il text;
comment on column public.clienti.deceduto_il is 'Data del decesso (GG/MM/AAAA): la scheda resta in archivio ma esce dalle ricerche e dai promemoria';
