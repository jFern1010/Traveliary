import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { fitWithin, FULL_MAX_SIDE, THUMB_MAX_SIDE, type Size } from './image-size';

export type ProcessedImage = { uri: string; width: number; height: number };
export type ProcessedPhoto = { full: ProcessedImage; thumb: ProcessedImage };

async function renderJpeg(uri: string, target: Size, compress: number): Promise<ProcessedImage> {
  const image = await ImageManipulator.manipulate(uri).resize(target).renderAsync();
  // Re-encoding writes a fresh JPEG, which leaves the camera's EXIF metadata (incl. GPS) behind.
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Produces the upload-sized photo (~1600px) and a gallery thumbnail (~400px). */
export async function processPhoto(uri: string, original: Size): Promise<ProcessedPhoto> {
  const [full, thumb] = await Promise.all([
    renderJpeg(uri, fitWithin(original, FULL_MAX_SIDE), 0.7),
    renderJpeg(uri, fitWithin(original, THUMB_MAX_SIDE), 0.6),
  ]);
  return { full, thumb };
}
