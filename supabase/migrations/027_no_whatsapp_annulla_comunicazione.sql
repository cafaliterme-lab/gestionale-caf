-- Il cellulare del cliente non ha WhatsApp: i messaggi a tutti usano e-mail o SMS
alter table public.clienti add column if not exists no_whatsapp boolean default false;
comment on column public.clienti.no_whatsapp is 'Il cellulare del cliente non ha WhatsApp: i messaggi a tutti usano e-mail o SMS';
-- Chi ha mandato un messaggio può toglierlo dallo storico entro 2 ore (es. il numero non era su WhatsApp)
create policy comunicazioni_annulla_propria on public.comunicazioni for delete to authenticated
  using (quando > now() - interval '2 hours' and operatore = (select upper(p.nome) from public.profili p where p.id = auth.uid()));
