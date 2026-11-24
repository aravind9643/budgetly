import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { JoinSheet } from '@/components/JoinSheet';
import { Button, Press, Sheet, s } from '@/components/ui';
import { useFeedback } from '@/lib/feedback';
import { useHousehold } from '@/lib/household';
import { C, R, S, T } from '@/lib/theme';

/** "My households" switcher sheet: pick the active one, create, or join. */
export function HouseholdPicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const { households, activeId, setActive, refreshHouseholds } = useHousehold();
  const [join, setJoin] = useState(false);
  return (
    <>
      <Sheet visible={visible && !join} onClose={onClose} title="Switch space"
        footer={
          <View style={{ gap: S.sm }}>
            <Button title="New space" icon="add" onPress={() => { onClose(); router.push('/new-group'); }} />
            <Button title="Have a code?" icon="mail-open-outline" variant="secondary" onPress={() => setJoin(true)} />
          </View>
        }>
        {(households ?? []).map((h) => {
          const on = h.id === activeId;
          return (
            <Press key={h.id} onPress={() => { setActive(h.id); onClose(); }} accessibilityLabel={`Switch to ${h.name}`}
              style={[s.row, { gap: S.md, padding: S.md, borderRadius: R.lg, backgroundColor: C.surface,
                borderWidth: 2, borderColor: on ? C.primary : C.border }]}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24 }}>{h.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={T.heading} numberOfLines={1}>{h.name}</Text>
                <Text style={[T.body, { color: C.sub, fontSize: 14 }]}>{h.memberCount} {h.memberCount === 1 ? 'person' : 'people'} · {h.currency}</Text>
              </View>
              {on && <Ionicons name="checkmark-circle" size={26} color={C.primary} />}
            </Press>
          );
        })}
      </Sheet>
      <JoinSheet visible={join} onClose={() => setJoin(false)}
        onJoined={async (id) => {
          setJoin(false); onClose();
          await refreshHouseholds(); setActive(id);
          toast('Joined. It is now your current space', 'success');
        }} />
    </>
  );
}
