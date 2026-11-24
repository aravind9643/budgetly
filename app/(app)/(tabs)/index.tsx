import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BudgetSheet } from '@/components/BudgetSheet';
import { TransactionRow } from '@/components/group/TransactionRow';
import { SpaceHeader } from '@/components/SpaceHeader';
import { Button, Card, Divider, EmptyState, Press, Screen, Skeleton, s } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useHousehold } from '@/lib/household';
import { C, catMeta, money, monthRange, R, S, T } from '@/lib/theme';
import { displayName } from '@/lib/useGroup';

export default function Overview() {
  const router = useRouter();
  const { session } = useAuth();
  const { households, data, net, refreshHouseholds, openAdd } = useHousehold();
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const me = session?.user.id ?? '';

  if (households === null || (households.length && !data.group)) {
    return (
      <Screen edges={['top']}>
        <SpaceHeader title="Overview" />
        <View style={{ padding: S.xl, gap: S.lg }}><Skeleton h={200} r={18} /><Skeleton h={64} r={18} /><Skeleton h={240} r={18} /></View>
      </Screen>
    );
  }

  if (!households.length) {
    return (
      <Screen edges={['top']}>
        <SpaceHeader title="Welcome" />
        <View style={{ padding: S.xl }}>
          <Card>
            <EmptyState emoji="✦" title="Start a shared space"
              body="A space is one shared budget for a home, a trip or a flat. Start one, or join a space with a code someone sent you."
              action={
                <View style={{ gap: S.sm }}>
                  <Button title="New space" icon="add" onPress={() => router.push('/new-group')} />
                  <Button title="Settings & spaces" variant="secondary" icon="settings-outline" onPress={() => router.push('/settings')} />
                </View>
              } />
          </Card>
        </View>
      </Screen>
    );
  }

  const g = data.group!;
  const cur = g.currency;
  const now = new Date();
  const { start, end } = monthRange(now);
  const monthItems = data.expenses.filter((e) => e.spent_at >= start && e.spent_at <= end && e.type === 'expense');
  const spent = monthItems.reduce((a, e) => a + Number(e.amount), 0);
  const budget = Number(g.monthly_budget ?? 0);
  const available = budget - spent;
  const over = budget > 0 && available < 0;
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
  const myNet = net[me] ?? 0;
  const even = Math.abs(myNet) < 0.005;
  const canEditBudget = g.owner_id === me || data.members.find((m) => m.user_id === me)?.role === 'admin';
  const nameOf = (u: string) => (u === me ? 'You' : displayName(data.members.find((m) => m.user_id === u)));
  const monthName = now.toLocaleDateString(undefined, { month: 'long' });

  // Composition bar: spending by category, then what's still available.
  const byCat = Object.entries(monthItems.reduce<Record<string, number>>((a, e) => { a[e.category] = (a[e.category] ?? 0) + Number(e.amount); return a; }, {}))
    .sort((a, b) => b[1] - a[1]);
  const scale = Math.max(budget, spent) || 1;
  const latest = data.expenses.slice(0, 5);

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl tintColor={C.sub} refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await Promise.all([refreshHouseholds(), data.reload()]); setRefreshing(false); }} />}>
        <SpaceHeader title="Overview" />
        <View style={{ paddingHorizontal: S.xl, paddingTop: S.lg, gap: S.lg }}>

          {/* Available this month */}
          <Animated.View entering={FadeIn.duration(300)}>
            <Card style={{ padding: S.xl, gap: S.lg }}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={T.label}>{budget > 0 ? (over ? `Over budget · ${monthName}` : `Available · ${monthName}`) : `Spent · ${monthName}`}</Text>
                <Press onPress={() => setBudgetOpen(true)} accessibilityLabel="Edit budget">
                  <Text style={{ color: C.primary, fontWeight: '700', fontSize: 13 }}>{budget > 0 ? 'Edit budget' : 'Set budget'}</Text>
                </Press>
              </View>
              <Text style={{ fontSize: 42, fontWeight: '800', letterSpacing: -1.2, color: over ? C.negative : C.text, fontVariant: ['tabular-nums'] }}
                numberOfLines={1} adjustsFontSizeToFit>
                {money(budget > 0 ? Math.abs(available) : spent, cur)}
              </Text>

              {budget > 0 && (
                <View style={{ gap: S.sm }}>
                  <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: C.surface2, gap: 2 }}>
                    {byCat.map(([c, v]) => <View key={c} style={{ width: `${(v / scale) * 100}%`, backgroundColor: catMeta(c).color }} />)}
                  </View>
                  <View style={[s.row, { justifyContent: 'space-between' }]}>
                    <Text style={T.caption}>{money(spent, cur)} spent</Text>
                    <Text style={T.caption}>{money(budget, cur)} budget</Text>
                  </View>
                </View>
              )}

              <View style={[s.row, { gap: S.sm }]}>
                <View style={[s.row, { gap: 6, flex: 1, padding: S.md, borderRadius: R.md, backgroundColor: C.surface2 }]}>
                  <Ionicons name="today-outline" size={16} color={C.sub} />
                  <Text style={[T.body, { fontSize: 14, color: C.sub }]} numberOfLines={1}>
                    {budget > 0 && available > 0
                      ? <><Text style={{ color: C.text, fontWeight: '700' }}>{money(available / daysLeft, cur)}</Text>/day</>
                      : <Text style={{ color: C.text, fontWeight: '700' }}>{monthItems.length} expenses</Text>}
                  </Text>
                </View>
                <View style={[s.row, { gap: 6, flex: 1, padding: S.md, borderRadius: R.md, backgroundColor: C.surface2 }]}>
                  <Ionicons name="hourglass-outline" size={16} color={C.sub} />
                  <Text style={[T.body, { fontSize: 14, color: C.sub }]} numberOfLines={1}>
                    <Text style={{ color: C.text, fontWeight: '700' }}>{daysLeft}</Text> day{daysLeft === 1 ? '' : 's'} to go
                  </Text>
                </View>
              </View>
            </Card>
          </Animated.View>

          {/* Your balance */}
          <Card onPress={() => router.push('/balances')} style={[s.row, { gap: S.md, paddingVertical: S.md }]}>
            <View style={{ width: 8, alignSelf: 'stretch', borderRadius: 4, backgroundColor: even ? C.border : myNet > 0 ? C.positive : C.negative }} />
            <View style={{ flex: 1 }}>
              <Text style={T.caption}>Your balance in {g.name}</Text>
              <Text style={[T.heading, { fontVariant: ['tabular-nums'] }, !even && { color: myNet > 0 ? C.positive : C.negative }]}>
                {even ? 'Even with everyone' : myNet > 0 ? `+${money(myNet, cur)} owed to you` : `${money(-myNet, cur)} to settle`}
              </Text>
            </View>
            <View style={{ paddingHorizontal: 12, height: 32, borderRadius: R.pill, justifyContent: 'center', backgroundColor: C.surface2 }}>
              <Text style={{ fontWeight: '700', color: C.text, fontSize: 13 }}>{even ? 'Details' : myNet < 0 ? 'Settle' : 'Details'}</Text>
            </View>
          </Card>

          {/* Latest */}
          <View style={{ gap: S.sm, marginTop: S.sm }}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>Latest</Text>
              {latest.length > 0 && (
                <Press onPress={() => router.push('/activity')}><Text style={{ color: C.primary, fontWeight: '700' }}>All activity</Text></Press>
              )}
            </View>
            {latest.length === 0 ? (
              <Card><EmptyState emoji="🧾" title="Nothing logged yet" body={`Expenses you and others add to ${g.name} appear here.`}
                action={<Button title="New expense" icon="add" onPress={() => openAdd(null)} />} /></Card>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {latest.map((e, i) => (
                  <View key={e.id}>
                    {i > 0 && <Divider />}
                    <TransactionRow e={e} cur={cur} who={nameOf(e.paid_by ?? e.user_id)} showDate
                      splitCount={e.type === 'expense' && !e.is_personal ? data.splits.filter((x) => x.expense_id === e.id).length : 0}
                      onPress={e.user_id === me ? () => openAdd(e) : undefined} />
                  </View>
                ))}
              </Card>
            )}
          </View>
        </View>
      </ScrollView>
      <BudgetSheet visible={budgetOpen} onClose={() => setBudgetOpen(false)} groupId={g.id} initial={budget} cur={cur}
        canEdit={canEditBudget} onSaved={() => { data.reload(); refreshHouseholds(); }} />
    </Screen>
  );
}
