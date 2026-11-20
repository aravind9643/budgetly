import { useCallback, useEffect, useState } from 'react';
import { Expense, Group, Invite, Member, supabase } from './supabase';

/** Loads one group with its transactions, members and pending invites, and keeps them live via Realtime. */
export function useGroup(id: string | undefined) {
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    const [g, e, m, i] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).maybeSingle(),
      supabase.from('expenses').select('*').eq('group_id', id)
        .order('spent_at', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('group_members').select('user_id, role, profiles(full_name, email)').eq('group_id', id),
      supabase.from('invites').select('*').eq('group_id', id).eq('status', 'pending').order('created_at'),
    ]);
    setGroup(g.data);
    setMissing(!g.data);
    setExpenses(e.data ?? []);
    setMembers((m.data ?? []) as any);
    setInvites(i.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    reload();
    const f = `group_id=eq.${id}`;
    const ch = supabase.channel(`group-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: f }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: f }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invites', filter: f }, reload)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, reload]);

  return { group, expenses, members, invites, loading, missing, reload };
}

export const displayName = (m: Member | undefined) =>
  m?.profiles?.full_name || m?.profiles?.email?.split('@')[0] || 'Member';
