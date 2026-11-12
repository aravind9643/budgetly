# Budgetly: shared budget tracker

This app runs on web, Android and iOS from one codebase. It's built with Expo (React Native + Expo Router), Reanimated animations and a Supabase backend.

## Features
- Sign up and sign in with email and password through Supabase Auth.
- Multiple groups, each with its own emoji, currency and monthly budget.
- Three ways to invite people:
  - Invite by **email**. The invitee sees Accept or Decline on their home screen.
  - Share an **invite code**. Anyone with the code joins from the home screen.
  - Pending invites are listed, and admins can revoke them.
- Track both expenses and income, with categories. The overview tab breaks spending down by category and by member.
- Members have roles: owner, admin or member. The owner can remove members or delete the group. Other members can leave.
- Updates arrive in real time over Supabase Realtime.
- The UI uses a dark glassmorphism style: animated gradient blobs, spring press animations, staggered list entry, animated progress bars, a bottom-sheet modal and haptics on mobile.

## Setup
1. Apply the database with the Supabase CLI. The migrations in [supabase/migrations](supabase/migrations) create the tables, Row Level Security policies, triggers and RPCs.
   - Cloud: `npx supabase login`, then `npm run db:link -- --project-ref <ref>` and `npm run db:push`.
   - Local (needs Docker): `npm run db:start`. It prints a local API URL and anon key to put in `.env`. `npm run db:reset` re-applies the migrations.
   - New schema change: `npx supabase migration new <name>`, edit the file, then `npm run db:push`.
2. Copy `.env.example` to `.env` and fill in your project URL and anon key (Project Settings → API).
3. Optional: to make sign-up faster while testing, turn off "Confirm email" under Auth → Providers → Email.
4. Install and run:
   ```bash
   npm install
   npm run web       # browser
   npm run android   # Android emulator or the Expo Go app
   npm run ios       # iOS simulator (macOS) or the Expo Go app
   ```

## Production builds
- Web: `npm run build:web` writes a static site to `dist/`. You can deploy it to Vercel, Netlify or another static host.
- Android and iOS: `npx eas build -p android` and `npx eas build -p ios` (requires `npm i -g eas-cli`). Before building, change `bundleIdentifier` and `package` in `app.json`.

## Structure
```
app/_layout.tsx          auth gate + providers
app/(auth)/login.tsx     sign in / sign up
app/(app)/index.tsx      groups, pending invites, join by code
app/(app)/new-group.tsx  create group modal
app/(app)/group/[id].tsx dashboard, activity, members & invites, add sheet
components/ui.tsx        animated UI kit
lib/                     supabase client, auth context, theme
supabase/schema.sql      database schema + RLS
```
