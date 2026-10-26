-- Contratti di affitto: il cliente è il proprietario (locatore); gli inquilini (uno o più) stanno nella pratica.
-- Regime: cedolare secca agevolata / cedolare secca normale / senza cedolare secca.
-- Scadenze in calendario (una per pratica, come per le colf):
--   senza cedolare  → la prossima annualità (alla scadenza segnata «pagata» passa all'anno dopo: affitto_prossima);
--                     dopo l'ultima annualità resta la fine del contratto;
--   cedolare secca  → la fine del contratto (scadenza naturale).
alter table public.pratiche
  add column if not exists inquilini jsonb not null default '[]'::jsonb,
  add column if not exists affitto_regime text,
  add column if not exists affitto_inizio text,
  add column if not exists affitto_durata text,
  add column if not exists affitto_fine text,
  add column if not exists affitto_prossima text;

alter table public.clienti
  add column if not exists inquilino boolean not null default false;

create or replace function public.sincronizza_scadenza_assistenza()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  d date;
  fine date;
  titolo text := 'Scadenza assistenza colf/badanti';
  avviso int := 15;
  nota text;
begin
  if new.tipo = 'CONTRATTI COLF E BADANTI' and coalesce(new.scadenza_assistenza,'') ~ '^\d{2}/\d{2}/\d{4}$' then
    begin
      d := to_date(new.scadenza_assistenza, 'DD/MM/YYYY');
    exception when others then
      d := null;
    end;
  elsif new.tipo = 'CONTRATTI DI AFFITTO' then
    avviso := 30;
    begin
      if coalesce(new.affitto_fine,'') ~ '^\d{2}/\d{2}/\d{4}$' then fine := to_date(new.affitto_fine, 'DD/MM/YYYY'); end if;
      if new.affitto_regime = 'senza_cedolare' then
        if coalesce(new.affitto_prossima,'') ~ '^\d{2}/\d{2}/\d{4}$' then
          d := to_date(new.affitto_prossima, 'DD/MM/YYYY');
        elsif coalesce(new.affitto_inizio,'') ~ '^\d{2}/\d{2}/\d{4}$' then
          d := (to_date(new.affitto_inizio, 'DD/MM/YYYY') + interval '1 year')::date;
        end if;
        if d is not null and fine is not null and d >= fine then d := fine; end if;
        titolo := case when d is not null and d = fine then 'Fine contratto d''affitto' else 'Annualità contratto d''affitto' end;
      elsif new.affitto_regime in ('cedolare_agevolato', 'cedolare_normale') then
        d := fine;
        titolo := 'Fine contratto d''affitto (cedolare secca)';
      end if;
    exception when others then
      d := null;
    end;
  end if;

  if new.stato = 'pratica_cessata' or coalesce(new.trasferita_in, '') <> '' or coalesce(new.annullata, false) then
    d := null;
  end if;

  if d is null then
    delete from public.scadenze where pratica_id = new.id;
    return new;
  end if;

  nota := 'Pratica ' || case when new.continuazione and coalesce(new.protocollo_origine, '') <> '' then new.protocollo_origine || ' (continuazione ' || new.anno || ')'
                             else new.serie || '-' || lpad(new.numero::text, 4, '0') || '/' || new.anno end;
  if new.tipo = 'CONTRATTI DI AFFITTO' then
    nota := nota || ' · ' || case new.affitto_regime when 'cedolare_agevolato' then 'cedolare secca agevolata' when 'cedolare_normale' then 'cedolare secca' else 'senza cedolare secca' end
      || coalesce(' · inquilini: ' || nullif((select string_agg(trim(coalesce(i->>'cognome','') || ' ' || coalesce(i->>'nome','')), ', ') from jsonb_array_elements(coalesce(new.inquilini, '[]'::jsonb)) i), ''), '');
  end if;

  insert into public.scadenze as s (titolo, data, avviso_giorni, cliente, note, completata, creato_da, pratica_id)
  values (titolo, d, avviso, new.nome, nota, false, new.inserito_da, new.id)
  on conflict (pratica_id) do update
    set titolo = excluded.titolo,
        data = excluded.data,
        avviso_giorni = excluded.avviso_giorni,
        cliente = excluded.cliente,
        note = excluded.note,
        completata = case when s.data = excluded.data then s.completata else false end;
  return new;
end $function$;

-- le scadenze dei contratti di affitto si aggiornano quando cambiano regime, date o inquilini (e se la pratica viene annullata)
create or replace trigger pratiche_scadenza_affitto
  after update of inquilini, affitto_regime, affitto_inizio, affitto_fine, affitto_prossima, annullata on public.pratiche
  for each row execute function public.sincronizza_scadenza_assistenza();
