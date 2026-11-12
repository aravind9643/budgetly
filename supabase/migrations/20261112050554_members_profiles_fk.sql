-- Let PostgREST embed profiles from group_members / expenses (select=...,profiles(...)).
-- Backfill any users missing a profile first so the FKs validate.
insert into public.profiles (id, full_name, email)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), lower(u.email)
from auth.users u
on conflict (id) do nothing;

alter table public.group_members
  drop constraint if exists group_members_user_profile_fkey,
  add constraint group_members_user_profile_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.expenses
  drop constraint if exists expenses_user_profile_fkey,
  add constraint expenses_user_profile_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;

notify pgrst, 'reload schema';
