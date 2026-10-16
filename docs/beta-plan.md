# Traveliary — Private Beta Plan

## Goal
- **Who:** 10–20 friends who travel, using Traveliary for about 2 weeks.
- **What we learn:**
  - Do they post?
  - Do they come back?
  - What confuses them?
  - Do they want profiles?
- **Bonus:** most of the work also covers the store requirements, so the store phase afterwards is short.

**Out of scope:** profiles, likes, comments, redesigns, the App Store and Play Store listings.

---

## How testers get the app

| Testers | Route | Cost | Status |
|---|---|---|---|
| Android | **APK download link** built with EAS Build (internal distribution) | Free | Reliable; the real standalone app |
| iPhone | **Expo Go**, opening a published EAS Update | Free | **Unverified for SDK 57.** Expo's page on this is gone, and we saw that Expo Go only opens a project when signed in to an allowed account. |
| iPhone (fallback) | **TestFlight** | $99/year Apple account (needed for the App Store anyway) | Reliable; the real app |

B0 tests the iPhone route first, so we don't build on an assumption.

---

## Milestones

### B0 — Test how iPhone testers can get the app (½ day)
1. A friend (or you, with a second Expo account) installs Expo Go and signs in with their own Expo account.
2. Add them as a member of your Expo organization (`jferns-team`) on expo.dev. This is free.
3. Publish the app with EAS Update. This needs the `expo-updates` package (new dependency) and `eas update:configure`.
4. Check whether their Expo Go can open it without your PC running.

**Result:** if it works, iPhone testers use Expo Go for free. If not, iPhone testers wait for TestFlight. Buy the $99 account when you're ready; the build setup in B2 already covers it.

### B1 — Features the beta (and the stores) require (3–4 days)
- **Block a traveler:** in the photo viewer, "Block this traveler" hides all of that anonymous person's photos for you.
  - Needs a `blocks` table, an RPC, and an update to `photos_public`, `places_in_bounds` and `places_near` to exclude blocked people.
  - "Blocked travelers: N · Unblock all" goes in a new **About** screen.
- **Delete my data:** the About screen gets "Delete my photos and identity". It removes your photos, files, reports, push token and anonymous account.
  - It's an RPC plus an Edge Function, because deleting the auth user needs the service role.
  - The app then starts fresh.
- **Terms and Privacy:** short, plain-language pages shown inside the app.
  - Onboarding's button becomes **"Agree & continue"**, linking to both. Apple requires users to accept terms that say abusive content isn't tolerated.
  - Public web URLs for these are needed only for the store phase.
- **Send feedback:** the About screen gets a mailto link to your support email, plus the app version.
- The About screen is reached from a small ⓘ button on My Trips.

### B2 — Release setup (1–2 days)
- **App identity:**
  - iOS bundle ID and Android package, e.g. `com.jfern.traveliary`. This **can't be changed after release**.
  - Display name "Traveliary", version 0.9.0 (beta).
- **Real app icon and splash screen,** replacing the Expo template images. Also fixes the `ios.icon` warning from `expo-doctor`.
- **EAS configuration:**
  - `eas.json` with build profiles: `preview` (Android APK, internal distribution) and `production` (store builds, later).
  - EAS environment variables for the Supabase URL and key, because EAS builds don't see your `.env.local`.
- **Hide developer tools:** release builds and updates already hide them (`__DEV__` is false). Check this.

### B3 — Android (2–3 days)
- **Push:**
  - Create a free Firebase project, add `google-services.json`, and upload the FCM V1 key to EAS.
  - Add an Android notification channel.
- **Maps:**
  - `react-native-maps` on Android uses **Google Maps, which needs an API key**.
  - The mobile Maps SDK has no usage charge, but **Google Cloud requires a billing account (card) to issue the key**. Decide below.
- **Test on an Android emulator** on your PC (Android Studio, free) or a friend's phone:
  - camera, location, posting, offline queue, push, map
  - Android back button, permissions screens and layout
- **Build the APK** with `eas build --profile preview --platform android` and share its link.

### B4 — Clean backend for the beta (½–1 day)
- **Separate projects:** create a second free Supabase project, **traveliary-prod**, for testers. Your current project stays your test project.
  - This keeps sample data, simulated visitors and test reports away from real testers.
  - The free plan allows 2 projects.
- **Set up prod:** apply all migrations, deploy both Edge Functions, and set the Vault and function secrets.
- **Point builds at prod:** beta builds and updates use the prod URL and key, via EAS environments.

### B5 — Beta launch kit (½ day)
- **Tester guide (1 page):** how to install on iPhone or Android, what to try, and the warning "**don't reinstall or you lose your posts**".
- **Questions for testers** (3–5 short ones, e.g. via a free Google Form): would you use it on your next trip, what was confusing, do you want a profile?
- **Metrics:** saved SQL queries you can run in the dashboard. No analytics SDK needed.
  - people who posted
  - posts per person
  - people active on 2 or more days
  - places
  - notifications sent
- **Moderation routine:** a saved query that lists reported photos. Check it twice a week during the beta.

### Beta run (≈2 weeks) → triage
Fix crashes and blockers immediately. Collect everything else, then decide what's needed before launch.

---

## Decisions needed before starting
1. **App ID:** `com.<you>.traveliary`. What should `<you>` be? It's permanent.
2. **Support email** for the feedback link and the privacy policy.
3. **App icon:** do you have a logo or idea, or should I make a simple placeholder for the beta (e.g. a map pin with a camera)?
4. **Android maps:** OK to create a Google Cloud billing account (card required, no charge expected for the mobile Maps SDK)? If not, Android testers have to wait.
5. **Separate prod backend** (B4): yes or no?
6. **New dependencies** (I'll ask anyway when each comes up):
   - `expo-updates` (B0)
   - `expo-mail-composer` is *not* needed; plain `mailto:` links are enough.

## Rough timeline
B0–B5 take about 1.5–2 weeks of work, plus 2 weeks of beta. iPhone testers on TestFlight add a few days of Apple's beta review.
