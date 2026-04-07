import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Helper - resolve current user
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// GET /api/skill-sheets
//
// List all skill sheets with optional filtering.
// Query params: program, source, category, search
// Returns sheets with canonical skill info and aggregate program counts.
// Requires instructor+ role.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const program = searchParams.get('program');
    const source = searchParams.get('source');
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    // Build query - select skill_sheets joined with canonical_skills
    let query = supabase
      .from('skill_sheets')
      .select(`
        id,
        skill_name,
        program,
        source,
        source_priority,
        canonical_skill_id,
        equipment,
        overview,
        platinum_skill_type,
        nremt_code,
        canonical_skill:canonical_skills(
          id,
          canonical_name,
          skill_category
        )
      `);

    // Only show active skill sheets by default
    query = query.eq('is_active', true);

    // Apply filters
    if (program) {
      query = query.eq('program', program.toLowerCase());
    }

    if (source) {
      query = query.eq('source', source.toLowerCase());
    }

    if (search) {
      query = query.ilike('skill_name', `%${search}%`);
    }

    // Order by program, source_priority, skill_name
    query = query
      .order('program', { ascending: true })
      .order('source_priority', { ascending: true })
      .order('skill_name', { ascending: true });

    const { data: sheets, error: sheetsError } = await query;

    if (sheetsError) {
      if (sheetsError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          sheets: [],
          counts: { emt: 0, aemt: 0, paramedic: 0, total: 0 },
        });
      }
      throw sheetsError;
    }

    // Apply category filter in-memory (category is on the joined canonical_skills table)
    let filteredSheets = sheets || [];
    if (category) {
      filteredSheets = filteredSheets.filter((s: Record<string, unknown>) => {
        const cs = s.canonical_skill as { skill_category?: string } | null;
        return cs?.skill_category?.toLowerCase() === category.toLowerCase();
      });
    }

    // Get step counts for all sheets in a single query
    const sheetIds = filteredSheets.map((s: Record<string, unknown>) => s.id as string);
    let stepCounts: Record<string, number> = {};

    if (sheetIds.length > 0) {
      const { data: stepsData, error: stepsError } = await supabase
        .from('skill_sheet_steps')
        .select('skill_sheet_id')
        .in('skill_sheet_id', sheetIds);

      if (stepsError && !stepsError.message?.includes('does not exist')) {
        // Non-critical - continue without step counts
        console.error('Error fetching step counts:', stepsError);
      } else if (stepsData) {
        for (const step of stepsData) {
          stepCounts[step.skill_sheet_id] = (stepCounts[step.skill_sheet_id] || 0) + 1;
        }
      }
    }

    // Attach step_count to each sheet
    const sheetsWithCounts = filteredSheets.map((s: Record<string, unknown>) => ({
      ...s,
      step_count: stepCounts[s.id as string] || 0,
    }));

    // Compute aggregate program counts from ALL sheets (not filtered)
    // We need unfiltered counts, so query separately
    let counts = { emt: 0, aemt: 0, paramedic: 0, total: 0 };

    const { data: allSheets, error: countError } = await supabase
      .from('skill_sheets')
      .select('program')
      .eq('is_active', true);

    if (countError && !countError.message?.includes('does not exist')) {
      console.error('Error fetching program counts:', countError);
    } else if (allSheets) {
      for (const s of allSheets) {
        const p = (s.program || '').toLowerCase();
        if (p === 'emt') counts.emt++;
        else if (p === 'aemt') counts.aemt++;
        else if (p === 'paramedic') counts.paramedic++;
      }
      counts.total = allSheets.length;
    }

    return NextResponse.json({
      success: true,
      sheets: sheetsWithCounts,
      counts,
    });
  } catch (error) {
    console.error('Error listing skill sheets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list skill sheets' },
      { status: 500 }
    );
  }
}
