-- Richieste di unirsi a un gruppo. Le regole (visibilità, blocchi, prima risposta, attesa dopo un rifiuto) stanno qui.

create table public.join_requests (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.ride_groups (id) on delete cascade,
  requester_id uuid not null references auth.users (id) on delete cascade,
  message      text check (message is null or char_length(message) <= 140),
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  answered_by  uuid references auth.users (id) on delete set null,
  answered_at  timestamptz,
  meet_lat     double precision check (meet_lat is null or meet_lat between -90 and 90),
  meet_lng     double precision check (meet_lng is null or meet_lng between -180 and 180),
  meet_note    text check (meet_note is null or char_length(meet_note) <= 140),
  created_at   timestamptz not null default now()
);
create unique index join_requests_one_pending_idx on public.join_requests (group_id, requester_id) where status = 'pending';
create index join_requests_requester_idx on public.join_requests (requester_id, created_at desc);

alter table public.join_requests enable row level security;
-- Nessuna policy e nessun permesso diretto: si passa dalle funzioni.
revoke all on public.join_requests from anon, authenticated;

create function public.request_join(p_group_id uuid, p_message text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  msg text := nullif(btrim(coalesce(p_message, '')), '');
  last_decline timestamptz;
  new_id uuid;
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  if msg is not null and char_length(msg) > 140 then raise exception 'Messaggio troppo lungo'; end if;
  if public.is_group_member(me, p_group_id) then raise exception 'Sei già nel gruppo'; end if;
  if not public.can_see_group(me, p_group_id) then raise exception 'Gruppo non trovato'; end if;
  if exists (select 1 from public.join_requests where group_id = p_group_id and requester_id = me and status = 'pending') then
    raise exception 'Richiesta già inviata'; end if;
  select max(answered_at) into last_decline from public.join_requests
    where group_id = p_group_id and requester_id = me and status = 'declined';
  if last_decline is not null and last_decline > now() - interval '1 hour' then
    raise exception 'Potrai riprovare tra % minuti', ceil(extract(epoch from (last_decline + interval '1 hour' - now())) / 60)::int;
  end if;
  begin
    insert into public.join_requests (group_id, requester_id, message) values (p_group_id, me, msg) returning id into new_id;
  exception when unique_violation then
    raise exception 'Richiesta già inviata';
  end;
  return new_id;
end $$;

create function public.cancel_join_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  update public.join_requests set status = 'cancelled', answered_at = now()
    where id = p_request_id and requester_id = me and status = 'pending';
  if not found then raise exception 'Richiesta non trovata'; end if;
end $$;

create function public.respond_join_request(p_request_id uuid, p_accept boolean, p_meet_lat double precision, p_meet_lng double precision, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  req public.join_requests%rowtype;
  note text := nullif(btrim(coalesce(p_note, '')), '');
  lat double precision := p_meet_lat;
  lng double precision := p_meet_lng;
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  select * into req from public.join_requests where id = p_request_id;
  if not found or not public.is_group_member(me, req.group_id) then raise exception 'Richiesta non trovata'; end if;
  if (lat is null) <> (lng is null)
     or lat = 'NaN' or lng = 'NaN'
     or lat < -90 or lat > 90 or lng < -180 or lng > 180 then
    raise exception 'Coordinate non valide'; end if;
  if note is not null and char_length(note) > 140 then raise exception 'Nota troppo lunga'; end if;
  if not p_accept then lat := null; lng := null; note := null; end if;
  if p_accept and exists (
      select 1 from public.group_members m
      join public.blocks b on (b.blocker = req.requester_id and b.blocked = m.user_id) or (b.blocker = m.user_id and b.blocked = req.requester_id)
      where m.group_id = req.group_id and m.status = 'active') then
    raise exception 'Richiesta non valida'; end if;
  -- La prima risposta vince: l'aggiornamento riesce solo se la richiesta è ancora in attesa.
  update public.join_requests
    set status = case when p_accept then 'accepted' else 'declined' end,
        answered_by = me, answered_at = now(), meet_lat = lat, meet_lng = lng, meet_note = note
    where id = p_request_id and status = 'pending';
  if not found then raise exception 'Richiesta già gestita'; end if;
  if p_accept then
    insert into public.group_members (group_id, user_id, role, status) values (req.group_id, req.requester_id, 'member', 'active')
    on conflict (group_id, user_id) do update set status = 'active', joined_at = now();
  end if;
end $$;

create function public.list_incoming_requests()
returns table (request_id uuid, group_id uuid, requester_id uuid, nickname text, avatar text, gender text, message text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  return query
    select jr.id, jr.group_id, jr.requester_id, p.nickname, p.avatar, p.gender, jr.message, jr.created_at
    from public.join_requests jr
    join public.profiles p on p.id = jr.requester_id
    join public.ride_groups g on g.id = jr.group_id and g.ended_at is null
    where jr.status = 'pending'
      and public.is_group_member(me, jr.group_id)
      and not exists (select 1 from public.blocks b where (b.blocker = me and b.blocked = jr.requester_id) or (b.blocker = jr.requester_id and b.blocked = me))
    order by jr.created_at;
end $$;

create function public.list_my_requests()
returns table (request_id uuid, group_id uuid, status text, meet_lat double precision, meet_lng double precision, meet_note text, answered_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  return query
    select jr.id, jr.group_id, jr.status, jr.meet_lat, jr.meet_lng, jr.meet_note, jr.answered_at, jr.created_at
    from public.join_requests jr
    where jr.requester_id = me and jr.created_at > now() - interval '24 hours'
    order by jr.created_at desc;
end $$;

-- Pulizia: richieste di gruppi conclusi da più di 24 ore (punti d'incontro e note compresi).
create function public.purge_old_requests() returns void
language sql security definer set search_path = public as $$
  delete from public.join_requests jr using public.ride_groups g
  where g.id = jr.group_id and g.ended_at < now() - interval '24 hours';
$$;
revoke execute on function public.purge_old_requests() from public, anon, authenticated;

create or replace function public.end_ride(p_ride_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  perform public.finish_ride(me, p_ride_id);
  perform public.purge_old_requests();
end $$;

revoke execute on function public.request_join(uuid, text) from public, anon;
revoke execute on function public.cancel_join_request(uuid) from public, anon;
revoke execute on function public.respond_join_request(uuid, boolean, double precision, double precision, text) from public, anon;
revoke execute on function public.list_incoming_requests() from public, anon;
revoke execute on function public.list_my_requests() from public, anon;
grant execute on function public.request_join(uuid, text) to authenticated;
grant execute on function public.cancel_join_request(uuid) to authenticated;
grant execute on function public.respond_join_request(uuid, boolean, double precision, double precision, text) to authenticated;
grant execute on function public.list_incoming_requests() to authenticated;
grant execute on function public.list_my_requests() to authenticated;
