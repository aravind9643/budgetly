import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { JoinSheet } from '@/components/JoinSheet';
import { BackButton, ListRow } from '@/components/Nav';
import { Avatar, Button, Card, Divider, Field, Press, Screen, Section, Segmented, Sheet, s } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useFeedback } from '@/lib/feedback';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { C, R, S, T } from '@/lib/theme';
import { ThemePref, useThemeMode } from '@/lib/themeMode';

/** Account, appearance and the user's spaces, all in one place behind the avatar. */
export default function Settings() {
  const router = useRouter();
  const { session } = useAuth();
  const { toast, confirm } = useFeedback();
  const { households, invites, activeId, setActive, refreshHouseholds, data } = useHousehold();
  const { pref, scheme, setPref } = useThemeMode();
  const [edit, setEdit] = useState(false);
  const [join, setJoin] = useState(false);
  const email = session?.user.email ?? '';
  const name = (session?.user.user_metadata?.full_name as string) || email.split('@')[0];

  const respond = async (id: string, accept: boolean) => {
    const { data: gid, error } = await supabase.rpc('respond_invite', { invite_id: id, accept });
    if (error) return toast(error.message, 'error');
    await refreshHouseholds();
    if (accept) { setActive(gid); toast('Joined. It is now your current space', 'success'); }
  };

  return (
    <Screen>
      <View style={[s.row, { gap: S.md, paddingHorizontal: S.xl, paddingTop: S.md, paddingBottom: S.sm }]}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.6 }}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.xl, paddingBottom: 48, gap: S.xl, paddingTop: S.md }}>
        <Press onPress={() => setEdit(true)} accessibilityLabel="Edit your name"
          style={[s.card, s.row, { gap: S.lg, padding: S.lg }]}>
          <Avatar name={name} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={[T.heading, { fontSize: 19 }]} numberOfLines={1}>{name}</Text>
            <Text style={[T.body, { color: C.sub, fontSize: 14 }]} numberOfLines={1}>{email}</Text>
          </View>
          <Text style={{ color: C.primary, fontWeight: '700' }}>Edit</Text>
        </Press>

        {invites.length > 0 && (
          <Section title="Waiting for you">
            {invites.map((inv) => (
              <Card key={inv.id} style={{ gap: S.md }}>
                <Text style={T.body}>
                  You're invited to <Text style={{ fontWeight: '700' }}>{inv.groups?.emoji} {inv.groups?.name ?? 'a space'}</Text>
                </Text>
                <View style={[s.row, { gap: S.sm }]}>
                  <Button title="Not now" variant="secondary" style={{ flex: 1 }} onPress={() => respond(inv.id, false)} />
                  <Button title="Join space" style={{ flex: 1 }} onPress={() => respond(inv.id, true)} />
                </View>
              </Card>
            ))}
          </Section>
        )}

        <Section title="Your spaces">
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {(households ?? []).map((h, i) => (
              <View key={h.id}>
                {i > 0 && <Divider />}
                <Press onPress={() => router.push(`/group/${h.id}`)} scale={0.985} accessibilityLabel={`${h.name} settings`}
                  style={[s.row, { gap: S.md, padding: S.lg }]}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20 }}>{h.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={T.heading} numberOfLines={1}>{h.name}</Text>
                    <Text style={T.caption}>{h.memberCount} {h.memberCount === 1 ? 'person' : 'people'} · {h.currency}</Text>
                  </View>
                  {h.id === activeId
                    ? <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, backgroundColor: C.primarySoft }}>
                        <Text style={{ color: C.primary, fontWeight: '700', fontSize: 12 }}>Current</Text>
                      </View>
                    : <Press onPress={() => { setActive(h.id); toast(`Switched to ${h.name}`, 'success'); }} accessibilityLabel={`Switch to ${h.name}`}>
                        <Text style={{ color: C.primary, fontWeight: '700', fontSize: 13 }}>Switch</Text>
                      </Press>}
                  <Ionicons name="chevron-forward" size={16} color={C.muted} />
                </Press>
              </View>
            ))}
            {(households ?? []).length > 0 && <Divider />}
            <ListRow icon="add" tint={C.primary} title="New space" subtitle="A separate budget for a trip, a flat, a project"
              onPress={() => router.push('/new-group')} />
            <Divider />
            <ListRow icon="key-outline" tint={C.primary} title="Have a code?" subtitle="Join someone else's space" onPress={() => setJoin(true)} />
          </Card>
        </Section>

        <Section title="Appearance">
          <Card style={{ gap: S.md }}>
            <Segmented<ThemePref> value={pref} onChange={setPref}
              options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
            <Text style={T.caption}>{pref === 'system' ? `Matches your device (now ${scheme}).` : `Always ${pref}.`}</Text>
          </Card>
        </Section>

        <Section title="Privacy">
          <Card style={[s.row, { gap: S.md }]}>
            <Ionicons name="lock-closed-outline" size={20} color={C.sub} />
            <Text style={[T.body, { flex: 1, color: C.sub, fontSize: 14 }]}>
              Budgetly never connects to your bank. Only people in a space can see its entries.
            </Text>
          </Card>
        </Section>

        <Button title="Sign out" variant="danger" icon="log-out-outline"
          onPress={async () => { if (await confirm({ title: 'Sign out?', message: email, confirmLabel: 'Sign out' })) supabase.auth.signOut(); }} />
      </ScrollView>

      <EditName visible={edit} initial={name} onClose={() => setEdit(false)}
        onSaved={() => { setEdit(false); toast('Name updated', 'success'); refreshHouseholds(); data.reload(); }} />
      <JoinSheet visible={join} onClose={() => setJoin(false)}
        onJoined={async (id) => { setJoin(false); await refreshHouseholds(); setActive(id); toast('Joined. It is now your current space', 'success'); }} />
    </Screen>
  );
}

function EditName({ visible, initial, onClose, onSaved }: { visible: boolean; initial: string; onClose: () => void; onSaved: () => void }) {
  const { session } = useAuth();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    const n = v.trim();
    if (!n) return setErr('Enter a name');
    setBusy(true);
    const [a, b] = await Promise.all([
      supabase.auth.updateUser({ data: { full_name: n } }),
      supabase.from('profiles').update({ full_name: n }).eq('id', session!.user.id),
    ]);
    setBusy(false);
    const e = a.error || b.error;
    if (e) return setErr(e.message);
    onSaved();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Your name" footer={<Button title="Save" loading={busy} onPress={save} />}>
      <Text style={[T.body, { color: C.sub }]}>Shown to the people you share spaces with.</Text>
      <Field defaultValue={initial} onChangeText={(t) => { setV(t); setErr(null); }} autoFocus error={err} onSubmitEditing={save} maxLength={40} />
    </Sheet>
  );
}
