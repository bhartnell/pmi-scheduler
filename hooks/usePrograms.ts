import { useQuery } from '@tanstack/react-query';

interface Program {
  id: string;
  name: string;
  display_name: string | null;
  abbreviation: string;
  is_active: boolean;
}

async function fetchPrograms(): Promise<Program[]> {
  const res = await fetch('/api/lab-management/programs');
  const data = await res.json();
  if (data.success) {
    return data.programs || [];
  }
  return [];
}

export function usePrograms(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['programs'],
    queryFn: fetchPrograms,
    staleTime: 10 * 60_000,
    enabled: options?.enabled !== false,
  });
}
