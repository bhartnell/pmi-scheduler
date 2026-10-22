import type { Role } from '@/lib/permissions';

/**
 * Returns the role to render the UI for. Role preview was removed
 * (View as is the only impersonation), so this is the real role; the hook
 * stays so existing callers keep working.
 */
export function useEffectiveRole(realRole: Role | string | null): Role | string | null {
  return realRole;
}
