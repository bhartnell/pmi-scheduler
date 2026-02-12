import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import * as XLSX from 'xlsx';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');
    const cohortId = searchParams.get('cohortId');
    const visitorId = searchParams.get('visitorId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('clinical_site_visits')
      .select(`
        *,
        site:clinical_sites(id, name, abbreviation, system),
        cohort:cohorts(id, cohort_number, program:programs(id, name, abbreviation)),
        visitor:lab_users(id, name, email),
        students:clinical_visit_students(
          student:students(id, first_name, last_name)
        )
      `)
      .order('visit_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (siteId) {
      query = query.eq('site_id', siteId);
    }

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    if (visitorId) {
      query = query.eq('visitor_id', visitorId);
    }

    if (startDate) {
      query = query.gte('visit_date', startDate);
    }

    if (endDate) {
      query = query.lte('visit_date', endDate);
    }

    const { data: visits, error } = await query;

    if (error) throw error;

    // Create worksheet data
    const wsData = [
      ['Visit Date', 'Visit Time', 'Site', 'Site Abbr', 'System', 'Departments', 'Visitor', 'Cohort', 'Students Visited', 'Entire Class', 'Comments']
    ];

    visits?.forEach((visit: any) => {
      const studentNames = visit.entire_class
        ? 'Entire Class'
        : visit.students?.map((s: any) =>
            `${s.student?.first_name} ${s.student?.last_name}`
          ).join(', ') || '';

      wsData.push([
        visit.visit_date,
        visit.visit_time || '',
        visit.site?.name || '',
        visit.site?.abbreviation || '',
        visit.site?.system || '',
        visit.departments?.join(', ') || '',
        visit.visitor_name,
        visit.cohort ? `${visit.cohort.program?.abbreviation || ''} ${visit.cohort.cohort_number}` : '',
        studentNames,
        visit.entire_class ? 'Yes' : 'No',
        visit.comments || '',
      ]);
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Visit Date
      { wch: 10 }, // Visit Time
      { wch: 25 }, // Site
      { wch: 10 }, // Site Abbr
      { wch: 20 }, // System
      { wch: 20 }, // Departments
      { wch: 20 }, // Visitor
      { wch: 20 }, // Cohort
      { wch: 40 }, // Students
      { wch: 12 }, // Entire Class
      { wch: 40 }, // Comments
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Clinical Site Visits');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Create filename with date range if provided
    let filename = 'clinical-site-visits';
    if (startDate && endDate) {
      filename += `-${startDate}-to-${endDate}`;
    } else if (startDate) {
      filename += `-from-${startDate}`;
    } else if (endDate) {
      filename += `-to-${endDate}`;
    }
    filename += '.xlsx';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting site visits:', error);
    return NextResponse.json({ success: false, error: 'Failed to export site visits' }, { status: 500 });
  }
}
