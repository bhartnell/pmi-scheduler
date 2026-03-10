// FERPA Compliance Utilities
// Core functions for consent tracking, record access logging, and FERPA release checks.
// All logging functions are fire-and-forget (never throw) to avoid breaking main flows.

import { getSupabaseAdmin } from '@/lib/supabase';

// ============================================
// Types
// ============================================

export type AgreementType = 'student_data_use' | 'agency_data_sharing' | 'instructor_confidentiality';

export type RecordDataType = 'grades' | 'skills' | 'attendance' | 'clinical' | 'pharm' | 'profile';

export type RecordAction = 'view' | 'export' | 'modify' | 'bulk_view';

export interface AgreementStatus {
  accepted: boolean;
  currentVersion: number;
  acceptedVersion?: number;
  acceptedAt?: string;
}

export interface AgreementTemplate {
  text: string;
  version: number;
}

export interface RecordAccessParams {
  userEmail: string;
  userRole: string;
  studentId?: string;
  dataType: RecordDataType;
  action: RecordAction;
  route: string;
  details?: Record<string, unknown>;
}

// ============================================
// Consent Agreement Functions
// ============================================

/**
 * Check if a user has accepted the required agreement at the current version.
 * Returns the acceptance status and current version number.
 */
export async function hasAcceptedAgreement(
  email: string,
  type: AgreementType
): Promise<AgreementStatus> {
  try {
    const supabase = getSupabaseAdmin();

    // Get the latest version of this agreement template
    const { data: template } = await supabase
      .from('ai_prompt_templates')
      .select('version')
      .eq('name', `${type}_agreement` === 'student_data_use_agreement' ? type : type)
      .is('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    // Normalize the template name lookup
    const templateName = type.endsWith('_agreement') ? type : `${type}_agreement`;
    const { data: activeTemplate } = await supabase
      .from('ai_prompt_templates')
      .select('version')
      .eq('name', templateName)
      .is('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const currentVersion = activeTemplate?.version || template?.version || 1;

    // Check if user has accepted this version
    const { data: consent } = await supabase
      .from('data_consent_agreements')
      .select('accepted, accepted_at, agreement_version')
      .eq('user_email', email)
      .eq('agreement_type', type)
      .eq('agreement_version', currentVersion)
      .eq('accepted', true)
      .single();

    return {
      accepted: !!consent?.accepted,
      currentVersion,
      acceptedVersion: consent?.agreement_version,
      acceptedAt: consent?.accepted_at,
    };
  } catch (error) {
    console.error('Error checking agreement acceptance:', error);
    return { accepted: false, currentVersion: 1 };
  }
}

/**
 * Record that a user has accepted an agreement.
 */
export async function recordAgreementAcceptance(params: {
  email: string;
  role: string;
  type: AgreementType;
  version: number;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('data_consent_agreements')
      .upsert(
        {
          user_email: params.email,
          user_role: params.role,
          agreement_type: params.type,
          agreement_version: params.version,
          accepted: true,
          accepted_at: new Date().toISOString(),
          ip_address: params.ipAddress || null,
          user_agent: params.userAgent || null,
        },
        { onConflict: 'user_email,agreement_type,agreement_version' }
      );

    if (error) {
      console.error('Error recording agreement acceptance:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error recording agreement acceptance:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get current agreement text and version for a given type.
 */
export async function getAgreementTemplate(
  type: AgreementType
): Promise<AgreementTemplate | null> {
  try {
    const supabase = getSupabaseAdmin();
    const templateName = `${type}_agreement`;

    const { data, error } = await supabase
      .from('ai_prompt_templates')
      .select('prompt_text, version')
      .eq('name', templateName)
      .is('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      text: data.prompt_text,
      version: data.version,
    };
  } catch (error) {
    console.error('Error fetching agreement template:', error);
    return null;
  }
}

// ============================================
// Record Access Logging (Fire-and-Forget)
// ============================================

/**
 * Log a record access event for FERPA compliance.
 * Fire-and-forget — never throws, never blocks the main flow.
 *
 * Usage in API routes:
 *   logRecordAccess({ userEmail, userRole, studentId, dataType: 'grades', action: 'view', route: '/api/...' }).catch(() => {});
 *
 * Future LVFR endpoints (Tasks 104-107) should call this for any student data access:
 *   - GET /api/lvfr-aemt/grades → logRecordAccess({ ..., dataType: 'grades', action: 'view' })
 *   - GET /api/lvfr-aemt/skills → logRecordAccess({ ..., dataType: 'skills', action: 'view' })
 *   - POST /api/lvfr-aemt/pharm-checkpoint → logRecordAccess({ ..., dataType: 'pharm', action: 'modify' })
 */
export async function logRecordAccess(params: RecordAccessParams): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    await supabase.from('record_access_log').insert({
      user_email: params.userEmail,
      user_role: params.userRole,
      student_id: params.studentId || null,
      data_type: params.dataType,
      action: params.action,
      route: params.route,
      details: params.details || null,
    });
  } catch (error) {
    // Log to console but never fail the request
    console.error('Record access logging failed:', error);
  }
}

// ============================================
// FERPA Release Checks
// ============================================

export interface StudentFerpaInfo {
  ferpa_agency_release?: boolean;
  ferpa_release_agency?: string | null;
}

/**
 * Check if a student has a valid FERPA release for a specific agency.
 * Used by agency_liaison and agency_observer roles to determine data access level.
 *
 * @returns true if student has signed a release for the user's agency
 */
export function checkFerpaRelease(
  student: StudentFerpaInfo,
  userAgency: string | null
): boolean {
  if (!student.ferpa_agency_release) return false;
  if (!userAgency) return false;
  if (!student.ferpa_release_agency) return false;

  // Case-insensitive comparison of agency names
  return student.ferpa_release_agency.toLowerCase() === userAgency.toLowerCase();
}

/**
 * Determine the required agreement type for a given role.
 * Returns null if no agreement is required.
 */
export function getRequiredAgreementType(role: string): AgreementType | null {
  switch (role) {
    case 'student':
      return 'student_data_use';
    case 'agency_liaison':
    case 'agency_observer':
      return 'agency_data_sharing';
    default:
      return null;
  }
}
