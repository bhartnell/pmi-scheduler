import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { nanoid } from 'nanoid';
import { getServerSession } from 'next-auth';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, mode, startDate, numWeeks, weekdaysOnly, createdBy, availableSlots } = body;

    const participantId = nanoid(10);
    const adminId = nanoid(10);
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    const { data, error } = await supabase
      .from('polls')
      .insert({
        title,
        description,
        mode,
        start_date: startDate,
        num_weeks: numWeeks,
        weekdays_only: weekdaysOnly,
        created_by: createdBy,
        participant_link: `${baseUrl}/poll/${participantId}`,
        admin_link: `${baseUrl}/admin/poll/${adminId}`,
        available_slots: availableSlots || [],
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, poll: data });
  } catch (error) {
    console.error('Error creating poll:', error);
    return NextResponse.json({ success: false, error: 'Failed to create poll' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const link = searchParams.get('link');
  const createdBy = searchParams.get('createdBy');

  // If createdBy is provided, get all polls for that user
  if (createdBy) {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .eq('created_by', createdBy)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return NextResponse.json({ success: true, polls: data });
    } catch (error) {
      console.error('Error fetching polls:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch polls' }, { status: 500 });
    }
  }

  // Otherwise, get a single poll by link
  if (!link) {
    return NextResponse.json({ success: false, error: 'Link or createdBy required' }, { status: 400 });
  }

  try {
    const safeLink = link.replace(/[%_,.()\\/]/g, '');
    const { data, error } = await supabase
      .from('polls')
      .select('*')
      .or(`participant_link.eq.${safeLink},admin_link.eq.${safeLink}`)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, poll: data });
  } catch (error) {
    console.error('Error fetching poll:', error);
    return NextResponse.json({ success: false, error: 'Poll not found' }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const pollId = searchParams.get('id');

    if (!pollId) {
      return NextResponse.json({ success: false, error: 'Poll ID required' }, { status: 400 });
    }

    // First, delete all submissions associated with this poll
    const { error: submissionsError } = await supabase
      .from('submissions')
      .delete()
      .eq('poll_id', pollId);

    if (submissionsError) {
      console.error('Error deleting submissions:', submissionsError);
      // Continue anyway - poll might not have submissions
    }

    // Then delete the poll itself
    const { error: pollError } = await supabase
      .from('polls')
      .delete()
      .eq('id', pollId);

    if (pollError) throw pollError;

    return NextResponse.json({ success: true, message: 'Poll deleted successfully' });
  } catch (error) {
    console.error('Error deleting poll:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete poll' }, { status: 500 });
  }
}
