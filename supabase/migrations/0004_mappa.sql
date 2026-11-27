-- Mappa in tempo reale: giri, posizione attuale, premium e ricerca nella zona.
-- Le regole di visibilità (approssimazione, blocchi, dati premium) stanno qui, nel database.

create table public.rides (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ride_type   text not null check (ride_type in ('passeggiata', 'passeggiata-veloce', 'enduro')),
  visibility  text not null default 'all' check (visibility in ('all', 'friends')),
  destination text check (destination is null or char_length(destination) <= 80),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create index rides_user_active_idx on public.rides (user_id) where ended_at is null;

create table public.live_positions (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  ride_id     uuid not null references public.rides (id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  speed       real,
  recorded_at timestamptz not null
);
create index live_positions_area_idx on public.live_positions (lat, lng);

create table public.entitlements (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  premium_until timestamptz
);

alter table public.rides enable row level security;
alter table public.live_positions enable row level security;
alter table public.entitlements enable row level security;

create policy "i tuoi giri" on public.rides for select to authenticated using (user_id = auth.uid());
create policy "il tuo premium" on public.entitlements for select to authenticated using (user_id = auth.uid());
-- live_positions: nessuna policy, nessuno la legge direttamente (si passa da riders_in_area).

-- Nessuna scrittura diretta: si passa dalle funzioni.
revoke insert, update, delete, truncate on public.rides, public.live_positions, public.entitlements from anon, authenticated;
revoke all on public.live_positions from anon, authenticated;
revoke all on public.rides, public.entitlements from anon;

create function public.is_premium(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select premium_until > now() from public.entitlements where user_id = p_user), false);
$$;
revoke execute on function public.is_premium(uuid) from public, anon, authenticated;

create function public.start_ride(p_ride_id uuid, p_ride_type text, p_visibility text, p_destination text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  dest text := nullif(btrim(coalesce(p_destination, '')), '');
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  if p_ride_type is null or p_ride_type not in ('passeggiata', 'passeggiata-veloce', 'enduro') then
    raise exception 'Tipo di uscita non valido'; end if;
  if p_visibility is null or p_visibility not in ('all', 'friends') then
    raise exception 'Visibilità non valida'; end if;
  if dest is not null and char_length(dest) > 80 then raise exception 'Destinazione troppo lunga'; end if;
  if p_ride_id is null then raise exception 'Giro non valido'; end if;
  -- Riprova dello stesso avvio: si aggiornano i dati. Id di altri o giri già chiusi: no.
  if exists (select 1 from public.rides where id = p_ride_id and (user_id <> me or ended_at is not null)) then
    raise exception 'Giro non valido'; end if;
  -- Un solo giro attivo per persona.
  update public.rides set ended_at = now() where user_id = me and ended_at is null and id <> p_ride_id;
  delete from public.live_positions where user_id = me and ride_id <> p_ride_id;
  insert into public.rides (id, user_id, ride_type, visibility, destination)
    values (p_ride_id, me, p_ride_type, p_visibility, dest)
  on conflict (id) do update set ride_type = excluded.ride_type, visibility = excluded.visibility, destination = excluded.destination;
end $$;

create function public.end_ride(p_ride_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  update public.rides set ended_at = now() where id = p_ride_id and user_id = me and ended_at is null;
  delete from public.live_positions where user_id = me and ride_id = p_ride_id;
end $$;

-- Ogni punto caricato aggiorna la posizione attuale, solo con un giro attivo e solo se più recente.
create function public.publish_live_position() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.rides r where r.id = new.session_id and r.user_id = new.user_id and r.ended_at is null) then
    insert into public.live_positions as lp (user_id, ride_id, lat, lng, speed, recorded_at)
      values (new.user_id, new.session_id, new.lat, new.lng, new.speed, new.recorded_at)
    on conflict (user_id) do update
      set ride_id = excluded.ride_id, lat = excluded.lat, lng = excluded.lng, speed = excluded.speed, recorded_at = excluded.recorded_at
      where excluded.recorded_at > lp.recorded_at or lp.ride_id <> excluded.ride_id;
  end if;
  return new;
end $$;
revoke execute on function public.publish_live_position() from public, anon, authenticated;

create trigger track_points_publish after insert on public.track_points
  for each row execute function public.publish_live_position();

create function public.riders_in_area(min_lat double precision, min_lng double precision, max_lat double precision, max_lng double precision)
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
      and lp.lat between min_lat and max_lat and lp.lng between min_lng and max_lng
      and not exists (select 1 from public.blocks b
                      where (b.blocker = me and b.blocked = p.id) or (b.blocker = p.id and b.blocked = me))
  ), vis as (
    select * from cand where friend or not friends_only
  ), cells as (
    select v.*,
      (floor(v.plat / 0.0045) * 0.0045 + 0.00225) as clat
    from vis v
  )
  select c.uid, c.nick, c.av, c.gen,
         case when c.friend then c.plat else c.clat end,
         case when c.friend then c.plng
              else (floor(c.plng / (0.0045 / cos(radians(c.clat)))) + 0.5) * (0.0045 / cos(radians(c.clat))) end,
         c.friend, c.friend, c.rec,
         case when premium then c.rtype end,
         case when premium then c.bike end,
         case when premium then c.dest end
  from cells c
  order by (c.plat - c_lat) ^ 2 + (c.plng - c_lng) ^ 2
  limit 100;
end $$;

revoke execute on function public.start_ride(uuid, text, text, text) from public, anon;
revoke execute on function public.end_ride(uuid) from public, anon;
revoke execute on function public.riders_in_area(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.start_ride(uuid, text, text, text) to authenticated;
grant execute on function public.end_ride(uuid) to authenticated;
grant execute on function public.riders_in_area(double precision, double precision, double precision, double precision) to authenticated;
