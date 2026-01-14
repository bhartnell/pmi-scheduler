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
