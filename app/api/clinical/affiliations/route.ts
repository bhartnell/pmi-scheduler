import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAffiliations, canEditAffiliations } from '@/lib/permissions';

async function getAuthenticatedUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('lab_users')
    .select('id, role, email')
    .ilike('email', email)
    .single();
  return user;
}

// GET /api/clinical/affiliations
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !canAccessAffiliations(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  try {
    let query = supabase
      .from('clinical_affiliations')
      .select('*')
      .order('expiration_date', { ascending: true });

    if (status && status !== 'all') {
      query = query.eq('agreement_status', status);
    }

    if (search) {
      query = query.ilike('site_name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      if (error.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, affiliations: [] });
      }
      throw error;
    }

    return NextResponse.json({ success: true, affiliations: data || [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json({ success: true, affiliations: [] });
    }
    console.error('Error fetching affiliations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch affiliations' },
      { status: 500 }
    );
  }
}

// POST /api/clinical/affiliations
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !canEditAffiliations(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const {
      site_name,
      agreement_status = 'active',
      start_date,
      expiration_date,
      responsible_person,
      responsible_person_email,
      notes,
      document_url,
      auto_renew = false,
    } = body;

    if (!site_name || typeof site_name !== 'string' || !site_name.trim()) {
      return NextResponse.json({ error: 'site_name is required' }, { status: 400 });
    }
    if (!expiration_date) {
      return NextResponse.json({ error: 'expiration_date is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('clinical_affiliations')
      .insert({
        site_name: site_name.trim(),
        agreement_status,
        start_date: start_date || null,
        expiration_date,
        responsible_person: responsible_person?.trim() || null,
        responsible_person_email: responsible_person_email?.trim() || null,
        notes: notes?.trim() || null,
        document_url: document_url?.trim() || null,
        auto_renew,
        created_by: session.user.email,
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, affiliation: data });
  } catch (error: unknown) {
    console.error('Error creating affiliation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create affiliation' },
      { status: 500 }
    );
  }
}

// PUT /api/clinical/affiliations
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !canEditAffiliations(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Validate status if provided
    if (updates.agreement_status) {
      const validStatuses = ['active', 'expired', 'pending_renewal', 'terminated'];
      if (!validStatuses.includes(updates.agreement_status)) {
        return NextResponse.json({ error: 'Invalid agreement_status' }, { status: 400 });
      }
    }

    // Sanitize string fields
    const sanitized: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.site_name !== undefined) sanitized.site_name = updates.site_name?.trim();
    if (updates.agreement_status !== undefined) sanitized.agreement_status = updates.agreement_status;
    if (updates.start_date !== undefined) sanitized.start_date = updates.start_date || null;
    if (updates.expiration_date !== undefined) sanitized.expiration_date = updates.expiration_date;
    if (updates.responsible_person !== undefined) sanitized.responsible_person = updates.responsible_person?.trim() || null;
    if (updates.responsible_person_email !== undefined) sanitized.responsible_person_email = updates.responsible_person_email?.trim() || null;
    if (updates.notes !== undefined) sanitized.notes = updates.notes?.trim() || null;
    if (updates.document_url !== undefined) sanitized.document_url = updates.document_url?.trim() || null;
    if (updates.auto_renew !== undefined) sanitized.auto_renew = updates.auto_renew;

    const { data, error } = await supabase
      .from('clinical_affiliations')
      .update(sanitized)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, affiliation: data });
  } catch (error: unknown) {
    console.error('Error updating affiliation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update affiliation' },
      { status: 500 }
    );
  }
}

// DELETE /api/clinical/affiliations?id=uuid
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getAuthenticatedUser(session.user.email);
  if (!user || !canEditAffiliations(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('clinical_affiliations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting affiliation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete affiliation' },
      { status: 500 }
    );
  }
}
