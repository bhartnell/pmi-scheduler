import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/lab-management/scenario-library
// Returns all scenarios enriched with tags, avg rating, and favorite flag
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const email = session.user.email;

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const difficulty = searchParams.get('difficulty') || '';
  const tagFilter = searchParams.get('tag') || '';
  const sortBy = searchParams.get('sort') || 'title'; // title | difficulty | rating | created_at

  try {
    // 1. Fetch all active scenarios
    let scenarioQuery = supabase
      .from('scenarios')
      .select('id, title, chief_complaint, difficulty, category, subcategory, applicable_programs, estimated_duration, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('title');

    if (category) scenarioQuery = scenarioQuery.eq('category', category);
    if (difficulty) scenarioQuery = scenarioQuery.eq('difficulty', difficulty);
    if (search) {
      const safe = search.replace(/[%_,.()\\/]/g, '');
      scenarioQuery = scenarioQuery.or(`title.ilike.%${safe}%,chief_complaint.ilike.%${safe}%,category.ilike.%${safe}%`);
    }

    const { data: scenarios, error: scenarioError } = await scenarioQuery;
    if (scenarioError) throw scenarioError;
    if (!scenarios || scenarios.length === 0) {
      return NextResponse.json({ success: true, scenarios: [] });
    }

    const ids = scenarios.map((s) => s.id);

    // 2. Fetch tags for these scenarios
    const { data: tags } = await supabase
      .from('scenario_tags')
      .select('scenario_id, tag')
      .in('scenario_id', ids);

    // 3. Fetch ratings for these scenarios (user_email replaces rated_by)
    const { data: ratings } = await supabase
      .from('scenario_ratings')
      .select('scenario_id, rating, comment, user_email')
      .in('scenario_id', ids);

    // Build lookup maps
    const tagMap: Record<string, string[]> = {};
    for (const t of tags || []) {
      if (!tagMap[t.scenario_id]) tagMap[t.scenario_id] = [];
      tagMap[t.scenario_id].push(t.tag);
    }

    const ratingMap: Record<string, { avg: number; count: number; myRating: number | null; myComment: string | null }> = {};
    for (const r of ratings || []) {
      if (!ratingMap[r.scenario_id]) {
        ratingMap[r.scenario_id] = { avg: 0, count: 0, myRating: null, myComment: null };
      }
      ratingMap[r.scenario_id].count += 1;
      ratingMap[r.scenario_id].avg += r.rating;
      if (r.user_email === email) {
        ratingMap[r.scenario_id].myRating = r.rating;
        ratingMap[r.scenario_id].myComment = r.comment || null;
      }
    }
    // Finalize averages
    for (const id of Object.keys(ratingMap)) {
      const entry = ratingMap[id];
      entry.avg = entry.count > 0 ? Math.round((entry.avg / entry.count) * 10) / 10 : 0;
    }

    // 4. Enrich scenarios (is_favorite is always false from server; client manages via localStorage)
    let enriched = scenarios.map((s) => {
      const ratingInfo = ratingMap[s.id] || { avg: 0, count: 0, myRating: null, myComment: null };
      return {
        ...s,
        tags: tagMap[s.id] || [],
        avg_rating: ratingInfo.avg,
        rating_count: ratingInfo.count,
        my_rating: ratingInfo.myRating,
        my_comment: ratingInfo.myComment,
        is_favorite: false,
      };
    });

    // 5. Apply tag filter (post-fetch since tags are in a separate table)
    if (tagFilter) {
      enriched = enriched.filter((s) => s.tags.includes(tagFilter));
    }

    // favorites filter is now handled client-side via localStorage

    // 8. Sort
    const DIFFICULTY_ORDER: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
    enriched.sort((a, b) => {
      switch (sortBy) {
        case 'difficulty':
          return (DIFFICULTY_ORDER[a.difficulty] || 99) - (DIFFICULTY_ORDER[b.difficulty] || 99);
        case 'rating':
          return b.avg_rating - a.avg_rating;
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return a.title.localeCompare(b.title);
      }
    });

    return NextResponse.json({ success: true, scenarios: enriched });
  } catch (error: any) {
    console.error('Error fetching scenario library:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch scenarios' }, { status: 500 });
  }
}
