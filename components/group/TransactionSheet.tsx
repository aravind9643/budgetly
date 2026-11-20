import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Avatar, Button, Field, IconButton, Press, Segmented, Sheet, s, tap } from '@/components/ui';
import { splitCents } from '@/lib/balances';
import { useFeedback } from '@/lib/feedback';
import { Expense, Split, SplitType, supabase } from '@/lib/supabase';
import { C, CATEGORIES, dayLabel, money, parseYmd, R, S, T, ymd } from '@/lib/theme';

type Kind = 'expense' | 'income';
export type Person = { id: string; name: string };

/** Add a transaction, or edit/delete one you own. Expenses carry a payer and a split between members. */
export function TransactionSheet({ visible, onClose, groupId, me, cur, editing, editingSplits, people, onSaved }: {
  visible: boolean; onClose: () => void; groupId: string; me: string; cur: string;
  editing: Expense | null; editingSplits: Split[]; people: Person[]; onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const [type, setType] = useState<Kind>('expense');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('food');
  const [date, setDate] = useState(ymd(new Date()));
  const [paidBy, setPaidBy] = useState(me);
  const [personal, setPersonal] = useState(false);
  const [mode, setMode] = useState<SplitType>('equal');
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ amount?: string; title?: string; form?: string }>({});
  const [confirmDel, setConfirmDel] = useState(false);
  // Progressive disclosure: most expenses are "paid by me, split equally with everyone".
  const [splitOpen, setSplitOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setErr({}); setConfirmDel(false);
    setSplitOpen(!!editing && ((editing.split_type ?? 'equal') !== 'equal' || editing.paid_by !== me
      || (editingSplits.length > 0 && editingSplits.length !== people.length)));
    const all = Object.fromEntries(people.map((p) => [p.id, true]));
    if (editing) {
      setType(editing.type); setAmount(Number(editing.amount).toFixed(2)); setTitle(editing.title);
      setCategory(editing.category); setDate(editing.spent_at);
      setPaidBy(editing.paid_by ?? editing.user_id); setPersonal(!!editing.is_personal);
      const m = editing.split_type ?? 'equal';
      setMode(m);
      if (editingSplits.length) {
        setIncluded(Object.fromEntries(people.map((p) => [p.id, editingSplits.some((x) => x.user_id === p.id)])));
        setWeights(Object.fromEntries(editingSplits.map((x) => [x.user_id,
          m === 'exact' ? Number(x.amount).toFixed(2) : x.weight != null ? String(Number(x.weight)) : ''])));
      } else { setIncluded(all); setWeights({}); }
    } else {
      setType('expense'); setAmount(''); setTitle(''); setCategory('food'); setDate(ymd(new Date()));
      setPaidBy(me); setPersonal(false); setMode('equal'); setIncluded(all); setWeights({});
    }
  }, [visible, editing]);

  // Seed sensible weights when switching modes, so the user starts from a valid split.
  const switchMode = (m: SplitType) => {
    const ids = people.filter((p) => included[p.id]).map((p) => p.id);
    const total = Number(amount) || 0;
    const seeded: Record<string, string> = {};
    if (m === 'percent') {
      const each = splitCents('equal', 10000, ids.map((u) => ({ user_id: u, weight: 1 })));
      each.forEach((x) => { seeded[x.user_id] = String(x.c / 100); });
    } else if (m === 'shares') ids.forEach((u) => { seeded[u] = '1'; });
    else if (m === 'exact') {
      splitCents('equal', Math.round(total * 100), ids.map((u) => ({ user_id: u, weight: 1 })))
        .forEach((x) => { seeded[x.user_id] = (x.c / 100).toFixed(2); });
    }
    setWeights(seeded); setMode(m);
  };

  const total = Number(amount) || 0;
  const shared = type === 'expense' && !personal;
  const parts = useMemo(() => {
    const entries = people.filter((p) => included[p.id]).map((p) => ({ user_id: p.id, weight: Number(weights[p.id]) || 0 }));
    return splitCents(mode, Math.round(total * 100), entries);
  }, [people, included, weights, mode, total]);

  // Validation message for the split, or null when it adds up.
  const splitIssue = useMemo(() => {
    if (!shared) return null;
    if (!parts.length) return 'Pick at least one person';
    if (mode === 'percent') {
      const p = people.filter((x) => included[x.id]).reduce((a, x) => a + (Number(weights[x.id]) || 0), 0);
      if (Math.abs(p - 100) > 0.001) return `Percentages add up to ${+p.toFixed(2)}%, not 100%`;
    }
    if (mode === 'shares' && parts.every((x) => x.c === 0) && total > 0) return 'Give at least one person a share';
    if (mode === 'exact') {
      const diff = Math.round(total * 100) - parts.reduce((a, x) => a + x.c, 0);
      if (diff !== 0) return diff > 0 ? `${money(diff / 100, cur)} still to assign` : `${money(-diff / 100, cur)} over the total`;
    }
    return null;
  }, [shared, parts, mode, weights, included, total]);

  const shiftDay = (n: number) => {
    const d = parseYmd(date); d.setDate(d.getDate() + n);
    if (d > new Date()) return;
    setDate(ymd(d));
  };

  const save = async () => {
    const e: typeof err = {};
    if (!(total > 0)) e.amount = 'Enter an amount';
    if (!title.trim()) e.title = 'Add a short description';
    if (splitIssue) { e.form = splitIssue; setSplitOpen(true); }
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const { error } = await supabase.rpc('save_expense', {
      p_id: editing?.id ?? null, p_group: groupId, p_title: title.trim(), p_amount: total,
      p_category: type === 'income' ? 'other' : category, p_type: type, p_spent_at: date,
      p_paid_by: type === 'income' || personal ? me : paidBy, p_personal: type === 'expense' && personal,
      p_split_type: mode,
      p_splits: shared
        ? parts.map((x) => ({ user_id: x.user_id, amount: x.c / 100, weight: mode === 'equal' || mode === 'exact' ? null : Number(weights[x.user_id]) || 0 }))
        : [],
    } as any);
    setBusy(false);
    // Shown inline, because a toast would render underneath this modal on web.
    if (error) return setErr({ form: error.message });
    toast(editing ? 'Transaction updated' : `${type === 'income' ? 'Income' : 'Expense'} added`, 'success');
    onSaved(); onClose();
  };

  const remove = async () => {
    if (!editing) return;
    // Two-step inline confirm: a second modal can't be stacked on top of this sheet.
    if (!confirmDel) return setConfirmDel(true);
    setBusy(true);
    const { error } = await supabase.from('expenses').delete().eq('id', editing.id);
    setBusy(false);
    if (error) return setErr({ form: error.message });
    toast('Transaction deleted', 'success');
    onSaved(); onClose();
  };

  const tone = type === 'expense' ? C.negative : C.positive;
  const isToday = date === ymd(new Date());
  const nameOf = (id: string) => (id === me ? 'You' : people.find((p) => p.id === id)?.name ?? 'Member');
  const solo = people.length <= 1;

  return (
    <Sheet visible={visible} onClose={onClose} title={editing ? 'Edit transaction' : 'New transaction'}
      footer={
        <View style={{ gap: S.sm }}>
          {err.form && (
            <View style={[s.row, { gap: S.sm, backgroundColor: C.negativeSoft, padding: S.md, borderRadius: R.md }]}>
              <Ionicons name="alert-circle" size={18} color={C.negative} />
              <Text style={{ color: C.negative, flex: 1 }}>{err.form}</Text>
            </View>
          )}
          {confirmDel ? (
            <>
              <Text style={[T.body, { color: C.sub, textAlign: 'center' }]}>Delete "{editing?.title}" for everyone?</Text>
              <View style={[s.row, { gap: S.sm }]}>
                <Button title="Cancel" variant="secondary" onPress={() => setConfirmDel(false)} style={{ flex: 1 }} />
                <Button title="Delete" variant="danger" icon="trash-outline" loading={busy} onPress={remove} style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <>
              <Button title={editing ? 'Save changes' : `Add ${type}`} loading={busy} onPress={save} />
              {editing && <Button title="Delete" variant="ghost" icon="trash-outline" onPress={remove} />}
            </>
          )}
        </View>
      }>
      <Segmented<Kind> value={type} onChange={setType} tones={{ expense: C.negative, income: C.positive }}
        options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />

      {/* Amount: the main input */}
      <View style={{ alignItems: 'center', gap: 4, paddingVertical: S.sm }}>
        <View style={[s.row, { gap: 6 }]}>
          <Text style={{ color: C.muted, fontSize: 22, fontWeight: '700' }}>{cur}</Text>
          <TextInput
            value={amount} onChangeText={(t) => { setAmount(t.replace(/[^0-9.]/g, '')); setErr((x) => ({ ...x, amount: undefined })); }}
            placeholder="0.00" placeholderTextColor={C.borderStrong} keyboardType="decimal-pad" autoFocus={!editing}
            accessibilityLabel="Amount"
            style={{ color: tone, fontSize: 44, fontWeight: '800', width: Math.max(120, (amount.length || 4) * 28), textAlign: 'center', letterSpacing: -1, outlineStyle: 'none' } as any} />
        </View>
        {err.amount && <Text style={{ color: C.negative, fontSize: 12 }}>{err.amount}</Text>}
      </View>

      <Field label="Description" placeholder={type === 'expense' ? 'e.g. Weekly groceries' : 'e.g. Salary'} value={title}
        onChangeText={(t) => { setTitle(t); setErr((x) => ({ ...x, title: undefined })); }} error={err.title}
        returnKeyType="done" />

      {type === 'expense' && (
        <View style={{ gap: 6 }}>
          <Text style={T.label}>Category</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
            {Object.entries(CATEGORIES).map(([k, v]) => {
              const active = category === k;
              return (
                <Press key={k} onPress={() => setCategory(k)} accessibilityLabel={v.label}
                  style={{
                    flexBasis: '22%', flexGrow: 1, paddingVertical: S.sm, borderRadius: R.md, alignItems: 'center', gap: 4,
                    backgroundColor: active ? v.color + '22' : C.surface2, borderWidth: 1.5, borderColor: active ? v.color : 'transparent',
                  }}>
                  <Ionicons name={v.icon} size={20} color={active ? v.color : C.sub} />
                  <Text style={{ color: active ? C.text : C.sub, fontSize: 11, fontWeight: '600' }}>{v.label}</Text>
                </Press>
              );
            })}
          </View>
        </View>
      )}

      {type === 'expense' && !solo && (
        <>
          {/* Personal vs shared */}
          <Pressable onPress={() => { tap(); setPersonal(!personal); setErr((x) => ({ ...x, form: undefined })); }}
            accessibilityRole="switch" accessibilityState={{ checked: !personal }} accessibilityLabel="Shared with members"
            style={[s.row, { gap: S.md, padding: S.md, borderRadius: R.md, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border }]}>
            <Ionicons name={personal ? 'person' : 'people'} size={20} color={personal ? C.warn : C.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[T.body, { fontWeight: '600' }]}>Shared with members</Text>
              <Text style={T.caption}>{personal ? 'Off: personal. Counts in stats, not in balances' : 'On: counts toward who owes who'}</Text>
            </View>
            {/* Switch state matches the label: ON = shared. */}
            <View style={{ width: 44, height: 26, borderRadius: 13, padding: 3, backgroundColor: personal ? C.borderStrong : C.primary, alignItems: personal ? 'flex-start' : 'flex-end' }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
            </View>
          </Pressable>

          {shared && !splitOpen && (
            <Pressable onPress={() => { tap(); setSplitOpen(true); }} accessibilityRole="button" accessibilityLabel="Change payer or split"
              style={[s.row, { gap: S.md, padding: S.md, borderRadius: R.md, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border }]}>
              <Avatar name={people.find((p) => p.id === paidBy)?.name ?? '?'} size={30} />
              <Text style={[T.body, { flex: 1 }]} numberOfLines={2}>
                Paid by <Text style={{ fontWeight: '700' }}>{nameOf(paidBy).replace(/^You$/, 'you')}</Text>
                {' · '}{mode === 'equal' ? 'split equally' : `custom split (${mode === 'percent' ? '%' : mode})`} between{' '}
                <Text style={{ fontWeight: '700' }}>{parts.length === people.length ? `all ${parts.length}` : parts.length}</Text>
              </Text>
              <Text style={{ color: C.primary, fontWeight: '700' }}>Change</Text>
            </Pressable>
          )}
          {shared && splitOpen && (
            <>
              <View style={{ gap: 6 }}>
                <Text style={T.label}>Paid by</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
                  {people.map((p) => {
                    const active = paidBy === p.id;
                    return (
                      <Press key={p.id} onPress={() => setPaidBy(p.id)} accessibilityLabel={`Paid by ${nameOf(p.id)}`}
                        style={[s.row, { gap: 6, paddingLeft: 4, paddingRight: 12, paddingVertical: 4, borderRadius: R.pill,
                          backgroundColor: active ? C.primarySoft : C.surface2, borderWidth: 1, borderColor: active ? C.primary : C.border }]}>
                        <Avatar name={p.name} size={26} />
                        <Text style={{ color: active ? C.text : C.sub, fontWeight: '600' }}>{nameOf(p.id)}</Text>
                      </Press>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: S.sm }}>
                <Text style={T.label}>Split</Text>
                <Segmented<SplitType> value={mode} onChange={switchMode}
                  options={[{ value: 'equal', label: 'Equal' }, { value: 'percent', label: '%' }, { value: 'shares', label: 'Shares' }, { value: 'exact', label: 'Exact' }]} />
                <View style={{ backgroundColor: C.surface2, borderRadius: R.md, borderWidth: 1, borderColor: C.border }}>
                  {people.map((p, i) => {
                    const on = !!included[p.id];
                    const part = parts.find((x) => x.user_id === p.id);
                    return (
                      <View key={p.id} style={[s.row, { gap: S.md, paddingHorizontal: S.md, paddingVertical: S.sm, minHeight: 52 },
                        i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
                        <Pressable hitSlop={6} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                          accessibilityLabel={`Include ${nameOf(p.id)}`}
                          onPress={() => { tap(); setIncluded((x) => ({ ...x, [p.id]: !on })); setErr((x) => ({ ...x, form: undefined })); }}
                          style={[s.row, { gap: S.md, flex: 1 }]}>
                          <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? C.primary : C.muted} />
                          <Text style={[T.body, { color: on ? C.text : C.muted }]} numberOfLines={1}>{nameOf(p.id)}</Text>
                        </Pressable>
                        {on && mode !== 'equal' && (
                          <View style={[s.row, { backgroundColor: C.surface, borderRadius: R.sm, borderWidth: 1, borderColor: C.border, paddingHorizontal: S.sm, height: 36, width: 92 }]}>
                            <TextInput value={weights[p.id] ?? ''} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.muted}
                              accessibilityLabel={`${mode} for ${nameOf(p.id)}`}
                              onChangeText={(t) => { setWeights((w) => ({ ...w, [p.id]: t.replace(/[^0-9.]/g, '') })); setErr((x) => ({ ...x, form: undefined })); }}
                              style={{ flex: 1, color: C.text, fontSize: 15, textAlign: 'right', outlineStyle: 'none', minWidth: 0 } as any} />
                            <Text style={[T.caption, { marginLeft: 4 }]}>{mode === 'percent' ? '%' : mode === 'shares' ? '×' : ''}</Text>
                          </View>
                        )}
                        <Text style={[T.body, { width: 84, textAlign: 'right', fontWeight: '600', color: on ? C.text : C.muted, fontVariant: ['tabular-nums'] }]}>
                          {on ? money((part?.c ?? 0) / 100, cur) : '—'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {splitIssue && total > 0 && <Text style={{ color: C.warn, fontSize: 12 }}>{splitIssue}</Text>}
              </View>
            </>
          )}
        </>
      )}

      <View style={{ gap: 6 }}>
        <Text style={T.label}>Date</Text>
        <View style={[s.row, { backgroundColor: C.surface2, borderRadius: R.md, padding: 4, borderWidth: 1, borderColor: C.border }]}>
          <IconButton icon="chevron-back" label="Previous day" tone="plain" onPress={() => shiftDay(-1)} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={T.heading}>{dayLabel(date)}</Text>
            <Text style={T.caption}>{parseYmd(date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </View>
          <View style={{ opacity: isToday ? 0.3 : 1 }}>
            <IconButton icon="chevron-forward" label="Next day" tone="plain" onPress={() => shiftDay(1)} />
          </View>
        </View>
      </View>
    </Sheet>
  );
}
