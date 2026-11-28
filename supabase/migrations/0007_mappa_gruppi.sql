-- Mappa con i gruppi: group_id e numero partecipanti sulle icone, elenco partecipanti a parte.

-- Il chiamante può "vedere" il gruppo? Un membro con giro in corso e posizione recente gli è visibile
-- (visibilità «Tutti», o «Solo amici» e amicizia accettata) e non c'è blocco con alcun membro attivo.
create function public.can_see_group(p_viewer uuid, p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
      select 1
      from public.ride_groups g
      join public.group_members m on m.group_id = g.id and m.status = 'active'
      join public.rides r on r.group_id = g.id and r.user_id = m.user_id and r.ended_at is null
      join public.live_positions lp on lp.ride_id = r.id and lp.recorded_at > now() - interval '2 minutes'
      where g.id = p_group and g.ended_at is null
        and (r.visibility = 'all' or exists (
              select 1 from public.friendships f where f.status = 'accepted'
                and ((f.requester = p_viewer and f.addressee = m.user_id) or (f.requester = m.user_id and f.addressee = p_viewer))))
    )
    and not exists (
      select 1
      from public.group_members m2
      join public.blocks b on (b.blocker = p_viewer and b.blocked = m2.user_id) or (b.blocker = m2.user_id and b.blocked = p_viewer)
      where m2.group_id = p_group and m2.status = 'active'
    );
$$;
revoke execute on function public.can_see_group(uuid, uuid) from public, anon, authenticated;

create function public.group_participants(p_group_id uuid)
returns table (id uuid, nickname text, avatar text, gender text, role text, riding boolean)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  if not (public.is_group_member(me, p_group_id)
          or (public.is_premium(me) and public.can_see_group(me, p_group_id))) then
    raise exception 'Elenco non disponibile';
  end if;
  return query
    select p.id, p.nickname, p.avatar, p.gender, m.role,
           exists (select 1 from public.rides r where r.group_id = m.group_id and r.user_id = m.user_id and r.ended_at is null)
    from public.group_members m
    join public.profiles p on p.id = m.user_id
    join public.ride_groups g on g.id = m.group_id and g.ended_at is null
    where m.group_id = p_group_id and m.status = 'active'
    order by m.joined_at, p.nickname
    limit 500;
end $$;

drop function public.riders_in_area(double precision, double precision, double precision, double precision);
create function public.riders_in_area(min_lat double precision, min_lng double precision, max_lat double precision, max_lng double precision)
returns table (id uuid, nickname text, avatar text, gender text, lat double precision, lng double precision,
               exact boolean, is_friend boolean, recorded_at timestamptz,
               ride_type text, bike_type text, destination text, group_id uuid, member_count integer)
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
           r.group_id as gid,
           (r.visibility = 'friends') as friends_only,
           exists (select 1 from public.friendships f where f.status = 'accepted'
                   and ((f.requester = me and f.addressee = p.id) or (f.requester = p.id and f.addressee = me))) as friend,
           (r.group_id is not null and public.is_group_member(me, r.group_id)) as mate
    from public.live_positions lp
    join public.rides r on r.id = lp.ride_id and r.ended_at is null
    join public.profiles p on p.id = lp.user_id
    where lp.user_id <> me
      and lp.recorded_at > now() - interval '2 minutes'
      and lp.lat between min_lat - 0.01 and max_lat + 0.01 and lp.lng between min_lng - 0.02 and max_lng + 0.02
      and not exists (select 1 from public.blocks b
                      where (b.blocker = me and b.blocked = p.id) or (b.blocker = p.id and b.blocked = me))
  ), vis as (
    select c.*, (floor(c.plat / 0.0045) * 0.0045 + 0.00225) as clat
    from cand c where c.friend or c.mate or not c.friends_only
  ), shown as (
    select v.*,
      case when v.friend or v.mate then v.plat else v.clat end as slat,
      case when v.friend or v.mate then v.plng
           else (floor(v.plng / (0.0045 / cos(radians(v.clat)))) + 0.5) * (0.0045 / cos(radians(v.clat))) end as slng
    from vis v
  )
  select s.uid, s.nick, s.av, s.gen, s.slat, s.slng, (s.friend or s.mate), s.friend, s.rec,
         case when premium or s.mate then s.rtype end,
         case when premium or s.mate then s.bike end,
         case when premium or s.mate then s.dest end,
         s.gid,
         case when s.gid is not null and (premium or s.mate)
              then (select count(*)::int from public.group_members x where x.group_id = s.gid and x.status = 'active') end
  from shown s
  where s.slat between min_lat and max_lat and s.slng between min_lng and max_lng
  order by (s.slat - c_lat) ^ 2 + (s.slng - c_lng) ^ 2
  limit 100;
end $$;

revoke execute on function public.group_participants(uuid) from public, anon;
revoke execute on function public.riders_in_area(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.group_participants(uuid) to authenticated;
grant execute on function public.riders_in_area(double precision, double precision, double precision, double precision) to authenticated;
