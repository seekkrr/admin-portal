import { FilterSelect } from "@/components/ui/FilterBar";
import { cx } from "@/utils/cx";
import { PRESETS, presetOf, presetRange, type DateRange, type Preset } from "../dateRange";

const dateClass =
    "h-10 w-[9.5rem] shrink-0 rounded-control border border-line-strong bg-surface px-3 text-sm text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent-500";

/** Period picker for money pages: a quick range plus from / to dates (IST calendar days). */
export function DateRangeFilter({ value, onChange, className }: { value: DateRange; onChange: (next: DateRange) => void; className?: string }) {
    return (
        <div className={cx("flex shrink-0 items-center gap-2", className)}>
            <FilterSelect
                label="Period"
                value={presetOf(value)}
                onChange={(p) => onChange(p ? presetRange(p as Preset) : { from: "", to: "" })}
                options={PRESETS.map((p) => ({ value: p.value, label: p.label }))}
                allLabel="All time"
            />
            <input
                type="date"
                aria-label="From date"
                className={dateClass}
                value={value.from}
                max={value.to || undefined}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
            />
            <span className="text-sm text-ink-faint" aria-hidden>
                –
            </span>
            <input
                type="date"
                aria-label="To date"
                className={dateClass}
                value={value.to}
                min={value.from || undefined}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
        </div>
    );
}
