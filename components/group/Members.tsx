import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, Share, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Avatar, Badge, Button, Card, Divider, Field, Press, Section, s } from '@/components/ui';
import { useFeedback } from '@/lib/feedback';
import { Group, Invite, Member, supabase } from '@/lib/supabase';
import { displayName } from '@/lib/useGroup';
import { C, R, S, T } from '@/lib/theme';

export function Members({ group, members, invites, me, isAdmin, isOwner, reload, onLeft }: {
  group: Group; members: Member[]; invites: Invite[]; me: string; isAdmin: boolean; isOwner: boolean;
  reload: () => void; onLeft: () => void;
}) {
  const { toast, confirm } = useFeedback();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const shareCode = async () => {
    const msg = `Join "${group.name}" on Budgetly with invite code ${group.invite_code}`;
    if (Platform.OS === 'web') {
      try { await navigator.clipboard.writeText(group.invite_code); toast('Invite code copied', 'success'); }
      catch { toast(`Code: ${group.invite_code}`); }
    } else Share.share({ message: msg });
  };

  const invite = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setErr('Enter a valid email address');
    if (members.some((m) => m.profiles?.email?.toLowerCase() === e)) return setErr('Already a member');
    setBusy(true);
    const { error } = await supabase.from('invites')
      .upsert({ group_id: group.id, email: e, invited_by: me, status: 'pending' }, { onConflict: 'group_id,email' });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    setEmail(''); toast(`Invite sent to ${e}`, 'success'); reload();
  };

  const remove = async (m: Member) => {
    const nm = displayName(m);
    if (!(await confirm({ title: `Remove ${nm}?`, message: 'They will lose access to this group.', confirmLabel: 'Remove', destructive: true }))) return;
    const { error } = await supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', m.user_id);
    if (error) return toast(error.message, 'error');
    toast(`${nm} removed`, 'success'); reload();
  };

  const revoke = async (i: Invite) => {
    const { error } = await supabase.from('invites').delete().eq('id', i.id);
    if (error) return toast(error.message, 'error');
    toast('Invite revoked'); reload();
  };

  const leaveOrDelete = async () => {
    const ok = await confirm(isOwner
      ? { title: 'Delete group?', message: 'All transactions will be permanently deleted for every member.', confirmLabel: 'Delete group', destructive: true }
      : { title: 'Leave group?', message: 'You can rejoin later with an invite code.', confirmLabel: 'Leave', destructive: true });
    if (!ok) return;
    const { error } = isOwner
      ? await supabase.from('groups').delete().eq('id', group.id)
      : await supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', me);
    if (error) return toast(error.message, 'error');
    toast(isOwner ? 'Group deleted' : 'You left the group', 'success'); onLeft();
  };

  const roleTone = (r: string) => (r === 'owner' ? 'warn' : r === 'admin' ? 'primary' : 'neutral') as any;

  return (
    <View style={{ gap: S.xl }}>
      <Section title="Invite">
        <Card style={{ gap: S.lg }}>
          <Press onPress={shareCode} accessibilityLabel="Share invite code"
            style={[s.row, { padding: S.lg, borderRadius: R.md, backgroundColor: C.primarySoft, gap: S.md }]}>
            <View style={{ flex: 1 }}>
              <Text style={T.label}>Invite code</Text>
              <Text style={{ color: C.text, fontSize: 24, fontWeight: '800', letterSpacing: 4, fontVariant: ['tabular-nums'] }}>
                {group.invite_code}
              </Text>
            </View>
            <View style={[s.row, { gap: 6 }]}>
              <Ionicons name={Platform.OS === 'web' ? 'copy-outline' : 'share-outline'} size={18} color={C.primary} />
              <Text style={{ color: C.primary, fontWeight: '700' }}>{Platform.OS === 'web' ? 'Copy' : 'Share'}</Text>
            </View>
          </Press>
          <View style={[s.row, { gap: S.md }]}>
            <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            <Text style={T.caption}>or invite by email</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
          </View>
          <View style={[s.row, { gap: S.sm, alignItems: 'flex-start' }]}>
            <Field style={{ flex: 1 } as any} icon="mail-outline" placeholder="friend@email.com" autoCapitalize="none"
              keyboardType="email-address" value={email} error={err}
              onChangeText={(t) => { setEmail(t); setErr(null); }} onSubmitEditing={invite} />
            <Button title="Invite" loading={busy} onPress={invite} />
          </View>
          <Text style={T.caption}>They'll see the invite on their home screen when they sign in with that email.</Text>
        </Card>
      </Section>

      <Section title={`Members · ${members.length}`}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {members.map((m, i) => (
            <Animated.View key={m.user_id} layout={LinearTransition}>
              {i > 0 && <Divider />}
              <View style={[s.row, { gap: S.md, padding: S.lg }]}>
                <Avatar name={displayName(m)} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>
                    {displayName(m)}{m.user_id === me ? <Text style={{ color: C.muted }}> · you</Text> : null}
                  </Text>
                  <Text style={T.caption} numberOfLines={1}>{m.profiles?.email}</Text>
                </View>
                <Badge label={m.role} tone={roleTone(m.role)} />
                {isOwner && m.user_id !== me && (
                  <Pressable hitSlop={10} onPress={() => remove(m)} accessibilityLabel={`Remove ${displayName(m)}`}>
                    <Ionicons name="close-circle-outline" size={22} color={C.muted} />
                  </Pressable>
                )}
              </View>
            </Animated.View>
          ))}
          {invites.map((inv) => (
            <Animated.View key={inv.id} entering={FadeIn} exiting={FadeOut}>
              <Divider />
              <View style={[s.row, { gap: S.md, padding: S.lg }]}>
                <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="mail-outline" size={16} color={C.muted} />
                </View>
                <Text style={[T.body, { flex: 1, color: C.sub }]} numberOfLines={1}>{inv.email}</Text>
                <Badge label="Pending" />
                {isAdmin && (
                  <Pressable hitSlop={10} onPress={() => revoke(inv)} accessibilityLabel={`Revoke invite for ${inv.email}`}>
                    <Ionicons name="close-circle-outline" size={22} color={C.muted} />
                  </Pressable>
                )}
              </View>
            </Animated.View>
          ))}
        </Card>
      </Section>

      <Section title="Danger zone">
        <Button title={isOwner ? 'Delete group' : 'Leave group'} icon={isOwner ? 'trash-outline' : 'exit-outline'}
          variant="danger" onPress={leaveOrDelete} />
      </Section>
    </View>
  );
}
