import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';

/**
 * POST /api/admin/external-access/import
 *
 * Bulk import student roster CSV for external access.
 * Body: { rows: Array<{ name, email }>, organization, cohort_id? }
 *
 * - Auto-sets default_role='student', default_scope=['lvfr_aemt'] for LVFR org
 * - Pre-creates student records in students table with name + email
 * - Creates approved_external_emails entries
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const body = await request.json();
  const { rows, organization, cohort_id } = body;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ success: false, error: 'No rows provided' }, { status: 400 });
  }

  if (!organization) {
    return NextResponse.json({ success: false, error: 'Organization is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const results = { imported: 0, skipped: 0, errors: [] as string[] };

  // Determine default scope based on organization
  const defaultScope = organization.toUpperCase().includes('LVFR') ? ['lvfr_aemt'] : [];

  for (const row of rows) {
    const email = row.email?.toLowerCase().trim();
    const name = row.name?.trim();

    if (!email || !name) {
      results.errors.push(`Missing name or email: ${JSON.stringify(row)}`);
      results.skipped++;
      continue;
    }

    const domain = email.split('@')[1];
    if (!domain) {
      results.errors.push(`Invalid email: ${email}`);
      results.skipped++;
      continue;
    }

    // Check if already exists in approved_external_emails
    const { data: existing } = await supabase
      .from('approved_external_emails')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      results.skipped++;
      continue;
    }

    // 1. Create approved external email entry
    const { error: approveError } = await supabase
      .from('approved_external_emails')
      .insert({
        email,
        domain,
        organization,
        default_role: 'student',
        default_scope: defaultScope,
        approved_by: user.email,
        notes: `Imported via student roster by ${user.name}`,
      });

    if (approveError) {
      results.errors.push(`Failed to approve ${email}: ${approveError.message}`);
      results.skipped++;
      continue;
    }

    // 2. Pre-create student record if cohort_id is provided and record doesn't exist
    if (cohort_id) {
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id')
        .eq('email', email)
        .single();

      if (!existingStudent) {
        // Parse name into first/last
        const nameParts = name.split(' ');
        const firstName = nameParts[0] || name;
        const lastName = nameParts.slice(1).join(' ') || '';

        const { error: studentError } = await supabase
          .from('students')
          .insert({
            email,
            first_name: firstName,
            last_name: lastName,
            cohort_id,
            status: 'active',
          });

        if (studentError) {
          // Non-fatal — student record is optional
          console.error(`[EXTERNAL-IMPORT] Failed to create student ${email}:`, studentError.message);
        }
      }
    }

    results.imported++;
  }

  logAuditEvent({
    user: { id: user.id, email: user.email, role: user.role },
    action: 'external_roster_imported',
    resourceType: 'user',
    resourceDescription: `Imported ${results.imported} external students for ${organization}`,
    metadata: {
      organization,
      cohort_id,
      total: rows.length,
      imported: results.imported,
      skipped: results.skipped,
    },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    data: results,
  });
}
