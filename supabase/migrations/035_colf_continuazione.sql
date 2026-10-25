-- Contratti colf e badanti in continuazione (trasferiti nell'anno nuovo o rinnovati):
-- non prendono un numero nuovo della serie AP. Hanno una serie interna «CT» (non mostrata)
-- e portano il protocollo d'origine (es. AP-0002/2026), che è quello che si vede.
alter table public.pratiche
  add column if not exists continuazione boolean not null default false,
  add column if not exists protocollo_origine text;

create or replace function public.pratiche_prima_di_inserire()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  admin boolean := public.e_admin();
begin
  if new.anno is null then new.anno := public.anno_da_data(new.data); end if;
  new.serie := case when coalesce(new.continuazione, false) then 'CT' else public.serie_da_tipo(new.tipo) end;
  if not admin then
    new.numero := null; new.inserito_da := null; new.inserito_il := null;
  end if;
  if new.numero is null then
    insert into public.contatori as c (anno, serie, next) values (new.anno, new.serie, 2)
    on conflict (anno, serie) do update set next = c.next + 1
    returning c.next - 1 into new.numero;
  else
    insert into public.contatori as c (anno, serie, next) values (new.anno, new.serie, new.numero + 1)
    on conflict (anno, serie) do update set next = greatest(c.next, excluded.next);
  end if;
  new.inserito_da := coalesce(new.inserito_da, public.nome_utente());
  new.inserito_il := coalesce(new.inserito_il, now());
  new.aggiornato_il := now();
  return new;
end $function$;

create or replace function public.pratiche_prima_di_aggiornare()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  new.anno := old.anno;
  new.inserito_da := old.inserito_da;
  new.inserito_il := old.inserito_il;
  new.aggiornato_il := now();
  -- una continuazione resta continuazione (serie interna CT)
  new.continuazione := old.continuazione;
  new.serie := case when old.continuazione then 'CT' else public.serie_da_tipo(new.tipo) end;
  -- cambiando tipo da 730 ad altra pratica (o viceversa) la pratica prende il numero della nuova serie
  if new.serie is distinct from old.serie then
    insert into public.contatori as c (anno, serie, next) values (new.anno, new.serie, 2)
    on conflict (anno, serie) do update set next = c.next + 1
    returning c.next - 1 into new.numero;
  else
    new.numero := old.numero;
  end if;
  new.modificato_da := coalesce(public.nome_utente(), old.modificato_da, '');
  if new.annullata and not old.annullata then
    new.annullata_il := now(); new.annullata_da := coalesce(public.nome_utente(), '');
  elsif not new.annullata then
    new.annullata_il := null; new.annullata_da := ''; new.annullata_motivo := '';
  else
    new.annullata_il := old.annullata_il; new.annullata_da := old.annullata_da;
  end if;
  return new;
end $function$;

-- la scadenza in calendario riporta il protocollo d'origine per le continuazioni
create or replace function public.sincronizza_scadenza_assistenza()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  d date;
begin
  if new.tipo = 'CONTRATTI COLF E BADANTI' and coalesce(new.scadenza_assistenza,'') ~ '^\d{2}/\d{2}/\d{4}$' then
    begin
      d := to_date(new.scadenza_assistenza, 'DD/MM/YYYY');
    exception when others then
      d := null;
    end;
  end if;

  if new.stato = 'pratica_cessata' or coalesce(new.trasferita_in, '') <> '' then
    d := null;
  end if;

  if d is null then
    delete from public.scadenze where pratica_id = new.id;
    return new;
  end if;

  insert into public.scadenze as s (titolo, data, avviso_giorni, cliente, note, completata, creato_da, pratica_id)
  values ('Scadenza assistenza colf/badanti', d, 15, new.nome,
          'Pratica ' || case when new.continuazione and coalesce(new.protocollo_origine, '') <> '' then new.protocollo_origine || ' (continuazione ' || new.anno || ')'
                             else new.serie || '-' || lpad(new.numero::text, 4, '0') || '/' || new.anno end,
          false, new.inserito_da, new.id)
  on conflict (pratica_id) do update
    set data = excluded.data,
        avviso_giorni = excluded.avviso_giorni,
        cliente = excluded.cliente,
        note = excluded.note,
        completata = case when s.data = excluded.data then s.completata else false end;
  return new;
end $function$;
