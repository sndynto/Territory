-- Optional: realtime mirror of on-chain state so every player's map updates live.
-- An indexer (or a small API route listening to Territory events) upserts into these tables.

create table if not exists territories (
  id          int primary key,
  owner       text,
  chog_id     int,
  last_claim  timestamptz,
  updated_at  timestamptz default now()
);

create table if not exists battles (
  id            bigint generated always as identity primary key,
  tile_id       int not null,
  attacker      text not null,
  defender      text not null,
  attacker_won  boolean not null,
  attack_roll   int not null,
  defense_roll  int not null,
  tx_hash       text,
  created_at    timestamptz default now()
);

alter table territories enable row level security;
alter table battles enable row level security;
create policy "public read territories" on territories for select using (true);
create policy "public read battles" on battles for select using (true);

alter publication supabase_realtime add table territories, battles;
