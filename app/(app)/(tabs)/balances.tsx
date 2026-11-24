import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { Balances } from '@/components/group/Balances';
import { SpaceHeader } from '@/components/SpaceHeader';
import { View } from 'react-native';
import { Loading, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { computeBalances, simplifyDebts } from '@/lib/balances';
import { useHousehold } from '@/lib/household';
import { S } from '@/lib/theme';
import { displayName, useGroup } from '@/lib/useGroup';
import { useThemeMode } from '@/lib/themeMode';

/** Balances tab: who owes what in the active space (or `?g=<space id>`). */
export default function BalancesScreen() {
  useThemeMode(); // re-render this screen when light/dark changes
  const router = useRouter();
  const { g } = useLocalSearchParams<{ g?: string }>();
  const { session } = useAuth();
  const { activeId } = useHousehold();
  const me = session?.user.id ?? '';
  const { group, expenses, splits, settlements, members, former, loading, reload } = useGroup(g || activeId || undefined);
  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const net = useMemo(() => computeBalances(expenses, splits, settlements, memberIds), [expenses, splits, settlements, memberIds]);
  const transfers = useMemo(() => simplifyDebts(net), [net]);

  const nameOf = (u: string) => {
    if (u === me) return 'You';
    const m = members.find((x) => x.user_id === u);
    if (m) return displayName(m);
    const p = former[u];
    return p?.full_name || p?.email?.split('@')[0] || 'Former member';
  };

  return (
    <Screen edges={['top']}>
      <SpaceHeader title="Balances" />
      <View style={{ height: S.lg }} />
      {loading || !group ? <Loading /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: S.xl, paddingBottom: 40 }}>
          <Balances groupId={group.id} me={me} cur={group.currency} net={net} transfers={transfers} settlements={settlements}
            nameOf={nameOf} isFormer={(u) => !memberIds.includes(u)} reload={reload} isOwner={group.owner_id === me} />
        </ScrollView>
      )}
    </Screen>
  );
}
