import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "@/utils/cx";
import type { StatusTone } from "@/components/ui/status";

/** A titled block inside a Drawer / Modal (one style for every side panel). */
export function DrawerSection({ title, icon: Icon, actions, children, className }: { title: ReactNode; icon?: LucideIcon; actions?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <section className={cx("space-y-3", className)}>
            <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {Icon && <Icon className="h-4 w-4" aria-hidden />}
                    {title}
                </h3>
                {actions}
            </div>
            {children}
        </section>
    );
}

const NOTICE_TONE: Record<StatusTone, string> = {
    good: "border-good-line bg-good-soft text-good",
    warn: "border-warn-line bg-warn-soft text-warn",
    bad: "border-bad-line bg-bad-soft text-bad",
    info: "border-info-line bg-info-soft text-info",
    neutral: "border-line bg-surface-muted text-ink-muted",
    brand: "border-accent-200 bg-accent-50 text-accent-700",
};

/** A short coloured note (approved / rejected / heads-up). */
export function Notice({ tone = "info", icon: Icon, title, children, className }: { tone?: StatusTone; icon?: LucideIcon; title?: ReactNode; children?: ReactNode; className?: string }) {
    return (
        <div className={cx("rounded-control border p-3 text-sm", NOTICE_TONE[tone], className)}>
            {title && (
                <p className="flex items-center gap-2 font-medium">
                    {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
                    {title}
                </p>
            )}
            {children && <div className={cx("text-xs leading-relaxed", title && "mt-1", title && Icon && "pl-6")}>{children}</div>}
        </div>
    );
}
