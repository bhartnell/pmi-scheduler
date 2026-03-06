import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');

    if (auth instanceof NextResponse) return auth;

    const { user, session } = auth;

    const supabase = getSupabaseAdmin();

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role, name')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { internship_id, preceptor_email } = body;

    if (!internship_id || !preceptor_email) {
      return NextResponse.json(
        { success: false, error: 'internship_id and preceptor_email are required' },
        { status: 400 }
      );
    }

    // Validate internship exists and fetch student_id
    const { data: internship, error: internshipError } = await supabase
      .from('student_internships')
      .select('id, student_id')
      .eq('id', internship_id)
      .single();

    if (internshipError || !internship) {
      return NextResponse.json({ success: false, error: 'Internship not found' }, { status: 404 });
    }

    // Generate token
    const token = crypto.randomUUID();

    // expires 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: tokenRecord, error: insertError } = await supabase
      .from('preceptor_eval_tokens')
      .insert({
        token,
        internship_id,
        student_id: internship.student_id,
        preceptor_email: preceptor_email.trim().toLowerCase(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://pmitools.vercel.app';
    const evalLink = `${baseUrl}/preceptor/evaluate/${token}`;

    return NextResponse.json({
      success: true,
      token: tokenRecord,
      link: evalLink,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Error sending preceptor eval token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate evaluation link' },
      { status: 500 }
    );
  }
}
