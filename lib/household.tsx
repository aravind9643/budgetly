import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { computeBalances, simplifyDebts, Transfer } from './balances';
import { useAuth } from './auth';
import { Expense, Group, Invite, supabase } from './supabase';
import { useGroup } from './useGroup';

export type HouseholdRow = Group & { memberCount: number; memberNames: string[]; created_at?: string };
const KEY = 'budgetly.activeHousehold';

type Ctx = {
  households: HouseholdRow[] | null;
  /** Pending email invitations addressed to the signed-in user. */
  invites: Invite[];
  activeId: string | null;
  setActive: (id: string) => void;
  refreshHouseholds: () => Promise<void>;
  data: ReturnType<typeof useGroup>;
  net: Record<string, number>;
  transfers: Transfer[];
  /** Opens the global add/edit sheet (rendered by the tabs layout). */
  openAdd: (editing?: Expense | null, groupId?: string) => void;
  sheet: { open: boolean; editing: Expense | null; groupId: string | null };
  closeSheet: () => void;
};

const HouseholdCtx = createContext<Ctx>(null as any);
export const useHousehold = () => useContext(HouseholdCtx);

/**
 * The household the Home, Stats and + button act on, like a "current workspace".
 * Persisted per device. Falls back to the first household when the saved one disappears.
 */
export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [households, setHouseholds] = useState<HouseholdRow[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Ctx['sheet']>({ open: false, editing: null, groupId: null });

  const email = session?.user.email?.toLowerCase();
  const [invites, setInvites] = useState<Invite[]>([]);

  const refreshHouseholds = useCallback(async () => {
    if (!uid) return;
    if (email) {
      const { data: inv } = await supabase.from('invites').select('*, groups(*)').eq('email', email).eq('status', 'pending');
      setInvites((inv ?? []) as Invite[]);
    }
    const { data: mine } = await supabase.from('group_members').select('group_id').eq('user_id', uid);
    const ids = (mine ?? []).map((m) => m.group_id);
    if (!ids.length) { setHouseholds([]); return; }
    const [{ data: gs }, { data: mem }] = await Promise.all([
      supabase.from('groups').select('*').in('id', ids).order('created_at'),
      supabase.from('group_members').select('group_id, user_id, profiles(full_name, email)').in('group_id', ids),
    ]);
    setHouseholds((gs ?? []).map((g: any) => {
      const ms = (mem ?? []).filter((m: any) => m.group_id === g.id);
      return {
        ...g, memberCount: ms.length,
        memberNames: ms.map((m: any) => m.profiles?.full_name || m.profiles?.email?.split('@')[0] || '?'),
      };
    }));
  }, [uid, email]);

  useEffect(() => { refreshHouseholds(); }, [refreshHouseholds]);

  // Restore / repair the active household whenever the list changes.
  useEffect(() => {
    if (!households) return;
    (async () => {
      let saved: string | null = null;
      try { saved = await AsyncStorage.getItem(KEY); } catch {}
      const pick = [activeId, saved].find((x) => x && households.some((h) => h.id === x)) ?? households[0]?.id ?? null;
      if (pick !== activeId) setActiveId(pick);
    })();
  }, [households]);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    AsyncStorage.setItem(KEY, id).catch(() => {});
  }, []);

  const data = useGroup(activeId ?? undefined);
  const memberIds = useMemo(() => data.members.map((m) => m.user_id), [data.members]);
  const net = useMemo(() => computeBalances(data.expenses, data.splits, data.settlements, memberIds),
    [data.expenses, data.splits, data.settlements, memberIds]);
  const transfers = useMemo(() => simplifyDebts(net), [net]);

  const value: Ctx = {
    households, invites, activeId, setActive, refreshHouseholds, data, net, transfers, sheet,
    openAdd: (editing = null, groupId) => setSheet({ open: true, editing, groupId: groupId ?? activeId }),
    closeSheet: () => setSheet({ open: false, editing: null, groupId: null }),
  };
  return <HouseholdCtx.Provider value={value}>{children}</HouseholdCtx.Provider>;
}
