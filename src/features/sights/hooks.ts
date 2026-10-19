import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { isBackendConfigured } from '@/lib/env';
// Shared with the Edge Function so the app caches by exactly the same cell as the server.
import { cellFor, sanitizeLang } from '../../../supabase/functions/nearby-sights/sights';
import { deviceLanguage, fetchNearbySights, fetchSightSummary, photosNearSight, type NearbySightsResponse } from './api';
import { rankSights, type RankedSight, type Sight } from './rank';

const DAY_MS = 24 * 60 * 60 * 1000;

export const sightKeys = {
  all: ['sights'] as const,
  cell: (cell: string, lang: string) => ['sights', 'cell', cell, lang] as const,
  summary: (lang: string, title: string) => ['sights', 'summary', lang, title] as const,
  photos: (id: string) => ['sights', 'photos', id] as const,
};

/**
 * Must-see places within 50 km, ranked for the user's exact position (which stays on the phone).
 * Cached per ~11 km cell and language, like the server, so moving around a city doesn't refetch.
 */
export function useNearbySights(position: { latitude: number; longitude: number } | null) {
  const lang = sanitizeLang(deviceLanguage());
  const cell = position ? cellFor(position.latitude, position.longitude) : null;

  const query = useQuery({
    queryKey: cell ? sightKeys.cell(cell.key, lang) : ['sights', 'cell', 'none'],
    queryFn: () => fetchNearbySights(position!.latitude, position!.longitude, lang),
    enabled: isBackendConfigured && position !== null,
    staleTime: DAY_MS,
    // A new area can take up to ~30 s on the server; don't hammer it with fast retries.
    retry: 1,
    retryDelay: 5_000,
  });

  const ranked = useMemo<RankedSight[]>(
    () => (query.data && position ? rankSights(query.data.sights, position) : []),
    [query.data, position],
  );

  return { ...query, ranked };
}

/** Finds a sight in any cached list (the detail screen is opened from the list or the map). */
export function findCachedSight(queryClient: QueryClient, id: string): Sight | null {
  for (const [, data] of queryClient.getQueriesData<NearbySightsResponse>({ queryKey: ['sights', 'cell'] })) {
    const found = data?.sights.find((s) => s.id === id);
    if (found) return found;
  }
  return null;
}

export function useCachedSight(id: string): Sight | null {
  const queryClient = useQueryClient();
  return useMemo(() => findCachedSight(queryClient, id), [queryClient, id]);
}

export function useSightSummary(sight: Sight | null) {
  return useQuery({
    queryKey: sight?.wikiLang && sight.wikiTitle ? sightKeys.summary(sight.wikiLang, sight.wikiTitle) : ['sights', 'summary', 'none'],
    queryFn: () => fetchSightSummary(sight!.wikiLang!, sight!.wikiTitle!),
    enabled: Boolean(sight?.wikiLang && sight.wikiTitle),
    staleTime: 7 * DAY_MS,
  });
}

export function usePhotosNearSight(sight: Sight | null) {
  return useQuery({
    queryKey: sight ? sightKeys.photos(sight.id) : ['sights', 'photos', 'none'],
    queryFn: () => photosNearSight(sight!.lat, sight!.lng),
    enabled: isBackendConfigured && sight !== null,
  });
}
