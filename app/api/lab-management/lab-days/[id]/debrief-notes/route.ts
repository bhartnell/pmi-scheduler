import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

type RouteContext = { params: Promise<{ id: string }> };

const VALID_CATEGORIES = [
  'general', 'timing', 'station_feedback', 'student_performance',
  'equipment', 'improvement', 'positive',
];

// ---------------------------------------------------------------------------
// GET /api/lab-management/lab-days/[id]/debrief-notes
// Fetch all debrief notes for a lab day, sorted by created_at
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('lab_day_debrief_notes')
      .select('*')
      .eq('lab_day_id', labDayId)
      .order('created_at', { ascending: true });

    if (error) {
      if (error.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, notes: [] });
      }
      throw error;
    }

    return NextResponse.json({ success: true, notes: data || [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json({ success: true, notes: [] });
    }
    console.error('Error fetching debrief notes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch debrief notes' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/lab-management/lab-days/[id]/debrief-notes
// Add a new debrief note
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { content, category } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'content is required and must be non-empty' },
        { status: 400 }
      );
    }

    const noteCategory = category && VALID_CATEGORIES.includes(category)
      ? category
      : 'general';

    // Look up the author in lab_users
    const { data: labUser } = await supabase
      .from('lab_users')
      .select('id, name')
      .ilike('email', user.email)
      .maybeSingle();

    const { data: note, error } = await supabase
      .from('lab_day_debrief_notes')
      .insert({
        lab_day_id: labDayId,
        author_id: labUser?.id || null,
        author_name: labUser?.name || user.email,
        category: noteCategory,
        content: content.trim(),
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, note });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json(
        { success: false, error: 'Debrief notes feature is not yet configured. Please run database migrations.' },
        { status: 503 }
      );
    }
    console.error('Error creating debrief note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create debrief note' },
      { status: 500 }
    );
  }
}
