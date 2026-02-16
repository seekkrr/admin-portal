import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "@services/auth.service";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { ALLOWED_ADMIN_ROLES } from "@/types";

const PROCESSED_CODE_KEY = "seekkrr_admin_auth_code_processed";

export function AuthCallbackPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login, checkAuth } = useAuthStore();
    const [errorState, setErrorState] = useState<string | null>(null);

    useEffect(() => {
        const code = searchParams.get("code");
        const error = searchParams.get("error");

        // Prevent double execution: check if THIS specific code was already processed
        if (code && sessionStorage.getItem(PROCESSED_CODE_KEY) === code) {
            return;
        }

        const handleCallback = async () => {
            if (error) {
                setErrorState(error);
                toast.error("Login failed. Please try again.");
                return;
            }

            if (!code) {
                setErrorState("No authorization code received");
                toast.error("Invalid login attempt.");
                return;
            }

            // Mark this code as being processed IMMEDIATELY to prevent race conditions
            sessionStorage.setItem(PROCESSED_CODE_KEY, code);

            try {
                const tokens = await authService.exchangeAuthCode(code);

                // Store tokens via auth store (this also sets isAuthenticated=true)
                login(tokens);

                // Wait for user data fetch to complete
                const success = await checkAuth();

                // Clear the processed code marker on success
                sessionStorage.removeItem(PROCESSED_CODE_KEY);

                if (success) {
                    toast.success("Welcome!");
                    navigate("/", { replace: true });
                } else {
                    // Check if failure is due to role
                    const state = useAuthStore.getState();
                    if (state.user && !ALLOWED_ADMIN_ROLES.includes(state.user.role as any)) {
                        navigate("/access-denied", { replace: true });
                        return;
                    }

                    setErrorState("Failed to verify user session");
                    toast.error("Failed to load user profile.");
                }
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : "Authentication failed";
                // Clear the processed code marker on failure so user can retry
                sessionStorage.removeItem(PROCESSED_CODE_KEY);
                setErrorState(errorMessage);
                toast.error("Authentication failed. Please try again.");
            }
        };

        handleCallback();
    }, [searchParams, navigate, login, checkAuth]);

    if (errorState) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 gap-6 p-4">
                <div className="text-center space-y-2">
                    <h1 className="text-xl font-semibold text-neutral-900">Sign in failed</h1>
                    <p className="text-neutral-500 max-w-sm mx-auto">{errorState}</p>
                </div>
                <Link
                    to="/login"
                    className="inline-flex items-center justify-center px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium text-sm"
                >
                    Back to Login
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-neutral-900" />
            <p className="text-neutral-600 font-medium animate-pulse text-sm">
                Completing secure sign-in...
            </p>
        </div>
    );
}
