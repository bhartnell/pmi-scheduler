import { useQuery } from '@tanstack/react-query';
import type { CurrentUser } from '@/types';

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const res = await fetch('/api/instructor/me');
  const data = await res.json();
  if (data.success && data.user) {
    return data.user;
  }
  return null;
}

export function useCurrentUser(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60_000,
    enabled: options?.enabled !== false,
  });
}
