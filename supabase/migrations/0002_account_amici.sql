-- Profili, contatto fidato, amicizie e blocchi. Le regole di visibilità stanno qui, nel database.

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  nickname     text not null,
  display_name text,
  gender       text not null default 'x' check (gender in ('m', 'f', 'x')),
  avatar       text not null default 'moto',
  bike_type    text check (bike_type in ('stradale-sportiva', 'custom', 'naked', 'enduro', 'maxienduro')),
  created_at   timestamptz not null default now(),
  constraint nickname_format check (nickname ~ '^[A-Za-z0-9._-]{3,20}$'),
  constraint display_name_len check (display_name is null or char_length(display_name) between 1 and 40)
);
create unique index profiles_nickname_lower_idx on public.profiles (lower(nickname));
create index profiles_nickname_prefix_idx on public.profiles (lower(nickname) text_pattern_ops);

create table public.emergency_contacts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name    text not null check (char_length(name) between 1 and 60),
  phone   text not null check (phone ~ '^\+[0-9]{8,15}$')
);

create table public.friendships (
  requester  uuid not null references auth.users (id) on delete cascade,
  addressee  uuid not null references auth.users (id) on delete cascade,
  status     text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- Una sola coppia, in qualunque verso.
create unique index friendships_pair_idx on public.friendships (least(requester, addressee), greatest(requester, addressee));

create table public.blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

alter table public.profiles enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;

-- Profili: ognuno legge e scrive solo il proprio. Gli altri si vedono solo tramite le funzioni.
create policy "leggi il tuo profilo" on public.profiles for select to authenticated using (id = auth.uid());
create policy "crea il tuo profilo" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "modifica il tuo profilo" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Contatto fidato: solo il proprietario.
create policy "il tuo contatto fidato" on public.emergency_contacts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Amicizie e blocchi: si leggono solo i propri; si scrive solo con le funzioni qui sotto.
create policy "le tue amicizie" on public.friendships for select to authenticated
  using (requester = auth.uid() or addressee = auth.uid());
create policy "i tuoi blocchi" on public.blocks for select to authenticated using (blocker = auth.uid());

-- Nickname libero? (senza distinguere le maiuscole)
create function public.nickname_available(n text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where lower(nickname) = lower(btrim(n)));
$$;

-- Ricerca per prefisso su nickname e nome. Esclude se stessi e chiunque sia legato da un blocco, in un verso o nell'altro.
create function public.search_profiles(q text)
returns table (id uuid, nickname text, display_name text, avatar text, gender text)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  clean text;
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  clean := regexp_replace(coalesce(q, ''), '[%_\\]', '', 'g');
  clean := btrim(regexp_replace(clean, '\s+', ' ', 'g'));
  if char_length(clean) < 2 then return; end if;
  return query
    select p.id, p.nickname, p.display_name, p.avatar, p.gender
    from public.profiles p
    where p.id <> me
      and (lower(p.nickname) like (lower(clean) || '%') or lower(coalesce(p.display_name, '')) like (lower(clean) || '%'))
      and not exists (
        select 1 from public.blocks b
        where (b.blocker = me and b.blocked = p.id) or (b.blocker = p.id and b.blocked = me))
    order by (lower(p.nickname) = lower(clean)) desc, lower(p.nickname)
    limit 10;
end $$;

create function public.send_friend_request(target_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  f public.friendships;
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  if target_id = me then raise exception 'Non puoi aggiungere te stesso'; end if;
  -- Stesso messaggio per «non esiste» e «mi ha bloccato»: chi è bloccato non deve accorgersene.
  if not exists (select 1 from public.profiles where id = target_id)
     or exists (select 1 from public.blocks b
                where (b.blocker = me and b.blocked = target_id) or (b.blocker = target_id and b.blocked = me)) then
    raise exception 'Utente non trovato';
  end if;
  select * into f from public.friendships
   where (requester = me and addressee = target_id) or (requester = target_id and addressee = me);
  if found then
    if f.status = 'accepted' then raise exception 'Siete già amici'; end if;
    if f.requester = me then raise exception 'Richiesta già inviata'; end if;
    update public.friendships set status = 'accepted' where requester = target_id and addressee = me;
    return;
  end if;
  insert into public.friendships (requester, addressee, status) values (me, target_id, 'pending');
end $$;

create function public.respond_friend_request(requester_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  if accept then
    update public.friendships set status = 'accepted'
     where requester = requester_id and addressee = me and status = 'pending';
  else
    delete from public.friendships
     where requester = requester_id and addressee = me and status = 'pending';
  end if;
  if not found then raise exception 'Richiesta non trovata'; end if;
end $$;

create function public.remove_friend(target_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  delete from public.friendships
   where status = 'accepted'
     and ((requester = me and addressee = target_id) or (requester = target_id and addressee = me));
end $$;

-- Bloccare cancella amicizia e richieste tra i due.
create function public.block_user(target_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  if target_id = me then raise exception 'Non puoi bloccare te stesso'; end if;
  delete from public.friendships
   where (requester = me and addressee = target_id) or (requester = target_id and addressee = me);
  insert into public.blocks (blocker, blocked) values (me, target_id) on conflict do nothing;
end $$;

create function public.unblock_user(target_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  delete from public.blocks where blocker = me and blocked = target_id;
end $$;

create function public.list_friends()
returns table (id uuid, nickname text, display_name text, avatar text, gender text)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  return query
    select p.id, p.nickname, p.display_name, p.avatar, p.gender
    from public.friendships f
    join public.profiles p on p.id = case when f.requester = me then f.addressee else f.requester end
    where f.status = 'accepted' and (f.requester = me or f.addressee = me)
      and not exists (select 1 from public.blocks b
                      where (b.blocker = me and b.blocked = p.id) or (b.blocker = p.id and b.blocked = me))
    order by lower(p.nickname);
end $$;

-- direction: 'received' (qualcuno ha chiesto a me) oppure 'sent' (ho chiesto io).
create function public.list_requests()
returns table (id uuid, nickname text, display_name text, avatar text, gender text, direction text)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  return query
    select p.id, p.nickname, p.display_name, p.avatar, p.gender,
           case when f.requester = me then 'sent' else 'received' end
    from public.friendships f
    join public.profiles p on p.id = case when f.requester = me then f.addressee else f.requester end
    where f.status = 'pending' and (f.requester = me or f.addressee = me)
      and not exists (select 1 from public.blocks b
                      where (b.blocker = me and b.blocked = p.id) or (b.blocker = p.id and b.blocked = me))
    order by f.created_at desc;
end $$;

create function public.list_blocked()
returns table (id uuid, nickname text, display_name text, avatar text, gender text)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  return query
    select p.id, p.nickname, p.display_name, p.avatar, p.gender
    from public.blocks b join public.profiles p on p.id = b.blocked
    where b.blocker = me
    order by lower(p.nickname);
end $$;

-- Solo gli utenti che hanno fatto l'accesso possono chiamare le funzioni.
revoke execute on function
  public.nickname_available(text), public.search_profiles(text), public.send_friend_request(uuid),
  public.respond_friend_request(uuid, boolean), public.remove_friend(uuid), public.block_user(uuid),
  public.unblock_user(uuid), public.list_friends(), public.list_requests(), public.list_blocked()
  from public, anon;
grant execute on function
  public.nickname_available(text), public.search_profiles(text), public.send_friend_request(uuid),
  public.respond_friend_request(uuid, boolean), public.remove_friend(uuid), public.block_user(uuid),
  public.unblock_user(uuid), public.list_friends(), public.list_requests(), public.list_blocked()
  to authenticated;
