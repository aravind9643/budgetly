import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(url, key, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Row types derive from the generated schema (`npm run db:types`), so a schema change surfaces as a type error.
// Columns that have DB defaults are generated as nullable; we narrow the ones the app relies on.
type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

export type SplitType = 'equal' | 'percent' | 'shares' | 'exact';
export type Frequency = 'weekly' | 'monthly' | 'yearly';

export type Group = Omit<Row<'groups'>, 'emoji' | 'currency' | 'monthly_budget'> & {
  emoji: string; currency: string; monthly_budget: number;
};
export type Expense = Omit<Row<'expenses'>, 'type' | 'split_type'> & { type: 'expense' | 'income'; split_type: SplitType };
export type Split = Pick<Row<'expense_splits'>, 'expense_id' | 'user_id' | 'amount' | 'weight'>;
export type Settlement = Row<'settlements'>;
export type Profile = Pick<Row<'profiles'>, 'id' | 'full_name' | 'email'>;
export type Member = Pick<Row<'group_members'>, 'user_id' | 'role'> & {
  joined_at?: string | null; profiles: Pick<Row<'profiles'>, 'full_name' | 'email'> | null;
};
export type Invite = Row<'invites'> & { groups?: Group | null };
export type Recurring = Omit<Row<'recurring_expenses'>, 'frequency' | 'splits'> & {
  frequency: Frequency; splits: { user_id: string; amount: number }[];
};
export type CategoryBudget = Row<'category_budgets'>;
export type CustomCategory = Row<'categories'>;
