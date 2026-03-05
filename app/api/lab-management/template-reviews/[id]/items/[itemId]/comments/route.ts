import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { createBulkNotifications } from '@/lib/notifications';

// POST /api/lab-management/template-reviews/[id]/items/[itemId]/comments
// Add a comment to a review item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const { id, itemId } = await params;
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { comment } = body;

    if (!comment || typeof comment !== 'string' || !comment.trim()) {
      return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
    }

    // Insert comment
    const { data, error } = await supabase
      .from('template_review_comments')
      .insert({
        review_item_id: itemId,
        author_email: user.email,
        comment: comment.trim(),
      })
      .select()
      .single();

    if (error) throw error;

    // Notify other reviewers
    const { data: review } = await supabase
      .from('template_reviews')
      .select('title, reviewers, created_by')
      .eq('id', id)
      .single();

    if (review) {
      const allReviewers = new Set<string>([
        ...(review.reviewers as string[] || []),
        review.created_by as string,
      ]);
      // Remove the commenter
      allReviewers.delete(user.email);

      if (allReviewers.size > 0) {
        const notifications = Array.from(allReviewers).map((email) => ({
          userEmail: email,
          title: 'New review comment',
          message: `${user.name || user.email.split('@')[0]} commented on review: ${review.title}`,
          type: 'general' as const,
          category: 'labs' as const,
          linkUrl: `/lab-management/templates/review/${id}/item/${itemId}`,
          referenceType: 'template_review_comment',
          referenceId: data.id,
        }));
        await createBulkNotifications(notifications);
      }
    }

    return NextResponse.json({ success: true, comment: data }, { status: 201 });
  } catch (error) {
    console.error('Error adding review comment:', error);
    return NextResponse.json({ success: false, error: 'Failed to add comment' }, { status: 500 });
  }
}
