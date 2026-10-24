import { useAuthStore } from "@/store/auth.store";

const STAFF = ["admin", "super_admin", "moderator"];
const ADMIN = ["admin", "super_admin"];

/**
 * Who is signed in, for the detail pages. Admins (admin, super_admin) can do
 * everything; moderators can open the pages read-only.
 */
export function useAdminAccess() {
    const user = useAuthStore((s) => s.user);
    const roles: string[] = user?.role ?? [];
    return {
        userId: user?._id ?? null,
        isStaff: roles.some((r) => STAFF.includes(r)),
        isAdmin: roles.some((r) => ADMIN.includes(r)),
        isSuperAdmin: roles.includes("super_admin"),
    };
}
