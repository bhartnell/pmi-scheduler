import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { emails } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ duplicates: [] });
    }

    // Normalize and filter valid-looking emails
    const normalizedEmails = emails
      .filter((e: unknown) => typeof e === 'string' && e.includes('@'))
      .map((e: string) => e.toLowerCase().trim());

    if (normalizedEmails.length === 0) {
      return NextResponse.json({ duplicates: [] });
    }

    const supabase = getSupabaseAdmin();

    // Query students table for any matching emails
    const { data, error } = await supabase
      .from('students')
      .select('id, first_name, last_name, email')
      .in('email', normalizedEmails);

    if (error) throw error;

    const duplicates = (data || []).map((s: { id: string; first_name: string; last_name: string; email: string }) => ({
      email: s.email,
      existing_name: `${s.first_name} ${s.last_name}`.trim(),
      student_id: s.id,
    }));

    return NextResponse.json({ duplicates });
  } catch (error) {
    console.error('Error checking duplicate emails:', error);
    return NextResponse.json({ error: 'Failed to check duplicates' }, { status: 500 });
  }
}
