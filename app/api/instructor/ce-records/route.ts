import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Get current user
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const certificationId = searchParams.get('certificationId');
    const instructorId = searchParams.get('instructorId') || currentUser.id;

    // Only admins can view other instructors' CE records
    if (instructorId !== currentUser.id && currentUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    let query = supabase
      .from('ce_records')
      .select('*')
      .eq('instructor_id', instructorId)
      .order('completion_date', { ascending: false });

    if (certificationId) {
      query = query.eq('certification_id', certificationId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, records: data || [] });
  } catch (error) {
    console.error('Error fetching CE records:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch CE records' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.title?.trim()) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
    }
    if (!body.hours || body.hours <= 0) {
      return NextResponse.json({ success: false, error: 'Hours must be greater than 0' }, { status: 400 });
    }
    if (!body.completion_date) {
      return NextResponse.json({ success: false, error: 'Completion date is required' }, { status: 400 });
    }

    const ceRecord = {
      instructor_id: currentUser.id,
      certification_id: body.certification_id || null,
      title: body.title.trim(),
      provider: body.provider || null,
      hours: parseFloat(body.hours),
      category: body.category || null,
      completion_date: body.completion_date,
      certificate_image_url: body.certificate_image_url || null,
      notes: body.notes || null
    };

    const { data, error } = await supabase
      .from('ce_records')
      .insert(ceRecord)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, record: data });
  } catch (error) {
    console.error('Error creating CE record:', error);
    return NextResponse.json({ success: false, error: 'Failed to create CE record' }, { status: 500 });
  }
}
