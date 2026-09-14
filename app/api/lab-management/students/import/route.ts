import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';

interface ImportStudent {
  row: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  agency?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  learning_style?: string;
  notes?: string;
}

interface ImportResult {
  row: number;
  status: 'imported' | 'updated' | 'skipped' | 'failed';
  student?: { id: string; name: string };
  error?: string;
}

const VALID_LEARNING_STYLES = new Set(['visual', 'auditory', 'kinesthetic', 'reading']);

export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user, session } = auth;

  const supabase = getSupabaseAdmin();

  const { data: callerUser } = await supabase
    .from('lab_users')
    .select('role, name')
    .ilike('email', session.user.email)
    .single();

  if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const { data, error } = await supabase
      .from('student_import_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ success: true, history: data || [] });
  } catch (error) {
    console.error('Error fetching import history:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch import history' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user, session } = auth;

  const supabase = getSupabaseAdmin();

  // Require admin+ role for bulk import
  const { data: callerUser } = await supabase
    .from('lab_users')
    .select('role, name')
    .ilike('email', session.user.email)
    .single();

  if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      cohort_id,
      students,
      duplicate_mode = 'skip',
    }: {
      cohort_id?: string;
      students: ImportStudent[];
      duplicate_mode?: 'skip' | 'update' | 'import_new';
    } = body;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ success: false, error: 'No students provided' }, { status: 400 });
    }

    const results: ImportResult[] = [];
    let imported_count = 0;
    let updated_count = 0;
    let skipped_count = 0;
    let failed = 0;

    // ── Resolve the target cohort's program once per batch ──────────────────
    // New students need a matching student_program_enrollments row alongside
    // their students row (see BUG: importer wrote students but never
    // student_program_enrollments — ~94 students across 6 cohorts silently
    // missing enrollment rows). External-program cohorts (e.g. LVFR) are
    // excluded — they track membership in their own tables and are already
    // filtered out of PMI-facing rosters via is_external_program elsewhere
    // (see app/api/students/route.ts).
    let enrollmentProgram: 'emt' | 'aemt' | 'paramedic' | null = null;
    let enrollmentStartDate: string | null = null;
    if (cohort_id) {
      const { data: importCohort } = await supabase
        .from('cohorts')
        .select('start_date, is_external_program, program:programs(abbreviation)')
        .eq('id', cohort_id)
        .single();

      const abbreviation = (
        importCohort?.program as unknown as { abbreviation?: string } | null
      )?.abbreviation;

      if (importCohort && !importCohort.is_external_program && abbreviation) {
        enrollmentProgram =
          abbreviation === 'PM' || abbreviation === 'PMD'
            ? 'paramedic'
            : (abbreviation.toLowerCase() as 'emt' | 'aemt');
        enrollmentStartDate = importCohort.start_date || new Date().toISOString().slice(0, 10);
      }
    }

    for (const student of students) {
      const rowNum = student.row;

      // Basic validation
      if (!student.first_name?.trim() || !student.last_name?.trim()) {
        results.push({
          row: rowNum,
          status: 'failed',
          error: 'Missing first or last name',
        });
        failed++;
        continue;
      }

      // Validate learning_style if provided
      const learningStyle = student.learning_style?.toLowerCase().trim() || null;
      if (learningStyle && !VALID_LEARNING_STYLES.has(learningStyle)) {
        results.push({
          row: rowNum,
          status: 'failed',
          error: `Invalid learning_style "${student.learning_style}". Must be visual, auditory, kinesthetic, or reading.`,
        });
        failed++;
        continue;
      }

      try {
        const normalizedEmail = student.email?.toLowerCase().trim() || null;

        // ── Duplicate detection ────────────────────────────────────────────
        let existingStudent: { id: string; first_name: string; last_name: string } | null = null;

        if (duplicate_mode !== 'import_new') {
          // Check by email first (exact match)
          if (normalizedEmail) {
            const { data: byEmail } = await supabase
              .from('students')
              .select('id, first_name, last_name')
              .eq('email', normalizedEmail)
              .maybeSingle();
            existingStudent = byEmail || null;
          }

          // If no email match, check by name (case-insensitive)
          if (!existingStudent) {
            const firstLower = student.first_name.trim().toLowerCase();
            const lastLower = student.last_name.trim().toLowerCase();
            const { data: byName } = await supabase
              .from('students')
              .select('id, first_name, last_name')
              .ilike('first_name', firstLower)
              .ilike('last_name', lastLower)
              .maybeSingle();
            existingStudent = byName || null;
          }
        }

        // ── Skip ───────────────────────────────────────────────────────────
        if (existingStudent && duplicate_mode === 'skip') {
          results.push({
            row: rowNum,
            status: 'skipped',
            student: {
              id: existingStudent.id,
              name: `${existingStudent.first_name} ${existingStudent.last_name}`.trim(),
            },
          });
          skipped_count++;
          continue;
        }

        // ── Update ─────────────────────────────────────────────────────────
        if (existingStudent && duplicate_mode === 'update') {
          const updateFields: Record<string, unknown> = {
            first_name: student.first_name.trim(),
            last_name: student.last_name.trim(),
          };
          if (student.phone !== undefined) updateFields.phone = student.phone || null;
          if (student.agency !== undefined) updateFields.agency = student.agency || null;
          if (student.emergency_contact_name !== undefined)
            updateFields.emergency_contact_name = student.emergency_contact_name || null;
          if (student.emergency_contact_phone !== undefined)
            updateFields.emergency_contact_phone = student.emergency_contact_phone || null;
          if (learningStyle !== undefined) updateFields.learning_style = learningStyle || null;
          if (student.notes !== undefined) updateFields.notes = student.notes || null;
          if (cohort_id) updateFields.cohort_id = cohort_id;

          const { data: updatedData, error: updateError } = await supabase
            .from('students')
            .update(updateFields)
            .eq('id', existingStudent.id)
            .select('id, first_name, last_name')
            .single();

          if (updateError) throw updateError;

          results.push({
            row: rowNum,
            status: 'updated',
            student: {
              id: updatedData.id,
              name: `${updatedData.first_name} ${updatedData.last_name}`.trim(),
            },
          });
          updated_count++;
          continue;
        }

        // ── Insert new student ─────────────────────────────────────────────
        const insertData: Record<string, unknown> = {
          first_name: student.first_name.trim(),
          last_name: student.last_name.trim(),
          email: normalizedEmail,
          phone: student.phone?.trim() || null,
          agency: student.agency?.trim() || null,
          emergency_contact_name: student.emergency_contact_name?.trim() || null,
          emergency_contact_phone: student.emergency_contact_phone?.trim() || null,
          learning_style: learningStyle || null,
          notes: student.notes?.trim() || null,
          cohort_id: cohort_id || null,
        };

        const { data: newStudent, error: insertError } = await supabase
          .from('students')
          .insert(insertData)
          .select('id, first_name, last_name')
          .single();

        if (insertError) throw insertError;

        // Best-effort: create the matching enrollment row. Failure here
        // doesn't roll back the student insert (already committed) — it's
        // logged loudly so a gap is caught, not silently reintroduced.
        if (enrollmentProgram && cohort_id) {
          const { error: enrollError } = await supabase.from('student_program_enrollments').insert({
            student_id: newStudent.id,
            cohort_id,
            program: enrollmentProgram,
            status: 'active',
            start_date: enrollmentStartDate,
          });
          if (enrollError) {
            console.error(
              `[import] Failed to create student_program_enrollments for new student ${newStudent.id} (row ${rowNum}):`,
              enrollError
            );
          }
        }

        results.push({
          row: rowNum,
          status: 'imported',
          student: {
            id: newStudent.id,
            name: `${newStudent.first_name} ${newStudent.last_name}`.trim(),
          },
        });
        imported_count++;
      } catch (rowError: unknown) {
        const errorMessage =
          rowError instanceof Error
            ? rowError.message
            : typeof rowError === 'object' && rowError !== null && 'message' in rowError
            ? String((rowError as { message: unknown }).message)
            : 'Unknown error';

        results.push({
          row: rowNum,
          status: 'failed',
          error: errorMessage,
        });
        failed++;
      }
    }

    // ── Log import history ─────────────────────────────────────────────────
    await supabase.from('student_import_history').insert({
      imported_by: session.user.email,
      cohort_id: cohort_id || null,
      import_mode: duplicate_mode,
      imported_count,
      updated_count,
      skipped_count,
    });

    return NextResponse.json({
      success: true,
      results,
      summary: { imported: imported_count, updated: updated_count, skipped: skipped_count, failed },
      // Legacy fields for backward compatibility
      imported: imported_count,
      skipped: skipped_count + failed,
    });
  } catch (error) {
    console.error('Error importing students:', error);
    return NextResponse.json({ success: false, error: 'Failed to import students' }, { status: 500 });
  }
}
