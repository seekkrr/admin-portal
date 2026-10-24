import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { Button } from "@/components/ui/Button";

/** Signed in, but not with an admin role. */
export function AccessDeniedPage() {
    const { logout } = useAuthStore();

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas p-4">
            <div role="alert" className="w-full max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-card">
                <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-bad-soft text-bad">
                    <ShieldAlert className="h-7 w-7" aria-hidden />
                </span>
                <h1 className="mb-2 text-xl font-semibold text-ink">You can't open the Admin Portal</h1>
                <p className="mb-7 text-sm leading-relaxed text-ink-muted">This account doesn't have an admin role. Sign in with an admin account to continue.</p>
                <Button variant="primary" block onClick={() => logout().then(() => (window.location.href = "/login"))}>
                    Log out and use another account
                </Button>
            </div>
        </div>
    );
}
