-- Inviti: con codice (link WhatsApp) e agli amici dentro l'app.

create function public.join_by_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  code text := upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
  g uuid;
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  if code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$' then raise exception 'Codice non valido'; end if;
  select id into g from public.ride_groups where invite_code = code and ended_at is null;
  if not found then raise exception 'Codice non valido'; end if;
  if public.is_group_member(me, g) then return g; end if;
  -- Con un blocco verso un membro si risponde come se il codice non esistesse.
  if exists (
      select 1 from public.group_members m
      join public.blocks b on (b.blocker = me and b.blocked = m.user_id) or (b.blocker = m.user_id and b.blocked = me)
      where m.group_id = g and m.status = 'active') then
    raise exception 'Codice non valido'; end if;
  insert into public.group_members (group_id, user_id, role, status) values (g, me, 'member', 'active')
  on conflict (group_id, user_id) do update set status = 'active', joined_at = now();
  return g;
end $$;

create function public.invite_to_group(p_group_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  if p_user_id is null or p_user_id = me
     or not public.is_group_member(me, p_group_id)
     or public.is_group_member(p_user_id, p_group_id)
     or not exists (select 1 from public.friendships f where f.status = 'accepted'
                    and ((f.requester = me and f.addressee = p_user_id) or (f.requester = p_user_id and f.addressee = me)))
     or exists (
          select 1 from public.group_members m
          join public.blocks b on (b.blocker = p_user_id and b.blocked = m.user_id) or (b.blocker = m.user_id and b.blocked = p_user_id)
          where m.group_id = p_group_id and m.status = 'active') then
    raise exception 'Invito non possibile';
  end if;
  insert into public.group_members (group_id, user_id, role, status, invited_by) values (p_group_id, p_user_id, 'member', 'invited', me)
  on conflict (group_id, user_id) do update set status = 'invited', invited_by = me, joined_at = now()
    where public.group_members.status <> 'active';
end $$;

create function public.list_group_invites()
returns table (group_id uuid, inviter_nickname text, ride_type text, destination text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  return query
    select g.id, coalesce(p.nickname, ''), g.ride_type, g.destination, m.joined_at
    from public.group_members m
    join public.ride_groups g on g.id = m.group_id and g.ended_at is null
    left join public.profiles p on p.id = m.invited_by
    where m.user_id = me and m.status = 'invited'
    order by m.joined_at desc;
end $$;

create function public.respond_group_invite(p_group_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  if not exists (
      select 1 from public.group_members m join public.ride_groups g on g.id = m.group_id and g.ended_at is null
      where m.group_id = p_group_id and m.user_id = me and m.status = 'invited') then
    raise exception 'Invito non trovato'; end if;
  if p_accept and exists (
      select 1 from public.group_members m
      join public.blocks b on (b.blocker = me and b.blocked = m.user_id) or (b.blocker = m.user_id and b.blocked = me)
      where m.group_id = p_group_id and m.status = 'active') then
    raise exception 'Invito non valido'; end if;
  update public.group_members set status = case when p_accept then 'active' else 'left' end, joined_at = now()
    where group_id = p_group_id and user_id = me and status = 'invited';
end $$;

revoke execute on function public.join_by_code(text) from public, anon;
revoke execute on function public.invite_to_group(uuid, uuid) from public, anon;
revoke execute on function public.list_group_invites() from public, anon;
revoke execute on function public.respond_group_invite(uuid, boolean) from public, anon;
grant execute on function public.join_by_code(text) to authenticated;
grant execute on function public.invite_to_group(uuid, uuid) to authenticated;
grant execute on function public.list_group_invites() to authenticated;
grant execute on function public.respond_group_invite(uuid, boolean) to authenticated;
