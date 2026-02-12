import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Helper to get current user's lab_users record
async function getCurrentUser(email: string) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();
  return data;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const instructorId = searchParams.get('instructorId');
  const includeExpired = searchParams.get('includeExpired') === 'true';

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('instructor_certifications')
      .select(`
        *,
        instructor:lab_users(id, name, email),
        ce_requirement:ce_requirements(id, display_name, total_hours_required, cycle_years)
      `)
      .order('expiration_date', { ascending: true });

    if (instructorId) {
      query = query.eq('instructor_id', instructorId);
    }

    if (!includeExpired) {
      // Only show non-expired by default (expired within last 30 days still shown)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte('expiration_date', thirtyDaysAgo.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, certifications: data });
  } catch (error) {
    console.error('Error fetching certifications:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch certifications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();

    // If instructorId provided and user is admin, use that; otherwise use current user's ID
    let instructorId = currentUser.id;
    if (body.instructor_id && currentUser.role === 'admin') {
      instructorId = body.instructor_id;
    }

    const certData = {
      instructor_id: instructorId,
      cert_name: body.cert_name,
      cert_number: body.cert_number || null,
      issuing_body: body.issuing_body || null,
      issue_date: body.issue_date || null,
      expiration_date: body.expiration_date,
      card_image_url: body.card_image_url || null,
      ce_requirement_id: body.ce_requirement_id || null,
    };

    const { data, error } = await supabase
      .from('instructor_certifications')
      .insert(certData)
      .select(`
        *,
        instructor:lab_users(id, name, email),
        ce_requirement:ce_requirements(id, display_name, total_hours_required, cycle_years)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, certification: data });
  } catch (error) {
    console.error('Error creating certification:', error);
    return NextResponse.json({ success: false, error: 'Failed to create certification' }, { status: 500 });
  }
}
