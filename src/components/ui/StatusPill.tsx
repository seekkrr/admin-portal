import type { ReactNode } from "react";
import { cx } from "@/utils/cx";
import { humanizeStatus, statusTone, type StatusTone } from "./status";

const TONES: Record<StatusTone, { pill: string; dot: string }> = {
    good: { pill: "bg-good-soft text-good border-good-line", dot: "bg-good" },
    warn: { pill: "bg-warn-soft text-warn border-warn-line", dot: "bg-warn" },
    bad: { pill: "bg-bad-soft text-bad border-bad-line", dot: "bg-bad" },
    info: { pill: "bg-info-soft text-info border-info-line", dot: "bg-info" },
    neutral: { pill: "bg-surface-muted text-ink-muted border-line", dot: "bg-ink-faint" },
    brand: { pill: "bg-accent-50 text-accent-700 border-accent-200", dot: "bg-accent-500" },
};

/** The one status chip. `tone` overrides the automatic colour. */
export function StatusPill({
    status,
    label,
    tone,
    className,
}: {
    status: string | null | undefined;
    label?: ReactNode;
    tone?: StatusTone;
    className?: string;
}) {
    if (!status && !label) return <span className="text-ink-faint">—</span>;
    const t = TONES[tone ?? statusTone(status)];
    return (
        <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", t.pill, className)}>
            <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} aria-hidden />
            {label ?? humanizeStatus(status ?? "")}
        </span>
    );
}

/** Small neutral/brand tag for categories, features, flags. */
export function Tag({
    children,
    tone = "neutral",
    title,
    className,
}: {
    children: ReactNode;
    tone?: StatusTone;
    title?: string;
    className?: string;
}) {
    const t = TONES[tone];
    return (
        <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium", t.pill, className)}>
            {children}
        </span>
    );
}

/** Count bubble (menu items, tabs). Yellow highlight = needs attention. */
export function CountBadge({ count, tone = "highlight", className }: { count: number | null | undefined; tone?: "highlight" | "neutral"; className?: string }) {
    if (!count) return null;
    return (
        <span
            className={cx(
                "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-5 tabular-nums",
                tone === "highlight" ? "bg-highlight text-highlight-ink" : "bg-brand-50 text-brand-700",
                className
            )}
        >
            {count > 999 ? "999+" : count}
        </span>
    );
}
