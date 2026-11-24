import { Platform } from 'react-native';

// Design tokens. Every screen pulls colors, spacing, radii and type from here.
// Neutral greys with a single blue accent, flat colors only (no gradients), light and dark.
const LIGHT = {
  bg: '#F7F7F8',
  surface: '#FFFFFF',
  surface2: '#F1F2F4',
  border: '#E6E7EB',
  borderStrong: '#D0D3DA',
  text: '#111318',
  sub: '#4A4F5C',
  muted: '#6B7180',    // 4.8:1 on white (WCAG AA)
  primary: '#2456E6',  // the one accent: buttons, links, active states
  primarySoft: '#E8EEFD',
  onPrimary: '#FFFFFF',
  accent: '#2456E6',
  accentSoft: '#E8EEFD',
  positive: '#13804A',
  positiveSoft: '#E3F5EA',
  negative: '#D12E2E',
  negativeSoft: '#FCE9E9',
  warn: '#A86206',
  warnSoft: '#FCF1DE',
  scrim: 'rgba(17,19,24,0.45)',
  shadow: '#111318',
  shadowOpacity: 0.08,
};

const DARK: typeof LIGHT = {
  bg: '#0E1013',
  surface: '#16191E',
  surface2: '#1E2228',
  border: '#272C34',
  borderStrong: '#363C46',
  text: '#ECEEF2',
  sub: '#B0B6C2',
  muted: '#8B92A0',    // 5.4:1 on surface
  primary: '#5B8CFF',  // lifted for contrast on charcoal
  primarySoft: 'rgba(91,140,255,0.16)',
  onPrimary: '#0A1430', // dark text on the light-blue button: 7:1
  accent: '#5B8CFF',
  accentSoft: 'rgba(91,140,255,0.16)',
  positive: '#4CC38A',
  positiveSoft: 'rgba(76,195,138,0.14)',
  negative: '#F2706B',
  negativeSoft: 'rgba(242,112,107,0.14)',
  warn: '#E9A23B',
  warnSoft: 'rgba(233,162,59,0.14)',
  scrim: 'rgba(0,0,0,0.62)',
  shadow: '#000000',
  shadowOpacity: 0.4,
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
