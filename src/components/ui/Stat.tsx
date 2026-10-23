import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cx } from "@/utils/cx";
import type { StatusTone } from "./status";

const HINT_TONE: Record<StatusTone, string> = {
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
    info: "text-info",
    neutral: "text-ink-muted",
    brand: "text-accent-700",
};

/** One number with a label — the stat row above a list or on a dashboard. */
export function StatTile({
    label,
    value,
    icon: Icon,
    hint,
    hintTone = "neutral",
    to,
    className,
}: {
    label: ReactNode;
    value: ReactNode;
    icon?: LucideIcon;
    /** Small line under the number ("3 suspended", "+12 this week"). */
    hint?: ReactNode;
    hintTone?: StatusTone;
    /** Makes the tile a link. */
    to?: string;
    className?: string;
}) {
    const body = (
        <>
            <div className="mb-1 flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4 shrink-0 text-accent-600" aria-hidden />}
                <span className="truncate text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
            </div>
            <div className="truncate text-xl font-semibold tabular-nums text-ink sm:text-2xl">{value ?? "—"}</div>
            {hint && <div className={cx("mt-1 truncate text-xs font-medium", HINT_TONE[hintTone])}>{hint}</div>}
        </>
    );
    const cls = cx("block min-w-0 rounded-card border border-line bg-surface p-4 shadow-card", className);
    if (to) {
        return (
            <Link
                to={to}
                className={cx(cls, "transition-colors hover:border-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500")}
            >
                {body}
            </Link>
        );
    }
    return <div className={cls}>{body}</div>;
}

/** 2 columns on phones, up to `cols` on wide screens. */
export function StatGrid({ children, cols = 4, className }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 | 6; className?: string }) {
    const wide = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" }[cols];
    return <div className={cx("grid grid-cols-2 gap-3", wide, className)}>{children}</div>;
}
