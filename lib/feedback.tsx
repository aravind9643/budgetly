import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut, FadeOutUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, S, shadow, T } from './theme';

type Tone = 'success' | 'error' | 'info';
type ConfirmOpts = { title: string; message?: string; confirmLabel?: string; destructive?: boolean };

const Ctx = createContext<{
  toast: (message: string, tone?: Tone) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
}>({ toast: () => {}, confirm: async () => false });

export const useFeedback = () => useContext(Ctx);

/** App-wide toasts and confirm dialogs that look the same on web, iOS and Android (replaces window.alert/confirm). */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toastState, setToast] = useState<{ id: number; message: string; tone: Tone } | null>(null);
  const [dialog, setDialog] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const toast = useCallback((message: string, tone: Tone = 'info') => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(tone === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success);
    }
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })), []);
  const close = (v: boolean) => { dialog?.resolve(v); setDialog(null); };

  const icon = { success: 'checkmark-circle', error: 'alert-circle', info: 'information-circle' } as const;
  const color = { success: C.positive, error: C.negative, info: C.primary };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      {toastState && (
        <Animated.View key={toastState.id} entering={FadeInUp.springify().damping(18)} exiting={FadeOutUp}
          style={[styles.toastWrap, { top: insets.top + S.sm, pointerEvents: 'box-none' }]}>
          <Pressable onPress={() => setToast(null)} style={styles.toast} accessibilityRole="alert">
            <Ionicons name={icon[toastState.tone]} size={20} color={color[toastState.tone]} />
            <Text style={[T.body, { flex: 1 }]}>{toastState.message}</Text>
          </Pressable>
        </Animated.View>
      )}
      <Modal visible={!!dialog} transparent animationType="none" onRequestClose={() => close(false)}>
        {dialog && (
          <View style={styles.center}>
            <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut} style={[StyleSheet.absoluteFill, { backgroundColor: C.scrim }]}>
              <Pressable style={{ flex: 1 }} onPress={() => close(false)} />
            </Animated.View>
            <Animated.View entering={ZoomIn.springify().damping(20)} style={styles.dialog}>
              <Text style={T.heading}>{dialog.title}</Text>
              {dialog.message && <Text style={[T.body, { color: C.sub }]}>{dialog.message}</Text>}
              <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
                <Pressable onPress={() => close(false)} style={[styles.dBtn, { backgroundColor: C.surface2 }]}>
                  <Text style={{ color: C.text, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={() => close(true)}
                  style={[styles.dBtn, { backgroundColor: dialog.destructive ? C.negative : C.primary }]}>
                  <Text style={{ color: dialog.destructive ? '#fff' : C.onPrimary, fontWeight: '700' }}>{dialog.confirmLabel ?? 'Confirm'}</Text>
                </Pressable>
              </View>
            </Animated.View>
          </View>
        )}
      </Modal>
    </Ctx.Provider>
  );
}

// Getters (not StyleSheet.create) so colors follow the active light/dark scheme.
const styles = {
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: S.lg, zIndex: 100 } as ViewStyle,
  get toast(): ViewStyle {
    return {
      flexDirection: 'row', alignItems: 'center', gap: S.sm, width: '100%', maxWidth: 480,
      backgroundColor: C.surface, borderColor: C.borderStrong, borderWidth: 1, borderRadius: R.md,
      paddingHorizontal: S.lg, paddingVertical: S.md,
      ...(shadow('#000000', 0.25, 20, 8) as any),
    };
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl } as ViewStyle,
  get dialog(): ViewStyle {
    return {
      width: '100%', maxWidth: 380, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1,
      borderColor: C.border, padding: S.xl, gap: S.sm,
    };
  },
  dBtn: { flex: 1, height: 46, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' } as ViewStyle,
};
