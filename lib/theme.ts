import { Platform } from 'react-native';

// Design tokens. Every screen pulls colors, spacing, radii and type from here.
// Blue brand, flat colors only (no gradients), in a light and a dark palette.
const LIGHT = {
  bg: '#F4F7FB',
  surface: '#FFFFFF',
  surface2: '#EDF2F8',
  border: '#E1E8F0',
  borderStrong: '#C8D3E0',
  text: '#0F1B2D',
  sub: '#4B5B70',
  muted: '#64748B',   // 4.7:1 on white (WCAG AA for small text)
  primary: '#1D4ED8',  // blue-700: hero cards, primary buttons, active tab
  primarySoft: '#E3ECFD',
  onPrimary: '#FFFFFF',
  accent: '#2563EB',   // blue-600: + button, highlights
  accentSoft: '#DBEAFE',
  positive: '#15803D',
  positiveSoft: '#DCFCE7',
  negative: '#DC2626',
  negativeSoft: '#FEE2E2',
  warn: '#B45309',
  warnSoft: '#FEF3C7',
  scrim: 'rgba(15,27,45,0.45)',
  shadow: '#0F1B2D',
  shadowOpacity: 0.06,
};

const DARK: typeof LIGHT = {
  bg: '#0B1220',
  surface: '#141D2F',
  surface2: '#1C2740',
  border: '#26334D',
  borderStrong: '#36456A',
  text: '#E8EEF8',
  sub: '#A7B4C8',
  muted: '#8C9AB0',    // 5.6:1 on surface
  primary: '#3F6FF2',  // brighter blue so links/tabs stay legible on dark surfaces
  primarySoft: 'rgba(79,125,255,0.18)',
  onPrimary: '#FFFFFF',
  accent: '#4F7DFF',
  accentSoft: 'rgba(79,125,255,0.18)',
  positive: '#4ADE80',
  positiveSoft: 'rgba(74,222,128,0.14)',
  negative: '#F87171',
  negativeSoft: 'rgba(248,113,113,0.15)',
  warn: '#FBBF24',
  warnSoft: 'rgba(251,191,36,0.15)',
  scrim: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
  shadowOpacity: 0.35,
};

export type Scheme = 'light' | 'dark';
/**
 * The live palette. It's mutated in place by applyScheme(), so existing `C.xxx` reads keep working.
 * ThemeProvider re-mounts the tree after a switch so every component re-renders with the new values.
 */
export const C: typeof LIGHT = { ...LIGHT };
export let scheme: Scheme = 'light';
export const applyScheme = (s: Scheme) => { scheme = s; Object.assign(C, s === 'dark' ? DARK : LIGHT); };

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const R = { sm: 10, md: 14, lg: 20, pill: 999 };

// Getters so text colors follow the active scheme.
export const T = {
  get display() { return { fontSize: 40, fontWeight: '800' as const, letterSpacing: -1, color: C.text }; },
  get title() { return { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5, color: C.text }; },
  get heading() { return { fontSize: 17, fontWeight: '700' as const, color: C.text }; },
  get body() { return { fontSize: 15, color: C.text }; },
  get label() { return { fontSize: 13, fontWeight: '600' as const, color: C.sub }; },
  get caption() { return { fontSize: 12, color: C.muted }; },
};

export type IconName = any;

/** Cross-platform drop shadow: boxShadow on web, shadow* + elevation on native. */
export const shadow = (color: string, opacity: number, radius: number, y: number): object =>
  Platform.OS === 'web'
    ? { boxShadow: `0px ${y}px ${radius}px ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}` }
    : { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: y }, elevation: 8 };

export const CATEGORIES: Record<string, { label: string; icon: IconName; color: string }> = {
  food: { label: 'Food', icon: 'fast-food', color: '#FB923C' },
  groceries: { label: 'Groceries', icon: 'cart', color: '#A3E635' },
  transport: { label: 'Transport', icon: 'car', color: '#38BDF8' },
  shopping: { label: 'Shopping', icon: 'bag-handle', color: '#F472B6' },
  bills: { label: 'Bills', icon: 'receipt', color: '#FBBF24' },
  fun: { label: 'Fun', icon: 'game-controller', color: '#A78BFA' },
  health: { label: 'Health', icon: 'medkit', color: '#34D399' },
  other: { label: 'Other', icon: 'ellipsis-horizontal', color: '#94A3B8' },
};
export const catMeta = (k: string) => CATEGORIES[k] ?? CATEGORIES.other;

export const money = (n: number, cur = 'USD', compact = false) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency: cur, notation: compact ? 'compact' : 'standard',
      ...(compact ? { minimumFractionDigits: 0, maximumFractionDigits: 1 } : {}),
    }).format(n);
  } catch { return `${cur} ${n.toFixed(2)}`; }
};

// Date helpers. They work in local time because `spent_at` is a plain DATE column.
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const monthRange = (m: Date) => ({
  start: ymd(new Date(m.getFullYear(), m.getMonth(), 1)),
  end: ymd(new Date(m.getFullYear(), m.getMonth() + 1, 0)),
});
export const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
export const monthLabel = (m: Date) => m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
export const dayLabel = (s: string) => {
  const d = parseYmd(s);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};
