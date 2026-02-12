import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from('clinical_site_visits')
      .select(`
        *,
        site:clinical_sites(id, name, abbreviation, system),
        agency:agencies(id, name, abbreviation),
        cohort:cohorts(id, cohort_number, program:programs(id, name, abbreviation)),
        visitor:lab_users(id, name, email),
        students:clinical_visit_students(
          student:students(id, first_name, last_name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, visit: data });
  } catch (error) {
    console.error('Error fetching site visit:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch site visit' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Handle field agency IDs (prefixed with "agency-")
    if (body.site_id !== undefined) {
      if (body.site_id && body.site_id.startsWith('agency-')) {
        // This is a field agency
        updateData.site_id = null;
        updateData.agency_id = body.site_id.replace('agency-', '');
      } else {
        updateData.site_id = body.site_id;
        updateData.agency_id = null;
      }
    }
    if (body.departments !== undefined) updateData.departments = body.departments;
    if (body.visitor_id !== undefined) updateData.visitor_id = body.visitor_id;
    if (body.visitor_name !== undefined) updateData.visitor_name = body.visitor_name.trim();
    if (body.visit_date !== undefined) updateData.visit_date = body.visit_date;
    if (body.visit_time !== undefined) updateData.visit_time = body.visit_time;
    if (body.cohort_id !== undefined) updateData.cohort_id = body.cohort_id;
    if (body.entire_class !== undefined) updateData.entire_class = body.entire_class;
    if (body.comments !== undefined) updateData.comments = body.comments?.trim() || null;

    const { data, error } = await supabase
      .from('clinical_site_visits')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Update students if provided
    if (body.student_ids !== undefined) {
      // Remove existing student associations
      await supabase
        .from('clinical_visit_students')
        .delete()
        .eq('visit_id', id);

      // Add new student associations (unless entire_class is true)
      if (!body.entire_class && body.student_ids.length > 0) {
        const studentInserts = body.student_ids.map((studentId: string) => ({
          visit_id: id,
          student_id: studentId,
        }));

        await supabase
          .from('clinical_visit_students')
          .insert(studentInserts);
      }
    }

    // Fetch the complete visit with relations
    const { data: completeVisit, error: fetchError } = await supabase
      .from('clinical_site_visits')
      .select(`
        *,
        site:clinical_sites(id, name, abbreviation, system),
        agency:agencies(id, name, abbreviation),
        cohort:cohorts(id, cohort_number, program:programs(id, name, abbreviation)),
        visitor:lab_users(id, name, email),
        students:clinical_visit_students(
          student:students(id, first_name, last_name)
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({ success: true, visit: completeVisit });
  } catch (error) {
    console.error('Error updating site visit:', error);
    return NextResponse.json({ success: false, error: 'Failed to update site visit' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Delete will cascade to clinical_visit_students
    const { error } = await supabase
      .from('clinical_site_visits')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting site visit:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete site visit' }, { status: 500 });
  }
}
