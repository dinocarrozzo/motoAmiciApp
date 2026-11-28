-- Gruppi di giro: ogni giro appartiene a un gruppo con membri. Le regole stanno qui, nel database.

create table public.ride_groups (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  ride_type   text not null check (ride_type in ('passeggiata', 'passeggiata-veloce', 'enduro')),
  destination text check (destination is null or char_length(destination) <= 80),
  invite_code text not null unique,
  created_at  timestamptz not null default now(),
  ended_at    timestamptz
);

create table public.group_members (
  group_id   uuid not null references public.ride_groups (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  status     text not null check (status in ('invited', 'active', 'left')),
  invited_by uuid references auth.users (id) on delete set null,
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id, status);

alter table public.rides add column group_id uuid references public.ride_groups (id) on delete set null;
create index rides_group_idx on public.rides (group_id) where ended_at is null;

alter table public.ride_groups enable row level security;
alter table public.group_members enable row level security;
create policy "i tuoi gruppi" on public.ride_groups for select to authenticated
  using (exists (select 1 from public.group_members m where m.group_id = id and m.user_id = auth.uid() and m.status = 'active'));
create policy "le tue adesioni" on public.group_members for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete, truncate on public.ride_groups, public.group_members from anon, authenticated;
revoke all on public.ride_groups, public.group_members from anon;

-- Codice d'invito: 6 caratteri senza simboli ambigui, univoco.
create function public.gen_invite_code() returns text language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.ride_groups where invite_code = c);
  end loop;
  return c;
end $$;
revoke execute on function public.gen_invite_code() from public, anon, authenticated;

create function public.is_group_member(p_user uuid, p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = p_user and status = 'active');
$$;
revoke execute on function public.is_group_member(uuid, uuid) from public, anon, authenticated;

-- Chiude un giro: toglie la posizione, fa uscire dal gruppo, passa il ruolo di creatore, chiude il gruppo se è l'ultimo.
create function public.finish_ride(p_user uuid, p_ride uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g uuid;
  was_owner boolean;
  next_owner uuid;
begin
  update public.rides set ended_at = now() where id = p_ride and user_id = p_user and ended_at is null returning group_id into g;
  if not found then return; end if;
  delete from public.live_positions where user_id = p_user and ride_id = p_ride;
  if g is null then return; end if;
  select (role = 'owner') into was_owner from public.group_members where group_id = g and user_id = p_user;
  update public.group_members set status = 'left', role = 'member' where group_id = g and user_id = p_user and status = 'active';
  if not exists (select 1 from public.rides r where r.group_id = g and r.ended_at is null) then
    update public.ride_groups set ended_at = now() where id = g and ended_at is null;
    update public.group_members set status = 'left' where group_id = g and status in ('active', 'invited');
  elsif coalesce(was_owner, false) then
    select m.user_id into next_owner
    from public.group_members m
    join public.rides r on r.group_id = m.group_id and r.user_id = m.user_id and r.ended_at is null
    where m.group_id = g and m.status = 'active'
    order by m.joined_at, m.user_id limit 1;
    if next_owner is not null then
      update public.group_members set role = 'owner' where group_id = g and user_id = next_owner;
      update public.ride_groups set owner_id = next_owner where id = g;
    end if;
  end if;
end $$;
revoke execute on function public.finish_ride(uuid, uuid) from public, anon, authenticated;

drop function public.start_ride(uuid, text, text, text);
create function public.start_ride(p_ride_id uuid, p_ride_type text, p_visibility text, p_destination text, p_group_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  dest text := nullif(btrim(coalesce(p_destination, '')), '');
  rtype text := p_ride_type;
  gid uuid := p_group_id;
  existing public.rides%rowtype;
  prev uuid;
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  if p_visibility is null or p_visibility not in ('all', 'friends') then
    raise exception 'Visibilità non valida'; end if;
  if gid is null then
    if rtype is null or rtype not in ('passeggiata', 'passeggiata-veloce', 'enduro') then
      raise exception 'Tipo di uscita non valido'; end if;
    if dest is not null and char_length(dest) > 80 then raise exception 'Destinazione troppo lunga'; end if;
  else
    select g.ride_type, g.destination into rtype, dest
    from public.ride_groups g
    join public.group_members m on m.group_id = g.id and m.user_id = me and m.status = 'active'
    where g.id = gid and g.ended_at is null;
    if not found then raise exception 'Gruppo non valido'; end if;
  end if;
  if p_ride_id is null then raise exception 'Giro non valido'; end if;
  select * into existing from public.rides where id = p_ride_id;
  if found then
    if existing.user_id <> me or existing.ended_at is not null then raise exception 'Giro non valido'; end if;
    -- ripetizione dello stesso avvio (rete): si aggiornano solo i dati del giro
    update public.rides set visibility = p_visibility where id = p_ride_id;
    return existing.group_id;
  end if;
  -- Un solo giro attivo per persona.
  for prev in select id from public.rides where user_id = me and ended_at is null loop
    perform public.finish_ride(me, prev);
  end loop;
  delete from public.live_positions where user_id = me;
  if gid is null then
    insert into public.ride_groups (owner_id, ride_type, destination, invite_code)
      values (me, rtype, dest, public.gen_invite_code()) returning id into gid;
    insert into public.group_members (group_id, user_id, role, status) values (gid, me, 'owner', 'active');
  else
    -- il gruppo può essersi chiuso proprio chiudendo il giro precedente
    if not exists (select 1 from public.ride_groups where id = gid and ended_at is null) then
      raise exception 'Gruppo non valido'; end if;
    update public.group_members set status = 'active' where group_id = gid and user_id = me;
  end if;
  insert into public.rides (id, user_id, ride_type, visibility, destination, group_id)
    values (p_ride_id, me, rtype, p_visibility, dest, gid);
  return gid;
end $$;

create or replace function public.end_ride(p_ride_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  perform public.finish_ride(me, p_ride_id);
end $$;

create function public.my_group()
returns table (group_id uuid, ride_type text, destination text, invite_code text, role text, member_count integer, ride_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  return query
    select g.id, g.ride_type, g.destination, g.invite_code, m.role,
           (select count(*)::int from public.group_members x where x.group_id = g.id and x.status = 'active'),
           (select r.id from public.rides r where r.user_id = me and r.group_id = g.id and r.ended_at is null limit 1)
    from public.group_members m
    join public.ride_groups g on g.id = m.group_id
    where m.user_id = me and m.status = 'active' and g.ended_at is null
    order by g.created_at desc limit 1;
end $$;

revoke execute on function public.start_ride(uuid, text, text, text, uuid) from public, anon;
revoke execute on function public.end_ride(uuid) from public, anon;
revoke execute on function public.my_group() from public, anon;
grant execute on function public.start_ride(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.end_ride(uuid) to authenticated;
grant execute on function public.my_group() to authenticated;
