import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const searchParams = request.nextUrl.searchParams;
  const instructorId = searchParams.get('instructorId');
  const includeExpired = searchParams.get('includeExpired') === 'true';

  try {
    const supabase = getSupabaseAdmin();
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
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();

    const body = await request.json();

    // If instructorId provided and user is admin, use that; otherwise use current user's ID
    let instructorId = user.id;
    if (body.instructor_id && (user.role === 'admin' || user.role === 'superadmin')) {
      instructorId = body.instructor_id;
    }

    // Auto-calculate expiration_date from issue_date + cycle_years if not manually set
    let expirationDate = body.expiration_date;
    if (!expirationDate && body.issue_date && body.ce_requirement_id) {
      const { data: ceReq } = await supabase
        .from('ce_requirements')
        .select('cycle_years')
        .eq('id', body.ce_requirement_id)
        .single();

      if (ceReq?.cycle_years) {
        const issue = new Date(body.issue_date + 'T12:00:00');
        issue.setDate(issue.getDate() + ceReq.cycle_years * 365);
        expirationDate = issue.toISOString().split('T')[0];
      }
    }

    const certData = {
      instructor_id: instructorId,
      cert_name: body.cert_name,
      cert_number: body.cert_number || null,
      issuing_body: body.issuing_body || null,
      issue_date: body.issue_date || null,
      expiration_date: expirationDate,
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
