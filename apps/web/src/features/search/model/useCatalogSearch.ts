import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchBooks } from '@/shared/catalog/flibustaApi';

export const MIN_SEARCH_LENGTH = 2;

export function useCatalogSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['catalog', 'search', q.toLowerCase()],
    queryFn: () => fetchBooks(q),
    enabled: q.length >= MIN_SEARCH_LENGTH,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
