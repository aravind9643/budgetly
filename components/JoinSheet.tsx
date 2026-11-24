import { useState } from 'react';
import { Text } from '@/components/Typography';
import { Button, Field, Sheet } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { C, T } from '@/lib/theme';

export function JoinSheet({ visible, onClose, onJoined }: { visible: boolean; onClose: () => void; onJoined: (id: string) => void }) {
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
    <Sheet visible={visible} onClose={onClose} title="Have a code?"
      footer={<Button title="Join space" loading={busy} onPress={join} />}>
      <Text style={[T.body, { color: C.sub }]}>Ask a member for their 8-character invite code.</Text>
      <Field placeholder="8F3A2C1D" autoCapitalize="characters" autoCorrect={false} autoFocus maxLength={12}
        value={code} onChangeText={(t) => { setCode(t.toUpperCase()); setErr(null); }} onSubmitEditing={join}
        error={err} icon="key-outline" />
    </Sheet>
  );
}
