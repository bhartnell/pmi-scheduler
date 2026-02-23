import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

interface ImportStudent {
  row: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  agency?: string;
}

interface ImportResult {
  row: number;
  status: 'imported' | 'updated' | 'skipped' | 'failed';
  student?: { id: string; name: string };
  error?: string;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

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
    let imported = 0;
    let updated = 0;
    let skipped = 0;
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

      try {
        const normalizedEmail = student.email?.toLowerCase().trim() || null;

        // Check for existing student by email (only if email provided and mode is not import_new)
        let existingStudent: { id: string; first_name: string; last_name: string } | null = null;

        if (normalizedEmail && duplicate_mode !== 'import_new') {
          const { data: found } = await supabase
            .from('students')
            .select('id, first_name, last_name')
            .eq('email', normalizedEmail)
            .maybeSingle();
          existingStudent = found || null;
        }

        if (existingStudent && duplicate_mode === 'skip') {
          results.push({
            row: rowNum,
            status: 'skipped',
            student: {
              id: existingStudent.id,
              name: `${existingStudent.first_name} ${existingStudent.last_name}`.trim(),
            },
          });
          skipped++;
          continue;
        }

        if (existingStudent && duplicate_mode === 'update') {
          // Update existing student record
          const updateFields: Record<string, unknown> = {
            first_name: student.first_name.trim(),
            last_name: student.last_name.trim(),
          };
          if (student.phone !== undefined) updateFields.phone = student.phone || null;
          if (student.agency !== undefined) updateFields.agency = student.agency || null;
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
          updated++;
          continue;
        }

        // Insert new student
        const insertData: Record<string, unknown> = {
          first_name: student.first_name.trim(),
          last_name: student.last_name.trim(),
          email: normalizedEmail,
          phone: student.phone?.trim() || null,
          agency: student.agency?.trim() || null,
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
        imported++;
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

    return NextResponse.json({
      success: true,
      results,
      summary: { imported, updated, skipped, failed },
      // Legacy fields for backward compatibility
      imported,
      skipped: skipped + failed,
    });
  } catch (error) {
    console.error('Error importing students:', error);
    return NextResponse.json({ success: false, error: 'Failed to import students' }, { status: 500 });
  }
}
