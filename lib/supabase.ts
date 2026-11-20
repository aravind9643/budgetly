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
  paid_by: string; is_personal: boolean; split_type: SplitType;
};
export type SplitType = 'equal' | 'percent' | 'shares' | 'exact';
export type Split = { expense_id: string; user_id: string; amount: number; weight: number | null };
export type Settlement = {
  id: string; group_id: string; from_user: string; to_user: string; amount: number;
  note: string | null; created_by: string; settled_at: string; created_at: string;
};
export type Profile = { id: string; full_name: string | null; email: string | null };
export type Member = { user_id: string; role: string; joined_at?: string; profiles: { full_name: string | null; email: string | null } | null };
export type Invite = { id: string; group_id: string; email: string; status: string; groups?: Group | null };
