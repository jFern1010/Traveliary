// Builds the app icon set (iOS icon, Android adaptive layers, splash, favicon) from the logo.
// Usage (from the project folder):
//   node scripts/make-icons.js assets/brand/logo-source.png assets/images [previewDir]
// Uses pngjs, which is already installed as a dependency of the Expo toolchain.
const fs = require('fs');
const path = require('path');
const { PNG } = require(path.resolve('node_modules/pngjs'));

const [, , sourcePath, assetsDir, previewDir] = process.argv;
const src = PNG.sync.read(fs.readFileSync(sourcePath));

// Square crop just inside the logo's rounded tile (measured: tile spans x 168–1083, y 134–1107),
// so the platform's own corner mask never shows the cream border.
const CROP = { x: 188, y: 186, size: 876 };
const CREAM = [254, 249, 239];

function pixel(img, x, y) {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

/** Area-averaging resample of a square region into a new size x size RGBA buffer. */
function resample(img, region, size) {
  const out = Buffer.alloc(size * size * 4);
  const scale = region.size / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = region.x + x * scale, x1 = x0 + scale;
      const y0 = region.y + y * scale, y1 = y0 + scale;
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
          const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
          const w = wx * wy;
          const p = pixel(img, Math.min(img.width - 1, sx), Math.min(img.height - 1, sy));
          r += p[0] * w; g += p[1] * w; b += p[2] * w; a += p[3] * w; wsum += w;
        }
      }
      const i = (y * size + x) * 4;
      out[i] = r / wsum; out[i + 1] = g / wsum; out[i + 2] = b / wsum; out[i + 3] = a / wsum;
    }
  }
  return out;
}

/** Places `inner` (innerSize², RGBA) centered on a canvas, optionally with rounded corners. */
function compose(canvasSize, inner, innerSize, { background = null, radius = 0 } = {}) {
  const out = Buffer.alloc(canvasSize * canvasSize * 4);
  const off = Math.round((canvasSize - innerSize) / 2);
  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      const o = (y * canvasSize + x) * 4;
      let r = 0, g = 0, b = 0, a = 0;
      if (background) [r, g, b, a] = [...background, 255];
      const ix = x - off, iy = y - off;
      if (ix >= 0 && iy >= 0 && ix < innerSize && iy < innerSize) {
        const i = (iy * innerSize + ix) * 4;
        let ia = inner[i + 3] / 255;
        if (radius) ia *= cornerCoverage(ix + 0.5, iy + 0.5, innerSize, radius);
        r = inner[i] * ia + r * (1 - ia);
        g = inner[i + 1] * ia + g * (1 - ia);
        b = inner[i + 2] * ia + b * (1 - ia);
        a = Math.max(a, ia * 255);
      }
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
    }
  }
  return out;
}

/** Anti-aliased coverage (0–1) of a rounded square at a pixel center. */
function cornerCoverage(x, y, size, radius) {
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  const d = Math.hypot(x - cx, y - cy);
  return Math.min(1, Math.max(0, radius - d + 0.5));
}

function writePng(file, size, data, { opaque = false } = {}) {
  const png = new PNG({ width: size, height: size });
  data.copy(png.data);
  const buf = opaque ? PNG.sync.write(png, { colorType: 2 }) : PNG.sync.write(png);
  fs.writeFileSync(file, buf);
  console.log(path.basename(file), size, buf.length, 'bytes');
}

const icon1024 = resample(src, CROP, 1024);

// iOS / App Store icon: full-bleed, opaque (App Store rejects icons with transparency).
writePng(path.join(assetsDir, 'icon.png'), 1024, icon1024, { opaque: true });

// Android adaptive icon: the tile scaled into the central safe zone, on a cream background layer.
const fg = resample(src, CROP, 700);
writePng(path.join(assetsDir, 'android-icon-foreground.png'), 1024, compose(1024, fg, 700, { radius: 150 }));
writePng(
  path.join(assetsDir, 'android-icon-background.png'),
  1024,
  compose(1024, Buffer.alloc(0), 0, { background: CREAM }),
  { opaque: true },
);

// Splash: the tile with rounded corners, shown on a cream splash background (see app.json).
const splash = resample(src, CROP, 512);
writePng(path.join(assetsDir, 'splash-icon.png'), 512, compose(512, splash, 512, { radius: 112 }));

// Favicon (web only).
writePng(path.join(assetsDir, 'favicon.png'), 48, resample(src, CROP, 48), { opaque: true });

// Previews for review: iOS-style rounded mask and an Android circle mask.
if (previewDir) {
  writePng(path.join(previewDir, 'preview-ios.png'), 512, compose(512, resample(src, CROP, 512), 512, { background: [255, 255, 255], radius: 115 }));
  const androidPreview = Buffer.alloc(512 * 512 * 4);
  const fgSmall = resample(src, CROP, 350);
  const tile = compose(512, fgSmall, 350, { background: CREAM, radius: 75 });
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const i = (y * 512 + x) * 4;
    const inside = Math.hypot(x + 0.5 - 256, y + 0.5 - 256) <= 256;
    androidPreview[i] = inside ? tile[i] : 255;
    androidPreview[i + 1] = inside ? tile[i + 1] : 255;
    androidPreview[i + 2] = inside ? tile[i + 2] : 255;
    androidPreview[i + 3] = 255;
  }
  writePng(path.join(previewDir, 'preview-android.png'), 512, androidPreview);
}

// Android notification icon: Android draws only the alpha channel, so a white map-pin silhouette
// (with a lens-shaped hole) on transparency. 96 px is the xxxhdpi size.
function notificationIcon(size) {
  const out = Buffer.alloc(size * size * 4);
  const SS = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((x + (sx + 0.5) / SS) / size) * 100; // 0–100 design space
          const v = ((y + (sy + 0.5) / SS) / size) * 100;
          const dx = u - 50, dy = v - 40;
          const head = dx * dx + dy * dy <= 30 * 30;
          const tail = v >= 52 && v <= 94 && Math.abs(dx) <= 24 * (1 - (v - 52) / 42);
          const hole = dx * dx + dy * dy <= 12 * 12;
          if ((head || tail) && !hole) hits++;
        }
      }
      const i = (y * size + x) * 4;
      out[i] = 255; out[i + 1] = 255; out[i + 2] = 255;
      out[i + 3] = Math.round((hits / (SS * SS)) * 255);
    }
  }
  return out;
}
writePng(path.join(assetsDir, 'notification-icon.png'), 96, notificationIcon(96));
