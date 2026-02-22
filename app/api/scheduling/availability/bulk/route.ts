import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Helper to get current user
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// POST - Create multiple availability entries (for recurring)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { entries } = body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ success: false, error: 'Entries array is required' }, { status: 400 });
    }

    // Limit to 52 entries (one year of weekly entries)
    if (entries.length > 52) {
      return NextResponse.json({ success: false, error: 'Maximum 52 entries allowed per request' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Prepare entries with instructor_id
    const records = entries.map((entry: {
      date: string;
      start_time?: string;
      end_time?: string;
      is_all_day?: boolean;
      notes?: string;
    }) => ({
      instructor_id: currentUser.id,
      date: entry.date,
      start_time: entry.is_all_day ? null : entry.start_time,
      end_time: entry.is_all_day ? null : entry.end_time,
      is_all_day: entry.is_all_day || false,
      notes: entry.notes || null,
    }));

    // Use upsert to handle duplicates gracefully
    const { data: created, error } = await supabase
      .from('instructor_availability')
      .upsert(records, {
        onConflict: 'instructor_id,date,start_time',
        ignoreDuplicates: true
      })
      .select(`
        *,
        instructor:instructor_id(id, name, email)
      `);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      availability: created || [],
      created_count: created?.length || 0
    });
  } catch (error) {
    console.error('Error creating bulk availability:', error);
    return NextResponse.json({ success: false, error: 'Failed to create availability entries' }, { status: 500 });
  }
}

// DELETE - Delete multiple availability entries
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'IDs array is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Delete only entries belonging to the current user
    const { error, count } = await supabase
      .from('instructor_availability')
      .delete({ count: 'exact' })
      .in('id', ids)
      .eq('instructor_id', currentUser.id);

    if (error) throw error;

    return NextResponse.json({ success: true, deleted_count: count });
  } catch (error) {
    console.error('Error deleting bulk availability:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete availability entries' }, { status: 500 });
  }
}
