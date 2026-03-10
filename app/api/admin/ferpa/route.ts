import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET /api/admin/ferpa
//
// Returns FERPA compliance dashboard data: consent stats, FERPA releases,
// agency users, recent access log, and agreement versions.
// Admin+ only.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();
  const tab = request.nextUrl.searchParams.get('tab') || 'consent';

  try {
    if (tab === 'consent') {
      return await getConsentStats(supabase);
    } else if (tab === 'releases') {
      return await getFerpaReleases(supabase);
    } else if (tab === 'agency-users') {
      return await getAgencyUsers(supabase);
    } else if (tab === 'access-log') {
      const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
      const dataType = request.nextUrl.searchParams.get('data_type') || null;
      const action = request.nextUrl.searchParams.get('action') || null;
      return await getAccessLog(supabase, page, dataType, action);
    } else if (tab === 'agreements') {
      return await getAgreementVersions(supabase);
    }

    return NextResponse.json({ error: 'Invalid tab parameter' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching FERPA dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/ferpa
//
// Admin actions: publish new agreement version, send consent reminders.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const body = await request.json();
  const { action: actionType } = body;

  const supabase = getSupabaseAdmin();

  try {
    if (actionType === 'publish_agreement') {
      const { agreement_name, text } = body;
      if (!agreement_name || !text) {
        return NextResponse.json({ error: 'agreement_name and text are required' }, { status: 400 });
      }

      // Get current max version
      const { data: current } = await supabase
        .from('ai_prompt_templates')
        .select('version')
        .eq('name', agreement_name)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      const newVersion = (current?.version || 0) + 1;

      // Deactivate old versions
      await supabase
        .from('ai_prompt_templates')
        .update({ is_active: false })
        .eq('name', agreement_name);

      // Insert new version
      const { error } = await supabase
        .from('ai_prompt_templates')
        .insert({
          name: agreement_name,
          prompt_text: text,
          version: newVersion,
          is_active: true,
          created_by: user.email,
        });

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Published version ${newVersion} of ${agreement_name}`,
        version: newVersion,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in FERPA admin action:', error);
    return NextResponse.json(
      { error: 'Action failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

async function getConsentStats(supabase: ReturnType<typeof getSupabaseAdmin>) {
  // Get consent counts grouped by agreement_type
  const { data: consents } = await supabase
    .from('data_consent_agreements')
    .select('agreement_type, user_email, accepted')
    .eq('accepted', true);

  // Count users by role who should have consented
  const { data: students } = await supabase
    .from('lab_users')
    .select('email')
    .eq('role', 'student')
    .eq('is_active', true);

  const { data: agencyUsers } = await supabase
    .from('lab_users')
    .select('email')
    .in('role', ['agency_liaison', 'agency_observer'])
    .eq('is_active', true);

  const studentEmails = new Set((students || []).map(s => s.email?.toLowerCase()));
  const agencyEmails = new Set((agencyUsers || []).map(u => u.email?.toLowerCase()));

  const studentConsents = new Set(
    (consents || [])
      .filter(c => c.agreement_type === 'student_data_use')
      .map(c => c.user_email?.toLowerCase())
  );

  const agencyConsents = new Set(
    (consents || [])
      .filter(c => c.agreement_type === 'agency_data_sharing')
      .map(c => c.user_email?.toLowerCase())
  );

  // Find users who haven't consented
  const studentsPending = [...studentEmails].filter(e => !studentConsents.has(e));
  const agencyPending = [...agencyEmails].filter(e => !agencyConsents.has(e));

  return NextResponse.json({
    studentConsent: {
      total: studentEmails.size,
      accepted: studentConsents.size,
      pending: studentsPending.length,
      pendingEmails: studentsPending,
    },
    agencyConsent: {
      total: agencyEmails.size,
      accepted: agencyConsents.size,
      pending: agencyPending.length,
      pendingEmails: agencyPending,
    },
  });
}

async function getFerpaReleases(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, cohort_id, status, ferpa_agency_release, ferpa_release_date, ferpa_release_agency')
    .order('last_name', { ascending: true });

  // Group by agency
  const byAgency: Record<string, typeof students> = {};
  for (const s of students || []) {
    const agency = s.ferpa_release_agency || 'No Agency';
    if (!byAgency[agency]) byAgency[agency] = [];
    byAgency[agency].push(s);
  }

  return NextResponse.json({
    students: students || [],
    byAgency,
    totalStudents: students?.length || 0,
    releasedCount: (students || []).filter(s => s.ferpa_agency_release).length,
  });
}

async function getAgencyUsers(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data: users } = await supabase
    .from('lab_users')
    .select('id, name, email, role, agency_affiliation, agency_scope, is_active, last_login')
    .in('role', ['agency_liaison', 'agency_observer'])
    .order('name', { ascending: true });

  // Check consent status for each
  const { data: consents } = await supabase
    .from('data_consent_agreements')
    .select('user_email, accepted, accepted_at')
    .eq('agreement_type', 'agency_data_sharing')
    .eq('accepted', true);

  const consentMap = new Map(
    (consents || []).map(c => [c.user_email?.toLowerCase(), c.accepted_at])
  );

  const enriched = (users || []).map(u => ({
    ...u,
    hasConsent: consentMap.has(u.email?.toLowerCase()),
    consentDate: consentMap.get(u.email?.toLowerCase()) || null,
  }));

  return NextResponse.json({ agencyUsers: enriched });
}

async function getAccessLog(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  page: number,
  dataType: string | null,
  action: string | null
) {
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('record_access_log')
    .select('*', { count: 'exact' })
    .order('accessed_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (dataType) query = query.eq('data_type', dataType);
  if (action) query = query.eq('action', action);

  const { data: entries, count, error } = await query;
  if (error) throw error;

  return NextResponse.json({
    entries: entries || [],
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  });
}

async function getAgreementVersions(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data: templates } = await supabase
    .from('ai_prompt_templates')
    .select('id, name, prompt_text, version, is_active, created_by, created_at')
    .in('name', ['student_data_use_agreement', 'agency_data_sharing_agreement'])
    .order('name', { ascending: true })
    .order('version', { ascending: false });

  return NextResponse.json({ agreements: templates || [] });
}
