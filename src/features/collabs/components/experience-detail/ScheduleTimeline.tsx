import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, hhmmLabel, todayIst } from "@/components/detail/detailFormat";
import type { ExperienceOption, ExperienceSlot } from "@/types/admin-detail";
import { cx } from "@/utils/cx";
import { LEGEND, SLOT_STATE_META, dayStats, hhmm, layoutDay, slotState } from "./schedule";

const PX_PER_MIN = 2.4;
const ROW_H = 52;
/** The option-name column (w-24). */
const LABEL_W = 96;

const weekdayShort = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });
const dayNum = (iso: string) => new Date(`${iso}T00:00:00`).getDate();
const monthShort = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { month: "short" });

/** Two weeks of days with how full each is; arrows move a week, the date field jumps. */
export function DayStrip({
    start,
    days,
    selected,
    slotsByDay,
    onSelect,
    onMove,
    onJump,
}: {
    start: string;
    days: number;
    selected: string;
    slotsByDay: Map<string, ExperienceSlot[]>;
    onSelect: (day: string) => void;
    onMove: (deltaDays: number) => void;
    onJump: (day: string) => void;
}) {
    const today = todayIst();
    const list = Array.from({ length: days }, (_, i) => addDays(start, i));
    const first = list[0] ?? start;
    const last = list[list.length - 1] ?? start;
    return (
        <div className="rounded-card border border-line bg-surface p-2 shadow-sm sm:p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => onMove(-7)}
                    disabled={start <= today}
                    aria-label="Previous week"
                    className="rounded-control p-1.5 text-ink-muted hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-semibold text-ink">
                    {monthShort(first)}
                    {monthShort(last) !== monthShort(first) ? ` – ${monthShort(last)}` : ""}
                </p>
                <button type="button" onClick={() => onMove(7)} aria-label="Next week" className="rounded-control p-1.5 text-ink-muted hover:bg-brand-50">
                    <ChevronRight className="h-4 w-4" />
                </button>
                <label className="ml-auto inline-flex items-center gap-2 text-xs text-ink-muted">
                    Go to
                    <input
                        type="date"
                        min={today}
                        value={selected}
                        onChange={(e) => e.target.value && onJump(e.target.value)}
                        className="rounded-control border border-line-strong px-2 py-1 text-sm text-ink"
                    />
                </label>
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="listbox" aria-label="Days">
                {list.map((day) => {
                    const stats = dayStats(slotsByDay.get(day) ?? []);
                    const on = day === selected;
                    const busy = stats.pct ?? 0;
                    return (
                        <button
                            key={day}
                            type="button"
                            role="option"
                            aria-selected={on}
                            onClick={() => onSelect(day)}
                            className={cx(
                                "min-w-0 rounded-control border px-1 py-1.5 text-center transition-colors",
                                on ? "border-brand-900 bg-brand-50 ring-1 ring-brand-900" : "border-line hover:border-brand-200",
                                day < today && "opacity-50"
                            )}
                        >
                            <span className="block truncate text-[11px] text-ink-muted">{day === today ? "Today" : weekdayShort(day)}</span>
                            <span className="block text-base font-semibold leading-tight text-ink">{dayNum(day)}</span>
                            {stats.slots ? (
                                <>
                                    <span className="mx-1 mt-1 block h-1 overflow-hidden rounded-full bg-surface-muted">
                                        <span
                                            className={cx("block h-full rounded-full", busy >= 100 ? "bg-bad" : "bg-accent-500")}
                                            style={{ width: `${Math.max(busy, busy ? 6 : 0)}%` }}
                                        />
                                    </span>
                                    <span className="mt-0.5 block truncate text-[11px] tabular-nums text-ink-muted">
                                        {stats.booked}/{stats.capacity}
                                    </span>
                                </>
                            ) : (
                                <span className="mt-1.5 block truncate text-[11px] text-ink-faint">
                                    <span className="hidden sm:inline">No slots</span>
                                    <span className="sm:hidden" aria-label="No slots">
                                        –
                                    </span>
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function SlotLegend() {
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            {LEGEND.map((state) => (
                <span key={state} className="inline-flex items-center gap-1.5">
                    <span className={cx("h-3 w-3 rounded", SLOT_STATE_META[state].dot)} aria-hidden />
                    {SLOT_STATE_META[state].label}
                </span>
            ))}
        </div>
    );
}

/** One day as a timeline: a lane per option, each slot a block at its time, coloured by state. */
export function DayTimeline({
    slots,
    options,
    activeId,
    selecting,
    picked,
    onOpen,
    onToggle,
}: {
    slots: ExperienceSlot[];
    options: Pick<ExperienceOption, "id" | "name">[];
    activeId: string | null;
    selecting: boolean;
    picked: Set<string>;
    onOpen: (slot: ExperienceSlot) => void;
    onToggle: (slot: ExperienceSlot) => void;
}) {
    const layout = layoutDay(slots, options);
    const width = (layout.end - layout.start) * PX_PER_MIN;
    const hours = Array.from({ length: (layout.end - layout.start) / 60 + 1 }, (_, i) => layout.start + i * 60);
    const now = new Date();
    return (
        <div className="overflow-x-auto">
            <div style={{ width: width + LABEL_W }} className="min-w-full">
                <div className="flex">
                    <div className="sticky left-0 z-10 w-24 shrink-0 bg-surface" />
                    <div className="relative h-6" style={{ width }}>
                        {hours.map((m, i) => (
                            <span
                                key={m}
                                className={cx(
                                    "absolute top-0 text-[11px] tabular-nums text-ink-faint",
                                    i === 0 ? "" : i === hours.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
                                )}
                                style={{ left: (m - layout.start) * PX_PER_MIN }}
                            >
                                {hhmm(m)}
                            </span>
                        ))}
                    </div>
                </div>
                {layout.lanes.map((lane) => (
                    <div key={lane.key} className="flex border-t border-line">
                        <div className="sticky left-0 z-10 w-24 shrink-0 bg-surface py-2 pr-2">
                            <p className="line-clamp-2 text-xs font-semibold leading-snug text-ink" title={lane.label}>
                                {lane.label}
                            </p>
                        </div>
                        <div className="relative" style={{ width, height: lane.rows.length * ROW_H + 8 }}>
                            {hours.map((m) => (
                                <span key={m} aria-hidden className="absolute bottom-0 top-0 border-l border-dashed border-line" style={{ left: (m - layout.start) * PX_PER_MIN }} />
                            ))}
                            {lane.rows.map((row, r) =>
                                row.map(({ slot, left, width: w }) => {
                                    const state = slotState(slot, now);
                                    const meta = SLOT_STATE_META[state];
                                    const isPicked = picked.has(slot.id);
                                    const label = `${lane.label}, ${hhmmLabel(slot.start_time)} – ${hhmmLabel(slot.end_time)}, ${meta.label}, ${slot.booked} of ${slot.capacity} booked`;
                                    return (
                                        <button
                                            key={slot.id}
                                            type="button"
                                            aria-label={label}
                                            aria-pressed={selecting ? isPicked : undefined}
                                            title={label}
                                            onClick={() => (selecting ? onToggle(slot) : onOpen(slot))}
                                            className={cx(
                                                "absolute overflow-hidden rounded-control border px-1.5 py-1 text-left transition-colors",
                                                meta.block,
                                                activeId === slot.id && !selecting && "ring-2 ring-accent-500 ring-offset-1",
                                                isPicked && "ring-2 ring-brand-900 ring-offset-1"
                                            )}
                                            style={{ left: left * PX_PER_MIN + 1, width: Math.max(w * PX_PER_MIN - 3, 28), top: r * ROW_H + 4, height: ROW_H - 6 }}
                                        >
                                            {selecting && (
                                                <span
                                                    className={cx(
                                                        "absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded border",
                                                        isPicked ? "border-brand-900 bg-brand-900 text-white" : "border-line-strong bg-surface"
                                                    )}
                                                    aria-hidden
                                                >
                                                    {isPicked && <Check className="h-3 w-3" />}
                                                </span>
                                            )}
                                            <span className="block truncate text-[11px] font-semibold leading-tight tabular-nums">{slot.start_time}</span>
                                            <span className="block truncate text-[11px] leading-tight tabular-nums">
                                                {state === "taken" || state === "blocked" || state === "no_price" ? meta.label : `${slot.booked}/${slot.capacity}`}
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
