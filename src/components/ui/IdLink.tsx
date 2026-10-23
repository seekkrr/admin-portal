import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cx } from "@/utils/cx";
import { entityPath, shortIdOf, type EntityKind } from "@/utils/entity";

/**
 * A record id (or name) as a link to its admin page. Shows `label` when given,
 * else a short monospace id; the full id is in the tooltip.
 */
export function IdLink({
    kind,
    id,
    label,
    short = true,
    className,
}: {
    kind: EntityKind;
    id: string | null | undefined;
    label?: ReactNode;
    /** Show the full id instead of the short form (no label). */
    short?: boolean;
    className?: string;
}) {
    const to = entityPath(kind, id);
    if (!id || !to) return <span className="text-ink-faint">—</span>;
    const hasLabel = label !== undefined && label !== null && label !== "";
    return (
        <Link
            to={to}
            title={id}
            className={cx(
                "text-accent-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
                hasLabel ? "font-medium" : "whitespace-nowrap font-mono text-xs",
                className
            )}
        >
            {hasLabel ? label : short ? shortIdOf(id) : id}
        </Link>
    );
}
