import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getServerSession } from 'next-auth';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { pollId, name, email, agency, meetingType, respondentRole, availability } = body;

    // Check if submission already exists
    const { data: existing, error: checkError } = await supabase
      .from('submissions')
      .select('id')
      .eq('poll_id', pollId)
      .eq('email', email)
      .single();

    // Ignore "no rows" error (PGRST116) - that just means no existing submission
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing submission:', checkError);
    }

    if (existing) {
      // Update existing submission
      const { data, error } = await supabase
        .from('submissions')
        .update({
          name,
          agency,
          meeting_type: meetingType || null,
          respondent_role: respondentRole || null,
          availability,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Supabase update error:', error);
        return NextResponse.json({
          success: false,
          error: error.message || 'Failed to update submission'
        }, { status: 500 });
      }
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
          meeting_type: meetingType || null,
          respondent_role: respondentRole || null,
          availability,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        return NextResponse.json({
          success: false,
          error: error.message || 'Failed to create submission'
        }, { status: 500 });
      }
      return NextResponse.json({ success: true, submission: data, isUpdate: false });
    }
  } catch (error: any) {
    console.error('Error saving submission:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to save submission'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
