// FERPA Compliance Audit Logging
// Tracks access to protected educational records

import { createClient } from '@supabase/supabase-js';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ============================================
// Types
// ============================================

export type AuditAction =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'login'
  | 'logout'
  | 'access_denied';

export type AuditResourceType =
  | 'student'
  | 'student_list'
  | 'student_assessment'
  | 'performance_note'
  | 'learning_style'
  | 'cohort'
  | 'lab_day'
  | 'scenario'
  | 'user'
  | 'guest_access'
  | 'certification'
  | 'audit_log';

export interface AuditUser {
  id?: string;
  email?: string;
  role?: string;
}

export interface AuditLogEntry {
  user?: AuditUser;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  resourceDescription?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

// ============================================
// Core Logging Function
// ============================================

/**
 * Logs an audit event for FERPA compliance tracking.
 * This function is designed to never throw - audit logging failures
 * should not break the main application flow.
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from('audit_log').insert({
      user_id: entry.user?.id || null,
      user_email: entry.user?.email || null,
      user_role: entry.user?.role || null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId || null,
      resource_description: entry.resourceDescription || null,
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
      metadata: entry.metadata || null,
    });
  } catch (error) {
    // Log to console but don't fail the request
    console.error('Audit logging failed:', error);
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Log when a student record is accessed
 */
export async function logStudentAccess(
  user: AuditUser,
  studentId: string,
  studentName: string,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    user,
    action: 'view',
    resourceType: 'student',
    resourceId: studentId,
    resourceDescription: `Viewed student record: ${studentName}`,
    ipAddress,
  });
}

/**
 * Log when a student list is accessed
 */
export async function logStudentListAccess(
  user: AuditUser,
  cohortId?: string,
  studentCount?: number,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    user,
    action: 'view',
    resourceType: 'student_list',
    resourceId: cohortId || undefined,
    resourceDescription: cohortId
      ? `Viewed student list for cohort (${studentCount || 0} students)`
      : `Viewed all students (${studentCount || 0} students)`,
    ipAddress,
    metadata: { cohortId, studentCount },
  });
}

/**
 * Log when an assessment is accessed
 */
export async function logAssessmentAccess(
  user: AuditUser,
  assessmentId: string,
  studentName: string,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    user,
    action: 'view',
    resourceType: 'student_assessment',
    resourceId: assessmentId,
    resourceDescription: `Viewed assessment for: ${studentName}`,
    ipAddress,
  });
}

/**
 * Log when a student record is created
 */
export async function logStudentCreate(
  user: AuditUser,
  studentId: string,
  studentName: string,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    user,
    action: 'create',
    resourceType: 'student',
    resourceId: studentId,
    resourceDescription: `Created student record: ${studentName}`,
    ipAddress,
  });
}

/**
 * Log when a student record is updated
 */
export async function logStudentUpdate(
  user: AuditUser,
  studentId: string,
  studentName: string,
  changedFields?: string[],
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    user,
    action: 'update',
    resourceType: 'student',
    resourceId: studentId,
    resourceDescription: `Updated student record: ${studentName}`,
    ipAddress,
    metadata: changedFields ? { changedFields } : undefined,
  });
}

/**
 * Log when a student record is deleted
 */
export async function logStudentDelete(
  user: AuditUser,
  studentId: string,
  studentName: string,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    user,
    action: 'delete',
    resourceType: 'student',
    resourceId: studentId,
    resourceDescription: `Deleted student record: ${studentName}`,
    ipAddress,
  });
}

/**
 * Log when student data is exported
 */
export async function logDataExport(
  user: AuditUser,
  exportType: AuditResourceType,
  recordCount: number,
  format?: string,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    user,
    action: 'export',
    resourceType: exportType,
    resourceDescription: `Exported ${recordCount} ${exportType} records${format ? ` as ${format}` : ''}`,
    ipAddress,
    metadata: { recordCount, format },
  });
}

/**
 * Log when access is denied
 */
export async function logAccessDenied(
  user: AuditUser | undefined,
  resourceType: AuditResourceType,
  resourceId?: string,
  reason?: string,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    user,
    action: 'access_denied',
    resourceType,
    resourceId,
    resourceDescription: `Access denied${reason ? `: ${reason}` : ''}`,
    ipAddress,
    metadata: { reason },
  });
}

/**
 * Log user login
 */
export async function logUserLogin(
  user: AuditUser,
  method: string,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    user,
    action: 'login',
    resourceType: 'user',
    resourceId: user.id,
    resourceDescription: `User logged in via ${method}`,
    ipAddress,
    metadata: { method },
  });
}

/**
 * Log guest access
 */
export async function logGuestAccess(
  guestName: string,
  guestId: string,
  labDayId?: string,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    user: { email: `guest:${guestName}`, role: 'guest' },
    action: 'login',
    resourceType: 'guest_access',
    resourceId: guestId,
    resourceDescription: `Guest "${guestName}" accessed system`,
    ipAddress,
    metadata: { labDayId },
  });
}

// ============================================
// Audit Log Retrieval (Superadmin Only)
// ============================================

export interface AuditLogFilters {
  userId?: string;
  userEmail?: string;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Retrieve audit logs with filters (for superadmin audit log viewer)
 */
export async function getAuditLogs(filters: AuditLogFilters = {}) {
  const supabase = getSupabase();
  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }

  if (filters.userEmail) {
    query = query.ilike('user_email', `%${filters.userEmail}%`);
  }

  if (filters.action) {
    query = query.eq('action', filters.action);
  }

  if (filters.resourceType) {
    query = query.eq('resource_type', filters.resourceType);
  }

  if (filters.resourceId) {
    query = query.eq('resource_id', filters.resourceId);
  }

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return { logs: data, total: count };
}
