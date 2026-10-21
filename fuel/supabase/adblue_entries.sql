-- Tabella AdBlue per il Galaxy Fuel Tracker (finora l'AdBlue era salvato solo nel browser del dispositivo).
-- Da eseguire una volta in Supabase → SQL Editor. Stesso modello di accesso delle altre tabelle dell'app (chiave anon).
create table if not exists public.adblue_entries (
  id        text primary key,
  date      date not null,
  liters    numeric not null,
  cost      numeric not null default 0,
  odometer  integer not null,
  notes     text not null default '',
  created_at timestamptz not null default now()
);

alter table public.adblue_entries enable row level security;

drop policy if exists adblue_anon_all on public.adblue_entries;
create policy adblue_anon_all on public.adblue_entries
  for all to anon, authenticated using (true) with check (true);
