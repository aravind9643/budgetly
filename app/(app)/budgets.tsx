import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/Typography';
import { BackButton } from '@/components/Nav';
import { Button, Card, Divider, Field, IconTile, ProgressBar, Screen, Section, s } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useFeedback } from '@/lib/feedback';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { allCategories, C, money, monthRange, R, S, T } from '@/lib/theme';
import { useThemeMode } from '@/lib/themeMode';

/** Overall monthly budget plus optional per-category limits for the current space. Owners/admins edit. */
export default function BudgetsScreen() {
  useThemeMode(); // re-render this screen when light/dark changes
  const router = useRouter();
  const { session } = useAuth();
  const { toast } = useFeedback();
  const { data, refreshHouseholds } = useHousehold();
  const me = session?.user.id ?? '';
  const g = data.group;
  const cur = g?.currency ?? 'USD';
  const canEdit = g?.owner_id === me || data.members.find((m) => m.user_id === me)?.role === 'admin';

  const [overall, setOverall] = useState('');
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setOverall(g?.monthly_budget ? String(g.monthly_budget) : '');
    setLimits(Object.fromEntries(data.catBudgets.map((b) => [b.category, String(b.amount)])));
  }, [g?.monthly_budget, data.catBudgets]);

  const spentBy = useMemo(() => {
    const { start, end } = monthRange(new Date());
    return data.expenses.filter((e) => e.type === 'expense' && e.spent_at >= start && e.spent_at <= end)
      .reduce<Record<string, number>>((a, e) => { a[e.category] = (a[e.category] ?? 0) + Number(e.amount); return a; }, {});
  }, [data.expenses]);
  const totalSpent = Object.values(spentBy).reduce((a, b) => a + b, 0);

  const save = async () => {
    if (!g) return;
    setBusy(true);
    const upserts = Object.entries(limits).filter(([, v]) => Number(v) > 0).map(([category, v]) => ({ group_id: g.id, category, amount: Number(v) }));
    const removed = data.catBudgets.filter((b) => !(Number(limits[b.category]) > 0)).map((b) => b.category);
    const results = await Promise.all([
      supabase.from('groups').update({ monthly_budget: Number(overall) || 0 }).eq('id', g.id),
      upserts.length ? supabase.from('category_budgets').upsert(upserts) : Promise.resolve({ error: null }),
      removed.length ? supabase.from('category_budgets').delete().eq('group_id', g.id).in('category', removed) : Promise.resolve({ error: null }),
    ]);
    setBusy(false);
    const err = results.find((r) => r.error)?.error;
    if (err) return toast(err.message, 'error');
    toast('Budgets saved', 'success'); data.reload(); refreshHouseholds();
  };

  return (
    <Screen>
      <View style={[s.row, { gap: S.md, paddingHorizontal: S.xl, paddingTop: S.md }]}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ flex: 1 }}>
          <Text style={T.caption}>{g?.name}</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.6 }}>Budgets</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: S.xl, gap: S.xl, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {!canEdit && (
          <Card><Text style={[T.body, { color: C.sub }]}>Only the space owner or an admin can change budgets. You can still see progress here.</Text></Card>
        )}
        <Section title="Whole space">
          <Card style={{ gap: S.md }}>
            <Field label="Monthly limit" prefix={cur} keyboardType="decimal-pad" placeholder="No limit" editable={canEdit}
              value={overall} onChangeText={(t) => setOverall(t.replace(/[^0-9.]/g, ''))} />
            {Number(overall) > 0 && (
              <View style={{ gap: 6 }}>
                <ProgressBar value={totalSpent / Number(overall)} />
                <Text style={T.caption}>{money(totalSpent, cur)} of {money(Number(overall), cur)} used this month</Text>
              </View>
            )}
          </Card>
        </Section>

        <Section title="By category">
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {allCategories().map(([k, m], i) => {
              const lim = Number(limits[k]) || 0;
              const sp = spentBy[k] ?? 0;
              return (
                <View key={k}>
                  {i > 0 && <Divider />}
                  <View style={{ padding: S.lg, gap: S.sm }}>
                    <View style={[s.row, { gap: S.md }]}>
                      <IconTile icon={m.icon} color={m.color} emoji={m.emoji} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={[T.body, { fontWeight: '600' }]}>{m.label}</Text>
                        <Text style={T.caption}>{money(sp, cur)} this month</Text>
                      </View>
                      <View style={[s.row, { width: 116, height: 40, borderRadius: R.sm, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2, paddingHorizontal: S.sm }]}>
                        <Text style={T.caption}>{cur}</Text>
                        <TextInput value={limits[k] ?? ''} editable={canEdit} placeholder="No limit" placeholderTextColor={C.muted}
                          keyboardType="decimal-pad" accessibilityLabel={`${m.label} limit`}
                          onChangeText={(t) => setLimits((x) => ({ ...x, [k]: t.replace(/[^0-9.]/g, '') }))}
                          style={{ flex: 1, minWidth: 0, color: C.text, textAlign: 'right', fontSize: 15, outlineStyle: 'none' } as any} />
                      </View>
                    </View>
                    {lim > 0 && <ProgressBar value={sp / lim} height={6} />}
                  </View>
                </View>
              );
            })}
          </Card>
          <Text style={[T.caption, { paddingHorizontal: S.xs }]}>You'll get an alert when a category reaches 80% and 100% of its limit.</Text>
        </Section>
        {canEdit && <Button title="Save budgets" loading={busy} onPress={save} />}
      </ScrollView>
    </Screen>
  );
}
