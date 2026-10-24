import type { ReactNode } from "react";
import { Construction, Info, AlertTriangle, CheckCircle2, type LucideIcon } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { isNotAvailable } from "@/services/admin-detail.service";
import { cx } from "@/utils/cx";

/** Shown in a section whose server route isn't live yet. */
export function NotAvailableNotice({ what, compact = true, className }: { what?: string; compact?: boolean; className?: string }) {
    return (
        <EmptyState
            icon={Construction}
            compact={compact}
            className={className}
            title="This isn't available on the server yet"
            description={what ? `${what} will show here once the server update is live.` : "It will show here once the server update is live."}
        />
    );
}

/**
 * Loading → not on the server yet → error → empty → content, for one section
 * of a detail page (the rest of the page keeps working).
 */
export function SectionState({
    isLoading,
    error,
    isEmpty = false,
    emptyText = "Nothing here yet",
    emptyDescription,
    emptyIcon,
    what,
    onRetry,
    children,
}: {
    isLoading: boolean;
    error: unknown;
    isEmpty?: boolean;
    emptyText?: ReactNode;
    emptyDescription?: ReactNode;
    emptyIcon?: LucideIcon;
    /** Names the section in the "not on the server yet" note. */
    what?: string;
    onRetry?: () => void;
    children: ReactNode;
}) {
    if (isLoading) return <LoadingState />;
    if (isNotAvailable(error)) return <NotAvailableNotice what={what} />;
    if (error) return <ErrorState error={error} onRetry={onRetry} compact />;
    if (isEmpty) return <EmptyState compact icon={emptyIcon} title={emptyText} description={emptyDescription} />;
    return <>{children}</>;
}

const NOTICE_TONES = {
    info: { icon: Info, cls: "border-info-line bg-info-soft text-info" },
    warn: { icon: AlertTriangle, cls: "border-warn-line bg-warn-soft text-warn" },
    bad: { icon: AlertTriangle, cls: "border-bad-line bg-bad-soft text-bad" },
    good: { icon: CheckCircle2, cls: "border-good-line bg-good-soft text-good" },
} as const;

/** A one-line note inside a section (warnings, what changed). */
export function Notice({
    tone = "info",
    title,
    children,
    action,
    className,
}: {
    tone?: keyof typeof NOTICE_TONES;
    title?: ReactNode;
    children?: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    const { icon: Icon, cls } = NOTICE_TONES[tone];
    return (
        <div role={tone === "bad" || tone === "warn" ? "alert" : "status"} className={cx("flex items-start gap-2.5 rounded-control border px-3.5 py-3 text-sm", cls, className)}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
                {title && <p className="font-medium">{title}</p>}
                {children && <div className={cx("text-ink-muted", title && "mt-0.5")}>{children}</div>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
