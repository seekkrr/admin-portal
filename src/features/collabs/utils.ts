import { formatDate, formatDateTime } from "@/utils/format";
import { BUSINESS_FEATURE_DEFAULTS, type AdminBusiness, type BusinessFeatures, type CollabsPage, type EntitlementKey } from "./types";

/** A business's Collabs / Experiences switches, falling back to the backend defaults for older profiles. */
export function featuresOf(business: Pick<AdminBusiness, "features">): BusinessFeatures {
    const f = business.features ?? {};
    return {
        collabs: typeof f.collabs === "boolean" ? f.collabs : BUSINESS_FEATURE_DEFAULTS.collabs,
        experiences: typeof f.experiences === "boolean" ? f.experiences : BUSINESS_FEATURE_DEFAULTS.experiences,
    };
}

/**
 * Collab/business serializers emit naive ISO datetimes (no offset) that are
 * UTC. `new Date("2026-10-19T08:15:30")` would read them as LOCAL time, so
 * append `Z` when no timezone designator is present. Date-only strings
 * (YYYY-MM-DD) are left alone.
 */
export function asUtcIso(iso: string | null | undefined): string | null {
    if (!iso) return null;
    if (!iso.includes("T")) return iso;
    return /(Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`;
}

export function fmtDateTime(iso: string | null | undefined): string {
    return formatDateTime(asUtcIso(iso));
}

export function fmtDate(iso: string | null | undefined): string {
    return formatDate(asUtcIso(iso));
}

/** Build a query string, dropping undefined/null/"" values. */
export function toQuery(params: object): string {
    const qs = new URLSearchParams();
    Object.entries(params as Record<string, unknown>).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const s = qs.toString();
    return s ? `?${s}` : "";
}

/** Collab-admin lists omit total_pages; derive it. */
export function totalPagesOf(p: Pick<CollabsPage, "total" | "page_size"> | undefined): number {
    if (!p || !p.page_size) return 1;
    return Math.max(1, Math.ceil(p.total / p.page_size));
}

/** "no_show" → "No show". */
export function humanize(value: string | null | undefined): string {
    if (!value) return "—";
    const s = value.replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Whole-rupee amounts (plan prices / MRR are integers in INR). */
export function formatInr(amount: number | null | undefined): string {
    if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export function formatPercent(ratio: number | null | undefined, digits = 0): string {
    if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return "—";
    return `${(ratio * 100).toFixed(digits)}%`;
}

/** Split a comma/newline separated string into trimmed, de-duplicated values. */
export function splitList(value: string): string[] {
    return Array.from(new Set(value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)));
}

/** Datetime-local input value ("YYYY-MM-DDTHH:mm") ⇄ ISO. */
export function isoToLocalInput(iso: string | null | undefined): string {
    const norm = asUtcIso(iso);
    if (!norm) return "";
    const d = new Date(norm);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToIso(value: string): string | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ── Entitlements metadata ──────────────────────────────────

export interface EntitlementMeta {
    key: EntitlementKey;
    label: string;
    kind: "limit" | "flag";
    hint?: string;
}

export const ENTITLEMENT_FIELDS: EntitlementMeta[] = [
    { key: "active_collabs", label: "Active collabs", kind: "limit" },
    { key: "redemptions_per_month", label: "Redemptions / month", kind: "limit" },
    { key: "team_members", label: "Team members", kind: "limit" },
    { key: "locations", label: "Locations", kind: "limit" },
    { key: "match_reveals_per_month", label: "Match reveals / month", kind: "limit" },
    { key: "invites_per_month", label: "Invites / month", kind: "limit" },
    { key: "approval_mode", label: "Approval mode + advance requests", kind: "flag" },
    { key: "match_breakdown", label: "Match score breakdown", kind: "flag" },
    { key: "attribution", label: "Attribution (full)", kind: "flag", hint: "Off = counts only" },
    { key: "content_library", label: "Content library", kind: "flag" },
    { key: "featured", label: "Featured pin + priority listing", kind: "flag" },
];

/** Best-effort public profile URL for a creator handle. */
export function socialProfileUrl(platform: string, handle: string): string | null {
    const h = handle.trim().replace(/^@/, "");
    if (!h) return null;
    if (/^https?:\/\//i.test(h)) return h;
    switch (platform) {
        case "instagram":
            return `https://instagram.com/${h}`;
        case "youtube":
            return `https://youtube.com/@${h}`;
        case "x":
            return `https://x.com/${h}`;
        case "facebook":
            return `https://facebook.com/${h}`;
        case "linkedin":
            return `https://linkedin.com/in/${h}`;
        case "website":
            return `https://${h}`;
        default:
            return null;
    }
}
