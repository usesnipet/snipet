import type { Role } from "../api/user.js";

// Whether `role` is one of `allowed`. An empty `allowed` means any role.
export function hasRole(role: Role | undefined, allowed: readonly Role[]): boolean {
  if (!role) return false;
  return allowed.length === 0 || allowed.includes(role);
}
