import { ShieldAlert } from "lucide-react";

interface AccessDeniedProps {
    message?: string;
}

export function AccessDenied({ message = "You do not have the required permissions to view this page." }: AccessDeniedProps) {
    return (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center border border-neutral-200">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-neutral-900 mb-2">Access Denied</h2>
                <p className="text-neutral-500">{message}</p>
            </div>
        </div>
    );
}
