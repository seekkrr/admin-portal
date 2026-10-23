import { fromLocalInput, toLocalInput } from "@/components/detail/detailFormat";
import type { EventStatus, V2EventDetail } from "@/types";
import type { EventPayload, EventVenue } from "@/types/admin-detail";

export interface EventForm {
    title: string;
    subtitle: string;
    description: string;
    website: string;
    categories: string[];
    start: string;
    end: string;
    timezone: string;
    region_id: string;
    capacity: string;
    is_featured: boolean;
    status: EventStatus;
    cover: string;
    gallery: string[];
    venues: EventVenue[];
    main_venue_marker_id: string;
}

export const EVENT_STATUSES: { value: EventStatus; label: string }[] = [
    { value: "draft", label: "Draft" },
    { value: "pending", label: "Pending review" },
    { value: "published", label: "Published" },
    { value: "live", label: "Live now" },
    { value: "ended", label: "Ended" },
    { value: "cancelled", label: "Cancelled" },
];

export function blankEvent(): EventForm {
    return {
        title: "",
        subtitle: "",
        description: "",
        website: "",
        categories: [],
        start: "",
        end: "",
        timezone: "Asia/Kolkata",
        region_id: "",
        capacity: "",
        is_featured: false,
        status: "draft",
        cover: "",
        gallery: [],
        venues: [],
        main_venue_marker_id: "",
    };
}

export function eventFormOf(e: V2EventDetail): EventForm {
    const raw = e as V2EventDetail & { website?: string | null; main_venue_marker_id?: string | null };
    return {
        title: e.title ?? "",
        subtitle: e.subtitle ?? "",
        description: e.description ?? "",
        website: raw.website ?? "",
        categories: e.categories ?? [],
        start: toLocalInput(e.start_date),
        end: toLocalInput(e.end_date),
        timezone: e.timezone ?? "Asia/Kolkata",
        region_id: e.region_id ?? "",
        capacity: e.capacity === null || e.capacity === undefined ? "" : String(e.capacity),
        is_featured: !!e.is_featured,
        status: e.status,
        cover: e.media?.cover_image_url ?? "",
        gallery: e.media?.image_urls ?? [],
        venues: (e.venues ?? []).map((v) => ({ ...v })) as EventVenue[],
        main_venue_marker_id: raw.main_venue_marker_id ?? "",
    };
}

export function eventErrors(f: EventForm): string[] {
    const out: string[] = [];
    if (!f.title.trim()) out.push("Add a title.");
    if (f.start && f.end && f.end < f.start) out.push("The event ends before it starts.");
    if (f.capacity.trim() && (!Number.isInteger(Number(f.capacity)) || Number(f.capacity) < 0)) out.push("Capacity must be a whole number, 0 or more.");
    if (f.website.trim() && !/^https?:\/\/\S+$/.test(f.website.trim())) out.push("The website must start with https://");
    return out;
}

function boundingBox(venues: EventVenue[]): EventPayload["bounding_box"] | undefined {
    const pts = venues.map((v) => v.coordinates).filter((c): c is number[] => Array.isArray(c) && c.length === 2 && c.every((n) => Number.isFinite(n)));
    if (!pts.length) return undefined;
    const lngs = pts.map((p) => p[0] as number);
    const lats = pts.map((p) => p[1] as number);
    const pad = 0.01;
    return { min: [Math.min(...lngs) - pad, Math.min(...lats) - pad], max: [Math.max(...lngs) + pad, Math.max(...lats) + pad] };
}

/** The full body this form describes (status is set separately). */
function payloadOf(f: EventForm): EventPayload {
    const media: EventPayload["media"] = {};
    if (f.cover.trim()) media.cover_image_url = f.cover.trim();
    media.image_urls = f.gallery;
    const withMarker = f.venues.filter((v) => v.marker_id);
    const main = withMarker.some((v) => v.marker_id === f.main_venue_marker_id) ? f.main_venue_marker_id : (withMarker[0]?.marker_id ?? null);
    const out: EventPayload = {
        title: f.title.trim(),
        subtitle: f.subtitle.trim(),
        description: f.description.trim(),
        website: f.website.trim(),
        categories: f.categories,
        start_date: fromLocalInput(f.start),
        end_date: fromLocalInput(f.end),
        timezone: f.timezone.trim() || "Asia/Kolkata",
        media,
        venues: f.venues,
        main_venue_marker_id: main,
        is_featured: f.is_featured,
    };
    if (f.region_id) out.region_id = f.region_id;
    if (f.capacity.trim()) out.capacity = Number(f.capacity);
    const bbox = boundingBox(f.venues);
    if (bbox) out.bounding_box = bbox;
    return out;
}

/** New event: everything that's filled in. */
export function createPayload(f: EventForm): EventPayload {
    const kept = Object.entries(payloadOf(f)).filter(([, v]) => !(v === "" || v === null || (Array.isArray(v) && v.length === 0)));
    return Object.fromEntries(kept) as EventPayload;
}

/** Existing event: only what changed. The server ignores empty values, so a field can't be blanked. */
export function changedPayload(f: EventForm, base: EventForm): EventPayload {
    const next = payloadOf(f);
    const prev = payloadOf(base);
    const out: Record<string, unknown> = {};
    (Object.keys(next) as (keyof EventPayload)[]).forEach((k) => {
        if (JSON.stringify(next[k]) !== JSON.stringify(prev[k])) out[k] = next[k];
    });
    if ("venues" in out && next.bounding_box) out.bounding_box = next.bounding_box;
    return out as EventPayload;
}
