// app/api/lab-management/students/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { students, cohort_id } = body;

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Students array is required' },
        { status: 400 }
      );
    }

    // Validate and prepare student data
    const validStudents = students
      .filter(s => s.first_name && s.last_name)
      .map(s => ({
        first_name: s.first_name.trim(),
        last_name: s.last_name.trim(),
        email: s.email?.trim() || null,
        cohort_id: cohort_id || null,
        agency: s.agency?.trim() || null,
        notes: s.notes?.trim() || null,
      }));

    if (validStudents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid students found. Each student needs first_name and last_name.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('students')
      .insert(validStudents)
      .select();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      imported: data.length,
      skipped: students.length - validStudents.length,
      students: data 
    });
  } catch (error) {
    console.error('Error importing students:', error);
    return NextResponse.json({ success: false, error: 'Failed to import students' }, { status: 500 });
  }
}
