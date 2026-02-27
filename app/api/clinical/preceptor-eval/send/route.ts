import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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
    const { internship_id, preceptor_email, preceptor_name, student_name } = body;

    if (!internship_id || !preceptor_email) {
      return NextResponse.json(
        { success: false, error: 'internship_id and preceptor_email are required' },
        { status: 400 }
      );
    }

    // Validate internship exists
    const { data: internship, error: internshipError } = await supabase
      .from('student_internships')
      .select('id')
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
        preceptor_email: preceptor_email.trim().toLowerCase(),
        preceptor_name: preceptor_name?.trim() || null,
        student_name: student_name?.trim() || null,
        created_by: callerUser.name || session.user.email,
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
