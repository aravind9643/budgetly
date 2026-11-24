import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Activity } from '@/components/group/Activity';
import { MonthSwitcher } from '@/components/Nav';
import { SpaceHeader } from '@/components/SpaceHeader';
import { Loading, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useHousehold } from '@/lib/household';
import { Expense } from '@/lib/supabase';
import { monthLabel, monthRange, S, sameMonth } from '@/lib/theme';
import { displayName } from '@/lib/useGroup';

/** Activity tab: all expenses of the active space for one month, grouped by day, with search and filters. */
export default function ActivityTab() {
  const router = useRouter();
  const { m } = useLocalSearchParams<{ m?: string }>();
  const { session } = useAuth();
  const { data, openAdd } = useHousehold();
  const me = session?.user.id ?? '';
  const [month, setMonth] = useState(() => {
    if (m && /^\d{4}-\d{2}$/.test(m)) { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1); }
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const items = useMemo(() => {
    const { start, end } = monthRange(month);
    return data.expenses.filter((e) => e.spent_at >= start && e.spent_at <= end);
  }, [data.expenses, month]);

  const g = data.group;
  const nameOf = (u: string) => (u === me ? 'You' : displayName(data.members.find((x) => x.user_id === u)));
  const rowInfo = (e: Expense) => {
    const sp = data.splits.filter((x) => x.expense_id === e.id);
    const mine = sp.find((x) => x.user_id === me);
    return {
      who: nameOf(e.paid_by ?? e.user_id),
      splitCount: e.type !== 'expense' || e.is_personal ? 0 : sp.length || data.members.length,
      myShare: mine ? Number(mine.amount) : undefined,
    };
  };

  return (
    <Screen edges={['top']}>
      <SpaceHeader title="Activity" />
      <View style={{ height: S.md }} />
      <MonthSwitcher label={monthLabel(month)} nextDisabled={sameMonth(month, new Date())}
        onPrev={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        onNext={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
      {!g ? <Loading /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: S.xl, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
          <View>
            <Activity items={items} cur={g.currency} me={me} nameOf={nameOf} rowInfo={rowInfo}
              canEdit={(e) => e.user_id === me} onOpen={(e) => openAdd(e)} />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
