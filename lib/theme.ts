export const C = {
  bg: '#0B0B1A', card: 'rgba(255,255,255,0.06)', cardBorder: 'rgba(255,255,255,0.10)',
  text: '#F5F5FF', sub: '#9A9AB8', primary: '#7C5CFF', accent: '#00D4C8',
  danger: '#FF5C8A', success: '#2EE59D', warn: '#FFB547',
  grad: ['#7C5CFF', '#B84CFF', '#FF5C8A'] as const,
  gradCool: ['#1A1446', '#0B0B1A'] as const,
};

export const CATEGORIES: Record<string, { icon: any; color: string }> = {
  food: { icon: 'fast-food', color: '#FF8A5C' },
  transport: { icon: 'car', color: '#5CC8FF' },
  shopping: { icon: 'bag-handle', color: '#FF5CD6' },
  bills: { icon: 'receipt', color: '#FFB547' },
  fun: { icon: 'game-controller', color: '#7C5CFF' },
  health: { icon: 'medkit', color: '#2EE59D' },
  other: { icon: 'ellipsis-horizontal-circle', color: '#9A9AB8' },
};

export const money = (n: number, cur = 'USD') => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n); }
  catch { return `${cur} ${n.toFixed(2)}`; }
};
