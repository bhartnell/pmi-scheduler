import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - List saved team availability views for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('team_availability_views')
      .select('id, name, instructor_emails, created_by, created_at')
      .eq('created_by', session.user.email.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, views: data || [] });
  } catch (error) {
    console.error('Error fetching saved team views:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch saved views' }, { status: 500 });
  }
}

// DELETE - Remove a saved team availability view by ID
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'View ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Ensure only the creator can delete their view
    const { data: existing, error: fetchError } = await supabase
      .from('team_availability_views')
      .select('id, created_by')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: 'View not found' }, { status: 404 });
    }

    if (existing.created_by.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'You can only delete your own saved views' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('team_availability_views')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team view:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete team view' }, { status: 500 });
  }
}
