import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export type Group = {
  id: string; name: string; emoji: string; currency: string;
  monthly_budget: number; invite_code: string; owner_id: string;
};
export type Expense = {
  id: string; group_id: string; user_id: string; title: string; amount: number;
  category: string; type: 'expense' | 'income'; spent_at: string;
};
export type Member = { user_id: string; role: string; profiles: { full_name: string | null; email: string | null } | null };
export type Invite = { id: string; group_id: string; email: string; status: string; groups?: Group | null };
