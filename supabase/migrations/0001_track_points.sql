-- Punti GPS del prototipo. Ogni utente (anche anonimo) vede e inserisce solo i propri.
create table public.track_points (
  session_id  uuid        not null,
  user_id     uuid        not null default auth.uid(),
  recorded_at timestamptz not null,
  lat         double precision not null,
  lng         double precision not null,
  accuracy    real,
  speed       real,
  received_at timestamptz not null default now(),
  primary key (session_id, recorded_at)
);

alter table public.track_points enable row level security;

create policy "inserisci i tuoi punti" on public.track_points
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "leggi i tuoi punti" on public.track_points
  for select to authenticated
  using (user_id = auth.uid());
