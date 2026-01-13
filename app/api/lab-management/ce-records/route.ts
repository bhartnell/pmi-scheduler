import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper to get current user's lab_users record
async function getCurrentUser(email: string) {
  const { data } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();
  return data;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const certificationId = searchParams.get('certificationId');
  const instructorId = searchParams.get('instructorId');

  try {
    let query = supabase
      .from('ce_records')
      .select('*')
      .order('completion_date', { ascending: false });

    if (certificationId) {
      query = query.eq('certification_id', certificationId);
    }

    if (instructorId) {
      query = query.eq('instructor_id', instructorId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, records: data });
  } catch (error) {
    console.error('Error fetching CE records:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch CE records' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();

    // Verify the certification belongs to this instructor (or admin)
    if (currentUser.role !== 'admin') {
      const { data: cert } = await supabase
        .from('instructor_certifications')
        .select('instructor_id')
        .eq('id', body.certification_id)
        .single();

      if (cert?.instructor_id !== currentUser.id) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
    }

    // Get the instructor_id from the certification
    const { data: cert } = await supabase
      .from('instructor_certifications')
      .select('instructor_id')
      .eq('id', body.certification_id)
      .single();

    const recordData = {
      instructor_id: cert?.instructor_id,
      certification_id: body.certification_id,
      title: body.title,
      provider: body.provider || null,
      hours: body.hours,
      category: body.category || null,
      completion_date: body.completion_date,
      certificate_image_url: body.certificate_image_url || null,
      notes: body.notes || null,
    };

    const { data, error } = await supabase
      .from('ce_records')
      .insert(recordData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, record: data });
  } catch (error) {
    console.error('Error creating CE record:', error);
    return NextResponse.json({ success: false, error: 'Failed to create CE record' }, { status: 500 });
  }
}
