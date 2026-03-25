import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Public: validate a guest token
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('osce_guest_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !data) {
      return NextResponse.json({ valid: false, error: 'Invalid token' }, { status: 404 });
    }

    const now = new Date();
    const validFrom = new Date(data.valid_from);
    const validUntil = new Date(data.valid_until);

    if (now < validFrom || now > validUntil) {
      return NextResponse.json({ valid: false, error: 'Token has expired' }, { status: 403 });
    }

    return NextResponse.json({
      valid: true,
      evaluator_name: data.evaluator_name,
      evaluator_role: data.evaluator_role,
      valid_until: data.valid_until,
    });
  } catch (err) {
    console.error('Error validating token:', err);
    return NextResponse.json({ valid: false, error: 'Validation failed' }, { status: 500 });
  }
}
