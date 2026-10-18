# Moderation routine (beta)

**When:** twice a week, e.g. Monday and Thursday, about 5 minutes. Also do it whenever a tester emails about a photo.

**Where:** prod project (`nxsckznbmcmhlxsxxwsn`) → SQL Editor. Queries: `supabase/queries/moderation.sql`.

## Checklist
1. **Look at reports:**
   - Run **section 1**. Each row is a reported photo, with its reasons and a `photo_url`. Open the link to see the photo.
   - 3 reports already hide a photo automatically; you still decide what happens next.
2. **Decide for each photo:**
   - **Clearly abusive** (sexual, violent, hateful, illegal, someone's privacy): make sure it's hidden (**section 3**).
     - If the same `author_id` keeps showing up, check **section 2** and consider **section 5** (hide all their photos).
   - **Fine** (wrongly reported, or just a bad photo): if it was auto-hidden, restore it with **section 4**.
   - **Unsure:** hide it. Hiding can be undone; the author still sees it.
3. **Anything illegal** (especially involving minors): hide everything from that author immediately (**section 5**), don't download or share the photo, and report it to the authorities. Keep the `photo_id` and `author_id`.
4. **Note what you did** (date, photo_id, action) in a simple log, e.g. a note on your phone. Apple may ask how you moderate.

## Also check
- **Tester emails:** reply within 24h. Apple and Google expect the support contact to work.
- **Storage cleanup, weekly:**
  ```bash
  curl.exe -X POST https://nxsckznbmcmhlxsxxwsn.supabase.co/functions/v1/cleanup-orphans -H "x-webhook-secret: <prod secret>"
  ```
- **Supabase usage, weekly:** Dashboard → Settings → Usage. The free plan has 1 GB of storage. The project pauses after 7 days without activity, which won't happen while testers are active.
