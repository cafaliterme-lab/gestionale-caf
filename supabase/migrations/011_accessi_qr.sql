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

-- Telefoni "chiave": dopo il primo accesso col QR il telefono resta abilitato a far entrare i PC
-- anche se nel programma si preme "Esci" (il segreto e' solo sul telefono; qui c'e' l'impronta).
create table if not exists public.telefoni_qr (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references auth.users(id) on delete cascade,
  nome text,
  segreto_hash text not null,
  creato_il timestamptz not null default now(),
  ultimo_uso timestamptz,
  revocato_il timestamptz
);
alter table public.telefoni_qr enable row level security;
create index if not exists telefoni_qr_utente on public.telefoni_qr (utente_id);
