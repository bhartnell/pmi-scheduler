import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET: Fetch signup by edit_token
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = getSupabaseAdmin();

    const { data: signup, error } = await supabase
      .from('open_lab_signups')
      .select('*, session:open_lab_sessions(*)')
      .eq('edit_token', token)
      .single();

    if (error || !signup) {
      return NextResponse.json({ error: 'Signup not found' }, { status: 404 });
    }

    return NextResponse.json({ signup });
  } catch (err) {
    console.error('Fetch signup by token error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update signup by edit_token
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    // Verify signup exists and is not cancelled
    const { data: existing, error: findError } = await supabase
      .from('open_lab_signups')
      .select('id, cancelled_at')
      .eq('edit_token', token)
      .single();

    if (findError || !existing) {
      return NextResponse.json({ error: 'Signup not found' }, { status: 404 });
    }

    if (existing.cancelled_at) {
      return NextResponse.json({ error: 'This signup has been cancelled' }, { status: 400 });
    }

    // Build update object with allowed fields only
    const allowedFields = ['session_id', 'what_to_work_on', 'requested_instructor_id', 'program_level'];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('open_lab_signups')
      .update(updates)
      .eq('id', existing.id)
      .select('*, session:open_lab_sessions(*)')
      .single();

    if (updateError) {
      console.error('Error updating signup:', updateError);
      return NextResponse.json({ error: 'Failed to update signup' }, { status: 500 });
    }

    return NextResponse.json({ signup: updated });
  } catch (err) {
    console.error('Update signup by token error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Cancel signup by edit_token
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = getSupabaseAdmin();

    // Verify signup exists
    const { data: existing, error: findError } = await supabase
      .from('open_lab_signups')
      .select('id, cancelled_at')
      .eq('edit_token', token)
      .single();

    if (findError || !existing) {
      return NextResponse.json({ error: 'Signup not found' }, { status: 404 });
    }

    if (existing.cancelled_at) {
      return NextResponse.json({ error: 'This signup is already cancelled' }, { status: 400 });
    }

    const { error: cancelError } = await supabase
      .from('open_lab_signups')
      .update({ cancelled_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (cancelError) {
      console.error('Error cancelling signup:', cancelError);
      return NextResponse.json({ error: 'Failed to cancel signup' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Signup cancelled successfully' });
  } catch (err) {
    console.error('Cancel signup by token error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
