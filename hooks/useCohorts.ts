import { useQuery } from '@tanstack/react-query';

interface Cohort {
  id: string;
  cohort_number: number;
  program: {
    id: string;
    name: string;
    abbreviation: string;
  };
  student_count: number;
  is_active: boolean;
  is_archived: boolean;
  [key: string]: unknown;
}

interface UseCohortOptions {
  programId?: string;
  activeOnly?: boolean;
  includeArchived?: boolean;
  enabled?: boolean;
}

async function fetchCohorts(opts: UseCohortOptions): Promise<Cohort[]> {
  const params = new URLSearchParams();
  if (opts.programId) params.set('programId', opts.programId);
  if (opts.activeOnly === false) params.set('activeOnly', 'false');
  if (opts.includeArchived) params.set('include_archived', 'true');
  const res = await fetch(`/api/lab-management/cohorts?${params}`);
  const data = await res.json();
  if (data.success) {
    return data.cohorts || [];
  }
  return [];
}

export function useCohorts(options?: UseCohortOptions) {
  const { programId, activeOnly, includeArchived, enabled } = options || {};
  return useQuery({
    queryKey: ['cohorts', { programId, activeOnly, includeArchived }],
    queryFn: () => fetchCohorts({ programId, activeOnly, includeArchived }),
    staleTime: 5 * 60_000,
    enabled: enabled !== false,
  });
}
