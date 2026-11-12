import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import { Bouncy, Button, Card, Chip, H1, Input, Screen, Sub, s } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';

const EMOJIS = ['💰', '🏠', '✈️', '🍕', '🎉', '👨‍👩‍👧', '🚗', '🎓', '💼', '🛒'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD'];

export default function NewGroup() {
  const router = useRouter();
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💰');
  const [currency, setCurrency] = useState('USD');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim() || !session) return;
    setBusy(true);
    const { data, error } = await supabase.from('groups').insert({
      name: name.trim(), emoji, currency, monthly_budget: Number(budget) || 0, owner_id: session.user.id,
    }).select('id').single();
    setBusy(false);
    if (error) return Platform.OS === 'web' ? window.alert(error.message) : Alert.alert(error.message);
    router.replace(`/group/${data.id}`);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <H1>New group</H1>
          <Bouncy onPress={() => router.back()} style={{ padding: 8, borderRadius: 12, backgroundColor: C.card }}>
            <Ionicons name="close" size={22} color={C.text} />
          </Bouncy>
        </View>
        <Card index={0} style={{ gap: 14 }}>
          <Sub>Pick an icon</Sub>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {EMOJIS.map((e) => (
              <Bouncy key={e} onPress={() => setEmoji(e)} style={{
                width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                backgroundColor: emoji === e ? 'rgba(124,92,255,0.35)' : C.card,
                borderWidth: 1, borderColor: emoji === e ? C.primary : C.cardBorder,
              }}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </Bouncy>
            ))}
          </View>
          <Input icon="people" placeholder="Group name (e.g. Roommates)" value={name} onChangeText={setName} />
          <Input icon="cash" placeholder="Monthly budget (optional)" keyboardType="decimal-pad" value={budget} onChangeText={setBudget} />
          <Sub>Currency</Sub>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CURRENCIES.map((c) => <Chip key={c} label={c} active={currency === c} onPress={() => setCurrency(c)} />)}
          </View>
        </Card>
        <Button title="Create group" icon="sparkles" loading={busy} onPress={create} />
      </ScrollView>
    </Screen>
  );
}
