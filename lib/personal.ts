// "What did I spend?" maths. Pure (type imports only) so `npm test` runs it in plain Node.
import type { Expense, Split } from './supabase';

const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const cents = (n: number) => Math.round(n * 100);

/**
 * Expenses rewritten so `amount` is the user's own cost: their split of shared expenses
 * (equal among members when an old expense has no splits) plus their personal ones.
 * Income and expenses that cost the user nothing are dropped.
 */
export function withMyShare<E extends Pick<Expense, 'id' | 'amount' | 'type' | 'is_personal' | 'paid_by' | 'user_id'>>(
  expenses: E[], splits: Pick<Split, 'expense_id' | 'user_id' | 'amount'>[], me: string, memberIds: string[],
): E[] {
  const byExp = new Map<string, { user_id: string; amount: number }[]>();
  splits.forEach((s) => byExp.set(s.expense_id, [...(byExp.get(s.expense_id) ?? []), { user_id: s.user_id, amount: Number(s.amount) }]));
  const out: E[] = [];
  for (const e of expenses) {
    if (e.type !== 'expense') continue;
    let c = 0;
    if (e.is_personal) c = (e.paid_by ?? e.user_id) === me ? cents(Number(e.amount)) : 0;
    else {
      const sp = byExp.get(e.id);
      if (sp?.length) c = sp.filter((s) => s.user_id === me).reduce((a, s) => a + cents(s.amount), 0);
      else if (memberIds.includes(me)) {
        // Same rounding as an equal split: the first `rest` members get one extra cent.
        const total = cents(Number(e.amount)), n = memberIds.length, base = Math.floor(total / n), rest = total - base * n;
        c = base + ([...memberIds].sort().indexOf(me) < rest ? 1 : 0);
      }
    }
    if (c > 0) out.push({ ...e, amount: c / 100 });
  }
  return out;
}

const sum = (xs: { amount: number | string }[]) => xs.reduce((a, e) => a + cents(Number(e.amount)), 0) / 100;

/** Totals for today, this week (Monday start), this month, and last month up to the same day. */
export function periodTotals(items: { amount: number | string; spent_at: string }[], now = new Date()) {
  const today = ymdLocal(now);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const monthStart = ymdLocal(new Date(now.getFullYear(), now.getMonth(), 1));
  const prevStart = ymdLocal(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastPrevDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const prevSameDay = ymdLocal(new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), lastPrevDay)));
  const between = (a: string, b: string) => sum(items.filter((e) => e.spent_at >= a && e.spent_at <= b));
  return {
    today: between(today, today),
    week: between(ymdLocal(monday), today),
    month: between(monthStart, today),
    prevMonthToDate: between(prevStart, prevSameDay),
  };
}

/** One total per day of `month` (index 0 = the 1st). */
export function dailySeries(items: { amount: number | string; spent_at: string }[], month: Date): number[] {
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const prefix = ymdLocal(month).slice(0, 8);
  const out = new Array<number>(days).fill(0);
  items.forEach((e) => { if (e.spent_at.startsWith(prefix)) out[Number(e.spent_at.slice(8, 10)) - 1] += cents(Number(e.amount)); });
  return out.map((c) => c / 100);
}
