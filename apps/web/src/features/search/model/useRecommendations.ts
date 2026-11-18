import { useQuery } from '@tanstack/react-query';
import { fetchBooks } from '@/shared/catalog/flibustaApi';

const RECOMMENDATION_QUERY = 'Толстой';

/** Persisted for a day, so Home renders instantly after the first visit. */
export function useRecommendations() {
  return useQuery({
    queryKey: ['catalog', 'recommendations', RECOMMENDATION_QUERY],
    queryFn: () => fetchBooks(RECOMMENDATION_QUERY),
    staleTime: 24 * 60 * 60 * 1000,
  });
}
