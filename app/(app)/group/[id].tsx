import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Activity } from '@/components/group/Activity';
import { Members } from '@/components/group/Members';
import { MonthStats, Overview } from '@/components/group/Overview';
import { TransactionSheet } from '@/components/group/TransactionSheet';
import {
  Button, EmptyState, Field, Header, IconButton, Loading, Press, ProgressBar, Screen, Segmented, Sheet, s,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useFeedback } from '@/lib/feedback';
import { Expense, supabase } from '@/lib/supabase';
import { C, money, monthLabel, monthRange, R, S, sameMonth, shadow, T } from '@/lib/theme';
import { displayName, useGroup } from '@/lib/useGroup';

type Tab = 'overview' | 'activity' | 'members';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { toast } = useFeedback();
  const me = session?.user.id ?? '';
  const { group, expenses, members, invites, loading, missing, reload } = useGroup(id);

  const [tab, setTab] = useState<Tab>('overview');
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sheet, setSheet] = useState<{ open: boolean; editing: Expense | null }>({ open: false, editing: null });
  const [budgetOpen, setBudgetOpen] = useState(false);

  const isCurrent = sameMonth(month, new Date());
  const shiftMonth = (n: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + n, 1);
    if (next > new Date()) return;
    setMonth(next);
  };

  const budget = Number(group?.monthly_budget ?? 0);

  const stats: MonthStats = useMemo(() => {
    const { start, end } = monthRange(month);
    const items = expenses.filter((e) => e.spent_at >= start && e.spent_at <= end);
    const out = items.filter((e) => e.type === 'expense');
    const spent = out.reduce((a, e) => a + Number(e.amount), 0);
    const income = items.filter((e) => e.type === 'income').reduce((a, e) => a + Number(e.amount), 0);
    const tally = (key: (e: Expense) => string) => Object.entries(out.reduce<Record<string, number>>((a, e) => {
      a[key(e)] = (a[key(e)] ?? 0) + Number(e.amount); return a;
    }, {})).sort((a, b) => b[1] - a[1]);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const dayNow = isCurrent ? new Date().getDate() : daysInMonth;
    const avgPerDay = spent / Math.max(1, dayNow);
    return {
      spent, income, items, avgPerDay,
      byCat: tally((e) => e.category), byUser: tally((e) => e.user_id),
      projected: isCurrent && spent > 0 ? avgPerDay * daysInMonth : null,
      daysLeft: daysInMonth - dayNow + 1,
    };
  }, [expenses, month, isCurrent]);

  if (loading) return <Screen><Loading /></Screen>;
  if (missing || !group) {
    return (
      <Screen>
        <EmptyState emoji="🫥" title="Group not found" body="It may have been deleted, or you're no longer a member."
          action={<Button title="Back to groups" onPress={() => router.replace('/')} />} />
      </Screen>
    );
  }

  const cur = group.currency;
  const myRole = members.find((m) => m.user_id === me)?.role;
  const isOwner = group.owner_id === me;
  const isAdmin = isOwner || myRole === 'admin';
  const left = budget - stats.spent;
  const over = budget > 0 && left < 0;
  const nameOf = (uid: string) => (uid === me ? 'You' : displayName(members.find((m) => m.user_id === uid)));
  const canEdit = (e: Expense) => e.user_id === me;
  const openTx = (e: Expense | null) => setSheet({ open: true, editing: e });

  return (
    <Screen edges={['top']}>
      <Header
        left={<IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
        title={<Text>{group.emoji}  {group.name}</Text>}
        right={<IconButton icon="people-outline" label="Members" onPress={() => setTab('members')} />} />

      <ScrollView contentContainerStyle={{ padding: S.xl, paddingTop: S.sm, gap: S.xl, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled">
        {/* Summary hero */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <LinearGradient colors={over ? C.heroOver : C.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: R.lg, padding: S.xl, gap: S.md }}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <Press onPress={() => shiftMonth(-1)} accessibilityLabel="Previous month" style={hstyles.monthBtn}>
                <Ionicons name="chevron-back" size={16} color="#fff" />
              </Press>
              <Press onPress={() => !isCurrent && setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{monthLabel(month)}</Text>
              </Press>
              <Press onPress={() => shiftMonth(1)} disabled={isCurrent} accessibilityLabel="Next month" style={hstyles.monthBtn}>
                <Ionicons name="chevron-forward" size={16} color="#fff" />
              </Press>
            </View>

            <View>
              <Text style={hstyles.heroLabel}>
                {budget > 0 ? (over ? 'Over budget by' : isCurrent ? 'Left to spend' : 'Under budget by') : 'Spent'}
              </Text>
              <Animated.Text key={`${month.getTime()}-${left}`} entering={FadeIn.duration(300)}
                style={{ color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] }}>
                {money(budget > 0 ? Math.abs(left) : stats.spent, cur)}
              </Animated.Text>
            </View>

            {budget > 0 && <ProgressBar value={stats.spent / budget} color="#fff" track="rgba(255,255,255,0.22)" />}

            <View style={[s.row, { gap: S.sm }]}>
              <Stat label="Spent" value={money(stats.spent, cur)} />
              <Stat label="Income" value={money(stats.income, cur)} />
              <Press onPress={isAdmin ? () => setBudgetOpen(true) : undefined} style={{ flex: 1 }}
                accessibilityLabel="Edit monthly budget">
                <Stat label={isAdmin ? 'Budget ✎' : 'Budget'} value={budget > 0 ? money(budget, cur) : 'Set'} />
              </Press>
            </View>
          </LinearGradient>
        </Animated.View>

        <Segmented<Tab> value={tab} onChange={setTab}
          options={[{ value: 'overview', label: 'Overview' }, { value: 'activity', label: 'Activity' }, { value: 'members', label: 'Members' }]} />

        {tab === 'overview' && (
          <Overview stats={stats} cur={cur} budget={budget} nameOf={nameOf} canEdit={canEdit}
            onSeeAll={() => setTab('activity')} onOpen={openTx} onAdd={() => openTx(null)} />
        )}
        {tab === 'activity' && (
          <Activity items={stats.items} cur={cur} me={me} nameOf={nameOf} onOpen={openTx} canEdit={canEdit} />
        )}
        {tab === 'members' && (
          <Members group={group} members={members} invites={invites} me={me} isAdmin={isAdmin} isOwner={isOwner}
            reload={reload} onLeft={() => router.replace('/')} />
        )}
      </ScrollView>

      {tab !== 'members' && (
        <Animated.View entering={ZoomIn.delay(200).springify()} style={{ position: 'absolute', right: S.xl, bottom: S.xxl }}>
          <Press onPress={() => openTx(null)} accessibilityLabel="Add transaction" style={hstyles.fab}>
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Add</Text>
          </Press>
        </Animated.View>
      )}

      <TransactionSheet visible={sheet.open} editing={sheet.editing} onClose={() => setSheet({ open: false, editing: null })}
        groupId={group.id} me={me} cur={cur} onSaved={reload} />
      <BudgetSheet visible={budgetOpen} onClose={() => setBudgetOpen(false)} initial={budget} cur={cur}
        onSave={async (v) => {
          const { error } = await supabase.from('groups').update({ monthly_budget: v }).eq('id', group.id);
          if (error) return error.message;
          toast('Budget updated', 'success'); setBudgetOpen(false); reload();
        }} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: R.sm, padding: S.sm, paddingHorizontal: S.md }}>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function BudgetSheet({ visible, onClose, initial, cur, onSave }: {
  visible: boolean; onClose: () => void; initial: number; cur: string; onSave: (v: number) => Promise<string | void>;
}) {
  const [v, setV] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    const e = await onSave(v === null ? initial : Number(v) || 0);
    setBusy(false); setErr(e || null); if (!e) setV(null);
  };
  return (
    <Sheet visible={visible} onClose={() => { setErr(null); setV(null); onClose(); }} title="Monthly budget"
      footer={<Button title="Save budget" loading={busy} onPress={submit} />}>
      <Text style={[T.body, { color: C.sub }]}>Shared spending limit for everyone in this group. Set it to 0 to turn the budget off.</Text>
      <Field prefix={cur} keyboardType="decimal-pad" autoFocus placeholder={initial ? String(initial) : '0'}
        defaultValue={initial ? String(initial) : ''} onChangeText={(t) => { setV(t.replace(/[^0-9.]/g, '')); setErr(null); }}
        error={err} onSubmitEditing={submit} />
    </Sheet>
  );
}

const hstyles = {
  monthBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' } as const,
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontWeight: '600' } as const,
  fab: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 52, paddingHorizontal: S.xl, borderRadius: 26,
    backgroundColor: C.primary, ...shadow(C.primary, 0.5, 16, 6),
  } as any,
};
