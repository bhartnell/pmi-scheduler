import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, mode, startDate, numWeeks, weekdaysOnly, createdBy } = body;

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
  const searchParams = request.nextUrl.searchParams;
  const link = searchParams.get('link');

  if (!link) {
    return NextResponse.json({ success: false, error: 'Link required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('polls')
      .select('*')
      .or(`participant_link.eq.${link},admin_link.eq.${link}`)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, poll: data });
  } catch (error) {
    console.error('Error fetching poll:', error);
    return NextResponse.json({ success: false, error: 'Poll not found' }, { status: 404 });
  }
}