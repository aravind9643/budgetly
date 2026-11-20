import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button, Field, IconButton, Press, Segmented, Sheet, s } from '@/components/ui';
import { useFeedback } from '@/lib/feedback';
import { Expense, supabase } from '@/lib/supabase';
import { C, CATEGORIES, dayLabel, parseYmd, R, S, T, ymd } from '@/lib/theme';

type Kind = 'expense' | 'income';

/** Add a transaction, or edit/delete one you own. */
export function TransactionSheet({ visible, onClose, groupId, me, cur, editing, onSaved }: {
  visible: boolean; onClose: () => void; groupId: string; me: string; cur: string;
  editing: Expense | null; onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const [type, setType] = useState<Kind>('expense');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('food');
  const [date, setDate] = useState(ymd(new Date()));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ amount?: string; title?: string; form?: string }>({});
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setErr({}); setConfirmDel(false);
    if (editing) {
      setType(editing.type); setAmount(Number(editing.amount).toFixed(2)); setTitle(editing.title);
      setCategory(editing.category); setDate(editing.spent_at);
    } else {
      setType('expense'); setAmount(''); setTitle(''); setCategory('food'); setDate(ymd(new Date()));
    }
  }, [visible, editing]);

  const shiftDay = (n: number) => {
    const d = parseYmd(date); d.setDate(d.getDate() + n);
    if (d > new Date()) return;
    setDate(ymd(d));
  };

  const save = async () => {
    const amt = Number(amount);
    const e: typeof err = {};
    if (!(amt > 0)) e.amount = 'Enter an amount';
    if (!title.trim()) e.title = 'Add a short description';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const row = { title: title.trim(), amount: amt, category: type === 'income' ? 'other' : category, type, spent_at: date };
    const { error } = editing
      ? await supabase.from('expenses').update(row).eq('id', editing.id)
      : await supabase.from('expenses').insert({ ...row, group_id: groupId, user_id: me });
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
        returnKeyType="done" onSubmitEditing={save} />

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
