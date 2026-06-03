import { GoogleLogin } from "@react-oauth/google";
import { authService } from "@services/auth.service";
import { Card } from "@components/ui";
import { useAuthStore } from "@store/auth.store";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ALLOWED_ADMIN_ROLES } from "@/types";

export function LoginPage() {
    const { login, checkAuth } = useAuthStore();
    const navigate = useNavigate();

    const handleGoogleSuccess = async (credentialResponse: any) => {
        if (!credentialResponse.credential) {
            toast.error("Invalid Google login response.");
            return;
        }

        try {
            const tokens = await authService.loginWithGoogleCredential(credentialResponse.credential);
            login(tokens);
            
            const success = await checkAuth();
            if (success) {
                toast.success("Welcome!");
                navigate("/", { replace: true });
            } else {
                const state = useAuthStore.getState();
                const hasAdminRole = state.user?.role?.some(r => ALLOWED_ADMIN_ROLES.includes(r as any));
                if (state.user && !hasAdminRole) {
                    navigate("/access-denied", { replace: true });
                    return;
                }
                toast.error("Failed to load user profile.");
            }
        } catch (err: any) {
            toast.error(err.message || "Authentication failed. Please try again.");
        }
    };

    return (
        <Card padding="none" shadow="lg" className="grid grid-cols-1 lg:grid-cols-2 overflow-hidden rounded-3xl border-0 h-auto min-h-[30rem] lg:min-h-[37.5rem] shadow-xl lg:shadow-2xl mx-4 lg:mx-0 my-4 lg:my-0">
            {/* Left Column: Illustration */}
            <div className="relative bg-[#F5F3FF] flex items-center justify-center p-6 lg:p-12 overflow-hidden h-48 lg:h-auto shrink-0">
                {/* Background decorative elements */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-indigo-100 blur-3xl opacity-50" />
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-purple-100 blur-3xl opacity-50" />

                <img
                    src="/login-bg.svg"
                    alt="SeekKrr Admin Portal"
                    className="relative z-10 h-full w-auto max-w-full object-contain"
                />
            </div>

            {/* Right Column: Login Form */}
            <div className="flex flex-col justify-center items-center p-6 sm:p-8 lg:p-16 bg-white w-full">
                <div className="w-full max-w-sm lg:max-w-lg">
                    <h2 className="text-3xl lg:text-[2.5em] leading-tight font-bold text-center text-black mb-3 lg:mb-4 tracking-tight font-sans">
                        Admin Portal
                    </h2>
                    <p className="text-sm lg:text-[1.125em] leading-relaxed text-center text-neutral-500 mb-8 lg:mb-10 font-sans max-w-md mx-auto px-4 lg:px-0">
                        Manage Users, Content, and Quests from one central hub.
                    </p>

                    <div className="bg-white border border-neutral-200 rounded-2xl lg:rounded-[2rem] p-6 lg:p-6 shadow-sm lg:shadow-md shadow-neutral-100/50 w-full flex flex-col items-center">
                        <h3 className="text-2xl lg:text-[2em] leading-none font-medium text-[#2D0F35] text-center mb-6 lg:mb-6 tracking-wide">Login</h3>

                        <div className="w-full flex justify-center">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => toast.error("Google Login Failed")}
                                useOneTap
                                shape="pill"
                                size="large"
                                text="signin_with"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
