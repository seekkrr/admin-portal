import type { ExperienceOption, ExperienceSlot } from "@/types/admin-detail";

/**
 * The Schedule tab's pure logic: what state a slot is in, how full a day is,
 * and where each slot sits on the day timeline (one lane per option; slots of
 * the same option that overlap get extra rows). Mirrors the Partner Portal.
 */

export type SlotState = "open" | "booked" | "full" | "taken" | "blocked" | "no_price" | "past" | "cancelled";

export const SLOT_STATE_META: Record<SlotState, { label: string; block: string; dot: string }> = {
    open: { label: "Open", block: "bg-surface border-good-line text-good hover:border-good", dot: "bg-good" },
    booked: { label: "Booked", block: "bg-accent-50 border-accent-200 text-brand-900 hover:border-accent-500", dot: "bg-accent-400" },
    full: { label: "Full", block: "bg-brand-900 border-brand-900 text-white hover:bg-brand-700", dot: "bg-brand-900" },
    taken: { label: "Taken", block: "bg-surface-muted border-line text-ink-faint hover:border-line-strong", dot: "bg-line-strong" },
    blocked: { label: "Blocked", block: "bg-warn-soft border-warn-line text-warn hover:border-warn", dot: "bg-warn" },
    no_price: { label: "No price", block: "bg-surface border-dashed border-warn-line text-warn hover:border-warn", dot: "border border-dashed border-warn" },
    past: { label: "Past", block: "bg-surface-muted border-line text-ink-faint", dot: "bg-line" },
    cancelled: { label: "Cancelled", block: "bg-surface border-line text-ink-faint line-through", dot: "bg-surface border border-line-strong" },
};

export const LEGEND: SlotState[] = ["open", "booked", "full", "taken", "blocked", "no_price"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Not started yet (the server's instant when there is one, else the IST wall-clock date and time). */
export function isUpcoming(s: Pick<ExperienceSlot, "starts_at" | "date" | "start_time">, now = new Date()): boolean {
    if (s.starts_at) return Date.parse(s.starts_at) > now.getTime();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    if (s.date !== today) return s.date > today;
    return s.start_time > `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function slotState(s: ExperienceSlot, now = new Date()): SlotState {
    if (s.status === "cancelled") return "cancelled";
    if (!isUpcoming(s, now)) return "past";
    if (s.blocked) return "blocked";
    const booked = s.booked ?? 0;
    if (booked >= s.capacity) return "full";
    // A private slot with a group in it is closed to everyone else.
    if (booked > 0) return s.unavailable_reason === "private_booked" ? "full" : "booked";
    if (s.taken_by || s.unavailable_reason === "time_taken") return "taken";
    if (s.unavailable_reason === "price_not_set") return "no_price";
    return "open";
}

/** A slot the team can still act on (block, resize, cancel). */
export function isActionable(s: ExperienceSlot, now = new Date()): boolean {
    return s.status === "open" && isUpcoming(s, now);
}

export interface DayStats {
    slots: number;
    booked: number;
    capacity: number;
    pct: number | null;
}

export function dayStats(slots: ExperienceSlot[]): DayStats {
    const open = slots.filter((s) => s.status === "open");
    const booked = open.reduce((n, s) => n + (s.booked ?? 0), 0);
    const capacity = open.reduce((n, s) => n + s.capacity, 0);
    return { slots: open.length, booked, capacity, pct: capacity ? Math.round((booked / capacity) * 100) : null };
}

export function minutesOf(t: string): number {
    const [h = 0, m = 0] = t.split(":").map(Number);
    return h * 60 + m;
}

export function hhmm(minutes: number): string {
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export interface PlacedSlot {
    slot: ExperienceSlot;
    left: number;
    width: number;
}

export interface Lane {
    key: string;
    label: string;
    rows: PlacedSlot[][];
}

export interface DayLayout {
    start: number;
    end: number;
    lanes: Lane[];
}

/** Lanes for one day in the experience's option order, overlapping slots of one option on extra rows. */
export function layoutDay(slots: ExperienceSlot[], options: Pick<ExperienceOption, "id" | "name">[]): DayLayout {
    if (!slots.length) return { start: 9 * 60, end: 18 * 60, lanes: [] };
    const start = Math.floor(Math.min(...slots.map((s) => minutesOf(s.start_time))) / 60) * 60;
    const end = Math.ceil(Math.max(...slots.map((s) => minutesOf(s.end_time))) / 60) * 60;
    const order = options.map((o) => o.id);
    const names = new Map(options.map((o) => [o.id, o.name]));
    const groups = new Map<string, ExperienceSlot[]>();
    for (const s of slots) {
        const key = s.option_id && names.has(s.option_id) ? s.option_id : `other:${s.option_name ?? ""}`;
        groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    const keys = [...groups.keys()].sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib) || a.localeCompare(b);
    });
    const lanes = keys.map((key) => {
        const list = [...(groups.get(key) ?? [])].sort((a, b) => a.start_time.localeCompare(b.start_time));
        const rows: PlacedSlot[][] = [];
        const rowEnds: number[] = [];
        for (const slot of list) {
            const s0 = minutesOf(slot.start_time);
            const s1 = Math.max(minutesOf(slot.end_time), s0 + 1);
            let row = rowEnds.findIndex((e) => e <= s0);
            if (row === -1) {
                row = rows.length;
                rows.push([]);
                rowEnds.push(0);
            }
            rows[row]?.push({ slot, left: s0 - start, width: s1 - s0 });
            rowEnds[row] = s1;
        }
        const label = names.get(key) ?? list[0]?.option_name ?? (options.length ? "Other" : "Slots");
        return { key, label, rows };
    });
    return { start, end, lanes };
}

/** A day's open slots as "Add slots" calls: one per option and capacity, with every time of that group. */
export function copyGroups(slots: ExperienceSlot[]): Array<{ option_id: string | null; capacity: number; times: Array<{ start: string; end: string }> }> {
    const map = new Map<string, { option_id: string | null; capacity: number; times: Array<{ start: string; end: string }> }>();
    for (const s of slots) {
        if (s.status !== "open") continue;
        const key = `${s.option_id ?? ""}|${s.capacity}`;
        const group = map.get(key) ?? { option_id: s.option_id, capacity: s.capacity, times: [] };
        if (!group.times.some((t) => t.start === s.start_time && t.end === s.end_time)) {
            group.times.push({ start: s.start_time, end: s.end_time });
        }
        map.set(key, group);
    }
    return [...map.values()].map((g) => ({ ...g, times: g.times.sort((a, b) => a.start.localeCompare(b.start)) }));
}
