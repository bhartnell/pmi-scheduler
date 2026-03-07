// ---------------------------------------------------------------------------
// GET/POST /api/admin/cases/briefs — Case Brief Catalog Management
// ---------------------------------------------------------------------------
// GET: List all briefs with optional filters (batch, category, difficulty, status)
// POST: Add a custom brief to the catalog
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET — List briefs
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const batch = searchParams.get('batch');
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const status = searchParams.get('status');

    let query = supabase
      .from('case_briefs')
      .select('*')
      .order('created_at', { ascending: false });

    if (batch && batch !== 'all') {
      query = query.eq('batch_name', batch);
    }
    if (category && category !== 'all') {
      query = query.ilike('category', category);
    }
    if (difficulty && difficulty !== 'all') {
      query = query.eq('difficulty', difficulty);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching briefs:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Get unique batch names for filter dropdown
    const { data: batchData } = await supabase
      .from('case_briefs')
      .select('batch_name')
      .not('batch_name', 'is', null)
      .order('batch_name');

    const batches = [...new Set((batchData || []).map((b: { batch_name: string }) => b.batch_name))];

    return NextResponse.json({
      success: true,
      briefs: data || [],
      batches,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/cases/briefs:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Add a custom brief
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();

    // Validate required fields
    if (!body.category || !body.subcategory || !body.difficulty || !body.scenario) {
      return NextResponse.json(
        { success: false, error: 'category, subcategory, difficulty, and scenario are required' },
        { status: 400 }
      );
    }

    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (!validDifficulties.includes(body.difficulty)) {
      return NextResponse.json(
        { success: false, error: `difficulty must be one of: ${validDifficulties.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const briefRecord = {
      category: body.category,
      subcategory: body.subcategory,
      difficulty: body.difficulty,
      programs: body.programs || ['Paramedic'],
      scenario: body.scenario,
      special_instructions: body.special_instructions || null,
      batch_name: body.batch_name || 'Custom',
      status: 'pending',
    };

    const { data, error } = await supabase
      .from('case_briefs')
      .insert(briefRecord)
      .select('*')
      .single();

    if (error) {
      console.error('Error inserting brief:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, brief: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/admin/cases/briefs:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
