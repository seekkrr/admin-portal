import type { ReactNode } from "react";
import { AlertTriangle, Clock, Inbox, RefreshCw, type LucideIcon } from "lucide-react";
import { cx } from "@/utils/cx";
import { errorMessage } from "@/utils/errors";
import { isRouteMissing, NOT_AVAILABLE_TEXT } from "@/services/optional";
import { Button } from "./Button";

export function EmptyState({
    icon: Icon = Inbox,
    title,
    description,
    action,
    className,
    compact,
}: {
    icon?: LucideIcon;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
    compact?: boolean;
}) {
    return (
        <div className={cx("flex flex-col items-center justify-center text-center", compact ? "gap-1.5 px-4 py-8" : "gap-2 px-6 py-14", className)}>
            <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                <Icon className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-sm font-medium text-ink">{title}</p>
            {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

/** The server doesn't have this endpoint yet (route returns 404 "Not Found"). */
export function UnavailableState({
    title = "Not available yet",
    description = NOT_AVAILABLE_TEXT,
    className,
    compact,
}: {
    title?: ReactNode;
    description?: ReactNode;
    className?: string;
    compact?: boolean;
}) {
    return <EmptyState icon={Clock} title={title} description={description} className={className} compact={compact} />;
}

export function ErrorState({
    error,
    title = "Couldn't load this",
    onRetry,
    className,
    compact,
}: {
    error?: unknown;
    title?: ReactNode;
    onRetry?: () => void;
    className?: string;
    compact?: boolean;
}) {
    // A route the backend doesn't have yet is not an error the admin can retry.
    if (isRouteMissing(error)) return <UnavailableState className={className} compact={compact} />;
    return (
        <div role="alert" className={cx("flex flex-col items-center justify-center text-center", compact ? "gap-1.5 px-4 py-8" : "gap-2 px-6 py-14", className)}>
            <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-bad-soft text-bad">
                <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-sm font-medium text-ink">{title}</p>
            {error !== undefined && error !== null && <p className="max-w-md text-sm text-ink-muted">{errorMessage(error)}</p>}
            {onRetry && (
                <Button size="sm" variant="secondary" icon={RefreshCw} onClick={onRetry} className="mt-2">
                    Retry
                </Button>
            )}
        </div>
    );
}

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
    return (
        <div role="status" aria-live="polite" className={cx("flex min-h-[200px] flex-col items-center justify-center gap-3", className)}>
            <span className="relative h-9 w-9">
                <span className="absolute inset-0 rounded-full border-[3px] border-brand-100" />
                <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-accent-500" />
            </span>
            <span className="text-sm text-ink-muted">{label}</span>
        </div>
    );
}

/** Grey placeholder bars while a list loads. */
export function SkeletonRows({ rows = 6, className }: { rows?: number; className?: string }) {
    return (
        <div className={cx("divide-y divide-line", className)} aria-hidden>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                    <div className="h-3.5 w-1/3 animate-pulse rounded bg-brand-50" />
                    <div className="h-3.5 w-1/5 animate-pulse rounded bg-brand-50" />
                    <div className="ml-auto h-3.5 w-16 animate-pulse rounded bg-brand-50" />
                </div>
            ))}
        </div>
    );
}

/** Loading → error → empty → content, in that order. */
export function PanelState({
    isLoading,
    error,
    isEmpty,
    emptyIcon,
    emptyText,
    emptyDescription,
    emptyAction,
    onRetry,
    children,
}: {
    isLoading: boolean;
    error: unknown;
    isEmpty: boolean;
    emptyIcon?: LucideIcon;
    emptyText: ReactNode;
    emptyDescription?: ReactNode;
    emptyAction?: ReactNode;
    onRetry?: () => void;
    children: ReactNode;
}) {
    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState error={error} onRetry={onRetry} />;
    if (isEmpty) return <EmptyState icon={emptyIcon} title={emptyText} description={emptyDescription} action={emptyAction} />;
    return <>{children}</>;
}
