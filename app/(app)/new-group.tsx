import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, Card, Chip, Field, Header, IconButton, Press, Screen, Section } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useFeedback } from '@/lib/feedback';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { C, money, R, S, T } from '@/lib/theme';

const EMOJIS = ['💰', '🏠', '✈️', '🍕', '🎉', '👨‍👩‍👧', '🚗', '🎓', '💼', '🛒', '💍', '🐶'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD'];
const SUGGESTIONS = ['Home', 'Flatmates', 'Weekend trip', 'Us two'];

export default function NewGroup() {
  const router = useRouter();
  const { session } = useAuth();
  const { toast } = useFeedback();
  const { refreshHouseholds, setActive } = useHousehold();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💰');
  const [currency, setCurrency] = useState('USD');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim()) return setErr('Give your space a name');
    if (!session) return;
    setBusy(true);
    const { data, error } = await supabase.from('groups').insert({
      name: name.trim(), emoji, currency, monthly_budget: Number(budget) || 0, owner_id: session.user.id,
    }).select('id').single();
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Space ready', 'success');
    await refreshHouseholds(); setActive(data.id);
    router.replace('/');
  };

  return (
    <Screen>
      <Header title="New space" right={<IconButton icon="close" label="Close" onPress={() => router.back()} />} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: S.xl, gap: S.xl }} keyboardShouldPersistTaps="handled">
          {/* Live preview */}
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
            <View style={{ width: 52, height: 52, borderRadius: R.md, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 26 }}>{emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={T.heading} numberOfLines={1}>{name.trim() || 'Your space'}</Text>
              <Text style={T.caption}>
                {Number(budget) > 0 ? `${money(Number(budget), currency)} / month` : 'No monthly budget'}
              </Text>
            </View>
          </Card>

          <Field label="Name" placeholder="e.g. Home" value={name} autoFocus
            onChangeText={(t) => { setName(t); setErr(null); }} error={err} returnKeyType="next" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginTop: -S.sm }}>
            {SUGGESTIONS.map((x) => <Chip key={x} label={x} active={name === x} onPress={() => { setName(x); setErr(null); }} />)}
          </View>

          <Section title="Icon">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
              {EMOJIS.map((e) => (
                <Press key={e} onPress={() => setEmoji(e)} accessibilityLabel={`Icon ${e}`} style={{
                  width: 48, height: 48, borderRadius: R.md, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: emoji === e ? C.primarySoft : C.surface2,
                  borderWidth: 1.5, borderColor: emoji === e ? C.primary : 'transparent',
                }}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </Press>
              ))}
            </View>
          </Section>

          <Section title="Currency">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
              {CURRENCIES.map((c) => <Chip key={c} label={c} active={currency === c} onPress={() => setCurrency(c)} />)}
            </View>
          </Section>

          <Field label="Monthly budget (optional)" prefix={currency} placeholder="0" keyboardType="decimal-pad"
            value={budget} onChangeText={(t) => setBudget(t.replace(/[^0-9.]/g, ''))} />
          <Text style={[T.caption, { marginTop: -S.md }]}>You can change this any time from the group.</Text>
        </ScrollView>
        <View style={{ padding: S.xl, paddingTop: S.sm }}>
          <Button title="Create space" loading={busy} onPress={create} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
