import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BudgetSheet } from '@/components/BudgetSheet';
import { TransactionRow } from '@/components/group/TransactionRow';
import { HouseholdPicker } from '@/components/HouseholdPicker';
import { ListRow, PageTitle } from '@/components/Nav';
import { Button, Card, Divider, EmptyState, Press, ProgressBar, Screen, Skeleton, s } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useHousehold } from '@/lib/household';
import { Expense } from '@/lib/supabase';
import { C, money, monthRange, parseYmd, R, S, T } from '@/lib/theme';
import { displayName } from '@/lib/useGroup';

function HomeSkeleton({ bare }: { bare?: boolean }) {
  return (
    <View style={{ padding: S.xl, paddingTop: bare ? 0 : S.xl, gap: S.lg }}>
      {!bare && <View style={{ gap: 8, marginBottom: S.sm }}><Skeleton h={14} w={110} /><Skeleton h={30} w={160} /></View>}
      <Skeleton h={190} r={26} />
      <Skeleton h={84} r={22} />
      <Skeleton h={130} r={22} />
      <Skeleton h={24} w={180} />
      <Skeleton h={64} r={22} />
    </View>
  );
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Home() {
  const router = useRouter();
  const { session } = useAuth();
  const { households, activeId, data, net, refreshHouseholds, openAdd } = useHousehold();
  const [picker, setPicker] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const me = session?.user.id ?? '';
  const name = (session?.user.user_metadata?.full_name as string) || session?.user.email?.split('@')[0] || '';

  const header = (
    <PageTitle eyebrow={greeting()} title={name}
      right={households?.length ? (
        <Press onPress={() => setPicker(true)} accessibilityLabel="Switch household"
          style={[s.row, { gap: 6, backgroundColor: C.surface, borderRadius: R.pill, paddingLeft: 6, paddingRight: 12, height: 44, maxWidth: 200,
            borderWidth: 1, borderColor: C.border }]}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 16 }}>{data.group?.emoji ?? '🏠'}</Text>
          </View>
          <Text style={[T.body, { fontWeight: '700', flexShrink: 1 }]} numberOfLines={1}>{data.group?.name ?? '…'}</Text>
          <Ionicons name="chevron-down" size={16} color={C.sub} />
        </Press>
      ) : undefined} />
  );

  if (households === null) return <Screen edges={['top']}><HomeSkeleton /></Screen>;

  if (!households.length) {
    return (
      <Screen edges={['top']}>
        {header}
        <View style={{ padding: S.xl }}>
          <Card>
            <EmptyState emoji="🏡" title="Set up your first household"
              body="A household is one shared budget: your home, a flatshare, a trip. Create one or join with an invite code."
              action={
                <View style={{ gap: S.sm }}>
                  <Button title="Create household" icon="add" onPress={() => router.push('/new-group')} />
                  <Button title="I've been invited" variant="secondary" icon="mail-open-outline" onPress={() => setPicker(true)} />
                </View>
              } />
          </Card>
        </View>
        <HouseholdPicker visible={picker} onClose={() => setPicker(false)} />
      </Screen>
    );
  }

  const g = data.group;
  const cur = g?.currency ?? 'USD';
  const now = new Date();
  const { start, end } = monthRange(now);
  const month = data.expenses.filter((e) => e.spent_at >= start && e.spent_at <= end);
  const spent = month.filter((e) => e.type === 'expense').reduce((a, e) => a + Number(e.amount), 0);
  const budget = Number(g?.monthly_budget ?? 0);
  const left = budget - spent;
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
  const myNet = net[me] ?? 0;
  const settled = Math.abs(myNet) < 0.005;
  const myRole = data.members.find((m) => m.user_id === me)?.role;
  const canEditBudget = g?.owner_id === me || myRole === 'admin';
  const nameOf = (u: string) => (u === me ? 'You' : displayName(data.members.find((m) => m.user_id === u)));

  // Recent: last 8, grouped by day.
  const recent = data.expenses.slice(0, 8);
  const days = [...recent.reduce((m, e) => m.set(e.spent_at, [...(m.get(e.spent_at) ?? []), e]), new Map<string, Expense[]>())];

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl tintColor={C.sub} refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await Promise.all([refreshHouseholds(), data.reload()]); setRefreshing(false); }} />}>
        {header}
        {!g ? <HomeSkeleton bare /> : (
          <View style={{ paddingHorizontal: S.xl, gap: S.lg }}>
            {/* Budget hero */}
            <Animated.View entering={FadeInDown.duration(350)}
              style={{ backgroundColor: left < 0 && budget > 0 ? C.negative : C.primary, borderRadius: 26, padding: S.xl, gap: S.md }}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '600' }}>
                  {budget > 0 ? (left >= 0 ? 'Left this month' : 'Budget exceeded by') : 'Spent this month'}
                </Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: R.pill }}>
                  <Text style={{ color: '#fff', fontWeight: '600' }}>{now.toLocaleDateString(undefined, { month: 'long' })}</Text>
                </View>
              </View>
              <Text style={{ color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] }} adjustsFontSizeToFit numberOfLines={1}>
                {money(budget > 0 ? Math.abs(left) : spent, cur)}
              </Text>
              {budget > 0 ? (
                <>
                  <ProgressBar value={spent / budget} color="#FFFFFF" track="rgba(255,255,255,0.25)" height={10} semantic={false} />
                  <View style={[s.row, { justifyContent: 'space-between' }]}>
                    <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{money(spent, cur)} spent</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)' }}>of {money(budget, cur)}</Text>
                  </View>
                  {/* The number people act on: what they can still spend per day. */}
                  <View style={[s.row, { gap: S.sm, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: R.md, padding: S.md }]}>
                    <Ionicons name={left >= 0 ? 'calendar-outline' : 'alert-circle-outline'} size={18} color="#fff" />
                    <Text style={{ color: '#fff', flex: 1, fontWeight: '600' }}>
                      {left >= 0
                        ? <>{money(left / daysLeft, cur)}/day for the {daysLeft} day{daysLeft === 1 ? '' : 's'} left</>
                        : <>Over by {money(-left, cur)}. Pause non-essentials for {daysLeft} day{daysLeft === 1 ? '' : 's'}</>}
                    </Text>
                  </View>
                </>
              ) : (
                <Press onPress={() => setBudgetOpen(true)}>
                  <Text style={{ color: '#fff', fontWeight: '700', textDecorationLine: 'underline' }}>Set a monthly budget</Text>
                </Press>
              )}
            </Animated.View>

            {/* Who owes who */}
            <Card onPress={() => router.push('/balances')} style={[s.row, { gap: S.md, paddingVertical: S.lg }]}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="swap-horizontal" size={22} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[T.body, { color: C.sub, fontSize: 14 }]}>Who owes who</Text>
                <Text style={[T.heading, { fontSize: 18 }, !settled && { color: myNet > 0 ? C.positive : C.negative }]}>
                  {settled ? "You're all square 🎉" : myNet > 0 ? `You're owed ${money(myNet, cur)}` : `You owe ${money(-myNet, cur)}`}
                </Text>
              </View>
              {settled
                ? <Ionicons name="checkmark-circle" size={26} color={C.positive} />
                : (
                  <View style={{ backgroundColor: myNet < 0 ? C.primary : C.primarySoft, borderRadius: R.pill, paddingHorizontal: 14, height: 36, justifyContent: 'center' }}>
                    <Text style={{ color: myNet < 0 ? '#fff' : C.primary, fontWeight: '700' }}>{myNet < 0 ? 'Settle up' : 'View'}</Text>
                  </View>
                )}
            </Card>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <ListRow icon="wallet-outline" tint={C.positive} title="Budget"
                subtitle={budget > 0 ? `${money(budget, cur)} per month` : 'Not set'} onPress={() => setBudgetOpen(true)} />
              <Divider />
              <ListRow icon="settings-outline" tint="#7C5CD6" title="Household settings"
                subtitle={`${data.members.length} member${data.members.length === 1 ? '' : 's'} · invite, roles`}
                onPress={() => router.push(`/group/${activeId}`)} />
            </Card>

            {/* Recent expenses */}
            <View style={[s.row, { justifyContent: 'space-between', marginTop: S.md }]}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.5 }}>Recent expenses</Text>
              {recent.length > 0 && (
                <Press onPress={() => router.push('/expenses')} style={[s.row, { gap: 2 }]}>
                  <Text style={{ color: C.primary, fontWeight: '700' }}>See all expenses</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.primary} />
                </Press>
              )}
            </View>
            {recent.length === 0 ? (
              <Card><EmptyState emoji="🧾" title="No expenses yet" body="Tap + to add the first one."
                action={<Button title="Add expense" icon="add" onPress={() => openAdd(null)} />} /></Card>
            ) : days.map(([day, list]) => (
              <View key={day} style={{ gap: S.sm }}>
                <Text style={[T.label, { textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: S.xs }]}>
                  {parseYmd(day).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                </Text>
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  {list.map((e, i) => (
                    <View key={e.id}>
                      {i > 0 && <Divider />}
                      <TransactionRow e={e} cur={cur} who={nameOf(e.paid_by ?? e.user_id)}
                        splitCount={e.type === 'expense' && !e.is_personal ? data.splits.filter((x) => x.expense_id === e.id).length : 0}
                        onPress={e.user_id === me ? () => openAdd(e) : undefined} />
                    </View>
                  ))}
                </Card>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <HouseholdPicker visible={picker} onClose={() => setPicker(false)} />
      {g && <BudgetSheet visible={budgetOpen} onClose={() => setBudgetOpen(false)} groupId={g.id} initial={budget} cur={cur}
        canEdit={canEditBudget} onSaved={() => { data.reload(); refreshHouseholds(); }} />}
    </Screen>
  );
}
