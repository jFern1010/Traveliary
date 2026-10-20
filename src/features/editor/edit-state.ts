import { DEFAULT_CROP, isIdentityCrop, type CropState } from './geometry';

/** Everything the editor can change. Filters and adjustments join this in E3. */
export type EditState = {
  crop: CropState;
};

export const DEFAULT_EDITS: EditState = { crop: DEFAULT_CROP };

export function isUnedited(edits: EditState): boolean {
  return isIdentityCrop(edits.crop);
}
