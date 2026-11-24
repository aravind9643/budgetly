import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/Typography';
import { BackButton } from '@/components/Nav';
import { Button, Card, Divider, EmptyState, Field, IconButton, IconTile, Press, Screen, Segmented, Sheet, s } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { splitCents } from '@/lib/balances';
import { useFeedback } from '@/lib/feedback';
import { useHousehold } from '@/lib/household';
import { Frequency, Recurring, supabase } from '@/lib/supabase';
import { allCategories, C, catMeta, dayLabel, money, parseYmd, R, S, T, ymd } from '@/lib/theme';
import { useThemeMode } from '@/lib/themeMode';

const FREQ: Record<Frequency, string> = { weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' };

/** Repeating costs (rent, subscriptions) for the current space. Due entries are created automatically when the space opens. */
export default function RecurringScreen() {
  useThemeMode(); // re-render this screen when light/dark changes
  const router = useRouter();
  const { session } = useAuth();
  const { toast, confirm } = useFeedback();
  const { data } = useHousehold();
  const me = session?.user.id ?? '';
  const [sheet, setSheet] = useState(false);
  const g = data.group;
  const cur = g?.currency ?? 'USD';
  const isAdmin = g?.owner_id === me || data.members.find((m) => m.user_id === me)?.role === 'admin';
  const monthlyTotal = data.recurring.filter((r) => r.active).reduce((a, r) =>
    a + Number(r.amount) * (r.frequency === 'weekly' ? 52 / 12 : r.frequency === 'yearly' ? 1 / 12 : 1), 0);

  const toggle = async (r: Recurring) => {
    const { error } = await supabase.from('recurring_expenses').update({ active: !r.active }).eq('id', r.id);
    if (error) return toast(error.message, 'error');
    toast(r.active ? `${r.title} paused` : `${r.title} resumed`, 'success'); data.reload();
  };
  const remove = async (r: Recurring) => {
    if (!(await confirm({ title: `Stop "${r.title}"?`, message: 'Entries it already created stay in Activity.', confirmLabel: 'Stop', destructive: true }))) return;
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', r.id);
    if (error) return toast(error.message, 'error');
    toast('Recurring expense removed'); data.reload();
  };

  return (
    <Screen>
      <View style={[s.row, { gap: S.md, paddingHorizontal: S.xl, paddingTop: S.md }]}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ flex: 1 }}>
          <Text style={T.caption}>{g?.name}</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.6 }}>Recurring</Text>
        </View>
        <IconButton icon="add" label="New recurring expense" size={44} onPress={() => setSheet(true)} />
      </View>
      <ScrollView contentContainerStyle={{ padding: S.xl, gap: S.lg, paddingBottom: 48 }}>
        {data.recurring.length > 0 && (
          <Card style={[s.row, { gap: S.md }]}>
            <Ionicons name="repeat" size={20} color={C.primary} />
            <Text style={[T.body, { flex: 1, color: C.sub }]}>
              About <Text style={{ color: C.text, fontWeight: '700' }}>{money(monthlyTotal, cur)}</Text> a month in fixed costs
            </Text>
          </Card>
        )}
        {data.recurring.length === 0 ? (
          <Card><EmptyState emoji="🔁" title="No recurring costs yet"
            body="Add rent, subscriptions or insurance once. Budgetly logs them for you on the right day."
            action={<Button title="Add a recurring cost" icon="add" onPress={() => setSheet(true)} />} /></Card>
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {data.recurring.map((r, i) => {
              const m = catMeta(r.category);
              const canEdit = r.created_by === me || isAdmin;
              return (
                <View key={r.id}>
                  {i > 0 && <Divider />}
                  <View style={[s.row, { gap: S.md, padding: S.lg, opacity: r.active ? 1 : 0.55 }]}>
                    <IconTile icon={m.icon} color={m.color} emoji={m.emoji} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{r.title}</Text>
                      <Text style={T.caption} numberOfLines={1}>
                        {FREQ[r.frequency as Frequency]} · {r.active ? `next ${dayLabel(r.next_date).toLowerCase()}` : 'paused'}
                      </Text>
                    </View>
                    <Text style={[T.body, { fontWeight: '700', fontVariant: ['tabular-nums'] }]}>{money(Number(r.amount), cur)}</Text>
                    {canEdit && (
                      <View style={[s.row, { gap: 4 }]}>
                        <Pressable hitSlop={8} onPress={() => toggle(r)} accessibilityLabel={r.active ? `Pause ${r.title}` : `Resume ${r.title}`}
                          style={{ padding: 6 }}>
                          <Ionicons name={r.active ? 'pause-circle-outline' : 'play-circle-outline'} size={24} color={C.sub} />
                        </Pressable>
                        <Pressable hitSlop={8} onPress={() => remove(r)} accessibilityLabel={`Remove ${r.title}`} style={{ padding: 6 }}>
                          <Ionicons name="trash-outline" size={20} color={C.muted} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>
        )}
        <Text style={[T.caption, { textAlign: 'center' }]}>Due entries are added the next time anyone opens this space.</Text>
      </ScrollView>
      {g && <NewRecurring visible={sheet} onClose={() => setSheet(false)} groupId={g.id} cur={cur} me={me}
        memberIds={data.members.map((m) => m.user_id)} onSaved={() => { setSheet(false); data.reload(); }} />}
    </Screen>
  );
}

function NewRecurring({ visible, onClose, groupId, cur, me, memberIds, onSaved }: {
  visible: boolean; onClose: () => void; groupId: string; cur: string; me: string; memberIds: string[]; onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('bills');
  const [freq, setFreq] = useState<Frequency>('monthly');
  const [start, setStart] = useState(ymd(new Date()));
  const [personal, setPersonal] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) { setTitle(''); setAmount(''); setCategory('bills'); setFreq('monthly'); setStart(ymd(new Date())); setPersonal(false); setErr(null); }
  }, [visible]);

  const shift = (n: number) => { const d = parseYmd(start); d.setDate(d.getDate() + n); setStart(ymd(d)); };

  const save = async () => {
    const amt = Number(amount);
    if (!title.trim()) return setErr('Add a name, e.g. Rent');
    if (!(amt > 0)) return setErr('Enter an amount');
    const splits = personal ? [] : splitCents('equal', Math.round(amt * 100), memberIds.map((u) => ({ user_id: u, weight: 1 })))
      .map((x) => ({ user_id: x.user_id, amount: x.c / 100 }));
    setBusy(true);
    const { error } = await supabase.from('recurring_expenses').insert({
      group_id: groupId, created_by: me, paid_by: me, title: title.trim(), amount: amt, category,
      is_personal: personal, splits, frequency: freq, next_date: start,
    });
    if (!error) await supabase.rpc('run_recurring', { p_group: groupId }); // log it now if it starts today
    setBusy(false);
    if (error) return setErr(error.message);
    toast('Recurring cost added', 'success'); onSaved();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="New recurring cost" footer={<Button title="Save" loading={busy} onPress={save} />}>
      <Field label="Name" placeholder="e.g. Rent, Netflix" value={title} onChangeText={(t) => { setTitle(t); setErr(null); }} autoFocus />
      <Field label="Amount" prefix={cur} keyboardType="decimal-pad" placeholder="0.00" value={amount}
        onChangeText={(t) => { setAmount(t.replace(/[^0-9.]/g, '')); setErr(null); }} />
      <View style={{ gap: 6 }}>
        <Text style={T.label}>Repeats</Text>
        <Segmented<Frequency> value={freq} onChange={setFreq}
          options={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]} />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={T.label}>First date</Text>
        <View style={[s.row, { backgroundColor: C.surface2, borderRadius: R.md, padding: 4, borderWidth: 1, borderColor: C.border }]}>
          <IconButton icon="chevron-back" label="Earlier" tone="plain" onPress={() => shift(-1)} />
          <Text style={[T.heading, { flex: 1, textAlign: 'center' }]}>{parseYmd(start).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          <IconButton icon="chevron-forward" label="Later" tone="plain" onPress={() => shift(1)} />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={T.label}>Category</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
          {allCategories().map(([k, v]) => (
            <Press key={k} onPress={() => setCategory(k)} accessibilityLabel={v.label}
              style={[s.row, { gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill, borderWidth: 1.5,
                borderColor: category === k ? v.color : C.border, backgroundColor: category === k ? v.color + '22' : C.surface2 }]}>
              {v.emoji ? <Text>{v.emoji}</Text> : <Ionicons name={v.icon} size={14} color={category === k ? v.color : C.sub} />}
              <Text style={{ color: category === k ? C.text : C.sub, fontWeight: '600' }}>{v.label}</Text>
            </Press>
          ))}
        </View>
      </View>
      <Segmented<'shared' | 'personal'> value={personal ? 'personal' : 'shared'} onChange={(v) => setPersonal(v === 'personal')}
        options={[{ value: 'shared', label: `Split equally (${memberIds.length})` }, { value: 'personal', label: 'Just me' }]} />
      {err && <Text style={{ color: C.negative }}>{err}</Text>}
    </Sheet>
  );
}
