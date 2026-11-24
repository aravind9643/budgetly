import type { Expense, Settlement, Split, SplitType } from './supabase';

/** Work in integer cents so splits always add up exactly. */
const cents = (n: number) => Math.round(n * 100);

/**
 * Net balance per user, in currency units. Positive means the group owes them; negative means they owe.
 * Expenses with no stored splits (written by an older client) count as an equal split among current members.
 */
export function computeBalances(
  expenses: Expense[], splits: Split[], settlements: Settlement[], memberIds: string[],
): Record<string, number> {
  const net: Record<string, number> = {};
  const add = (u: string, c: number) => { net[u] = (net[u] ?? 0) + c; };
  memberIds.forEach((u) => { net[u] = 0; });

  const byExpense = new Map<string, Split[]>();
  splits.forEach((s) => byExpense.set(s.expense_id, [...(byExpense.get(s.expense_id) ?? []), s]));

  for (const e of expenses) {
    if (e.type !== 'expense' || e.is_personal) continue;
    const total = cents(Number(e.amount));
    let shares = (byExpense.get(e.id) ?? []).map((s) => ({ user: s.user_id, c: cents(Number(s.amount)) }));
    if (!shares.length && memberIds.length) {
      shares = splitCents('equal', total, memberIds.map((u) => ({ user_id: u, weight: 1 }))).map((x) => ({ user: x.user_id, c: x.c }));
    }
    add(e.paid_by ?? e.user_id, total);
    shares.forEach((s) => add(s.user, -s.c));
  }
  for (const s of settlements) {
    add(s.from_user, cents(Number(s.amount)));
    add(s.to_user, -cents(Number(s.amount)));
  }
  return Object.fromEntries(Object.entries(net).map(([u, c]) => [u, c / 100]));
}

export type Transfer = { from: string; to: string; amount: number };

/** Greedy settle-up: repeatedly match the largest debtor with the largest creditor. At most n-1 transfers. */
export function simplifyDebts(net: Record<string, number>): Transfer[] {
  const debt = Object.entries(net).map(([u, v]) => ({ u, c: cents(v) })).filter((x) => x.c !== 0);
  const creditors = debt.filter((x) => x.c > 0).sort((a, b) => b.c - a.c);
  const debtors = debt.filter((x) => x.c < 0).map((x) => ({ u: x.u, c: -x.c })).sort((a, b) => b.c - a.c);
  const out: Transfer[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const c = Math.min(debtors[i].c, creditors[j].c);
    if (c > 0) out.push({ from: debtors[i].u, to: creditors[j].u, amount: c / 100 });
    debtors[i].c -= c; creditors[j].c -= c;
    if (debtors[i].c === 0) i++;
    if (creditors[j].c === 0) j++;
  }
  return out;
}

/**
 * Turn split weights into amounts that add up exactly to `total` (both in cents).
 * equal: weight ignored · percent: weight = % · shares: weight = share count · exact: weight = amount in units.
 * Leftover cents from rounding go to the people with the largest fractional remainders.
 */
export function splitCents(type: SplitType, totalCents: number, entries: { user_id: string; weight: number }[]) {
  if (!entries.length) return [];
  if (type === 'exact') return entries.map((e) => ({ user_id: e.user_id, c: cents(e.weight || 0) }));
  const w = entries.map((e) => (type === 'equal' ? 1 : Math.max(0, e.weight || 0)));
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum <= 0) return entries.map((e) => ({ user_id: e.user_id, c: 0 }));
  const raw = w.map((x) => (totalCents * x) / sum);
  const base = raw.map(Math.floor);
  let left = totalCents - base.reduce((a, b) => a + b, 0);
  raw.map((r, i) => ({ i, f: r - base[i] })).sort((a, b) => b.f - a.f).forEach(({ i }) => { if (left > 0) { base[i]++; left--; } });
  return entries.map((e, i) => ({ user_id: e.user_id, c: base[i] }));
}
