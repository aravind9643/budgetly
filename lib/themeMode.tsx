import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform, useColorScheme, View } from 'react-native';
import { useFonts } from 'expo-font';
import { FONTS } from '@/components/Typography';
import { applyScheme, C, Scheme } from './theme';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'budgetly.theme';

const Ctx = createContext<{ pref: ThemePref; scheme: Scheme; setPref: (p: ThemePref) => void }>({
  pref: 'system', scheme: 'light', setPref: () => {},
});
export const useThemeMode = () => useContext(Ctx);

/**
 * Light/dark mode. The preference (system/light/dark) is saved per device; "system" follows the OS setting.
 * The palette is applied to the shared `C` tokens *before* the subtree renders. Every route, layout and
 * global overlay calls useThemeMode(), so a switch re-renders them in place: no remount, navigation state kept.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const os = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');
  const [ready, setReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts(FONTS); // Inter; on failure we fall back to the system font

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const scheme: Scheme = pref === 'system' ? (os === 'dark' ? 'dark' : 'light') : pref;
  applyScheme(scheme); // synchronous, so children read the right tokens during this render

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = scheme;
      document.body.style.backgroundColor = C.bg;
    }
  }, [scheme]);

  const setPref = (p: ThemePref) => { setPrefState(p); AsyncStorage.setItem(KEY, p).catch(() => {}); };

  // Avoid a light flash (and a font swap) before the saved preference and fonts load.
  if (!ready || (!fontsLoaded && !fontError)) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return (
    <Ctx.Provider value={{ pref, scheme, setPref }}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>{children}</View>
    </Ctx.Provider>
  );
}
