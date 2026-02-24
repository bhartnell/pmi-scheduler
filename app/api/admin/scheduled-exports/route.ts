import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Helper
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

/**
 * Calculate the next run timestamp for a given schedule type.
 * weekly  → next Sunday at 06:00 UTC
 * monthly → 1st of next month at 06:00 UTC
 */
function calcNextRunAt(schedule: 'weekly' | 'monthly'): string {
  const now = new Date();

  if (schedule === 'weekly') {
    // Find next Sunday
    const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + daysUntilSunday);
    next.setUTCHours(6, 0, 0, 0);
    return next.toISOString();
  } else {
    // First of next month
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 6, 0, 0, 0));
    return next.toISOString();
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/scheduled-exports
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('scheduled_exports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, exports: data });
  } catch (error) {
    console.error('Error fetching scheduled exports:', error);
    return NextResponse.json({ error: 'Failed to fetch scheduled exports' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/scheduled-exports
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, report_type, schedule, recipients, is_active = true } = body as {
      name: string;
      report_type: 'cohort_progress' | 'clinical_hours' | 'lab_completion' | 'student_status';
      schedule: 'weekly' | 'monthly';
      recipients: string[];
      is_active?: boolean;
    };

    if (!name || !report_type || !schedule || !recipients || recipients.length === 0) {
      return NextResponse.json(
        { error: 'name, report_type, schedule, and at least one recipient are required' },
        { status: 400 }
      );
    }

    const validTypes = ['cohort_progress', 'clinical_hours', 'lab_completion', 'student_status'];
    if (!validTypes.includes(report_type)) {
      return NextResponse.json({ error: 'Invalid report_type' }, { status: 400 });
    }

    if (!['weekly', 'monthly'].includes(schedule)) {
      return NextResponse.json({ error: 'Invalid schedule – must be weekly or monthly' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('scheduled_exports')
      .insert({
        name,
        report_type,
        schedule,
        recipients,
        is_active,
        next_run_at: is_active ? calcNextRunAt(schedule) : null,
        created_by: currentUser.email,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, export: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating scheduled export:', error);
    return NextResponse.json({ error: 'Failed to create scheduled export' }, { status: 500 });
  }
}
