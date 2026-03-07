import { useQuery } from '@tanstack/react-query';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  photo_url: string | null;
  status: string;
  agency: string | null;
  team_lead_count: number;
  scrub_top_size: string | null;
  scrub_bottom_size: string | null;
  cohort?: {
    id: string;
    cohort_number: number;
    program: { abbreviation: string };
  };
}

interface UseStudentsOptions {
  cohortId?: string;
  status?: string;
  enabled?: boolean;
}

async function fetchStudents(opts: UseStudentsOptions): Promise<Student[]> {
  const params = new URLSearchParams();
  if (opts.cohortId) params.append('cohortId', opts.cohortId);
  if (opts.status) params.append('status', opts.status);

  const res = await fetch(`/api/lab-management/students?${params}`);
  const data = await res.json();
  if (data.success) {
    return data.students || [];
  }
  return [];
}

export function useStudents(options?: UseStudentsOptions) {
  const { cohortId, status, enabled } = options || {};
  return useQuery({
    queryKey: ['students', { cohortId, status }],
    queryFn: () => fetchStudents({ cohortId, status }),
    staleTime: 2 * 60_000,
    enabled: enabled !== false,
  });
}
