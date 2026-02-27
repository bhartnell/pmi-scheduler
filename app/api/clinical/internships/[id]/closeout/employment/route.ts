import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

async function getCallerRole(email: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role ?? null;
}

// GET - Fetch employment verification for this internship
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from('employment_verifications')
      .select('*')
      .eq('internship_id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching employment verification:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to fetch employment verification' }, { status: 500 });
    }

    return NextResponse.json({ success: true, verification: data });
  } catch (error) {
    console.error('Error in employment GET:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch employment verification' }, { status: 500 });
  }
}

// POST - Create employment verification
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const {
      student_name,
      last_four_ssn,
      program,
      phone,
      email,
      address,
      company_name,
      job_title,
      company_address,
      company_email,
      company_phone,
      company_fax,
      employment_start_date,
      starting_salary,
      employment_type,
      verifying_staff_name,
      verifying_staff_title,
      is_draft,
    } = body;

    const record: Record<string, unknown> = {
      internship_id: id,
      student_name: student_name || null,
      last_four_ssn: last_four_ssn || null,
      program: program || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      company_name: company_name || null,
      job_title: job_title || null,
      company_address: company_address || null,
      company_email: company_email || null,
      company_phone: company_phone || null,
      company_fax: company_fax || null,
      employment_start_date: employment_start_date || null,
      starting_salary: starting_salary || null,
      employment_type: employment_type || null,
      verifying_staff_name: verifying_staff_name || null,
      verifying_staff_title: verifying_staff_title || null,
      submitted_by: session.user.email,
    };

    // Only set submitted_at when not a draft
    if (!is_draft) {
      record.submitted_at = new Date().toISOString();
    } else {
      record.submitted_at = null;
    }

    const { data, error } = await supabase
      .from('employment_verifications')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('Error creating employment verification:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to create employment verification' }, { status: 500 });
    }

    return NextResponse.json({ success: true, verification: data });
  } catch (error) {
    console.error('Error in employment POST:', error);
    return NextResponse.json({ success: false, error: 'Failed to create employment verification' }, { status: 500 });
  }
}

// PUT - Update existing employment verification
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const {
      verification_id,
      student_name,
      last_four_ssn,
      program,
      phone,
      email,
      address,
      company_name,
      job_title,
      company_address,
      company_email,
      company_phone,
      company_fax,
      employment_start_date,
      starting_salary,
      employment_type,
      verifying_staff_name,
      verifying_staff_title,
      is_draft,
    } = body;

    if (!verification_id) {
      return NextResponse.json({ success: false, error: 'Verification ID required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      student_name: student_name || null,
      last_four_ssn: last_four_ssn || null,
      program: program || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      company_name: company_name || null,
      job_title: job_title || null,
      company_address: company_address || null,
      company_email: company_email || null,
      company_phone: company_phone || null,
      company_fax: company_fax || null,
      employment_start_date: employment_start_date || null,
      starting_salary: starting_salary || null,
      employment_type: employment_type || null,
      verifying_staff_name: verifying_staff_name || null,
      verifying_staff_title: verifying_staff_title || null,
      submitted_by: session.user.email,
    };

    if (!is_draft) {
      updates.submitted_at = new Date().toISOString();
    } else {
      updates.submitted_at = null;
    }

    const { data, error } = await supabase
      .from('employment_verifications')
      .update(updates)
      .eq('id', verification_id)
      .eq('internship_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating employment verification:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to update employment verification' }, { status: 500 });
    }

    return NextResponse.json({ success: true, verification: data });
  } catch (error) {
    console.error('Error in employment PUT:', error);
    return NextResponse.json({ success: false, error: 'Failed to update employment verification' }, { status: 500 });
  }
}

// DELETE - Remove employment verification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'admin')) {
      return NextResponse.json({ success: false, error: 'Forbidden - admin role required' }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const verificationId = searchParams.get('verificationId');

    if (!verificationId) {
      return NextResponse.json({ success: false, error: 'Verification ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('employment_verifications')
      .delete()
      .eq('id', verificationId)
      .eq('internship_id', id);

    if (error) {
      console.error('Error deleting employment verification:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to delete employment verification' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in employment DELETE:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete employment verification' }, { status: 500 });
  }
}
