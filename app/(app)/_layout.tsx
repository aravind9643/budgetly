import { Redirect, Stack } from 'expo-router';
import { Loading, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { HouseholdProvider } from '@/lib/household';
import { C } from '@/lib/theme';

export default function AppLayout() {
  const { session, loading } = useAuth();
  if (loading) return <Screen><Loading /></Screen>;
  if (!session) return <Redirect href="/login" />;
  return (
    <HouseholdProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="new-group" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </HouseholdProvider>
  );
}
