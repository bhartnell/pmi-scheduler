import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

/**
 * GET /api/admin/certifications
 * Returns all instructor certifications with verification info.
 * Supports optional ?status=pending|verified|expired|rejected filter.
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    // Fetch all certifications joined with the owning user
    let query = supabase
      .from('instructor_certifications')
      .select(`
        id,
        name,
        cert_type,
        cert_number,
        issuing_authority,
        expires_at,
        document_url,
        verification_status,
        verified_by,
        verified_at,
        verification_notes,
        created_at,
        updated_at,
        user_id
      `)
      .order('created_at', { ascending: false });

    if (statusFilter && ['pending', 'verified', 'expired', 'rejected'].includes(statusFilter)) {
      query = query.eq('verification_status', statusFilter);
    }

    const { data: certifications, error: certsError } = await query;
    if (certsError) throw certsError;

    // Fetch user details for all returned certs
    const userIds = [...new Set((certifications || []).map((c: { user_id: string }) => c.user_id))];
    let usersMap: Record<string, { id: string; name: string; email: string; role: string }> = {};

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('lab_users')
        .select('id, name, email, role')
        .in('id', userIds);

      (users || []).forEach((u: { id: string; name: string; email: string; role: string }) => {
        usersMap[u.id] = u;
      });
    }

    // Merge user info into each cert record
    const enriched = (certifications || []).map((cert: Record<string, unknown>) => ({
      ...cert,
      instructor_name: usersMap[cert.user_id as string]?.name ?? null,
      instructor_email: usersMap[cert.user_id as string]?.email ?? null,
      instructor_role: usersMap[cert.user_id as string]?.role ?? null,
    }));

    // Summary counts by verification_status
    const counts = {
      pending: 0,
      verified: 0,
      expired: 0,
      rejected: 0,
    };
    enriched.forEach((c: Record<string, unknown>) => {
      const vs = (c.verification_status as string) || 'pending';
      if (vs in counts) counts[vs as keyof typeof counts]++;
    });

    return NextResponse.json({
      success: true,
      certifications: enriched,
      counts,
    });
  } catch (error) {
    console.error('Error fetching certifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch certifications' },
      { status: 500 }
    );
  }
}
