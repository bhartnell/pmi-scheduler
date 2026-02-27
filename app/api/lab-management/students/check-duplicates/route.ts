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
    const { emails, names } = body;

    const supabase = getSupabaseAdmin();

    const duplicates: { email: string; existing_name: string; student_id: string; match_type: 'email' | 'name' }[] = [];

    // ── Email-based duplicate check ──────────────────────────────────────────
    if (emails && Array.isArray(emails) && emails.length > 0) {
      const normalizedEmails = emails
        .filter((e: unknown) => typeof e === 'string' && e.includes('@'))
        .map((e: string) => e.toLowerCase().trim());

      if (normalizedEmails.length > 0) {
        const { data, error } = await supabase
          .from('students')
          .select('id, first_name, last_name, email')
          .in('email', normalizedEmails);

        if (error) throw error;

        for (const s of data || []) {
          duplicates.push({
            email: s.email,
            existing_name: `${s.first_name} ${s.last_name}`.trim(),
            student_id: s.id,
            match_type: 'email',
          });
        }
      }
    }

    // ── Name-based duplicate check (case-insensitive) ────────────────────────
    // names is an array of { first_name, last_name } objects
    if (names && Array.isArray(names) && names.length > 0) {
      // Pull all students for name comparison (only names, lightweight)
      const { data: allStudents, error: nameError } = await supabase
        .from('students')
        .select('id, first_name, last_name, email');

      if (nameError) throw nameError;

      const alreadyMatchedIds = new Set(duplicates.map(d => d.student_id));

      for (const nameEntry of names) {
        if (!nameEntry.first_name || !nameEntry.last_name) continue;
        const firstLower = nameEntry.first_name.toLowerCase().trim();
        const lastLower = nameEntry.last_name.toLowerCase().trim();

        const match = (allStudents || []).find(
          s =>
            s.first_name.toLowerCase().trim() === firstLower &&
            s.last_name.toLowerCase().trim() === lastLower &&
            !alreadyMatchedIds.has(s.id)
        );

        if (match) {
          // Use email from the CSV entry as the key for the client-side map
          const csvEmail = nameEntry.email?.toLowerCase().trim() || '';
          duplicates.push({
            email: csvEmail || `__name__${firstLower}_${lastLower}`,
            existing_name: `${match.first_name} ${match.last_name}`.trim(),
            student_id: match.id,
            match_type: 'name',
          });
          alreadyMatchedIds.add(match.id);
        }
      }
    }

    return NextResponse.json({ duplicates });
  } catch (error) {
    console.error('Error checking duplicate emails:', error);
    return NextResponse.json({ error: 'Failed to check duplicates' }, { status: 500 });
  }
}
