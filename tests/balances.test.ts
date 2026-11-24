import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeBalances, simplifyDebts, splitCents } from '../lib/balances.ts';

const sumC = (xs: { c: number }[]) => xs.reduce((a, x) => a + x.c, 0);
const E = (id: string, paid: string, amount: number, extra: Record<string, unknown> = {}) =>
  ({ id, paid_by: paid, user_id: paid, amount, type: 'expense', is_personal: false, ...extra }) as any;

describe('splitCents', () => {
  it('splits equally and always adds up to the total', () => {
    const r = splitCents('equal', 10000, [{ user_id: 'a', weight: 0 }, { user_id: 'b', weight: 0 }, { user_id: 'c', weight: 0 }]);
    assert.equal(sumC(r), 10000);
    assert.deepEqual(r.map((x) => x.c).sort(), [3333, 3333, 3334]);
  });
  it('handles percentages with rounding remainders', () => {
    const r = splitCents('percent', 9999, [{ user_id: 'a', weight: 60 }, { user_id: 'b', weight: 40 }]);
    assert.equal(sumC(r), 9999);
  });
  it('handles shares', () => {
    assert.deepEqual(splitCents('shares', 1000, [{ user_id: 'a', weight: 2 }, { user_id: 'b', weight: 1 }]).map((x) => x.c), [667, 333]);
  });
  it('uses exact amounts as given', () => {
    assert.deepEqual(splitCents('exact', 1000, [{ user_id: 'a', weight: 7.5 }, { user_id: 'b', weight: 2.5 }]).map((x) => x.c), [750, 250]);
  });
  it('returns zeros when every weight is zero', () => {
    assert.deepEqual(splitCents('shares', 1000, [{ user_id: 'a', weight: 0 }]).map((x) => x.c), [0]);
  });
});

describe('computeBalances', () => {
  const splits = [
    { expense_id: '1', user_id: 'A', amount: 30, weight: null },
    { expense_id: '1', user_id: 'B', amount: 30, weight: null },
    { expense_id: '1', user_id: 'C', amount: 30, weight: null },
    { expense_id: '2', user_id: 'A', amount: 30, weight: null },
  ];
  const expenses = [E('1', 'A', 90), E('2', 'B', 30), E('3', 'A', 50, { is_personal: true }), E('4', 'A', 999, { type: 'income' })];
  const settlements = [{ from_user: 'C', to_user: 'A', amount: 10 }] as any;

  it('nets payments, shares and repayments; ignores personal and income', () => {
    assert.deepEqual(computeBalances(expenses, splits, settlements, ['A', 'B', 'C']), { A: 20, B: 0, C: -20 });
  });
  it('always sums to zero', () => {
    const net = computeBalances(expenses, splits, settlements, ['A', 'B', 'C']);
    assert.equal(Object.values(net).reduce((a, b) => a + b, 0), 0);
  });
  it('treats an expense with no stored splits as an equal split among members', () => {
    assert.deepEqual(computeBalances([E('9', 'A', 30)], [], [], ['A', 'B', 'C']), { A: 20, B: -10, C: -10 });
  });
  it('keeps former members who still have a balance', () => {
    const net = computeBalances([E('1', 'X', 20)], [{ expense_id: '1', user_id: 'A', amount: 20, weight: null }], [], ['A']);
    assert.deepEqual(net, { A: -20, X: 20 });
  });
});

describe('simplifyDebts', () => {
  it('matches the largest debtor with the largest creditor', () => {
    assert.deepEqual(simplifyDebts({ A: 30, B: -10, C: -20 }), [{ from: 'C', to: 'A', amount: 20 }, { from: 'B', to: 'A', amount: 10 }]);
  });
  it('needs at most n-1 payments and clears every balance', () => {
    const net = { A: 50, B: -20, C: -20, D: -10.01, E: 0.01 };
    const t = simplifyDebts(net);
    assert.ok(t.length <= 4);
    const after: Record<string, number> = { ...net };
    t.forEach(({ from, to, amount }) => { after[from] += amount; after[to] -= amount; });
    Object.values(after).forEach((v) => assert.ok(Math.abs(v) < 0.005));
  });
  it('returns nothing when everyone is even', () => {
    assert.deepEqual(simplifyDebts({ A: 0, B: 0 }), []);
  });
});
