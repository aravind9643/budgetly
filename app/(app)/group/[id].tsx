import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { Text } from '@/components/Typography';
import { BackButton, ListRow } from '@/components/Nav';
import {
  Avatar, Badge, Button, Card, Chip, Divider, EmptyState, Field, IconButton, Loading, Press, Screen, Section, Sheet, s,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { computeBalances } from '@/lib/balances';
import { exportCsv } from '@/lib/export';
import { inviteLink } from '@/lib/links';
import { useFeedback } from '@/lib/feedback';
import { useHousehold } from '@/lib/household';
import { Member, supabase } from '@/lib/supabase';
import { C, CURRENCIES, money, R, S, T } from '@/lib/theme';
import { displayName, useGroup } from '@/lib/useGroup';
import { useThemeMode } from '@/lib/themeMode';

/** Space settings: people, invites, budget/balances/export, plus leave/delete. */
export default function SpaceScreen() {
  useThemeMode(); // re-render this screen when light/dark changes
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { toast, confirm } = useFeedback();
  const { activeId, setActive, refreshHouseholds, data: active } = useHousehold();
  const me = session?.user.id ?? '';
  const { group, expenses, splits, settlements, members, invites, recurring, catBudgets, categories, loading, missing, reload } = useGroup(id);
  const [invite, setInvite] = useState(false);
  const [rename, setRename] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const net = useMemo(() => computeBalances(expenses, splits, settlements, members.map((m) => m.user_id)),
    [expenses, splits, settlements, members]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (loading) return <Screen><Loading /></Screen>;
  if (missing || !group) {
    return (
      <Screen>
        <EmptyState emoji="🫥" title="Space not found" body="It may have been deleted, or you're no longer a member."
          action={<Button title="Back" onPress={() => router.replace('/settings')} />} />
      </Screen>
    );
  }

  const cur = group.currency;
  const isOwner = group.owner_id === me;
  const isAdmin = isOwner || members.find((m) => m.user_id === me)?.role === 'admin';
  const myNet = net[me] ?? 0;
  const unsettled = Object.values(net).filter((v) => Math.abs(v) >= 0.005).length;
  const nameOf = (u: string) => (u === me ? 'You' : displayName(members.find((m) => m.user_id === u)));
  const isActive = activeId === group.id;
  // Budgets/Recurring/Categories act on the current space, so switch to this one first.
  const open = (path: '/budgets' | '/recurring' | '/categories') => { if (!isActive) setActive(group.id); router.push(path); };

  const remove = async (m: Member) => {
    const nm = displayName(m);
    const bal = net[m.user_id] ?? 0;
    const ok = await confirm({
      title: `Remove ${nm}?`, confirmLabel: 'Remove', destructive: true,
      message: Math.abs(bal) >= 0.005
        ? `${nm} ${bal > 0 ? 'is owed' : 'owes'} ${money(Math.abs(bal), cur)}. Their balance stays visible as a former member.`
        : 'They will lose access to this space.',
    });
    if (!ok) return;
    const { error } = await supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', m.user_id);
    if (error) return toast(error.message, 'error');
    toast(`${nm} removed`, 'success'); reload(); refreshHouseholds();
  };

  const leaveOrDelete = async () => {
    const ok = await confirm(isOwner
      ? { title: 'Delete space?', message: 'Every entry in this space will be permanently deleted for everyone.', confirmLabel: 'Delete', destructive: true }
      : {
        title: 'Leave space?', confirmLabel: 'Leave', destructive: true,
        message: Math.abs(myNet) >= 0.005
          ? `You still ${myNet > 0 ? 'are owed' : 'owe'} ${money(Math.abs(myNet), cur)}. Your balance stays visible to the others.`
          : 'You can rejoin later with an invite code.',
      });
    if (!ok) return;
    const { error } = isOwner
      ? await supabase.from('groups').delete().eq('id', group.id)
      : await supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', me);
    if (error) return toast(error.message, 'error');
    toast(isOwner ? 'Space deleted' : 'You left the space', 'success');
    await refreshHouseholds();
    router.replace('/settings');
  };

  const since = (d?: string | null) => (d ? `Joined ${new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Member');

  return (
    <Screen>
      <View style={[s.row, { gap: S.md, paddingHorizontal: S.xl, paddingTop: S.md, paddingBottom: S.md }]}>
        <BackButton onPress={back} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.5 }} numberOfLines={2}>{group.emoji} {group.name}</Text>
          <Text style={[T.body, { color: C.sub }]}>{cur}</Text>
        </View>
        {isAdmin && <IconButton icon="pencil" label="Rename space" size={44} onPress={() => setRename(true)} />}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.xl, paddingBottom: 48, gap: S.xl }}>
        <View style={[s.row, { gap: S.md }]}>
          {isActive ? (
            <>
              <Badge label="Current" tone="primary" />
              <Text style={[T.body, { color: C.sub, flex: 1, fontSize: 14 }]}>Overview, Activity and new expenses use this space.</Text>
            </>
          ) : (
            <Button title="Make this my current space" icon="checkmark-circle-outline" variant="secondary" style={{ flex: 1 }}
              onPress={() => { setActive(group.id); toast(`${group.name} is now your current space`, 'success'); }} />
          )}
        </View>

        <Section title={`People · ${members.length}`}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {members.map((m, i) => (
              <View key={m.user_id}>
                {i > 0 && <Divider />}
                <View style={[s.row, { gap: S.md, padding: S.lg }]}>
                  <Avatar name={displayName(m)} size={48} />
                  <View style={{ flex: 1 }}>
                    <Text style={[T.heading, { fontSize: 17 }]} numberOfLines={1}>
                      {displayName(m)}{m.user_id === me ? <Text style={{ color: C.sub, fontWeight: '500' }}> (you)</Text> : null}
                    </Text>
                    <Text style={[T.body, { color: C.sub, fontSize: 14 }]}>{since(m.joined_at)}</Text>
                  </View>
                  {m.role !== 'member' && <Badge label={m.role === 'owner' ? 'Owner' : 'Admin'} tone="warn" />}
                  {isOwner && m.user_id !== me && (
                    <Pressable onPress={() => remove(m)} accessibilityLabel={`Remove ${displayName(m)}`}
                      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.negativeSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person-remove-outline" size={20} color={C.negative} />
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
            {invites.map((inv) => (
              <View key={inv.id}>
                <Divider />
                <View style={[s.row, { gap: S.md, padding: S.lg }]}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="mail-outline" size={20} color={C.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{inv.email}</Text>
                    <Text style={[T.body, { color: C.sub, fontSize: 14 }]}>Invitation pending</Text>
                  </View>
                  {isAdmin && (
                    <Pressable hitSlop={10} accessibilityLabel={`Revoke invite for ${inv.email}`}
                      onPress={async () => { await supabase.from('invites').delete().eq('id', inv.id); toast('Invite revoked'); reload(); }}>
                      <Ionicons name="close-circle-outline" size={24} color={C.muted} />
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
            <Divider />
            <ListRow icon="person-add-outline" tint={C.accent} title="Add people" subtitle="Share a code or send an email invite"
              onPress={() => setInvite(true)} />
          </Card>
        </Section>

        <Section title="Space">
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <ListRow icon="cash-outline" tint={C.positive} title="Currency"
              subtitle={isAdmin ? `${cur} · tap to change` : `${cur} · only the owner or an admin can change it`}
              onPress={isAdmin ? () => setCurrencyOpen(true) : undefined} />
            <Divider />
            <ListRow icon="flag-outline" tint={C.warn} title="Budgets"
              subtitle={Number(group.monthly_budget) > 0 ? `${money(Number(group.monthly_budget), cur)} a month${catBudgets.length ? ` · ${catBudgets.length} category limit${catBudgets.length === 1 ? '' : 's'}` : ''}` : 'Set monthly and category limits'}
              onPress={() => open('/budgets')} />
            <Divider />
            <ListRow icon="repeat" tint={C.primary} title="Recurring"
              subtitle={recurring.filter((r) => r.active).length ? `${recurring.filter((r) => r.active).length} active · logged automatically` : 'Rent, subscriptions, insurance'}
              onPress={() => open('/recurring')} />
            <Divider />
            <ListRow icon="pricetags-outline" tint="#8A63D2" title="Categories"
              subtitle={categories.length ? `${categories.length} custom + built-in` : 'Add your own, e.g. Pets or Kids'}
              onPress={() => open('/categories')} />
            <Divider />
            <ListRow icon="swap-horizontal" tint={C.positive} title="Balances"
              subtitle={unsettled === 0 ? 'Everyone is even' : Math.abs(myNet) < 0.005 ? "You're even · others aren't yet"
                : myNet > 0 ? `You're owed ${money(myNet, cur)}` : `You owe ${money(-myNet, cur)}`}
              onPress={() => { setActive(group.id); router.push('/balances'); }} />
            <Divider />
            <ListRow icon="download-outline" tint="#3B82F6" title="Download CSV" subtitle="Every entry in this space, for your records"
              onPress={() => exportCsv(`${group.name}-expenses.csv`, expenses, cur, nameOf)} />
          </Card>
        </Section>

        <Section title="Danger zone">
          <Button title={isOwner ? 'Delete space' : 'Leave space'} icon={isOwner ? 'trash-outline' : 'exit-outline'}
            variant="danger" onPress={leaveOrDelete} />
        </Section>
      </ScrollView>

      <InviteSheet visible={invite} onClose={() => setInvite(false)} groupId={group.id} groupName={group.name}
        code={group.invite_code} me={me} memberEmails={members.map((m) => m.profiles?.email?.toLowerCase() ?? '')} onSent={reload} />
      <CurrencySheet visible={currencyOpen} onClose={() => setCurrencyOpen(false)} groupId={group.id} current={cur}
        onSaved={() => { reload(); refreshHouseholds(); if (activeId === group.id) active.reload(); }} />
      <RenameSheet visible={rename} onClose={() => setRename(false)} groupId={group.id} initial={group.name}
        onSaved={() => { reload(); refreshHouseholds(); }} />
    </Screen>
  );
}

function InviteSheet({ visible, onClose, groupId, groupName, code, me, memberEmails, onSent }: {
  visible: boolean; onClose: () => void; groupId: string; groupName: string; code: string; me: string;
  memberEmails: string[]; onSent: () => void;
}) {
  const { toast } = useFeedback();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Share a one-tap link; the code is in the message too for typing in by hand.
  const share = async () => {
    const link = inviteLink(code);
    const text = `Join "${groupName}" on Budgetly: ${link} (or enter code ${code})`;
    if (Platform.OS === 'web') {
      try { await navigator.clipboard.writeText(link); setMsg('Invite link copied'); } catch { setMsg(link); }
    } else Share.share({ message: text });
  };
  const send = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setErr('Enter a valid email address');
    if (memberEmails.includes(e)) return setErr('Already a member');
    setBusy(true);
    const { error } = await supabase.from('invites')
      .upsert({ group_id: groupId, email: e, invited_by: me, status: 'pending' }, { onConflict: 'group_id,email' });
    setBusy(false);
    if (error) return setErr(error.message);
    setEmail(''); toast(`Invite sent to ${e}`, 'success'); onSent(); onClose();
  };

  return (
    <Sheet visible={visible} onClose={() => { setMsg(null); setErr(null); onClose(); }} title="Add people">
      <Press onPress={share} accessibilityLabel="Share invite code"
        style={[s.row, { padding: S.lg, borderRadius: R.lg, backgroundColor: C.primarySoft, gap: S.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={T.label}>Invite code</Text>
          <Text style={{ color: C.primary, fontSize: 28, fontWeight: '800', letterSpacing: 4 }}>{code}</Text>
        </View>
        <View style={[s.row, { gap: 6 }]}>
          <Ionicons name={Platform.OS === 'web' ? 'copy-outline' : 'share-outline'} size={20} color={C.primary} />
          <Text style={{ color: C.primary, fontWeight: '700' }}>{Platform.OS === 'web' ? 'Copy link' : 'Share link'}</Text>
        </View>
      </Press>
      {msg && <Text style={{ color: C.positive, fontWeight: '600' }}>✓ {msg}</Text>}
      <View style={[s.row, { gap: S.md }]}>
        <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
        <Text style={T.caption}>or invite by email</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
      </View>
      <Field icon="mail-outline" placeholder="friend@email.com" autoCapitalize="none" keyboardType="email-address"
        value={email} error={err} onChangeText={(t) => { setEmail(t); setErr(null); }} onSubmitEditing={send} />
      <Button title="Send invite" icon="paper-plane-outline" loading={busy} onPress={send} />
      <Text style={T.caption}>They'll find it under Settings › Waiting for you after signing in with that email.</Text>
    </Sheet>
  );
}

function RenameSheet({ visible, onClose, groupId, initial, onSaved }: {
  visible: boolean; onClose: () => void; groupId: string; initial: string; onSaved: () => void;
}) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!v.trim()) return setErr('Enter a name');
    setBusy(true);
    const { error } = await supabase.from('groups').update({ name: v.trim() }).eq('id', groupId);
    setBusy(false);
    if (error) return setErr(error.message);
    onSaved(); onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Rename space" footer={<Button title="Save" loading={busy} onPress={save} />}>
      <Field defaultValue={initial} onChangeText={(t) => { setV(t); setErr(null); }} autoFocus error={err} onSubmitEditing={save} maxLength={40} />
    </Sheet>
  );
}

function CurrencySheet({ visible, onClose, groupId, current, onSaved }: {
  visible: boolean; onClose: () => void; groupId: string; current: string; onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const [v, setV] = useState(current);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setV(current); setErr(null); } }, [visible, current]); // start fresh each time it opens
  const save = async () => {
    if (v === current) return onClose();
    setBusy(true);
    const { error } = await supabase.from('groups').update({ currency: v }).eq('id', groupId);
    setBusy(false);
    if (error) return setErr(error.message);
    onSaved(); onClose(); toast(`Currency changed to ${v}`, 'success');
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Currency" footer={<Button title="Save" loading={busy} onPress={save} />}>
      <View style={{ gap: S.lg }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
          {CURRENCIES.map((c) => <Chip key={c} label={c} active={v === c} onPress={() => { setV(c); setErr(null); }} />)}
        </View>
        <View style={[s.row, { gap: S.sm, alignItems: 'flex-start', padding: S.md, borderRadius: R.md, backgroundColor: C.surface2 }]}>
          <Ionicons name="information-circle-outline" size={18} color={C.sub} />
          <Text style={[T.caption, { flex: 1 }]}>
            Amounts are not converted. {money(100, current)} becomes {money(100, v)}. Change it when the space was set up with the wrong currency.
          </Text>
        </View>
        {err && <Text style={{ color: C.negative }}>{err}</Text>}
      </View>
    </Sheet>
  );
}
