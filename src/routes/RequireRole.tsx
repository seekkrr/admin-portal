import type { ReactNode } from "react";
import { useAuthStore } from "@store/auth.store";
import { AccessDenied } from "@components/AccessDenied";

/**
 * Shows the page only to users holding one of `roles`; everyone else gets the
 * access-denied panel inside the app frame. Mirrors the menu's role gates.
 */
export function RequireRole({ roles, message, children }: { roles: readonly string[]; message?: string; children: ReactNode }) {
    const userRoles = useAuthStore((s) => s.user?.role);
    const allowed = !!userRoles?.some((r) => roles.includes(r));
    if (!allowed) return <AccessDenied message={message} />;
    return <>{children}</>;
}
