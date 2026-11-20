import { useCallback, useEffect, useState } from 'react';
import { Expense, Group, Invite, Member, Profile, Settlement, Split, supabase } from './supabase';

/** Loads one group with its transactions, splits, repayments, members and invites, and keeps them live via Realtime. */
export function useGroup(id: string | undefined) {
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<Split[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [former, setFormer] = useState<Record<string, Profile>>({});
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    const [g, e, sp, st, m, i] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).maybeSingle(),
      supabase.from('expenses').select('*').eq('group_id', id)
        .order('spent_at', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('expense_splits').select('expense_id, user_id, amount, weight').eq('group_id', id),
      supabase.from('settlements').select('*').eq('group_id', id).order('created_at', { ascending: false }),
      supabase.from('group_members').select('user_id, role, joined_at, profiles(full_name, email)').eq('group_id', id),
      supabase.from('invites').select('*').eq('group_id', id).eq('status', 'pending').order('created_at'),
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

    setGroup(g.data);
    setMissing(!g.data);
    setExpenses(ex);
    setSplits(spl);
    setSettlements(stl);
    setMembers(mem);
    setInvites(i.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    reload();
    const f = `group_id=eq.${id}`;
    let t: ReturnType<typeof setTimeout> | undefined;
    // One expense save touches several tables; debounce so we reload once.
    const bump = () => { clearTimeout(t); t = setTimeout(reload, 250); };
    // Unique topic per subscriber: the active-household provider and a detail page can watch the same group.
    const ch = supabase.channel(`group-${id}-${Math.random().toString(36).slice(2, 8)}`);
    ['expenses', 'expense_splits', 'settlements', 'group_members', 'invites'].forEach((table) =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: f }, bump));
    ch.subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(ch); };
  }, [id, reload]);

  return { group, expenses, splits, settlements, members, former, invites, loading, missing, reload };
}

export const displayName = (m: Member | undefined) =>
  m?.profiles?.full_name || m?.profiles?.email?.split('@')[0] || 'Member';
