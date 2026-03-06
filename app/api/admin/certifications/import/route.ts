import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

interface CertImportRecord {
  email: string;
  cert_type?: string;
  cert_name?: string;
  expiration_date?: string;
  cert_number?: string;
  issuing_authority?: string;
}

// Parse a date string into a normalized ISO date (YYYY-MM-DD) or null
function parseDate(raw: string | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // MM/DD/YYYY
  const mdY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdY) {
    const [, m, d, y] = mdY;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM-DD-YYYY
  const mdYDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdYDash) {
    const [, m, d, y] = mdYDash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try native Date parse as a last resort
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin access
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const records: CertImportRecord[] = body.records;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'No records provided' }, { status: 400 });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNum = i + 1;

      // Validate email
      const email = record.email?.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        errors.push(`Row ${rowNum}: Missing or invalid email "${record.email}"`);
        continue;
      }

      // Look up user by email (case-insensitive)
      const { data: user } = await supabase
        .from('lab_users')
        .select('id, name')
        .ilike('email', email)
        .single();

      if (!user) {
        errors.push(`Row ${rowNum}: No user found with email "${email}"`);
        skipped++;
        continue;
      }

      // Determine the certification name to use
      const certName = (record.cert_name || record.cert_type || '').trim();
      if (!certName) {
        errors.push(`Row ${rowNum}: Missing certification name for "${email}"`);
        continue;
      }

      // Parse expiration date
      const expiresAt = parseDate(record.expiration_date);

      // Build the record payload
      const certPayload: Record<string, unknown> = {
        user_id: user.id,
        name: certName,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      };

      // Include optional fields if the table supports them
      if (record.cert_number?.trim()) {
        certPayload.cert_number = record.cert_number.trim();
      }
      if (record.issuing_authority?.trim()) {
        certPayload.issuing_authority = record.issuing_authority.trim();
      }
      if (record.cert_type?.trim()) {
        certPayload.cert_type = record.cert_type.trim();
      }

      // Check if a matching certification already exists (user_id + name)
      const { data: existing } = await supabase
        .from('certifications')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', certName)
        .single();

      if (existing) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('certifications')
          .update(certPayload)
          .eq('id', existing.id);

        if (updateError) {
          errors.push(`Row ${rowNum}: Failed to update certification for "${email}" — ${updateError.message}`);
          continue;
        }
        updated++;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('certifications')
          .insert({ ...certPayload, created_at: new Date().toISOString() });

        if (insertError) {
          // If extra columns (cert_number, issuing_authority, cert_type) don't exist,
          // fall back to minimal insert
          const minimalPayload = {
            user_id: user.id,
            name: certName,
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const { error: fallbackError } = await supabase
            .from('certifications')
            .insert(minimalPayload);

          if (fallbackError) {
            errors.push(`Row ${rowNum}: Failed to insert certification for "${email}" — ${fallbackError.message}`);
            continue;
          }
        }
        imported++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      updated,
      skipped,
      errors,
    });
  } catch (error: unknown) {
    console.error('Error importing certifications:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Failed to import certifications: ${message}` },
      { status: 500 }
    );
  }
}
