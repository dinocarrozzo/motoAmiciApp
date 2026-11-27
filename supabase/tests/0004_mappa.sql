-- Prove di 0004_mappa.sql. Ordine: supabase_shim, 0001, 0002, 0003, 0004, poi questo file (psql -v ON_ERROR_STOP=1).
-- Usa le funzioni t.* create da 0002_rls.sql, quindi va lanciato dopo di esso (oppure da solo dopo averle create).
create schema if not exists t;
create or replace function t.assert(ok boolean, msg text) returns void language plpgsql as
  $$ begin if not coalesce(ok, false) then raise exception 'VERIFICA FALLITA: %', msg; end if; end $$;
create or replace function t.as_user(u uuid) returns void language plpgsql as
  $$ begin perform set_config('request.jwt.claim.sub', u::text, false); perform set_config('role', 'authenticated', false); end $$;
create or replace function t.as_anon() returns void language plpgsql as
  $$ begin perform set_config('request.jwt.claim.sub', '', false); perform set_config('role', 'anon', false); end $$;
create or replace function t.as_admin() returns void language plpgsql as
  $$ begin perform set_config('request.jwt.claim.sub', '', false); perform set_config('role', 'postgres', false); end $$;
create or replace function t.fails(stmt text, pattern text) returns void language plpgsql as $$
declare m text;
begin
  begin execute stmt; exception when others then m := sqlerrm; end;
  if m is null then raise exception 'VERIFICA FALLITA: doveva fallire: %', stmt; end if;
  if m not ilike '%' || pattern || '%' then raise exception 'VERIFICA FALLITA: errore inatteso (%) per: %', m, stmt; end if;
end $$;
grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

select t.as_admin();
insert into auth.users(id) values
  ('a4000000-0000-0000-0000-000000000001'), ('b4000000-0000-0000-0000-000000000002'),
  ('c4000000-0000-0000-0000-000000000003'), ('d4000000-0000-0000-0000-000000000004');
insert into public.profiles(id, nickname, gender, avatar, bike_type) values
  ('a4000000-0000-0000-0000-000000000001', 'chiara4', 'f', 'moto', 'naked'),
  ('b4000000-0000-0000-0000-000000000002', 'bruno4', 'm', 'lupo', 'custom'),
  ('c4000000-0000-0000-0000-000000000003', 'carla4', 'f', 'volpe', 'enduro'),
  ('d4000000-0000-0000-0000-000000000004', 'dario4', 'x', 'moto', 'maxienduro');
-- A premium, gli altri free
insert into public.entitlements(user_id, premium_until) values ('a4000000-0000-0000-0000-000000000001', now() + interval '10 days');

-- Zona di prova attorno a Milano: lat 45.46, lng 9.19
-- 1. B parte con un giro e manda un punto: A lo vede
select t.as_user('b4000000-0000-0000-0000-000000000002');
select public.start_ride('b0000000-0000-0000-0000-0000000000b1', 'passeggiata-veloce', 'all', 'Lago di Como');
insert into public.track_points(session_id, recorded_at, lat, lng) values
  ('b0000000-0000-0000-0000-0000000000b1', now() - interval '5 seconds', 45.46012, 9.19017);
select t.as_user('a4000000-0000-0000-0000-000000000001');
select t.assert((select count(*) from public.riders_in_area(45.4, 9.1, 45.5, 9.3)) = 1, 'A vede B nella zona');
select t.assert((select count(*) from public.riders_in_area(46.0, 9.1, 46.1, 9.3)) = 0, 'zona senza persone: nessuno');

-- 2. Non amico: posizione approssimata e uguale per chi sta nella stessa cella
select t.assert((select exact from public.riders_in_area(45.4, 9.1, 45.5, 9.3)) = false, 'B non amico: non esatto');
select t.assert((select lat from public.riders_in_area(45.4, 9.1, 45.5, 9.3)) <> 45.46012, 'la latitudine non è quella vera');
select t.assert((select lng from public.riders_in_area(45.4, 9.1, 45.5, 9.3)) <> 9.19017, 'la longitudine non è quella vera');
select t.assert((select abs(lat - 45.46012) from public.riders_in_area(45.4, 9.1, 45.5, 9.3)) < 0.0046, 'ma resta entro una cella');
select t.as_user('c4000000-0000-0000-0000-000000000003');
select public.start_ride('c0000000-0000-0000-0000-0000000000c1', 'enduro', 'all', null);
insert into public.track_points(session_id, recorded_at, lat, lng) values
  ('c0000000-0000-0000-0000-0000000000c1', now() - interval '3 seconds', 45.46030, 9.19040);
select t.as_user('a4000000-0000-0000-0000-000000000001');
select t.assert((select count(distinct (lat, lng)) from public.riders_in_area(45.4, 9.1, 45.5, 9.3)) = 1, 'B e C nella stessa cella hanno le stesse coordinate approssimate');
select t.assert((select count(*) from public.riders_in_area(45.4, 9.1, 45.5, 9.3)) = 2, 'A vede B e C');

-- 3. Dati premium: A premium li vede, D free no
select t.assert((select ride_type from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'bruno4') = 'passeggiata-veloce', 'premium vede il tipo di uscita');
select t.assert((select destination from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'bruno4') = 'Lago di Como', 'premium vede la destinazione');
select t.assert((select bike_type from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'bruno4') = 'custom', 'premium vede la moto');
select t.as_user('d4000000-0000-0000-0000-000000000004');
select t.assert((select count(*) from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where ride_type is null and bike_type is null and destination is null) = 2, 'free: nessun dato del giro');
select t.assert((select count(*) from public.riders_in_area(45.4, 9.1, 45.5, 9.3)) = 2, 'free vede comunque le persone');

-- 4. Amici: posizione esatta, anche per D free (dati del giro restano nascosti)
select t.as_admin();
insert into public.friendships(requester, addressee, status) values ('b4000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000004', 'accepted');
select t.as_user('d4000000-0000-0000-0000-000000000004');
select t.assert((select exact from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'bruno4') = true, 'amico: esatto');
select t.assert((select lat from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'bruno4') = 45.46012, 'amico: coordinate vere');
select t.assert((select is_friend from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'bruno4') = true, 'is_friend vero');
select t.assert((select ride_type from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'bruno4') is null, 'amico free: niente dati del giro');

-- 5. Blocchi nei due sensi
select t.as_admin();
insert into public.blocks(blocker, blocked) values ('d4000000-0000-0000-0000-000000000004', 'c4000000-0000-0000-0000-000000000003');
select t.as_user('d4000000-0000-0000-0000-000000000004');
select t.assert((select count(*) from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'carla4') = 0, 'D ha bloccato C: non la vede');
select t.as_user('c4000000-0000-0000-0000-000000000003');
select t.assert((select count(*) from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'dario4') = 0, 'C bloccata da D: non lo vede');
select t.as_admin();
delete from public.blocks;

-- 6. «Solo amici»: B lo imposta, C (non amica) non lo vede, D (amico) sì
select t.as_user('b4000000-0000-0000-0000-000000000002');
select public.start_ride('b0000000-0000-0000-0000-0000000000b2', 'passeggiata', 'friends', null);
insert into public.track_points(session_id, recorded_at, lat, lng) values
  ('b0000000-0000-0000-0000-0000000000b2', now() - interval '2 seconds', 45.46100, 9.19100);
select t.as_user('c4000000-0000-0000-0000-000000000003');
select t.assert((select count(*) from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'bruno4') = 0, 'solo amici: non amica non lo vede');
select t.as_user('d4000000-0000-0000-0000-000000000004');
select t.assert((select count(*) from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'bruno4') = 1, 'solo amici: amico lo vede');
select t.assert((select count(*) from public.rides where user_id = 'b4000000-0000-0000-0000-000000000002') = 0, 'D non legge i giri altrui');

-- 7. Secondo start_ride chiude il primo; punti del giro chiuso non pubblicano
select t.as_user('b4000000-0000-0000-0000-000000000002');
select t.assert((select count(*) from public.rides where ended_at is null) = 1, 'un solo giro attivo per B');
insert into public.track_points(session_id, recorded_at, lat, lng) values
  ('b0000000-0000-0000-0000-0000000000b1', now() - interval '1 second', 45.40000, 9.10000);
select t.as_admin();
select t.assert((select lat from public.live_positions where user_id = 'b4000000-0000-0000-0000-000000000002') = 45.46100, 'punto di un giro chiuso non sposta la posizione');

-- 8. Punto fuori ordine (più vecchio) non sovrascrive
select t.as_user('b4000000-0000-0000-0000-000000000002');
insert into public.track_points(session_id, recorded_at, lat, lng) values
  ('b0000000-0000-0000-0000-0000000000b2', now() - interval '60 seconds', 45.40500, 9.10500);
select t.as_admin();
select t.assert((select lat from public.live_positions where user_id = 'b4000000-0000-0000-0000-000000000002') = 45.46100, 'un punto vecchio arrivato dopo non sovrascrive');

-- 9. Senza giro attivo non si pubblica
select t.as_user('c4000000-0000-0000-0000-000000000003');
insert into public.track_points(session_id, recorded_at, lat, lng) values
  ('99999999-0000-0000-0000-000000000009', now(), 45.46, 9.19);
select t.as_admin();
select t.assert((select lat from public.live_positions where user_id = 'c4000000-0000-0000-0000-000000000003') = 45.46030, 'senza giro (altra sessione) nessun aggiornamento');

-- 10. Posizione vecchia (oltre 2 minuti) non compare; end_ride fa sparire
select t.as_admin();
update public.live_positions set recorded_at = now() - interval '3 minutes' where user_id = 'c4000000-0000-0000-0000-000000000003';
select t.as_user('a4000000-0000-0000-0000-000000000001');
select t.assert((select count(*) from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'carla4') = 0, 'oltre 2 minuti: sparisce');
select t.as_user('b4000000-0000-0000-0000-000000000002');
select public.end_ride('b0000000-0000-0000-0000-0000000000b2');
select t.as_user('a4000000-0000-0000-0000-000000000001');
select t.assert((select count(*) from public.riders_in_area(45.4, 9.1, 45.5, 9.3) where nickname = 'bruno4') = 0, 'dopo Ferma: sparisce');
select t.assert((select count(*) from public.riders_in_area(45.4, 9.1, 45.5, 9.3)) = 0, 'zona vuota');

-- 11. Zone non valide
select t.fails($q$select * from public.riders_in_area(46, 9, 45, 10)$q$, 'Zona non valida');
select t.fails($q$select * from public.riders_in_area(45, 10, 46, 9)$q$, 'Zona non valida');
select t.fails($q$select * from public.riders_in_area(95, 9, 96, 10)$q$, 'Zona non valida');
select t.fails($q$select * from public.riders_in_area(45, 190, 46, 191)$q$, 'Zona non valida');
select t.fails($q$select * from public.riders_in_area(null, 9, 46, 10)$q$, 'Zona non valida');
select t.fails($q$select * from public.riders_in_area('NaN'::float8, 9, 46, 10)$q$, 'Zona non valida');
select t.fails($q$select * from public.riders_in_area(44, 8, 46, 9.5)$q$, 'Zona troppo ampia');
select t.fails($q$select * from public.riders_in_area(45, 7, 45.5, 9)$q$, 'Zona troppo ampia');

-- 12. start_ride: valori non ammessi
select t.fails($q$select public.start_ride('e0000000-0000-0000-0000-0000000000e1', 'moto-gp', 'all', null)$q$, 'Tipo di uscita non valido');
select t.fails($q$select public.start_ride('e0000000-0000-0000-0000-0000000000e2', 'enduro', 'tutti', null)$q$, 'Visibilità non valida');
select t.fails($q$select public.start_ride('e0000000-0000-0000-0000-0000000000e3', 'enduro', 'all', repeat('a', 81))$q$, 'Destinazione troppo lunga');
-- l'id di un giro altrui non si può riusare
select t.as_user('c4000000-0000-0000-0000-000000000003');
select t.fails($q$select public.start_ride('b0000000-0000-0000-0000-0000000000b1', 'enduro', 'all', null)$q$, 'Giro non valido');

-- 13. Scritture dirette vietate
select t.as_user('a4000000-0000-0000-0000-000000000001');
select t.fails($q$insert into public.live_positions(user_id, ride_id, lat, lng, recorded_at) values ('a4000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000b1', 45, 9, now())$q$, 'permission denied');
select t.fails($q$insert into public.entitlements(user_id, premium_until) values ('d4000000-0000-0000-0000-000000000004', now() + interval '1 year')$q$, 'permission denied');
select t.fails($q$update public.entitlements set premium_until = now() + interval '5 years'$q$, 'permission denied');
select t.fails($q$insert into public.rides(id, ride_type, visibility) values ('f0000000-0000-0000-0000-0000000000f1', 'enduro', 'all')$q$, 'permission denied');
select t.assert((select count(*) from public.entitlements) = 1, 'A legge solo il proprio premium');
select t.as_user('d4000000-0000-0000-0000-000000000004');
select t.assert((select count(*) from public.entitlements) = 0, 'D free non vede premium altrui');

-- 14. Anonimo e non autenticato
select t.as_anon();
select t.fails($q$select * from public.riders_in_area(45.4, 9.1, 45.5, 9.3)$q$, 'permission denied');
select t.fails($q$select public.start_ride('e0000000-0000-0000-0000-0000000000e9', 'enduro', 'all', null)$q$, 'permission denied');

-- 15. Al massimo 100 righe, le più vicine al centro
select t.as_admin();
insert into auth.users(id) select ('77000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid from generate_series(1, 101) g;
insert into public.profiles(id, nickname) select ('77000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'folla' || g from generate_series(1, 101) g;
insert into public.rides(id, user_id, ride_type, visibility)
  select ('78000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, ('77000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'enduro', 'all' from generate_series(1, 101) g;
insert into public.live_positions(user_id, ride_id, lat, lng, recorded_at)
  select ('77000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, ('78000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
         45.0 + g * 0.002, 9.0, now() from generate_series(1, 101) g;
select t.as_user('a4000000-0000-0000-0000-000000000001');
select t.assert((select count(*) from public.riders_in_area(45.0, 8.9, 45.3, 9.1)) = 100, 'massimo 100 righe');
select t.assert((select count(*) from public.riders_in_area(45.0, 8.9, 45.3, 9.1) where nickname = 'folla1') = 0, 'esclusa la più lontana dal centro (folla1 è la più a sud)');

select 'TUTTE LE VERIFICHE SONO PASSATE' as esito;
