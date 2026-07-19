export const ADMIN_ROLES = ["admin", "coordinator"] as const;

export function isAdminRole(role: string | undefined | null) {
  if (!role) return false;
  return (ADMIN_ROLES as readonly string[]).includes(role);
}
