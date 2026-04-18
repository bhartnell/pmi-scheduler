import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Checklist attendance API. Repurposed from field_trip_attendance (see
 * migration 20260418_rename_field_trips_to_checklists).
 *
 * Accepts both `checklistId` and the legacy `fieldTripId` query-string /
 * body key during rollout so older clients keep working.
 *
 * Note: the underlying column was renamed field_trip_id → checklist_id
 * in migration 20260418, so all supabase queries use `checklist_id`.
 */

function readIdParam(
  searchParams: URLSearchParams
): string | null {
  return (
    searchParams.get('checklistId') || searchParams.get('fieldTripId') || null
  );
}

function readIdFromBody(body: any): string | null {
  return body?.checklist_id ?? body?.field_trip_id ?? null;
}

// GET - list attendance records for a checklist
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const checklistId = readIdParam(request.nextUrl.searchParams);

    if (!checklistId) {
      return NextResponse.json(
        { error: 'checklistId is required' },
        { status: 400 }
      );
    }

    const { data: attendance, error } = await supabase
      .from('checklist_attendance')
      .select('*')
      .eq('checklist_id', checklistId);

    if (error) {
      if (error?.code === '42P01') {
        return NextResponse.json({ success: true, attendance: [] });
      }
      throw error;
    }

    return NextResponse.json({ success: true, attendance: attendance || [] });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'Failed to fetch attendance' },
      { status: 500 }
    );
  }
}

// POST - upsert a single attendance record
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { session } = auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const checklistId = readIdFromBody(body);
    const { student_id, attended, notes } = body;

    if (!checklistId || !student_id || attended === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'checklist_id, student_id, and attended are required',
        },
        { status: 400 }
      );
    }

    const { data: record, error } = await supabase
      .from('checklist_attendance')
      .upsert(
        {
          checklist_id: checklistId,
          student_id,
          attended,
          notes: notes || null,
          marked_by: session.user.email,
          marked_at: new Date().toISOString(),
        },
        { onConflict: 'checklist_id,student_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'Failed to update attendance' },
      { status: 500 }
    );
  }
}

// PATCH - bulk upsert attendance rows
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { session } = auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const checklistId = readIdFromBody(body);
    const { attendance } = body;

    if (!checklistId || !Array.isArray(attendance)) {
      return NextResponse.json(
        {
          success: false,
          error: 'checklist_id and attendance array are required',
        },
        { status: 400 }
      );
    }

    const records = attendance.map(
      (a: { student_id: string; attended: boolean }) => ({
        checklist_id: checklistId,
        student_id: a.student_id,
        attended: a.attended,
        marked_by: session.user?.email || null,
        marked_at: new Date().toISOString(),
      })
    );

    const { error } = await supabase
      .from('checklist_attendance')
      .upsert(records, { onConflict: 'checklist_id,student_id' });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error bulk updating attendance:', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'Failed to update attendance' },
      { status: 500 }
    );
  }
}
