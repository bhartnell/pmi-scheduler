import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Maps notification type/category to a display category used by the filter pills
const TYPE_TO_FILTER_CATEGORY: Record<string, string> = {
  // Tasks
  task_assigned: 'tasks',
  task_completed: 'tasks',
  task_comment: 'tasks',
  // Labs
  lab_assignment: 'labs',
  lab_reminder: 'labs',
  lab_change: 'labs',
  // Scheduling / Shifts
  shift_available: 'shifts',
  shift_confirmed: 'shifts',
  shift_cancelled: 'shifts',
  coverage_request: 'shifts',
  // Clinical
  clinical_hours: 'clinical',
  compliance_due: 'clinical',
  // Students
  student_update: 'students',
  role_approved: 'students',
  // Feedback
  feedback_new: 'feedback',
  feedback_resolved: 'feedback',
  // System / General
  general: 'system',
};

// Maps notification reference_type to a link URL pattern
function buildLink(
  referenceType: string | null,
  referenceId: string | null,
  linkUrl: string | null
): string | null {
  // If the notification already has a direct link, use it
  if (linkUrl) return linkUrl;

  if (!referenceType || !referenceId) return null;

  switch (referenceType) {
    case 'task':
      return `/tasks?id=${referenceId}`;
    case 'lab_day':
      return `/lab-management/schedule/${referenceId}`;
    case 'scenario':
      return `/lab-management/scenarios/${referenceId}`;
    case 'student':
      return `/lab-management/students/${referenceId}`;
    case 'shift':
      return `/scheduling/shifts`;
    case 'internship':
    case 'clinical':
      return `/clinical`;
    default:
      return null;
  }
}

// Maps notification category to the filter pill category
function mapToFilterCategory(type: string | null, category: string | null): string {
  if (type && TYPE_TO_FILTER_CATEGORY[type]) {
    return TYPE_TO_FILTER_CATEGORY[type];
  }
  // Fall back to the stored category
  switch (category) {
    case 'tasks': return 'tasks';
    case 'labs': return 'labs';
    case 'scheduling': return 'shifts';
    case 'clinical': return 'clinical';
    case 'feedback': return 'feedback';
    default: return 'system';
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '8'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');
    const filterCategory = searchParams.get('category') || 'all'; // all | tasks | labs | shifts | students | clinical

    // Build the query against user_notifications for the logged-in user
    let query = supabase
      .from('user_notifications')
      .select(
        'id, type, title, message, link_url, is_read, created_at, reference_type, reference_id, category',
        { count: 'exact' }
      )
      .eq('user_email', session.user.email)
      .order('created_at', { ascending: false });

    // Apply category filter if not "all"
    if (filterCategory !== 'all') {
      // Map filter category back to notification categories
      const FILTER_TO_NOTIFICATION_CATEGORIES: Record<string, string[]> = {
        tasks: ['tasks'],
        labs: ['labs'],
        shifts: ['scheduling'],
        students: ['system'], // student updates often come via system/general
        clinical: ['clinical'],
        feedback: ['feedback'],
      };
      const notifCategories = FILTER_TO_NOTIFICATION_CATEGORIES[filterCategory];
      if (notifCategories && notifCategories.length > 0) {
        query = query.in('category', notifCategories);
      }
    }

    query = query.range(offset, offset + limit - 1);

    const { data: notifications, error, count } = await query;

    if (error) throw error;

    // Transform notifications into activity entries
    const activities = (notifications || []).map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      filterCategory: mapToFilterCategory(n.type, n.category),
      category: n.category,
      is_read: n.is_read,
      created_at: n.created_at,
      link: buildLink(n.reference_type, n.reference_id, n.link_url),
      reference_type: n.reference_type,
      reference_id: n.reference_id,
      // Extract user initial from title (best-effort)
      actor: null as string | null,
    }));

    return NextResponse.json({
      success: true,
      activities,
      total: count || 0,
      limit,
      offset,
      hasMore: offset + limit < (count || 0),
    });
  } catch (error: any) {
    console.error('Error fetching recent activity:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch recent activity' },
      { status: 500 }
    );
  }
}
