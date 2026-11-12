import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect } from 'react';
import {
  ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import Animated, {
  Easing, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '@/lib/theme';

export const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

export function Screen({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, overflow: 'hidden' }}>
      <LinearGradient colors={C.gradCool} style={StyleSheet.absoluteFill} />
      <Blob color="#7C5CFF" style={{ top: -80, left: -60 }} />
      <Blob color="#FF5C8A" style={{ bottom: -100, right: -80 }} delay={1500} />
      <SafeAreaView style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}>{children}</SafeAreaView>
    </View>
  );
}

function Blob({ color, style, delay = 0 }: { color: string; style: ViewStyle; delay?: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, []);
  const a = useAnimatedStyle(() => ({
    transform: [{ translateX: t.value * 40 }, { translateY: t.value * 30 }, { scale: 1 + t.value * 0.15 }],
  }));
  return (
    <Animated.View pointerEvents="none"
      style={[{ position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: color, opacity: 0.18 }, style, a]} />
  );
}

export function Card({ children, style, index = 0 }: { children: ReactNode; style?: ViewStyle; index?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 70).springify().damping(16)} style={[s.card, style]}>
      {children}
    </Animated.View>
  );
}

export function Bouncy({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: any }) {
  const sc = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Pressable
      onPressIn={() => { sc.value = withSpring(0.95); }}
      onPressOut={() => { sc.value = withSpring(1); }}
      onPress={() => { tap(); onPress?.(); }}>
      <Animated.View style={[style, a]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({ title, onPress, loading, icon, variant = 'primary' }: {
  title: string; onPress: () => void; loading?: boolean; icon?: any; variant?: 'primary' | 'ghost' | 'danger';
}) {
  const content = loading ? <ActivityIndicator color="#fff" /> : (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {icon && <Ionicons name={icon} size={18} color={variant === 'danger' ? C.danger : '#fff'} />}
      <Text style={[s.btnText, variant === 'danger' && { color: C.danger }]}>{title}</Text>
    </View>
  );
  return (
    <Bouncy onPress={loading ? undefined : onPress}>
      {variant === 'primary' ? (
        <LinearGradient colors={C.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btn}>{content}</LinearGradient>
      ) : (
        <View style={[s.btn, {
          backgroundColor: variant === 'danger' ? 'rgba(255,92,138,0.12)' : C.card,
          borderWidth: 1, borderColor: variant === 'danger' ? 'rgba(255,92,138,0.35)' : C.cardBorder,
        }]}>{content}</View>
      )}
    </Bouncy>
  );
}

export function Input({ icon, ...p }: TextInputProps & { icon?: any }) {
  return (
    <View style={s.input}>
      {icon && <Ionicons name={icon} size={18} color={C.sub} />}
      <TextInput placeholderTextColor={C.sub} style={s.inputText} {...p} />
    </View>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(value, 1)), { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [value]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  const colors: [string, string] = value > 1 ? ['#FF5C8A', '#FF2E63'] : color ? [color, color] : ['#00D4C8', '#7C5CFF'];
  return (
    <View style={s.track}>
      <Animated.View style={[{ height: '100%', borderRadius: 99, overflow: 'hidden' }, a]}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

export function Chip({ label, active, onPress, icon, color }: { label: string; active?: boolean; onPress: () => void; icon?: any; color?: string }) {
  return (
    <Bouncy onPress={onPress} style={[s.chip, active && { backgroundColor: (color ?? C.primary) + '33', borderColor: color ?? C.primary }]}>
      {icon && <Ionicons name={icon} size={14} color={active ? color ?? C.primary : C.sub} />}
      <Text style={{ color: active ? C.text : C.sub, fontWeight: '600', textTransform: 'capitalize' }}>{label}</Text>
    </Bouncy>
  );
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1}>{children}</Text>;
export const Sub = ({ children, style }: { children: ReactNode; style?: any }) => <Text style={[s.sub, style]}>{children}</Text>;

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderColor: C.cardBorder, borderWidth: 1, borderRadius: 22, padding: 18 },
  btn: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  input: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder, paddingHorizontal: 14, height: 52,
  },
  inputText: { flex: 1, color: C.text, fontSize: 16, height: '100%', outlineStyle: 'none' } as any,
  track: { height: 12, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 99, borderWidth: 1, borderColor: C.cardBorder, backgroundColor: C.card,
  },
  h1: { color: C.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: C.sub, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
