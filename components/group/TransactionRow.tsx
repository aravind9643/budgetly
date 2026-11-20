import { Text, View } from 'react-native';
import { IconTile, Press, s } from '@/components/ui';
import { Expense } from '@/lib/supabase';
import { C, catMeta, money, S, T } from '@/lib/theme';

export function TransactionRow({ e, cur, who, onPress }: { e: Expense; cur: string; who: string; onPress?: () => void }) {
  const inc = e.type === 'income';
  const meta = inc ? { icon: 'arrow-down', color: C.positive, label: 'Income' } : catMeta(e.category);
  return (
    <Press onPress={onPress} scale={0.985} accessibilityLabel={`${e.title}, ${money(Number(e.amount), cur)}`}
      style={[s.row, { gap: S.md, paddingVertical: S.md, paddingHorizontal: S.lg }]}>
      <IconTile icon={meta.icon} color={meta.color} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{e.title}</Text>
        <Text style={T.caption} numberOfLines={1}>{who} · {meta.label}</Text>
      </View>
      <Text style={{ color: inc ? C.positive : C.text, fontWeight: '700', fontSize: 15, fontVariant: ['tabular-nums'] }}>
        {inc ? '+' : '−'}{money(Number(e.amount), cur)}
      </Text>
    </Press>
  );
}
