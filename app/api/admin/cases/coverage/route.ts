// ---------------------------------------------------------------------------
// GET /api/admin/cases/coverage — Case Coverage Statistics
// ---------------------------------------------------------------------------
// Returns coverage stats grouped by category: total cases, AI-generated,
// reviewed (approved), and published counts.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET — Coverage stats
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    // Fetch all active case_studies with relevant fields
    const { data: cases, error } = await supabase
      .from('case_studies')
      .select('category, generated_by_ai, content_review_status, is_published')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching coverage data:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Group by category
    const categoryMap: Record<string, {
      category: string;
      total: number;
      generated: number;
      reviewed: number;
      published: number;
    }> = {};

    for (const c of cases || []) {
      const cat = (c.category || 'uncategorized').toLowerCase();
      if (!categoryMap[cat]) {
        categoryMap[cat] = { category: cat, total: 0, generated: 0, reviewed: 0, published: 0 };
      }
      categoryMap[cat].total++;
      if (c.generated_by_ai) categoryMap[cat].generated++;
      if (c.content_review_status === 'approved') categoryMap[cat].reviewed++;
      if (c.is_published) categoryMap[cat].published++;
    }

    // Also get count of cases pending review
    const { count: reviewCount } = await supabase
      .from('case_studies')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('content_review_status', 'pending_review');

    return NextResponse.json({
      success: true,
      categories: Object.values(categoryMap),
      review_pending_count: reviewCount || 0,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/cases/coverage:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
