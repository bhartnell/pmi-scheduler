import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - List all timer display tokens (admin only)
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!currentUser || !['superadmin', 'admin', 'lead_instructor', 'instructor', 'volunteer_instructor'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden: Instructor access required' }, { status: 403 });
    }

    // First try with location join
    let tokens = null;
    let queryError = null;

    const { data: tokensWithJoin, error: joinError } = await supabase
      .from('timer_display_tokens')
      .select(`
        *,
        location:locations(id, name)
      `)
      .order('created_at', { ascending: false });

    if (joinError) {
      // Table might not exist
      if (joinError.code === '42P01') {
        return NextResponse.json({ success: true, tokens: [], tableExists: false });
      }
      // If the join fails (e.g., locations table issue), try without join
      if (joinError.message?.includes('relationship') || joinError.message?.includes('locations') || joinError.code === 'PGRST200') {
        console.warn('Timer display: locations join failed, fetching without join:', joinError.message);
        const { data: tokensNoJoin, error: noJoinError } = await supabase
          .from('timer_display_tokens')
          .select('*')
          .order('created_at', { ascending: false });

        if (noJoinError) {
          if (noJoinError.code === '42P01') {
            return NextResponse.json({ success: true, tokens: [], tableExists: false });
          }
          queryError = noJoinError;
        } else {
          tokens = tokensNoJoin;
        }
      } else {
        queryError = joinError;
      }
    } else {
      tokens = tokensWithJoin;
    }

    if (queryError) throw queryError;

    return NextResponse.json({ success: true, tokens: tokens || [] });
  } catch (error: unknown) {
    console.error('Error fetching timer tokens:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch timer tokens';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST - Create a new timer display token
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!currentUser || !['superadmin', 'admin', 'lead_instructor', 'instructor', 'volunteer_instructor'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden: Instructor access required' }, { status: 403 });
    }

    const body = await request.json();
    const { room_name, lab_room_id, timer_type } = body;

    if (!room_name) {
      return NextResponse.json({ success: false, error: 'Room name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('timer_display_tokens')
      .insert({
        room_name,
        lab_room_id: lab_room_id || null,
        timer_type: timer_type || 'fixed',
        created_by: session.user.email
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, token: data });
  } catch (error: unknown) {
    console.error('Error creating timer token:', error);
    const message = error instanceof Error ? error.message : 'Failed to create timer token';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH - Update a timer display token
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!currentUser || !['superadmin', 'admin', 'lead_instructor', 'instructor', 'volunteer_instructor'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden: Instructor access required' }, { status: 403 });
    }

    const body = await request.json();
    const { id, room_name, lab_room_id, timer_type, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Token ID is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (room_name !== undefined) updateData.room_name = room_name;
    if (lab_room_id !== undefined) updateData.lab_room_id = lab_room_id || null;
    if (timer_type !== undefined) updateData.timer_type = timer_type;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('timer_display_tokens')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, token: data });
  } catch (error: unknown) {
    console.error('Error updating timer token:', error);
    const message = error instanceof Error ? error.message : 'Failed to update timer token';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE - Delete a timer display token
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!currentUser || !['superadmin', 'admin', 'lead_instructor', 'instructor', 'volunteer_instructor'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden: Instructor access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Token ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('timer_display_tokens')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting timer token:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete timer token';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
