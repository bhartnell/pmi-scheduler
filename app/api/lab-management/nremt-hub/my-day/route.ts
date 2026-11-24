import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { proctorLabDayIds } from '@/lib/nremt-proctor';

// The signed-in person's live NREMT proctor day, for the card on their home page.
// Any signed-in user may ask; the answer is only their own. Any error or a missing
// table = no day (the card just does not show).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ success: true, day: null });
    const ids = await proctorLabDayIds(email);
    if (ids.length === 0) return NextResponse.json({ success: true, day: null });
    const { data } = await getSupabaseAdmin().from('lab_days').select('id, date').in('id', ids).order('date', { ascending: true }).limit(1);
    const day = data?.[0] ? { id: data[0].id as string, date: data[0].date as string } : null;
    return NextResponse.json({ success: true, day });
  } catch {
    return NextResponse.json({ success: true, day: null });
  }
}
