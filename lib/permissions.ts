// Role-based permission system for PMI Tools

export type Role = 'superadmin' | 'admin' | 'lead_instructor' | 'instructor' | 'guest';

export const ROLE_LEVELS: Record<Role, number> = {
  superadmin: 5,
  admin: 4,
  lead_instructor: 3,
  instructor: 2,
  guest: 1,
};

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  lead_instructor: 'Lead Instructor',
  instructor: 'Instructor',
  guest: 'Guest',
};

export const ROLE_COLORS: Record<Role, string> = {
  superadmin: 'bg-purple-600 text-white',
  admin: 'bg-red-600 text-white',
  lead_instructor: 'bg-blue-600 text-white',
  instructor: 'bg-green-600 text-white',
  guest: 'bg-gray-500 text-white',
};

// Protected superadmin emails - cannot be demoted
export const PROTECTED_SUPERADMINS = [
  'bhartnell@pmi.edu',
  'jlomonaco@pmi.edu',
];

// ============================================
// Permission Check Functions
// ============================================

export function getRoleLevel(role: Role | string): number {
  return ROLE_LEVELS[role as Role] || 0;
}

export function hasMinRole(userRole: Role | string, requiredRole: Role): boolean {
  return getRoleLevel(userRole) >= ROLE_LEVELS[requiredRole];
}

export function canAccessAdmin(role: Role | string): boolean {
  return getRoleLevel(role) >= ROLE_LEVELS.admin;
}

export function canManageUsers(role: Role | string): boolean {
  return getRoleLevel(role) >= ROLE_LEVELS.admin;
}

export function canAssignRole(currentRole: Role | string, targetRole: Role): boolean {
  // Can only assign roles lower than your own
  // Exception: superadmin can assign any role
  if (currentRole === 'superadmin') return true;
  return getRoleLevel(currentRole) > ROLE_LEVELS[targetRole];
}

export function canModifyUser(currentRole: Role | string, targetRole: Role | string): boolean {
  // Can't modify users at or above your level (except superadmin)
  if (currentRole === 'superadmin') return true;
  return getRoleLevel(currentRole) > getRoleLevel(targetRole);
}

export function canDeleteUsers(role: Role | string): boolean {
  return role === 'superadmin';
}

export function canDeleteScenarios(role: Role | string): boolean {
  return getRoleLevel(role) >= ROLE_LEVELS.lead_instructor;
}

export function canCreateScenarios(role: Role | string): boolean {
  return getRoleLevel(role) >= ROLE_LEVELS.instructor;
}

export function canCreateLabDays(role: Role | string): boolean {
  return getRoleLevel(role) >= ROLE_LEVELS.instructor;
}

export function canManageCohorts(role: Role | string): boolean {
  return getRoleLevel(role) >= ROLE_LEVELS.lead_instructor;
}

export function canManageStudentRoster(role: Role | string): boolean {
  return getRoleLevel(role) >= ROLE_LEVELS.lead_instructor;
}

export function canViewAllCertifications(role: Role | string): boolean {
  return getRoleLevel(role) >= ROLE_LEVELS.admin;
}

export function canManageGuestAccess(role: Role | string): boolean {
  return getRoleLevel(role) >= ROLE_LEVELS.lead_instructor;
}

export function canManageContent(role: Role | string): boolean {
  // lead_instructor+ can manage scenarios, cohorts, lab days, students
  return getRoleLevel(role) >= ROLE_LEVELS.lead_instructor;
}

export function canAccessSystemSettings(role: Role | string): boolean {
  return role === 'superadmin';
}

export function canAccessClinical(role: Role | string): boolean {
  // Clinical & Internship section - admin, lead_instructor, superadmin
  return getRoleLevel(role) >= ROLE_LEVELS.lead_instructor;
}

export function canEditClinical(role: Role | string): boolean {
  // Can edit preceptors, internships, meetings - lead_instructor+
  return getRoleLevel(role) >= ROLE_LEVELS.lead_instructor;
}

export function canViewPreceptors(role: Role | string): boolean {
  // All authenticated users can view preceptors (per permission matrix)
  return getRoleLevel(role) >= ROLE_LEVELS.instructor;
}

export function isSuperadmin(role: Role | string): boolean {
  return role === 'superadmin';
}

export function isProtectedSuperadmin(email: string): boolean {
  return PROTECTED_SUPERADMINS.includes(email.toLowerCase());
}

// ============================================
// Role Options for Dropdowns
// ============================================

export function getAssignableRoles(currentRole: Role | string): Role[] {
  if (currentRole === 'superadmin') {
    return ['superadmin', 'admin', 'lead_instructor', 'instructor', 'guest'];
  }
  if (currentRole === 'admin') {
    // Admins can't create/modify superadmins
    return ['admin', 'lead_instructor', 'instructor', 'guest'];
  }
  return [];
}

// ============================================
// UI Helpers
// ============================================

export function getRoleBadgeClasses(role: Role | string): string {
  return ROLE_COLORS[role as Role] || 'bg-gray-400 text-white';
}

export function getRoleLabel(role: Role | string): string {
  return ROLE_LABELS[role as Role] || role;
}

// ============================================
// FERPA Data Access Permissions
// ============================================

// FERPA Classification:
// - Directory Information (can be shared): name, cohort, enrollment status, dates
// - Protected Educational Records (restricted): email, agency, assessments, notes

export const DATA_PERMISSIONS = {
  // Who can see student email
  studentEmail: ['superadmin', 'admin', 'lead_instructor'] as Role[],

  // Who can see student agency/employer
  studentAgency: ['superadmin', 'admin', 'lead_instructor', 'instructor'] as Role[],

  // Who can see learning styles
  learningStyles: ['superadmin', 'admin', 'lead_instructor', 'instructor'] as Role[],

  // Who can see performance notes
  performanceNotes: ['superadmin', 'admin', 'lead_instructor', 'instructor'] as Role[],

  // Who can see skill assessments
  skillAssessments: ['superadmin', 'admin', 'lead_instructor', 'instructor'] as Role[],

  // Who can see student full records (all data)
  studentFullRecord: ['superadmin', 'admin', 'lead_instructor', 'instructor'] as Role[],

  // Who can see directory info only (name, cohort, status)
  studentDirectoryInfo: ['superadmin', 'admin', 'lead_instructor', 'instructor', 'guest'] as Role[],

  // Who can view audit logs
  auditLogs: ['superadmin'] as Role[],

  // Who can export student data
  exportStudentData: ['superadmin', 'admin', 'lead_instructor'] as Role[],
};

export type DataPermissionType = keyof typeof DATA_PERMISSIONS;

export function canAccessData(userRole: Role | string, dataType: DataPermissionType): boolean {
  const allowedRoles = DATA_PERMISSIONS[dataType];
  return allowedRoles.includes(userRole as Role);
}

// ============================================
// Student Data Sanitization (FERPA Compliance)
// ============================================

export interface StudentRecord {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  cohort_id?: string | null;
  agency?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  status?: string;
  cohort?: any;
  learning_style?: any;
  [key: string]: any;
}

export interface SanitizedStudent {
  id: string;
  first_name: string;
  last_name: string;
  cohort_id?: string | null;
  cohort?: any;
  status?: string;
  email?: string | null;
  agency?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  learning_style?: any;
  [key: string]: any;
}

/**
 * Sanitizes student data based on user role for FERPA compliance.
 * Guests only see directory information (name, cohort).
 * Instructors see most data except sensitive notes.
 * Lead instructors and above see everything.
 */
export function sanitizeStudentForRole(student: StudentRecord, userRole: Role | string): SanitizedStudent {
  // Always include directory information (FERPA allows this)
  const sanitized: SanitizedStudent = {
    id: student.id,
    first_name: student.first_name,
    last_name: student.last_name,
    cohort_id: student.cohort_id,
    status: student.status,
  };

  // Include cohort info if present (directory info)
  if (student.cohort) {
    sanitized.cohort = student.cohort;
  }

  // Add photo URL for instructors+ (helps identify students)
  if (canAccessData(userRole, 'studentAgency')) {
    sanitized.photo_url = student.photo_url;
  }

  // Add email if permitted
  if (canAccessData(userRole, 'studentEmail')) {
    sanitized.email = student.email;
  }

  // Add agency if permitted
  if (canAccessData(userRole, 'studentAgency')) {
    sanitized.agency = student.agency;
  }

  // Add learning styles if permitted
  if (canAccessData(userRole, 'learningStyles') && student.learning_style) {
    sanitized.learning_style = student.learning_style;
  }

  // Add notes if permitted (performance data)
  if (canAccessData(userRole, 'performanceNotes')) {
    sanitized.notes = student.notes;
  }

  // Pass through any additional fields for full access roles
  if (canAccessData(userRole, 'studentFullRecord')) {
    // Include team lead counts and other non-PII operational data
    if (student.team_lead_count !== undefined) {
      sanitized.team_lead_count = student.team_lead_count;
    }
    if (student.last_team_lead_date !== undefined) {
      sanitized.last_team_lead_date = student.last_team_lead_date;
    }
  }

  return sanitized;
}

/**
 * Sanitizes an array of students based on user role
 */
export function sanitizeStudentsForRole(students: StudentRecord[], userRole: Role | string): SanitizedStudent[] {
  return students.map(student => sanitizeStudentForRole(student, userRole));
}
