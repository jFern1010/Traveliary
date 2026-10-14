# Traveliary

A travel diary built from photos. Photos are taken in the app, tied to the GPS place where they were taken, and posted publicly after the user consents. There are no profiles in v1.

@AGENTS.md

## Stack
- **App:** Expo SDK 57 (managed, never eject) + React Native + TypeScript (strict) + Expo Router (native tabs).
- **Target:** iOS via **Expo Go on a physical iPhone**. The developer uses Windows with no Mac, so there's no simulator. Android comes later.
- **Only Expo Go-compatible libraries.** Anything that needs a development build is a big architecture change, so ask first.
- **Backend:** Supabase free tier (Postgres + PostGIS, Storage, anonymous auth, Edge Functions). Added in M2.
- **Server data:** TanStack Query (persisted to AsyncStorage). **Offline upload queue:** expo-sqlite + expo-file-system + NetInfo (M4).
- **Push:** expo-notifications + Expo Push Service, sent from a Supabase Edge Function (M5).

## Layout
- `src/app/` holds routes only.
  - `(tabs)/` contains `index` (Explore), `capture` (Camera) and `mine` (My Trips).
  - Pushed screens sit beside it: `place/[placeId]`, `photo/[photoId]`, `capture/preview`.
  - `dev/` holds temporary developer screens.
- `src/features/<feature>/` holds the logic and API calls for each feature: `capture`, `places`, `photos`, `uploadQueue`, `notifications`, `moderation`.
- `src/components/` holds shared UI. `src/constants/theme.ts` holds colors and spacing. `src/lib/` holds clients (supabase, queryClient, env).
- `supabase/migrations/` holds SQL migrations and `supabase/functions/` holds Edge Functions.
- `__tests__/` holds Jest unit tests. Import with the `@/` path alias, which maps to `src/`.

## Conventions
- **Server calls** go only through `src/features/*/api.ts`. Screens never call Supabase directly.
- **Database changes** go only through a new migration file, never by hand-editing the dashboard.
- **Privacy:** exact GPS is never exposed to clients. Public reads use the `photos_public` view and place centroids.
- **Consent:** nothing is uploaded until the user taps "Post publicly".
- **Styling:** use `ThemedText` / `ThemedView` and `Spacing` / `Colors`. No hard-coded colors except brand accents.
- **Pure logic** (formatting, queue state machine, ID resolution) goes in plain `.ts` modules with unit tests. Keep it out of modules that import native packages.
- **Dependencies:** install with `npx expo install <pkg>`, and only those approved in the plan. Ask before adding any others.
- **Commits:** small, imperative messages (`Add camera permission screen`), one concern per commit.

## Commands
```bash
npm start              # npx expo start: scan the QR code with the iPhone Camera app to open in Expo Go
npx expo start --tunnel # if the phone can't reach the PC over Wi-Fi
npm test               # Jest (jest-expo preset)
npm run typecheck      # tsc --noEmit
npm run lint           # expo lint
npx expo-doctor        # dependency/config health
npx eas-cli@latest init # one time: links the project to Expo (adds projectId, needed for push tokens)

# Supabase (hosted project; no Docker needed)
npx supabase@latest login                          # one time, opens the browser
npx supabase@latest link --project-ref <ref>       # one time, asks for the database password
npx supabase@latest db push                        # apply new files in supabase/migrations
```

## Backend setup
- `.env.local` (gitignored) holds `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. See `.env.example`.
- Dashboard → Authentication → Sign In / Providers → **Allow anonymous sign-ins** must be on.
- Clients never touch `photos` directly:
  - Reads go through the `photos_public` view.
  - Writes go through the `create_photo` / `delete_my_photo` RPCs.
  - Storage files live at `photos/<uid>/<photoId>.jpg` and `_thumb.jpg`.
- Photo IDs are generated on the phone (`draft.id`) so retrying a post never duplicates it.
Before a milestone is called done, run `npm run typecheck && npm run lint && npm test`.

## Known quirks
- Expo Go on iOS logs a yellow warning about Android push being removed from Expo Go. On iOS it's only a warning, and remote push still works.
- Expo Go can't upload reliably in the background. Queued uploads are sent while the app is open.
