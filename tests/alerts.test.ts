import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { budgetAlerts } from '../lib/alerts.ts';

const today = new Date(2026, 10, 24); // 24 Nov 2026
const E = (category: string, amount: number, spent_at = '2026-11-10', type = 'expense') => ({ category, amount, spent_at, type }) as any;
const label = (k: string) => k.toUpperCase();

describe('budgetAlerts', () => {
  it('flags a category at 80% and one over 100%, highest first', () => {
    const out = budgetAlerts([E('food', 85), E('fun', 120)], 0,
      [{ group_id: 'g', category: 'food', amount: 100 }, { group_id: 'g', category: 'fun', amount: 100 }] as any, label, today);
    assert.deepEqual(out.map((a) => [a.key, a.level]), [['fun', 100], ['food', 80]]);
    assert.equal(out[1].label, 'FOOD');
  });
  it('ignores limits under 80%, other months and income', () => {
    const out = budgetAlerts([E('food', 70), E('food', 500, '2026-10-30'), E('food', 500, '2026-11-12', 'income')], 0,
      [{ group_id: 'g', category: 'food', amount: 100 }] as any, label, today);
    assert.deepEqual(out, []);
  });
  it('includes the overall budget under __overall', () => {
    const out = budgetAlerts([E('food', 300), E('bills', 200)], 500, [], label, today);
    assert.deepEqual(out.map((a) => [a.key, a.level, a.spent]), [['__overall', 100, 500]]);
  });
  it('treats a zero limit as "no limit"', () => {
    assert.deepEqual(budgetAlerts([E('food', 999)], 0, [], label, today), []);
  });
});
