import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cx } from "@/utils/cx";

interface AnalyticsCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: { value: number; isPositive: boolean };
    icon?: LucideIcon;
    /** @deprecated ignored — one stat style everywhere. */
    colorClass?: string;
    isLoading?: boolean;
}

/** One number with a label (same look as the shared StatTile), plus an optional trend. */
export function AnalyticsCard({ title, value, subtitle, trend, icon: Icon, isLoading }: AnalyticsCardProps) {
    if (isLoading) {
        return (
            <div className="rounded-card border border-line bg-surface p-4 shadow-card" aria-hidden>
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-brand-50" />
                <div className="mt-3 h-7 w-1/2 animate-pulse rounded bg-brand-50" />
            </div>
        );
    }
    return (
        <div className="min-w-0 rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="mb-1 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    {Icon && <Icon className="h-4 w-4 shrink-0 text-accent-600" aria-hidden />}
                    <span className="truncate text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</span>
                </div>
                {trend && (
                    <span className={cx("flex shrink-0 items-center gap-0.5 text-xs font-semibold", trend.isPositive ? "text-good" : "text-bad")}>
                        {trend.isPositive ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
                        {trend.value}%
                    </span>
                )}
            </div>
            <div className="truncate text-xl font-semibold tabular-nums text-ink sm:text-2xl">{value}</div>
            {subtitle && <div className="mt-1 truncate text-xs text-ink-muted">{subtitle}</div>}
        </div>
    );
}
