import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TransactionSheet } from '@/components/group/TransactionSheet';
import { Press, tap } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useFeedback } from '@/lib/feedback';
import { useHousehold } from '@/lib/household';
import { C, shadow } from '@/lib/theme';
import { displayName } from '@/lib/useGroup';

const TABS: Record<string, { label: string; icon: any; iconActive: any }> = {
  index: { label: 'Overview', icon: 'grid-outline', iconActive: 'grid' },
  activity: { label: 'Activity', icon: 'receipt-outline', iconActive: 'receipt' },
  insights: { label: 'Insights', icon: 'pie-chart-outline', iconActive: 'pie-chart' },
  balances: { label: 'Balances', icon: 'scale-outline', iconActive: 'scale' },
};
const WITH_FAB = new Set(['index', 'activity']);

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { openAdd, activeId } = useHousehold();
  const { toast } = useFeedback();
  const current = state.routes[state.index]?.name;
  return (
    <View>
      {/* Extended floating action button: the primary task, labelled, above the bar. */}
      {WITH_FAB.has(current) && (
        <View style={{ position: 'absolute', right: 20, top: -72, zIndex: 10 }}>
          <Press onPress={() => (activeId ? openAdd(null) : toast('Create or join a space first'))} accessibilityLabel="New expense"
            style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 54, paddingHorizontal: 20, borderRadius: 18,
              backgroundColor: C.primary }, shadow(C.shadow, C.shadowOpacity + 0.1, 18, 6) as any]}>
            <Ionicons name="add" size={22} color={C.onPrimary} />
            <Text style={{ color: C.onPrimary, fontWeight: '700', fontSize: 15 }}>New expense</Text>
          </Press>
        </View>
      )}
      <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
        paddingBottom: Math.max(insets.bottom, 8), paddingTop: 6 }}>
        <View style={{ flexDirection: 'row', flex: 1, maxWidth: 560, alignSelf: 'center', marginHorizontal: 'auto' as any }}>
          {state.routes.map((r, i) => {
            const t = TABS[r.name]; const focused = state.index === i;
            if (!t) return null;
            return (
              <Pressable key={r.key} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={t.label}
                onPress={() => { tap(); if (!focused) navigation.navigate(r.name); }}
                style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 }}>
                <Ionicons name={focused ? t.iconActive : t.icon} size={22} color={focused ? C.primary : C.muted} />
                <Text style={{ fontSize: 11, fontWeight: focused ? '700' : '500', color: focused ? C.primary : C.muted }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { session } = useAuth();
  const { sheet, closeSheet, data, activeId } = useHousehold();
  const me = session?.user.id ?? '';
  const people = data.members.map((m) => ({ id: m.user_id, name: displayName(m) }));
  const editingSplits = sheet.editing ? data.splits.filter((x) => x.expense_id === sheet.editing!.id) : [];
  return (
    <>
      <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } } as any}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="activity" />
        <Tabs.Screen name="insights" />
        <Tabs.Screen name="balances" />
      </Tabs>
      {activeId && data.group && (
        <TransactionSheet visible={sheet.open} editing={sheet.editing} onClose={closeSheet} groupId={activeId}
          me={me} cur={data.group.currency} people={people} editingSplits={editingSplits} onSaved={data.reload} />
      )}
    </>
  );
}
