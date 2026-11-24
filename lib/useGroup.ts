import { useCallback, useEffect, useState } from 'react';
import { CategoryBudget, CustomCategory, Expense, Group, Invite, Member, Profile, Recurring, Settlement, Split, supabase } from './supabase';

/**
 * Loads one group (space) with its transactions, splits, repayments, members, invites, recurring rules,
 * category budgets and custom categories, and keeps them live via Realtime. Due recurring expenses are
 * created (server-side, idempotent) the first time a space is opened.
 */
export function useGroup(id: string | undefined) {
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<Split[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [former, setFormer] = useState<Record<string, Profile>>({});
  const [invites, setInvites] = useState<Invite[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [catBudgets, setCatBudgets] = useState<CategoryBudget[]>([]);
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    const [g, e, sp, st, m, i, rc, cb, cc] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).maybeSingle(),
      supabase.from('expenses').select('*').eq('group_id', id)
        .order('spent_at', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('expense_splits').select('expense_id, user_id, amount, weight').eq('group_id', id),
      supabase.from('settlements').select('*').eq('group_id', id).order('created_at', { ascending: false }),
      supabase.from('group_members').select('user_id, role, joined_at, profiles(full_name, email)').eq('group_id', id),
      supabase.from('invites').select('*').eq('group_id', id).eq('status', 'pending').order('created_at'),
      supabase.from('recurring_expenses').select('*').eq('group_id', id).order('next_date'),
      supabase.from('category_budgets').select('*').eq('group_id', id),
      supabase.from('categories').select('*').eq('group_id', id).order('created_at'),
    ]);
    const mem = (m.data ?? []) as any as Member[];
    const ex = (e.data ?? []) as Expense[];
    const stl = (st.data ?? []) as Settlement[];
    const spl = (sp.data ?? []) as Split[];

    // People who appear in history but have left the group: fetch their names so balances stay readable.
    const current = new Set(mem.map((x) => x.user_id));
    const gone = new Set<string>();
    ex.forEach((x) => { gone.add(x.user_id); gone.add(x.paid_by); });
    spl.forEach((x) => gone.add(x.user_id));
    stl.forEach((x) => { gone.add(x.from_user); gone.add(x.to_user); });
    const missingIds = [...gone].filter((u) => u && !current.has(u));
    if (missingIds.length) {
      const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', missingIds);
      setFormer(Object.fromEntries((data ?? []).map((p) => [p.id, p])));
    } else setFormer({});

    setGroup(g.data as Group | null); // emoji/currency/budget have DB defaults, never null in practice
    setMissing(!g.data);
    setExpenses(ex);
    setSplits(spl);
    setSettlements(stl);
    setMembers(mem);
    setInvites(i.data ?? []);
    setRecurring((rc.data ?? []) as Recurring[]);
    setCatBudgets(cb.data ?? []);
    setCategories(cc.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    // Materialise due recurring expenses first (no-op when nothing is due), then load.
    supabase.rpc('run_recurring', { p_group: id }).then(() => reload(), () => reload());
    const f = `group_id=eq.${id}`;
    let t: ReturnType<typeof setTimeout> | undefined;
    // One expense save touches several tables; debounce so we reload once.
    const bump = () => { clearTimeout(t); t = setTimeout(reload, 250); };
    // Unique topic per subscriber: the active-household provider and a detail page can watch the same group.
    const ch = supabase.channel(`group-${id}-${Math.random().toString(36).slice(2, 8)}`);
    ['expenses', 'expense_splits', 'settlements', 'group_members', 'invites', 'recurring_expenses', 'category_budgets', 'categories'].forEach((table) =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: f }, bump));
    ch.subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(ch); };
  }, [id, reload]);

  return { group, expenses, splits, settlements, members, former, invites, recurring, catBudgets, categories, loading, missing, reload };
}

export const displayName = (m: Member | undefined) =>
  m?.profiles?.full_name || m?.profiles?.email?.split('@')[0] || 'Member';
