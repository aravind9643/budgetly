import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import Animated, {
  FadeIn, FadeInDown, FadeOut, LinearTransition, SlideInDown, SlideOutDown, ZoomIn,
} from 'react-native-reanimated';
import { Bouncy, Button, Card, Chip, Input, ProgressBar, Screen, Sub, s } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { Expense, Group, Invite, Member, supabase } from '@/lib/supabase';
import { C, CATEGORIES, money } from '@/lib/theme';

type Tab = 'overview' | 'activity' | 'members';
const notify = (m: string) => (Platform.OS === 'web' ? window.alert(m) : Alert.alert(m));
const confirm = (m: string, ok: () => void) =>
  Platform.OS === 'web' ? (window.confirm(m) && ok())
    : Alert.alert('Are you sure?', m, [{ text: 'Cancel', style: 'cancel' }, { text: 'Yes', style: 'destructive', onPress: ok }]);

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [sheet, setSheet] = useState(false);
  const [budgetEdit, setBudgetEdit] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [g, e, m, i] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).single(),
      supabase.from('expenses').select('*').eq('group_id', id).order('spent_at', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('group_members').select('user_id, role, profiles(full_name, email)').eq('group_id', id),
      supabase.from('invites').select('*').eq('group_id', id).eq('status', 'pending'),
    ]);
    setGroup(g.data);
    setExpenses(e.data ?? []);
    setMembers((m.data ?? []) as any);
    setInvites(i.data ?? []);
  }, [id]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`group-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  const nameOf = (uid: string) => {
    const p = members.find((m) => m.user_id === uid)?.profiles;
    return uid === me ? 'You' : p?.full_name || p?.email?.split('@')[0] || 'Member';
  };

  const stats = useMemo(() => {
    const start = new Date(); start.setDate(1);
    const ms = start.toISOString().slice(0, 10);
    const month = expenses.filter((e) => e.spent_at >= ms);
    const spent = month.filter((e) => e.type === 'expense').reduce((a, e) => a + Number(e.amount), 0);
    const income = month.filter((e) => e.type === 'income').reduce((a, e) => a + Number(e.amount), 0);
    const byCat: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    month.filter((e) => e.type === 'expense').forEach((e) => {
      byCat[e.category] = (byCat[e.category] ?? 0) + Number(e.amount);
      byUser[e.user_id] = (byUser[e.user_id] ?? 0) + Number(e.amount);
    });
    return { spent, income, byCat, byUser };
  }, [expenses]);

  if (!group) return <Screen><View style={{ flex: 1 }} /></Screen>;
  const cur = group.currency;
  const myRole = members.find((m) => m.user_id === me)?.role;
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const budget = Number(group.monthly_budget);
  const left = budget - stats.spent;

  const saveBudget = async () => {
    const { error } = await supabase.from('groups').update({ monthly_budget: Number(budgetEdit) || 0 }).eq('id', id);
    if (error) return notify(error.message);
    setBudgetEdit(null); load();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 120 }}>
        <View style={[s.row, { gap: 12 }]}>
          <Bouncy onPress={() => router.back()} style={{ padding: 8, borderRadius: 12, backgroundColor: C.card }}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </Bouncy>
          <Text style={{ fontSize: 28 }}>{group.emoji}</Text>
          <Text style={{ color: C.text, fontSize: 24, fontWeight: '800', flex: 1 }} numberOfLines={1}>{group.name}</Text>
        </View>

        <Animated.View entering={FadeInDown.springify()}>
          <LinearGradient colors={left < 0 ? ['#FF5C8A', '#B8264F'] : C.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 26, padding: 22, gap: 6 }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>
              {budget > 0 ? (left >= 0 ? 'Left to spend this month' : 'Over budget by') : 'Spent this month'}
            </Text>
            <Animated.Text key={String(left)} entering={ZoomIn.springify()} style={{ color: '#fff', fontSize: 40, fontWeight: '800' }}>
              {money(budget > 0 ? Math.abs(left) : stats.spent, cur)}
            </Animated.Text>
            {budget > 0 && <ProgressBar value={stats.spent / budget} color="#ffffff" />}
            <View style={[s.row, { justifyContent: 'space-between', marginTop: 6 }]}>
              <Text style={{ color: '#fff' }}>↓ {money(stats.spent, cur)}</Text>
              <Text style={{ color: '#fff' }}>↑ {money(stats.income, cur)}</Text>
              <Pressable onPress={() => isAdmin && setBudgetEdit(String(budget || ''))}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  Budget {budget > 0 ? money(budget, cur) : '—'} {isAdmin ? '✎' : ''}
                </Text>
              </Pressable>
            </View>
          </LinearGradient>
        </Animated.View>

        {budgetEdit !== null && (
          <Animated.View entering={FadeInDown} exiting={FadeOut} style={[s.row, { gap: 10 }]}>
            <View style={{ flex: 1 }}><Input icon="cash" keyboardType="decimal-pad" placeholder="Monthly budget" value={budgetEdit} onChangeText={setBudgetEdit} autoFocus /></View>
            <Bouncy onPress={saveBudget} style={{ height: 52, width: 52, borderRadius: 14, backgroundColor: C.success, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={24} color="#0B0B1A" />
            </Bouncy>
          </Animated.View>
        )}

        <View style={[s.row, { gap: 8, backgroundColor: C.card, padding: 5, borderRadius: 16 }]}>
          {(['overview', 'activity', 'members'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1 }}>
              <View style={{ paddingVertical: 10, borderRadius: 12, alignItems: 'center', overflow: 'hidden' }}>
                {tab === t && (
                  <Animated.View entering={FadeIn.duration(250)} style={{ position: 'absolute', inset: 0, top: 0, left: 0, right: 0, bottom: 0 }}>
                    <LinearGradient colors={C.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                  </Animated.View>
                )}
                <Text style={{ color: tab === t ? '#fff' : C.sub, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {tab === 'overview' && <Overview stats={stats} cur={cur} nameOf={nameOf} />}
        {tab === 'activity' && <Activity expenses={expenses} cur={cur} me={me} nameOf={nameOf} reload={load} />}
        {tab === 'members' && (
          <Members group={group} members={members} invites={invites} me={me} isAdmin={isAdmin} reload={load}
            onLeft={() => router.replace('/')} />
        )}
      </ScrollView>

      <Animated.View entering={ZoomIn.delay(300).springify()} style={{ position: 'absolute', right: 24, bottom: 32 }}>
        <Bouncy onPress={() => setSheet(true)}>
          <LinearGradient colors={C.grad} style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', shadowColor: C.primary, shadowOpacity: 0.6, shadowRadius: 16, elevation: 10 }}>
            <Ionicons name="add" size={32} color="#fff" />
          </LinearGradient>
        </Bouncy>
      </Animated.View>

      <AddSheet visible={sheet} onClose={() => setSheet(false)} groupId={id!} me={me} cur={cur} onSaved={load} />
    </Screen>
  );
}

function Overview({ stats, cur, nameOf }: { stats: any; cur: string; nameOf: (u: string) => string }) {
  const cats = Object.entries(stats.byCat as Record<string, number>).sort((a, b) => b[1] - a[1]);
  const users = Object.entries(stats.byUser as Record<string, number>).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...cats.map((c) => c[1]));
  const umax = Math.max(1, ...users.map((c) => c[1]));
  if (!cats.length) return (
    <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 32 }}>
      <Text style={{ fontSize: 40 }}>📊</Text>
      <Sub>No spending this month yet. Tap + to add one.</Sub>
    </Card>
  );
  return (
    <>
      <Card index={0} style={{ gap: 14 }}>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>By category</Text>
        {cats.map(([c, v]) => {
          const meta = CATEGORIES[c] ?? CATEGORIES.other;
          return (
            <View key={c} style={{ gap: 6 }}>
              <View style={[s.row, { gap: 8 }]}>
                <Ionicons name={meta.icon} size={16} color={meta.color} />
                <Text style={{ color: C.text, flex: 1, textTransform: 'capitalize' }}>{c}</Text>
                <Text style={{ color: C.text, fontWeight: '700' }}>{money(v, cur)}</Text>
              </View>
              <ProgressBar value={v / max} color={meta.color} />
            </View>
          );
        })}
      </Card>
      <Card index={1} style={{ gap: 14 }}>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>Who spent</Text>
        {users.map(([u, v]) => (
          <View key={u} style={{ gap: 6 }}>
            <View style={[s.row, { gap: 10 }]}>
              <Avatar name={nameOf(u)} />
              <Text style={{ color: C.text, flex: 1 }}>{nameOf(u)}</Text>
              <Text style={{ color: C.text, fontWeight: '700' }}>{money(v, cur)}</Text>
            </View>
            <ProgressBar value={v / umax} color={C.accent} />
          </View>
        ))}
      </Card>
    </>
  );
}

function Activity({ expenses, cur, me, nameOf, reload }: any) {
  if (!expenses.length) return <Card><Sub style={{ textAlign: 'center' }}>No transactions yet.</Sub></Card>;
  return expenses.map((e: Expense, i: number) => {
    const meta = CATEGORIES[e.category] ?? CATEGORIES.other;
    const inc = e.type === 'income';
    return (
      <Animated.View key={e.id} entering={FadeInDown.delay(Math.min(i, 10) * 50).springify()} exiting={FadeOut} layout={LinearTransition}>
        <View style={[s.card, s.row, { gap: 14, padding: 14 }]}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: meta.color + '30', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={meta.icon} size={22} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: '600' }}>{e.title}</Text>
            <Sub>{nameOf(e.user_id)} · {new Date(e.spent_at + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Sub>
          </View>
          <Text style={{ color: inc ? C.success : C.text, fontWeight: '800' }}>{inc ? '+' : '-'}{money(Number(e.amount), cur)}</Text>
          {e.user_id === me && (
            <Pressable hitSlop={10} onPress={() => confirm('Delete this transaction?', async () => {
              await supabase.from('expenses').delete().eq('id', e.id); reload();
            })}>
              <Ionicons name="trash-outline" size={18} color={C.sub} />
            </Pressable>
          )}
        </View>
      </Animated.View>
    );
  });
}

function Members({ group, members, invites, me, isAdmin, reload, onLeft }: {
  group: Group; members: Member[]; invites: Invite[]; me: string; isAdmin: boolean; reload: () => void; onLeft: () => void;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const invite = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return notify('Enter a valid email');
    if (members.some((m) => m.profiles?.email === e)) return notify('Already a member');
    setBusy(true);
    const { error } = await supabase.from('invites').upsert({ group_id: group.id, email: e, invited_by: me, status: 'pending' }, { onConflict: 'group_id,email' });
    setBusy(false);
    if (error) return notify(error.message);
    setEmail(''); reload();
    shareCode(`I invited ${e} — `);
  };

  const shareCode = (prefix = '') => {
    const msg = `${prefix}Join "${group.name}" on Budgetly with invite code: ${group.invite_code}`;
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(group.invite_code);
      if (!prefix) window.alert('Invite code copied to clipboard!');
    } else Share.share({ message: msg });
  };

  return (
    <>
      <Card index={0} style={{ gap: 12 }}>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>Invite people</Text>
        <Bouncy onPress={() => shareCode()} style={[s.row, { justifyContent: 'space-between', padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: C.accent }]}>
          <View>
            <Sub>Invite code</Sub>
            <Text style={{ color: C.accent, fontSize: 22, fontWeight: '800', letterSpacing: 3 }}>{group.invite_code}</Text>
          </View>
          <Ionicons name={Platform.OS === 'web' ? 'copy' : 'share-social'} size={22} color={C.accent} />
        </Bouncy>
        <Input icon="mail" placeholder="friend@email.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} onSubmitEditing={invite} />
        <Button title="Send invite" icon="paper-plane" loading={busy} onPress={invite} />
        <Sub>Invited users see the invite on their home screen after signing up with that email.</Sub>
      </Card>

      <Card index={1} style={{ gap: 12 }}>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>Members · {members.length}</Text>
        {members.map((m) => {
          const nm = m.profiles?.full_name || m.profiles?.email || 'Member';
          return (
            <Animated.View key={m.user_id} layout={LinearTransition} style={[s.row, { gap: 12 }]}>
              <Avatar name={nm} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '600' }}>{nm}{m.user_id === me ? ' (you)' : ''}</Text>
                <Sub>{m.profiles?.email}</Sub>
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: m.role === 'owner' ? 'rgba(255,181,71,0.2)' : C.card }}>
                <Text style={{ color: m.role === 'owner' ? C.warn : C.sub, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{m.role}</Text>
              </View>
              {group.owner_id === me && m.user_id !== me && (
                <Pressable hitSlop={10} onPress={() => confirm(`Remove ${nm}?`, async () => {
                  await supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', m.user_id); reload();
                })}>
                  <Ionicons name="remove-circle-outline" size={20} color={C.danger} />
                </Pressable>
              )}
            </Animated.View>
          );
        })}
        {invites.map((i) => (
          <Animated.View key={i.id} entering={FadeInDown} exiting={FadeOut} style={[s.row, { gap: 12, opacity: 0.75 }]}>
            <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderStyle: 'dashed', borderColor: C.sub, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="hourglass-outline" size={16} color={C.sub} />
            </View>
            <Text style={{ color: C.sub, flex: 1 }}>{i.email}</Text>
            <Text style={{ color: C.sub, fontSize: 12 }}>pending</Text>
            {isAdmin && (
              <Pressable hitSlop={10} onPress={async () => { await supabase.from('invites').delete().eq('id', i.id); reload(); }}>
                <Ionicons name="close" size={18} color={C.sub} />
              </Pressable>
            )}
          </Animated.View>
        ))}
      </Card>

      {group.owner_id === me ? (
        <Button title="Delete group" icon="trash" variant="danger" onPress={() => confirm('Delete this group and all its data?', async () => {
          const { error } = await supabase.from('groups').delete().eq('id', group.id);
          error ? notify(error.message) : onLeft();
        })} />
      ) : (
        <Button title="Leave group" icon="exit" variant="danger" onPress={() => confirm('Leave this group?', async () => {
          await supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', me); onLeft();
        })} />
      )}
    </>
  );
}

function Avatar({ name }: { name: string }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `hsl(${hue},70%,60%)`, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#0B0B1A', fontWeight: '800' }}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

function AddSheet({ visible, onClose, groupId, me, cur, onSaved }: {
  visible: boolean; onClose: () => void; groupId: string; me: string; cur: string; onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const amt = Number(amount);
    if (!title.trim() || !(amt > 0)) return notify('Add a title and a positive amount');
    setBusy(true);
    const { error } = await supabase.from('expenses').insert({ group_id: groupId, user_id: me, title: title.trim(), amount: amt, category, type });
    setBusy(false);
    if (error) return notify(error.message);
    setTitle(''); setAmount(''); onSaved(); onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {visible && (
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View entering={FadeIn} exiting={FadeOut} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <Pressable style={{ flex: 1 }} onPress={onClose} />
          </Animated.View>
          <Animated.View entering={SlideInDown.springify().damping(18)} exiting={SlideOutDown}
            style={{ backgroundColor: '#15142B', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, gap: 14, borderWidth: 1, borderColor: C.cardBorder, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.cardBorder, alignSelf: 'center' }} />
            <View style={[s.row, { gap: 8, backgroundColor: C.card, padding: 5, borderRadius: 14 }]}>
              {(['expense', 'income'] as const).map((t) => (
                <Pressable key={t} onPress={() => setType(t)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                  backgroundColor: type === t ? (t === 'expense' ? C.danger : C.success) : 'transparent' }}>
                  <Text style={{ color: type === t ? '#0B0B1A' : C.sub, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <Input icon="create" placeholder="What was it?" value={title} onChangeText={setTitle} />
            <Input icon="cash" placeholder={`Amount (${cur})`} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <Chip key={k} label={k} icon={v.icon} color={v.color} active={category === k} onPress={() => setCategory(k)} />
              ))}
            </ScrollView>
            <Button title={`Add ${type}`} icon="checkmark-circle" loading={busy} onPress={save} />
            <View style={{ height: 12 }} />
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}
