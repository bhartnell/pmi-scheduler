import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// Per-day NREMT proctor list (card 4225cd1c). Instructor level and above only (proctors
// themselves cannot see or edit the list). Additive: removal sets removed = true, rows are
// never deleted.
//
//   GET    ?labDayId=X          -> live proctors for the day
//   GET    ?search=text         -> people to add (accounts and students, by name or email)
//   POST   {labDayId, email, name?, labUserId?}   -> add (re-adds a removed person)
//   DELETE ?id=X                -> remove (flag)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;
  const sp = new URL(request.url).searchParams;
  const supabase = getSupabaseAdmin();

  try {
    const search = (sp.get('search') || '').trim();
    if (search) {
      if (search.length < 2) return NextResponse.json({ success: true, people: [] });
      // Strip characters that mean something inside a PostgREST or() filter.
      const q = search.replace(/[%,()*\\]/g, ' ').trim();
      const like = `%${q}%`;
      const [{ data: users }, { data: studs }] = await Promise.all([
        supabase.from('lab_users').select('id, name, email, role').eq('is_active', true).or(`name.ilike.${like},email.ilike.${like}`).limit(15),
        supabase.from('students').select('id, first_name, last_name, email').not('email', 'is', null).or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`).limit(15),
      ]);
      const byEmail = new Map<string, { lab_user_id: string | null; name: string; email: string; kind: string }>();
      for (const u of users || []) {
        if (u.email) byEmail.set(String(u.email).toLowerCase(), { lab_user_id: u.id, name: u.name || u.email, email: u.email, kind: u.role });
      }
      for (const s of studs || []) {
        const email = String(s.email || '').toLowerCase();
        if (email && !byEmail.has(email)) byEmail.set(email, { lab_user_id: null, name: `${s.first_name} ${s.last_name}`.trim(), email: s.email, kind: 'student' });
      }
      return NextResponse.json({ success: true, people: Array.from(byEmail.values()).slice(0, 20) });
    }

    const labDayId = sp.get('labDayId');
    if (!labDayId) return NextResponse.json({ success: false, error: 'labDayId is required' }, { status: 400 });
    const { data, error } = await supabase
      .from('nremt_day_proctors')
      .select('id, lab_user_id, email, name, added_by, added_at')
      .eq('lab_day_id', labDayId)
      .eq('removed', false)
      .order('added_at', { ascending: true });
    // Missing table = no proctors yet, never an error on the hub.
    if (error) return NextResponse.json({ success: true, proctors: [], table_ready: false });
    return NextResponse.json({ success: true, proctors: data || [], table_ready: true });
  } catch (error) {
    console.error('NREMT proctors GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load proctors' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    const body = await request.json();
    const labDayId = typeof body.labDayId === 'string' ? body.labDayId : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
    const labUserId = typeof body.labUserId === 'string' && body.labUserId ? body.labUserId : null;
    if (!labDayId || !EMAIL_RE.test(email)) {
      return NextResponse.json({ success: false, error: 'A lab day and a valid email are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: day } = await supabase.from('lab_days').select('id, is_nremt_testing').eq('id', labDayId).maybeSingle();
    if (!day || !day.is_nremt_testing) {
      return NextResponse.json({ success: false, error: 'That is not an NREMT testing day' }, { status: 400 });
    }

    // Already live for this day: nothing to do (idempotent).
    const { data: existing, error: exErr } = await supabase
      .from('nremt_day_proctors')
      .select('id')
      .eq('lab_day_id', labDayId)
      .eq('removed', false)
      .ilike('email', email)
      .maybeSingle();
    if (exErr) {
      return NextResponse.json({ success: false, error: 'The proctor list is not set up yet' }, { status: 503 });
    }
    if (existing) return NextResponse.json({ success: true, id: existing.id, already: true });

    // Link to an account when one exists with this email.
    let resolvedUserId = labUserId;
    let resolvedName = name;
    if (!resolvedUserId) {
      const { data: u } = await supabase.from('lab_users').select('id, name').ilike('email', email).maybeSingle();
      if (u) {
        resolvedUserId = u.id;
        resolvedName = resolvedName || u.name || null;
      }
    }

    const { data, error } = await supabase
      .from('nremt_day_proctors')
      .insert({ lab_day_id: labDayId, lab_user_id: resolvedUserId, email: email.toLowerCase(), name: resolvedName, added_by: user.email })
      .select('id')
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error('NREMT proctors POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to add proctor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

  try {
    // Flag only; the row stays for the record.
    const { error } = await getSupabaseAdmin()
      .from('nremt_day_proctors')
      .update({ removed: true, removed_at: new Date().toISOString(), removed_by: user.email })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('NREMT proctors DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove proctor' }, { status: 500 });
  }
}
