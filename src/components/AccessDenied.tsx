import { ShieldAlert } from "lucide-react";

interface AccessDeniedProps {
    message?: string;
}

export function AccessDenied({ message = "You do not have the required permissions to view this page." }: AccessDeniedProps) {
    return (
        <div className="flex flex-col items-center justify-center py-20 animate-scale-in">
            <div className="bg-white p-8 rounded-2xl shadow-xl ring-1 ring-neutral-900/5 max-w-md w-full text-center border border-neutral-200/60">
                <div className="w-16 h-16 bg-gradient-to-br from-red-50 to-red-100 ring-1 ring-red-200/70 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-floaty">
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-neutral-900 mb-2 tracking-tight">Access Denied</h2>
                <p className="text-neutral-500 leading-relaxed">{message}</p>
            </div>
        </div>
    );
}
