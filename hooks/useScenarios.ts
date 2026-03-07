import { useQuery } from '@tanstack/react-query';

interface Scenario {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  difficulty: string;
  chief_complaint: string | null;
  applicable_programs: string[];
  estimated_duration: number | null;
  documentation_required: boolean;
  platinum_required: boolean;
}

interface UseScenariosOptions {
  category?: string;
  difficulty?: string;
  program?: string;
  enabled?: boolean;
}

async function fetchScenarios(opts: UseScenariosOptions): Promise<Scenario[]> {
  const params = new URLSearchParams();
  if (opts.category) params.append('category', opts.category);
  if (opts.difficulty) params.append('difficulty', opts.difficulty);
  if (opts.program) params.append('program', opts.program);

  const res = await fetch(`/api/lab-management/scenarios?${params}`);
  const data = await res.json();
  if (data.success) {
    return data.scenarios || [];
  }
  return [];
}

export function useScenarios(options?: UseScenariosOptions) {
  const { category, difficulty, program, enabled } = options || {};
  return useQuery({
    queryKey: ['scenarios', { category, difficulty, program }],
    queryFn: () => fetchScenarios({ category, difficulty, program }),
    staleTime: 5 * 60_000,
    enabled: enabled !== false,
  });
}
