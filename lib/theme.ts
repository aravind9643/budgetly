import { Platform } from 'react-native';

// Design tokens. Every screen pulls colors, spacing, radii and type from here.
export const C = {
  bg: '#0A0B10',
  surface: '#13151C',
  surface2: '#1B1E27',
  border: '#252935',
  borderStrong: '#343A48',
  text: '#F2F4F8',
  sub: '#A0A8B8',
  muted: '#6B7385',
  primary: '#7C6CFF',
  primarySoft: 'rgba(124,108,255,0.14)',
  onPrimary: '#FFFFFF',
  positive: '#34D399',
  positiveSoft: 'rgba(52,211,153,0.14)',
  negative: '#F87171',
  negativeSoft: 'rgba(248,113,113,0.14)',
  warn: '#FBBF24',
  warnSoft: 'rgba(251,191,36,0.14)',
  scrim: 'rgba(5,6,10,0.72)',
  hero: ['#6A5AF9', '#8B5CF6', '#B05CE6'] as const,
  heroOver: ['#E5484D', '#C2264B'] as const,
};

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const R = { sm: 10, md: 14, lg: 20, pill: 999 };

export const T = {
  display: { fontSize: 40, fontWeight: '800' as const, letterSpacing: -1, color: C.text },
  title: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5, color: C.text },
  heading: { fontSize: 17, fontWeight: '700' as const, color: C.text },
  body: { fontSize: 15, color: C.text },
  label: { fontSize: 13, fontWeight: '600' as const, color: C.sub },
  caption: { fontSize: 12, color: C.muted },
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
