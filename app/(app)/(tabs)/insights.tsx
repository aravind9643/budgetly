import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '@/components/Typography';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Donut } from '@/components/Donut';
import { MonthSwitcher } from '@/components/Nav';
import { SpaceHeader } from '@/components/SpaceHeader';
import { Avatar, Button, Card, EmptyState, IconButton, Loading, ProgressBar, Screen, s } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { exportCsv } from '@/lib/export';
import { useHousehold } from '@/lib/household';
import { C, catMeta, money, monthLabel, monthRange, R, S, sameMonth, T } from '@/lib/theme';
import { displayName } from '@/lib/useGroup';
import { useThemeMode } from '@/lib/themeMode';

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

export default function Insights() {
  useThemeMode(); // re-render this screen when light/dark changes
  const router = useRouter();
  const { session } = useAuth();
  const { data, households } = useHousehold();
  const me = session?.user.id ?? '';
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const isCurrent = sameMonth(month, new Date());
  const g = data.group;
  const cur = g?.currency ?? 'USD';
  const budget = Number(g?.monthly_budget ?? 0);
  const nameOf = (u: string) => (u === me ? 'You' : displayName(data.members.find((m) => m.user_id === u)));

  const st = useMemo(() => {
    const out = data.expenses.filter((e) => e.type === 'expense');
    const inMonth = (m: Date) => { const r = monthRange(m); return out.filter((e) => e.spent_at >= r.start && e.spent_at <= r.end); };
    const items = inMonth(month);
    const spent = items.reduce((a, e) => a + Number(e.amount), 0);
    const byCat = Object.entries(items.reduce<Record<string, number>>((a, e) => { a[e.category] = (a[e.category] ?? 0) + Number(e.amount); return a; }, {}))
      .sort((a, b) => b[1] - a[1]);
    const byPayer = Object.entries(items.filter((e) => !e.is_personal).reduce<Record<string, number>>((a, e) => {
      const k = e.paid_by ?? e.user_id; a[k] = (a[k] ?? 0) + Number(e.amount); return a;
    }, {})).sort((a, b) => b[1] - a[1]);
    const biggest = items.reduce<typeof items[number] | null>((m, e) => (!m || Number(e.amount) > Number(m.amount) ? e : m), null);
    const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const dayNow = isCurrent ? new Date().getDate() : daysIn;
    const perDay = spent / Math.max(1, dayNow);
    const six = Array.from({ length: 6 }, (_, i) => {
      const m = new Date(month.getFullYear(), month.getMonth() - 5 + i, 1);
      return { m, total: inMonth(m).reduce((a, e) => a + Number(e.amount), 0) };
    });
    const prev = six[4].total;
    return { items, spent, byCat, byPayer, biggest, perDay, estimate: isCurrent ? perDay * daysIn : null, six, prev };
  }, [data.expenses, month, isCurrent]);

  // One plain-language observation, most useful first.
  const insight = useMemo(() => {
    if (!st.items.length) return null;
    if (budget > 0 && st.spent > budget) return `You're ${money(st.spent - budget, cur)} over this month's budget.`;
    if (st.estimate && budget > 0 && st.estimate > budget) return `At this pace you'll end the month around ${money(st.estimate, cur)}, above your ${money(budget, cur)} budget.`;
    if (st.prev > 0) {
      const d = (st.spent - st.prev) / st.prev;
      if (!isCurrent && Math.abs(d) >= 0.1) return `You spent ${Math.round(Math.abs(d) * 100)}% ${d < 0 ? 'less' : 'more'} than the month before.`;
    }
    const [cat, v] = st.byCat[0];
    return `${catMeta(cat).label} is ${Math.round((v / st.spent) * 100)}% of your spending ${isCurrent ? 'this month' : `in ${month.toLocaleDateString(undefined, { month: 'long' })}`}.`;
  }, [st, budget, cur, isCurrent, month]);

  if (households === null) return <Screen edges={['top']}><Loading /></Screen>;
  if (!g) {
    return (
      <Screen edges={['top']}>
        <SpaceHeader title="Insights" />
        <View style={{ padding: S.xl }}><Card><EmptyState emoji="📊" title="No space yet" body="Start or join a space to see insights." /></Card></View>
      </Screen>
    );
  }

  const max6 = Math.max(1, ...st.six.map((x) => x.total));
  const pct = budget > 0 ? st.spent / budget : 0;

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <SpaceHeader title="Insights"
          right={<IconButton icon="download-outline" label="Export CSV" size={48}
            onPress={() => exportCsv(`${g.name}-${monthRange(month).start.slice(0, 7)}.csv`, st.items, cur, nameOf)} />} />
        <View style={{ height: S.md }} />
        <MonthSwitcher label={monthLabel(month)} nextDisabled={isCurrent}
          onPrev={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          onNext={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />

        <View style={{ paddingHorizontal: S.xl, gap: S.lg }}>
          {/* Spent summary: flat, typographic */}
          <Animated.View key={month.getTime()} entering={FadeIn.duration(250)}>
            <Card style={{ gap: S.md, padding: S.xl }}>
              <Text style={T.label}>Spent in {month.toLocaleDateString(undefined, { month: 'long' })}</Text>
              <Text style={{ color: C.text, fontSize: 38, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] }} adjustsFontSizeToFit numberOfLines={1}>
                {money(st.spent, cur)}
              </Text>
              {st.items.length > 0 && (
                <Text style={[T.body, { color: C.sub }]}>
                  ≈ {money(st.perDay, cur)} a day{st.estimate ? ` · on track for ${money(st.estimate, cur)}` : ''}
                </Text>
              )}
              {budget > 0 && (
                <View style={{ gap: 6 }}>
                  <ProgressBar value={pct} height={8} />
                  <Text style={T.caption}>{Math.round(pct * 100)}% of the {money(budget, cur)} budget</Text>
                </View>
              )}
              <Button title="Open in Activity" icon="list" variant="secondary"
                onPress={() => router.push({ pathname: '/activity', params: { m: monthRange(month).start.slice(0, 7) } })} />
            </Card>
          </Animated.View>

          {insight && (
            <Card style={[s.row, { gap: S.md, alignItems: 'flex-start' }]}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="bulb" size={26} color={C.accent} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: C.primary, fontWeight: '800', letterSpacing: 0.8, fontSize: 13 }}>WORTH KNOWING</Text>
                <View style={{ backgroundColor: C.surface2, borderRadius: R.md, padding: S.md }}>
                  <Text style={[T.body, { fontSize: 16, lineHeight: 22 }]}>{insight}</Text>
                </View>
              </View>
            </Card>
          )}

          {/* Six-month trend */}
          <Card style={{ gap: S.lg }}>
            <Text style={[T.heading, { fontSize: 20 }]}>Six-month trend</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: S.sm, height: 150 }}>
              {st.six.map(({ m, total }) => {
                const on = sameMonth(m, month);
                return (
                  <View key={m.getTime()} style={{ flex: 1, alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                    <Text style={{ fontSize: 10, color: on ? C.text : C.muted, fontWeight: '700' }} numberOfLines={1}>
                      {total > 0 ? money(total, cur, true) : ''}
                    </Text>
                    <View style={{ width: '100%', height: `${Math.max(3, (total / max6) * 100)}%` as any, maxHeight: 110,
                      borderRadius: 10, backgroundColor: on ? C.primary : C.primarySoft }} />
                    <Text style={{ fontSize: 12, color: on ? C.text : C.sub, fontWeight: on ? '700' : '500' }}>
                      {m.toLocaleDateString(undefined, { month: 'short' })}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* KPI tiles */}
          <View style={[s.row, { gap: S.sm, alignItems: 'stretch' }]}>
            <Kpi label="Entries" value={String(st.items.length)} caption="this month" />
            <Kpi label="Average" value={st.items.length ? money(st.spent / st.items.length, cur) : '—'} caption="per expense" />
            <Kpi label="Largest" value={st.biggest ? money(Number(st.biggest.amount), cur) : '—'} caption={st.biggest?.title ?? ' '} />
          </View>

          {/* By category */}
          <Card style={{ gap: S.lg }}>
            <Text style={[T.heading, { fontSize: 20 }]}>Where it went</Text>
            {st.byCat.length === 0 ? <EmptyState emoji="🍩" title="Nothing spent this month" /> : (
              <>
                <View style={{ alignItems: 'center' }}>
                  <Donut slices={st.byCat.map(([c, v]) => ({ value: v, color: catMeta(c).color }))}>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] }}>{money(st.spent, cur)}</Text>
                    <Text style={[T.body, { color: C.sub }]}>{isCurrent ? 'this month' : month.toLocaleDateString(undefined, { month: 'long' })}</Text>
                  </Donut>
                </View>
                {st.byCat.map(([c, v]) => {
                  const m = catMeta(c);
                  return (
                    <View key={c} style={[s.row, { gap: S.md }]}>
                      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: m.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                        {m.emoji ? <Text style={{ fontSize: 17 }}>{m.emoji}</Text> : <Ionicons name={m.icon} size={18} color={m.color} />}
                      </View>
                      <Text style={[T.body, { flex: 1, fontWeight: '600' }]}>{m.label}</Text>
                      <Text style={[T.caption, { width: 40, textAlign: 'right' }]}>{Math.round((v / st.spent) * 100)}%</Text>
                      <Text style={[T.body, { fontWeight: '700', minWidth: 96, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>{money(v, cur)}</Text>
                    </View>
                  );
                })}
              </>
            )}
          </Card>

          {st.byPayer.length > 1 && (
            <Card style={{ gap: S.lg }}>
              <Text style={[T.heading, { fontSize: 20 }]}>Paid by member</Text>
              {st.byPayer.map(([u, v]) => {
                const total = st.byPayer.reduce((a, x) => a + x[1], 0) || 1;
                return (
                  <View key={u} style={{ gap: S.sm }}>
                    <View style={[s.row, { gap: S.md }]}>
                      <Avatar name={nameOf(u)} size={32} />
                      <Text style={[T.body, { flex: 1, fontWeight: '600' }]}>{nameOf(u)}</Text>
                      <Text style={T.caption}>{Math.round((v / total) * 100)}%</Text>
                      <Text style={[T.body, { fontWeight: '700', minWidth: 96, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>{money(v, cur)}</Text>
                    </View>
                    <ProgressBar value={v / total} height={6} semantic={false} />
                  </View>
                );
              })}
            </Card>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Kpi({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <Card style={{ flex: 1, gap: 4, padding: S.md, paddingVertical: S.lg }}>
      <Text style={[T.label, { fontSize: 13 }]}>{label}</Text>
      <Text style={{ fontSize: 19, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={T.caption} numberOfLines={1}>{caption}</Text>
    </Card>
  );
}
