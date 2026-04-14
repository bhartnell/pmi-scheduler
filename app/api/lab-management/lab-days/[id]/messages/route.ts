import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrVolunteerToken } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

const VALID_MESSAGE_TYPES = ['chat', 'alert', 'system'] as const;

// POST /api/lab-management/lab-days/[id]/messages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: labDayId } = await params;

  const auth = await requireAuthOrVolunteerToken(request, 'instructor');
  if (auth instanceof NextResponse) return auth;

  let body: { message?: string; station_context?: string; message_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { message, station_context, message_type = 'chat' } = body;

  // Validate message
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Message is required' },
      { status: 400 }
    );
  }
  if (message.length > 500) {
    return NextResponse.json(
      { success: false, error: 'Message must be 500 characters or fewer' },
      { status: 400 }
    );
  }

  // Validate message_type
  if (!VALID_MESSAGE_TYPES.includes(message_type as typeof VALID_MESSAGE_TYPES[number])) {
    return NextResponse.json(
      { success: false, error: `Invalid message_type. Must be one of: ${VALID_MESSAGE_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  // Resolve sender info from auth context
  let senderName: string;
  let senderEmail: string;
  let senderRole: string;

  if ('isVolunteerToken' in auth && auth.isVolunteerToken) {
    // Volunteer token auth — look up email from volunteer_lab_tokens table
    senderName = auth.volunteerName;
    senderRole = auth.role;

    const supabase = getSupabaseAdmin();
    const { data: tokenRow } = await supabase
      .from('volunteer_lab_tokens')
      .select('volunteer_email')
      .eq('id', auth.tokenId)
      .single();

    senderEmail = tokenRow?.volunteer_email || `${auth.volunteerName.toLowerCase().replace(/\s+/g, '.')}@volunteer.local`;

    // Ensure volunteer token is scoped to this lab day
    if (auth.labDayId !== labDayId) {
      return NextResponse.json(
        { success: false, error: 'Volunteer token is not valid for this lab day' },
        { status: 403 }
      );
    }
  } else if ('user' in auth) {
    // Session auth
    senderName = auth.user.name;
    senderEmail = auth.user.email;
    senderRole = auth.user.role;
  } else {
    return NextResponse.json(
      { success: false, error: 'Unable to resolve sender identity' },
      { status: 500 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: inserted, error } = await supabase
    .from('lab_day_messages')
    .insert({
      lab_day_id: labDayId,
      sender_name: senderName,
      sender_email: senderEmail,
      sender_role: senderRole,
      message: message.trim(),
      message_type,
      station_context: station_context || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to insert lab_day_message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send message' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: inserted }, { status: 201 });
}

// GET /api/lab-management/lab-days/[id]/messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: labDayId } = await params;

  const auth = await requireAuthOrVolunteerToken(request, 'instructor');
  if (auth instanceof NextResponse) return auth;

  // If volunteer token, ensure it's scoped to this lab day
  if ('isVolunteerToken' in auth && auth.isVolunteerToken) {
    if (auth.labDayId !== labDayId) {
      return NextResponse.json(
        { success: false, error: 'Volunteer token is not valid for this lab day' },
        { status: 403 }
      );
    }
  }

  // Parse query params
  const url = request.nextUrl;
  const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 50 : limitParam), 100);
  const before = url.searchParams.get('before');

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('lab_day_messages')
    .select('*')
    .eq('lab_day_id', labDayId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data: messages, error } = await query;

  if (error) {
    console.error('Failed to fetch lab_day_messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, messages: messages || [] });
}
