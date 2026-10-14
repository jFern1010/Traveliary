import { Directory, File, Paths } from 'expo-file-system';

import { processPhoto } from '@/features/capture/process-image';
import type { SuggestedPlace } from '@/features/capture/place-name';
import { postPhoto } from '@/features/photos/api';
import { uuidv4 } from '@/lib/uuid';

type Sample = { label: string; latitude: number; longitude: number; place: SuggestedPlace };

const zermatt: SuggestedPlace = {
  name: 'Zermatt',
  locality: 'Zermatt',
  region: 'Valais',
  country: 'Switzerland',
  countryCode: 'CH',
};
const paris: SuggestedPlace = {
  name: 'Paris',
  locality: 'Paris',
  region: 'Île-de-France',
  country: 'France',
  countryCode: 'FR',
};
const tokyo: SuggestedPlace = {
  name: 'Tokyo',
  locality: 'Tokyo',
  region: 'Tokyo',
  country: 'Japan',
  countryCode: 'JP',
};

/**
 * Covers the place-matching rules: two Zermatt photos ~150 m apart share a place, and the
 * Eiffel Tower and Louvre (~3 km apart, both "Paris") merge by name within 25 km.
 */
export const SAMPLES: Sample[] = [
  { label: 'Zermatt village', latitude: 46.0207, longitude: 7.7491, place: zermatt },
  { label: 'Zermatt church', latitude: 46.0198, longitude: 7.7476, place: zermatt },
  { label: 'Eiffel Tower', latitude: 48.8584, longitude: 2.2945, place: paris },
  { label: 'Louvre', latitude: 48.8606, longitude: 2.3376, place: paris },
  { label: 'Shibuya', latitude: 35.6595, longitude: 139.7005, place: tokyo },
];

const WIDTH = 1200;
const HEIGHT = 1600;

/** Dev only: downloads placeholder photos (picsum.photos) and posts them as the current user. */
export async function seedSamplePlaces(onProgress: (message: string) => void): Promise<number> {
  const dir = new Directory(Paths.cache, 'seed');
  if (!dir.exists) dir.create();

  let posted = 0;
  for (const [index, sample] of SAMPLES.entries()) {
    onProgress(`Posting ${index + 1}/${SAMPLES.length}: ${sample.label}…`);
    const target = new File(dir, `sample-${index}.jpg`);
    if (target.exists) target.delete();
    const downloaded = await File.downloadFileAsync(
      `https://picsum.photos/seed/traveliary-${index}/${WIDTH}/${HEIGHT}.jpg`,
      target,
    );
    const files = await processPhoto(downloaded.uri, { width: WIDTH, height: HEIGHT });
    await postPhoto({
      photoId: uuidv4(),
      takenAt: new Date().toISOString(),
      latitude: sample.latitude,
      longitude: sample.longitude,
      accuracy: 10,
      place: sample.place,
      files,
    });
    posted += 1;
  }
  return posted;
}
