import { ShieldAlert } from "lucide-react";

interface AccessDeniedProps {
    message?: string;
}

/** Shown inside the app frame when the signed-in role can't open a page. */
export function AccessDenied({ message = "You do not have the required permissions to view this page." }: AccessDeniedProps) {
    return (
        <div className="flex justify-center py-12 sm:py-20">
            <div role="alert" className="w-full max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-card">
                <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bad-soft text-bad">
                    <ShieldAlert className="h-6 w-6" aria-hidden />
                </span>
                <h2 className="text-lg font-semibold text-ink">You can't open this page</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{message}</p>
            </div>
        </div>
    );
}
