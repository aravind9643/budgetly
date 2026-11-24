import { Text, View } from 'react-native';
import { IconTile, Press, s } from '@/components/ui';
import { Expense } from '@/lib/supabase';
import { C, catMeta, dayLabel, money, S, T } from '@/lib/theme';

/** `who` is the payer's display name; `splitCount` is how many people share it (0 = not split). */
export function TransactionRow({ e, cur, who, splitCount = 0, myShare, onPress, showDate }: {
  e: Expense; cur: string; who: string; splitCount?: number; myShare?: number; onPress?: () => void; showDate?: boolean;
}) {
  const inc = e.type === 'income';
  const meta = inc ? { icon: 'arrow-down', color: C.positive, label: 'Income' } : catMeta(e.category);
  const by = who === 'You' ? 'you' : who;
  const parts = [
    showDate ? dayLabel(e.spent_at) : null,
    inc ? `to ${by}` : e.is_personal ? `${by} · just for them` : `${by} paid`,
    !inc && !e.is_personal && splitCount > 1 ? `÷ ${splitCount}` : null,
  ].filter(Boolean);
  return (
    <Press onPress={onPress} scale={0.985} accessibilityLabel={`${e.title}, ${money(Number(e.amount), cur)}`}
      style={[s.row, { gap: S.md, paddingVertical: S.md, paddingHorizontal: S.lg }]}>
      <IconTile icon={meta.icon} color={meta.color} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{e.title}</Text>
        <Text style={T.caption} numberOfLines={1}>{parts.join(' · ')}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={{ color: inc ? C.positive : C.text, fontWeight: '700', fontSize: 15, fontVariant: ['tabular-nums'] }}>
          {inc ? '+' : ''}{money(Number(e.amount), cur)}
        </Text>
        {myShare !== undefined && splitCount > 1 && (
          <Text style={[T.caption, { fontVariant: ['tabular-nums'] }]}>yours {money(myShare, cur)}</Text>
        )}
      </View>
    </Press>
  );
}
