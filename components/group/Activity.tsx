import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Card, Chip, Divider, EmptyState, Field, Section } from '@/components/ui';
import { Expense } from '@/lib/supabase';
import { C, CATEGORIES, dayLabel, money, S, T } from '@/lib/theme';
import { TransactionRow } from './TransactionRow';
export type RowInfo = { who: string; splitCount: number; myShare?: number };

type Filter = 'all' | 'expense' | 'income' | 'mine';

/** Month's transactions grouped by day, with search and filters. */
export function Activity({ items, cur, me, nameOf, rowInfo, onOpen, canEdit }: {
  items: Expense[]; cur: string; me: string; nameOf: (u: string) => string; rowInfo: (e: Expense) => RowInfo;
  onOpen: (e: Expense) => void; canEdit: (e: Expense) => boolean;
}) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const days = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = items.filter((e) =>
      (filter === 'all' || (filter === 'mine' ? (e.paid_by ?? e.user_id) === me : e.type === filter)) &&
      (!needle || e.title.toLowerCase().includes(needle) || (CATEGORIES[e.category]?.label ?? '').toLowerCase().includes(needle)));
    const map = new Map<string, Expense[]>();
    list.forEach((e) => map.set(e.spent_at, [...(map.get(e.spent_at) ?? []), e]));
    return [...map.entries()];
  }, [items, q, filter, me]);

  return (
    <View style={{ gap: S.lg }}>
      <Field icon="search" placeholder="Search transactions" value={q} onChangeText={setQ} returnKeyType="search" />
      <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
        {(['all', 'expense', 'income', 'mine'] as Filter[]).map((f) => (
          <Chip key={f} label={{ all: 'All', expense: 'Expenses', income: 'Income', mine: 'Paid by me' }[f]}
            active={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>

      {days.length === 0 ? (
        <Card><EmptyState emoji="🔍" title={items.length ? 'No matches' : 'No transactions this month'}
          body={items.length ? 'Try a different search or filter.' : undefined} /></Card>
      ) : days.map(([day, list]) => {
        const net = list.reduce((a, e) => a + (e.type === 'income' ? 1 : -1) * Number(e.amount), 0);
        return (
          <Animated.View key={day} entering={FadeIn.duration(250)} layout={LinearTransition}>
            <Section title={dayLabel(day)} action={
              <Text style={[T.caption, { color: net >= 0 ? C.positive : C.sub, fontVariant: ['tabular-nums'] }]}>
                {net >= 0 ? '+' : '−'}{money(Math.abs(net), cur)}
              </Text>
            }>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {list.map((e, i) => (
                  <View key={e.id}>
                    {i > 0 && <Divider />}
                    <TransactionRow e={e} cur={cur} {...rowInfo(e)} onPress={canEdit(e) ? () => onOpen(e) : undefined} />
                  </View>
                ))}
              </Card>
            </Section>
          </Animated.View>
        );
      })}
      <Text style={[T.caption, { textAlign: 'center' }]}>Tap one of your own transactions to edit it.</Text>
    </View>
  );
}
