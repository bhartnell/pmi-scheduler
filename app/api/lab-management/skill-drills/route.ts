import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// GET /api/lab-management/skill-drills
// List all active skill drills, optionally filtered by category
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const includeInactive = searchParams.get('includeInactive') === 'true';

  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('skill_drills')
      .select('id, name, description, category, estimated_duration, equipment_needed, instructions, created_by, is_active, created_at, updated_at')
      .order('category')
      .order('name');

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      const safeSearch = search.replace(/[%_,.()\\/]/g, '');
      query = query.or(`name.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,category.ilike.%${safeSearch}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, drills: data });
  } catch (error) {
    console.error('Error fetching skill drills:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch skill drills' }, { status: 500 });
  }
}

// POST /api/lab-management/skill-drills
// Create a new skill drill (instructor+ role required)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Check role
  const { data: requestingUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  const userRole = requestingUser?.role || 'guest';
  if (!hasMinRole(userRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden: instructor role required' }, { status: 403 });
  }

  try {
    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }
    if (!body.category?.trim()) {
      return NextResponse.json({ success: false, error: 'Category is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('skill_drills')
      .insert({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        category: body.category.trim(),
        estimated_duration: body.estimated_duration ? parseInt(body.estimated_duration) : 15,
        equipment_needed: Array.isArray(body.equipment_needed) ? body.equipment_needed.filter((e: string) => e.trim()) : [],
        instructions: body.instructions?.trim() || null,
        created_by: session.user.email,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, drill: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating skill drill:', error);
    return NextResponse.json({ success: false, error: 'Failed to create skill drill' }, { status: 500 });
  }
}
