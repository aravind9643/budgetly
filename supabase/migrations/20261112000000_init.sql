-- Budget Tracker schema. Run in Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  email text,
  created_at timestamptz default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text default '💰',
  currency text default 'USD',
  monthly_budget numeric(12,2) default 0,
  invite_code text unique not null default upper(substr(md5(random()::text), 1, 8)),
  owner_id uuid not null references auth.users on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.group_members (
  group_id uuid references public.groups on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  email text not null,
  invited_by uuid references auth.users on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz default now(),
  unique (group_id, email)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  amount numeric(12,2) not null check (amount > 0),
  category text not null default 'other',
  type text not null default 'expense' check (type in ('expense','income')),
  spent_at date not null default current_date,
  created_at timestamptz default now()
);

-- Helper: membership check (security definer avoids RLS recursion)
create or replace function public.is_member(g uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from group_members where group_id = g and user_id = auth.uid());
$$;

-- Auto-create profile on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), lower(new.email))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Owner auto-joins their group
create or replace function public.handle_new_group() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into group_members(group_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end $$;
drop trigger if exists on_group_created on public.groups;
create trigger on_group_created after insert on public.groups
  for each row execute function public.handle_new_group();

-- Join by invite code
create or replace function public.join_group_by_code(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  select id into gid from groups where invite_code = upper(trim(code));
  if gid is null then raise exception 'Invalid invite code'; end if;
  insert into group_members(group_id, user_id) values (gid, auth.uid()) on conflict do nothing;
  return gid;
end $$;

-- Accept / decline an email invite
create or replace function public.respond_invite(invite_id uuid, accept boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv invites;
begin
  select * into inv from invites
   where id = invite_id and email = lower(auth.jwt()->>'email') and status = 'pending';
  if inv.id is null then raise exception 'Invite not found'; end if;
  update invites set status = case when accept then 'accepted' else 'declined' end where id = inv.id;
  if accept then
    insert into group_members(group_id, user_id) values (inv.group_id, auth.uid()) on conflict do nothing;
  end if;
  return inv.group_id;
end $$;

-- RLS
alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table invites enable row level security;
alter table expenses enable row level security;

drop policy if exists "profiles read" on profiles;
create policy "profiles read" on profiles for select to authenticated using (true);
drop policy if exists "profiles update self" on profiles;
create policy "profiles update self" on profiles for update to authenticated using (id = auth.uid());

drop policy if exists "groups read" on groups;
create policy "groups read" on groups for select to authenticated
  using (is_member(id) or exists (select 1 from invites i where i.group_id = id and i.email = lower(auth.jwt()->>'email') and i.status='pending'));
drop policy if exists "groups insert" on groups;
create policy "groups insert" on groups for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "groups update" on groups;
create policy "groups update" on groups for update to authenticated
  using (exists (select 1 from group_members m where m.group_id = id and m.user_id = auth.uid() and m.role in ('owner','admin')));
drop policy if exists "groups delete" on groups;
create policy "groups delete" on groups for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "members read" on group_members;
create policy "members read" on group_members for select to authenticated using (is_member(group_id));
drop policy if exists "members leave or owner removes" on group_members;
create policy "members leave or owner removes" on group_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from groups g where g.id = group_id and g.owner_id = auth.uid()));

drop policy if exists "invites read" on invites;
create policy "invites read" on invites for select to authenticated
  using (is_member(group_id) or email = lower(auth.jwt()->>'email'));
drop policy if exists "invites create" on invites;
create policy "invites create" on invites for insert to authenticated
  with check (is_member(group_id) and invited_by = auth.uid());
drop policy if exists "invites delete" on invites;
create policy "invites delete" on invites for delete to authenticated using (is_member(group_id));

drop policy if exists "expenses read" on expenses;
create policy "expenses read" on expenses for select to authenticated using (is_member(group_id));
drop policy if exists "expenses insert" on expenses;
create policy "expenses insert" on expenses for insert to authenticated
  with check (is_member(group_id) and user_id = auth.uid());
drop policy if exists "expenses modify own" on expenses;
create policy "expenses modify own" on expenses for update to authenticated using (user_id = auth.uid());
drop policy if exists "expenses delete own" on expenses;
create policy "expenses delete own" on expenses for delete to authenticated using (user_id = auth.uid());

-- Realtime
alter publication supabase_realtime add table expenses, group_members, invites;
