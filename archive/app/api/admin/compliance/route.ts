import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Calculate next due date from frequency.
 */
function calculateNextDue(frequency: string): string | null {
  const now = new Date();
  switch (frequency) {
    case 'monthly':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    case 'quarterly':
      return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    case 'per_deploy':
    case 'per_migration':
    case 'per_enrollment':
      return null; // event-triggered, not calendar-based
    default:
      return null;
  }
}

/**
 * GET /api/admin/compliance
 *
 * List all audit types with current status.
 * Optional query: ?log=true to also return recent audit log entries.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();
  const includeLog = request.nextUrl.searchParams.get('log') === 'true';
  const auditType = request.nextUrl.searchParams.get('audit_type');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
  const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');
  const format = request.nextUrl.searchParams.get('format');

  // Get all audits with live is_overdue calculation
  const { data: audits, error: auditsError } = await supabase
    .from('compliance_audits')
    .select('*')
    .order('audit_type', { ascending: true });

  if (auditsError) {
    return NextResponse.json({ success: false, error: auditsError.message }, { status: 500 });
  }

  // Update is_overdue live
  const now = new Date();
  const enrichedAudits = (audits || []).map(audit => ({
    ...audit,
    is_overdue: audit.next_due_at ? new Date(audit.next_due_at) <= now : false,
  }));

  // Fetch log entries if requested
  let log = null;
  if (includeLog) {
    let logQuery = supabase
      .from('compliance_audit_log')
      .select('*, audit:compliance_audits!compliance_audit_log_audit_id_fkey(audit_type)')
      .order('completed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (auditType) {
      const audit = enrichedAudits.find(a => a.audit_type === auditType);
      if (audit) {
        logQuery = logQuery.eq('audit_id', audit.id);
      }
    }

    const { data: logData } = await logQuery;
    log = logData || [];
  }

  // CSV export
  if (format === 'csv') {
    const { data: allLog } = await supabase
      .from('compliance_audit_log')
      .select('*, audit:compliance_audits!compliance_audit_log_audit_id_fkey(audit_type)')
      .order('completed_at', { ascending: false });

    const csvRows = ['Date,Audit Type,Performed By,Result,Findings,Actions Taken'];
    for (const entry of allLog || []) {
      const auditName = (entry.audit as { audit_type?: string })?.audit_type || '';
      csvRows.push([
        entry.completed_at || '',
        `"${auditName}"`,
        `"${entry.completed_by}"`,
        entry.result,
        `"${(entry.findings || '').replace(/"/g, '""')}"`,
        `"${(entry.actions_taken || '').replace(/"/g, '""')}"`,
      ].join(','));
    }

    return new NextResponse(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="compliance-audit-log-${now.toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  // Summary stats
  const stats = {
    total: enrichedAudits.length,
    current: enrichedAudits.filter(a => !a.is_overdue && a.last_result).length,
    dueSoon: enrichedAudits.filter(a => {
      if (!a.next_due_at) return false;
      const due = new Date(a.next_due_at);
      return due > now && due <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }).length,
    overdue: enrichedAudits.filter(a => a.is_overdue).length,
    neverRun: enrichedAudits.filter(a => !a.last_completed_at).length,
  };

  return NextResponse.json({
    success: true,
    audits: enrichedAudits,
    stats,
    ...(log !== null ? { log } : {}),
  });
}

/**
 * POST /api/admin/compliance
 *
 * Either run a script-based audit or log a manual audit result.
 * Body: { action: 'run' | 'log', audit_type, result?, findings?, actions_taken? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const body = await request.json();
  const { action, audit_type, result, findings, actions_taken } = body;

  if (!audit_type) {
    return NextResponse.json({ success: false, error: 'audit_type is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Find the audit record
  const { data: audit } = await supabase
    .from('compliance_audits')
    .select('*')
    .eq('audit_type', audit_type)
    .single();

  if (!audit) {
    return NextResponse.json({ success: false, error: 'Audit type not found' }, { status: 404 });
  }

  if (action === 'run') {
    // Run script-based audit
    const scriptMap: Record<string, string> = {
      'API Permission Audit': 'audit-permissions-gen.js',
      'FK Ambiguity Check': 'check-fk-ambiguity.js',
    };

    const scriptName = scriptMap[audit_type];
    if (!scriptName) {
      return NextResponse.json({
        success: false,
        error: 'This audit type does not support automated script execution',
      }, { status: 400 });
    }

    try {
      const scriptPath = path.join(process.cwd(), 'scripts', scriptName);
      const { stdout, stderr } = await execAsync(`node "${scriptPath}"`, {
        timeout: 60000,
        cwd: process.cwd(),
      });

      const output = stdout || '';
      const errors = stderr || '';

      // Parse result — look for CRITICAL, WARNING, PASS patterns
      let autoResult: 'pass' | 'fail' | 'info' = 'info';
      if (output.toLowerCase().includes('critical') || output.toLowerCase().includes('error')) {
        autoResult = 'fail';
      } else if (output.toLowerCase().includes('all clear') || output.toLowerCase().includes('no issues') || output.toLowerCase().includes('0 critical')) {
        autoResult = 'pass';
      }

      const nextDue = calculateNextDue(audit.frequency);

      // Create log entry
      const { data: logEntry } = await supabase
        .from('compliance_audit_log')
        .insert({
          audit_id: audit.id,
          completed_by: user.email,
          result: autoResult,
          findings: output.slice(0, 5000),
          actions_taken: errors ? `Stderr: ${errors.slice(0, 1000)}` : null,
          script_output: { stdout: output.slice(0, 10000), stderr: errors.slice(0, 2000) },
          next_due_at: nextDue,
        })
        .select()
        .single();

      // Update audit record
      await supabase
        .from('compliance_audits')
        .update({
          last_completed_at: new Date().toISOString(),
          last_completed_by: user.email,
          last_result: autoResult,
          last_findings: output.slice(0, 5000),
          next_due_at: nextDue,
          is_overdue: false,
        })
        .eq('id', audit.id);

      return NextResponse.json({
        success: true,
        result: autoResult,
        findings: output.slice(0, 5000),
        script_output: { stdout: output.slice(0, 10000), stderr: errors.slice(0, 2000) },
        log_entry: logEntry,
      });
    } catch (err) {
      const error = err as Error;
      return NextResponse.json({
        success: false,
        error: `Script execution failed: ${error.message}`,
      }, { status: 500 });
    }
  }

  if (action === 'log') {
    // Manual audit log
    if (!result) {
      return NextResponse.json({ success: false, error: 'result is required for manual logging' }, { status: 400 });
    }

    const nextDue = calculateNextDue(audit.frequency);

    // Create log entry
    const { data: logEntry, error: logError } = await supabase
      .from('compliance_audit_log')
      .insert({
        audit_id: audit.id,
        completed_by: user.email,
        result,
        findings: findings || null,
        actions_taken: actions_taken || null,
        next_due_at: nextDue,
      })
      .select()
      .single();

    if (logError) {
      return NextResponse.json({ success: false, error: logError.message }, { status: 500 });
    }

    // Update audit record
    await supabase
      .from('compliance_audits')
      .update({
        last_completed_at: new Date().toISOString(),
        last_completed_by: user.email,
        last_result: result,
        last_findings: findings || null,
        last_actions: actions_taken || null,
        next_due_at: nextDue,
        is_overdue: false,
      })
      .eq('id', audit.id);

    return NextResponse.json({ success: true, log_entry: logEntry });
  }

  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
}
