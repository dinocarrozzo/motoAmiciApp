-- Il blocco NASCONDE amicizie e richieste ma non le cancella: sbloccando tornano come prima.
-- (Tutte le funzioni di elenco e di ricerca già escludono le coppie legate da un blocco, in un verso o nell'altro.)

create or replace function public.block_user(target_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  if target_id = me then raise exception 'Non puoi bloccare te stesso'; end if;
  insert into public.blocks (blocker, blocked) values (me, target_id) on conflict do nothing;
end $$;

-- Una richiesta di una persona bloccata (o che mi ha bloccato) non si può accettare né rifiutare finché c'è il blocco.
create or replace function public.respond_friend_request(requester_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Accedi per continuare'; end if;
  if exists (select 1 from public.blocks b
             where (b.blocker = me and b.blocked = requester_id) or (b.blocker = requester_id and b.blocked = me)) then
    raise exception 'Richiesta non trovata';
  end if;
  if accept then
    update public.friendships set status = 'accepted'
     where requester = requester_id and addressee = me and status = 'pending';
  else
    delete from public.friendships
     where requester = requester_id and addressee = me and status = 'pending';
  end if;
  if not found then raise exception 'Richiesta non trovata'; end if;
end $$;
