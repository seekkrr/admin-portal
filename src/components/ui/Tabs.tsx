import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/utils/cx";
import { CountBadge } from "./StatusPill";

export interface TabItem<T extends string> {
    value: T;
    label: ReactNode;
    count?: number;
    disabled?: boolean;
}

export interface TabsProps<T extends string> {
    tabs: TabItem<T>[];
    value: T;
    onChange: (value: T) => void;
    /** Accessible name of the tab list. */
    label: string;
    /** "line" for page sections, "pill" for compact filters/segments. */
    variant?: "line" | "pill";
    /** id prefix; panels can use `${idPrefix}-panel-${value}`. */
    idPrefix?: string;
    className?: string;
}

/**
 * Tabs with arrow-key navigation (roving focus). They scroll sideways on
 * phones instead of wrapping. The page renders the active panel itself.
 */
export function Tabs<T extends string>({ tabs, value, onChange, label, variant = "line", idPrefix, className }: TabsProps<T>) {
    const refs = useRef<Array<HTMLButtonElement | null>>([]);

    const move = (from: number, delta: number) => {
        const n = tabs.length;
        for (let step = 1; step <= n; step++) {
            const i = (((from + delta * step) % n) + n) % n;
            const tab = tabs[i];
            if (tab && !tab.disabled) {
                refs.current[i]?.focus();
                onChange(tab.value);
                return;
            }
        }
    };

    const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (e.key === "ArrowRight") {
            e.preventDefault();
            move(index, 1);
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            move(index, -1);
        } else if (e.key === "Home") {
            e.preventDefault();
            move(-1, 1);
        } else if (e.key === "End") {
            e.preventDefault();
            move(tabs.length, -1);
        }
    };

    return (
        <div
            role="tablist"
            aria-label={label}
            className={cx(
                "no-scrollbar flex max-w-full overflow-x-auto",
                variant === "line" ? "gap-1 border-b border-line" : "w-fit gap-1 rounded-control bg-brand-50/70 p-1",
                className
            )}
        >
            {tabs.map((tab, i) => {
                const selected = tab.value === value;
                return (
                    <button
                        key={tab.value}
                        ref={(el) => {
                            refs.current[i] = el;
                        }}
                        type="button"
                        role="tab"
                        id={idPrefix ? `${idPrefix}-tab-${tab.value}` : undefined}
                        aria-controls={idPrefix ? `${idPrefix}-panel-${tab.value}` : undefined}
                        aria-selected={selected}
                        tabIndex={selected ? 0 : -1}
                        disabled={tab.disabled}
                        onClick={() => onChange(tab.value)}
                        onKeyDown={(e) => onKeyDown(e, i)}
                        className={cx(
                            "flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:opacity-50",
                            variant === "line"
                                ? cx(
                                      "-mb-px border-b-2 px-3 py-2.5",
                                      selected ? "border-brand-900 text-ink" : "border-transparent text-ink-muted hover:text-ink"
                                  )
                                : cx("rounded-lg px-3.5 py-1.5", selected ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink")
                        )}
                    >
                        {tab.label}
                        <CountBadge count={tab.count} />
                    </button>
                );
            })}
        </div>
    );
}
