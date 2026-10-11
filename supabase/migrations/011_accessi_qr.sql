-- Accesso al PC inquadrando un QR con il telefono (gia' entrato nel programma).
-- La tabella e' usata solo dalla funzione "accesso-qr" sul server (chiave di servizio):
-- nessuna regola di accesso per gli utenti, quindi dal programma non si legge ne' si scrive.
create table if not exists public.accessi_qr (
  id uuid primary key default gen_random_uuid(),
  codice_hash text not null unique,
  segreto_hash text not null,
  dispositivo text,
  creato_il timestamptz not null default now(),
  scade_il timestamptz not null,
  utente_id uuid references auth.users(id) on delete cascade,
  approvato_il timestamptz,
  usato_il timestamptz
);
alter table public.accessi_qr enable row level security;
create index if not exists accessi_qr_creato_il on public.accessi_qr (creato_il);
