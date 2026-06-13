import type { ReactNode } from "react";
import { X } from "lucide-react";

export interface BulkAction {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    /** Tailwind classes for the button. Defaults to a neutral style. */
    className?: string;
    disabled?: boolean;
}

interface BulkActionBarProps {
    count: number;
    onClear: () => void;
    actions: BulkAction[];
    /** Accent colour for the count chip. */
    accent?: string;
    busy?: boolean;
}

/**
 * Sticky bar that appears when one or more rows are selected. Renders a count,
 * a clear button and a set of bulk actions. Shared across Markers, Narratives,
 * Reviews and Regions so bulk behaviour looks and feels identical everywhere.
 */
export function BulkActionBar({
    count,
    onClear,
    actions,
    accent = "bg-neutral-900",
    busy = false,
}: BulkActionBarProps) {
    if (count === 0) return null;
    return (
        <div className="sticky bottom-4 z-30 flex justify-center pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white/95 px-4 py-2.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.2)] ring-1 ring-neutral-900/5 backdrop-blur-md animate-slide-up">
                <span className={`inline-flex items-center justify-center rounded-lg ${accent} px-2.5 py-1 text-xs font-bold text-white shadow-sm tabular-nums`}>
                    {count} selected
                </span>
                <div className="h-5 w-px bg-neutral-200" />
                <div className="flex items-center gap-2">
                    {actions.map((a) => (
                        <button
                            key={a.label}
                            onClick={a.onClick}
                            disabled={a.disabled || busy}
                            className={
                                a.className ??
                                "flex items-center gap-1.5 rounded-xl bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                            }
                        >
                            {a.icon}
                            {a.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={onClear}
                    disabled={busy}
                    title="Clear selection"
                    className="ml-1 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
