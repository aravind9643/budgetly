import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, View } from 'react-native';
import { Text, TextInput } from '@/components/Typography';
import { Avatar, Button, Field, IconButton, Press, Segmented, Sheet, s, tap } from '@/components/ui';
import { splitCents } from '@/lib/balances';
import { useFeedback } from '@/lib/feedback';
import { Expense, Split, SplitType, supabase } from '@/lib/supabase';
import { allCategories, C, dayLabel, money, parseYmd, R, S, T, ymd } from '@/lib/theme';

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
  // Receipt: a newly picked local image, the signed URL of an existing one, or a pending removal.
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  // Progressive disclosure: most expenses are "paid by me, split equally with everyone".
  const [splitOpen, setSplitOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setErr({}); setReceiptUri(null); setReceiptUrl(null); setRemoveReceipt(false);
    if (editing?.receipt_path) {
      supabase.storage.from('receipts').createSignedUrl(editing.receipt_path, 3600).then(({ data }) => setReceiptUrl(data?.signedUrl ?? null));
    }
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
    const { data: savedId, error } = await supabase.rpc('save_expense', {
      p_id: editing?.id ?? null, p_group: groupId, p_title: title.trim(), p_amount: total,
      p_category: type === 'income' ? 'other' : category, p_type: type, p_spent_at: date,
      p_paid_by: type === 'income' || personal ? me : paidBy, p_personal: type === 'expense' && personal,
      p_split_type: mode,
      p_splits: shared
        ? parts.map((x) => ({ user_id: x.user_id, amount: x.c / 100, weight: mode === 'equal' || mode === 'exact' ? null : Number(weights[x.user_id]) || 0 }))
        : [],
    } as any);
    // Shown inline, because a toast would render underneath this modal on web.
    if (error) { setBusy(false); return setErr({ form: error.message }); }
    const receiptError = await syncReceipt(String(savedId));
    setBusy(false);
    if (receiptError) toast(`Saved, but the receipt did not upload: ${receiptError}`, 'error');
    else toast(editing ? 'Transaction updated' : `${type === 'income' ? 'Income' : 'Expense'} added`, 'success');
    onSaved(); onClose();
  };

  // Upload a newly picked receipt to receipts/<space>/<expense>.jpg, or clear a removed one.
  const syncReceipt = async (expenseId: string): Promise<string | null> => {
    try {
      if (receiptUri) {
        const body = await (await fetch(receiptUri)).arrayBuffer();
        const path = `${groupId}/${expenseId}.jpg`;
        const up = await supabase.storage.from('receipts').upload(path, body, { contentType: 'image/jpeg', upsert: true });
        if (up.error) return up.error.message;
        const { error } = await supabase.from('expenses').update({ receipt_path: path }).eq('id', expenseId);
        return error?.message ?? null;
      }
      if (removeReceipt && editing?.receipt_path) {
        await supabase.storage.from('receipts').remove([editing.receipt_path]);
        const { error } = await supabase.from('expenses').update({ receipt_path: null }).eq('id', expenseId);
        return error?.message ?? null;
      }
    } catch (e: any) { return e?.message ?? 'upload failed'; }
    return null;
  };

  const pickReceipt = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!res.canceled && res.assets[0]) { setReceiptUri(res.assets[0].uri); setRemoveReceipt(false); }
  };

  // Delete immediately and offer Undo (faster than an "are you sure?" step; nothing is lost).
  const remove = async () => {
    if (!editing) return;
    const snapshot = { ...editing };
    const snapSplits = editingSplits.map((x) => ({ user_id: x.user_id, amount: Number(x.amount), weight: x.weight }));
    setBusy(true);
    const { error } = await supabase.from('expenses').delete().eq('id', editing.id);
    setBusy(false);
    if (error) return setErr({ form: error.message });
    onSaved(); onClose();
    toast(`"${snapshot.title}" deleted`, 'info', {
      label: 'Undo',
      onPress: async () => {
        const { data: id, error: e } = await supabase.rpc('save_expense', {
          p_id: null, p_group: groupId, p_title: snapshot.title, p_amount: Number(snapshot.amount), p_category: snapshot.category,
          p_type: snapshot.type, p_spent_at: snapshot.spent_at, p_paid_by: snapshot.paid_by, p_personal: snapshot.is_personal,
          p_split_type: snapshot.split_type, p_splits: snapSplits,
        } as any);
        if (e) return toast(`Could not restore: ${e.message}`, 'error');
        if (snapshot.receipt_path) await supabase.from('expenses').update({ receipt_path: snapshot.receipt_path }).eq('id', String(id));
        toast('Restored', 'success'); onSaved();
      },
    });
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
          <Button title={editing ? 'Save changes' : `Add ${type}`} loading={busy} onPress={save} />
          {editing && <Button title="Delete" variant="ghost" icon="trash-outline" onPress={remove} />}
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
        {/* Quick add: tap to add to the amount (fast for round numbers) */}
        <View style={[s.row, { gap: S.sm, marginTop: 4 }]}>
          {[5, 10, 20, 50, 100].map((v) => (
            <Pressable key={v} accessibilityLabel={`Add ${v}`} onPress={() => { tap(); setAmount(String(+((Number(amount) || 0) + v).toFixed(2))); setErr((x) => ({ ...x, amount: undefined })); }}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.sub, fontWeight: '700', fontSize: 13 }}>+{v}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Field label="Description" placeholder={type === 'expense' ? 'e.g. Weekly groceries' : 'e.g. Salary'} value={title}
        onChangeText={(t) => { setTitle(t); setErr((x) => ({ ...x, title: undefined })); }} error={err.title}
        returnKeyType="done" />

      {type === 'expense' && (
        <View style={{ gap: 6 }}>
          <Text style={T.label}>Category</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
            {allCategories().map(([k, v]) => {
              const active = category === k;
              return (
                <Press key={k} onPress={() => setCategory(k)} accessibilityLabel={v.label}
                  style={{
                    flexBasis: '22%', flexGrow: 1, paddingVertical: S.sm, borderRadius: R.md, alignItems: 'center', gap: 4,
                    backgroundColor: active ? v.color + '22' : C.surface2, borderWidth: 1.5, borderColor: active ? v.color : 'transparent',
                  }}>
                  {v.emoji ? <Text style={{ fontSize: 19 }}>{v.emoji}</Text> : <Ionicons name={v.icon} size={20} color={active ? v.color : C.sub} />}
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

      {type === 'expense' && (
        <View style={{ gap: 6 }}>
          <Text style={T.label}>Receipt</Text>
          {(receiptUri || (receiptUrl && !removeReceipt)) ? (
            <View style={[s.row, { gap: S.md, padding: S.sm, borderRadius: R.md, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border }]}>
              <Image source={{ uri: receiptUri ?? receiptUrl! }} style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: C.border }} accessibilityLabel="Receipt photo" />
              <Text style={[T.body, { flex: 1, color: C.sub }]}>{receiptUri ? 'New photo attached' : 'Receipt attached'}</Text>
              <Pressable hitSlop={8} onPress={pickReceipt} accessibilityLabel="Replace receipt" style={{ padding: 6 }}>
                <Text style={{ color: C.primary, fontWeight: '700' }}>Replace</Text>
              </Pressable>
              <Pressable hitSlop={8} onPress={() => { setReceiptUri(null); setRemoveReceipt(true); }} accessibilityLabel="Remove receipt" style={{ padding: 6 }}>
                <Ionicons name="close-circle" size={22} color={C.muted} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={pickReceipt} accessibilityRole="button" accessibilityLabel="Attach a receipt photo"
              style={[s.row, { gap: S.sm, padding: S.md, borderRadius: R.md, borderWidth: 1, borderStyle: 'dashed', borderColor: C.borderStrong }]}>
              <Ionicons name="camera-outline" size={20} color={C.primary} />
              <Text style={{ color: C.primary, fontWeight: '700' }}>Attach a photo</Text>
            </Pressable>
          )}
        </View>
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
