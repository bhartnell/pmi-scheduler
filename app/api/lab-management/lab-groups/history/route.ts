import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Get group change history
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const studentId = searchParams.get('studentId');
  const cohortId = searchParams.get('cohortId');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('lab_group_history')
      .select(`
        *,
        student:students(id, first_name, last_name),
        from_group:lab_groups!lab_group_history_from_group_id_fkey(id, name),
        to_group:lab_groups!lab_group_history_to_group_id_fkey(id, name)
      `)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // If cohortId filter, we need to filter in memory
    let filteredData = data;
    if (cohortId && data) {
      // Get all students in this cohort
      const { data: cohortStudents } = await supabase
        .from('students')
        .select('id')
        .eq('cohort_id', cohortId);
      
      const cohortStudentIds = new Set(cohortStudents?.map(s => s.id) || []);
      filteredData = data.filter(h => cohortStudentIds.has(h.student_id));
    }

    // Format the history for display
    const formattedHistory = filteredData?.map(h => ({
      id: h.id,
      changed_at: h.changed_at,
      changed_by: h.changed_by,
      reason: h.reason,
      student: h.student,
      from_group: h.from_group,
      to_group: h.to_group,
      description: formatChangeDescription(h)
    }));

    return NextResponse.json({ success: true, history: formattedHistory || [] });
  } catch (error) {
    console.error('Error fetching group history:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch history' }, { status: 500 });
  }
}

function formatChangeDescription(history: any): string {
  const studentName = history.student 
    ? `${history.student.first_name} ${history.student.last_name}`
    : 'Unknown student';
  
  const fromName = history.from_group?.name || 'Ungrouped';
  const toName = history.to_group?.name || 'Ungrouped';

  if (!history.from_group && history.to_group) {
    return `${studentName} assigned to ${toName}`;
  } else if (history.from_group && !history.to_group) {
    return `${studentName} removed from ${fromName}`;
  } else {
    return `${studentName} moved from ${fromName} to ${toName}`;
  }
}
