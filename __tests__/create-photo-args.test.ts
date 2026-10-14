import { buildCreatePhotoArgs, photoStoragePaths } from '@/features/photos/create-photo-args';
import { uuidv4 } from '@/lib/uuid';

const base = {
  photoId: '6f1c2c1e-1111-4222-8333-444455556666',
  takenAt: '2026-10-14T09:30:00.000Z',
  latitude: 46.0207,
  longitude: 7.7491,
  accuracy: 12,
  width: 1200,
  height: 1600,
};

describe('photoStoragePaths', () => {
  it('puts files in the user folder, named by photo id', () => {
    expect(photoStoragePaths('user-1', 'photo-1')).toEqual({
      full: 'user-1/photo-1.jpg',
      thumb: 'user-1/photo-1_thumb.jpg',
    });
  });
});

describe('buildCreatePhotoArgs', () => {
  it('passes the suggested place through', () => {
    const args = buildCreatePhotoArgs({
      ...base,
      place: {
        name: 'Zermatt',
        locality: 'Zermatt',
        region: 'Valais',
        country: 'Switzerland',
        countryCode: 'CH',
      },
    });
    expect(args).toMatchObject({
      p_photo_id: base.photoId,
      p_lat: 46.0207,
      p_lng: 7.7491,
      p_place_name: 'Zermatt',
      p_country_code: 'CH',
      p_width: 1200,
      p_height: 1600,
    });
  });

  it('uses coordinates as the name when geocoding failed', () => {
    const args = buildCreatePhotoArgs({ ...base, place: null });
    expect(args.p_place_name).toBe('46.0207° N, 7.7491° E');
    expect(args.p_country_code).toBeNull();
  });
});

describe('uuidv4', () => {
  it('produces RFC 4122 v4 ids', () => {
    const id = uuidv4();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidv4()).not.toBe(id);
  });
});
