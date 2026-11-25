-- Prove di sicurezza di 0002_account_amici.sql. Si lanciano con:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/supabase_shim.sql -f supabase/migrations/0001_track_points.sql \
--        -f supabase/migrations/0002_account_amici.sql -f supabase/tests/0002_rls.sql
-- Ogni verifica che non passa fa fermare lo script con un errore.
create schema if not exists t;
create or replace function t.assert(ok boolean, msg text) returns void language plpgsql as
  $$ begin if not coalesce(ok, false) then raise exception 'VERIFICA FALLITA: %', msg; end if; end $$;
create or replace function t.as_user(u uuid) returns void language plpgsql as
  $$ begin perform set_config('request.jwt.claim.sub', u::text, false); perform set_config('role', 'authenticated', false); end $$;
create or replace function t.as_anon() returns void language plpgsql as
  $$ begin perform set_config('request.jwt.claim.sub', '', false); perform set_config('role', 'anon', false); end $$;
create or replace function t.as_admin() returns void language plpgsql as
  $$ begin perform set_config('request.jwt.claim.sub', '', false); perform set_config('role', 'postgres', false); end $$;
-- Esegue uno statement e verifica che fallisca con un messaggio che contiene `pattern`.
create or replace function t.fails(stmt text, pattern text) returns void language plpgsql as $$
declare m text;
begin
  begin execute stmt; exception when others then m := sqlerrm; end;
  if m is null then raise exception 'VERIFICA FALLITA: doveva fallire: %', stmt; end if;
  if m not ilike '%' || pattern || '%' then raise exception 'VERIFICA FALLITA: errore inatteso (%) per: %', m, stmt; end if;
end $$;
grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

-- Tre utenti: A = mario, B = marta, C = luca
insert into auth.users(id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002'), ('cccccccc-0000-0000-0000-000000000003');
insert into public.profiles(id, nickname, display_name, gender, avatar) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'mario', 'Mario Rossi', 'm', 'moto'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'marta', 'Marta Bianchi', 'f', 'volpe'),
  ('cccccccc-0000-0000-0000-000000000003', 'luca', null, 'x', 'lupo');

-- 1. Ricerca per prefisso, esclude se stessi
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select t.assert((select count(*) from public.search_profiles('ma')) = 1, 'A cercando "ma" trova solo marta');
select t.assert((select nickname from public.search_profiles('MAR')) = 'marta', 'la ricerca non distingue le maiuscole');
select t.assert((select count(*) from public.search_profiles('bianchi')) = 0, 'la ricerca è per prefisso, non per parte centrale');
select t.assert((select count(*) from public.search_profiles('mar')) = 1, 'mar trova marta ma non se stesso (mario)');
select t.assert((select count(*) from public.search_profiles('mario')) = 0, 'non trova se stesso');

-- 2. Caratteri speciali e testi troppo corti non restituiscono tutto
select t.assert((select count(*) from public.search_profiles('%')) = 0, '% non restituisce nulla');
select t.assert((select count(*) from public.search_profiles('_')) = 0, '_ non restituisce nulla');
select t.assert((select count(*) from public.search_profiles('m')) = 0, 'un solo carattere non cerca');
select t.assert((select count(*) from public.search_profiles('')) = 0, 'testo vuoto non cerca');
select t.assert((select count(*) from public.search_profiles('\')) = 0, 'backslash non restituisce nulla');
select t.assert((select count(*) from public.search_profiles('%%')) = 0, '%% non restituisce tutti');
select t.assert((select count(*) from public.search_profiles('m%')) = 0, 'm% diventa m: troppo corto, nessun risultato');

-- 3. Blocco nei due sensi: A blocca B
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.block_user('bbbbbbbb-0000-0000-0000-000000000002');
select t.assert((select count(*) from public.search_profiles('mar')) = 0, 'A non trova più B dopo averlo bloccato');
select t.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select t.assert((select count(*) from public.search_profiles('mari')) = 0, 'B non trova A che lo ha bloccato');
select t.fails($q$select public.send_friend_request('aaaaaaaa-0000-0000-0000-000000000001')$q$, 'Utente non trovato');
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select t.fails($q$select public.send_friend_request('bbbbbbbb-0000-0000-0000-000000000002')$q$, 'Utente non trovato');
select t.assert((select count(*) from public.list_blocked()) = 1, 'A vede B tra i bloccati');
select t.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select t.assert((select count(*) from public.list_blocked()) = 0, 'B non vede alcun blocco: non sa di essere bloccato');
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.unblock_user('bbbbbbbb-0000-0000-0000-000000000002');
select t.assert((select count(*) from public.search_profiles('mar')) = 1, 'dopo lo sblocco A ritrova B');

-- 4. Richieste di amicizia
select t.fails($q$select public.send_friend_request('aaaaaaaa-0000-0000-0000-000000000001')$q$, 'te stesso');
select public.send_friend_request('cccccccc-0000-0000-0000-000000000003');
select t.fails($q$select public.send_friend_request('cccccccc-0000-0000-0000-000000000003')$q$, 'già inviata');
select t.assert((select count(*) from public.list_requests() where direction = 'sent') = 1, 'A ha una richiesta inviata');
select t.as_user('cccccccc-0000-0000-0000-000000000003');
select t.assert((select count(*) from public.list_requests() where direction = 'received') = 1, 'C ha una richiesta ricevuta');
select public.send_friend_request('aaaaaaaa-0000-0000-0000-000000000001');
select t.assert((select count(*) from public.list_friends()) = 1, 'la richiesta incrociata è diventata amicizia');
select t.fails($q$select public.send_friend_request('aaaaaaaa-0000-0000-0000-000000000001')$q$, 'già amici');
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select t.assert((select nickname from public.list_friends()) = 'luca', 'A ha luca tra gli amici');

-- 5. Rifiuto e accettazione
select public.send_friend_request('bbbbbbbb-0000-0000-0000-000000000002');
select t.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select public.respond_friend_request('aaaaaaaa-0000-0000-0000-000000000001', false);
select t.assert((select count(*) from public.list_requests()) = 0, 'dopo il rifiuto non resta nessuna richiesta');
select t.fails($q$select public.respond_friend_request('aaaaaaaa-0000-0000-0000-000000000001', true)$q$, 'non trovata');
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.send_friend_request('bbbbbbbb-0000-0000-0000-000000000002');
select t.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select public.respond_friend_request('aaaaaaaa-0000-0000-0000-000000000001', true);
select t.assert((select count(*) from public.list_friends()) = 1, 'B ha accettato: A è tra gli amici');

-- 6. Bloccare NASCONDE l'amicizia, sbloccare la RIPRISTINA (non si cancella niente)
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.block_user('cccccccc-0000-0000-0000-000000000003');
select t.assert((select count(*) from public.list_friends() where nickname = 'luca') = 0, 'bloccato: luca sparisce dagli amici');
select t.as_user('cccccccc-0000-0000-0000-000000000003');
select t.assert((select count(*) from public.list_friends()) = 0, 'anche per l''altro non compare più mentre c''è il blocco');
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.unblock_user('cccccccc-0000-0000-0000-000000000003');
select t.assert((select count(*) from public.list_friends() where nickname = 'luca') = 1, 'sbloccato: luca ricompare tra gli amici');
select t.as_user('cccccccc-0000-0000-0000-000000000003');
select t.assert((select count(*) from public.list_friends() where nickname = 'mario') = 1, 'anche per l''altro l''amicizia è tornata');
-- richieste in sospeso: nascoste e non accettabili mentre c'è il blocco, di nuovo visibili dopo lo sblocco
select t.as_admin();
insert into auth.users(id) values ('eeeeeeee-0000-0000-0000-000000000005');
insert into public.profiles(id, nickname, gender, avatar) values ('eeeeeeee-0000-0000-0000-000000000005', 'elena', 'f', 'gatto');
select t.as_user('eeeeeeee-0000-0000-0000-000000000005');
select public.send_friend_request('aaaaaaaa-0000-0000-0000-000000000001');
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.block_user('eeeeeeee-0000-0000-0000-000000000005');
select t.assert((select count(*) from public.list_requests()) = 0, 'richiesta di un bloccato: nascosta');
select t.fails($q$select public.respond_friend_request('eeeeeeee-0000-0000-0000-000000000005', true)$q$, 'non trovata');
select public.unblock_user('eeeeeeee-0000-0000-0000-000000000005');
select t.assert((select count(*) from public.list_requests() where direction = 'received') = 1, 'dopo lo sblocco la richiesta ricompare');
select public.respond_friend_request('eeeeeeee-0000-0000-0000-000000000005', true);
select t.assert((select count(*) from public.list_friends() where nickname = 'elena') = 1, 'e si può accettare');
select public.remove_friend('bbbbbbbb-0000-0000-0000-000000000002');
select t.assert((select count(*) from public.list_friends() where nickname = 'marta') = 0, 'remove_friend rimuove l''amicizia');

-- 7. Contatto fidato: solo il proprietario lo vede
select t.as_user('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.emergency_contacts(user_id, name, phone) values ('bbbbbbbb-0000-0000-0000-000000000002', 'Anna', '+393331234567');
select t.assert((select count(*) from public.emergency_contacts) = 1, 'B legge il proprio contatto');
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select t.assert((select count(*) from public.emergency_contacts) = 0, 'A non legge il contatto di B');
select t.fails($q$insert into public.emergency_contacts(user_id, name, phone) values ('bbbbbbbb-0000-0000-0000-000000000002', 'X', '+393331234567')$q$, 'row-level security');
select t.fails($q$insert into public.emergency_contacts(user_id, name, phone) values ('aaaaaaaa-0000-0000-0000-000000000001', 'X', '12')$q$, 'check');

-- 8. Nickname: unico senza distinguere le maiuscole, formato valido, disponibilità
select t.as_admin();
insert into auth.users(id) values ('dddddddd-0000-0000-0000-000000000004');
select t.as_user('dddddddd-0000-0000-0000-000000000004');
select t.fails($q$insert into public.profiles(id, nickname) values ('dddddddd-0000-0000-0000-000000000004', 'MARIO')$q$, 'duplicate');
select t.fails($q$insert into public.profiles(id, nickname) values ('dddddddd-0000-0000-0000-000000000004', 'a b')$q$, 'check');
select t.assert(public.nickname_available('MARIO') = false, 'MARIO è già preso (stesso nickname di mario)');
select t.assert(public.nickname_available('nuovo_nick') = true, 'nuovo_nick è libero');
insert into public.profiles(id, nickname) values ('dddddddd-0000-0000-0000-000000000004', 'Nuovo_Nick');
select t.assert((select gender from public.profiles where id = 'dddddddd-0000-0000-0000-000000000004') = 'x', 'sesso predefinito: non indicato');

-- 9. Accessi diretti vietati
select t.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select t.assert((select count(*) from public.profiles) = 1, 'A legge solo il proprio profilo dalla tabella');
select t.fails($q$insert into public.friendships(requester, addressee, status) values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'accepted')$q$, 'row-level security');
select t.fails($q$insert into public.blocks(blocker, blocked) values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001')$q$, 'row-level security');
update public.profiles set nickname = 'hackerato' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select t.as_admin();
select t.assert((select nickname from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'marta', 'A non ha potuto modificare il profilo di B');

-- 10. Senza accesso: nessuna funzione per gli anonimi
select t.as_anon();
select t.fails($q$select * from public.search_profiles('ma')$q$, 'permission denied');
select t.fails($q$select public.send_friend_request('aaaaaaaa-0000-0000-0000-000000000001')$q$, 'permission denied');
select t.as_admin();
select 'TUTTE LE VERIFICHE SONO PASSATE' as esito;
