import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/Typography';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { Button, Field, Screen, Segmented } from '@/components/ui';
import { useFeedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { C, R, S, T } from '@/lib/theme';
import { useThemeMode } from '@/lib/themeMode';

type Mode = 'in' | 'up';

export default function Login() {
  useThemeMode(); // re-render this screen when light/dark changes
  const { toast } = useFeedback();
  const [mode, setMode] = useState<Mode>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  const submit = async () => {
    const e: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Enter a valid email address';
    if (password.length < 6) e.password = 'Use at least 6 characters';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const { error, data } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } });
    setBusy(false);
    if (error) return setErrors({ form: error.message });
    if (mode === 'up' && !data.session) toast('Check your inbox to confirm your email', 'success');
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: S.xl, gap: S.xxl }}
          keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.duration(500)} style={{ gap: S.md }}>
            <View style={{ width: 52, height: 52, borderRadius: R.md, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="wallet" size={26} color={C.onPrimary} />
            </View>
            <Text style={[T.display, { fontSize: 34 }]}>
              {mode === 'in' ? 'Welcome back' : 'Budget together'}
            </Text>
            <Text style={[T.body, { color: C.sub, fontSize: 16 }]}>
              {mode === 'in'
                ? 'Sign in to see where your shared money is going.'
                : 'Create shared budgets with roommates, partners and trips.'}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(500)} layout={Layout.springify()} style={{ gap: S.lg }}>
            <Segmented<Mode> value={mode} onChange={(m) => { setMode(m); setErrors({}); }}
              options={[{ value: 'in', label: 'Sign in' }, { value: 'up', label: 'Create account' }]} />
            {mode === 'up' && (
              <Animated.View entering={FadeIn}>
                <Field label="Your name" icon="person-outline" placeholder="Alex Morgan" value={name}
                  onChangeText={setName} autoComplete="name" textContentType="name" />
              </Animated.View>
            )}
            <Field label="Email" icon="mail-outline" placeholder="you@example.com" autoCapitalize="none"
              keyboardType="email-address" autoComplete="email" textContentType="emailAddress"
              value={email} onChangeText={setEmail} error={errors.email} />
            <Field label="Password" icon="lock-closed-outline" placeholder="At least 6 characters"
              secureTextEntry={!show} value={password} onChangeText={setPassword} onSubmitEditing={submit}
              autoComplete={mode === 'in' ? 'password' : 'new-password'} error={errors.password}
              right={
                <Pressable onPress={() => setShow(!show)} hitSlop={10} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
                  <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.muted} />
                </Pressable>
              } />
            {errors.form && (
              <View style={{ flexDirection: 'row', gap: S.sm, backgroundColor: C.negativeSoft, padding: S.md, borderRadius: R.md }}>
                <Ionicons name="alert-circle" size={18} color={C.negative} />
                <Text style={{ color: C.negative, flex: 1 }}>{errors.form}</Text>
              </View>
            )}
            <Button title={mode === 'in' ? 'Sign in' : 'Create account'} loading={busy} onPress={submit} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
