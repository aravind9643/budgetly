import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import Animated, {
  FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { Button, Card, H1, Input, Screen, Sub } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';

const notify = (t: string, m: string) => (Platform.OS === 'web' ? window.alert(`${t}\n${m}`) : Alert.alert(t, m));

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withSequence(withTiming(-10, { duration: 1600 }), withTiming(0, { duration: 1600 })), -1);
  }, []);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }, { rotate: `${float.value / 2}deg` }] }));

  const submit = async () => {
    if (!email || !password) return notify('Missing info', 'Email and password are required.');
    setBusy(true);
    const { error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name } } });
    setBusy(false);
    if (error) notify('Oops', error.message);
    else if (mode === 'up') notify('Welcome!', 'Check your inbox to confirm your email (if confirmation is enabled).');
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Animated.View entering={FadeInUp.springify()} style={{ alignItems: 'center', marginBottom: 28 }}>
          <Animated.View style={floatStyle}>
            <LinearGradient colors={C.grad} style={{ width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="wallet" size={44} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <View style={{ height: 18 }} />
          <H1>Budgetly</H1>
          <Sub>Shared budgets for every crew</Sub>
        </Animated.View>

        <Card index={1} style={{ gap: 14 }}>
          {mode === 'up' && (
            <Animated.View entering={FadeInDown}>
              <Input icon="person" placeholder="Full name" value={name} onChangeText={setName} />
            </Animated.View>
          )}
          <Input icon="mail" placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Input icon="lock-closed" placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
          <Button title={mode === 'in' ? 'Sign in' : 'Create account'} icon="arrow-forward" loading={busy} onPress={submit} />
        </Card>

        <Pressable onPress={() => setMode(mode === 'in' ? 'up' : 'in')} style={{ marginTop: 20, alignItems: 'center' }}>
          <Text style={{ color: C.sub }}>
            {mode === 'in' ? "New here? " : 'Already have an account? '}
            <Text style={{ color: C.accent, fontWeight: '700' }}>{mode === 'in' ? 'Create account' : 'Sign in'}</Text>
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}
