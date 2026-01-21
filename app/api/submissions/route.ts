import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pollId, name, email, agency, meetingType, respondentRole, availability } = body;

    // Check if submission already exists
    const { data: existing } = await supabase
      .from('submissions')
      .select('id')
      .eq('poll_id', pollId)
      .eq('email', email)
      .single();

    if (existing) {
      // Update existing submission
      const { data, error } = await supabase
        .from('submissions')
        .update({
          name,
          agency,
          meeting_type: meetingType || null, // Keep for backwards compatibility
          respondent_role: respondentRole || null,
          availability,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, submission: data, isUpdate: true });
    } else {
      // Create new submission
      const { data, error } = await supabase
        .from('submissions')
        .insert({
          poll_id: pollId,
          name,
          email,
          agency,
          meeting_type: meetingType || null, // Keep for backwards compatibility
          respondent_role: respondentRole || null,
          availability,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, submission: data, isUpdate: false });
    }
  } catch (error) {
    console.error('Error saving submission:', error);
    return NextResponse.json({ success: false, error: 'Failed to save submission' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pollId = searchParams.get('pollId');

  if (!pollId) {
    return NextResponse.json({ success: false, error: 'Poll ID required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('poll_id', pollId);

    if (error) throw error;

    return NextResponse.json({ success: true, submissions: data });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch submissions' }, { status: 500 });
  }
}
