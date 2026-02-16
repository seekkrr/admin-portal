import { Loader2 } from "lucide-react";

interface LoadingFallbackProps {
    message?: string;
    fullScreen?: boolean;
}

export function LoadingFallback({
    message = "Loading...",
    fullScreen = false,
}: LoadingFallbackProps) {
    const containerClass = fullScreen
        ? "fixed inset-0 bg-white z-50"
        : "min-h-[200px]";

    return (
        <div className={`${containerClass} flex items-center justify-center`}>
            <div className="text-center">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
                <p className="text-neutral-600">{message}</p>
            </div>
        </div>
    );
}
