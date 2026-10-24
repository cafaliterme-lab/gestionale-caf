-- Il cliente non vuole ricevere messaggi (auguri, avvio campagna, richiami mandati a tutti)
alter table public.clienti add column if not exists no_messaggi boolean default false;
comment on column public.clienti.no_messaggi is 'Il cliente non vuole ricevere messaggi (auguri, avvio campagna, richiami)';
