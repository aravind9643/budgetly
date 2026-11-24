import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { computeBalances, simplifyDebts, Transfer } from './balances';
import { useAuth } from './auth';
import { Expense, Group, Invite, supabase } from './supabase';
import { useGroup } from './useGroup';
import { catMeta, setCustomCategories } from './theme';
import { BudgetAlert, budgetAlerts } from './alerts';
import { useFeedback } from './feedback';
import { takeParkedInvite } from './links';

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
  /** Budgets at or above 80% this month (overall and per category). */
  alerts: BudgetAlert[];
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

  // Redeem an invite link opened earlier (possibly before signing in).
  const { toast: notify } = useFeedback();
  useEffect(() => {
    if (!uid || households === null) return;
    takeParkedInvite().then(async (code) => {
      if (!code) return;
      const { data: gid, error } = await supabase.rpc('join_group_by_code', { code });
      if (error) return notify(error.message, 'error');
      await refreshHouseholds(); setActive(gid);
      notify('Joined. It is now your current space', 'success');
    });
  }, [uid, households === null]);

  const data = useGroup(activeId ?? undefined);
  setCustomCategories(data.categories); // synchronous: every child render sees this space's categories
  const memberIds = useMemo(() => data.members.map((m) => m.user_id), [data.members]);
  const net = useMemo(() => computeBalances(data.expenses, data.splits, data.settlements, memberIds),
    [data.expenses, data.splits, data.settlements, memberIds]);
  const transfers = useMemo(() => simplifyDebts(net), [net]);

  // Budget alerts: computed from this month's spending vs. the overall and per-category limits.
  const alerts = useMemo(() => budgetAlerts(data.expenses, Number(data.group?.monthly_budget ?? 0), data.catBudgets, (k) => catMeta(k).label), [data.expenses, data.group?.monthly_budget, data.catBudgets]);
  // Toast when a limit crosses 80% or 100% while the app is open (including other members' entries arriving live).
  const { toast } = useFeedback();
  const prevLevels = useRef<{ space: string | null; levels: Record<string, number> } | null>(null);
  useEffect(() => {
    if (!data.group) return;
    const levels = Object.fromEntries(alerts.map((a) => [a.key, a.level]));
    const prev = prevLevels.current;
    if (prev && prev.space === data.group.id) {
      const crossed = alerts.filter((a) => a.level > (prev.levels[a.key] ?? 0)).sort((x, y) => y.level - x.level)[0];
      if (crossed) toast(crossed.level >= 100 ? `${crossed.label} budget is used up` : `${crossed.label} is at ${Math.round(crossed.pct * 100)}% of its budget`, crossed.level >= 100 ? 'error' : 'info');
    }
    prevLevels.current = { space: data.group.id, levels };
  }, [alerts, data.group?.id]);

  const value: Ctx = {
    households, invites, activeId, setActive, refreshHouseholds, data, net, transfers, alerts, sheet,
    openAdd: (editing = null, groupId) => setSheet({ open: true, editing, groupId: groupId ?? activeId }),
    closeSheet: () => setSheet({ open: false, editing: null, groupId: null }),
  };
  return <HouseholdCtx.Provider value={value}>{children}</HouseholdCtx.Provider>;
}
