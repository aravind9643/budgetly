import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { JoinSheet } from '@/components/JoinSheet';
import { ListRow, PageTitle } from '@/components/Nav';
import { Avatar, Button, Card, Divider, Loading, Press, Screen, Section, s } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useFeedback } from '@/lib/feedback';
import { HouseholdRow, useHousehold } from '@/lib/household';
import { C, S, T } from '@/lib/theme';

export default function Households() {
  const router = useRouter();
  const { session } = useAuth();
  const { toast } = useFeedback();
  const { households, invites, activeId, setActive, refreshHouseholds } = useHousehold();
  const [join, setJoin] = useState(false);
  const me = session?.user.id;

  const respond = async (id: string, accept: boolean) => {
    const { data, error } = await supabase.rpc('respond_invite', { invite_id: id, accept });
    if (error) return toast(error.message, 'error');
    await refreshHouseholds();
    if (accept) { setActive(data); toast('You joined the household', 'success'); }
  };

  if (households === null) return <Screen edges={['top']}><Loading /></Screen>;
  const active = households.find((h) => h.id === activeId);
  const others = households.filter((h) => h.id !== activeId);

  const Row = ({ h }: { h: HouseholdRow }) => (
    <Press onPress={() => router.push(`/group/${h.id}`)} scale={0.985} accessibilityLabel={h.name}
      style={[s.row, { gap: S.md, padding: S.lg }]}>
      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 26 }}>{h.emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[T.heading, { fontSize: 18 }]} numberOfLines={1}>{h.name}</Text>
        <Text style={[T.body, { color: C.sub, fontSize: 14 }]} numberOfLines={2}>
          {h.memberCount} member{h.memberCount === 1 ? '' : 's'} · {h.currency} · {h.owner_id === me ? 'Created by you' : 'Joined'}
        </Text>
      </View>
      <View style={s.row}>
        {h.memberNames.slice(0, 3).map((n, i) => (
          <View key={i} style={{ marginLeft: i ? -10 : 0 }}><Avatar name={n} size={32} /></View>
        ))}
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.sub} />
    </Press>
  );

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <PageTitle title="Households" />
        <View style={{ paddingHorizontal: S.xl, gap: S.xl }}>
          {invites.length > 0 && (
            <Section title={`Invitations · ${invites.length}`}>
              {invites.map((inv) => (
                <Card key={inv.id} style={{ gap: S.md, borderColor: C.accent }}>
                  <View style={[s.row, { gap: S.md }]}>
                    <Text style={{ fontSize: 30 }}>{inv.groups?.emoji ?? '✉️'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[T.heading, { fontSize: 18 }]}>{inv.groups?.name ?? 'A household'}</Text>
                      <Text style={[T.body, { color: C.sub, fontSize: 14 }]}>You've been invited to join</Text>
                    </View>
                  </View>
                  <View style={[s.row, { gap: S.sm }]}>
                    <Button title="Decline" variant="secondary" style={{ flex: 1 }} onPress={() => respond(inv.id, false)} />
                    <Button title="Join" style={{ flex: 1 }} onPress={() => respond(inv.id, true)} />
                  </View>
                </Card>
              ))}
            </Section>
          )}

          {active && (
            <Section title="Active household">
              <Card style={{ padding: 0, overflow: 'hidden' }}><Row h={active} /></Card>
              <Text style={[T.body, { color: C.sub, fontSize: 14, paddingHorizontal: S.xs }]}>
                Used by Home, Stats and new expenses. Switch it from Home or below.
              </Text>
            </Section>
          )}

          {others.length > 0 && (
            <Section title="Other households">
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {others.map((h, i) => (
                  <View key={h.id}>
                    {i > 0 && <Divider />}
                    <Row h={h} />
                    <Press onPress={() => { setActive(h.id); toast(`${h.name} is now active`, 'success'); }}
                      style={{ paddingHorizontal: S.lg, paddingBottom: S.md, marginTop: -S.sm }}>
                      <Text style={{ color: C.primary, fontWeight: '700' }}>Make active</Text>
                    </Press>
                  </View>
                ))}
              </Card>
            </Section>
          )}

          <Section title="Add a household">
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <ListRow icon="add" tint={C.accent} title="Create household" subtitle="For another budget: holidays, a flatshare…"
                onPress={() => router.push('/new-group')} />
              <Divider />
              <ListRow icon="mail-open-outline" tint={C.primary} title="Join with an invitation" subtitle="A code from someone"
                onPress={() => setJoin(true)} />
            </Card>
          </Section>
        </View>
      </ScrollView>
      <JoinSheet visible={join} onClose={() => setJoin(false)}
        onJoined={async (id) => { setJoin(false); await refreshHouseholds(); setActive(id); toast('You joined the household', 'success'); router.push(`/group/${id}`); }} />
    </Screen>
  );
}
