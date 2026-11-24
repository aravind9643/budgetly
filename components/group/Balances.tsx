import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Typography';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Avatar, Badge, Button, Card, Divider, EmptyState, Field, Section, Sheet, s } from '@/components/ui';
import { Transfer } from '@/lib/balances';
import { useFeedback } from '@/lib/feedback';
import { Settlement, supabase } from '@/lib/supabase';
import { C, dayLabel, money, R, S, T } from '@/lib/theme';

export function Balances({ groupId, me, cur, net, transfers, settlements, nameOf, isFormer, reload, isOwner = false }: {
  groupId: string; me: string; cur: string; net: Record<string, number>; transfers: Transfer[];
  settlements: Settlement[]; nameOf: (u: string) => string; isFormer: (u: string) => boolean; reload: () => void; isOwner?: boolean;
}) {
  const { toast, confirm } = useFeedback();
  const [settle, setSettle] = useState<Transfer | null>(null);
  const mine = net[me] ?? 0;
  const people = Object.entries(net).filter(([u, v]) => !isFormer(u) || Math.abs(v) >= 0.005).sort((a, b) => b[1] - a[1]);

  // Owner-only reset, e.g. when old entries predate splits and the history doesn't reflect reality.
  const startFresh = async () => {
    const ok = await confirm({
      title: 'Start balances fresh?', confirmLabel: 'Reset to zero', destructive: true,
      message: `Records ${transfers.length} payment${transfers.length === 1 ? '' : 's'} as settled so everyone is even. Entries are kept; only balances reset.`,
    });
    if (!ok) return;
    const { error } = await supabase.rpc('reset_balances', { p_group: groupId, p_transfers: transfers as any });
    if (error) return toast(error.message, 'error');
    toast('Balances reset. Everyone is even', 'success'); reload();
  };

  const undo = async (st: Settlement) => {
    if (!(await confirm({ title: 'Undo repayment?', message: `${money(Number(st.amount), cur)} from ${nameOf(st.from_user)} to ${nameOf(st.to_user)}`, confirmLabel: 'Undo', destructive: true }))) return;
    const { error } = await supabase.from('settlements').delete().eq('id', st.id);
    if (error) return toast(error.message, 'error');
    toast('Repayment removed'); reload();
  };

  return (
    <View style={{ gap: S.xl }}>
      {/* Your position */}
      <Card style={[s.row, { gap: S.md, borderColor: Math.abs(mine) < 0.005 ? C.border : mine > 0 ? C.positive : C.negative }]}>
        <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
          backgroundColor: Math.abs(mine) < 0.005 ? C.surface2 : mine > 0 ? C.positiveSoft : C.negativeSoft }}>
          <Ionicons name={Math.abs(mine) < 0.005 ? 'checkmark-done' : mine > 0 ? 'arrow-down' : 'arrow-up'} size={22}
            color={Math.abs(mine) < 0.005 ? C.sub : mine > 0 ? C.positive : C.negative} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={T.label}>{Math.abs(mine) < 0.005 ? 'Your balance' : mine > 0 ? 'Owed to you' : 'You need to settle'}</Text>
          <Text style={[T.title, { fontVariant: ['tabular-nums'], color: Math.abs(mine) < 0.005 ? C.text : mine > 0 ? C.positive : C.negative }]}>
            {Math.abs(mine) < 0.005 ? 'Even' : money(Math.abs(mine), cur)}
          </Text>
        </View>
      </Card>

      <Section title="Suggested payments">
        {transfers.length === 0 ? (
          <Card><EmptyState emoji="🤝" title="All even" body="Nobody needs to pay anyone right now." /></Card>
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {transfers.map((t, i) => {
              const involved = t.from === me || t.to === me;
              return (
                <Animated.View key={`${t.from}-${t.to}`} layout={LinearTransition}>
                  {i > 0 && <Divider />}
                  <View style={[s.row, { gap: S.md, padding: S.lg }]}>
                    <View style={[s.row, { gap: -8 }]}>
                      <Avatar name={nameOf(t.from)} size={32} />
                      <View style={{ marginLeft: -8 }}><Avatar name={nameOf(t.to)} size={32} /></View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={T.body} numberOfLines={2}>
                        <Text style={{ fontWeight: '700' }}>{nameOf(t.from)}</Text>
                        <Text style={{ color: C.sub }}>{' → '}</Text>
                        <Text style={{ fontWeight: '700' }}>{nameOf(t.to)}</Text>
                      </Text>
                      <Text style={[T.heading, { color: t.to === me ? C.positive : t.from === me ? C.negative : C.text, fontVariant: ['tabular-nums'] }]}>
                        {money(t.amount, cur)}
                      </Text>
                    </View>
                    {involved && (
                      <Button title={t.from === me ? 'Settle' : 'Received'} variant="secondary" onPress={() => setSettle(t)}
                        style={{ height: 38, paddingHorizontal: S.md }} />
                    )}
                  </View>
                </Animated.View>
              );
            })}
          </Card>
        )}
        <Text style={[T.caption, { paddingHorizontal: S.xs }]}>The fewest payments that make everyone even. Only the payer or the receiver can record one.</Text>
      </Section>

      <Section title="Per person">
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {people.map(([u, v], i) => (
            <View key={u}>
              {i > 0 && <Divider />}
              <View style={[s.row, { gap: S.md, padding: S.lg }]}>
                <Avatar name={nameOf(u)} size={32} />
                <Text style={[T.body, { flex: 1 }]} numberOfLines={1}>{nameOf(u)}</Text>
                {isFormer(u) && <Badge label="Former" />}
                <Text style={[T.body, { fontWeight: '700', fontVariant: ['tabular-nums'], color: Math.abs(v) < 0.005 ? C.sub : v > 0 ? C.positive : C.negative }]}>
                  {Math.abs(v) < 0.005 ? 'Even' : `${v > 0 ? '+' : '−'}${money(Math.abs(v), cur)}`}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      </Section>

      {settlements.length > 0 && (
        <Section title="Payment history">
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {settlements.map((st, i) => (
              <Animated.View key={st.id} entering={FadeIn}>
                {i > 0 && <Divider />}
                <View style={[s.row, { gap: S.md, padding: S.lg }]}>
                  <View style={{ width: 36, height: 36, borderRadius: R.sm, backgroundColor: C.positiveSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="swap-horizontal" size={18} color={C.positive} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{nameOf(st.from_user)} → {nameOf(st.to_user)}</Text>
                    <Text style={T.caption} numberOfLines={1}>{dayLabel(st.settled_at)}{st.note ? ` · ${st.note}` : ''}</Text>
                  </View>
                  <Text style={[T.body, { fontWeight: '700', fontVariant: ['tabular-nums'] }]}>{money(Number(st.amount), cur)}</Text>
                  {st.created_by === me && (
                    <Pressable hitSlop={10} onPress={() => undo(st)} accessibilityLabel="Undo repayment">
                      <Ionicons name="arrow-undo-outline" size={18} color={C.muted} />
                    </Pressable>
                  )}
                </View>
              </Animated.View>
            ))}
          </Card>
        </Section>
      )}

      {isOwner && transfers.length > 0 && (
        <View style={{ gap: S.sm }}>
          <Button title="Start fresh" icon="refresh" variant="secondary" onPress={startFresh} />
          <Text style={[T.caption, { textAlign: 'center' }]}>
            Marks every suggested payment as settled so all balances return to zero. History stays.
          </Text>
        </View>
      )}

      <SettleSheet transfer={settle} me={me} cur={cur} groupId={groupId} nameOf={nameOf}
        onClose={() => setSettle(null)} onSaved={() => { setSettle(null); reload(); }} />
    </View>
  );
}

function SettleSheet({ transfer, me, cur, groupId, nameOf, onClose, onSaved }: {
  transfer: Transfer | null; me: string; cur: string; groupId: string; nameOf: (u: string) => string;
  onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (transfer) { setAmount(transfer.amount.toFixed(2)); setNote(''); setErr(null); }
  }, [transfer]);

  if (!transfer) return null;
  const paying = transfer.from === me;

  const save = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) return setErr('Enter an amount');
    if (amt > transfer.amount + 0.005) return setErr(`That's more than the ${money(transfer.amount, cur)} owed`);
    setBusy(true);
    const { error } = await supabase.from('settlements').insert({
      group_id: groupId, from_user: transfer.from, to_user: transfer.to, amount: amt, note: note.trim() || null, created_by: me,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    toast(amt < transfer.amount ? 'Partial repayment recorded' : 'Settled up', 'success');
    onSaved();
  };

  return (
    <Sheet visible={!!transfer} onClose={onClose} title={paying ? 'Record repayment' : 'Mark as received'}
      footer={<Button title={paying ? `Mark ${money(Number(amount) || 0, cur)} as repaid` : `Mark ${money(Number(amount) || 0, cur)} as received`} loading={busy} onPress={save} />}>
      <View style={[s.row, { gap: S.md, justifyContent: 'center', paddingVertical: S.sm }]}>
        <View style={{ alignItems: 'center', gap: 4 }}><Avatar name={nameOf(transfer.from)} size={44} /><Text style={T.caption}>{nameOf(transfer.from)}</Text></View>
        <Ionicons name="arrow-forward" size={22} color={C.muted} />
        <View style={{ alignItems: 'center', gap: 4 }}><Avatar name={nameOf(transfer.to)} size={44} /><Text style={T.caption}>{nameOf(transfer.to)}</Text></View>
      </View>
      <Field label={`Amount (owed: ${money(transfer.amount, cur)})`} prefix={cur} keyboardType="decimal-pad" value={amount}
        onChangeText={(t) => { setAmount(t.replace(/[^0-9.]/g, '')); setErr(null); }} error={err} />
      <Field label="Note (optional)" placeholder="e.g. Bank transfer" value={note} onChangeText={setNote} maxLength={80} />
      <Text style={T.caption}>This only records the repayment. Send the money however you normally do.</Text>
    </Sheet>
  );
}
