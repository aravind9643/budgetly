import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '@/components/Typography';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { JoinSheet } from '@/components/JoinSheet';
import { Button, Card, Chip, Field, Press, s } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useFeedback } from '@/lib/feedback';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { C, IconName, R, S, T, CURRENCIES } from '@/lib/theme';

const EMOJIS = ['🏠', '✈️', '🛋️', '💑', '🎓', '💼'];
const VALUE: [IconName, string, string][] = [
  ['people-outline', 'One budget, many people', 'Share a space with a partner, flatmates or a trip group.'],
  ['scale-outline', 'Balances, worked out', 'Everyone sees who paid and who owes, and settles in one tap.'],
  ['pie-chart-outline', 'Know where it goes', 'Category limits and insights keep the month on track.'],
];

/** First-run flow shown when the user has no space yet: why → create (or join with a code). */
export function Onboarding() {
  const { session } = useAuth();
  const { toast } = useFeedback();
  const { refreshHouseholds, setActive } = useHousehold();
  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏠');
  const [currency, setCurrency] = useState(() => {
    try { const c = new Intl.NumberFormat().resolvedOptions() as any; return CURRENCIES.includes(c.currency) ? c.currency : 'USD'; } catch { return 'USD'; }
  });
  const [budget, setBudget] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [join, setJoin] = useState(false);
  const first = ((session?.user.user_metadata?.full_name as string) || '').split(' ')[0];

  const create = async () => {
    if (!name.trim()) return setErr('Give your space a name');
    setBusy(true);
    const { data, error } = await supabase.from('groups').insert({
      name: name.trim(), emoji, currency, monthly_budget: Number(budget) || 0, owner_id: session!.user.id,
    }).select('id').single();
    setBusy(false);
    if (error) return setErr(error.message);
    await refreshHouseholds(); setActive(data.id);
    toast(`${emoji} ${name.trim()} is ready. Invite people from its settings`, 'success');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: S.xl, gap: S.xl, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <View style={[s.row, { gap: 6 }]}>
        {[0, 1].map((i) => <View key={i} style={{ height: 4, flex: 1, borderRadius: 2, backgroundColor: i <= step ? C.primary : C.border }} />)}
      </View>

      {step === 0 ? (
        <Animated.View entering={FadeInRight.duration(250)} style={{ gap: S.xl }}>
          <View style={{ gap: S.sm }}>
            <Text style={{ fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: -0.8 }}>Welcome{first ? `, ${first}` : ''}</Text>
            <Text style={[T.body, { color: C.sub, fontSize: 16 }]}>Budgetly keeps shared money simple. Here's how it works.</Text>
          </View>
          <Card style={{ gap: S.lg }}>
            {VALUE.map(([icon, title, body]) => (
              <View key={title} style={[s.row, { gap: S.md, alignItems: 'flex-start' }]}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={icon} size={20} color={C.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={T.heading}>{title}</Text>
                  <Text style={[T.body, { color: C.sub, fontSize: 14 }]}>{body}</Text>
                </View>
              </View>
            ))}
          </Card>
          <Button title="Set up my first space" icon="arrow-forward" onPress={() => setStep(1)} />
          <Button title="I have a code" variant="ghost" icon="key-outline" onPress={() => setJoin(true)} />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInRight.duration(250)} style={{ gap: S.lg }}>
          <View style={{ gap: S.sm }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.6 }}>Your first space</Text>
            <Text style={[T.body, { color: C.sub }]}>You can rename it, change the budget and invite people at any time.</Text>
          </View>
          <View style={[s.row, { gap: S.sm }]}>
            {EMOJIS.map((e) => (
              <Press key={e} onPress={() => setEmoji(e)} accessibilityLabel={`Icon ${e}`}
                style={{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: emoji === e ? C.primarySoft : C.surface, borderWidth: 1.5, borderColor: emoji === e ? C.primary : C.border }}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Press>
            ))}
          </View>
          <Field label="Name" placeholder="e.g. Home" value={name} autoFocus onChangeText={(t) => { setName(t); setErr(null); }} error={err} />
          <View style={{ gap: 6 }}>
            <Text style={T.label}>Currency</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
              {CURRENCIES.map((c) => <Chip key={c} label={c} active={currency === c} onPress={() => setCurrency(c)} />)}
            </View>
          </View>
          <Field label="Monthly budget (optional)" prefix={currency} placeholder="No limit" keyboardType="decimal-pad"
            value={budget} onChangeText={(t) => setBudget(t.replace(/[^0-9.]/g, ''))} />
          <View style={[s.row, { gap: S.sm }]}>
            <Button title="Back" variant="secondary" onPress={() => setStep(0)} style={{ flex: 1 }} />
            <Button title="Create space" loading={busy} onPress={create} style={{ flex: 2 }} />
          </View>
        </Animated.View>
      )}
      <JoinSheet visible={join} onClose={() => setJoin(false)}
        onJoined={async (id) => { setJoin(false); await refreshHouseholds(); setActive(id); toast('Joined. It is now your current space', 'success'); }} />
    </ScrollView>
  );
}
