import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

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
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
