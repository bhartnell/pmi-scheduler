import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = getSupabaseAdmin();
    const sessionId = req.nextUrl.searchParams.get('session_id');

    // Build query for signups with session and instructor info
    let query = supabase
      .from('open_lab_signups')
      .select('*, session:open_lab_sessions(date), requested_instructor:lab_users!open_lab_signups_requested_instructor_id_fkey(name)')
      .is('cancelled_at', null)
      .order('created_at', { ascending: true });

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data: signups, error } = await query;

    if (error) {
      console.error('Error fetching signups for export:', error);
      return NextResponse.json({ error: 'Failed to fetch signups' }, { status: 500 });
    }

    // Build CSV
    const headers = ['Date', 'Student Name', 'Email', 'Program Level', 'What To Work On', 'Requested Instructor', 'Signed Up At'];
    const rows = (signups || []).map((s: Record<string, unknown>) => {
      const session = s.session as { date: string } | null;
      const instructor = s.requested_instructor as { name: string } | null;
      return [
        session?.date || '',
        escapeCsv(s.student_name as string),
        escapeCsv(s.student_email as string),
        escapeCsv(s.program_level as string),
        escapeCsv(s.what_to_work_on as string),
        escapeCsv(instructor?.name || ''),
        s.created_at ? new Date(s.created_at as string).toLocaleString() : '',
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="open-lab-signups-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (err) {
    console.error('Open lab export error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function escapeCsv(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
