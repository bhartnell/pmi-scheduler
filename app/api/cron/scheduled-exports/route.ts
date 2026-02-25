import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { wrapInEmailTemplate, EMAIL_COLORS } from '@/lib/email-templates';

const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';
const FROM_EMAIL =
  process.env.EMAIL_FROM || 'PMI Paramedic Tools <notifications@pmiparamedic.tools>';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduledExport {
  id: string;
  name: string;
  report_type: 'cohort_progress' | 'clinical_hours' | 'lab_completion' | 'student_status';
  schedule: 'weekly' | 'monthly';
  recipients: string[];
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_by: string;
}

// ---------------------------------------------------------------------------
// Next run calculator
// ---------------------------------------------------------------------------

function calcNextRunAt(schedule: 'weekly' | 'monthly'): string {
  const now = new Date();
  if (schedule === 'weekly') {
    const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + daysUntilSunday);
    next.setUTCHours(6, 0, 0, 0);
    return next.toISOString();
  } else {
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 6, 0, 0, 0));
    return next.toISOString();
  }
}

// ---------------------------------------------------------------------------
// Report type labels and descriptions
// ---------------------------------------------------------------------------

const REPORT_META: Record<
  ScheduledExport['report_type'],
  { label: string; description: string }
> = {
  cohort_progress: {
    label: 'Cohort Progress Report',
    description: 'Summary of all active cohorts including lab progress, scenario scores, and team lead stats.',
  },
  clinical_hours: {
    label: 'Clinical Hours Summary',
    description: 'Student clinical hours across ER, ICR, CCL, and EMS departments.',
  },
  lab_completion: {
    label: 'Lab Completion Report',
    description: 'Lab day counts, station completions, and skill assessment results.',
  },
  student_status: {
    label: 'Student Status Summary',
    description: 'Active student roster with status, cohort, and progress flags.',
  },
};

// ---------------------------------------------------------------------------
// Report data generators
// These return CSV rows and a summary blurb for the email body.
// ---------------------------------------------------------------------------

async function generateCohortProgressReport(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<{ csv: string; summary: string; rowCount: number }> {
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select(`
      id,
      cohort_number,
      status,
      program:programs(name, abbreviation)
    `)
    .eq('status', 'active')
    .order('cohort_number');

  if (!cohorts || cohorts.length === 0) {
    return { csv: 'Cohort,Program,Status,Active Students\nNo active cohorts found.', summary: 'No active cohorts.', rowCount: 0 };
  }

  const rows: string[] = ['Cohort Number,Program,Status,Active Students,Lab Days'];

  for (const cohort of cohorts) {
    const program = cohort.program as unknown as { name: string; abbreviation: string } | null;
    const cohortLabel = `${program?.abbreviation ?? 'Unknown'} Group ${cohort.cohort_number}`;

    const { count: studentCount } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('cohort_id', cohort.id)
      .eq('status', 'active');

    const { count: labDayCount } = await supabase
      .from('lab_days')
      .select('id', { count: 'exact', head: true })
      .eq('cohort_id', cohort.id);

    rows.push(`"${cohortLabel}","${program?.name ?? 'Unknown'}","${cohort.status}",${studentCount ?? 0},${labDayCount ?? 0}`);
  }

  return {
    csv: rows.join('\n'),
    summary: `${cohorts.length} active cohort(s) included.`,
    rowCount: cohorts.length,
  };
}

async function generateClinicalHoursReport(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<{ csv: string; summary: string; rowCount: number }> {
  const { data: students } = await supabase
    .from('students')
    .select(`
      id,
      first_name,
      last_name,
      status,
      cohort:cohorts(cohort_number, program:programs(abbreviation))
    `)
    .eq('status', 'active')
    .order('last_name');

  if (!students || students.length === 0) {
    return { csv: 'Student,Cohort,ER Hours,ICR Hours,CCL Hours,EMS Hours,Total Hours', summary: 'No active students.', rowCount: 0 };
  }

  const studentIds = students.map((s) => s.id);
  const { data: clinicalHours } = await supabase
    .from('student_clinical_hours')
    .select('student_id, department, hours')
    .in('student_id', studentIds);

  // Build hours map
  const hoursMap: Record<string, Record<string, number>> = {};
  for (const id of studentIds) {
    hoursMap[id] = { er: 0, icr: 0, ccl: 0, ems: 0 };
  }

  for (const record of clinicalHours ?? []) {
    const sid = record.student_id;
    const dept = (record.department ?? '').toLowerCase();
    let key = dept;
    if (dept === 'cardio' || dept === 'cath' || dept === 'cath lab') key = 'ccl';
    else if (dept === 'emergency' || dept === 'ed') key = 'er';
    else if (dept === 'icu' || dept === 'critical care') key = 'icr';
    else if (dept === 'field' || dept === 'ambulance') key = 'ems';
    if (hoursMap[sid] && (key === 'er' || key === 'icr' || key === 'ccl' || key === 'ems')) {
      hoursMap[sid][key] += record.hours ?? 0;
    }
  }

  const rows: string[] = ['Student,Cohort,ER Hours,ICR Hours,CCL Hours,EMS Hours,Total Hours'];
  for (const student of students) {
    const cohortData = student.cohort as unknown as { cohort_number: number; program: { abbreviation: string } | null } | null;
    const cohortLabel = cohortData
      ? `${cohortData.program?.abbreviation ?? 'Unknown'} ${cohortData.cohort_number}`
      : 'Unknown';
    const h = hoursMap[student.id] ?? { er: 0, icr: 0, ccl: 0, ems: 0 };
    const total = h.er + h.icr + h.ccl + h.ems;
    rows.push(`"${student.last_name}, ${student.first_name}","${cohortLabel}",${h.er},${h.icr},${h.ccl},${h.ems},${total}`);
  }

  return {
    csv: rows.join('\n'),
    summary: `${students.length} active student(s) included.`,
    rowCount: students.length,
  };
}

async function generateLabCompletionReport(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<{ csv: string; summary: string; rowCount: number }> {
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select(`
      id,
      cohort_number,
      program:programs(abbreviation)
    `)
    .eq('status', 'active')
    .order('cohort_number');

  if (!cohorts || cohorts.length === 0) {
    return { csv: 'Cohort,Lab Days,Total Stations,Scenario Stations,Skill Stations', summary: 'No active cohorts.', rowCount: 0 };
  }

  const rows: string[] = ['Cohort,Lab Days,Total Stations,Scenario Stations,Skill Stations'];

  for (const cohort of cohorts) {
    const program = cohort.program as unknown as { abbreviation: string } | null;
    const cohortLabel = `${program?.abbreviation ?? 'Unknown'} Group ${cohort.cohort_number}`;

    const { data: labDays } = await supabase
      .from('lab_days')
      .select(`
        id,
        stations:lab_stations(id, station_type)
      `)
      .eq('cohort_id', cohort.id);

    let totalStations = 0;
    let scenarioStations = 0;
    let skillStations = 0;

    for (const day of labDays ?? []) {
      const stations = (day as { stations: { station_type: string }[] }).stations ?? [];
      totalStations += stations.length;
      for (const s of stations) {
        if (s.station_type === 'scenario') scenarioStations++;
        else if (s.station_type === 'skill') skillStations++;
      }
    }

    rows.push(`"${cohortLabel}",${labDays?.length ?? 0},${totalStations},${scenarioStations},${skillStations}`);
  }

  return {
    csv: rows.join('\n'),
    summary: `${cohorts.length} active cohort(s) included.`,
    rowCount: cohorts.length,
  };
}

async function generateStudentStatusReport(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<{ csv: string; summary: string; rowCount: number }> {
  const { data: students } = await supabase
    .from('students')
    .select(`
      id,
      first_name,
      last_name,
      status,
      cohort:cohorts(cohort_number, program:programs(abbreviation))
    `)
    .order('last_name');

  if (!students || students.length === 0) {
    return { csv: 'Student,Cohort,Status', summary: 'No students found.', rowCount: 0 };
  }

  const rows: string[] = ['Student,Cohort,Status'];
  for (const student of students) {
    const cohortData = student.cohort as unknown as { cohort_number: number; program: { abbreviation: string } | null } | null;
    const cohortLabel = cohortData
      ? `${cohortData.program?.abbreviation ?? 'Unknown'} ${cohortData.cohort_number}`
      : 'Unassigned';
    rows.push(`"${student.last_name}, ${student.first_name}","${cohortLabel}","${student.status}"`);
  }

  const activeCount = students.filter((s) => s.status === 'active').length;

  return {
    csv: rows.join('\n'),
    summary: `${students.length} total student(s), ${activeCount} active.`,
    rowCount: students.length,
  };
}

// ---------------------------------------------------------------------------
// Dispatch to the correct generator
// ---------------------------------------------------------------------------

async function generateReport(
  type: ScheduledExport['report_type'],
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<{ csv: string; summary: string; rowCount: number }> {
  switch (type) {
    case 'cohort_progress':
      return generateCohortProgressReport(supabase);
    case 'clinical_hours':
      return generateClinicalHoursReport(supabase);
    case 'lab_completion':
      return generateLabCompletionReport(supabase);
    case 'student_status':
      return generateStudentStatusReport(supabase);
  }
}

// ---------------------------------------------------------------------------
// Email builder
// ---------------------------------------------------------------------------

function buildExportEmail(
  exportConfig: ScheduledExport,
  reportData: { csv: string; summary: string; rowCount: number },
  generatedAt: string
): string {
  const meta = REPORT_META[exportConfig.report_type];
  const scheduleLabel = exportConfig.schedule === 'weekly' ? 'Weekly' : 'Monthly';
  const dateStr = new Date(generatedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const content = `
    <h2 style="color: ${EMAIL_COLORS.gray[900]}; margin: 0 0 8px 0; font-size: 22px; font-weight: bold;">
      ${meta.label}
    </h2>
    <p style="color: ${EMAIL_COLORS.gray[500]}; margin: 0 0 24px 0; font-size: 14px;">
      ${scheduleLabel} export &bull; Generated ${dateStr}
    </p>

    <div style="background-color: #eff6ff; border-left: 4px solid ${EMAIL_COLORS.accent}; border-radius: 4px; padding: 12px 16px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 14px; color: ${EMAIL_COLORS.gray[700]};">
        ${meta.description}
      </p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid ${EMAIL_COLORS.gray[200]}; font-size: 14px; color: ${EMAIL_COLORS.gray[500]};">Export Name</td>
        <td style="padding: 8px 0; border-bottom: 1px solid ${EMAIL_COLORS.gray[200]}; font-size: 14px; color: ${EMAIL_COLORS.gray[900]}; font-weight: 600; text-align: right;">${exportConfig.name}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid ${EMAIL_COLORS.gray[200]}; font-size: 14px; color: ${EMAIL_COLORS.gray[500]};">Records</td>
        <td style="padding: 8px 0; border-bottom: 1px solid ${EMAIL_COLORS.gray[200]}; font-size: 14px; color: ${EMAIL_COLORS.gray[900]}; font-weight: 600; text-align: right;">${reportData.rowCount}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: ${EMAIL_COLORS.gray[500]};">Summary</td>
        <td style="padding: 8px 0; font-size: 14px; color: ${EMAIL_COLORS.gray[900]}; text-align: right;">${reportData.summary}</td>
      </tr>
    </table>

    <p style="font-size: 13px; color: ${EMAIL_COLORS.gray[500]}; margin: 0 0 16px 0;">
      The full CSV report is attached to this email.
    </p>

    <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
      <tr>
        <td style="background-color: ${EMAIL_COLORS.accent}; border-radius: 6px;">
          <a href="${APP_URL}/reports" style="display: inline-block; padding: 10px 20px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">
            View Reports in PMI Tools
          </a>
        </td>
      </tr>
    </table>

    <hr style="border: none; border-top: 1px solid ${EMAIL_COLORS.gray[200]}; margin: 24px 0;">
    <p style="font-size: 12px; color: ${EMAIL_COLORS.gray[500]}; margin: 0;">
      This is an automated ${scheduleLabel.toLowerCase()} export configured by ${exportConfig.created_by.split('@')[0]}.
      To change export settings, visit the
      <a href="${APP_URL}/admin/scheduled-exports" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">Admin &rarr; Scheduled Exports</a> page.
    </p>
  `;

  return wrapInEmailTemplate(content, `${APP_URL}/admin/scheduled-exports`);
}

// ---------------------------------------------------------------------------
// Process a single export
// ---------------------------------------------------------------------------

async function processExport(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  exportConfig: ScheduledExport
): Promise<'sent' | 'skipped'> {
  if (!exportConfig.recipients || exportConfig.recipients.length === 0) {
    return 'skipped';
  }

  const generatedAt = new Date().toISOString();
  const reportData = await generateReport(exportConfig.report_type, supabase);
  const meta = REPORT_META[exportConfig.report_type];
  const htmlBody = buildExportEmail(exportConfig, reportData, generatedAt);

  const dateLabel = new Date(generatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const subject = `[PMI] ${meta.label} – ${dateLabel}`;

  // Build CSV attachment name
  const csvFilename = `${exportConfig.report_type}_${new Date(generatedAt).toISOString().slice(0, 10)}.csv`;
  const csvBase64 = Buffer.from(reportData.csv, 'utf-8').toString('base64');

  const { Resend } = await import('resend');
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  if (resend) {
    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: exportConfig.recipients,
      subject,
      html: htmlBody,
      attachments: [
        {
          filename: csvFilename,
          content: csvBase64,
        },
      ],
    });

    if (sendError) {
      throw new Error(`Resend error for export "${exportConfig.name}": ${sendError.message}`);
    }
  }

  // Update last_run_at and next_run_at
  const nextRun = calcNextRunAt(exportConfig.schedule);
  await supabase
    .from('scheduled_exports')
    .update({
      last_run_at: generatedAt,
      next_run_at: nextRun,
    })
    .eq('id', exportConfig.id);

  // Log to email_log if table exists (non-fatal)
  try {
    await supabase.from('email_log').insert({
      to_email: exportConfig.recipients.join(', '),
      subject,
      template: 'scheduled_export',
      status: 'sent',
      sent_at: generatedAt,
    });
  } catch {
    // email_log table may not exist – ignore
  }

  return 'sent';
}

// ---------------------------------------------------------------------------
// GET /api/cron/scheduled-exports
//
// Vercel cron endpoint. Runs at 06:00 UTC on Sundays AND on the 1st of each month.
// Auth: Bearer CRON_SECRET (standard Vercel cron pattern).
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[SCHEDULED-EXPORTS] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[SCHEDULED-EXPORTS] Cron started at', new Date().toISOString());

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Find all active exports whose next_run_at is in the past (or has arrived)
  const { data: dueExports, error: queryError } = await supabase
    .from('scheduled_exports')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_at', now);

  if (queryError) {
    console.error('[SCHEDULED-EXPORTS] Failed to query due exports:', queryError.message);
    return NextResponse.json(
      { error: 'Failed to query scheduled exports', detail: queryError.message },
      { status: 500 }
    );
  }

  if (!dueExports || dueExports.length === 0) {
    console.log('[SCHEDULED-EXPORTS] No exports due at this time');
    return NextResponse.json({
      success: true,
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: [],
      duration_ms: Date.now() - startTime,
    });
  }

  console.log(`[SCHEDULED-EXPORTS] Processing ${dueExports.length} due export(s)`);

  const results = await Promise.allSettled(
    (dueExports as ScheduledExport[]).map((exp) => processExport(supabase, exp))
  );

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  results.forEach((result, index) => {
    const name = (dueExports as ScheduledExport[])[index]?.name ?? `export[${index}]`;
    if (result.status === 'fulfilled') {
      if (result.value === 'sent') sent++;
      else skipped++;
    } else {
      const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[SCHEDULED-EXPORTS] Error processing "${name}":`, errMsg);
      errors.push(`${name}: ${errMsg}`);
    }
  });

  const summary = {
    success: true,
    processed: dueExports.length,
    sent,
    skipped,
    errors,
    duration_ms: Date.now() - startTime,
  };

  console.log('[SCHEDULED-EXPORTS] Completed:', summary);
  return NextResponse.json(summary);
}
