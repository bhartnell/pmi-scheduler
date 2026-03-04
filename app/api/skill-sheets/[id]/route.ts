import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Fetch the skill sheet with its steps and canonical skill
    const { data: sheet, error: sheetError } = await supabase
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
      .eq('id', id)
      .single();

    if (sheetError) {
      if (sheetError.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, sheet: null });
      }
      if (sheetError.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Skill sheet not found' }, { status: 404 });
      }
      throw sheetError;
    }

    // Fetch steps ordered by step_number
    const { data: steps, error: stepsError } = await supabase
      .from('skill_sheet_steps')
      .select('*')
      .eq('skill_sheet_id', id)
      .order('step_number', { ascending: true });

    if (stepsError && !stepsError.message?.includes('does not exist')) {
      throw stepsError;
    }

    // Fetch alternate sheets that share the same canonical_skill_id
    let alternateSheets: Array<{
      id: string;
      skill_name: string;
      program: string;
      source: string;
      source_priority: number;
    }> = [];

    if (sheet.canonical_skill_id) {
      const { data: alternates, error: altError } = await supabase
        .from('skill_sheets')
        .select('id, skill_name, program, source, source_priority')
        .eq('canonical_skill_id', sheet.canonical_skill_id)
        .neq('id', id)
        .order('source_priority', { ascending: true });

      if (altError && !altError.message?.includes('does not exist')) {
        throw altError;
      }

      alternateSheets = alternates || [];
    }

    return NextResponse.json({
      success: true,
      sheet: {
        ...sheet,
        steps: steps || [],
        alternate_sheets: alternateSheets,
      },
    });
  } catch (error) {
    console.error('Error fetching skill sheet:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch skill sheet' },
      { status: 500 }
    );
  }
}
