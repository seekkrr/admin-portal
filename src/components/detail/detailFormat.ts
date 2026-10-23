/** Small formatting helpers shared by the detail pages. */

export function fullName(first?: string | null, last?: string | null): string {
    return `${first ?? ""} ${last ?? ""}`.trim();
}

export function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function rupees(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    if (value === 0) return "Free";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

export function count(value: number | null | undefined): string {
    return (value ?? 0).toLocaleString("en-IN");
}

export const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** "07:30" → "7:30 am". */
export function hhmmLabel(hhmm: string | null | undefined): string {
    if (!hhmm) return "—";
    const [h, m] = hhmm.split(":").map((x) => Number.parseInt(x, 10));
    if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return hhmm;
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** "2026-11-15" → "Sun, 15 Nov 2026" (calendar date, no timezone shift). */
export function calendarDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    const [y, mo, d] = iso.split("-").map((x) => Number.parseInt(x, 10));
    if (!y || !mo || !d) return iso;
    return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
}

/** Today in India as YYYY-MM-DD (slot dates are IST calendar dates). */
export function todayIst(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function addDays(iso: string, days: number): string {
    const [y, mo, d] = iso.split("-").map((x) => Number.parseInt(x, 10));
    const date = new Date(Date.UTC(y ?? 1970, (mo ?? 1) - 1, d ?? 1));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

/** ISO datetime → value for <input type="datetime-local"> (local time). */
export function toLocalInput(iso: string | null | undefined): string {
    if (!iso) return "";
    const norm = iso.includes("T") && !/(Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? `${iso}Z` : iso;
    const d = new Date(norm);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO (UTC), or null. */
export function fromLocalInput(value: string): string | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function sameList(a: readonly unknown[], b: readonly unknown[]): boolean {
    return a.length === b.length && a.every((v, i) => JSON.stringify(v) === JSON.stringify(b[i]));
}
