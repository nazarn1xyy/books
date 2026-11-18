import { useQuery } from '@tanstack/react-query';
import { services } from '@/shared/services';

export function useAdminStats(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => services().admin.stats(),
    enabled,
    refetchInterval: 30_000,
  });
}
