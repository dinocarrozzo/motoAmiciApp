-- Prove di 0009_inviti.sql. Ordine: shim, 0001..0009, helpers, questo file.
select t.as_admin();
insert into auth.users(id) values ('a9000000-0000-0000-0000-000000000001'), ('b9000000-0000-0000-0000-000000000002'), ('c9000000-0000-0000-0000-000000000003'), ('d9000000-0000-0000-0000-000000000004'), ('e9000000-0000-0000-0000-000000000005'), ('a9000000-0000-0000-0000-000000000007'), ('a9000000-0000-0000-0000-000000000008'), ('a9000000-0000-0000-0000-000000000009');
insert into auth.users(id) values ('a9000000-0000-0000-0000-000000000010');
insert into public.profiles(id, nickname, gender, avatar) values ('a9000000-0000-0000-0000-000000000010', 'jack9', 'm', 'moto'), ('a9000000-0000-0000-0000-000000000001', 'anna9', 'm', 'moto'), ('b9000000-0000-0000-0000-000000000002', 'bruno9', 'm', 'moto'), ('c9000000-0000-0000-0000-000000000003', 'carlo9', 'm', 'moto'), ('d9000000-0000-0000-0000-000000000004', 'dario9', 'm', 'moto'), ('e9000000-0000-0000-0000-000000000005', 'elena9', 'm', 'moto'), ('a9000000-0000-0000-0000-000000000007', 'gino9', 'm', 'moto'), ('a9000000-0000-0000-0000-000000000008', 'hugo9', 'm', 'moto'), ('a9000000-0000-0000-0000-000000000009', 'ivo9', 'm', 'moto');
insert into public.friendships(requester, addressee, status) values ('a9000000-0000-0000-0000-000000000001','b9000000-0000-0000-0000-000000000002','accepted'), ('a9000000-0000-0000-0000-000000000001','a9000000-0000-0000-0000-000000000007','accepted'), ('a9000000-0000-0000-0000-000000000001','a9000000-0000-0000-0000-000000000008','accepted'), ('a9000000-0000-0000-0000-000000000001','a9000000-0000-0000-0000-000000000009','accepted');
insert into public.blocks(blocker, blocked) values ('a9000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000005'), ('a9000000-0000-0000-0000-000000000007', 'a9000000-0000-0000-0000-000000000001');
-- A crea il gruppo
select t.as_user('a9000000-0000-0000-0000-000000000001');
select public.start_ride('a9aaaaaa-0000-0000-0000-0000000000a1', 'passeggiata', 'all', 'Lago');
select set_config('t.code', (select invite_code from public.my_group()), false);
select set_config('t.g', (select group_id::text from public.my_group()), false);
-- 1. C entra con il codice
select t.as_user('c9000000-0000-0000-0000-000000000003');
select t.assert(public.join_by_code(current_setting('t.code')) = current_setting('t.g')::uuid, 'restituisce il gruppo');
select t.assert((select group_id from public.my_group()) = current_setting('t.g')::uuid, 'C è nel gruppo');
-- 2. maiuscole, spazi e trattini non contano
select t.as_user('d9000000-0000-0000-0000-000000000004');
select public.join_by_code(lower(substr(current_setting('t.code'), 1, 3)) || ' - ' || substr(current_setting('t.code'), 4));
select t.assert((select count(*) from public.my_group()) = 1, 'D è dentro con il codice scritto male');
-- 3. codici non validi
select t.fails($q$select public.join_by_code('')$q$, 'Codice non valido');
select t.fails($q$select public.join_by_code(null)$q$, 'Codice non valido');
select t.fails($q$select public.join_by_code('abc')$q$, 'Codice non valido');
select t.fails($q$select public.join_by_code('ABCDEF!')$q$, 'Codice non valido');
select t.fails($q$select public.join_by_code('ABCDE0')$q$, 'Codice non valido');
select t.fails($q$select public.join_by_code('ZZZZZZ')$q$, 'Codice non valido');
-- 4. bloccato da un membro: stesso messaggio, nessuna riga
select t.as_user('e9000000-0000-0000-0000-000000000005');
select t.fails(format($q$select public.join_by_code(%L)$q$, current_setting('t.code')), 'Codice non valido');
select t.as_admin();
select t.assert((select count(*) from public.group_members where user_id = 'e9000000-0000-0000-0000-000000000005') = 0, 'E non è in nessun gruppo');
-- 5. rientro dopo essere usciti e ripetizione da membro
update public.group_members set status = 'left' where user_id = 'c9000000-0000-0000-0000-000000000003';
select t.as_user('c9000000-0000-0000-0000-000000000003');
select public.join_by_code(current_setting('t.code'));
select t.assert((select count(*) from public.my_group()) = 1, 'C è rientrato');
select public.join_by_code(current_setting('t.code'));
select t.assert((select member_count from public.my_group()) = 3, 'nessun doppione');
-- 6. invitare un amico dentro l'app
select t.as_user('a9000000-0000-0000-0000-000000000001');
select public.invite_to_group(current_setting('t.g')::uuid, 'b9000000-0000-0000-0000-000000000002');
select t.as_user('b9000000-0000-0000-0000-000000000002');
select t.assert((select count(*) from public.list_group_invites()) = 1, 'B ha un invito');
select t.assert((select inviter_nickname from public.list_group_invites()) = 'anna9', 'da anna9');
select t.assert((select destination from public.list_group_invites()) = 'Lago', 'con la destinazione');
select public.respond_group_invite(current_setting('t.g')::uuid, true);
select t.assert((select group_id from public.my_group()) = current_setting('t.g')::uuid, 'B è membro');
select t.assert((select count(*) from public.list_group_invites()) = 0, 'invito consumato');
-- 7. inviti non possibili
select t.as_user('a9000000-0000-0000-0000-000000000001');
select t.fails(format($q$select public.invite_to_group(%L, %L)$q$, current_setting('t.g'), 'd9000000-0000-0000-0000-000000000004'), 'Invito non possibile');
select t.fails(format($q$select public.invite_to_group(%L, %L)$q$, current_setting('t.g'), 'a9000000-0000-0000-0000-000000000007'), 'Invito non possibile');
select t.fails(format($q$select public.invite_to_group(%L, %L)$q$, current_setting('t.g'), 'b9000000-0000-0000-0000-000000000002'), 'Invito non possibile');
select t.as_user('e9000000-0000-0000-0000-000000000005');
select t.fails(format($q$select public.invite_to_group(%L, %L)$q$, current_setting('t.g'), 'a9000000-0000-0000-0000-000000000008'), 'Invito non possibile');
select t.as_user('a9000000-0000-0000-0000-000000000001');
select t.fails(format($q$select public.invite_to_group(%L, %L)$q$, current_setting('t.g'), 'a9000000-0000-0000-0000-000000000010'), 'Invito non possibile');
-- 8. rifiutare un invito
select t.as_user('a9000000-0000-0000-0000-000000000001');
select public.invite_to_group(current_setting('t.g')::uuid, 'a9000000-0000-0000-0000-000000000008');
select public.invite_to_group(current_setting('t.g')::uuid, 'a9000000-0000-0000-0000-000000000009');
select t.as_user('a9000000-0000-0000-0000-000000000008');
select public.respond_group_invite(current_setting('t.g')::uuid, false);
select t.assert((select count(*) from public.my_group()) = 0, 'H ha rifiutato');
select t.assert((select count(*) from public.list_group_invites()) = 0, 'nessun invito residuo');
select t.fails(format($q$select public.respond_group_invite(%L, true)$q$, current_setting('t.g')), 'Invito non trovato');
-- 9. gruppo concluso: codice e inviti non valgono più
select t.as_user('a9000000-0000-0000-0000-000000000001');
select public.end_ride('a9aaaaaa-0000-0000-0000-0000000000a1');
select t.as_user('a9000000-0000-0000-0000-000000000009');
select t.assert((select count(*) from public.list_group_invites()) = 0, 'invito a un gruppo concluso non compare');
select t.fails(format($q$select public.respond_group_invite(%L, true)$q$, current_setting('t.g')), 'Invito non trovato');
select t.as_user('d9000000-0000-0000-0000-000000000004');
select t.fails(format($q$select public.join_by_code(%L)$q$, current_setting('t.code')), 'Codice non valido');
-- 10. anonimo e scritture dirette
select t.as_anon();
select t.fails($q$select public.join_by_code('ABCDEF')$q$, 'permission denied');
select t.fails($q$select * from public.list_group_invites()$q$, 'permission denied');
select t.as_user('d9000000-0000-0000-0000-000000000004');
select t.fails($q$update public.group_members set status = 'active'$q$, 'permission denied');

select 'TUTTE LE VERIFICHE SONO PASSATE' as esito;
