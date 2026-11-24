import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/Typography';
import { BackButton } from '@/components/Nav';
import { Button, Card, Divider, Field, IconButton, IconTile, Press, Screen, Section, Sheet, s } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useFeedback } from '@/lib/feedback';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { C, CATEGORIES, R, S, T } from '@/lib/theme';
import { useThemeMode } from '@/lib/themeMode';

const EMOJIS = ['🐶', '👶', '🏠', '💡', '📚', '🎁', '✈️', '🍷', '💊', '🧹', '🚲', '💻', '🎮', '🌱', '☕', '🧾'];
const COLORS = ['#E85D75', '#F08C3A', '#D9A21B', '#4BAF6A', '#2BA3A8', '#4C7DF0', '#8A63D2', '#C25BB5'];

/** Built-in categories plus custom ones for the current space. Any member can add; owners/admins can remove. */
export default function CategoriesScreen() {
  useThemeMode(); // re-render this screen when light/dark changes
  const router = useRouter();
  const { session } = useAuth();
  const { toast, confirm } = useFeedback();
  const { data } = useHousehold();
  const me = session?.user.id ?? '';
  const [sheet, setSheet] = useState(false);
  const g = data.group;
  const isAdmin = g?.owner_id === me || data.members.find((m) => m.user_id === me)?.role === 'admin';

  const remove = async (id: string, label: string) => {
    if (!(await confirm({ title: `Remove "${label}"?`, message: 'Past entries keep it but show as Other.', confirmLabel: 'Remove', destructive: true }))) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) return toast(error.message, 'error');
    toast('Category removed'); data.reload();
  };

  return (
    <Screen>
      <View style={[s.row, { gap: S.md, paddingHorizontal: S.xl, paddingTop: S.md }]}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ flex: 1 }}>
          <Text style={T.caption}>{g?.name}</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.6 }}>Categories</Text>
        </View>
        <IconButton icon="add" label="New category" size={44} onPress={() => setSheet(true)} />
      </View>
      <ScrollView contentContainerStyle={{ padding: S.xl, gap: S.xl, paddingBottom: 48 }}>
        <Section title={`Your categories · ${data.categories.length}`}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {data.categories.length === 0 && (
              <Text style={[T.body, { color: C.sub, padding: S.lg }]}>Add categories that fit how this space spends, e.g. Pets, Kids or Rent.</Text>
            )}
            {data.categories.map((c, i) => (
              <View key={c.id}>
                {i > 0 && <Divider />}
                <View style={[s.row, { gap: S.md, padding: S.lg }]}>
                  <IconTile icon="pricetag" color={c.color} emoji={c.emoji} size={36} />
                  <Text style={[T.body, { flex: 1, fontWeight: '600' }]}>{c.label}</Text>
                  {isAdmin && (
                    <Pressable hitSlop={8} onPress={() => remove(c.id, c.label)} accessibilityLabel={`Remove ${c.label}`}>
                      <Ionicons name="trash-outline" size={20} color={C.muted} />
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
            <Divider />
            <Press onPress={() => setSheet(true)} style={[s.row, { gap: S.md, padding: S.lg }]} accessibilityLabel="Add category">
              <Ionicons name="add-circle-outline" size={22} color={C.primary} />
              <Text style={{ color: C.primary, fontWeight: '700' }}>Add category</Text>
            </Press>
          </Card>
        </Section>
        <Section title="Built in">
          <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
            {Object.values(CATEGORIES).map((m) => (
              <View key={m.label} style={[s.row, { gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.pill, backgroundColor: m.color + '1F' }]}>
                <Ionicons name={m.icon} size={14} color={m.color} />
                <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>{m.label}</Text>
              </View>
            ))}
          </Card>
        </Section>
      </ScrollView>
      {g && <NewCategory visible={sheet} onClose={() => setSheet(false)} groupId={g.id}
        taken={[...Object.values(CATEGORIES).map((x) => x.label.toLowerCase()), ...data.categories.map((x) => x.label.toLowerCase())]}
        onSaved={() => { setSheet(false); data.reload(); }} />}
    </Screen>
  );
}

function NewCategory({ visible, onClose, groupId, taken, onSaved }: {
  visible: boolean; onClose: () => void; groupId: string; taken: string[]; onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const l = label.trim();
    if (!l) return setErr('Give it a name');
    if (taken.includes(l.toLowerCase())) return setErr('That category already exists');
    const key = 'c_' + l.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24) + '_' + Math.random().toString(36).slice(2, 6);
    setBusy(true);
    const { error } = await supabase.from('categories').insert({ group_id: groupId, key, label: l, emoji, color });
    setBusy(false);
    if (error) return setErr(error.message);
    setLabel(''); toast(`${emoji} ${l} added`, 'success'); onSaved();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="New category" footer={<Button title="Add category" loading={busy} onPress={save} />}>
      <View style={[s.row, { gap: S.md }]}>
        <IconTile icon="pricetag" color={color} emoji={emoji} size={52} />
        <Field style={{ flex: 1 } as any} placeholder="e.g. Pets" value={label} onChangeText={(t) => { setLabel(t); setErr(null); }} autoFocus maxLength={24} error={err} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
        {EMOJIS.map((e) => (
          <Press key={e} onPress={() => setEmoji(e)} accessibilityLabel={`Emoji ${e}`}
            style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: emoji === e ? C.primarySoft : C.surface2, borderWidth: 1.5, borderColor: emoji === e ? C.primary : 'transparent' }}>
            <Text style={{ fontSize: 20 }}>{e}</Text>
          </Press>
        ))}
      </View>
      <View style={[s.row, { gap: S.sm, flexWrap: 'wrap' }]}>
        {COLORS.map((c) => (
          <Press key={c} onPress={() => setColor(c)} accessibilityLabel={`Colour ${c}`}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: 3, borderColor: color === c ? C.text : 'transparent' }}><View /></Press>
        ))}
      </View>
    </Sheet>
  );
}
