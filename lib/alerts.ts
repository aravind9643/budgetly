import type { CategoryBudget, Expense } from './supabase';

export type BudgetAlert = { key: string; label: string; spent: number; limit: number; pct: number; level: 80 | 100 };

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Limits at >= 80% in the month containing `today`, highest first. `level` is the highest threshold crossed.
 * The overall budget uses the key `__overall`. Pure (no React Native imports) so it runs under `npm test`.
 */
export function budgetAlerts(
  expenses: Expense[], overall: number, catBudgets: CategoryBudget[], labelOf: (category: string) => string, today = new Date(),
): BudgetAlert[] {
  const y = today.getFullYear(), m = today.getMonth();
  const start = `${y}-${pad(m + 1)}-01`;
  const end = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
  const byCat: Record<string, number> = {};
  for (const e of expenses) {
    if (e.type !== 'expense' || e.spent_at < start || e.spent_at > end) continue;
    byCat[e.category] = (byCat[e.category] ?? 0) + Number(e.amount);
  }
  const total = Object.values(byCat).reduce((a, b) => a + b, 0);
  const out: BudgetAlert[] = [];
  const add = (key: string, label: string, spent: number, limit: number) => {
    if (limit <= 0) return;
    const pct = spent / limit;
    if (pct >= 0.8) out.push({ key, label, spent, limit, pct, level: pct >= 1 ? 100 : 80 });
  };
  add('__overall', 'Monthly', total, overall);
  for (const b of catBudgets) add(b.category, labelOf(b.category), byCat[b.category] ?? 0, Number(b.amount));
  return out.sort((a, b) => b.pct - a.pct);
}
