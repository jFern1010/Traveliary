# Traveliary

A travel diary built from photos. Photos are taken in the app, tied to the GPS place where they were taken, and posted publicly after the user consents. There are no profiles in v1.

@AGENTS.md

## Stack
- **App:** Expo SDK 57 (managed, never eject) + React Native + TypeScript (strict) + Expo Router (native tabs).
- **Target:** iOS via **Expo Go on a physical iPhone**. The developer uses Windows with no Mac, so there's no simulator. Android comes later.
- **Only Expo Go-compatible libraries.** Anything that needs a development build is a big architecture change, so ask first.
- **Backend:** Supabase free tier (Postgres + PostGIS, Storage, anonymous auth, Edge Functions). Added in M2.
- **Server data:** TanStack Query, persisted to AsyncStorage for 7 days so viewed places work offline. NetInfo drives `onlineManager`, so queries pause while offline.
- **Posting:** "Post publicly" only enqueues (expo-sqlite row + files in the documents folder). The queue runner in `features/upload-queue/queue.ts` uploads in the background with backoff and wakes on reconnect, app foreground and timers.
- **Push:** expo-notifications + Expo Push Service, sent from a Supabase Edge Function (M5).

## Layout
- `src/app/` holds routes only.
  - `(tabs)/` contains `index` (Explore), `capture` (Camera) and `mine` (My Trips).
  - Pushed screens sit beside it: `place/[placeId]`, `photo/[photoId]`, `capture/preview`.
  - `dev/` holds temporary developer screens.
- `src/features/<feature>/` holds the logic and API calls for each feature: `capture`, `places`, `photos`, `upload-queue`, `notifications`, `moderation`, `dev`.
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

## Push notifications
- **Flow:** `photos` INSERT → trigger `notify_new_photo` (pg_net; URL + secret in Vault as `notify_new_photo_url` / `notify_new_photo_secret`) → Edge Function `notify-new-photo` → `claim_push_recipients` (picks other posters at that place and throttles to 1 per hour per place) → Expo Push API.
- **Edge Function:**
  - It runs on Deno. `supabase/functions/**/index.ts` is excluded from tsc and ESLint.
  - Pure helpers live in `messages.ts` and are tested with Jest.
  - Deploy: `npx supabase@latest functions deploy notify-new-photo --no-verify-jwt --use-api`.
  - Requests are authenticated by the `WEBHOOK_SECRET` function secret, which the trigger sends as the `x-webhook-secret` header (from Vault).
- **App:**
  - Notifications are offered after the first successful upload (`offerNotificationsOnce`).
  - The token is re-synced at launch if already allowed.
  - Tapping a notification opens `place/[placeId]`.
- **Single-phone testing:** My Trips → Developer tools → Simulate a visitor.
Before a milestone is called done, run `npm run typecheck && npm run lint && npm test`.

## Known quirks
- Expo Go on iOS logs a yellow warning about Android push being removed from Expo Go. On iOS it's only a warning, and remote push still works.
- Expo Go can't upload reliably in the background. Queued uploads are sent while the app is open.

## Moderation & maintenance
- **Reports:** `report_photo` hides a photo for the reporter immediately, and for everyone at 3 reports (`status = 'hidden'`).
  - Authors still see their own hidden photos, marked "Hidden".
  - Place stats count visible photos only (`refresh_place_stats`).
- **Orphaned files:** the `cleanup-orphans` Edge Function deletes storage files older than 1 day that have no photo row. It uses the same `x-webhook-secret` header as `notify-new-photo`. Run it manually:
  `curl.exe -X POST https://<ref>.supabase.co/functions/v1/cleanup-orphans -H "x-webhook-secret: <secret>"`
- **Onboarding:** shown once on first launch (`features/onboarding`). Developer tools are only linked in `__DEV__` builds.
- **Known gap before an App Store release:** Apple's guideline 1.2 also requires a way to block abusive users. Anonymous users make that a design question for when profiles arrive.

## Beta distribution
- **iPhone testers:** use Expo Go plus EAS Update.
  - Each tester needs their own Expo account, invited to the `jferns-team` organization (Viewer role works).
  - They open `exp://u.expo.dev/24f204a2-6e3e-4fff-8c0a-3ce8a3c3a3f0?channel-name=expo-go&runtime-version=exposdk:57.0.0`
- **Publish a new beta version:**
  `EXPO_GO_UPDATE=1 npx eas-cli@latest update --channel expo-go --platform ios --environment preview --message "<what changed>"`
- **Keys used:** the update uses the Supabase URL and key stored in the EAS **preview** environment (`eas env:list preview`), not `.env.local`.
- **Plan:** see `docs/beta-plan.md`.

## Safety, legal & account (beta B1)
- **Blocks:**
  - `block_photo_author` blocks the anonymous author of a photo; the app never learns who it is.
  - Blocked authors are excluded from `photos_public`, from map and nearby counts (computed per viewer in `places_in_bounds` / `places_near`), and from pushes (`claim_push_recipients`).
  - "Unblock all" is on the About screen.
- **Delete my data:**
  - About → Delete calls the `delete-account` Edge Function (deploy with `--no-verify-jwt --use-api`; it checks the user's JWT itself).
  - The function calls `delete_user_data` (service role only), removes the user's storage folder, then deletes the auth user.
  - The app then clears its session, query cache and upload queue.
- **Legal:**
  - Terms and Privacy texts live in `src/features/legal/content.ts`, with contact details in `src/constants/app-info.ts`.
  - Onboarding requires "Agree & continue"; acceptance is stored per `LEGAL_VERSION`. Bump it when the texts change materially.

## Release setup (beta B2)
- **Identity:** iOS bundle ID and Android package are `com.lyf.traveliary`. They can never change after release.
  - `version` in `app.json` is the user-facing version (0.9.0 = beta).
  - Build numbers are managed remotely by EAS (`appVersionSource: remote`, `autoIncrement` for production).
- **Icons:** generated from `assets/brand/logo-source.png` by `node scripts/make-icons.js assets/brand/logo-source.png assets/images`.
  - iOS icon is opaque, full-bleed.
  - Android adaptive icon is the tile on a cream (`#FEF9EF`) background.
  - The splash screen uses the same cream.
- **`eas.json` profiles:**
  - `preview`: internal distribution, Android APK, channel `preview`, EAS env `preview`.
  - `production`: store builds, channel `production`, EAS env `production`.
- **Runtime version:** builds use `appVersion`. Expo Go updates use `exposdk:57.0.0` via `EXPO_GO_UPDATE=1` (see `app.config.js`).
- **App Store settings:** `ITSAppUsesNonExemptEncryption: false` (no export-compliance prompt). `supportsTablet: false` (iPhone only, so no iPad screenshots are needed).

## Android (beta B3)
- **Push:** Firebase project `traveliary-b4e64`. `google-services.json` is committed (public identifiers only). The FCM V1 service account key is uploaded to EAS credentials, never committed (`*firebase-adminsdk*.json` is gitignored).
  - Pushes use the Android channel `new-photos`, created in `register.ts` and named in `messages.ts`. Keep both names in sync.
- **Maps:** the Google Maps key is the EAS env var `GOOGLE_MAPS_ANDROID_API_KEY` (sensitive; preview + production), injected by `app.config.js`.
  - It's restricted to `com.lyf.traveliary`, the EAS keystore SHA-1, and Maps SDK for Android only.
  - Adding the Play Store app-signing SHA-1 is required when publishing to Play.
  - The Google Cloud project has billing (Blaze) with a budget alert.
- **Icons:** always use `<Icon name=…>` (`src/components/icon.tsx`). Plain SF Symbol names render nothing on Android.
- **Android limits:** alerts show at most 3 buttons (use `OptionSheet`). Tab screens without a header need `insets.top` on Android (no `contentInsetAdjustmentBehavior`).
- **Build an APK:** `npx eas-cli@latest build --platform android --profile preview`. Installed APKs receive JS-only fixes via `eas update --channel preview --environment preview`.

## Supabase projects (beta B4)
| Project | Ref | Used by |
|---|---|---|
| test | `uigltnpigjgpvlwakwnw` | local `npm start` (`.env.local`), developer tools, experiments |
| **prod** | `nxsckznbmcmhlxsxxwsn` | beta testers: EAS env `preview` + `production` → APK (channel `preview`) and Expo Go (channel `expo-go`) |

- **Linked project:** the Supabase CLI applies to whichever project is linked (`npx supabase@latest link --project-ref <ref>`). Every migration and function deploy must be applied to **both** projects. Check the linked ref before `db push`.
- **Separate secrets:** each project has its own `WEBHOOK_SECRET` function secret and Vault secrets (`notify_new_photo_url`, `notify_new_photo_secret`).

## Running the beta (B5)
- **Tester guide:** `docs/beta/tester-guide.md`. **Feedback form questions:** `docs/beta/feedback-form.md`.
- **Metrics:** `supabase/queries/beta-metrics.sql`. **Moderation:** `supabase/queries/moderation.sql` + `docs/beta/moderation.md` (twice a week). Both run in the **prod** SQL Editor.
- **Release a fix to testers:**
  1. Run the checks (`npm run typecheck && npm run lint && npm test`).
  2. Publish to **both** channels:
     - `npx eas-cli@latest update --channel preview --platform android --environment preview --message "…"`
     - `EXPO_GO_UPDATE=1 npx eas-cli@latest update --channel expo-go --platform ios --environment preview --message "…"`
- **Rebuild the APK** (instead of only updating) when native code, config, or **EAS env values** change. A fresh install runs the bundle embedded at build time until an update is applied.
