import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuthOrVolunteerToken } from '@/lib/api-auth';

// POST - Bulk lookup skill sheet IDs by multiple skill names
// Returns a map of { skillName: sheetId } for the first matching sheet per name
// Supports volunteer lab tokens for read-only access
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthOrVolunteerToken(request, 'instructor');
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { names, program } = body;

    if (!Array.isArray(names) || names.length === 0) {
      return NextResponse.json(
        { success: false, error: 'names array is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const results: Record<string, string> = {};

    // Step 1: Try exact match on skill_sheets.skill_name for all names at once
    let exactQuery = supabase
      .from('skill_sheets')
      .select('id, skill_name')
      .in('skill_name', names)
      .eq('is_active', true);

    if (program) {
      exactQuery = exactQuery.or(`program.eq.${program},program.eq.all`);
    }

    const { data: exactMatches } = await exactQuery;

    if (exactMatches) {
      for (const match of exactMatches) {
        if (match.skill_name && !results[match.skill_name]) {
          results[match.skill_name] = match.id;
        }
      }
    }

    // Find names that didn't match exactly
    const remainingNames = names.filter(n => !results[n]);

    if (remainingNames.length > 0) {
      // Step 2: Try match via skill_sheet_assignments (case-insensitive)
      // We need to check each remaining name individually since ILIKE doesn't support IN
      let assignmentQuery = supabase
        .from('skill_sheet_assignments')
        .select('skill_sheet_id, skill_name');

      if (program) {
        assignmentQuery = assignmentQuery.or(`program.eq.${program},program.eq.all`);
      }

      // Build OR filter for remaining names
      const ilikeFilters = remainingNames.map(n => `skill_name.ilike.${n}`).join(',');
      assignmentQuery = assignmentQuery.or(ilikeFilters);

      const { data: assignmentMatches } = await assignmentQuery;

      if (assignmentMatches) {
        for (const match of assignmentMatches) {
          // Find the original name that matches (case-insensitive)
          const originalName = remainingNames.find(
            n => n.toLowerCase() === match.skill_name?.toLowerCase()
          );
          if (originalName && !results[originalName]) {
            results[originalName] = match.skill_sheet_id;
          }
        }
      }
    }

    // Find names still unmatched
    const stillRemaining = names.filter(n => !results[n]);

    if (stillRemaining.length > 0) {
      // Step 3: Fuzzy match via ILIKE on skill_sheets.skill_name
      // For each remaining name, do a fuzzy search
      const fuzzyFilters = stillRemaining.map(n => `skill_name.ilike.%${n}%`).join(',');
      let fuzzyQuery = supabase
        .from('skill_sheets')
        .select('id, skill_name')
        .or(fuzzyFilters)
        .eq('is_active', true);

      if (program) {
        fuzzyQuery = fuzzyQuery.or(`program.eq.${program},program.eq.all`);
      }

      const { data: fuzzyMatches } = await fuzzyQuery;

      if (fuzzyMatches) {
        for (const match of fuzzyMatches) {
          // Find the original name that this fuzzy-matches
          const originalName = stillRemaining.find(
            n => match.skill_name?.toLowerCase().includes(n.toLowerCase())
          );
          if (originalName && !results[originalName]) {
            results[originalName] = match.id;
          }
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Error in bulk skill sheet lookup:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to lookup skill sheets' },
      { status: 500 }
    );
  }
}
