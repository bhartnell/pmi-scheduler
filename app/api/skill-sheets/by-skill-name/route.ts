import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');
    const program = searchParams.get('program');

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'name query parameter is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Helper to fetch full sheet data with steps and canonical skill
    async function fetchFullSheets(sheetIds: string[]) {
      if (sheetIds.length === 0) return [];

      const { data: sheets, error: sheetsError } = await supabase
        .from('skill_sheets')
        .select(`
          *,
          canonical_skill:canonical_skills(
            id,
            canonical_name,
            skill_category,
            programs,
            scope_notes,
            paramedic_only
          )
        `)
        .in('id', sheetIds);

      if (sheetsError) {
        if (sheetsError.message?.includes('does not exist')) return [];
        throw sheetsError;
      }

      if (!sheets || sheets.length === 0) return [];

      // Fetch steps for all matching sheets
      const { data: allSteps, error: stepsError } = await supabase
        .from('skill_sheet_steps')
        .select('*')
        .in('skill_sheet_id', sheetIds)
        .order('step_number', { ascending: true });

      if (stepsError && !stepsError.message?.includes('does not exist')) {
        throw stepsError;
      }

      // Group steps by skill_sheet_id
      const stepsArray = allSteps || [];
      const stepsBySheet: Record<string, typeof stepsArray> = {};
      for (const step of stepsArray) {
        if (!stepsBySheet[step.skill_sheet_id]) {
          stepsBySheet[step.skill_sheet_id] = [];
        }
        stepsBySheet[step.skill_sheet_id].push(step);
      }

      // Attach steps to sheets
      return sheets.map(sheet => ({
        ...sheet,
        steps: stepsBySheet[sheet.id] || [],
      }));
    }

    // -----------------------------------------------
    // Step 1: Try exact match on skill_sheets.skill_name
    // -----------------------------------------------
    let exactQuery = supabase
      .from('skill_sheets')
      .select('id')
      .eq('skill_name', name);

    if (program) {
      exactQuery = exactQuery.or(`program.eq.${program},program.eq.all`);
    }

    const { data: exactMatches, error: exactError } = await exactQuery;

    if (exactError && !exactError.message?.includes('does not exist')) {
      throw exactError;
    }

    if (exactMatches && exactMatches.length > 0) {
      const sheets = await fetchFullSheets(exactMatches.map(m => m.id));
      const sorted = applyNremtPriority(sheets);
      return NextResponse.json({ success: true, sheets: sorted });
    }

    // -----------------------------------------------
    // Step 2: Try match via skill_sheet_assignments (case-insensitive)
    // -----------------------------------------------
    let assignmentQuery = supabase
      .from('skill_sheet_assignments')
      .select('skill_sheet_id')
      .ilike('skill_name', name);

    if (program) {
      assignmentQuery = assignmentQuery.or(`program.eq.${program},program.eq.all`);
    }

    const { data: assignmentMatches, error: assignmentError } = await assignmentQuery;

    if (assignmentError && !assignmentError.message?.includes('does not exist')) {
      throw assignmentError;
    }

    if (assignmentMatches && assignmentMatches.length > 0) {
      const sheetIds = [...new Set(assignmentMatches.map(a => a.skill_sheet_id))];
      const sheets = await fetchFullSheets(sheetIds);
      const sorted = applyNremtPriority(sheets);
      return NextResponse.json({ success: true, sheets: sorted });
    }

    // -----------------------------------------------
    // Step 3: Fuzzy match via ILIKE on skill_sheets.skill_name
    // -----------------------------------------------
    let fuzzyQuery = supabase
      .from('skill_sheets')
      .select('id')
      .ilike('skill_name', `%${name}%`);

    if (program) {
      fuzzyQuery = fuzzyQuery.or(`program.eq.${program},program.eq.all`);
    }

    const { data: fuzzyMatches, error: fuzzyError } = await fuzzyQuery;

    if (fuzzyError && !fuzzyError.message?.includes('does not exist')) {
      throw fuzzyError;
    }

    if (fuzzyMatches && fuzzyMatches.length > 0) {
      const sheets = await fetchFullSheets(fuzzyMatches.map(m => m.id));
      const sorted = applyNremtPriority(sheets);
      return NextResponse.json({ success: true, sheets: sorted });
    }

    // -----------------------------------------------
    // Step 4: Word-based fuzzy match on canonical_skills.canonical_name
    // Split search term into words and require ALL words to appear
    // (any order). "Medical Assessment" matches "Patient Assessment — Medical"
    // because both "Medical" and "Assessment" appear in the canonical name.
    // -----------------------------------------------
    const searchWords = name
      .split(/[\s—\-–]+/)
      .map((w: string) => w.trim())
      .filter((w: string) => w.length >= 2);

    let canonicalQuery = supabase.from('canonical_skills').select('id');

    // Chain ILIKE for each word: canonical_name must contain ALL words
    for (const word of searchWords) {
      canonicalQuery = canonicalQuery.ilike('canonical_name', `%${word}%`);
    }

    const { data: canonicalMatches, error: canonicalError } = await canonicalQuery;

    if (canonicalError && !canonicalError.message?.includes('does not exist')) {
      throw canonicalError;
    }

    if (canonicalMatches && canonicalMatches.length > 0) {
      const canonicalIds = canonicalMatches.map(c => c.id);

      let canonicalSheetQuery = supabase
        .from('skill_sheets')
        .select('id')
        .in('canonical_skill_id', canonicalIds);

      if (program) {
        canonicalSheetQuery = canonicalSheetQuery.or(`program.eq.${program},program.eq.all`);
      }

      const { data: canonicalSheetMatches, error: canonicalSheetError } = await canonicalSheetQuery;

      if (canonicalSheetError && !canonicalSheetError.message?.includes('does not exist')) {
        throw canonicalSheetError;
      }

      if (canonicalSheetMatches && canonicalSheetMatches.length > 0) {
        const sheets = await fetchFullSheets(canonicalSheetMatches.map(m => m.id));
        const sorted = applyNremtPriority(sheets);
        return NextResponse.json({ success: true, sheets: sorted });
      }
    }

    // No results found
    return NextResponse.json({ success: true, sheets: [] });
  } catch (error) {
    console.error('Error searching skill sheets by name:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search skill sheets' },
      { status: 500 }
    );
  }
}

/**
 * Sort sheets by source_priority ASC, with special NREMT priority logic:
 * When a sheet has platinum_skill_type = 'emt_competency' AND there exists
 * an NREMT sheet for the same canonical_skill_id, the NREMT sheet appears first.
 */
function applyNremtPriority(sheets: Array<Record<string, any>>): Array<Record<string, any>> {
  if (sheets.length <= 1) return sheets;

  // Identify canonical_skill_ids that have an emt_competency platinum sheet
  const canonicalIdsWithEmtCompetency = new Set<string>();
  for (const sheet of sheets) {
    if (sheet.platinum_skill_type === 'emt_competency' && sheet.canonical_skill_id) {
      canonicalIdsWithEmtCompetency.add(sheet.canonical_skill_id);
    }
  }

  // Sort with custom comparator
  return [...sheets].sort((a, b) => {
    // Check if both sheets share a canonical_skill_id that has an emt_competency sheet
    const aCanonical = a.canonical_skill_id;
    const bCanonical = b.canonical_skill_id;

    // If they share the same canonical skill and that skill has an emt_competency sheet
    if (
      aCanonical &&
      aCanonical === bCanonical &&
      canonicalIdsWithEmtCompetency.has(aCanonical)
    ) {
      // NREMT sheets get boosted to the top
      const aIsNremt = a.source === 'nremt';
      const bIsNremt = b.source === 'nremt';

      if (aIsNremt && !bIsNremt) return -1;
      if (!aIsNremt && bIsNremt) return 1;
    }

    // Default: sort by source_priority ASC
    return (a.source_priority ?? 999) - (b.source_priority ?? 999);
  });
}
