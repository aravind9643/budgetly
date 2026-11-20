import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import {
  Avatar, Badge, Button, Card, EmptyState, Field, Header, IconButton, Loading, Press, ProgressBar, Screen, Section, Sheet, s,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useFeedback } from '@/lib/feedback';
import { Group, Invite, supabase } from '@/lib/supabase';
import { C, money, monthLabel, monthRange, R, S, T } from '@/lib/theme';

type GroupRow = Group & { spent: number; members: number };

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Home() {
  const router = useRouter();
  const { session } = useAuth();
  const { toast, confirm } = useFeedback();
  const [groups, setGroups] = useState<GroupRow[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const email = session?.user.email?.toLowerCase();
  const name = (session?.user.user_metadata?.full_name as string) || email?.split('@')[0] || '';

  const load = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid || !email) return;
    const { start } = monthRange(new Date());
    const { data: mem } = await supabase.from('group_members').select('group_id').eq('user_id', uid);
    const ids = (mem ?? []).map((m) => m.group_id);
    const [{ data: gs }, { data: ex }, { data: allMem }, { data: inv }] = await Promise.all([
      supabase.from('groups').select('*').in('id', ids).order('created_at'),
      supabase.from('expenses').select('group_id, amount').in('group_id', ids).eq('type', 'expense').gte('spent_at', start),
      supabase.from('group_members').select('group_id').in('group_id', ids),
      supabase.from('invites').select('*, groups(*)').eq('email', email).eq('status', 'pending'),
    ]);
    setGroups((gs ?? []).map((g) => ({
      ...g,
      spent: (ex ?? []).filter((e) => e.group_id === g.id).reduce((a, e) => a + Number(e.amount), 0),
      members: (allMem ?? []).filter((m) => m.group_id === g.id).length,
    })));
    setInvites((inv ?? []) as Invite[]);
  }, [session?.user.id, email]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const respond = async (id: string, accept: boolean) => {
    const { data, error } = await supabase.rpc('respond_invite', { invite_id: id, accept });
    if (error) return toast(error.message, 'error');
    setInvites((i) => i.filter((x) => x.id !== id));
    if (accept) { toast('You joined the group', 'success'); router.push(`/group/${data}`); }
  };

  const signOut = async () => {
    if (await confirm({ title: 'Sign out?', message: email, confirmLabel: 'Sign out' })) supabase.auth.signOut();
  };

  // Totals per currency, because amounts in different currencies can't be added together.
  const totals = Object.entries((groups ?? []).reduce<Record<string, { spent: number; budget: number }>>((acc, g) => {
    const t = (acc[g.currency] ??= { spent: 0, budget: 0 });
    t.spent += g.spent; t.budget += Number(g.monthly_budget) || 0;
    return acc;
  }, {}));
  const overCount = (groups ?? []).filter((g) => g.monthly_budget > 0 && g.spent > g.monthly_budget).length;

  return (
    <Screen>
      <Header subtitle={`${greeting()}${name ? `, ${name}` : ''}`} title="Budgetly"
        right={<Press onPress={signOut} accessibilityLabel="Account"><Avatar name={name || '?'} size={40} /></Press>} />

      {groups === null ? <Loading /> : (
        <ScrollView contentContainerStyle={{ padding: S.xl, paddingTop: S.sm, gap: S.xl, paddingBottom: 48 }}
          refreshControl={<RefreshControl tintColor={C.sub} refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>

          {groups.length > 0 && (
            <Animated.View entering={FadeInDown.duration(400)}>
              <LinearGradient colors={C.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: R.lg, padding: S.xl, gap: S.md }}>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>Spent in {monthLabel(new Date())}</Text>
                {totals.map(([cur, t], i) => (
                  <View key={cur} style={{ gap: 8 }}>
                    <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-end' }]}>
                      <Text style={{ color: '#fff', fontSize: i === 0 ? 36 : 24, fontWeight: '800', letterSpacing: -1 }}>{money(t.spent, cur)}</Text>
                      {t.budget > 0 && <Text style={{ color: 'rgba(255,255,255,0.8)' }}>of {money(t.budget, cur, true)}</Text>}
                    </View>
                    {t.budget > 0 && <ProgressBar value={t.spent / t.budget} color="#fff" track="rgba(255,255,255,0.2)" height={6} />}
                  </View>
                ))}
                <View style={[s.row, { gap: S.sm }]}>
                  <Ionicons name={overCount ? 'warning' : 'checkmark-circle'} size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    {overCount ? `${overCount} group${overCount > 1 ? 's' : ''} over budget` : 'All groups within budget'}
                  </Text>
                </View>
              </LinearGradient>
            </Animated.View>
          )}

          {invites.length > 0 && (
            <Section title={`Invitations · ${invites.length}`}>
              {invites.map((inv) => (
                <Animated.View key={inv.id} layout={LinearTransition}>
                  <Card style={{ gap: S.md, borderColor: C.primary }}>
                    <View style={[s.row, { gap: S.md }]}>
                      <Text style={{ fontSize: 28 }}>{inv.groups?.emoji ?? '✉️'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={T.heading}>{inv.groups?.name ?? 'A group'}</Text>
                        <Text style={T.caption}>You've been invited to join</Text>
                      </View>
                    </View>
                    <View style={[s.row, { gap: S.sm }]}>
                      <Button title="Decline" variant="secondary" onPress={() => respond(inv.id, false)} style={{ flex: 1 }} />
                      <Button title="Join" onPress={() => respond(inv.id, true)} style={{ flex: 1 }} />
                    </View>
                  </Card>
                </Animated.View>
              ))}
            </Section>
          )}

          <Section title="Your groups" action={groups.length > 0 && (
            <Press onPress={() => setJoinOpen(true)}><Text style={{ color: C.primary, fontWeight: '700' }}>Join with code</Text></Press>
          )}>
            {groups.length === 0 ? (
              <Card>
                <EmptyState emoji="🪴" title="Start your first budget"
                  body="Create a group for your household, trip or roommates, or join one with an invite code."
                  action={
                    <View style={{ gap: S.sm }}>
                      <Button title="Create a group" icon="add" onPress={() => router.push('/new-group')} />
                      <Button title="Join with code" variant="secondary" icon="key-outline" onPress={() => setJoinOpen(true)} />
                    </View>
                  } />
              </Card>
            ) : (
              <>
                {groups.map((g, i) => <GroupCard key={g.id} g={g} index={i} onPress={() => router.push(`/group/${g.id}`)} />)}
                <Press onPress={() => router.push('/new-group')} accessibilityLabel="Create a group"
                  style={[s.row, { gap: S.sm, justifyContent: 'center', padding: S.lg, borderRadius: R.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: C.borderStrong }]}>
                  <Ionicons name="add" size={20} color={C.sub} />
                  <Text style={{ color: C.sub, fontWeight: '700' }}>New group</Text>
                </Press>
              </>
            )}
          </Section>
        </ScrollView>
      )}

      <JoinSheet visible={joinOpen} onClose={() => setJoinOpen(false)}
        onJoined={(id) => { setJoinOpen(false); toast('You joined the group', 'success'); router.push(`/group/${id}`); }} />
    </Screen>
  );
}

function GroupCard({ g, index, onPress }: { g: GroupRow; index: number; onPress: () => void }) {
  const budget = Number(g.monthly_budget);
  const pct = budget > 0 ? g.spent / budget : 0;
  const status = budget <= 0 ? null : pct > 1 ? <Badge label="Over" tone="negative" /> : pct > 0.85 ? <Badge label="Near limit" tone="warn" /> : null;
  return (
    <Animated.View entering={FadeInDown.delay(60 + index * 50).duration(350)} layout={LinearTransition}>
      <Card onPress={onPress} style={{ gap: S.md }}>
        <View style={[s.row, { gap: S.md }]}>
          <View style={{ width: 46, height: 46, borderRadius: R.md, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24 }}>{g.emoji}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={[s.row, { gap: S.sm }]}>
              <Text style={[T.heading, { flexShrink: 1 }]} numberOfLines={1}>{g.name}</Text>
              {status}
            </View>
            <Text style={T.caption}>{g.members} member{g.members === 1 ? '' : 's'} · {g.currency}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[T.heading, { fontVariant: ['tabular-nums'] }]}>{money(g.spent, g.currency)}</Text>
            <Text style={T.caption}>{budget > 0 ? `of ${money(budget, g.currency, true)}` : 'this month'}</Text>
          </View>
        </View>
        {budget > 0 && <ProgressBar value={pct} height={6} />}
      </Card>
    </Animated.View>
  );
}

function JoinSheet({ visible, onClose, onJoined }: { visible: boolean; onClose: () => void; onJoined: (id: string) => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const join = async () => {
    if (code.trim().length < 4) return setErr('Enter the code you were sent');
    setBusy(true);
    const { data, error } = await supabase.rpc('join_group_by_code', { code: code.trim() });
    setBusy(false);
    if (error) return setErr(error.message);
    setCode(''); setErr(null); onJoined(data);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Join a group"
      footer={<Button title="Join group" loading={busy} onPress={join} />}>
      <Text style={[T.body, { color: C.sub }]}>Ask a group member for their 8-character invite code.</Text>
      <Field placeholder="8F3A2C1D" autoCapitalize="characters" autoCorrect={false} autoFocus maxLength={12}
        value={code} onChangeText={(t) => { setCode(t.toUpperCase()); setErr(null); }} onSubmitEditing={join}
        error={err} icon="key-outline" style={{ letterSpacing: 2 } as any} />
    </Sheet>
  );
}
