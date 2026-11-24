import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Button, Field, Sheet } from '@/components/ui';
import { useFeedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { C, T } from '@/lib/theme';

/** Edit a space's shared monthly budget. Only owners and admins can save (enforced by RLS). */
export function BudgetSheet({ visible, onClose, groupId, initial, cur, canEdit, onSaved }: {
  visible: boolean; onClose: () => void; groupId: string; initial: number; cur: string; canEdit: boolean; onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (visible) { setV(initial ? String(initial) : ''); setErr(null); } }, [visible, initial]);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('groups').update({ monthly_budget: Number(v) || 0 }).eq('id', groupId);
    setBusy(false);
    if (error) return setErr(error.message);
    toast('Budget updated', 'success'); onSaved(); onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Monthly budget"
      footer={canEdit ? <Button title="Save budget" loading={busy} onPress={save} /> : undefined}>
      <Text style={[T.body, { color: C.sub }]}>
        {canEdit
          ? 'The shared spending limit for everyone in this space. Set it to 0 to turn the budget off.'
          : 'Only the space owner or an admin can change the budget.'}
      </Text>
      <Field prefix={cur} keyboardType="decimal-pad" autoFocus={canEdit} placeholder="0" editable={canEdit}
        value={v} onChangeText={(t) => { setV(t.replace(/[^0-9.]/g, '')); setErr(null); }} error={err} onSubmitEditing={save} />
    </Sheet>
  );
}
