import { useQuery } from '@tanstack/react-query';

interface CanonicalSkillRef {
  id: string;
  canonical_name: string;
  skill_category: string | null;
}

interface SkillSheetRow {
  id: string;
  skill_name: string;
  program: string;
  source: string;
  source_priority: number;
  canonical_skill_id: string | null;
  equipment: string | null;
  overview: string | null;
  platinum_skill_type: string | null;
  canonical_skill: CanonicalSkillRef | null;
  step_count: number;
}

interface ProgramCounts {
  emt: number;
  aemt: number;
  paramedic: number;
  total: number;
}

interface SkillSheetsResult {
  sheets: SkillSheetRow[];
  counts: ProgramCounts;
}

interface UseSkillSheetsOptions {
  program?: string;
  source?: string;
  category?: string;
  search?: string;
  enabled?: boolean;
}

async function fetchSkillSheets(opts: UseSkillSheetsOptions): Promise<SkillSheetsResult> {
  const params = new URLSearchParams();
  if (opts.program) params.set('program', opts.program);
  if (opts.source) params.set('source', opts.source);
  if (opts.category) params.set('category', opts.category);
  if (opts.search) params.set('search', opts.search);

  const qs = params.toString();
  const res = await fetch(`/api/skill-sheets${qs ? `?${qs}` : ''}`);
  const data = await res.json();
  if (data.success) {
    return {
      sheets: data.sheets || [],
      counts: data.counts || { emt: 0, aemt: 0, paramedic: 0, total: 0 },
    };
  }
  return { sheets: [], counts: { emt: 0, aemt: 0, paramedic: 0, total: 0 } };
}

export function useSkillSheets(options?: UseSkillSheetsOptions) {
  const { program, source, category, search, enabled } = options || {};
  return useQuery({
    queryKey: ['skill-sheets', { program, source, category, search }],
    queryFn: () => fetchSkillSheets({ program, source, category, search }),
    staleTime: 5 * 60_000,
    enabled: enabled !== false,
  });
}
