-- Who-owes-whom: payer + per-member shares on expenses, and repayments between members.
-- Additive only: existing rows are backfilled as "paid by creator, split equally among current members".

-- 1. Expense columns -----------------------------------------------------------
alter table public.expenses
  add column if not exists paid_by uuid references public.profiles (id) on delete cascade,
  add column if not exists is_personal boolean not null default false,
  add column if not exists split_type text not null default 'equal'
    check (split_type in ('equal', 'percent', 'shares', 'exact'));

update public.expenses set paid_by = user_id where paid_by is null;

-- Older clients insert without paid_by; default it to the creator.
create or replace function public.expenses_default_payer() returns trigger
language plpgsql as $$
begin
  new.paid_by := coalesce(new.paid_by, new.user_id);
  return new;
end $$;
drop trigger if exists expenses_default_payer on public.expenses;
create trigger expenses_default_payer before insert on public.expenses
  for each row execute function public.expenses_default_payer();

alter table public.expenses alter column paid_by set not null;

-- 2. Splits --------------------------------------------------------------------
-- group_id is denormalised so RLS and Realtime can filter without a join.
create table if not exists public.expense_splits (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  weight numeric(12,4),           -- raw percent / share count, so the editor can round-trip
  primary key (expense_id, user_id)
);
create index if not exists expense_splits_group_idx on public.expense_splits (group_id);

-- Backfill: equal split among current members (remainder cents go to the payer).
insert into public.expense_splits (expense_id, group_id, user_id, amount, weight)
select e.id, e.group_id, m.user_id,
       round(e.amount / cnt.n, 2)
         + case when m.user_id = e.paid_by then e.amount - round(e.amount / cnt.n, 2) * cnt.n else 0 end,
       null
from public.expenses e
join public.group_members m on m.group_id = e.group_id
join (select group_id, count(*) n from public.group_members group by group_id) cnt on cnt.group_id = e.group_id
where e.type = 'expense' and not e.is_personal
  and not exists (select 1 from public.expense_splits s where s.expense_id = e.id);

alter table public.expense_splits enable row level security;
drop policy if exists "splits read" on public.expense_splits;
create policy "splits read" on public.expense_splits for select to authenticated using (is_member(group_id));
-- No write policies: splits are only written through save_expense().

-- 3. Settlements ---------------------------------------------------------------
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  settled_at date not null default current_date,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create index if not exists settlements_group_idx on public.settlements (group_id);

alter table public.settlements enable row level security;
drop policy if exists "settlements read" on public.settlements;
create policy "settlements read" on public.settlements for select to authenticated using (is_member(group_id));
drop policy if exists "settlements create" on public.settlements;
create policy "settlements create" on public.settlements for insert to authenticated
  with check (
    created_by = auth.uid()
    and is_member(group_id)
    and auth.uid() in (from_user, to_user)
  );
drop policy if exists "settlements delete own" on public.settlements;
create policy "settlements delete own" on public.settlements for delete to authenticated using (created_by = auth.uid());

-- 4. Atomic expense + splits write ---------------------------------------------
-- p_splits: [{ "user_id": uuid, "amount": number, "weight": number|null }]
create or replace function public.save_expense(
  p_id uuid, p_group uuid, p_title text, p_amount numeric, p_category text, p_type text,
  p_spent_at date, p_paid_by uuid, p_personal boolean, p_split_type text, p_splits jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  eid uuid := p_id;
  me uuid := auth.uid();
  total numeric := 0;
  sp jsonb;
  shared boolean := p_type = 'expense' and not coalesce(p_personal, false);
begin
  if not is_member(p_group) then raise exception 'Not a member of this group'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Title is required'; end if;
  if not exists (select 1 from group_members where group_id = p_group and user_id = p_paid_by) then
    raise exception 'Payer must be a group member';
  end if;
  if coalesce(p_personal, false) and p_paid_by <> me then
    raise exception 'Personal expenses must be paid by you';
  end if;

  if shared then
    if p_splits is null or jsonb_array_length(p_splits) = 0 then raise exception 'Choose who this is shared with'; end if;
    for sp in select * from jsonb_array_elements(p_splits) loop
      if not exists (select 1 from group_members where group_id = p_group and user_id = (sp->>'user_id')::uuid) then
        raise exception 'Everyone in the split must be a group member';
      end if;
      total := total + (sp->>'amount')::numeric;
    end loop;
    if abs(total - p_amount) > 0.01 then
      raise exception 'Split amounts (%) must add up to the total (%)', total, p_amount;
    end if;
  end if;

  if eid is null then
    insert into expenses (group_id, user_id, paid_by, title, amount, category, type, spent_at, is_personal, split_type)
    values (p_group, me, p_paid_by, trim(p_title), p_amount, coalesce(p_category, 'other'), p_type,
            coalesce(p_spent_at, current_date), coalesce(p_personal, false), coalesce(p_split_type, 'equal'))
    returning id into eid;
  else
    update expenses set paid_by = p_paid_by, title = trim(p_title), amount = p_amount,
           category = coalesce(p_category, 'other'), type = p_type, spent_at = coalesce(p_spent_at, spent_at),
           is_personal = coalesce(p_personal, false), split_type = coalesce(p_split_type, 'equal')
     where id = eid and group_id = p_group and user_id = me;
    if not found then raise exception 'You can only edit your own transactions'; end if;
    delete from expense_splits where expense_id = eid;
  end if;

  if shared then
    insert into expense_splits (expense_id, group_id, user_id, amount, weight)
    select eid, p_group, (x->>'user_id')::uuid, round((x->>'amount')::numeric, 2), nullif(x->>'weight', '')::numeric
    from jsonb_array_elements(p_splits) x;
  end if;
  return eid;
end $$;

revoke all on function public.save_expense(uuid, uuid, text, numeric, text, text, date, uuid, boolean, text, jsonb) from public, anon;
grant execute on function public.save_expense(uuid, uuid, text, numeric, text, text, date, uuid, boolean, text, jsonb) to authenticated;

-- 5. Realtime ------------------------------------------------------------------
alter publication supabase_realtime add table public.expense_splits, public.settlements;

notify pgrst, 'reload schema';
