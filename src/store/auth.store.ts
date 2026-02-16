import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, AuthTokens } from "@/types";
import { authService } from "@services/auth.service";
import { authStorage } from "@services/api";

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}

interface AuthActions {
    setUser: (user: User) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    login: (tokens: AuthTokens) => void;
    logout: () => Promise<void>;
    checkAuth: () => Promise<boolean>;
    clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
    persist(
        (set, _get) => ({
            // State
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            // Actions
            setUser: (user) => {
                set({
                    user,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                });
            },

            setLoading: (loading) => {
                set({ isLoading: loading });
            },

            setError: (error) => {
                set({ error, isLoading: false });
            },

            clearError: () => {
                set({ error: null });
            },

            login: (tokens) => {
                authService.storeTokens(tokens);
                set({ isAuthenticated: true, isLoading: true });
                // Note: Caller is responsible for calling checkAuth() after login
            },

            logout: async () => {
                set({ isLoading: true });
                try {
                    await authService.logout();
                } finally {
                    set({
                        user: null,
                        isAuthenticated: false,
                        isLoading: false,
                        error: null,
                    });
                }
            },

            checkAuth: async () => {
                if (!authService.hasStoredToken()) {
                    set({ isAuthenticated: false, isLoading: false });
                    return false;
                }

                set({ isLoading: true });
                try {
                    const { user } = await authService.getCurrentUser();

                    // RBAC Check
                    // RBAC Check
                    if (!ALLOWED_ADMIN_ROLES.includes(user.role as any)) {
                        set({
                            user, // Set user temporarily so we know who it is, or maybe just fail authentication?
                            // Actually, keeping them authenticated but marking them as unauthorized for specific routes might be better,
                            // but for the portal entry, we want to block them.
                            // The requirement says: "display a dedicated error page 404 showing access not allowed."
                            isAuthenticated: true, // They ARE authenticated
                            isLoading: false,
                            error: "Access Denied: Insufficient permissions",
                        });
                        return false; // Return false to indicate "not successfully entered" or handle in UI
                    }

                    set({
                        user,
                        isAuthenticated: true,
                        isLoading: false,
                        error: null,
                    });
                    return true;
                } catch (error) {
                    authStorage.clearTokens();
                    set({
                        user: null,
                        isAuthenticated: false,
                        isLoading: false,
                        error: error instanceof Error ? error.message : "Authentication failed",
                    });
                    return false;
                }
            },
        }),
        {
            name: "seekkrr-admin-auth",
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
