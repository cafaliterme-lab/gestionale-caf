-- La registrazione della cronologia delle pratiche (trigger pratiche_storico_trg) risultava spenta dal 5/10/2026.
-- Si riaccende e, per sicurezza, ogni notte alle 3:47 UTC un'attività automatica la riaccende se qualcosa l'ha spenta.
alter table public.pratiche enable trigger pratiche_storico_trg;
select cron.schedule('riaccendi-cronologia', '47 3 * * *', $c$ alter table public.pratiche enable trigger pratiche_storico_trg $c$);
