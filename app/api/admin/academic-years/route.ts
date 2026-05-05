import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cascadeFromS1Start } from '@/lib/semester-cascade';

/**
 * GET /api/admin/academic-years
 *
 * Lists every pmi_academic_years row with its 4 linked
 * pmi_semesters (joined via the new academic_year_id FK). Powers
 * the /admin/semesters Year view.
 */
export async function GET() {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();
  const { data: years, error: yErr } = await supabase
    .from('pmi_academic_years')
    .select('id, year, s1_start_date, notes, created_at, updated_at')
    .order('year', { ascending: false });
  if (yErr) {
    return NextResponse.json({ error: yErr.message }, { status: 500 });
  }

  const yearIds = (years ?? []).map(y => y.id);
  let semestersByYear = new Map<string, Array<Record<string, unknown>>>();
  if (yearIds.length > 0) {
    const { data: sems, error: sErr } = await supabase
      .from('pmi_semesters')
      .select('id, academic_year_id, semester_number, name, start_date, end_date, is_active')
      .in('academic_year_id', yearIds)
      .order('semester_number', { ascending: true });
    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }
    semestersByYear = new Map();
    for (const s of sems ?? []) {
      const list = semestersByYear.get(s.academic_year_id as string) ?? [];
      list.push(s);
      semestersByYear.set(s.academic_year_id as string, list);
    }
  }

  return NextResponse.json({
    years: (years ?? []).map(y => ({
      ...y,
      semesters: semestersByYear.get(y.id) ?? [],
    })),
  });
}

/**
 * POST /api/admin/academic-years
 *
 * Create a new academic year + cascade-create its 4 semesters.
 *
 * Body:
 *   { year: number,
 *     s1_start_date: 'YYYY-MM-DD',
 *     notes?: string,
 *     dry_run?: boolean,             // default false
 *     semester_overrides?: Array<{   // per-row overrides for the
 *       semester_number: 1|2|3|4,    // calculated cascade
 *       name?: string,
 *       start_date?: string,
 *       end_date?: string,
 *     }>
 *   }
 *
 * dry_run=true returns the calculated cascade WITHOUT writing —
 * powers the live preview panel before the user clicks Confirm.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  let body: {
    year: number;
    s1_start_date: string;
    notes?: string;
    dry_run?: boolean;
    semester_overrides?: Array<{
      semester_number: 1 | 2 | 3 | 4;
      name?: string;
      start_date?: string;
      end_date?: string;
    }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  if (!body.year || !body.s1_start_date) {
    return NextResponse.json(
      { error: 'year and s1_start_date are required' },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.s1_start_date)) {
    return NextResponse.json(
      { error: 's1_start_date must be YYYY-MM-DD' },
      { status: 400 }
    );
  }

  const cascade = cascadeFromS1Start(body.s1_start_date, body.year);

  // Apply per-row overrides on top of the cascade so the preview
  // and the eventual write both see the same final values.
  const overrideByNum = new Map(
    (body.semester_overrides ?? []).map(o => [o.semester_number, o])
  );
  const finalSemesters = cascade.semesters.map(s => {
    const o = overrideByNum.get(s.number);
    return {
      number: s.number,
      name: o?.name ?? s.name,
      start_date: o?.start_date ?? s.start_date,
      end_date: o?.end_date ?? s.end_date,
    };
  });

  if (body.dry_run) {
    return NextResponse.json({
      success: true,
      dry_run: true,
      year: body.year,
      s1_start_date: body.s1_start_date,
      semesters: finalSemesters,
      breaks: cascade.breaks,
    });
  }

  const supabase = getSupabaseAdmin();

  // Upsert the year anchor. Fall back to update on the year unique
  // key so re-running with the same year just refreshes the anchor.
  const { data: yearRow, error: yErr } = await supabase
    .from('pmi_academic_years')
    .upsert(
      {
        year: body.year,
        s1_start_date: body.s1_start_date,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'year' }
    )
    .select('*')
    .single();
  if (yErr) {
    return NextResponse.json({ error: yErr.message }, { status: 500 });
  }

  // Insert/update the 4 semester rows. We upsert on
  // (academic_year_id, semester_number) so the partial unique index
  // dedupes naturally.
  const rows = finalSemesters.map(s => ({
    academic_year_id: yearRow.id,
    semester_number: s.number,
    name: s.name,
    start_date: s.start_date,
    end_date: s.end_date,
    is_active: true,
  }));
  const { data: semRows, error: sErr } = await supabase
    .from('pmi_semesters')
    .upsert(rows, { onConflict: 'academic_year_id,semester_number' })
    .select('*');
  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    year: yearRow,
    semesters: (semRows ?? []).sort(
      (a, b) => (a.semester_number ?? 0) - (b.semester_number ?? 0)
    ),
    breaks: cascade.breaks,
  });
}
