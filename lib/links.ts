import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/** Public web address used in shared links from the native apps. Override with EXPO_PUBLIC_WEB_URL. */
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://budgetly-flax.vercel.app';

/** A link that opens the join screen for a space's invite code. */
export const inviteLink = (code: string) => {
  const base = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : WEB_URL;
  return `${base}/join/${encodeURIComponent(code)}`;
};

// An invite opened while signed out is parked here and redeemed right after sign-in.
const PENDING = 'budgetly.pendingJoin';
export const parkInvite = (code: string) => AsyncStorage.setItem(PENDING, code).catch(() => {});
export const takeParkedInvite = async () => {
  try { const c = await AsyncStorage.getItem(PENDING); if (c) await AsyncStorage.removeItem(PENDING); return c; } catch { return null; }
};
