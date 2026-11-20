import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text,
  TextInput, TextInputProps, TextStyle, View, ViewStyle,
} from 'react-native';
import Animated, {
  Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, IconName, R, S, scheme, shadow, T } from '@/lib/theme';

export const tap = (style = Haptics.ImpactFeedbackStyle.Light) => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style);
};

/* ---------- Layout ---------- */

export function Screen({ children, edges }: { children: ReactNode; edges?: ('top' | 'bottom')[] }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={edges ?? ['top', 'bottom']} style={{ flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
        {children}
      </SafeAreaView>
    </View>
  );
}

export function Header({ title, subtitle, left, right }: {
  title?: ReactNode; subtitle?: ReactNode; left?: ReactNode; right?: ReactNode;
}) {
  return (
    <View style={[s.row, { gap: S.md, paddingHorizontal: S.xl, paddingTop: S.md, paddingBottom: S.sm, minHeight: 56 }]}>
      {left}
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={T.label} numberOfLines={1}>{subtitle}</Text> : null}
        {title ? <Text style={T.title} numberOfLines={1}>{title}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Section({ title, action, children, style }: {
  title?: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap: S.sm }, style]}>
      {(title || action) && (
        <View style={[s.row, { justifyContent: 'space-between', paddingHorizontal: S.xs }]}>
          <Text style={[T.label, { textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 12 }]}>{title}</Text>
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) return <Press onPress={onPress} style={[s.card, style]}>{children}</Press>;
  return <View style={[s.card, style]}>{children}</View>;
}

export const Divider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border }} />;

/* ---------- Interaction ---------- */

export function Press({ children, onPress, style, disabled, accessibilityLabel, scale = 0.97 }: {
  children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean;
  accessibilityLabel?: string; scale?: number;
}) {
  const sc = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  // Flex/size props must sit on the outer Pressable (the real flex item), or they're ignored.
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, any>;
  const outer: Record<string, any> = {};
  const inner: Record<string, any> = { ...flat };
  for (const k of ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth']) {
    if (k in flat) { outer[k] = flat[k]; delete inner[k]; }
  }
  return (
    <Pressable style={outer}
      accessibilityRole="button" accessibilityLabel={accessibilityLabel} disabled={disabled || !onPress}
      onPressIn={() => { sc.value = withSpring(scale, { damping: 20, stiffness: 400 }); }}
      onPressOut={() => { sc.value = withSpring(1, { damping: 20, stiffness: 400 }); }}
      onPress={() => { tap(); onPress?.(); }}>
      <Animated.View style={[inner, a, disabled && { opacity: 0.5 }]}>{children}</Animated.View>
    </Pressable>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export function Button({ title, onPress, loading, icon, variant = 'primary', disabled, style }: {
  title: string; onPress: () => void; loading?: boolean; icon?: IconName; variant?: BtnVariant;
  disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const v = {
    primary: { bg: C.primary, fg: C.onPrimary, border: C.primary },
    secondary: { bg: C.surface2, fg: C.text, border: C.border },
    danger: { bg: C.negativeSoft, fg: C.negative, border: 'transparent' },
    ghost: { bg: 'transparent', fg: C.sub, border: 'transparent' },
  }[variant];
  return (
    <Press onPress={loading ? undefined : onPress} disabled={disabled} accessibilityLabel={title}
      style={[s.btn, { backgroundColor: v.bg, borderColor: v.border }, style]}>
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={18} color={v.fg} />}
          <Text style={{ color: v.fg, fontWeight: '700', fontSize: 15 }}>{title}</Text>
        </>
      )}
    </Press>
  );
}

export function IconButton({ icon, onPress, label, tone = 'default', size = 40 }: {
  icon: IconName; onPress: () => void; label: string; tone?: 'default' | 'primary' | 'plain'; size?: number;
}) {
  const bg = tone === 'primary' ? C.primary : tone === 'plain' ? 'transparent' : C.surface;
  return (
    <Press onPress={onPress} accessibilityLabel={label}
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        tone === 'default' && (shadow(C.shadow, C.shadowOpacity + 0.02, 12, 3) as any)]}>
      <Ionicons name={icon} size={size * 0.5} color={tone === 'primary' ? C.onPrimary : C.text} />
    </Press>
  );
}

/* ---------- Forms ---------- */

export function Field({ label, icon, error, prefix, right, style, ...p }: TextInputProps & {
  label?: string; icon?: IconName; error?: string | null; prefix?: string; right?: ReactNode;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 6 }, style as any]}>
      {label && <Text style={T.label}>{label}</Text>}
      <View style={[s.input, focus && { borderColor: C.primary }, !!error && { borderColor: C.negative }]}>
        {icon && <Ionicons name={icon} size={18} color={focus ? C.primary : C.muted} />}
        {prefix && <Text style={{ color: C.sub, fontSize: 16 }}>{prefix}</Text>}
        <TextInput
          placeholderTextColor={C.muted} style={s.inputText}
          onFocus={(e) => { setFocus(true); p.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); p.onBlur?.(e); }}
          {...p} />
        {right}
      </View>
      {!!error && <Text style={{ color: C.negative, fontSize: 12 }}>{error}</Text>}
    </View>
  );
}

export function Segmented<V extends string>({ options, value, onChange, tones }: {
  options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; tones?: Partial<Record<V, string>>;
}) {
  return (
    <View style={[s.row, { backgroundColor: C.surface2, padding: 4, borderRadius: R.md, gap: 4 }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        const tone = tones?.[o.value];
        return (
          <Pressable key={o.value} onPress={() => { tap(); onChange(o.value); }} style={{ flex: 1 }}
            accessibilityRole="tab" accessibilityState={{ selected: active }}>
            <View style={{
              paddingVertical: 9, borderRadius: R.sm, alignItems: 'center',
              backgroundColor: active ? (tone ? tone + '26' : C.surface) : 'transparent',
              borderWidth: 1, borderColor: active ? (tone ?? C.borderStrong) : 'transparent',
            }}>
              <Text style={{ color: active ? (tone ?? C.text) : C.sub, fontWeight: '700', fontSize: 14 }}>{o.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, active, onPress, icon, color }: {
  label: string; active?: boolean; onPress: () => void; icon?: IconName; color?: string;
}) {
  const c = color ?? C.primary;
  return (
    <Press onPress={onPress} accessibilityLabel={label}
      style={[s.chip, active && { backgroundColor: c + '22', borderColor: c }]}>
      {icon && <Ionicons name={icon} size={14} color={active ? c : C.sub} />}
      <Text style={{ color: active ? C.text : C.sub, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Press>
  );
}

/* ---------- Display ---------- */

/** `semantic` (default) tints the bar warn/negative as it nears or passes 100%. Turn it off for shares and other non-budget values. */
export function ProgressBar({ value, color, height = 8, track = C.surface2, semantic = true }: {
  value: number; color?: string; height?: number; track?: string; semantic?: boolean;
}) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(value, 1)), { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [value]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  const fill = !semantic ? color ?? C.primary : value > 1 ? C.negative : value > 0.85 ? C.warn : color ?? C.primary;
  return (
    <View style={{ height, borderRadius: R.pill, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: R.pill, backgroundColor: fill }, a]} />
    </View>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue},48%,42%)`,
      alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.surface,
    }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'warn' | 'positive' | 'negative' }) {
  const map = {
    neutral: [C.surface2, C.sub], primary: [C.primarySoft, C.primary], warn: [C.warnSoft, C.warn],
    positive: [C.positiveSoft, C.positive], negative: [C.negativeSoft, C.negative],
  }[tone];
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: map[0] }}>
      <Text style={{ color: map[1], fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

export function IconTile({ icon, color, size = 40 }: { icon: IconName; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

export function EmptyState({ emoji, title, body, action }: { emoji: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: S.xxl, paddingHorizontal: S.xl, gap: S.sm }}>
      <Text style={{ fontSize: 40 }}>{emoji}</Text>
      <Text style={T.heading}>{title}</Text>
      {body && <Text style={[T.body, { color: C.sub, textAlign: 'center' }]}>{body}</Text>}
      {action && <View style={{ marginTop: S.sm, alignSelf: 'stretch' }}>{action}</View>}
    </View>
  );
}

/** Pulsing placeholder block for skeleton screens. */
export function Skeleton({ h, w = '100%', r = 14, style }: { h: number; w?: number | string; r?: number; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.5);
  useEffect(() => { o.value = withRepeat(withTiming(1, { duration: 750 }), -1, true); }, []);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height: h, width: w as any, borderRadius: r, backgroundColor: C.border }, a, style]} />;
}

export function Loading() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.primary} /></View>;
}

/* ---------- Sheet ---------- */

export function Sheet({ visible, onClose, title, children, footer }: {
  visible: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={[StyleSheet.absoluteFill, { backgroundColor: C.scrim }]}>
            <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View entering={SlideInDown.springify().damping(22).stiffness(220)} exiting={SlideOutDown.duration(180)} style={s.sheet}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderStrong, alignSelf: 'center', marginBottom: S.sm }} />
            {title && (
              <View style={[s.row, { justifyContent: 'space-between', marginBottom: S.sm }]}>
                <Text style={T.heading}>{title}</Text>
                <IconButton icon="close" label="Close" onPress={onClose} size={34} />
              </View>
            )}
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: S.lg }} style={{ flexGrow: 0 }}>
              {children}
            </ScrollView>
            {footer && <View style={{ marginTop: S.lg }}>{footer}</View>}
            <SafeAreaView edges={['bottom']} />
          </Animated.View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

export const txt = (style: TextStyle, extra?: TextStyle) => [style, extra];

// Plain objects with getters (not StyleSheet.create) so colors follow the active light/dark scheme.
export const s = {
  row: { flexDirection: 'row', alignItems: 'center' } as ViewStyle,
  get card(): ViewStyle {
    return {
      backgroundColor: C.surface, borderColor: scheme === 'dark' ? C.border : 'transparent', borderWidth: 1, borderRadius: 22, padding: S.lg,
      ...(shadow(C.shadow, C.shadowOpacity, 18, 4) as any),
    };
  },
  btn: {
    height: 50, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.xl,
    flexDirection: 'row', gap: S.sm, borderWidth: 1,
  } as ViewStyle,
  get input(): ViewStyle {
    return {
      flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2,
      borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 50,
    };
  },
  get inputText() { return { flex: 1, color: C.text, fontSize: 16, height: '100%', outlineStyle: 'none' } as any; },
  get chip(): ViewStyle {
    return {
      flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: R.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2,
    };
  },
  get sheet(): ViewStyle {
    return {
      backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: S.xl, paddingTop: S.md,
      borderWidth: 1, borderColor: C.border, width: '100%', maxWidth: 680, alignSelf: 'center', maxHeight: '92%',
    };
  },
};
