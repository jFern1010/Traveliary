import { File } from 'expo-file-system';

import { ensureUserId } from '@/features/auth/session';
import type { ProcessedPhoto } from '@/features/capture/process-image';
import { PHOTO_BUCKET, supabase } from '@/lib/supabase';
import { buildCreatePhotoArgs, photoStoragePaths, type CreatePhotoInput } from './create-photo-args';

export type MyPhoto = {
  id: string;
  placeId: string;
  placeName: string;
  placeCountry: string | null;
  thumbUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  takenAt: string;
  status: 'visible' | 'hidden';
};

type PhotoPublicRow = {
  id: string;
  place_id: string;
  place_name: string;
  place_country: string | null;
  storage_path: string;
  thumb_path: string;
  width: number;
  height: number;
  taken_at: string;
  created_at: string;
  status: 'visible' | 'hidden';
  is_mine: boolean;
};

export type PostedPhoto = { photoId: string; placeId: string; placeName: string };

function publicUrl(path: string): string {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function upload(path: string, localUri: string) {
  const body = await new File(localUri).arrayBuffer();
  // upsert: a retry after a partial failure overwrites instead of erroring.
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);
}

/** Uploads the photo + thumbnail, then registers it. Safe to retry with the same photoId. */
export async function postPhoto(
  input: Omit<CreatePhotoInput, 'width' | 'height'> & { files: ProcessedPhoto },
): Promise<PostedPhoto> {
  const userId = await ensureUserId();
  const paths = photoStoragePaths(userId, input.photoId);

  await upload(paths.full, input.files.full.uri);
  await upload(paths.thumb, input.files.thumb.uri);

  const { data, error } = await supabase.rpc(
    'create_photo',
    buildCreatePhotoArgs({
      ...input,
      width: input.files.full.width,
      height: input.files.full.height,
    }),
  );
  if (error) throw new Error(`Could not save photo: ${error.message}`);

  const result = data as { photo_id: string; place_id: string; place_name: string };
  return { photoId: result.photo_id, placeId: result.place_id, placeName: result.place_name };
}

export async function listMyPhotos(): Promise<MyPhoto[]> {
  await ensureUserId();
  const { data, error } = await supabase
    .from('photos_public')
    .select('*')
    .eq('is_mine', true)
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<PhotoPublicRow[]>();
  if (error) throw new Error(error.message);

  return data.map((row) => ({
    id: row.id,
    placeId: row.place_id,
    placeName: row.place_name,
    placeCountry: row.place_country,
    thumbUrl: publicUrl(row.thumb_path),
    fullUrl: publicUrl(row.storage_path),
    width: row.width,
    height: row.height,
    takenAt: row.taken_at,
    status: row.status,
  }));
}

export async function deleteMyPhoto(photoId: string): Promise<void> {
  await ensureUserId();
  const { data, error } = await supabase.rpc('delete_my_photo', { p_photo_id: photoId });
  if (error) throw new Error(error.message);

  // The photo is already gone from every feed; leftover files are only wasted space (cleaned up in M6).
  const { error: storageError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .remove(data as string[]);
  if (storageError) console.warn('Photo files not removed:', storageError.message);
}
