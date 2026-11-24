import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Typography';
import { Loading, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { parkInvite } from '@/lib/links';
import { C, S, T } from '@/lib/theme';
import { useThemeMode } from '@/lib/themeMode';

/**
 * Deep link target: /join/<code> (web) or budgetly://join/<code> (apps).
 * Parks the code and hands over to the signed-in app, which redeems it (see HouseholdProvider).
 * Signed out → login first; the parked code survives the sign-in.
 */
export default function JoinLink() {
  useThemeMode(); // re-render this screen when light/dark changes
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading || !code) return;
    parkInvite(String(code)).then(() => router.replace(session ? '/' : '/login'));
  }, [loading, session, code]);
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md }}>
        <Loading />
        <Text style={[T.body, { color: C.sub }]}>Opening your invite…</Text>
      </View>
    </Screen>
  );
}
