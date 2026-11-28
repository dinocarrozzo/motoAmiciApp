-- Prove di 0008_richieste.sql. Ordine: shim, 0001..0008, helpers, questo file.
select t.as_admin();
insert into auth.users(id) values ('b8000000-0000-0000-0000-000000000002'), ('c8000000-0000-0000-0000-000000000003'), ('d8000000-0000-0000-0000-000000000004'), ('e8000000-0000-0000-0000-000000000005'), ('a8000000-0000-0000-0000-000000000006'), ('a8000000-0000-0000-0000-000000000007'), ('a8000000-0000-0000-0000-000000000008');
insert into public.profiles(id, nickname, gender, avatar) values ('b8000000-0000-0000-0000-000000000002', 'bruno8', 'm', 'moto'), ('c8000000-0000-0000-0000-000000000003', 'carlo8', 'm', 'moto'), ('d8000000-0000-0000-0000-000000000004', 'dario8', 'm', 'moto'), ('e8000000-0000-0000-0000-000000000005', 'elena8', 'm', 'moto'), ('a8000000-0000-0000-0000-000000000006', 'xavier8', 'm', 'moto'), ('a8000000-0000-0000-0000-000000000007', 'yuri8', 'm', 'moto'), ('a8000000-0000-0000-0000-000000000008', 'zeno8', 'm', 'moto');
-- B crea il gruppo, C entra: due giri vicini
select t.as_user('b8000000-0000-0000-0000-000000000002');
select public.start_ride('b8bbbbbb-0000-0000-0000-0000000000b1', 'passeggiata', 'all', 'Lago');
insert into public.track_points(session_id, recorded_at, lat, lng) values ('b8bbbbbb-0000-0000-0000-0000000000b1', now() - interval '5 seconds', 45.46012, 9.19017);
select t.as_admin();
select set_config('t.g', (select group_id::text from public.rides where id = 'b8bbbbbb-0000-0000-0000-0000000000b1'), false);
insert into public.group_members(group_id, user_id, role, status) values (current_setting('t.g')::uuid, 'c8000000-0000-0000-0000-000000000003', 'member', 'active');
select t.as_user('c8000000-0000-0000-0000-000000000003');
select public.start_ride('c8ccccc0-0000-0000-0000-0000000000c1', null, 'all', null, current_setting('t.g')::uuid);
insert into public.track_points(session_id, recorded_at, lat, lng) values ('c8ccccc0-0000-0000-0000-0000000000c1', now() - interval '3 seconds', 45.46030, 9.19040);
select t.as_admin();
insert into public.blocks(blocker, blocked) values ('b8000000-0000-0000-0000-000000000002', 'a8000000-0000-0000-0000-000000000006');
-- 1. D chiede
select t.as_user('d8000000-0000-0000-0000-000000000004');
select set_config('t.r1', public.request_join(current_setting('t.g')::uuid, 'Ciao, posso unirmi?')::text, false);
select t.assert(current_setting('t.r1')::uuid is not null, 'D ha una richiesta');
-- 2. bloccato da un membro: non trova il gruppo
select t.as_user('a8000000-0000-0000-0000-000000000006');
select t.fails(format($q$select public.request_join(%L, null)$q$, current_setting('t.g')), 'Gruppo non trovato');
-- 3. doppia richiesta
select t.as_user('d8000000-0000-0000-0000-000000000004');
select t.fails(format($q$select public.request_join(%L, null)$q$, current_setting('t.g')), 'Richiesta già inviata');
select t.fails(format($q$select public.request_join(%L, repeat('a', 141))$q$, current_setting('t.g')), 'Messaggio troppo lungo');
-- 4. E (free) chiede
select t.as_user('e8000000-0000-0000-0000-000000000005');
select set_config('t.r2', public.request_join(current_setting('t.g')::uuid, null)::text, false);
-- 5. chi vede le richieste in arrivo
select t.as_user('b8000000-0000-0000-0000-000000000002');
select t.assert((select count(*) from public.list_incoming_requests()) = 2, 'B vede 2 richieste');
select t.assert((select count(*) from public.list_incoming_requests() where nickname = 'dario8' and message = 'Ciao, posso unirmi?') = 1, 'con nickname e messaggio');
select t.as_user('c8000000-0000-0000-0000-000000000003');
select t.assert((select count(*) from public.list_incoming_requests()) = 2, 'anche C le vede');
select t.as_user('d8000000-0000-0000-0000-000000000004');
select t.assert((select count(*) from public.list_incoming_requests()) = 0, 'D (estraneo) non vede richieste altrui');
-- 6. B accetta con punto d'incontro; C arriva dopo: già gestita
select t.as_user('b8000000-0000-0000-0000-000000000002');
select public.respond_join_request(current_setting('t.r1')::uuid, true, 45.46, 9.19, 'Bar Sport');
select t.as_user('c8000000-0000-0000-0000-000000000003');
select t.fails(format($q$select public.respond_join_request(%L, true, null, null, null)$q$, current_setting('t.r1')), 'Richiesta già gestita');
select t.as_admin();
select t.assert((select count(*) from public.group_members where group_id = current_setting('t.g')::uuid and status = 'active') = 3, 'D è entrato, una volta sola');
select t.as_user('d8000000-0000-0000-0000-000000000004');
select t.assert((select status from public.list_my_requests() limit 1) = 'accepted', 'D vede accettata');
select t.assert((select meet_lat from public.list_my_requests() limit 1) = 45.46 and (select meet_note from public.list_my_requests() limit 1) = 'Bar Sport', 'punto e nota');
select t.fails(format($q$select public.request_join(%L, null)$q$, current_setting('t.g')), 'Sei già nel gruppo');
-- 7. rifiuto e attesa di un'ora
select t.as_user('c8000000-0000-0000-0000-000000000003');
select public.respond_join_request(current_setting('t.r2')::uuid, false, null, null, null);
select t.as_user('e8000000-0000-0000-0000-000000000005');
select t.fails(format($q$select public.request_join(%L, null)$q$, current_setting('t.g')), 'Potrai riprovare tra');
select t.assert((select status from public.list_my_requests() limit 1) = 'declined', 'E vede rifiutata');
select t.assert((select meet_lat from public.list_my_requests() limit 1) is null, 'nessun punto in un rifiuto');
select t.as_admin();
update public.join_requests set answered_at = now() - interval '61 minutes' where id = current_setting('t.r2')::uuid;
select t.as_user('e8000000-0000-0000-0000-000000000005');
select set_config('t.r3', public.request_join(current_setting('t.g')::uuid, null)::text, false);
-- 8. annullare: solo il richiedente
select t.as_user('d8000000-0000-0000-0000-000000000004');
select t.fails(format($q$select public.cancel_join_request(%L)$q$, current_setting('t.r3')), 'Richiesta non trovata');
select t.as_user('e8000000-0000-0000-0000-000000000005');
select public.cancel_join_request(current_setting('t.r3')::uuid);
select set_config('t.r4', public.request_join(current_setting('t.g')::uuid, null)::text, false);
-- 9. coordinate non valide
select t.as_user('b8000000-0000-0000-0000-000000000002');
select t.fails(format($q$select public.respond_join_request(%L, true, 95, 9, null)$q$, current_setting('t.r4')), 'Coordinate non valide');
select t.fails(format($q$select public.respond_join_request(%L, true, 45, null, null)$q$, current_setting('t.r4')), 'Coordinate non valide');
-- 10. blocco dopo la richiesta: l'accettazione non va a buon fine
select t.as_user('a8000000-0000-0000-0000-000000000007');
select set_config('t.r5', public.request_join(current_setting('t.g')::uuid, null)::text, false);
select t.as_admin();
insert into public.blocks(blocker, blocked) values ('c8000000-0000-0000-0000-000000000003', 'a8000000-0000-0000-0000-000000000007');
select t.as_user('b8000000-0000-0000-0000-000000000002');
select t.fails(format($q$select public.respond_join_request(%L, true, null, null, null)$q$, current_setting('t.r5')), 'Richiesta non valida');
select t.as_admin();
select t.assert((select status from public.join_requests where id = current_setting('t.r5')::uuid) = 'pending', 'resta in attesa');
select t.assert(not public.is_group_member('a8000000-0000-0000-0000-000000000007', current_setting('t.g')::uuid), 'Y non è entrato');
-- 11. solo amici
update public.rides set visibility = 'friends' where group_id = current_setting('t.g')::uuid;
select t.as_user('a8000000-0000-0000-0000-000000000008');
select t.fails(format($q$select public.request_join(%L, null)$q$, current_setting('t.g')), 'Gruppo non trovato');
select t.as_admin();
insert into public.friendships(requester, addressee, status) values ('a8000000-0000-0000-0000-000000000008', 'c8000000-0000-0000-0000-000000000003', 'accepted');
select t.as_user('a8000000-0000-0000-0000-000000000008');
select public.request_join(current_setting('t.g')::uuid, null);
-- 12. anonimo
select t.as_anon();
select t.fails(format($q$select public.request_join(%L, null)$q$, current_setting('t.g')), 'permission denied');
select t.fails($q$select * from public.list_incoming_requests()$q$, 'permission denied');
select t.fails($q$select * from public.list_my_requests()$q$, 'permission denied');
-- 13. scritture dirette vietate
select t.as_user('d8000000-0000-0000-0000-000000000004');
select t.fails($q$insert into public.join_requests(group_id, requester_id, status) select group_id, requester_id, 'accepted' from public.join_requests limit 1$q$, 'permission denied');
select t.fails($q$update public.join_requests set status = 'accepted'$q$, 'permission denied');
-- 14. Pulizia: dopo 24 ore dalla chiusura del gruppo le richieste spariscono
select t.as_admin();
update public.ride_groups set ended_at = now() - interval '25 hours' where id = current_setting('t.g')::uuid;
select t.as_user('b8000000-0000-0000-0000-000000000002');
select public.end_ride('b8bbbbbb-0000-0000-0000-0000000000b1');
select t.as_admin();
select t.assert((select count(*) from public.join_requests where group_id = current_setting('t.g')::uuid) = 0, 'richieste di un gruppo chiuso da 25 ore cancellate');

select 'TUTTE LE VERIFICHE SONO PASSATE' as esito;
