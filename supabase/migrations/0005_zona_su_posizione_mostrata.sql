-- Correzione di sicurezza: la zona richiesta si confronta con la posizione MOSTRATA (approssimata per i non amici),
-- non con quella vera. Altrimenti, con zone minuscole, un non amico poteva risalire alla posizione esatta.
create or replace function public.riders_in_area(min_lat double precision, min_lng double precision, max_lat double precision, max_lng double precision)
returns table (id uuid, nickname text, avatar text, gender text, lat double precision, lng double precision,
               exact boolean, is_friend boolean, recorded_at timestamptz,
               ride_type text, bike_type text, destination text)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  premium boolean;
  c_lat double precision;
  c_lng double precision;
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  if min_lat is null or min_lng is null or max_lat is null or max_lng is null
     or min_lat = 'NaN' or min_lng = 'NaN' or max_lat = 'NaN' or max_lng = 'NaN'
     or min_lat < -90 or max_lat > 90 or min_lng < -180 or max_lng > 180
     or min_lat > max_lat or min_lng > max_lng then
    raise exception 'Zona non valida';
  end if;
  if max_lat - min_lat > 1 or max_lng - min_lng > 1 then raise exception 'Zona troppo ampia'; end if;
  premium := public.is_premium(me);
  c_lat := (min_lat + max_lat) / 2;
  c_lng := (min_lng + max_lng) / 2;
  return query
  with cand as (
    select p.id as uid, p.nickname as nick, p.avatar as av, p.gender as gen, p.bike_type as bike,
           lp.lat as plat, lp.lng as plng, lp.recorded_at as rec, r.ride_type as rtype, r.destination as dest,
           (r.visibility = 'friends') as friends_only,
           exists (select 1 from public.friendships f where f.status = 'accepted'
                   and ((f.requester = me and f.addressee = p.id) or (f.requester = p.id and f.addressee = me))) as friend
    from public.live_positions lp
    join public.rides r on r.id = lp.ride_id and r.ended_at is null
    join public.profiles p on p.id = lp.user_id
    where lp.user_id <> me
      and lp.recorded_at > now() - interval '2 minutes'
      -- prefiltro largo (una cella in più per lato) per usare l'indice; il confronto vero è sotto, sulla posizione mostrata
      and lp.lat between min_lat - 0.01 and max_lat + 0.01 and lp.lng between min_lng - 0.02 and max_lng + 0.02
      and not exists (select 1 from public.blocks b
                      where (b.blocker = me and b.blocked = p.id) or (b.blocker = p.id and b.blocked = me))
  ), vis as (
    select c.*, (floor(c.plat / 0.0045) * 0.0045 + 0.00225) as clat
    from cand c where c.friend or not c.friends_only
  ), shown as (
    select v.*,
      case when v.friend then v.plat else v.clat end as slat,
      case when v.friend then v.plng
           else (floor(v.plng / (0.0045 / cos(radians(v.clat)))) + 0.5) * (0.0045 / cos(radians(v.clat))) end as slng
    from vis v
  )
  select s.uid, s.nick, s.av, s.gen, s.slat, s.slng, s.friend, s.friend, s.rec,
         case when premium then s.rtype end,
         case when premium then s.bike end,
         case when premium then s.dest end
  from shown s
  where s.slat between min_lat and max_lat and s.slng between min_lng and max_lng
  order by (s.slat - c_lat) ^ 2 + (s.slng - c_lng) ^ 2
  limit 100;
end $$;
