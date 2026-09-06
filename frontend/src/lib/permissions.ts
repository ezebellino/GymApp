import type { Role } from "@/types";

/**
 * Espejo en frontend de `require_can_manage_user` (`backend/app/deps.py`):
 * Dueño gestiona cualquier rol; Coach únicamente usuarios con rol Miembro. El
 * backend sigue siendo la autoridad (rechaza con 403 igual) — esta función
 * solo decide qué acciones se **muestran** en la ficha (design.md D7 de
 * `move-user-actions-to-detail`).
 */
export function canManageUser(viewerRole: Role | null, targetRole: Role): boolean {
  if (viewerRole === "owner") return true;
  if (viewerRole === "coach") return targetRole === "member";
  return false;
}
