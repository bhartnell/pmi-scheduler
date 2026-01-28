import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from('clinical_sites')
      .select('*, departments:clinical_site_departments(id, department, is_active)')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, site: data });
  } catch (error) {
    console.error('Error fetching clinical site:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch clinical site' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.abbreviation !== undefined) updateData.abbreviation = body.abbreviation.trim();
    if (body.system !== undefined) updateData.system = body.system?.trim() || null;
    if (body.address !== undefined) updateData.address = body.address?.trim() || null;
    if (body.phone !== undefined) updateData.phone = body.phone?.trim() || null;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data, error } = await supabase
      .from('clinical_sites')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, site: data });
  } catch (error) {
    console.error('Error updating clinical site:', error);
    return NextResponse.json({ success: false, error: 'Failed to update clinical site' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if there are any visits for this site
    const { count } = await supabase
      .from('clinical_site_visits')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', id);

    if (count && count > 0) {
      return NextResponse.json({
        success: false,
        error: 'Cannot delete site with existing visits. Deactivate it instead.'
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('clinical_sites')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting clinical site:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete clinical site' }, { status: 500 });
  }
}
