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
