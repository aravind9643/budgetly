import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { IconButton, Press, s } from '@/components/ui';
import { C, IconName, R, S, T } from '@/lib/theme';

/** Large page title with an optional small eyebrow above and actions on the right. */
export function PageTitle({ eyebrow, title, right, left }: { eyebrow?: string; title: string; right?: ReactNode; left?: ReactNode }) {
  return (
    <View style={[s.row, { gap: S.md, paddingHorizontal: S.xl, paddingTop: S.lg, paddingBottom: S.md }]}>
      {left}
      <View style={{ flex: 1 }}>
        {eyebrow && <Text style={[T.body, { color: C.sub }]}>{eyebrow}</Text>}
        <Text style={{ fontSize: 32, fontWeight: '800', color: C.text, letterSpacing: -0.8 }} numberOfLines={1}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

/** One row of a settings-style list: tinted icon tile, title, subtitle, chevron. */
export function ListRow({ icon, tint, title, subtitle, onPress, right, danger }: {
  icon: IconName; tint: string; title: string; subtitle?: string; onPress?: () => void; right?: ReactNode; danger?: boolean;
}) {
  return (
    <Press onPress={onPress} scale={0.985} accessibilityLabel={title}
      style={[s.row, { gap: S.md, paddingVertical: S.md, paddingHorizontal: S.lg, minHeight: 64 }]}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tint + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={21} color={danger ? C.negative : tint} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[T.heading, danger && { color: C.negative }]}>{title}</Text>
        {subtitle && <Text style={[T.body, { color: C.sub, fontSize: 14 }]} numberOfLines={2}>{subtitle}</Text>}
      </View>
      {right ?? (onPress && <Ionicons name="chevron-forward" size={18} color={C.sub} />)}
    </Press>
  );
}

export function MonthSwitcher({ label, onPrev, onNext, nextDisabled }: {
  label: string; onPrev: () => void; onNext: () => void; nextDisabled?: boolean;
}) {
  return (
    <View style={[s.row, { justifyContent: 'space-between', paddingHorizontal: S.xl, paddingBottom: S.md }]}>
      <IconButton icon="chevron-back" label="Previous month" onPress={onPrev} size={44} />
      <Text style={[T.heading, { fontSize: 18 }]}>{label}</Text>
      <View style={{ opacity: nextDisabled ? 0.35 : 1 }}>
        <IconButton icon="chevron-forward" label="Next month" onPress={nextDisabled ? () => {} : onNext} size={44} />
      </View>
    </View>
  );
}

export const BackButton = ({ onPress }: { onPress: () => void }) => (
  <IconButton icon="arrow-back" label="Back" onPress={onPress} size={44} />
);

export const pill = { paddingHorizontal: 10, paddingVertical: 3, borderRadius: R.pill } as const;
