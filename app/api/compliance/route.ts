import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// Helper: compute status from expiration_date
function computeStatus(expiration_date: string | null | undefined): 'complete' | 'expiring' | 'expired' {
  if (!expiration_date) return 'complete';
  const exp = new Date(expiration_date);
  const now = new Date();
  const sixtyDays = new Date();
  sixtyDays.setDate(sixtyDays.getDate() + 60);

  if (exp < now) return 'expired';
  if (exp < sixtyDays) return 'expiring';
  return 'complete';
}

// GET /api/compliance?student_id=X  OR  ?cohort_id=X
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const cohortId = searchParams.get('cohort_id');

    // Fetch all active document types
    const { data: docTypes, error: dtError } = await supabase
      .from('compliance_document_types')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (dtError) {
      return NextResponse.json({ success: false, error: dtError.message }, { status: 500 });
    }

    if (studentId) {
      // Return all doc types with this student's submission status for each
      const { data: records } = await supabase
        .from('student_compliance_records')
        .select('*')
        .eq('student_id', studentId);

      const recordMap = new Map((records || []).map((r: any) => [r.doc_type_id, r]));

      const result = (docTypes || []).map((dt: any) => {
        const record = recordMap.get(dt.id) || null;
        return {
          doc_type: dt,
          record: record,
          // Effective status: if no record, it's missing
          effective_status: record ? record.status : 'missing',
        };
      });

      return NextResponse.json({ success: true, items: result, doc_types: docTypes });
    }

    if (cohortId) {
      // Return cohort-level summary
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name, email')
        .eq('cohort_id', cohortId)
        .order('last_name', { ascending: true });

      const studentIds = (students || []).map((s: any) => s.id);

      let records: any[] = [];
      if (studentIds.length > 0) {
        const { data: recs } = await supabase
          .from('student_compliance_records')
          .select('*')
          .in('student_id', studentIds);
        records = recs || [];
      }

      // Build a lookup: student_id -> doc_type_id -> record
      const lookup: Record<string, Record<string, any>> = {};
      for (const rec of records) {
        if (!lookup[rec.student_id]) lookup[rec.student_id] = {};
        lookup[rec.student_id][rec.doc_type_id] = rec;
      }

      // Per-student rows
      const studentRows = (students || []).map((student: any) => {
        const studentRecords = lookup[student.id] || {};
        const docStatuses: Record<string, string> = {};
        let completeCount = 0;

        for (const dt of (docTypes || [])) {
          const rec = studentRecords[dt.id];
          const status = rec ? rec.status : 'missing';
          docStatuses[dt.id] = status;
          if (status === 'complete') completeCount++;
        }

        const total = (docTypes || []).length;
        const percent = total > 0 ? Math.round((completeCount / total) * 100) : 0;

        return {
          student,
          doc_statuses: docStatuses,
          complete_count: completeCount,
          total,
          percent,
        };
      });

      // Per-doc-type summary
      const docSummary = (docTypes || []).map((dt: any) => {
        let completeCount = 0;
        for (const student of (students || [])) {
          const rec = lookup[student.id]?.[dt.id];
          if (rec && rec.status === 'complete') completeCount++;
        }
        const total = (students || []).length;
        const percent = total > 0 ? Math.round((completeCount / total) * 100) : 0;
        return { doc_type: dt, complete_count: completeCount, total, percent };
      });

      return NextResponse.json({
        success: true,
        student_rows: studentRows,
        doc_summary: docSummary,
        doc_types: docTypes,
        students,
      });
    }

    return NextResponse.json({ success: false, error: 'student_id or cohort_id required' }, { status: 400 });
  } catch (error) {
    console.error('GET /api/compliance error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/compliance — Submit/update a compliance document record
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { student_id, doc_type_id, expiration_date, file_path, file_name, notes, status } = body;

    if (!student_id || !doc_type_id) {
      return NextResponse.json({ success: false, error: 'student_id and doc_type_id required' }, { status: 400 });
    }

    // Auto-compute status based on expiration_date if not explicitly provided
    const effectiveStatus = status || computeStatus(expiration_date);

    const upsertData = {
      student_id,
      doc_type_id,
      status: effectiveStatus,
      expiration_date: expiration_date || null,
      file_path: file_path || null,
      file_name: file_name || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from('student_compliance_records')
      .upsert(upsertData, { onConflict: 'student_id,doc_type_id' })
      .select()
      .single();

    if (error) {
      console.error('POST /api/compliance error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error('POST /api/compliance error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/compliance — Verify a document (admin+ only)
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'admin')) {
      return NextResponse.json({ success: false, error: 'Forbidden — admin role required' }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Record id required' }, { status: 400 });
    }

    const { data: result, error } = await supabase
      .from('student_compliance_records')
      .update({
        verified_by: session.user.email,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('PUT /api/compliance error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, record: result });
  } catch (error) {
    console.error('PUT /api/compliance error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
