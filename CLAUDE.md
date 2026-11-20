# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview
Budgetly is a shared budget tracker: Expo SDK 52 (React Native + Expo Router 4, new architecture) running on web, Android and iOS from one codebase, with a Supabase backend (Auth, Postgres + RLS, Realtime). There is no custom server. All data access goes from the client straight to Supabase, so **authorization lives in the RLS policies and RPCs**, not in app code.

## Commands
```bash
npm run web | android | ios   # dev server (expo start)
npm run build:web             # static export to dist/ (what Vercel runs)
npx tsc --noEmit              # type-check (no lint or test setup exists)

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
- **Group data**: `lib/useGroup.ts` loads a group's transactions, members and invites and keeps them live through a Realtime channel. `app/(app)/group/[id].tsx` is a thin orchestrator. It computes the monthly stats and owns month navigation. Its tab bodies and the add/edit `TransactionSheet` live in `components/group/`.
- **Design system**: `lib/theme.ts` holds the tokens: colors `C`, spacing `S`, radii `R`, type `T`, `CATEGORIES`, plus local-time date helpers (`ymd`, `monthRange`). Use those helpers rather than `toISOString()`, because `spent_at` is a plain DATE. `components/ui.tsx` holds the primitives (Screen, Header, Card, Button, Field, Segmented, Sheet, etc.). The app is dark-only. Import with the `@/` path alias.
- **Feedback**: use `useFeedback()` from `lib/feedback.tsx` for `toast()` and `await confirm()`. Never use `Alert` or `window.alert`. The provider is mounted in `app/_layout.tsx`.
- Group totals are kept per currency. Never add amounts across groups that use different currencies.

## Database (supabase/migrations)
Tables: `profiles`, `groups`, `group_members` (role: owner/admin/member), `invites`, `expenses` (`type` is `expense` or `income`).
- `is_member(group_id)` is a `security definer` helper that RLS policies use to avoid recursive policy evaluation. Reuse it in new policies.
- Triggers: a new `auth.users` row creates a `profiles` row, and a new `groups` row inserts the owner into `group_members`.
- RPCs called from the client: `join_group_by_code(code)` and `respond_invite(invite_id, accept)`. Membership joins go through these, not direct inserts.
- Schema changes go in a new migration file. Never edit applied migrations. Run `db:types` after changing the schema.

## Deployment
Web deploys to Vercel (`vercel.json`: expo web export → `dist/`, SPA rewrite to `/index.html`). Native builds use EAS (`npx eas build -p android|ios`). `app.json` still has placeholder `com.example.budgetly` identifiers.
