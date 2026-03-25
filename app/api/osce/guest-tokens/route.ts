import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Admin: list all guest tokens
export async function GET() {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('osce_guest_tokens')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, tokens: data });
  } catch (err) {
    console.error('Error fetching guest tokens:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch tokens' }, { status: 500 });
  }
}

// POST - Admin: create a new guest token
export async function POST(req: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { evaluator_name, evaluator_role, valid_hours } = body;

    if (!evaluator_name) {
      return NextResponse.json({ success: false, error: 'evaluator_name is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const validUntil = valid_hours
      ? new Date(Date.now() + valid_hours * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('osce_guest_tokens')
      .insert({
        evaluator_name,
        evaluator_role: evaluator_role || null,
        valid_until: validUntil,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, token: data });
  } catch (err) {
    console.error('Error creating guest token:', err);
    return NextResponse.json({ success: false, error: 'Failed to create token' }, { status: 500 });
  }
}

// DELETE - Admin: revoke a token
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get('id');

    if (!tokenId) {
      return NextResponse.json({ success: false, error: 'Token id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('osce_guest_tokens')
      .delete()
      .eq('id', tokenId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error revoking token:', err);
    return NextResponse.json({ success: false, error: 'Failed to revoke token' }, { status: 500 });
  }
}
