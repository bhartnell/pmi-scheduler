import { useQuery } from '@tanstack/react-query';

interface Location {
  id: string;
  name: string;
}

async function fetchLocations(type: string): Promise<Location[]> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  const res = await fetch(`/api/lab-management/locations?${params}`);
  const data = await res.json();
  if (data.success) {
    return data.locations || [];
  }
  return [];
}

export function useLocations(options?: { type?: string; enabled?: boolean }) {
  const type = options?.type || 'room';
  return useQuery({
    queryKey: ['locations', type],
    queryFn: () => fetchLocations(type),
    staleTime: 10 * 60_000,
    enabled: options?.enabled !== false,
  });
}
