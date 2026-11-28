-- Prove di 0006_gruppi.sql. Ordine: supabase_shim, 0001..0006, helpers, questo file.
select t.as_admin();
insert into auth.users(id) values
  ('a6000000-0000-0000-0000-000000000001'), ('b6000000-0000-0000-0000-000000000002'), ('c6000000-0000-0000-0000-000000000003');
insert into public.profiles(id, nickname, gender, avatar) values
  ('a6000000-0000-0000-0000-000000000001', 'anna6', 'f', 'moto'),
  ('b6000000-0000-0000-0000-000000000002', 'bruno6', 'm', 'lupo'),
  ('c6000000-0000-0000-0000-000000000003', 'carlo6', 'm', 'volpe');

-- 1. Senza gruppo: se ne crea uno di cui A è creatore
select t.as_user('a6000000-0000-0000-0000-000000000001');
select public.start_ride('a6aaaaaa-0000-0000-0000-0000000000a1', 'passeggiata', 'all', 'Lago');
select t.assert((select count(*) from public.my_group()) = 1, 'A ha un gruppo');
select t.assert((select role from public.my_group()) = 'owner', 'A è il creatore');
select t.assert((select member_count from public.my_group()) = 1, 'un solo membro');
select t.assert((select invite_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$' from public.my_group()), 'codice di 6 caratteri ammessi');
select t.assert((select ride_id from public.my_group()) = 'a6aaaaaa-0000-0000-0000-0000000000a1', 'il giro è quello avviato');
select t.assert((select destination from public.my_group()) = 'Lago', 'destinazione del gruppo');

-- 2. Ripetere lo stesso avvio non crea un secondo gruppo
select t.assert(public.start_ride('a6aaaaaa-0000-0000-0000-0000000000a1', 'passeggiata', 'all', 'Lago') = (select group_id from public.my_group()), 'avvio ripetuto: stesso gruppo');
select t.as_admin();
select t.assert((select count(*) from public.ride_groups where owner_id = 'a6000000-0000-0000-0000-000000000001') = 1, 'un solo gruppo per A');

-- 3. Secondo giro: chiude il primo e il suo gruppo
select t.as_user('a6000000-0000-0000-0000-000000000001');
select public.start_ride('a6aaaaaa-0000-0000-0000-0000000000a2', 'enduro', 'all', null);
select t.as_admin();
select t.assert((select count(*) from public.ride_groups where owner_id = 'a6000000-0000-0000-0000-000000000001' and ended_at is not null) = 1, 'il vecchio gruppo è chiuso');
select t.assert((select count(*) from public.rides where user_id = 'a6000000-0000-0000-0000-000000000001' and ended_at is null) = 1, 'un solo giro attivo');

-- 4. Entrare in un gruppo: da non membro non si può
select t.as_admin();
select set_config('t.g1', (select group_id::text from public.rides where id = 'a6aaaaaa-0000-0000-0000-0000000000a2'), false);
select t.as_user('b6000000-0000-0000-0000-000000000002');
select t.fails($q$select public.start_ride('b6bbbbbb-0000-0000-0000-0000000000b1', null, 'all', null, current_setting('t.g1')::uuid)$q$, 'Gruppo non valido');

-- 5. Da membro sì, ed eredita tipo e destinazione
select t.as_admin();
insert into public.group_members(group_id, user_id, role, status)
  select group_id, 'b6000000-0000-0000-0000-000000000002', 'member', 'active' from public.rides where id = 'a6aaaaaa-0000-0000-0000-0000000000a2';
select t.as_user('b6000000-0000-0000-0000-000000000002');
select public.start_ride('b6bbbbbb-0000-0000-0000-0000000000b1', null, 'friends', null, (select group_id from public.my_group()));
select t.as_admin();
select t.assert((select ride_type from public.rides where id = 'b6bbbbbb-0000-0000-0000-0000000000b1') = 'enduro', 'B eredita il tipo di uscita');
select t.assert((select visibility from public.rides where id = 'b6bbbbbb-0000-0000-0000-0000000000b1') = 'friends', 'la visibilità resta di B');

-- 6. Il creatore esce: il ruolo passa a B, il gruppo resta
select t.as_user('a6000000-0000-0000-0000-000000000001');
select public.end_ride('a6aaaaaa-0000-0000-0000-0000000000a2');
select t.as_user('b6000000-0000-0000-0000-000000000002');
select t.assert((select role from public.my_group()) = 'owner', 'il ruolo passa a B');
select t.assert((select member_count from public.my_group()) = 1, 'resta B');
select t.as_user('a6000000-0000-0000-0000-000000000001');
select t.assert((select count(*) from public.my_group()) = 0, 'A non è più nel gruppo');

-- 7. L'ultimo esce: il gruppo si chiude e la posizione sparisce
select t.as_user('b6000000-0000-0000-0000-000000000002');
select public.end_ride('b6bbbbbb-0000-0000-0000-0000000000b1');
select t.assert((select count(*) from public.my_group()) = 0, 'gruppo concluso');
select t.as_admin();
select t.assert((select count(*) from public.live_positions where user_id in ('a6000000-0000-0000-0000-000000000001', 'b6000000-0000-0000-0000-000000000002')) = 0, 'nessuna posizione residua');
select t.assert((select count(*) from public.ride_groups where ended_at is null and owner_id in ('a6000000-0000-0000-0000-000000000001', 'b6000000-0000-0000-0000-000000000002')) = 0, 'nessun gruppo attivo');

-- 8. Un gruppo concluso non si può più usare
select t.as_admin();
select set_config('t.g1', (select group_id::text from public.rides where id = 'b6bbbbbb-0000-0000-0000-0000000000b1'), false);
insert into public.group_members(group_id, user_id, role, status)
  select group_id, 'c6000000-0000-0000-0000-000000000003', 'member', 'active' from public.rides where id = 'b6bbbbbb-0000-0000-0000-0000000000b1';
select t.as_user('c6000000-0000-0000-0000-000000000003');
select t.fails($q$select public.start_ride('c6ccccc0-0000-0000-0000-0000000000c1', null, 'all', null, current_setting('t.g1')::uuid)$q$, 'Gruppo non valido');

-- 9. I codici sono univoci
select t.as_admin();
insert into public.ride_groups(owner_id, ride_type, invite_code)
  select 'c6000000-0000-0000-0000-000000000003', 'enduro', public.gen_invite_code() from generate_series(1, 50);
select t.assert((select count(distinct invite_code) from public.ride_groups) >= 50, 'codici distinti');

-- 10. Scritture dirette vietate
select t.as_user('a6000000-0000-0000-0000-000000000001');
select t.fails($q$insert into public.ride_groups(owner_id, ride_type, invite_code) values ('a6000000-0000-0000-0000-000000000001', 'enduro', 'ZZZZZZ')$q$, 'permission denied');
select t.fails($q$insert into public.group_members(group_id, user_id, status) select id, 'a6000000-0000-0000-0000-000000000001', 'active' from public.ride_groups limit 1$q$, 'permission denied');
select t.fails($q$update public.group_members set role = 'owner'$q$, 'permission denied');

-- 11. Validazioni del vecchio avvio ancora valide
select t.fails($q$select public.start_ride('e6000000-0000-0000-0000-0000000000e1', 'moto-gp', 'all', null)$q$, 'Tipo di uscita non valido');
select t.fails($q$select public.start_ride('e6000000-0000-0000-0000-0000000000e2', 'enduro', 'tutti', null)$q$, 'Visibilità non valida');
select t.fails($q$select public.start_ride('e6000000-0000-0000-0000-0000000000e3', 'enduro', 'all', repeat('a', 81))$q$, 'Destinazione troppo lunga');

-- 12. Anonimo
select t.as_anon();
select t.fails($q$select * from public.my_group()$q$, 'permission denied');

select 'TUTTE LE VERIFICHE SONO PASSATE' as esito;
