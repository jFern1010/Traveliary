# Scalability review

## Fix before the beta (milestone SC)
| # | Problem | Fix |
|---|---|---|
| 1 | `create_photo` takes one **global** advisory lock, so every post worldwide is serialized | Lock per ~1 km cell (only posts at the same spot wait for each other) |
| 2 | No spatial index on `photos.location`; `places_in_bounds` filters unindexed `lat`/`lng` | GiST index on `photos.location`; bounding-box filter on the indexed `places.centroid` |
| 3 | `places_in_bounds` / `places_near` recount photos per place for every viewer (to respect blocks) | Use stored `places.photo_count`; recount only when the viewer has blocks |
| 4 | Composite index for galleries/aggregates | `photos (place_id, status, created_at desc)` |

## Fine for now, revisit with real usage
- **Map pins:** clustering when a view has 200+ places (e.g. via a server-side grid aggregation).
- **Push fan-out:** one Edge Function call per photo, batched 100 per Expo request. Fine to thousands of posts per hour. Beyond that, move to a queue (e.g. pgmq).
- **Notification log:** prune rows older than 1 hour periodically (pg_cron), since only the last hour matters.
- **Anonymous sign-up abuse:** add CAPTCHA (Cloudflare Turnstile is free with Supabase) before the public launch.

## Cost ceilings (free tiers)
| Service | Free limit | Roughly when we hit it | Upgrade |
|---|---|---|---|
| Supabase storage | 1 GB | about 3,000 photos (≈340 KB each incl. thumbnail) | Pro $25/mo: 100 GB |
| Supabase egress | 5 GB/month | about 15,000 full photo views/month | Pro: 250 GB |
| Supabase database | 500 MB | hundreds of thousands of photos | Pro: 8 GB |
| EAS Update | 1,000 monthly users (updates) | 1,000 active beta/app users | Paid EAS plan, or rely on store releases |
| Expo Push | No hard limit (fair use) | — | — |
| Wikidata | Fair use, cached per area | — | — |
