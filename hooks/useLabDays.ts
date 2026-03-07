import { useQuery } from '@tanstack/react-query';

interface UseLabDaysOptions {
  startDate?: string;
  endDate?: string;
  cohortId?: string;
  enabled?: boolean;
}

interface LabDayRole {
  id: string;
  role: 'lab_lead' | 'roamer' | 'observer';
  instructor_name: string | null;
  instructor_email: string | null;
}

interface ShiftSignupInfo {
  confirmed: { name: string; email: string }[];
  pending_count: number;
}

interface LabDay {
  id: string;
  date: string;
  title: string | null;
  semester: number | null;
  week_number: number | null;
  day_number: number | null;
  num_rotations: number;
  cohort: {
    id: string;
    cohort_number: number;
    program: {
      abbreviation: string;
    };
  };
  stations: Array<{
    id: string;
    station_number: number;
    station_type: string;
    skill_name: string | null;
    custom_title: string | null;
    instructor_name: string | null;
    instructor_email: string | null;
    room: string | null;
    notes: string | null;
    rotation_minutes: number | null;
    num_rotations: number | null;
    station_notes: string | null;
    scenario?: {
      id: string;
      title: string;
      category: string;
      difficulty: string;
    };
    [key: string]: unknown;
  }>;
  roles: LabDayRole[];
  shift_signups?: ShiftSignupInfo;
  [key: string]: unknown;
}

async function fetchLabDays(opts: UseLabDaysOptions): Promise<LabDay[]> {
  const params = new URLSearchParams();
  if (opts.startDate) params.set('startDate', opts.startDate);
  if (opts.endDate) params.set('endDate', opts.endDate);
  if (opts.cohortId) params.set('cohortId', opts.cohortId);

  const res = await fetch(`/api/lab-management/lab-days?${params}`);
  const data = await res.json();
  if (data.success) {
    return data.labDays || [];
  }
  return [];
}

export function useLabDays(options?: UseLabDaysOptions) {
  const { startDate, endDate, cohortId, enabled } = options || {};
  return useQuery({
    queryKey: ['lab-days', { startDate, endDate, cohortId }],
    queryFn: () => fetchLabDays({ startDate, endDate, cohortId }),
    staleTime: 30_000,
    enabled: enabled !== false && !!startDate && !!endDate,
  });
}
