import { useAuthStore } from "@/store/auth.store";

/**
 * Collabs RBAC (mirrors the backend guards):
 *  - staff  = admin | super_admin | moderator → queues, read views, moderation,
 *             reports, fraud flags, creator verification, business applications.
 *  - admin  = admin | super_admin → money (plans, coupons, subscriptions,
 *             overrides), algorithm (match config), rollout/terms, business
 *             create/edit/owners, forced application transitions.
 */
export const COLLAB_STAFF_ROLES = ["admin", "super_admin", "moderator"];
export const COLLAB_ADMIN_ROLES = ["admin", "super_admin"];

export function useCollabAccess() {
    const roles = useAuthStore((s) => s.user?.role);
    const isStaff = !!roles?.some((r) => COLLAB_STAFF_ROLES.includes(r));
    const isAdmin = !!roles?.some((r) => COLLAB_ADMIN_ROLES.includes(r));
    return { isStaff, isAdmin };
}
