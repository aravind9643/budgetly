// Read-only RLS check: an outsider must not see a space's rows or receipts.
// Usage: OUTSIDER_EMAIL=... OUTSIDER_PASSWORD=... MEMBER_EMAIL=... MEMBER_PASSWORD=... node scripts/rls-check.mjs
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = { ...Object.fromEntries((fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '').split(/\r?\n/)
  .filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')])), ...process.env };
const client = () => createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed++; };

const member = client();
await member.auth.signInWithPassword({ email: env.MEMBER_EMAIL, password: env.MEMBER_PASSWORD });
const out = client();
await out.auth.signInWithPassword({ email: env.OUTSIDER_EMAIL, password: env.OUTSIDER_PASSWORD });
const { data: mine } = await out.from('groups').select('id');
const outsiderIn = new Set((mine ?? []).map((g) => g.id));
const { data: groups } = await member.from('groups').select('id');
const gid = (groups ?? []).map((g) => g.id).find((id) => !outsiderIn.has(id));
if (!gid) throw new Error('every space of MEMBER also includes OUTSIDER; pick another pair');
const { data: withReceipt } = await member.from('expenses').select('receipt_path').eq('group_id', gid).not('receipt_path', 'is', null).limit(1);

for (const t of ['groups', 'expenses', 'group_members', 'settlements', 'recurring_expenses', 'category_budgets', 'categories', 'invites']) {
  const col = t === 'groups' ? 'id' : 'group_id';
  const { data } = await out.from(t).select('*').eq(col, gid);
  check(`outsider cannot read ${t}`, (data ?? []).length === 0);
}
const { data: sp } = await out.from('expense_splits').select('expense_id, expenses!inner(group_id)').eq('expenses.group_id', gid);
check('outsider cannot read expense_splits', (sp ?? []).length === 0);
const { data: files } = await out.storage.from('receipts').list(gid);
check('outsider cannot list receipts', (files ?? []).length === 0);
if (withReceipt?.[0]) {
  const { data } = await out.storage.from('receipts').createSignedUrl(withReceipt[0].receipt_path, 60);
  check('outsider cannot sign a receipt URL', !data?.signedUrl);
}
const { error: rr } = await out.rpc('run_recurring', { p_group: gid });
check('outsider cannot run recurring', !!rr);
const { error: rb } = await out.rpc('reset_balances', { p_group: gid, p_transfers: [] });
check('outsider cannot reset balances', !!rb);
const anon = client();
const { data: anonRows } = await anon.from('expenses').select('id').limit(1);
check('signed-out visitor reads nothing', (anonRows ?? []).length === 0);
const { data: memRows } = await member.from('expenses').select('id').eq('group_id', gid).limit(1);
check('member can still read (sanity)', (memRows ?? []).length > 0);
process.exit(failed ? 1 : 0);
