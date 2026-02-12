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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from('field_preceptors')
      .select('*, agencies(id, name, abbreviation, type)')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, preceptor: data });
  } catch (error) {
    console.error('Error fetching preceptor:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch preceptor' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.first_name !== undefined) updateData.first_name = body.first_name.trim();
    if (body.last_name !== undefined) updateData.last_name = body.last_name.trim();
    if (body.email !== undefined) updateData.email = body.email?.trim() || null;
    if (body.phone !== undefined) updateData.phone = body.phone?.trim() || null;
    if (body.station !== undefined) updateData.station = body.station?.trim() || null;
    if (body.normal_schedule !== undefined) updateData.normal_schedule = body.normal_schedule?.trim() || null;
    if (body.snhd_trained_date !== undefined) updateData.snhd_trained_date = body.snhd_trained_date || null;
    if (body.snhd_cert_expires !== undefined) updateData.snhd_cert_expires = body.snhd_cert_expires || null;
    if (body.max_students !== undefined) updateData.max_students = body.max_students;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;

    // Handle agency update
    if (body.agency_id !== undefined) {
      updateData.agency_id = body.agency_id || null;
      // Get agency name if agency_id is provided
      if (body.agency_id) {
        const { data: agency } = await supabase
          .from('agencies')
          .select('name')
          .eq('id', body.agency_id)
          .single();
        updateData.agency_name = agency?.name || null;
      } else {
        updateData.agency_name = null;
      }
    }

    const { data, error } = await supabase
      .from('field_preceptors')
      .update(updateData)
      .eq('id', id)
      .select('*, agencies(id, name, abbreviation, type)')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, preceptor: data });
  } catch (error) {
    console.error('Error updating preceptor:', error);
    return NextResponse.json({ success: false, error: 'Failed to update preceptor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { error } = await supabase
      .from('field_preceptors')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting preceptor:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete preceptor' }, { status: 500 });
  }
}
