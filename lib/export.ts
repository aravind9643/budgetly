import { Platform, Share } from 'react-native';
import { Expense } from './supabase';
import { catMeta } from './theme';

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV of the given transactions. Downloads a file on web; opens the share sheet on mobile. */
export async function exportCsv(filename: string, rows: Expense[], cur: string, nameOf: (u: string) => string) {
  const header = ['Date', 'Title', 'Type', 'Category', 'Amount', 'Currency', 'Paid by', 'Personal'];
  const lines = rows.map((e) => [
    e.spent_at, e.title, e.type, e.type === 'income' ? '' : catMeta(e.category).label,
    Number(e.amount).toFixed(2), cur, nameOf(e.paid_by ?? e.user_id), e.is_personal ? 'yes' : 'no',
  ].map(esc).join(','));
  const csv = [header.join(','), ...lines].join('\n');
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    await Share.share({ title: filename, message: csv });
  }
}
