import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Avatar, Button, Card, Divider, EmptyState, Press, ProgressBar, Section, s } from '@/components/ui';
import { Expense } from '@/lib/supabase';
import { C, catMeta, money, S, T } from '@/lib/theme';
import { TransactionRow } from './TransactionRow';

export type MonthStats = {
  spent: number; income: number; byCat: [string, number][]; byUser: [string, number][];
  items: Expense[]; avgPerDay: number; projected: number | null; daysLeft: number;
};

export function Overview({ stats, cur, budget, nameOf, onSeeAll, onOpen, onAdd, canEdit }: {
  stats: MonthStats; cur: string; budget: number; nameOf: (u: string) => string;
  onSeeAll: () => void; onOpen: (e: Expense) => void; onAdd: () => void; canEdit: (e: Expense) => boolean;
}) {
  if (!stats.items.length) {
    return (
      <Card>
        <EmptyState emoji="🧾" title="Nothing logged this month" body="Add your first expense to see where the money goes."
          action={<Button title="Add expense" icon="add" onPress={onAdd} />} />
      </Card>
    );
  }
  const total = stats.spent || 1;
  const recent = stats.items.slice(0, 4);

  return (
    <View style={{ gap: S.xl }}>
      {/* Insight: spending pace */}
      {stats.projected !== null && budget > 0 && (
        <Animated.View entering={FadeInDown.duration(350)}>
          <Card style={[s.row, { gap: S.md }]}>
            <Ionicons name={stats.projected > budget ? 'trending-up' : 'speedometer-outline'} size={22}
              color={stats.projected > budget ? C.warn : C.positive} />
            <Text style={[T.body, { flex: 1, color: C.sub }]}>
              {stats.projected > budget
                ? <>At this pace you'll spend <Text style={{ color: C.warn, fontWeight: '700' }}>{money(stats.projected, cur)}</Text>, which is over budget. Try to keep it to <Text style={{ color: C.text, fontWeight: '700' }}>{money(Math.max(0, budget - stats.spent) / Math.max(1, stats.daysLeft), cur)}/day</Text>.</>
                : <>On track. You're averaging <Text style={{ color: C.text, fontWeight: '700' }}>{money(stats.avgPerDay, cur)}/day</Text> and are projected to end at <Text style={{ color: C.positive, fontWeight: '700' }}>{money(stats.projected, cur)}</Text>.</>}
            </Text>
          </Card>
        </Animated.View>
      )}

      {stats.byCat.length > 0 && (
        <Section title="Spending by category">
          <Card style={{ gap: S.lg }}>
            {/* Stacked composition bar */}
            <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
              {stats.byCat.map(([c, v]) => <View key={c} style={{ flex: v, backgroundColor: catMeta(c).color }} />)}
            </View>
            {stats.byCat.map(([c, v]) => {
              const m = catMeta(c);
              return (
                <View key={c} style={[s.row, { gap: S.md }]}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.color }} />
                  <Text style={[T.body, { flex: 1 }]}>{m.label}</Text>
                  <Text style={[T.caption, { width: 44, textAlign: 'right' }]}>{Math.round((v / total) * 100)}%</Text>
                  <Text style={[T.body, { fontWeight: '700', minWidth: 90, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>{money(v, cur)}</Text>
                </View>
              );
            })}
          </Card>
        </Section>
      )}

      {stats.byUser.length > 0 && (
        <Section title="Who paid">
          <Card style={{ gap: S.lg }}>
            {stats.byUser.map(([u, v]) => (
              <View key={u} style={{ gap: S.sm }}>
                <View style={[s.row, { gap: S.md }]}>
                  <Avatar name={nameOf(u)} size={32} />
                  <Text style={[T.body, { flex: 1 }]}>{nameOf(u)}</Text>
                  <Text style={T.caption}>{Math.round((v / total) * 100)}%</Text>
                  <Text style={[T.body, { fontWeight: '700', minWidth: 90, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>{money(v, cur)}</Text>
                </View>
                <ProgressBar value={v / total} height={4} color={C.primary} semantic={false} />
              </View>
            ))}
          </Card>
        </Section>
      )}

      <Section title="Recent" action={<Press onPress={onSeeAll}><Text style={{ color: C.primary, fontWeight: '700' }}>See all</Text></Press>}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {recent.map((e, i) => (
            <View key={e.id}>
              {i > 0 && <Divider />}
              <TransactionRow e={e} cur={cur} who={nameOf(e.user_id)} onPress={canEdit(e) ? () => onOpen(e) : undefined} />
            </View>
          ))}
        </Card>
      </Section>
    </View>
  );
}
