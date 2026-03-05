import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { createBulkNotifications } from '@/lib/notifications';

// GET /api/lab-management/template-reviews
// List reviews, optionally filtered by cohort_id or status
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = request.nextUrl;
    const cohortId = searchParams.get('cohort_id');
    const status = searchParams.get('status');

    let query = supabase
      .from('template_reviews')
      .select(`
        *,
        cohort:cohorts(id, cohort_number, program:programs(name, abbreviation))
      `)
      .order('created_at', { ascending: false });

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      if (error.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, reviews: [] });
      }
      throw error;
    }

    // For each review, fetch item counts for progress display
    const reviewIds = (data || []).map((r: Record<string, unknown>) => r.id as string);
    let itemCounts: Record<string, { total: number; pending: number; accepted: number; kept: number; revised: number }> = {};

    if (reviewIds.length > 0) {
      const { data: items } = await supabase
        .from('template_review_items')
        .select('review_id, disposition')
        .in('review_id', reviewIds);

      if (items) {
        for (const item of items) {
          const rid = item.review_id as string;
          if (!itemCounts[rid]) {
            itemCounts[rid] = { total: 0, pending: 0, accepted: 0, kept: 0, revised: 0 };
          }
          itemCounts[rid].total++;
          if (item.disposition === 'pending') itemCounts[rid].pending++;
          else if (item.disposition === 'accept_changes') itemCounts[rid].accepted++;
          else if (item.disposition === 'keep_original') itemCounts[rid].kept++;
          else if (item.disposition === 'revised') itemCounts[rid].revised++;
        }
      }
    }

    const reviews = (data || []).map((r: Record<string, unknown>) => ({
      ...r,
      stats: itemCounts[r.id as string] || { total: 0, pending: 0, accepted: 0, kept: 0, revised: 0 },
    }));

    return NextResponse.json({ success: true, reviews });
  } catch (error) {
    console.error('Error fetching template reviews:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch template reviews' }, { status: 500 });
  }
}

// POST /api/lab-management/template-reviews
// Create a new review for a cohort semester
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { cohort_id, semester, title, reviewers } = body;

    if (!cohort_id || !semester || !title) {
      return NextResponse.json({ error: 'cohort_id, semester, and title are required' }, { status: 400 });
    }

    // Validate cohort exists
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, cohort_number')
      .eq('id', cohort_id)
      .single();

    if (cohortError || !cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    // Fetch lab_days for cohort + semester
    const { data: labDays, error: labDaysError } = await supabase
      .from('lab_days')
      .select('id, date, title, week_number, day_number, source_template_id')
      .eq('cohort_id', cohort_id)
      .eq('semester', semester)
      .order('date', { ascending: true });

    if (labDaysError) throw labDaysError;

    if (!labDays || labDays.length === 0) {
      return NextResponse.json({ error: 'No lab days found for this cohort and semester' }, { status: 400 });
    }

    // Insert the review
    const { data: review, error: reviewError } = await supabase
      .from('template_reviews')
      .insert({
        cohort_id,
        semester: String(semester),
        title: title.trim(),
        status: 'in_review',
        created_by: user.email,
        reviewers: Array.isArray(reviewers) ? reviewers : [],
      })
      .select()
      .single();

    if (reviewError) throw reviewError;

    // Create review items for each lab day
    const itemInserts = labDays.map((ld: Record<string, unknown>) => ({
      review_id: review.id,
      lab_day_id: ld.id,
      template_id: ld.source_template_id || null,
      disposition: 'pending',
    }));

    const { error: itemsError } = await supabase
      .from('template_review_items')
      .insert(itemInserts);

    if (itemsError) throw itemsError;

    // Send notifications to reviewers
    const reviewerEmails = Array.isArray(reviewers) ? reviewers : [];
    if (reviewerEmails.length > 0) {
      const notifications = reviewerEmails.map((email: string) => ({
        userEmail: email,
        title: 'Template review assigned',
        message: `You have been assigned to review: ${title}`,
        type: 'general' as const,
        category: 'labs' as const,
        linkUrl: `/lab-management/templates/review/${review.id}`,
        referenceType: 'template_review',
        referenceId: review.id,
      }));
      await createBulkNotifications(notifications);
    }

    return NextResponse.json({ success: true, review }, { status: 201 });
  } catch (error) {
    console.error('Error creating template review:', error);
    return NextResponse.json({ success: false, error: 'Failed to create template review' }, { status: 500 });
  }
}
