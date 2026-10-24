import { addDays, todayIst } from "@/components/detail/detailFormat";

export interface DateRange {
    from: string;
    to: string;
}

export const PRESETS = [
    { value: "this_month", label: "This month" },
    { value: "last_month", label: "Last month" },
    { value: "last_30", label: "Last 30 days" },
    { value: "this_year", label: "This year" },
] as const;

export type Preset = (typeof PRESETS)[number]["value"];

export function presetRange(p: Preset): DateRange {
    const today = todayIst();
    const [y = "1970", m = "01"] = today.split("-");
    if (p === "this_month") return { from: `${y}-${m}-01`, to: today };
    if (p === "last_month") {
        const firstThis = `${y}-${m}-01`;
        const lastPrev = addDays(firstThis, -1);
        return { from: `${lastPrev.slice(0, 7)}-01`, to: lastPrev };
    }
    if (p === "last_30") return { from: addDays(today, -29), to: today };
    return { from: `${y}-01-01`, to: today };
}

export function presetOf(r: DateRange): Preset | "" {
    return PRESETS.find((p) => {
        const x = presetRange(p.value);
        return x.from === r.from && x.to === r.to;
    })?.value ?? "";
}

/** Chip text: the preset's name, or the dates picked. */
export function rangeLabel(r: DateRange): string {
    const preset = presetOf(r);
    if (preset) return PRESETS.find((p) => p.value === preset)?.label ?? "";
    if (r.from && r.to) return `${r.from} to ${r.to}`;
    if (r.from) return `From ${r.from}`;
    if (r.to) return `Until ${r.to}`;
    return "All time";
}
