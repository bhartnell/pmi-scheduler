// Endorsement system - layered authority on top of roles
// Role = what you CAN do (superadmin, admin, instructor)
// Endorsement = special authority (director, mentor, preceptor)

import { getSupabaseAdmin } from './supabase';

// ============================================
// Endorsement Types
// ============================================

export type EndorsementType = 'director' | 'mentor' | 'preceptor' | 'lead_instructor';

export interface Endorsement {
  id: string;
  user_id: string;
  endorsement_type: EndorsementType;
  title: string | null;
  department_id: string | null;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export const ENDORSEMENT_LABELS: Record<EndorsementType, string> = {
  director: 'Director',
  mentor: 'Mentor',
  preceptor: 'Preceptor',
  lead_instructor: 'Lead Instructor',
};

export const ENDORSEMENT_BADGES: Record<EndorsementType, { abbrev: string; bg: string; text: string }> = {
  director: { abbrev: 'DIR', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-300' },
  mentor: { abbrev: 'MNT', bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-800 dark:text-violet-300' },
  preceptor: { abbrev: 'PRC', bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-800 dark:text-cyan-300' },
  lead_instructor: { abbrev: 'LI', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300' },
};

/**
 * Get the short badge abbreviation for an endorsement.
 * @param endorsement - The endorsement object
 * @returns Short abbreviation (e.g., "PD" for Program Director, "CD" for Clinical Director)
 */
export function getEndorsementAbbrev(endorsement: Endorsement): string {
  if (endorsement.endorsement_type === 'director') {
    if (endorsement.title?.includes('Program')) return 'PD';
    if (endorsement.title?.includes('Clinical')) return 'CD';
    return 'DIR';
  }
  return ENDORSEMENT_BADGES[endorsement.endorsement_type]?.abbrev || endorsement.endorsement_type.toUpperCase();
}

// ============================================
// Server-side Endorsement Checks
// ============================================

/**
 * Check if a user has a specific endorsement (server-side)
 */
export async function hasEndorsement(
  userId: string,
  endorsementType: EndorsementType
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('user_endorsements')
    .select('id')
    .eq('user_id', userId)
    .eq('endorsement_type', endorsementType)
    .eq('is_active', true)
    .maybeSingle();
  return !!data;
}

/**
 * Check if a user has director endorsement (server-side)
 */
export async function isDirector(userId: string): Promise<boolean> {
  return hasEndorsement(userId, 'director');
}

/**
 * Get all active endorsements for a user (server-side)
 */
export async function getUserEndorsements(userId: string): Promise<Endorsement[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_endorsements')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching endorsements:', error);
    return [];
  }
  return data || [];
}

/**
 * Get all active endorsements for a user by email (server-side)
 */
export async function getUserEndorsementsByEmail(email: string): Promise<Endorsement[]> {
  const supabase = getSupabaseAdmin();
  // First get user ID
  const { data: user } = await supabase
    .from('lab_users')
    .select('id')
    .eq('email', email)
    .single();

  if (!user) return [];
  return getUserEndorsements(user.id);
}

/**
 * Check if a user can perform director-level sign-offs (server-side)
 * Requires both admin role AND director endorsement
 */
export async function canDirectorSignOff(userId: string, userRole: string): Promise<boolean> {
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  if (!isAdmin) return false;
  return isDirector(userId);
}

/**
 * Grant an endorsement to a user (server-side, admin only)
 */
export async function grantEndorsement(
  userId: string,
  endorsementType: EndorsementType,
  title: string | null,
  departmentId: string | null,
  grantedBy: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('user_endorsements')
    .upsert({
      user_id: userId,
      endorsement_type: endorsementType,
      title,
      department_id: departmentId,
      granted_by: grantedBy,
      granted_at: new Date().toISOString(),
      is_active: true,
    }, {
      onConflict: 'user_id,endorsement_type,department_id'
    });

  if (error) {
    console.error('Error granting endorsement:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Revoke an endorsement (server-side, admin only)
 */
export async function revokeEndorsement(endorsementId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('user_endorsements')
    .update({ is_active: false })
    .eq('id', endorsementId);

  if (error) {
    console.error('Error revoking endorsement:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
