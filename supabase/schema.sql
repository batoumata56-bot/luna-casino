-- ============================================================
-- LUNA Casino — schéma complet
-- À coller dans Supabase → SQL Editor → Run (idempotent)
-- Puis : Authentication → Sign In / Providers → Email → Confirm email = OFF
-- ============================================================

-- ------------------------------------------------------------
-- 1. Profils joueurs
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar text not null default '',
  banner text not null default 'velvet',
  bio text not null default '',
  cash numeric not null default 10000,
  crypto jsonb not null default '{"LUNA":25,"BTC":0,"ETH":0.5,"SOL":10}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  game_stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fortune totale (cash + crypto aux taux de référence) pour trier le classement
alter table public.profiles add column if not exists wealth numeric not null default 10000;
alter table public.profiles add column if not exists last_seen timestamptz not null default now();
alter table public.profiles add column if not exists title text not null default '';
alter table public.profiles add column if not exists cardback text not null default 'card-classic';
alter table public.profiles add column if not exists owned jsonb not null default '["velvet","fox","card-classic"]'::jsonb;

create index if not exists profiles_wealth_idx on public.profiles (wealth desc);
create index if not exists profiles_username_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "Lecture publique des profils" on public.profiles;
create policy "Lecture publique des profils"
  on public.profiles for select using (true);

drop policy if exists "Insert son propre profil" on public.profiles;
create policy "Insert son propre profil"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Update son propre profil" on public.profiles;
create policy "Update son propre profil"
  on public.profiles for update using (auth.uid() = id);

-- ------------------------------------------------------------
-- 2. Amis
-- ------------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',   -- pending | accepted
  created_at timestamptz not null default now(),
  constraint friendships_pair_unique unique (requester, addressee),
  constraint friendships_no_self check (requester <> addressee)
);

create index if not exists friendships_requester_idx on public.friendships (requester);
create index if not exists friendships_addressee_idx on public.friendships (addressee);

alter table public.friendships enable row level security;

drop policy if exists "Voir ses relations" on public.friendships;
create policy "Voir ses relations"
  on public.friendships for select
  using (auth.uid() = requester or auth.uid() = addressee);

drop policy if exists "Envoyer une demande" on public.friendships;
create policy "Envoyer une demande"
  on public.friendships for insert
  with check (auth.uid() = requester);

drop policy if exists "Repondre a une demande" on public.friendships;
create policy "Repondre a une demande"
  on public.friendships for update
  using (auth.uid() = addressee or auth.uid() = requester);

drop policy if exists "Supprimer une relation" on public.friendships;
create policy "Supprimer une relation"
  on public.friendships for delete
  using (auth.uid() = requester or auth.uid() = addressee);

-- ------------------------------------------------------------
-- 3. Chat (général + messages privés entre amis)
--    room = 'general'  ou  'dm:<uuid_le_plus_petit>_<uuid_le_plus_grand>'
-- ------------------------------------------------------------
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  room text not null default 'general',
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_room_created_idx on public.chat_messages (room, created_at desc);

alter table public.chat_messages enable row level security;

-- Chat général lisible par tous les connectés ; DM seulement si l'id est dans la room
drop policy if exists "Lire le chat autorise" on public.chat_messages;
create policy "Lire le chat autorise"
  on public.chat_messages for select
  using (
    room = 'general'
    or position(auth.uid()::text in room) > 0
  );

drop policy if exists "Ecrire ses messages" on public.chat_messages;
create policy "Ecrire ses messages"
  on public.chat_messages for insert
  with check (
    auth.uid() = author_id
    and (room = 'general' or position(auth.uid()::text in room) > 0)
  );

drop policy if exists "Supprimer ses messages" on public.chat_messages;
create policy "Supprimer ses messages"
  on public.chat_messages for delete
  using (auth.uid() = author_id);

-- ------------------------------------------------------------
-- 4. Tables de jeu multijoueur
-- ------------------------------------------------------------
create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  game_id text not null,
  host_id uuid not null references auth.users(id) on delete cascade,
  stake numeric not null default 100,
  max_players int not null default 6,
  status text not null default 'lobby',     -- lobby | playing | done
  state jsonb not null default '{}'::jsonb, -- état de la partie, écrit par l'hôte
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists game_rooms_status_idx on public.game_rooms (status, created_at desc);

alter table public.game_rooms enable row level security;

drop policy if exists "Voir les tables" on public.game_rooms;
create policy "Voir les tables"
  on public.game_rooms for select using (auth.uid() is not null);

drop policy if exists "Creer une table" on public.game_rooms;
create policy "Creer une table"
  on public.game_rooms for insert with check (auth.uid() = host_id);

-- L'hôte pilote la partie ; les joueurs assis peuvent pousser leurs actions
drop policy if exists "Maj de sa table" on public.game_rooms;
create policy "Maj de sa table"
  on public.game_rooms for update
  using (
    auth.uid() = host_id
    or exists (
      select 1 from public.room_players rp
      where rp.room_id = game_rooms.id and rp.user_id = auth.uid()
    )
  );

drop policy if exists "Fermer sa table" on public.game_rooms;
create policy "Fermer sa table"
  on public.game_rooms for delete using (auth.uid() = host_id);

create table if not exists public.room_players (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  seat int not null default 0,
  chips numeric not null default 0,
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.room_players enable row level security;

drop policy if exists "Voir les joueurs assis" on public.room_players;
create policy "Voir les joueurs assis"
  on public.room_players for select using (auth.uid() is not null);

drop policy if exists "S asseoir" on public.room_players;
create policy "S asseoir"
  on public.room_players for insert with check (auth.uid() = user_id);

drop policy if exists "Maj sa place" on public.room_players;
create policy "Maj sa place"
  on public.room_players for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.game_rooms r
      where r.id = room_players.room_id and r.host_id = auth.uid()
    )
  );

drop policy if exists "Quitter sa place" on public.room_players;
create policy "Quitter sa place"
  on public.room_players for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.game_rooms r
      where r.id = room_players.room_id and r.host_id = auth.uid()
    )
  );

-- Journal d'actions (mises, hit/stand, cashout, …)
create table if not exists public.room_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  actor_id uuid,
  actor_name text,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists room_events_room_idx on public.room_events (room_id, id);

alter table public.room_events enable row level security;

drop policy if exists "Voir les actions" on public.room_events;
create policy "Voir les actions"
  on public.room_events for select using (auth.uid() is not null);

drop policy if exists "Poster une action" on public.room_events;
create policy "Poster une action"
  on public.room_events for insert with check (auth.uid() = actor_id);

-- ------------------------------------------------------------
-- 5. Invitations à jouer
-- ------------------------------------------------------------
create table if not exists public.game_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  from_id uuid not null references auth.users(id) on delete cascade,
  from_name text not null,
  to_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  status text not null default 'pending',   -- pending | accepted | declined
  created_at timestamptz not null default now()
);

create index if not exists game_invites_to_idx on public.game_invites (to_id, status);

alter table public.game_invites enable row level security;

drop policy if exists "Voir ses invitations" on public.game_invites;
create policy "Voir ses invitations"
  on public.game_invites for select
  using (auth.uid() = to_id or auth.uid() = from_id);

drop policy if exists "Inviter un ami" on public.game_invites;
create policy "Inviter un ami"
  on public.game_invites for insert with check (auth.uid() = from_id);

drop policy if exists "Repondre a l invitation" on public.game_invites;
create policy "Repondre a l invitation"
  on public.game_invites for update
  using (auth.uid() = to_id or auth.uid() = from_id);

drop policy if exists "Retirer l invitation" on public.game_invites;
create policy "Retirer l invitation"
  on public.game_invites for delete
  using (auth.uid() = to_id or auth.uid() = from_id);

-- ------------------------------------------------------------
-- 6. Realtime — diffuser les changements aux clients
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'friendships', 'chat_messages',
    'game_rooms', 'room_players', 'room_events', 'game_invites'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end $$;

-- Realtime a besoin des anciennes valeurs pour les updates/deletes
alter table public.profiles replica identity full;
alter table public.friendships replica identity full;
alter table public.game_rooms replica identity full;
alter table public.room_players replica identity full;
alter table public.game_invites replica identity full;

-- ------------------------------------------------------------
-- 7. Transferts d'argent (par pseudo)
-- ------------------------------------------------------------
create table if not exists public.transfers (
  id bigint generated always as identity primary key,
  from_id uuid not null references auth.users(id) on delete cascade,
  to_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  created_at timestamptz not null default now()
);

alter table public.transfers enable row level security;

drop policy if exists "Voir ses virements" on public.transfers;
create policy "Voir ses virements"
  on public.transfers for select
  using (auth.uid() = from_id or auth.uid() = to_id);

create or replace function public.transfer_lc(dest_username text, amt numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  src uuid := auth.uid();
  dest uuid;
  src_cash numeric;
begin
  if src is null then
    raise exception 'Connecte-toi pour envoyer de l''argent';
  end if;
  if amt is null or amt < 1 then
    raise exception 'Montant invalide';
  end if;
  amt := floor(amt);
  select id into dest from public.profiles where lower(username) = lower(trim(dest_username));
  if dest is null then
    raise exception 'Joueur introuvable';
  end if;
  if dest = src then
    raise exception 'Tu ne peux pas t''envoyer de l''argent';
  end if;
  select cash into src_cash from public.profiles where id = src for update;
  if src_cash is null or src_cash < amt then
    raise exception 'Fonds insuffisants';
  end if;
  update public.profiles
    set cash = cash - amt, wealth = wealth - amt, updated_at = now()
    where id = src;
  update public.profiles
    set cash = cash + amt, wealth = wealth + amt, updated_at = now()
    where id = dest;
  insert into public.transfers (from_id, to_id, amount) values (src, dest, amt);
  return jsonb_build_object('ok', true, 'amount', amt);
end;
$$;

revoke all on function public.transfer_lc(text, numeric) from public;
grant execute on function public.transfer_lc(text, numeric) to authenticated;

grant select, insert, update, delete on public.friendships to authenticated;
grant select, insert, delete on public.chat_messages to authenticated;
grant select, insert, update, delete on public.game_rooms to authenticated;
grant select, insert, update, delete on public.room_players to authenticated;
grant select, insert on public.room_events to authenticated;
grant select, insert, update, delete on public.game_invites to authenticated;
grant select on public.transfers to authenticated;

-- Force PostgREST à recharger le cache (évite l'erreur "schema cache")
notify pgrst, 'reload schema';
