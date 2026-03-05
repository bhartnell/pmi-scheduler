import { useRolePreview } from '@/components/RolePreviewProvider';
import type { Role } from '@/lib/permissions';

/**
 * Returns the effective role for UI rendering.
 * If an admin is in preview mode, returns the preview role.
 * Otherwise returns the real role.
 */
export function useEffectiveRole(realRole: Role | string | null): Role | string | null {
  const { previewRole } = useRolePreview();
  if (previewRole && realRole) {
    return previewRole;
  }
  return realRole;
}
