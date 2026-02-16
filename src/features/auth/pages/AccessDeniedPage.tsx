import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@store/auth.store";

export function AccessDeniedPage() {
    const { logout } = useAuthStore();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center border border-neutral-200">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert className="w-8 h-8" />
                </div>

                <h1 className="text-2xl font-bold text-neutral-900 mb-2">Access Denied</h1>

                <p className="text-neutral-500 mb-8">
                    You do not have permission to access the Admin Portal.
                    This area is restricted to administrators only.
                </p>



                <div className="space-y-3">
                    <button
                        onClick={() => logout().then(() => window.location.href = '/login')}
                        className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-colors font-medium"
                    >
                        Log out and try different account
                    </button>
                </div>
            </div>
        </div>
    );
}
