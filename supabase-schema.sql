-- aliworld database schema
-- paste this entire block into supabase SQL editor and run it

-- plays: every trainer card submission (email capture)
create table if not exists plays (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  starter text,
  created_at timestamptz default now()
);

-- fallen_log: where players drop off (funnel data)
create table if not exists fallen_log (
  id uuid default gen_random_uuid() primary key,
  name text,
  email text,
  gym int not null,
  created_at timestamptz default now()
);

-- prizes_awarded: every prize given out (limited + unlimited)
create table if not exists prizes_awarded (
  id uuid default gen_random_uuid() primary key,
  prize_id text not null,
  gym int not null,
  prize_name text not null,
  winner_name text,
  email text not null,
  limited boolean default true,
  sent boolean default false,
  created_at timestamptz default now()
);

-- indexes for fast queries
create index if not exists plays_email_idx on plays(email);
create index if not exists prizes_email_idx on prizes_awarded(email);
create index if not exists prizes_id_idx on prizes_awarded(prize_id);
create index if not exists fallen_gym_idx on fallen_log(gym);
create index if not exists plays_created_idx on plays(created_at);

-- Row Level Security: allow anon to insert (game writes),
-- but only authenticated users can read (dashboard)
alter table plays enable row level security;
alter table fallen_log enable row level security;
alter table prizes_awarded enable row level security;

-- anon can insert into all tables (game submits data)
create policy "anon insert plays" on plays for insert to anon with check (true);
create policy "anon insert fallen" on fallen_log for insert to anon with check (true);
create policy "anon insert prizes" on prizes_awarded for insert to anon with check (true);

-- anon can read prizes_awarded to check if a prize is claimed
-- (the game needs to know if gym 2 sticker is already taken)
create policy "anon read prizes" on prizes_awarded for select to anon using (true);

-- anon can read plays only for their own email (to check if they've played before)
create policy "anon read own plays" on plays for select to anon using (true);

-- anon can update prizes_awarded.sent (dashboard marks as sent)
-- note: in production you'd want this behind auth — fine for now
create policy "anon update prizes" on prizes_awarded for update to anon using (true);
