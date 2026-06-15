import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@store/auth.store";
import { LoadingFallback } from "@components/LoadingFallback";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
    children: ReactNode;
}

import { ALLOWED_ADMIN_ROLES } from "@/types";

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { isAuthenticated, isLoading } = useAuthStore();
    const location = useLocation();

    if (isLoading) {
        return <LoadingFallback message="Checking authentication..." fullScreen />;
    }

    if (!isAuthenticated) {
        // Redirect to login with return URL
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const { user } = useAuthStore.getState();
    const hasAdminRole = user?.role?.some(r => (ALLOWED_ADMIN_ROLES as readonly string[]).includes(r));

    if (user && !hasAdminRole) {
        return <Navigate to="/access-denied" replace />;
    }

    return <>{children}</>;
}
