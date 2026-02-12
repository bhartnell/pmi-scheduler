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
      .from('agencies')
      .select('*, agency_contacts(*)')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, agency: data });
  } catch (error) {
    console.error('Error fetching agency:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch agency' }, { status: 500 });
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

    const updateData: Record<string, any> = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.abbreviation !== undefined) updateData.abbreviation = body.abbreviation?.trim() || null;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.address !== undefined) updateData.address = body.address?.trim() || null;
    if (body.phone !== undefined) updateData.phone = body.phone?.trim() || null;
    if (body.website !== undefined) updateData.website = body.website?.trim() || null;
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data, error } = await supabase
      .from('agencies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, agency: data });
  } catch (error) {
    console.error('Error updating agency:', error);
    return NextResponse.json({ success: false, error: 'Failed to update agency' }, { status: 500 });
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
      .from('agencies')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting agency:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete agency' }, { status: 500 });
  }
}
