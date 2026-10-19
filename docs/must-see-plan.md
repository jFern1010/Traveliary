# "Must see" near you — plan

## Goal
Show travelers the best-known places to visit within **50 km**: landmarks, museums, castles, historic sites, viewpoints and parks. Rank them by how famous they are and how close.
Each place gets a summary, a photo, directions, and the photos Traveliary travelers posted there.

**Decided:**
- **Data:** Wikipedia/Wikidata plus our own photos.
- **Where:** Explore → a third switch, **Must see** (list), plus special pins on the map.
- **When:** built **before** the beta starts, adding about a week.
- **Actions:** read about it, get directions, see travelers' photos.
- **Not included:** "you're nearby" notifications.

---

## How it works

### Data: Wikidata (free, no key)
- **The search:** one Wikidata query finds notable things within 50 km.
  - We keep items that have a heritage designation, or are a tourist attraction, museum, castle, church, monument, archaeological site, park or viewpoint.
  - We drop cities, companies and people.
- **The result:** for each place we get its name and short description in the phone's language (English fallback), its position, a photo from Wikimedia Commons, and its Wikipedia article.
- **How famous:** the number of Wikipedia language editions with an article about the place. The Eiffel Tower has 200+; a local chapel has 1. This is our fame score.
- **Summary:** when a traveler opens a place, we fetch the article's short summary from Wikipedia.

### Ranking (top 30)
`score = fame (log of language count) + Traveliary activity (log of photos posted within 300 m) − distance penalty (up to 50 km)`

The weights are tuned on real results, e.g. Oslo and Zermatt.

### Server: Edge Function `nearby-sights`
- **Coarse location only:** the app sends its position rounded to a **~10 km cell**, plus the language. The server never sees the exact position.
- **Caching:** the server keeps results per cell and language for **30 days** in a `sight_cache` table.
  - Wikidata is only queried for new areas, which is fast and respects Wikimedia's usage rules: a proper User-Agent with the support email, low volume.
- **Live counts:** the Traveliary photo counts per place are computed fresh each time. They're not cached, because they change daily.
- **New database function `photos_near_point(lat, lng)`:** returns visible Traveliary photos within 300 m of a place, for the detail screen. As always, exact positions are never returned.

### App
- **Explore → Must see:**
  - **List:** cards with photo, name, short description, distance, and "N travelers posted here".
  - **Map:** must-see places appear as **orange star pins**; Traveliary places keep their blue pins.
- **Detail screen:** photo, summary, distance, and:
  - **Directions:** opens Apple Maps on iPhone and Google Maps on Android. Free, no key.
  - **Read more on Wikipedia:** opens the in-app browser (`expo-web-browser`, already installed).
  - **Travelers' photos here:** a grid. Tap a photo for the existing photo viewer.
  - **Post a photo here:** shown only when you're within about 300 m. Opens the camera.
- **Offline:** the last loaded list and viewed details stay available, via the existing cache.
- **Credit:** a "Data: Wikipedia & Wikidata (CC BY-SA) · Photo: Wikimedia Commons" credit on the list and detail screens, as their licenses require.

### Legal and privacy
- **Privacy Policy update:** a rounded ~10 km area is sent to find nearby sights, and the summaries come from Wikipedia.
- **`LEGAL_VERSION`:** bumped, so the update re-shows **Agree & continue** once. Fine before the beta.

---

## Milestones (about 5–7 days)

**S1 — Server (2 days)**
- Migration: the `sight_cache` table and `photos_near_point`.
- The `nearby-sights` Edge Function: the Wikidata query, caching, ranking, and Traveliary counts.
- Pure ranking and cell-rounding helpers, with unit tests.
- *Check:* calling the function for Oslo returns sensible top places (e.g. Akershus Fortress, the Opera House, Vigeland Park), and a second call comes from the cache.

**S2 — App (2–3 days)**
- The Must see list and the orange pins.
- The detail screen with directions, Wikipedia and travelers' photos.
- *Check on both phones:* list, map, detail, directions open the right maps app, travelers' photos appear.

**S3 — Polish and release (1–2 days)**
- Offline behavior, credits, the privacy text and `LEGAL_VERSION`, and empty or error states (e.g. remote areas with nothing notable).
- Apply the migration to both projects and deploy the function to both.
- Publish the update to both channels, and **rebuild the APK** so new testers get the feature from their first launch.

---

## Risks and unknowns
- **Wikidata query speed and reliability:** the public query service can be slow or time out for dense cities.
  - **Fallback:** Wikipedia's simple 10 km search (just the nearest notable pages, without the fame ranking).
  - The 30-day cache means the slow path runs rarely.
- **What counts as a sight:** filters may let in odd items (stations, hotels) or miss some. We tune them on real places during S1.
- **Photo licenses:** Commons photos are free to use with credit. We link to each photo's page and show the credit.
- **Wikimedia usage rules:** fine at our volume with caching and a proper User-Agent. Wikimedia asks heavy users to contact them, which doesn't apply to us.
- **No new paid services, no new keys, no new app dependencies.**
