-- Pagamento richiesto al cliente: promemoria, non entra in contabilita' (conta solo il pagato effettivo)
alter table public.pratiche add column if not exists richiesto numeric;
