import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Fetch daily notes for a date range
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const date = searchParams.get('date');

    // Get instructor
    const { data: user } = await supabase
      .from('lab_users')
      .select('id')
      .eq('email', session.user.email)
      .single();

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    let query = supabase
      .from('instructor_daily_notes')
      .select('*')
      .eq('instructor_id', user.id)
      .order('note_date', { ascending: false });

    if (date) {
      query = query.eq('note_date', date);
    } else if (startDate && endDate) {
      query = query.gte('note_date', startDate).lte('note_date', endDate);
    }

    const { data: notes, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, notes: notes || [] });
  } catch (error) {
    console.error('Error fetching daily notes:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create or update a daily note (upsert)
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, content } = body;

    if (!date) {
      return NextResponse.json({ success: false, error: 'Date is required' }, { status: 400 });
    }

    // Get instructor
    const { data: user } = await supabase
      .from('lab_users')
      .select('id')
      .eq('email', session.user.email)
      .single();

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // If content is empty, delete the note
    if (!content || content.trim() === '') {
      const { error } = await supabase
        .from('instructor_daily_notes')
        .delete()
        .eq('instructor_id', user.id)
        .eq('note_date', date);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, note: null, deleted: true });
    }

    // Upsert: insert or update
    const { data: note, error } = await supabase
      .from('instructor_daily_notes')
      .upsert(
        {
          instructor_id: user.id,
          note_date: date,
          content: content.trim(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'instructor_id,note_date',
        }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error('Error saving daily note:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
