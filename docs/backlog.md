# Backlog

Ideas and deferred work, roughly by phase. Move items into a plan when we pick them up.

## Store phase (needs our own builds: $99 Apple account + TestFlight)
- **Tap-to-focus (and exposure) on the camera.** expo-camera can't focus on a point, only auto or lock. Switch the camera to `react-native-vision-camera` once we leave Expo Go for development builds.
- **Exact 2×/3× zoom buttons.** expo-camera exposes zoom as a fraction of an unknown max. VisionCamera exposes real zoom factors and telephoto lenses.
- **Public privacy policy and terms pages** (stores require URLs), and App Store/Play listings, screenshots, privacy labels, data-safety form.
- **Add the Play app-signing SHA-1 to the Google Maps key** restriction.
- **CAPTCHA on anonymous sign-up** (Cloudflare Turnstile via Supabase) before the public launch.

## After beta feedback
- **Optional profiles** (Sign in with Apple / email) that keep photos across phones, if testers ask for it. Requires in-app account deletion (already have "Delete my data").
- **Map pin clustering** when a view has 200+ places.
- **Prune `notification_log`** rows older than 1 hour (pg_cron).
- **Push fan-out via a queue** (pgmq) if posts grow past thousands per hour.
- **More "Must see" exclusions or categories,** based on tester reports.
