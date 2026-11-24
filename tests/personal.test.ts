import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dailySeries, periodTotals, withMyShare } from '../lib/personal.ts';

const E = (id: string, amount: number, extra: Record<string, unknown> = {}) =>
  ({ id, amount, type: 'expense', is_personal: false, paid_by: 'A', user_id: 'A', spent_at: '2026-11-24', ...extra }) as any;

describe('withMyShare', () => {
  const splits = [{ expense_id: '1', user_id: 'A', amount: 30 }, { expense_id: '1', user_id: 'B', amount: 60 }];
  it('uses my split, not what I paid', () => {
    assert.deepEqual(withMyShare([E('1', 90)], splits, 'A', ['A', 'B']).map((e) => e.amount), [30]);
    assert.deepEqual(withMyShare([E('1', 90)], splits, 'B', ['A', 'B']).map((e) => e.amount), [60]);
  });
  it('counts personal expenses only for their owner and skips income', () => {
    const xs = [E('2', 12, { is_personal: true }), E('3', 500, { type: 'income' })];
    assert.deepEqual(withMyShare(xs, [], 'A', ['A', 'B']).map((e) => e.amount), [12]);
    assert.deepEqual(withMyShare(xs, [], 'B', ['A', 'B']), []);
  });
  it('splits old expenses without splits equally, adding up to the total', () => {
    const t = ['A', 'B', 'C'].map((u) => withMyShare([E('4', 10)], [], u, ['A', 'B', 'C'])[0].amount);
    assert.equal(Math.round(t.reduce((a, b) => a + b, 0) * 100), 1000);
  });
});

describe('periodTotals', () => {
  it('splits into today, week, month and last month to date', () => {
    const now = new Date(2026, 10, 24); // Tue 24 Nov
    const items = [
      { amount: 5, spent_at: '2026-11-24' }, { amount: 7, spent_at: '2026-11-23' }, // Mon, same week
      { amount: 11, spent_at: '2026-11-02' }, { amount: 13, spent_at: '2026-10-20' }, { amount: 99, spent_at: '2026-10-28' },
    ];
    assert.deepEqual(periodTotals(items, now), { today: 5, week: 12, month: 23, prevMonthToDate: 13 });
  });
});

describe('dailySeries', () => {
  it('buckets by day of the month', () => {
    const s = dailySeries([{ amount: 2, spent_at: '2026-02-01' }, { amount: 3.1, spent_at: '2026-02-01' }, { amount: 4, spent_at: '2026-03-01' }], new Date(2026, 1, 1));
    assert.equal(s.length, 28);
    assert.equal(s[0], 5.1);
    assert.equal(s.slice(1).reduce((a, b) => a + b, 0), 0);
  });
});
