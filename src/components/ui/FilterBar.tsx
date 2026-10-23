import { useId, type ReactNode } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cx } from "@/utils/cx";

export interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Accessible name (defaults to the placeholder). */
    label?: string;
    className?: string;
    autoFocus?: boolean;
}

/** Search box with a clear button. Debounce in the caller (see useDebouncedUrlInput). */
export function SearchInput({ value, onChange, placeholder = "Search…", label, className, autoFocus }: SearchInputProps) {
    return (
        <div className={cx("relative min-w-0", className)}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={label ?? placeholder}
                autoFocus={autoFocus}
                className="h-10 w-full rounded-control border border-line-strong bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent-500 [&::-webkit-search-cancel-button]:hidden"
            />
            {value && (
                <button
                    type="button"
                    onClick={() => onChange("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-faint hover:bg-brand-50 hover:text-ink"
                >
                    <X className="h-4 w-4" aria-hidden />
                </button>
            )}
        </div>
    );
}

export interface FilterOption {
    value: string;
    label: string;
}

export interface FilterSelectProps {
    /** Name of the filter ("Status"); used for the accessible name and chips. */
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: FilterOption[];
    /** Text of the "no filter" option (default `All`). Its value is "". */
    allLabel?: string;
    className?: string;
}

/**
 * A filter as a native select: works with the keyboard, screen readers and
 * the phone's own picker. Highlighted when a value is chosen.
 */
export function FilterSelect({ label, value, onChange, options, allLabel, className }: FilterSelectProps) {
    const id = useId();
    const active = value !== "";
    return (
        <div className={cx("relative shrink-0", className)}>
            <label htmlFor={id} className="sr-only">
                {label}
            </label>
            <select
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={cx(
                    "h-10 max-w-[16rem] cursor-pointer appearance-none truncate rounded-control border pl-3 pr-8 text-sm font-medium transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent-500",
                    active ? "border-accent-300 bg-accent-50 text-accent-700" : "border-line-strong bg-surface text-ink-muted hover:text-ink"
                )}
            >
                <option value="">{allLabel ?? `${label}: all`}</option>
                {options
                    .filter((o) => o.value !== "")
                    .map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
        </div>
    );
}

export interface FilterChip {
    key: string;
    label: ReactNode;
    onRemove: () => void;
}

export interface FilterBarProps {
    /** Search box (optional). */
    search?: SearchInputProps;
    /** Filters (FilterSelect, small inputs). Scroll sideways on phones. */
    children?: ReactNode;
    /** Active filters shown as removable chips. */
    chips?: FilterChip[];
    /** Shows "Clear all" when something is filtered. */
    onReset?: () => void;
    /** Right-aligned extras (view toggles, counts). */
    actions?: ReactNode;
    className?: string;
}

/** Search + filters + active-filter chips — the one list toolbar. */
export function FilterBar({ search, children, chips = [], onReset, actions, className }: FilterBarProps) {
    const showReset = !!onReset && (chips.length > 0 || !!search?.value);
    return (
        <div className={cx("space-y-2.5", className)}>
            <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
                {search && <SearchInput {...search} className={cx("xl:max-w-md xl:flex-1", search.className)} />}
                {(children || actions) && (
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        {children && <div className="no-scrollbar -mx-4 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">{children}</div>}
                        {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
                    </div>
                )}
            </div>
            {(chips.length > 0 || showReset) && (
                <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
                    {chips.map((chip) => (
                        <span
                            key={chip.key}
                            className="inline-flex items-center gap-1 rounded-full border border-accent-200 bg-accent-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-accent-700"
                        >
                            {chip.label}
                            <button
                                type="button"
                                onClick={chip.onRemove}
                                aria-label={`Remove filter ${typeof chip.label === "string" ? chip.label : chip.key}`}
                                className="rounded-full p-0.5 hover:bg-accent-100"
                            >
                                <X className="h-3 w-3" aria-hidden />
                            </button>
                        </span>
                    ))}
                    {showReset && (
                        <button type="button" onClick={onReset} className="rounded-full px-2 py-0.5 text-xs font-medium text-ink-muted hover:bg-brand-50 hover:text-ink">
                            Clear all
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
