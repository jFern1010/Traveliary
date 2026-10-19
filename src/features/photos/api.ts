import type { SupabaseClient } from '@supabase/supabase-js';
import { File } from 'expo-file-system';

import { ensureUserId } from '@/features/auth/session';
import type { ProcessedPhoto } from '@/features/capture/process-image';
import { PHOTO_BUCKET, supabase } from '@/lib/supabase';
import { buildCreatePhotoArgs, photoStoragePaths, type CreatePhotoInput } from './create-photo-args';

export type Photo = {
  id: string;
  placeId: string;
  placeName: string;
  placeCountry: string | null;
  thumbUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  takenAt: string;
  createdAt: string;
  status: 'visible' | 'hidden';
  isMine: boolean;
};

/** One page of a place gallery; pass `nextCursor` back to load older photos. */
export type PhotoPage = { photos: Photo[]; nextCursor: string | null };

export type PhotoPublicRow = {
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

export function toPhoto(row: PhotoPublicRow): Photo {
  return {
    id: row.id,
    placeId: row.place_id,
    placeName: row.place_name,
    placeCountry: row.place_country,
    thumbUrl: publicUrl(row.thumb_path),
    fullUrl: publicUrl(row.storage_path),
    width: row.width,
    height: row.height,
    takenAt: row.taken_at,
    createdAt: row.created_at,
    status: row.status,
    isMine: row.is_mine,
  };
}

/** Matches the 'photos' bucket file_size_limit in the init migration. */
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

async function upload(client: SupabaseClient, path: string, localUri: string) {
  const file = new File(localUri);
  if (!file.exists) throw new Error('The photo file is missing on this phone.');
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Photo is too large (${(file.size / 1024 / 1024).toFixed(1)} MB, max 2 MB).`);
  }
  const body = await file.arrayBuffer();
  // upsert: a retry after a partial failure overwrites instead of erroring.
  const { error } = await client.storage
    .from(PHOTO_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);
}

export type PostPhotoInput = Omit<CreatePhotoInput, 'width' | 'height'> & { files: ProcessedPhoto };

/** Uploads the photo + thumbnail, then registers it. Safe to retry with the same photoId. */
export async function postPhoto(input: PostPhotoInput): Promise<PostedPhoto> {
  return postPhotoAs(supabase, await ensureUserId(), input);
}

/** Same as `postPhoto`, but as whoever is signed in on `client` (used by developer tools). */
export async function postPhotoAs(
  client: SupabaseClient,
  userId: string,
  input: PostPhotoInput,
): Promise<PostedPhoto> {
  const paths = photoStoragePaths(userId, input.photoId);

  await upload(client, paths.full, input.files.full.uri);
  await upload(client, paths.thumb, input.files.thumb.uri);

  const { data, error } = await client.rpc(
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

export async function listMyPhotos(): Promise<Photo[]> {
  await ensureUserId();
  const { data, error } = await supabase
    .from('photos_public')
    .select('*')
    .eq('is_mine', true)
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<PhotoPublicRow[]>();
  if (error) throw new Error(error.message);
  return data.map(toPhoto);
}

const PAGE_SIZE = 30;

export async function listPlacePhotos(placeId: string, cursor: string | null): Promise<PhotoPage> {
  await ensureUserId();
  let query = supabase
    .from('photos_public')
    .select('*')
    .eq('place_id', placeId)
    .eq('status', 'visible')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query.returns<PhotoPublicRow[]>();
  if (error) throw new Error(error.message);
  const photos = data.map(toPhoto);
  return {
    photos,
    nextCursor: photos.length === PAGE_SIZE ? photos[photos.length - 1].createdAt : null,
  };
}

export async function getPhoto(photoId: string): Promise<Photo> {
  await ensureUserId();
  const { data, error } = await supabase
    .from('photos_public')
    .select('*')
    .eq('id', photoId)
    .maybeSingle<PhotoPublicRow>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('This photo is no longer available.');
  return toPhoto(data);
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
