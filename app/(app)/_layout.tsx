import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { C } from '@/lib/theme';

export default function AppLayout() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }
  if (!session) return <Redirect href="/login" />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="new-group" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
