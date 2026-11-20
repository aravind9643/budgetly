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
  index: { label: 'Home', icon: 'home-outline', iconActive: 'home' },
  stats: { label: 'Stats', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  households: { label: 'Households', icon: 'people-outline', iconActive: 'people' },
  profile: { label: 'Profile', icon: 'person-outline', iconActive: 'person' },
};

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { openAdd, activeId } = useHousehold();
  const { toast } = useFeedback();
  const items = state.routes.map((r, i) => {
    const t = TABS[r.name]; const focused = state.index === i;
    if (!t) return null;
    return (
      <Pressable key={r.key} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={t.label}
        onPress={() => { tap(); if (!focused) navigation.navigate(r.name); }}
        style={{ flex: 1, alignItems: 'center', paddingTop: 10, gap: 3 }}>
        {focused && <View style={{ position: 'absolute', top: 0, width: 34, height: 3, borderRadius: 2, backgroundColor: C.accent }} />}
        <Ionicons name={focused ? t.iconActive : t.icon} size={24} color={focused ? C.primary : C.sub} />
        <Text style={{ fontSize: 12, fontWeight: focused ? '700' : '500', color: focused ? C.primary : C.sub }}>{t.label}</Text>
      </Pressable>
    );
  });
  const fab = (
    <View key="fab" style={{ width: 84, alignItems: 'center' }}>
      <Press onPress={() => (activeId ? openAdd(null) : toast('Create or join a household first'))} accessibilityLabel="Add expense"
        style={[{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
          marginTop: -26, borderWidth: 5, borderColor: C.surface }, shadow(C.accent, 0.35, 14, 6) as any]}>
        <Ionicons name="add" size={32} color="#fff" />
      </Press>
    </View>
  );
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
      paddingBottom: Math.max(insets.bottom, 10) }, shadow(C.shadow, C.shadowOpacity, 16, -4) as any]}>
      <View style={{ flexDirection: 'row', flex: 1, maxWidth: 680, alignSelf: 'center', marginHorizontal: 'auto' as any }}>
        {items[0]}{items[1]}{fab}{items[2]}{items[3]}
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
        <Tabs.Screen name="stats" />
        <Tabs.Screen name="households" />
        <Tabs.Screen name="profile" />
      </Tabs>
      {activeId && data.group && (
        <TransactionSheet visible={sheet.open} editing={sheet.editing} onClose={closeSheet} groupId={activeId}
          me={me} cur={data.group.currency} people={people} editingSplits={editingSplits} onSaved={data.reload} />
      )}
    </>
  );
}
