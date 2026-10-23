import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cx } from "@/utils/cx";

export interface StatTileItem {
    label: string;
    value: ReactNode;
    icon?: LucideIcon;
    /** Makes the tile a link. */
    to?: string;
    hint?: ReactNode;
}

/** A row of small number tiles (2 per row on phones). */
export function StatTiles({ items, className }: { items: StatTileItem[]; className?: string }) {
    return (
        <div className={cx("grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6", className)}>
            {items.map((s) => {
                const Icon = s.icon;
                const body = (
                    <>
                        <div className="mb-1 flex items-center gap-1.5">
                            {Icon && <Icon className="h-3.5 w-3.5 text-accent-600" aria-hidden />}
                            <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{s.label}</span>
                        </div>
                        <div className="text-xl font-semibold tabular-nums text-ink">{s.value}</div>
                        {s.hint && <div className="mt-0.5 text-xs text-ink-faint">{s.hint}</div>}
                    </>
                );
                const cls = "block rounded-card border border-line bg-surface p-3.5 shadow-card";
                return s.to ? (
                    <Link key={s.label} to={s.to} className={cx(cls, "transition-colors hover:border-accent-300 hover:bg-accent-50/40")}>
                        {body}
                    </Link>
                ) : (
                    <div key={s.label} className={cls}>
                        {body}
                    </div>
                );
            })}
        </div>
    );
}
