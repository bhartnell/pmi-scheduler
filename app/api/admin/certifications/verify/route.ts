import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

/**
 * PUT /api/admin/certifications/verify
 * Update the verification status of a certification.
 * Body: { certification_id, verification_status, verification_notes? }
 */

async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { certification_id, verification_status, verification_notes } = body;

    if (!certification_id) {
      return NextResponse.json(
        { success: false, error: 'certification_id is required' },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'verified', 'expired', 'rejected'];
    if (!verification_status || !validStatuses.includes(verification_status)) {
      return NextResponse.json(
        { success: false, error: `verification_status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Confirm the certification exists
    const { data: existing, error: fetchError } = await supabase
      .from('instructor_certifications')
      .select('id')
      .eq('id', certification_id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: 'Certification not found' }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('instructor_certifications')
      .update({
        verification_status,
        verified_by: session.user.email,
        verified_at: new Date().toISOString(),
        verification_notes: verification_notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', certification_id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: `Certification marked as ${verification_status}.`,
      verification_status,
      verified_by: session.user.email,
    });
  } catch (error) {
    console.error('Error updating certification verification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update certification verification' },
      { status: 500 }
    );
  }
}
