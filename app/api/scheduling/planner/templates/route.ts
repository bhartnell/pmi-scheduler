import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const programType = searchParams.get('program_type');
    const semesterNumber = searchParams.get('semester_number');

    let query = supabase
      .from('pmi_course_templates')
      .select('*')
      .order('sort_order')
      .order('day_index')
      .order('start_time');

    if (programType) {
      query = query.eq('program_type', programType);
    }
    if (semesterNumber) {
      query = query.eq('semester_number', parseInt(semesterNumber));
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ templates: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('List course templates error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
