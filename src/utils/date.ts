/**
 * The one place for dates in the admin portal.
 *
 * The backend stores UTC and often serialises datetimes without an offset
 * ("2026-10-19T08:15:30"). `new Date()` would read those as LOCAL time, so a
 * naive datetime is treated as UTC here. Date-only strings (YYYY-MM-DD) are
 * left as calendar dates.
 *
 * Formats (en-IN):
 *   formatDate      → 23 Oct 2026
 *   formatDateTime  → 23 Oct 2026, 02:15 pm
 *   formatTime      → 02:15 pm
 *   formatRelative  → just now · 5 min ago · 3 hours ago · yesterday · 4 days ago · 23 Oct 2026
 */

export type DateInput = string | number | Date | null | undefined;

const LOCALE = "en-IN";

/** Append `Z` to an ISO datetime that has no timezone designator. */
export function asUtcIso(iso: string | null | undefined): string | null {
    if (!iso) return null;
    if (!iso.includes("T")) return iso;
    return /(Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`;
}

/** Parse anything date-like into a valid Date, or null. */
export function toDate(value: DateInput): Date | null {
    if (value === null || value === undefined || value === "") return null;
    const d = value instanceof Date ? value : new Date(typeof value === "string" ? (asUtcIso(value) ?? value) : value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: DateInput): string {
    const d = toDate(value);
    if (!d) return "—";
    return d.toLocaleDateString(LOCALE, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value: DateInput): string {
    const d = toDate(value);
    if (!d) return "—";
    return d.toLocaleString(LOCALE, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatTime(value: DateInput): string {
    const d = toDate(value);
    if (!d) return "—";
    return d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
}

const RTF = typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl
    ? new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" })
    : null;

/**
 * Short relative time for the last week ("5 min ago", "yesterday"), the plain
 * date after that. Future times read "in 3 hours" etc.
 */
export function formatRelative(value: DateInput, now: Date = new Date()): string {
    const d = toDate(value);
    if (!d) return "—";
    const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
    const abs = Math.abs(diffSec);
    if (abs < 45) return "just now";
    if (!RTF) return formatDateTime(d);
    if (abs < 3600) return RTF.format(Math.round(diffSec / 60), "minute");
    if (abs < 86400) return RTF.format(Math.round(diffSec / 3600), "hour");
    if (abs < 7 * 86400) return RTF.format(Math.round(diffSec / 86400), "day");
    return formatDate(d);
}
