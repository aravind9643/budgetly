-- Recurring expenses, per-category budgets, custom categories, receipt photos, and a balance reset.
-- Additive only.

-- Shared helper: is the caller an owner/admin of the group?
create or replace function public.is_admin(g uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from group_members where group_id = g and user_id = auth.uid() and role in ('owner','admin'));
$$;

-- 1. Recurring expenses ---------------------------------------------------------
-- splits: [{ "user_id": uuid, "amount": number }] (fixed shares captured when the rule was created)
create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  paid_by uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null check (amount > 0),
  category text not null default 'bills',
  is_personal boolean not null default false,
  splits jsonb not null default '[]'::jsonb,
  frequency text not null check (frequency in ('weekly','monthly','yearly')),
  next_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists recurring_group_idx on public.recurring_expenses (group_id);

alter table public.recurring_expenses enable row level security;
drop policy if exists "recurring read" on public.recurring_expenses;
create policy "recurring read" on public.recurring_expenses for select to authenticated using (is_member(group_id));
drop policy if exists "recurring create" on public.recurring_expenses;
create policy "recurring create" on public.recurring_expenses for insert to authenticated
  with check (is_member(group_id) and created_by = auth.uid());
drop policy if exists "recurring modify" on public.recurring_expenses;
create policy "recurring modify" on public.recurring_expenses for update to authenticated
  using (created_by = auth.uid() or is_admin(group_id));
drop policy if exists "recurring delete" on public.recurring_expenses;
create policy "recurring delete" on public.recurring_expenses for delete to authenticated
  using (created_by = auth.uid() or is_admin(group_id));

-- Creates every due occurrence (catching up after gaps, max 24 per rule per call). Idempotent: next_date advances.
create or replace function public.run_recurring(p_group uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare r recurring_expenses; eid uuid; n int := 0; guard int;
begin
  if not is_member(p_group) then raise exception 'Not a member of this group'; end if;
  for r in select * from recurring_expenses where group_id = p_group and active and next_date <= current_date for update loop
    guard := 0;
    while r.next_date <= current_date and guard < 24 loop
      insert into expenses (group_id, user_id, paid_by, title, amount, category, type, spent_at, is_personal, split_type)
      values (r.group_id, r.created_by, r.paid_by, r.title, r.amount, r.category, 'expense', r.next_date, r.is_personal, 'exact')
      returning id into eid;
      if not r.is_personal then
        insert into expense_splits (expense_id, group_id, user_id, amount)
        select eid, r.group_id, (x->>'user_id')::uuid, (x->>'amount')::numeric from jsonb_array_elements(r.splits) x;
      end if;
      r.next_date := case r.frequency
        when 'weekly' then r.next_date + 7
        when 'monthly' then (r.next_date + interval '1 month')::date
        else (r.next_date + interval '1 year')::date end;
      n := n + 1; guard := guard + 1;
    end loop;
    update recurring_expenses set next_date = r.next_date where id = r.id;
  end loop;
  return n;
end $$;
revoke all on function public.run_recurring(uuid) from public, anon;
grant execute on function public.run_recurring(uuid) to authenticated;

-- 2. Per-category budgets -------------------------------------------------------
create table if not exists public.category_budgets (
  group_id uuid not null references public.groups (id) on delete cascade,
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  primary key (group_id, category)
);
alter table public.category_budgets enable row level security;
drop policy if exists "cat budgets read" on public.category_budgets;
create policy "cat budgets read" on public.category_budgets for select to authenticated using (is_member(group_id));
drop policy if exists "cat budgets write" on public.category_budgets;
create policy "cat budgets write" on public.category_budgets for all to authenticated
  using (is_admin(group_id)) with check (is_admin(group_id));

-- 3. Custom categories ----------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  key text not null,            -- stored in expenses.category, e.g. 'c_pets'
  label text not null,
  emoji text not null default '🏷️',
  color text not null default '#6B7180',
  created_at timestamptz not null default now(),
  unique (group_id, key)
);
alter table public.categories enable row level security;
drop policy if exists "categories read" on public.categories;
create policy "categories read" on public.categories for select to authenticated using (is_member(group_id));
drop policy if exists "categories create" on public.categories;
create policy "categories create" on public.categories for insert to authenticated with check (is_member(group_id));
drop policy if exists "categories delete" on public.categories;
create policy "categories delete" on public.categories for delete to authenticated using (is_admin(group_id));

-- 4. Receipt photos -------------------------------------------------------------
-- Objects live at receipts/<group_id>/<expense_id>.<ext>; only members of that group can read/write them.
alter table public.expenses add column if not exists receipt_path text;

insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;

drop policy if exists "receipts read" on storage.objects;
create policy "receipts read" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "receipts write" on storage.objects;
create policy "receipts write" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "receipts update" on storage.objects;
create policy "receipts update" on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "receipts delete" on storage.objects;
create policy "receipts delete" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.is_member(((storage.foldername(name))[1])::uuid));

-- 5. Balance reset ("start fresh") ---------------------------------------------
-- Owner-only. Records the given transfers as settlements so every balance returns to zero.
-- p_transfers: [{ "from": uuid, "to": uuid, "amount": number }] (the client's simplified debts)
create or replace function public.reset_balances(p_group uuid, p_transfers jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare t jsonb; n int := 0;
begin
  if not exists (select 1 from groups where id = p_group and owner_id = auth.uid()) then
    raise exception 'Only the space owner can reset balances';
  end if;
  for t in select * from jsonb_array_elements(p_transfers) loop
    insert into settlements (group_id, from_user, to_user, amount, note, created_by)
    values (p_group, (t->>'from')::uuid, (t->>'to')::uuid, (t->>'amount')::numeric, 'Balances reset', auth.uid());
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.reset_balances(uuid, jsonb) from public, anon;
grant execute on function public.reset_balances(uuid, jsonb) to authenticated;

-- 6. Realtime -------------------------------------------------------------------
alter publication supabase_realtime add table public.recurring_expenses, public.category_budgets, public.categories;

notify pgrst, 'reload schema';
