-- Prove di 0007_mappa_gruppi.sql. Ordine: shim, 0001..0007, helpers, questo file.
select t.as_admin();
insert into auth.users(id) values
  ('a7000000-0000-0000-0000-000000000001'), ('b7000000-0000-0000-0000-000000000002'),
  ('c7000000-0000-0000-0000-000000000003'), ('f7000000-0000-0000-0000-000000000006');
insert into public.profiles(id, nickname, gender, avatar) values
  ('a7000000-0000-0000-0000-000000000001', 'anna7', 'f', 'moto'),
  ('b7000000-0000-0000-0000-000000000002', 'bruno7', 'm', 'lupo'),
  ('c7000000-0000-0000-0000-000000000003', 'carlo7', 'm', 'volpe'),
  ('f7000000-0000-0000-0000-000000000006', 'franco7', 'm', 'moto');
insert into public.entitlements(user_id, premium_until) values ('a7000000-0000-0000-0000-000000000001', now() + interval '10 days');

-- B crea il gruppo, C entra e parte: due giri nello stesso gruppo, vicini
select t.as_user('b7000000-0000-0000-0000-000000000002');
select public.start_ride('b7bbbbbb-0000-0000-0000-0000000000b1', 'passeggiata-veloce', 'all', 'Lago');
insert into public.track_points(session_id, recorded_at, lat, lng) values ('b7bbbbbb-0000-0000-0000-0000000000b1', now() - interval '5 seconds', 45.46012, 9.19017);
select t.as_admin();
select set_config('t.g', (select group_id::text from public.rides where id = 'b7bbbbbb-0000-0000-0000-0000000000b1'), false);
insert into public.group_members(group_id, user_id, role, status) values (current_setting('t.g')::uuid, 'c7000000-0000-0000-0000-000000000003', 'member', 'active');
select t.as_user('c7000000-0000-0000-0000-000000000003');
select public.start_ride('c7ccccc0-0000-0000-0000-0000000000c1', null, 'all', null, current_setting('t.g')::uuid);
insert into public.track_points(session_id, recorded_at, lat, lng) values ('c7ccccc0-0000-0000-0000-0000000000c1', now() - interval '3 seconds', 45.46030, 9.19040);

-- 1. Un free (F) vede le icone con il gruppo ma nessun dato
select t.as_user('f7000000-0000-0000-0000-000000000006');
select t.assert((select count(*) from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where group_id = current_setting('t.g')::uuid) = 2, 'F vede le due icone con lo stesso group_id');
select t.assert((select count(*) from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where member_count is null and ride_type is null and destination is null) = 2, 'F: niente conteggio né dati del giro');
select t.assert((select bool_and(not exact) from public.riders_in_area(45.4, 9.1, 45.5, 9.3)), 'F: posizioni approssimate');
-- 2. Sondaggio con zona minuscola: invariato
select t.assert((select count(*) from public.riders_in_area(45.4601, 9.1901, 45.4602, 9.1902)) = 0, 'zona minuscola: F non trova B');

-- 3. Premium A: dati e conteggio
select t.as_user('a7000000-0000-0000-0000-000000000001');
select t.assert((select min(member_count) from public.riders_in_area(45.4, 9.1, 45.5, 9.3)) = 2, 'A premium vede il numero dei partecipanti');
select t.assert((select count(*) from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where destination = 'Lago' and ride_type = 'passeggiata-veloce') = 2, 'A premium vede tipo e destinazione');

-- 4. Membri dello stesso gruppo: esatti, anche senza essere amici, e dati visibili
select t.as_user('b7000000-0000-0000-0000-000000000002');
select t.assert((select exact from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'carlo7') = true, 'B vede C esatto');
select t.assert((select lat from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'carlo7') = 45.46030, 'coordinate vere');
select t.assert((select destination from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'carlo7') = 'Lago', 'B (free ma membro) vede i dati');

-- 5. Elenco partecipanti
select t.as_user('f7000000-0000-0000-0000-000000000006');
select t.fails(format($q$select * from public.group_participants(%L)$q$, current_setting('t.g')), 'Elenco non disponibile');
select t.as_user('a7000000-0000-0000-0000-000000000001');
select t.assert((select count(*) from public.group_participants(current_setting('t.g')::uuid)) = 2, 'A premium vede 2 partecipanti');
select t.assert((select string_agg(nickname, ',' order by joined) from (select nickname, row_number() over () joined from public.group_participants(current_setting('t.g')::uuid)) x) = 'bruno7,carlo7', 'ordine di ingresso');
select t.assert((select role from public.group_participants(current_setting('t.g')::uuid) where nickname = 'bruno7') = 'owner', 'B è il creatore');
select t.as_user('b7000000-0000-0000-0000-000000000002');
select t.assert((select count(*) from public.group_participants(current_setting('t.g')::uuid)) = 2, 'B membro free vede 2 partecipanti');

-- 6. Blocco tra A e C: A non vede C, e l'elenco gli è negato
select t.as_admin();
insert into public.blocks(blocker, blocked) values ('a7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000003');
select t.as_user('a7000000-0000-0000-0000-000000000001');
select t.assert((select count(*) from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'carlo7') = 0, 'A non vede C');
select t.fails(format($q$select * from public.group_participants(%L)$q$, current_setting('t.g')), 'Elenco non disponibile');
select t.as_admin();
delete from public.blocks;

-- 7. Gruppo concluso: elenco negato
select t.as_user('b7000000-0000-0000-0000-000000000002');
select public.end_ride('b7bbbbbb-0000-0000-0000-0000000000b1');
select t.as_user('c7000000-0000-0000-0000-000000000003');
select public.end_ride('c7ccccc0-0000-0000-0000-0000000000c1');
select t.as_user('a7000000-0000-0000-0000-000000000001');
select t.fails(format($q$select * from public.group_participants(%L)$q$, current_setting('t.g')), 'Elenco non disponibile');

-- 8. Anonimo
select t.as_anon();
select t.fails($q$select * from public.riders_in_area(45.4, 9.1, 45.5, 9.3)$q$, 'permission denied');
select t.fails(format($q$select * from public.group_participants(%L)$q$, current_setting('t.g')), 'permission denied');

select 'TUTTE LE VERIFICHE SONO PASSATE' as esito;
