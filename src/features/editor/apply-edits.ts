import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { processPhoto, type ProcessedImage, type ProcessedPhoto } from '@/features/capture/process-image';
import type { EditState } from './edit-state';
import { cropRect } from './geometry';

/**
 * Renders the edits onto the upload-size capture and produces a fresh upload photo + thumbnail.
 * Order matches the on-screen preview: flip → rotate → crop.
 */
export async function applyEdits(source: ProcessedImage, edits: EditState): Promise<ProcessedPhoto> {
  const { crop } = edits;
  const ctx = ImageManipulator.manipulate(source.uri);
  if (crop.flipped) ctx.flip('horizontal');
  if (crop.rotation !== 0) ctx.rotate(crop.rotation);
  ctx.crop(cropRect({ width: source.width, height: source.height }, crop));

  const image = await ctx.renderAsync();
  // High quality here; processPhoto does the final upload compression and strips metadata.
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
  return processPhoto(saved.uri, { width: saved.width, height: saved.height });
}
