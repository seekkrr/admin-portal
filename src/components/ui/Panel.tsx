import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "@/utils/cx";

/** The one content card: optional heading row, then the body. */
export function Panel({
    title,
    description,
    icon: Icon,
    actions,
    children,
    className,
    bodyClassName = "p-4 sm:p-5",
}: {
    title?: ReactNode;
    description?: ReactNode;
    icon?: LucideIcon;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <section className={cx("overflow-hidden rounded-card border border-line bg-surface shadow-card", className)}>
            {(title || actions) && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                        {title && (
                            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                                {Icon && <Icon className="h-4 w-4 text-accent-600" aria-hidden />}
                                {title}
                            </h2>
                        )}
                        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
                    </div>
                    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
                </div>
            )}
            <div className={bodyClassName}>{children}</div>
        </section>
    );
}

/** Label / value row for detail pages. Stacks on phones. */
export function DetailRow({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
    return (
        <div className={cx("flex flex-col gap-0.5 text-sm sm:flex-row sm:items-start sm:gap-4", className)}>
            <dt className="shrink-0 font-medium text-ink-muted sm:w-40">{label}</dt>
            <dd className="min-w-0 break-words text-ink">{value ?? "—"}</dd>
        </div>
    );
}

export function DetailList({ children, className }: { children: ReactNode; className?: string }) {
    return <dl className={cx("space-y-3", className)}>{children}</dl>;
}
