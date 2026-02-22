import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import crypto from 'crypto';

// Generate a secure random token
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// GET - List all timer display tokens
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('timer_display_tokens')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, tokens: data });
  } catch (error) {
    console.error('Error fetching timer display tokens:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tokens' }, { status: 500 });
  }
}

// POST - Create a new timer display token
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { room_name } = body;

    if (!room_name || typeof room_name !== 'string') {
      return NextResponse.json({ success: false, error: 'Room name is required' }, { status: 400 });
    }

    // Get user ID
    const { data: userData } = await getSupabaseAdmin()
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single();

    const token = generateToken();

    const { data, error } = await getSupabaseAdmin()
      .from('timer_display_tokens')
      .insert({
        token,
        room_name: room_name.trim(),
        is_active: true,
        created_by: userData?.id || null
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, token: data });
  } catch (error) {
    console.error('Error creating timer display token:', error);
    return NextResponse.json({ success: false, error: 'Failed to create token' }, { status: 500 });
  }
}
