import { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { C } from '@/lib/theme';

/** Ring chart: one arc per slice, with a small gap between slices and content in the centre. */
export function Donut({ slices, size = 220, stroke = 26, children }: {
  slices: { value: number; color: string }[]; size?: number; stroke?: number; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const total = slices.reduce((a, x) => a + x.value, 0);
  const gap = slices.length > 1 ? 4 : 0;
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.surface2} strokeWidth={stroke} fill="none" />
          {total > 0 && slices.map((sl, i) => {
            const len = (sl.value / total) * circ;
            const el = (
              <Circle key={i} cx={size / 2} cy={size / 2} r={r} stroke={sl.color} strokeWidth={stroke} fill="none"
                strokeDasharray={`${Math.max(0, len - gap)} ${circ}`} strokeDashoffset={-offset} />
            );
            offset += len;
            return el;
          })}
        </G>
      </Svg>
      {children}
    </View>
  );
}
