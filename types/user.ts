/**
 * User Type Definitions
 *
 * Centralized user types for the PMI EMS Scheduler.
 * Import from '@/types' or '@/types/user' as needed.
 */

// Re-export Role from permissions (single source of truth)
export { type Role, ROLE_LEVELS, ROLE_LABELS, ROLE_COLORS } from '@/lib/permissions';

import type { Role } from '@/lib/permissions';

/**
 * Base user interface with core fields.
 * Used for API responses and database queries.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  last_login: string | null;
}

/**
 * Current user context - minimal fields needed for UI/permissions.
 * Use this for components that just need to check the current user.
 */
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/**
 * Minimal current user - just id and role.
 * Use for components that only need permission checks.
 */
export interface CurrentUserMinimal {
  id: string;
  role: Role;
}

/**
 * User preferences for notifications and display settings.
 */
export interface UserPreferences {
  email_notifications: boolean;
  notification_categories: string[];
  theme?: 'light' | 'dark' | 'system';
}

/**
 * Guest access record for temporary/limited users.
 */
export interface GuestAccess {
  id: string;
  user_id: string;
  invited_by: string;
  expires_at: string;
  access_type: 'full' | 'limited';
  created_at: string;
  user?: User;
  inviter?: User;
}

/**
 * User certification record.
 */
export interface UserCertification {
  id: string;
  user_id: string;
  certification_type: string;
  certification_number?: string;
  issue_date: string;
  expiration_date: string;
  issuing_authority?: string;
  document_url?: string;
  verified: boolean;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Instructor-specific user data.
 */
export interface Instructor extends User {
  bio?: string;
  specializations?: string[];
  certifications?: UserCertification[];
  endorsements?: InstructorEndorsement[];
}

/**
 * Instructor endorsements (director, mentor, preceptor).
 */
export interface InstructorEndorsement {
  id: string;
  instructor_id: string;
  endorsement_type: 'director' | 'mentor' | 'preceptor';
  title?: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
}
