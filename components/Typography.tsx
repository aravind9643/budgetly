import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { forwardRef } from 'react';
import {
  Platform, StyleSheet, Text as RNText, TextInput as RNTextInput, TextInputProps, TextProps, TextStyle,
} from 'react-native';

/** Font files to load once at startup (see ThemeProvider). */
export const FONTS = { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold };

const FAMILY: Record<number, string> = {
  400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold', 800: 'Inter_800ExtraBold',
};

/**
 * Custom fonts don't respond to `fontWeight` on iOS/Android, so map the requested weight to the matching
 * Inter file and neutralise fontWeight on native. Screens keep writing `fontWeight: '700'` as usual.
 */
function interStyle(style: TextProps['style']): TextStyle {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const raw = flat.fontWeight === 'bold' ? 700 : flat.fontWeight === 'normal' || !flat.fontWeight ? 400 : Number(flat.fontWeight);
  const w = raw >= 800 ? 800 : raw >= 700 ? 700 : raw >= 600 ? 600 : raw >= 500 ? 500 : 400;
  return { fontFamily: FAMILY[w], ...(Platform.OS !== 'web' ? { fontWeight: 'normal' } : null) };
}

export const Text = forwardRef<RNText, TextProps>(function Text(props, ref) {
  return <RNText ref={ref} {...props} style={[props.style, interStyle(props.style)]} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(props, ref) {
  return <RNTextInput ref={ref} {...props} style={[props.style, interStyle(props.style)]} />;
});
