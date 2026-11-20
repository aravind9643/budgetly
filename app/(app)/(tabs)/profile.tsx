import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ListRow, PageTitle } from '@/components/Nav';
import { Avatar, Button, Card, Divider, Field, IconButton, Screen, Section, Segmented, Sheet, s } from '@/components/ui';
import { ThemePref, useThemeMode } from '@/lib/themeMode';
import { useAuth } from '@/lib/auth';
import { useFeedback } from '@/lib/feedback';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { C, R, S, T } from '@/lib/theme';

export default function Profile() {
  const { session } = useAuth();
  const { households, refreshHouseholds, data } = useHousehold();
  const { toast, confirm } = useFeedback();
  const [edit, setEdit] = useState(false);
  const { pref, scheme, setPref } = useThemeMode();
  const email = session?.user.email ?? '';
  const name = (session?.user.user_metadata?.full_name as string) || email.split('@')[0];
  const count = households?.length ?? 0;

  const signOut = async () => {
    if (await confirm({ title: 'Sign out?', message: email, confirmLabel: 'Sign out' })) supabase.auth.signOut();
  };

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <PageTitle eyebrow="Manage your account" title="Profile" />
        <View style={{ paddingHorizontal: S.xl, gap: S.xl }}>
          <Card style={[s.row, { gap: S.lg, padding: S.xl }]}>
            <Avatar name={name} size={72} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: C.text }} numberOfLines={1}>{name}</Text>
              <Text style={[T.body, { color: C.sub }]} numberOfLines={1}>{email}</Text>
              <View style={{ alignSelf: 'flex-start', backgroundColor: C.surface2, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 3, marginTop: 2 }}>
                <Text style={{ fontWeight: '700', color: C.text, fontSize: 13 }}>{count} household{count === 1 ? '' : 's'}</Text>
              </View>
            </View>
            <IconButton icon="pencil" label="Edit name" onPress={() => setEdit(true)} size={48} />
          </Card>

          <Section title="Account">
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <ListRow icon="person-outline" tint={C.primary} title="Display name" subtitle={name} onPress={() => setEdit(true)} />
              <Divider />
              <ListRow icon="mail-outline" tint="#3B82F6" title="Email" subtitle={email} />
            </Card>
          </Section>

          <Section title="Appearance">
            <Card style={{ gap: S.md }}>
              <Segmented<ThemePref> value={pref} onChange={setPref}
                options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
              <Text style={T.caption}>
                {pref === 'system' ? `Following your device setting (currently ${scheme}).` : `Always ${pref}.`}
              </Text>
            </Card>
          </Section>

          <Section title="About">
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <ListRow icon="shield-checkmark-outline" tint={C.positive} title="Your data"
                subtitle="No bank connection. Only members of a household can see its expenses." />
            </Card>
          </Section>

          <Button title="Sign out" icon="log-out-outline" variant="danger" onPress={signOut} />
        </View>
      </ScrollView>
      <EditName visible={edit} initial={name} onClose={() => setEdit(false)}
        onSaved={() => { setEdit(false); toast('Name updated', 'success'); refreshHouseholds(); data.reload(); }} />
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
      <Text style={[T.body, { color: C.sub }]}>This is how other members see you.</Text>
      <Field defaultValue={initial} onChangeText={(t) => { setV(t); setErr(null); }} autoFocus error={err} onSubmitEditing={save} maxLength={40} />
    </Sheet>
  );
}
