# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview
Budgetly is a shared budget tracker: Expo SDK 52 (React Native + Expo Router 4, new architecture) running on web, Android and iOS from one codebase, with a Supabase backend (Auth, Postgres + RLS, Realtime). There is no custom server. All data access goes from the client straight to Supabase, so **authorization lives in the RLS policies and RPCs**, not in app code.

## Commands
```bash
npm run web | android | ios   # dev server (expo start)
npm run build:web             # static export to dist/ (what Vercel runs)
npm run typecheck             # tsc --noEmit
npm test                      # node --test "tests/*.test.ts" (Node 22.18+/24 runs TS natively)
node --test --test-name-pattern="simplifyDebts" "tests/*.test.ts"   # run one test group

npm run test:rls              # read-only RLS check against the linked project (needs MEMBER_/OUTSIDER_ EMAIL+PASSWORD env)

npm run db:start / db:stop    # local Supabase (Docker)
npm run db:reset              # re-apply all migrations locally
npx supabase migration new <name>
npm run db:push               # push migrations to linked remote project
npm run db:types              # regenerate lib/database.types.ts from remote
```
Environment: `.env` / `.env.local` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`). These are inlined at build time.

## Architecture
- **Routing / auth gate**: `app/_layout.tsx` wraps everything in `AuthProvider` (`lib/auth.tsx`, which exposes `useAuth()` → `{session, loading}`). `Gate` redirects based on route group: unauthenticated users go to `(auth)/login`, authenticated users go to `(app)/`. Screens live under `app/(app)/` (home, `new-group` modal, `group/[id]` dashboard).
- **Supabase client**: `lib/supabase.ts` is the single client. It uses AsyncStorage on native and default storage + `detectSessionInUrl` on web. Hand-written row types (`Group`, `Expense`, `Member`, `Invite`) live here. `lib/database.types.ts` holds the generated types.
- **Navigation**: `app/(app)/(tabs)/` holds four tabs: Overview (`index`), Activity (`?m=YYYY-MM`), Insights and Balances. The tab bar has a floating "New expense" button above it on Overview and Activity. Every tab uses `components/SpaceHeader.tsx` (space switcher plus an avatar that opens Settings). Stack screens above the tabs are `settings` (account, appearance, your spaces, pending invites), `group/[id]` (space settings: people, budget, export, leave/delete) and `new-group` (a modal).
- **Vocabulary**: in the UI a `group` is a **space**. Use "space", "Balances", "Available", "Latest", "New space" and "Have a code?". Don't use "household" in UI copy (code identifiers like `useHousehold` stay as they are).
- **Active household**: `lib/household.tsx` (`useHousehold()`) holds the user's households, pending invites and the active household id (saved in AsyncStorage). It loads the active household's data once through `useGroup`, together with its balances. Home, Stats, Expenses and the global add/edit `TransactionSheet` all read from it. The sheet is opened with `openAdd(expense?)` and rendered once in the tabs layout. Every `useGroup` call gets its own uniquely named realtime channel.
- **Group data**: `lib/useGroup.ts` loads a group's transactions, members and invites and keeps them live through a Realtime channel. `app/(app)/group/[id].tsx` is a thin orchestrator. It computes the monthly stats and owns month navigation. Its tab bodies and the add/edit `TransactionSheet` live in `components/group/`.
- **Design system**: `lib/theme.ts` holds the tokens: colors `C`, spacing `S`, radii `R`, type `T`, `CATEGORIES`, plus local-time date helpers (`ymd`, `monthRange`). Use those helpers rather than `toISOString()`, because `spent_at` is a plain DATE. `components/ui.tsx` holds the primitives (Screen, Header, Card, Button, Field, Segmented, Sheet, etc.). The palette is blue with flat colors and no gradients, in light and dark variants.
- **Light/dark mode**: `lib/themeMode.tsx` (`useThemeMode()`) stores the System/Light/Dark preference in AsyncStorage. It calls `applyScheme()` on every render, which updates the shared `C` object in place, and it keys the subtree by scheme so everything re-renders after a switch. To keep this working: read colors from `C` at render time. Never capture a color in a module-level constant or `StyleSheet.create`, because it would stay on the old palette. Shared style objects (`s` in `components/ui.tsx`, `T`, and the feedback styles) use getters for this reason. Use `C.shadow`/`C.shadowOpacity` for shadows. Import with the `@/` path alias.
- **Feedback**: use `useFeedback()` from `lib/feedback.tsx` for `toast()` and `await confirm()`. Never use `Alert` or `window.alert`. The provider is mounted in `app/_layout.tsx`.
- **Who owes whom**: each expense has a `paid_by` and rows in `expense_splits` (the shares, which must add up to the amount). `is_personal` expenses count in stats but not in balances. Repayments go in `settlements`. Write expenses only through the `save_expense` RPC, which validates and writes the expense and its splits together. Splits have no write policies. Balance math lives in `lib/balances.ts` as pure functions working in integer cents: `computeBalances`, `simplifyDebts` and `splitCents`. Balances are all-time, not month-scoped. An expense with no splits (written by an old client) counts as an equal split among current members.
- **Testable logic stays pure**: `lib/balances.ts` and `lib/alerts.ts` must not import React Native (use `import type` only) so `npm test` can run them in plain Node. CI (`.github/workflows/ci.yml`) runs the type check, the tests and a web build on every push and pull request.
- **Typography**: import `Text`/`TextInput` from `@/components/Typography`, not from `react-native`. The wrapper maps `fontWeight` to the matching Inter file, because custom fonts ignore `fontWeight` on native. Fonts load in `ThemeProvider`.
- **Light/dark without remount**: every route, layout and global overlay calls `useThemeMode()` so a theme change re-renders it in place. Add that call to new screens.
- **Space features**: recurring rules (`recurring_expenses`) are materialised server-side by the `run_recurring` RPC, which `useGroup` calls when a space opens. Per-category limits live in `category_budgets`. In-app budget alerts come from `budgetAlerts()` in `HouseholdProvider` (a toast fires when a limit crosses 80% or 100%). Custom categories (`categories`) are merged into `catMeta()`/`allCategories()` via `setCustomCategories`, and they render an emoji. Receipts (removed from storage once the delete-Undo window closes) are stored in the private storage bucket `receipts/<group_id>/<expense_id>.jpg` and shown through signed URLs. `reset_balances` is the owner-only "Start fresh".
- **Invite links**: `/join/<code>` (web) and `budgetly://join/<code>` (apps) park the code with `lib/links.ts`. `HouseholdProvider` redeems it after sign-in.
- Group totals are kept per currency. Never add amounts across groups that use different currencies.

## Database (supabase/migrations)
Tables: `profiles`, `groups`, `group_members` (role: owner/admin/member), `invites`, `expenses` (`type` is `expense` or `income`), `expense_splits`, `settlements`, `recurring_expenses`, `category_budgets`, `categories`. Plus the storage bucket `receipts`.
- Row types in `lib/supabase.ts` derive from the generated `lib/database.types.ts`, and the client is `createClient<Database>`. Regenerate the types after every migration.
- `is_member(group_id)` and `is_admin(group_id)` are `security definer` helpers that RLS policies use to avoid recursive policy evaluation. Reuse it in new policies.
- Triggers: a new `auth.users` row creates a `profiles` row, and a new `groups` row inserts the owner into `group_members`.
- RPCs called from the client: `join_group_by_code`, `respond_invite`, `save_expense`, `run_recurring` and `reset_balances`. Membership joins go through these, not direct inserts.
- Schema changes go in a new migration file. Never edit applied migrations. Run `db:types` after changing the schema.

## Deployment
Web deploys to Vercel (`vercel.json`: expo web export → `dist/`, SPA rewrite to `/index.html`). Native builds use EAS (`npx eas build -p android|ios`). App identifier: `com.aravind9643.budgetly` (iOS and Android).
