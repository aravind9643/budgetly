import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight, LinearTransition } from 'react-native-reanimated';
import { Bouncy, Button, Card, H1, Input, ProgressBar, Screen, Sub, s } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { Group, Invite, supabase } from '@/lib/supabase';
import { C, money } from '@/lib/theme';

type GroupRow = Group & { spent: number; members: number };
const notify = (m: string) => (Platform.OS === 'web' ? window.alert(m) : Alert.alert(m));

export default function Home() {
  const router = useRouter();
  const { session } = useAuth();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [code, setCode] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const email = session?.user.email?.toLowerCase();
  const name = (session?.user.user_metadata?.full_name as string) || email?.split('@')[0];

  const load = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid || !email) return;
    const start = new Date(); start.setDate(1);
    const monthStart = start.toISOString().slice(0, 10);
    const { data: mem } = await supabase.from('group_members').select('group_id').eq('user_id', uid);
    const ids = (mem ?? []).map((m) => m.group_id);
    const [{ data: gs }, { data: ex }, { data: allMem }, { data: inv }] = await Promise.all([
      supabase.from('groups').select('*').in('id', ids).order('created_at'),
      supabase.from('expenses').select('group_id, amount, type').in('group_id', ids).gte('spent_at', monthStart),
      supabase.from('group_members').select('group_id').in('group_id', ids),
      supabase.from('invites').select('*, groups(*)').eq('email', email).eq('status', 'pending'),
    ]);
    setGroups((gs ?? []).map((g) => ({
      ...g,
      spent: (ex ?? []).filter((e) => e.group_id === g.id && e.type === 'expense').reduce((a, e) => a + Number(e.amount), 0),
      members: (allMem ?? []).filter((m) => m.group_id === g.id).length,
    })));
    setInvites((inv ?? []) as Invite[]);
  }, [session?.user.id, email]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const join = async () => {
    if (!code.trim()) return;
    const { data, error } = await supabase.rpc('join_group_by_code', { code: code.trim() });
    if (error) return notify(error.message);
    setCode('');
    router.push(`/group/${data}`);
  };

  const respond = async (id: string, accept: boolean) => {
    const { data, error } = await supabase.rpc('respond_invite', { invite_id: id, accept });
    if (error) return notify(error.message);
    setInvites((i) => i.filter((x) => x.id !== id));
    if (accept) router.push(`/group/${data}`);
  };

  const totalSpent = groups.reduce((a, g) => a + g.spent, 0);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Animated.View entering={FadeInDown} style={[s.row, { justifyContent: 'space-between' }]}>
          <View>
            <Sub>Hey {name} 👋</Sub>
            <H1>Your groups</H1>
          </View>
          <Bouncy onPress={() => supabase.auth.signOut()} style={{ padding: 10, borderRadius: 14, backgroundColor: C.card }}>
            <Ionicons name="log-out-outline" size={22} color={C.text} />
          </Bouncy>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <LinearGradient colors={C.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 26, padding: 22 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>Spent this month · all groups</Text>
            <Text style={{ color: '#fff', fontSize: 38, fontWeight: '800', marginTop: 6 }}>{money(totalSpent, groups[0]?.currency)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{groups.length} groups</Text>
          </LinearGradient>
        </Animated.View>

        {invites.map((inv, i) => (
          <Animated.View key={inv.id} entering={FadeInRight.delay(i * 80)} layout={LinearTransition}>
            <Card style={{ borderColor: C.accent, gap: 12 }}>
              <View style={[s.row, { gap: 10 }]}>
                <Ionicons name="mail-unread" size={22} color={C.accent} />
                <Text style={{ color: C.text, flex: 1, fontWeight: '600' }}>
                  You're invited to {inv.groups?.emoji} {inv.groups?.name ?? 'a group'}
                </Text>
              </View>
              <View style={[s.row, { gap: 10 }]}>
                <View style={{ flex: 1 }}><Button title="Accept" icon="checkmark" onPress={() => respond(inv.id, true)} /></View>
                <View style={{ flex: 1 }}><Button title="Decline" variant="ghost" onPress={() => respond(inv.id, false)} /></View>
              </View>
            </Card>
          </Animated.View>
        ))}

        {groups.map((g, i) => {
          const pct = g.monthly_budget > 0 ? g.spent / g.monthly_budget : 0;
          return (
            <Animated.View key={g.id} entering={FadeInDown.delay(150 + i * 70).springify()} layout={LinearTransition}>
              <Bouncy onPress={() => router.push(`/group/${g.id}`)} style={[s.card, { gap: 12 }]}>
                <View style={[s.row, { gap: 14 }]}>
                  <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(124,92,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 26 }}>{g.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 18, fontWeight: '700' }}>{g.name}</Text>
                    <Sub>{g.members} member{g.members === 1 ? '' : 's'}</Sub>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={C.sub} />
                </View>
                <ProgressBar value={pct} />
                <View style={[s.row, { justifyContent: 'space-between' }]}>
                  <Sub>{money(g.spent, g.currency)} spent</Sub>
                  <Sub>{g.monthly_budget > 0 ? `of ${money(g.monthly_budget, g.currency)}` : 'No budget set'}</Sub>
                </View>
              </Bouncy>
            </Animated.View>
          );
        })}

        {groups.length === 0 && (
          <Card index={3} style={{ alignItems: 'center', gap: 8, paddingVertical: 32 }}>
            <Text style={{ fontSize: 44 }}>🪴</Text>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 17 }}>No groups yet</Text>
            <Sub style={{ textAlign: 'center' }}>Create a group or join one with an invite code.</Sub>
          </Card>
        )}

        <Button title="Create a group" icon="add-circle" onPress={() => router.push('/new-group')} />

        <Card index={5} style={{ gap: 12 }}>
          <Text style={{ color: C.text, fontWeight: '700' }}>Join with invite code</Text>
          <View style={[s.row, { gap: 10 }]}>
            <View style={{ flex: 1 }}>
              <Input icon="key" placeholder="e.g. 8F3A2C1D" autoCapitalize="characters" value={code} onChangeText={setCode} onSubmitEditing={join} />
            </View>
            <Bouncy onPress={join} style={{ height: 52, width: 52, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-forward" size={22} color="#0B0B1A" />
            </Bouncy>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
