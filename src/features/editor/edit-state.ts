import { editMatrix, isIdentityMatrix, NO_ADJUSTMENTS, type Adjustments, type FilterId } from './color';
import { DEFAULT_CROP, isIdentityCrop, type CropState } from './geometry';

/** Everything the editor can change. */
export type EditState = {
  crop: CropState;
  filter: FilterId;
  adjust: Adjustments;
};

export const DEFAULT_EDITS: EditState = { crop: DEFAULT_CROP, filter: 'original', adjust: NO_ADJUSTMENTS };

export function hasColorEdits(edits: EditState): boolean {
  return !isIdentityMatrix(editMatrix(edits.filter, edits.adjust));
}

export function isUnedited(edits: EditState): boolean {
  return isIdentityCrop(edits.crop) && !hasColorEdits(edits);
}
