# Camera controls & photo editing — plan

## Goal
Make taking and polishing a photo feel like the phone's own camera, before the beta.

**Decided:**
- **Features:** zoom, lens and flash; crop and rotate; filters; adjustments.
- **Flow:** editing is **optional**, through an **Edit** button on the preview screen.
- **Crop:** preset shapes.
- **Rules that don't change:**
  - The location is captured at the shutter. Editing never changes it.
  - Photos must still be taken in the app; there's no gallery import.
  - Edits re-encode the photo, so camera metadata (including GPS) stays stripped.

## User flow
```
Camera (zoom · lens · flash) ──shutter──► Preview & consent ──Post publicly──► queue
                                               │
                                             Edit
                                               ▼
                                Editor: Crop · Filters · Adjust
                                   Cancel ◄──┴──► Done (updates the preview)
```
- **Location:** the GPS fix and place lookup start at the shutter, exactly as today, and finish in the background while you edit.
- **Edits:** "Done" replaces the draft's photo with the edited version. "Cancel" keeps the original. Re-editing always starts from the **original** capture, so quality never degrades.

## Milestones (about 5–7 days)

### E1 — Camera controls (1 day)
- **Zoom:**
  - Pinch to zoom, using `react-native-gesture-handler` (already installed).
  - Quick buttons **1×** and **2×**, plus **0.5×** when the phone reports an ultra-wide lens (via `onAvailableLensesChanged`; iPhone back camera).
- **Flash:** off / auto / on, as a cycle button with an icon. The front camera hides it.
- **Grid toggle:** a rule-of-thirds overlay to help framing. Small, and every phone camera has one.
- **Fixed:**
  - Zoom resets when switching front/back.
  - Selfies stay mirrored as today.

### E2 — Editor: crop & rotate (1–2 days)
- **The editor screen** (`capture/edit`) has three tabs: **Crop**, **Filters**, **Adjust**.
- **Crop:**
  - Presets **Original / Square / 4:5 / 16:9**.
  - Drag the photo inside the frame to choose what's kept, and pinch to zoom it.
- **Rotate 90°** and **flip** (mirror).
- **Applying:** uses `expo-image-manipulator` (already installed), then the same resize, thumbnail and metadata strip as today.
- **Pure geometry helpers** (crop rectangles for presets, rotation, clamping) with unit tests.

### E3 — Filters & adjustments (2–3 days)
- **New dependency:** `@shopify/react-native-skia`, a GPU image library by Shopify. It's included in Expo Go and free.
- **Filters:** about **8** looks as color matrices: Original, Vivid, Warm, Cool, Mono, Noir, Fade, Vintage. Thumbnails preview each look live on your photo.
- **Adjustments:** brightness, contrast, saturation and warmth sliders (`@expo/ui` Slider, already installed). They combine with the chosen filter.
- **Export:**
  - Skia renders the final image at full upload size (~1600 px) off-screen.
  - It's saved as JPEG, then gets the usual thumbnail.
  - The upload queue is unchanged.
- **Pure color-matrix math** (filter definitions, combining adjustments) with unit tests.

### E4 — Polish & release (1 day)
- **Performance:** the editor stays smooth on older phones (preview at screen size, full size only on Done).
- **Accessibility:** labels on all controls; sliders usable with VoiceOver and TalkBack.
- **Both platforms:** test on iPhone and Android. Filters must look the same on both.
- **Release:**
  - Publish the update to both beta channels.
  - **Rebuild the APK.** Skia is native code, so the APK must include it; Expo Go already does.
  - Update the tester guide link.

## Risks
- **Skia on Expo Go:** included, but the APK must be rebuilt (E4). Possible version mismatches are caught by `expo install` and `expo-doctor`.
- **Ultra-wide availability:** only some phones have it, and lens names differ between iPhone models. The 0.5× button appears only when a wide lens is reported.
- **Memory on big photos:** we never edit the 12+ MP original. The editor works on the resized ~1600 px version, already created at capture.
- **No new costs, accounts or keys.**
