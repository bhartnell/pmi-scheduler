import { NextRequest, NextResponse } from 'next/server';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// CoAEMSP accreditation form constants — do not change without CoAEMSP
// re-issuing the program number.
const COAEMSP_PROGRAM_NUMBER = '600904';
const SPONSOR_NAME = 'Pima Medical Institute Paramedic Program';

const HEADER_ROW = [
  'Clinical/Field Site',
  'Date Visited',
  'Coordinator or Adjunct Name',
  'Unit(s) Visited',
  'Individuals Visited',
  'Comments',
];

const FOOTER_NOTE =
  '[NOTE: All response boxes on this form will automatically expand as text is entered. ' +
  'Additional rows can be added to this table by placing the cursor in the bottom, right hand box and pressing "tab".]';

function formatDateMMDDYYYY(isoDate: string): string {
  // visit_date comes back from Postgres as 'YYYY-MM-DD'
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
}

function headerCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
    width: { size: 100 / HEADER_ROW.length, type: WidthType.PERCENTAGE },
  });
}

function bodyCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph(text)],
  });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const cohortId = request.nextUrl.searchParams.get('cohortId');
    if (!cohortId) {
      return NextResponse.json(
        { success: false, error: 'cohortId is required — the CoAEMSP log is one document per cohort' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, cohort_number, display_name, program:programs(id, name, abbreviation)')
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohort) {
      return NextResponse.json({ success: false, error: 'Cohort not found' }, { status: 404 });
    }

    // Active roster, used to expand entire_class=true visits to every
    // student individually — the real CoAEMSP form lists whole-class
    // orientations by name, not as a single "Entire Class" placeholder.
    const { data: rosterRaw, error: rosterError } = await supabase
      .from('students')
      .select('id, first_name, last_name, status')
      .eq('cohort_id', cohortId);

    if (rosterError) throw rosterError;

    const activeRoster = (rosterRaw || []).filter((s) => s.status !== 'withdrawn');
    const activeRosterNames = activeRoster
      .map((s) => `${s.first_name} ${s.last_name}`)
      .join(', ');

    const { data: visits, error: visitsError } = await supabase
      .from('clinical_site_visits')
      .select(`
        id,
        visit_date,
        visitor_name,
        departments,
        comments,
        entire_class,
        site:clinical_sites(id, name),
        agency:agencies(id, name),
        students:clinical_visit_students(
          student:students(id, first_name, last_name, status)
        )
      `)
      .eq('cohort_id', cohortId)
      .order('visit_date', { ascending: true });

    if (visitsError) throw visitsError;

    // Only real, logged visits render — never a fabricated or padded row.
    const rows = (visits || []).map((visit) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const site = visit.site as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const agency = visit.agency as any;
      const siteName = site?.name || agency?.name || '';

      let individualsVisited: string;
      if (visit.entire_class) {
        individualsVisited = activeRosterNames;
      } else {
        const activeStudents = Array.isArray(visit.students)
          ? visit.students.filter(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (s: any) => s?.student?.status !== 'withdrawn'
            )
          : [];
        individualsVisited = activeStudents
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((s: any) => `${s.student?.first_name} ${s.student?.last_name}`)
          .join(', ');
      }

      return [
        siteName,
        formatDateMMDDYYYY(visit.visit_date),
        visit.visitor_name || '',
        (visit.departments || []).join(', '),
        individualsVisited,
        visit.comments || '',
      ];
    });

    const groupLabel = cohort.display_name || `Group ${cohort.cohort_number}`;

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: HEADER_ROW.map(headerCell) }),
        ...rows.map((row) => new TableRow({ children: row.map(bodyCell) })),
      ],
    });

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: 'Clinical/Field Visit Log',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'CoAEMSP Program Number:', bold: true }),
                new TextRun({ text: COAEMSP_PROGRAM_NUMBER }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Paramedic Sponsor/Program Name: ', bold: true }),
                new TextRun({ text: `${SPONSOR_NAME}${groupLabel}` }),
              ],
            }),
            new Paragraph({ text: '' }),
            table,
            new Paragraph({ text: '' }),
            new Paragraph({
              children: [new TextRun({ text: FOOTER_NOTE, italics: true, size: 18 })],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const safeGroupLabel = groupLabel.replace(/[^a-zA-Z0-9]+/g, '-');
    const filename = `clinical-field-visit-log-${safeGroupLabel}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting CoAEMSP visit log:', error);
    return NextResponse.json({ success: false, error: 'Failed to export CoAEMSP visit log' }, { status: 500 });
  }
}
