interface LoadingFallbackProps {
    message?: string;
    fullScreen?: boolean;
}

export function LoadingFallback({
    message = "Loading...",
    fullScreen = false,
}: LoadingFallbackProps) {
    const containerClass = fullScreen
        ? "fixed inset-0 bg-white/70 backdrop-blur-sm z-50"
        : "min-h-[220px]";

    return (
        <div className={`${containerClass} flex items-center justify-center animate-fade-in`}>
            <div className="flex flex-col items-center gap-5">
                {/* Concentric orbital rings */}
                <div className="relative w-12 h-12">
                    <span className="absolute inset-0 rounded-full border-[3px] border-neutral-200/70" />
                    <span className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-indigo-600 border-r-indigo-600 animate-spin-slow" />
                    <span className="absolute inset-1.5 rounded-full border-[3px] border-transparent border-b-indigo-400/70 animate-spin-reverse" />
                    <span className="absolute inset-0 m-auto w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                </div>
                <p className="text-sm font-medium text-neutral-500 tracking-wide animate-pulse">
                    {message}
                </p>
            </div>
        </div>
    );
}
