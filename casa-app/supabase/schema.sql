-- Casa Carobbio: schema per Supabase (migrazione cc_schema, non distruttiva)
-- Tabelle con prefisso cc_ per non scontrarsi con quelle delle altre app nello stesso progetto.
-- Ogni record dell'app (spesa, documento, scadenza...) è una riga di cc_records:
-- coll = nome della collezione nel backup JSON, id = id stabile del record, data = il record intero.

create table if not exists public.cc_membri (
  user_id uuid primary key references auth.users on delete cascade,
  nome    text not null,
  ruolo   text not null default 'editor' check (ruolo in ('editor','lettore'))
);

create table if not exists public.cc_records (
  coll       text not null,
  id         text not null,
  data       jsonb not null,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (coll, id)
);
create index if not exists cc_records_coll_idx on public.cc_records (coll) where not deleted;

create table if not exists public.cc_meta (
  key        text primary key,          -- 'meta', 'settings', 'immobile'
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

alter table public.cc_membri  enable row level security;
alter table public.cc_records enable row level security;
alter table public.cc_meta    enable row level security;

-- Niente accesso senza login: la chiave anon è pubblica.
revoke all on public.cc_membri, public.cc_records, public.cc_meta from anon;
revoke delete on public.cc_membri, public.cc_records, public.cc_meta from authenticated;

create or replace function public.cc_is_membro(min_ruolo text default 'lettore')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cc_membri m
    where m.user_id = auth.uid()
      and (min_ruolo = 'lettore' or m.ruolo = 'editor')
  );
$$;
revoke execute on function public.cc_is_membro(text) from public, anon;
grant execute on function public.cc_is_membro(text) to authenticated;

-- Chi e quando: impostati dal server, non falsificabili dal client.
create or replace function public.cc_stamp()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists cc_records_stamp on public.cc_records;
create trigger cc_records_stamp before insert or update on public.cc_records for each row execute function public.cc_stamp();
drop trigger if exists cc_meta_stamp on public.cc_meta;
create trigger cc_meta_stamp before insert or update on public.cc_meta for each row execute function public.cc_stamp();

drop policy if exists cc_membri_self on public.cc_membri;
create policy cc_membri_self on public.cc_membri for select to authenticated using (user_id = auth.uid());

drop policy if exists cc_records_read on public.cc_records;
drop policy if exists cc_records_write on public.cc_records;
drop policy if exists cc_records_upd on public.cc_records;
create policy cc_records_read  on public.cc_records for select to authenticated using (public.cc_is_membro('lettore'));
create policy cc_records_write on public.cc_records for insert to authenticated with check (public.cc_is_membro('editor'));
create policy cc_records_upd   on public.cc_records for update to authenticated using (public.cc_is_membro('editor')) with check (public.cc_is_membro('editor'));

drop policy if exists cc_meta_read on public.cc_meta;
drop policy if exists cc_meta_write on public.cc_meta;
drop policy if exists cc_meta_upd on public.cc_meta;
create policy cc_meta_read  on public.cc_meta for select to authenticated using (public.cc_is_membro('lettore'));
create policy cc_meta_write on public.cc_meta for insert to authenticated with check (public.cc_is_membro('editor'));
create policy cc_meta_upd   on public.cc_meta for update to authenticated using (public.cc_is_membro('editor')) with check (public.cc_is_membro('editor'));

-- Niente delete fisiche dall'app: l'eliminazione imposta deleted = true (resta lo storico).
-- I familiari: invito da Authentication → Users, poi (SQL editor):
-- insert into public.cc_membri (user_id, nome, ruolo)
--   select id, 'Nome', 'editor' from auth.users where email = 'persona@example.com';
