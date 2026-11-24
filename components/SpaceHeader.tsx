import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Text, View } from 'react-native';
import { HouseholdPicker } from '@/components/HouseholdPicker';
import { Avatar, Press, s } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useHousehold } from '@/lib/household';
import { C, R, S } from '@/lib/theme';

/**
 * Header shared by every tab: space switcher (left), avatar → Settings (right), then the page title.
 * Keeping it identical on each tab makes "which space am I in?" always answerable at a glance.
 */
export function SpaceHeader({ title, right }: { title: string; right?: ReactNode }) {
  const router = useRouter();
  const { session } = useAuth();
  const { households, data } = useHousehold();
  const [picker, setPicker] = useState(false);
  const name = (session?.user.user_metadata?.full_name as string) || session?.user.email?.split('@')[0] || '?';
  return (
    <View style={{ paddingHorizontal: S.xl, paddingTop: S.md, gap: S.lg }}>
      <View style={[s.row, { gap: S.md }]}>
        <Press onPress={() => setPicker(true)} accessibilityLabel="Switch space"
          style={[s.row, { gap: 8, flexShrink: 1, height: 40, paddingLeft: 4, paddingRight: 12, borderRadius: R.pill,
            backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }]}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 15 }}>{data.group?.emoji ?? '✦'}</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, flexShrink: 1 }} numberOfLines={1}>
            {households?.length ? data.group?.name ?? '…' : 'No space yet'}
          </Text>
          <Ionicons name="chevron-expand" size={14} color={C.muted} />
        </Press>
        <View style={{ flex: 1 }} />
        <Press onPress={() => router.push('/settings')} accessibilityLabel="Settings"><Avatar name={name} size={36} /></Press>
      </View>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: -0.8 }}>{title}</Text>
        {right}
      </View>
      <HouseholdPicker visible={picker} onClose={() => setPicker(false)} />
    </View>
  );
}
