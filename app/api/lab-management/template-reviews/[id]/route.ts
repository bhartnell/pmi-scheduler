import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET /api/lab-management/template-reviews/[id]
// Get a single review with items and stats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Fetch the review
    const { data: review, error: reviewError } = await supabase
      .from('template_reviews')
      .select(`
        *,
        cohort:cohorts(id, cohort_number, program:programs(name, abbreviation))
      `)
      .eq('id', id)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Fetch items with lab_day info
    const { data: items, error: itemsError } = await supabase
      .from('template_review_items')
      .select(`
        *,
        lab_day:lab_days(id, date, title, week_number, day_number)
      `)
      .eq('review_id', id)
      .order('created_at', { ascending: true });

    if (itemsError) throw itemsError;

    // Sort items by lab_day date
    const sortedItems = (items || []).sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const aDate = (a.lab_day as Record<string, unknown>)?.date as string || '';
      const bDate = (b.lab_day as Record<string, unknown>)?.date as string || '';
      return aDate.localeCompare(bDate);
    });

    // Compute stats
    const stats = { total: 0, pending: 0, accepted: 0, kept: 0, revised: 0 };
    for (const item of sortedItems) {
      stats.total++;
      if (item.disposition === 'pending') stats.pending++;
      else if (item.disposition === 'accept_changes') stats.accepted++;
      else if (item.disposition === 'keep_original') stats.kept++;
      else if (item.disposition === 'revised') stats.revised++;
    }

    return NextResponse.json({
      success: true,
      review,
      items: sortedItems,
      stats,
    });
  } catch (error) {
    console.error('Error fetching template review:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch template review' }, { status: 500 });
  }
}

// PUT /api/lab-management/template-reviews/[id]
// Update review metadata (title, reviewers, status)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { title, reviewers, status } = body;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title.trim();
    if (reviewers !== undefined) updates.reviewers = reviewers;
    if (status !== undefined) updates.status = status;

    const { data, error } = await supabase
      .from('template_reviews')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, review: data });
  } catch (error) {
    console.error('Error updating template review:', error);
    return NextResponse.json({ success: false, error: 'Failed to update template review' }, { status: 500 });
  }
}

// DELETE /api/lab-management/template-reviews/[id]
// Only delete if status is 'draft'
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Check status
    const { data: review, error: fetchError } = await supabase
      .from('template_reviews')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    if (review.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft reviews can be deleted' }, { status: 400 });
    }

    const { error } = await supabase
      .from('template_reviews')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template review:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete template review' }, { status: 500 });
  }
}
