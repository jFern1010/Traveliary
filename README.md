# Traveliary

A travel diary built from photos. Take a photo where you are, and others can see who has been there.
iOS prototype built with Expo (SDK 57) + Supabase (free tier). See [CLAUDE.md](CLAUDE.md) for the stack, conventions and architecture.

## Features
- **Camera:** in-app only, tagged with the place you're at. Nothing posts until you tap "Post publicly".
- **Explore:** a map of places with photos, a "Nearby" list, place galleries and a photo viewer.
- **My Trips:** your posts, with delete.
- **Offline:**
  - Posts queue on the phone and upload when you're back online.
  - Places you've viewed stay browsable.
- **Push:** "New photo in <place>" when someone posts where you've been. At most one per place per hour.
- **Safety:**
  - The exact position is never shown to others.
  - Anyone can report a photo; a photo with 3 reports is hidden.
- **No accounts:** each install gets an anonymous identity.

## Run on your iPhone
1. Install **Expo Go** from the App Store and sign in with the same Expo account as the CLI.
2. Run `npm install`.
3. Create `.env.local` from `.env.example` with your Supabase URL and publishable key.
4. Run `npm start`.
5. Scan the QR code with the iPhone Camera app. Allow Expo Go's "Local Network" prompt.

## Backend setup (one time)
1. **Create the project:** create a Supabase project, then Authentication → Sign In / Providers:
   - turn on **Allow new users to sign up**
   - turn on **Allow anonymous sign-ins**
2. **Link and apply the migrations:**
   ```bash
   npx supabase@latest login
   npx supabase@latest link --project-ref <ref>
   npx supabase@latest db push
   ```
3. **Push notifications:**
   ```bash
   npx supabase@latest secrets set WEBHOOK_SECRET=<random string>
   npx supabase@latest functions deploy notify-new-photo --no-verify-jwt --use-api
   npx supabase@latest functions deploy cleanup-orphans --no-verify-jwt --use-api
   ```
   Then run this in the SQL Editor, with the same secret:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/notify-new-photo', 'notify_new_photo_url');
   select vault.create_secret('<same secret>', 'notify_new_photo_secret');
   ```
4. **Link the app to Expo** (needed for push tokens): `npx eas-cli@latest init`

## Checks
Run `npm run typecheck && npm run lint && npm test`.

In development builds, My Trips → **Developer tools** can:
- add sample places
- simulate a second traveler (to test push)
- simulate 3 reports (to test auto-hide)
