import { ImageFormat, Skia } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

import type { ProcessedImage } from '@/features/capture/process-image';
import type { ColorMatrix } from './color';

/**
 * Draws an image through a color matrix on an off-screen Skia surface and saves it as JPEG.
 * Works on the already-cropped upload-size image (~1600 px), never the full-resolution capture.
 */
export async function applyColorMatrix(source: ProcessedImage, matrix: ColorMatrix): Promise<ProcessedImage> {
  const data = await Skia.Data.fromURI(source.uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Couldn’t read the photo for editing.');

  const surface = Skia.Surface.Make(image.width(), image.height());
  if (!surface) throw new Error('Couldn’t prepare the photo for editing.');
  const paint = Skia.Paint();
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(matrix));
  surface.getCanvas().drawImage(image, 0, 0, paint);
  surface.flush();

  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 95);
  const file = new File(Paths.cache, `edited-${Date.now()}.jpg`);
  file.create({ overwrite: true });
  file.write(bytes);
  return { uri: file.uri, width: image.width(), height: image.height() };
}
