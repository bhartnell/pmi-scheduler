import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

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

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      program_type, semester_number, course_code, course_name,
      duration_type, day_index, start_time, end_time,
      block_type, is_online, color, notes, sort_order,
    } = body;

    if (!program_type || !course_code || !course_name || day_index === undefined || !start_time || !end_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('pmi_course_templates')
      .insert({
        program_type,
        semester_number: semester_number ?? null,
        course_code,
        course_name,
        duration_type: duration_type || 'full',
        day_index,
        start_time,
        end_time,
        block_type: block_type || 'lecture',
        is_online: is_online ?? false,
        color: color || null,
        notes: notes || null,
        sort_order: sort_order ?? 0,
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ template: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Create course template error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
