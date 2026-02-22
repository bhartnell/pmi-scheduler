import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const body = await request.json();
    const { cohort_id, students } = body;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ success: false, error: 'No students provided' }, { status: 400 });
    }

    const studentsToInsert = students.map((s: any) => ({
      first_name: s.first_name,
      last_name: s.last_name,
      email: s.email || null,
      agency: s.agency || null,
      cohort_id: cohort_id || null,
    }));

    const { data, error } = await supabase
      .from('students')
      .insert(studentsToInsert)
      .select();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      imported: data.length,
      skipped: students.length - data.length
    });
  } catch (error) {
    console.error('Error importing students:', error);
    return NextResponse.json({ success: false, error: 'Failed to import students' }, { status: 500 });
  }
}
