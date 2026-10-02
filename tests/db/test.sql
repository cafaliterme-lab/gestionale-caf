-- Test dello schema. Uso: vedi tests/db/run.sh
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'angelo@example.com',   '{"nome":"Angelo"}'),
  ('00000000-0000-0000-0000-00000000000f', 'federica@example.com', '{"nome":"Federica"}');

create or replace function pg_temp.come(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.verifica(cond boolean, descr text) returns void language plpgsql as $$
begin
  if not cond then raise exception 'FALLITO: %', descr; end if;
  raise notice 'ok - %', descr;
end $$;

-- Profili creati automaticamente: il primo e' admin.
select pg_temp.verifica((select ruolo from profili where nome = 'ANGELO') = 'admin', 'il primo account e'' amministratore');
select pg_temp.verifica((select ruolo from profili where nome = 'FEDERICA') = 'operatore', 'il secondo account e'' operatore');
select pg_temp.verifica((select sola_lettura from profili where nome = 'FEDERICA'), 'operatore in sola lettura di default');
select pg_temp.verifica((select count(*) from collaboratori) = 14, 'collaboratori predefiniti presenti');

-- Angelo inserisce due pratiche: numerazione automatica.
select pg_temp.come('00000000-0000-0000-0000-00000000000a');
insert into pratiche (anno, nome, data, tipo, compenso) values (2027, 'ROSSI MARIO', '02/01/2027', '730 SEDE', 10);
insert into pratiche (anno, nome, data, tipo, numero, inserito_da) values (2027, 'BIANCHI ANNA', '02/01/2027', '730 SEDE', null, null);
select pg_temp.verifica((select array_agg(numero order by numero) from pratiche where anno = 2027) = '{1,2}', 'numeri 1 e 2 assegnati in ordine');
select pg_temp.verifica((select inserito_da from pratiche where nome = 'ROSSI MARIO') = 'ANGELO', 'inserito_da preso dal profilo');

-- Federica (sola lettura): puo' inserire, non modificare/cancellare.
reset role;
select pg_temp.come('00000000-0000-0000-0000-00000000000f');
insert into pratiche (anno, nome, data, numero, inserito_da) values (2027, 'VERDI LUCA', '03/01/2027', 999, 'ANGELO');
select pg_temp.verifica((select numero from pratiche where nome = 'VERDI LUCA') = 3, 'operatore non puo'' scegliere il numero');
select pg_temp.verifica((select inserito_da from pratiche where nome = 'VERDI LUCA') = 'FEDERICA', 'operatore non puo'' falsificare l''autore');
update pratiche set stato = 'pagato' where nome = 'ROSSI MARIO';
select pg_temp.verifica((select stato from pratiche where nome = 'ROSSI MARIO') = 'arrivo', 'sola lettura: modifica ignorata');
delete from pratiche where nome = 'ROSSI MARIO';
select pg_temp.verifica((select count(*) from pratiche) = 3, 'sola lettura: cancellazione ignorata');
select pg_temp.verifica((select count(*) from versamenti) = 0, 'senza scheda CAF non vede i versamenti');
do $$ begin
  insert into versamenti (importo) values (50);
  raise exception 'FALLITO: versamento inserito senza permesso';
exception when insufficient_privilege then raise notice 'ok - senza scheda CAF non puo'' inserire versamenti';
end $$;
do $$ begin
  update profili set ruolo = 'admin', sola_lettura = false where id = auth.uid();
  if (select ruolo from profili where id = auth.uid()) = 'admin' then raise exception 'FALLITO: auto-promozione'; end if;
  raise notice 'ok - un operatore non puo'' darsi i permessi da solo';
end $$;
do $$ begin
  perform svuota_registro();
  raise exception 'FALLITO: operatore ha svuotato il registro';
exception when insufficient_privilege then raise notice 'ok - solo l''admin svuota il registro';
end $$;
select pg_temp.verifica((select count(*) from profili) = 1, 'un operatore vede solo il proprio profilo');
do $$ begin
  perform 1 from contatori;
  raise exception 'FALLITO: contatori leggibili';
exception when insufficient_privilege then raise notice 'ok - contatori non accessibili direttamente';
end $$;

-- Angelo concede a Federica scrittura e scheda CAF.
reset role;
select pg_temp.come('00000000-0000-0000-0000-00000000000a');
update profili set sola_lettura = false, tabs = tabs || '{"caf":true}' where nome = 'FEDERICA';
reset role;
select pg_temp.come('00000000-0000-0000-0000-00000000000f');
update pratiche set stato = 'pagato', numero = 77, inserito_da = 'X' where nome = 'ROSSI MARIO';
select pg_temp.verifica((select stato || '/' || numero || '/' || inserito_da from pratiche where nome = 'ROSSI MARIO') = 'pagato/1/ANGELO', 'con scrittura modifica lo stato, ma non numero e autore');
insert into versamenti (importo, data) values (50, '05/01/2027');
select pg_temp.verifica((select count(*) from versamenti) = 1, 'con scheda CAF inserisce versamenti');
do $$ begin
  perform salva_collaboratori(array['X']);
  raise exception 'FALLITO: collaboratori modificati senza permesso';
exception when insufficient_privilege then raise notice 'ok - senza scheda collaboratori non li modifica';
end $$;

-- Anonimo: non vede nulla.
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$ begin
  perform 1 from pratiche;
  raise exception 'FALLITO: anonimo legge le pratiche';
exception when insufficient_privilege then raise notice 'ok - utente non collegato non legge nulla';
end $$;

-- Importazione backup (formato della vecchia pagina) da admin.
reset role;
select pg_temp.come('00000000-0000-0000-0000-00000000000a');
select importa_backup($json${
  "pratiche":[
    {"id":"p1","numero":1,"nome":"GUGLIOTTA ANGELO","cf":"20/01/6030","tipo":"730 SEDE","compenso":"10","pagato":"45","data":"28/09/2026","stato":"lavorata"},
    {"id":"p2","numero":2,"nome":"MUZIO MARIARITA","tipo":"730 SEDE","compenso":"","pagato":"","data":"28/09/2026","stato":"arrivo"},
    {"id":"p7","numero":7,"anno":2026,"nome":"X","congCognome":"MUZIO","congNome":"MARIARITA","compenso":10,"pagato":25,"data":"30/09/2026","inseritoDa":"FEDERICA","inseritoIl":"2026-09-30T10:00:00.000Z"}
  ],
  "versamenti":[{"id":"v1","importo":50,"data":"","causale":""}],
  "collaboratori":["730 SEDE","730 NUOVO"],
  "utenti":[{"id":"federica","nome":"FEDERICA","permessi":{"tabs":{"contabilita":true},"soloLettura":true}}]
}$json$::jsonb);
select pg_temp.verifica((select count(*) from pratiche) = 3, 'backup: 3 pratiche importate');
select pg_temp.verifica((select compenso from pratiche where numero = 1) = 10 and (select compenso from pratiche where numero = 2) is null, 'backup: importi testo/vuoti convertiti');
select pg_temp.verifica((select inserito_da from pratiche where numero = 7) = 'FEDERICA', 'backup: autore originale conservato');
select pg_temp.verifica((select count(*) from versamenti) = 1, 'backup: versamenti sostituiti');
select pg_temp.verifica((select array_agg(nome order by ordine) from collaboratori) = '{"730 SEDE","730 NUOVO"}', 'backup: collaboratori sostituiti');
select pg_temp.verifica((select (tabs->>'contabilita')::boolean and sola_lettura from profili where nome = 'FEDERICA'), 'backup: permessi applicati per nome');
insert into pratiche (anno, nome, data) values (2026, 'DOPO IMPORT', '01/10/2026');
select pg_temp.verifica((select numero from pratiche where nome = 'DOPO IMPORT') = 8, 'backup: numerazione riparte dal massimo + 1');

select pg_temp.verifica(importa_clienti('[{"nomeCompleto":"ABBATE CHIARA","cognome":"ABBATE","nome":"CHIARA","dataNascita":"19/08/1994"},{"nomeCompleto":"ABBATE CHIARA","cognome":"ABBATE","nome":"CHIARA","dataNascita":"19/08/1994"}]') = 1, 'clienti: duplicati ignorati');

select svuota_registro();
select pg_temp.verifica((select count(*) from pratiche) = 0, 'svuota registro');
insert into pratiche (anno, nome, data) values (2026, 'NUOVA', '01/10/2026');
select pg_temp.verifica((select numero from pratiche) = 1, 'dopo lo svuotamento si riparte da 1');
reset role;
\echo 'TUTTI I TEST SUPERATI'
