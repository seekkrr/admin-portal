import type { Marker, MarkerStatus } from "@/types";

export type SubscriptionFlag = "NA" | "Virtual" | "Physical" | "Both";

/** Editable copy of a place's details (not location or photos). */
export interface MarkerDetailsForm {
    title: string;
    categories: string[];
    sub_categories: string[];
    description: string;
    address: string;
    tags: string[];
    status: MarkerStatus;
    hidden: boolean;
    website_url: string;
    contact: string;
    map_url: string;
    opens_at: string;
    closes_at: string;
    min_expense: string;
    max_expense: string;
    region_id: string;
    things_to_do_text: string;
    things_to_do_image_url: string;
    subscription_flag: SubscriptionFlag;
}

/** The server sends hours as an ISO datetime; the form edits HH:MM. */
export function hhmmOf(value: string | null | undefined): string {
    if (!value) return "";
    const t = /T(\d{2}:\d{2})/.exec(value) ?? /^(\d{2}:\d{2})/.exec(value);
    return t?.[1] ?? "";
}

export function detailsFormOf(m: Marker): MarkerDetailsForm {
    return {
        title: m.title ?? "",
        categories: m.categories ?? [],
        sub_categories: m.sub_categories ?? [],
        description: m.description ?? "",
        address: m.address ?? "",
        tags: m.tags ?? [],
        status: m.status,
        hidden: !!m.hidden,
        website_url: m.website_url ?? "",
        contact: m.contact ?? "",
        map_url: m.map_url ?? "",
        opens_at: hhmmOf(m.opens_at),
        closes_at: hhmmOf(m.closes_at),
        min_expense: m.min_expense === null || m.min_expense === undefined ? "" : String(m.min_expense),
        max_expense: m.max_expense === null || m.max_expense === undefined ? "" : String(m.max_expense),
        region_id: m.region_id ?? "",
        things_to_do_text: m.things_to_do_text ?? "",
        things_to_do_image_url: m.things_to_do_image_url ?? "",
        subscription_flag: m.subscription_flag ?? "NA",
    };
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Problems that block saving. */
export function detailsErrors(f: MarkerDetailsForm): Partial<Record<keyof MarkerDetailsForm, string>> {
    const out: Partial<Record<keyof MarkerDetailsForm, string>> = {};
    if (!f.title.trim()) out.title = "A name is required.";
    const min = f.min_expense.trim() ? Number(f.min_expense) : null;
    const max = f.max_expense.trim() ? Number(f.max_expense) : null;
    if (min !== null && (!Number.isFinite(min) || min < 0)) out.min_expense = "0 or more.";
    if (max !== null && (!Number.isFinite(max) || max < 0)) out.max_expense = "0 or more.";
    if (min !== null && max !== null && min > max) out.max_expense = "Can't be below the minimum.";
    if (f.website_url.trim() && !/^https?:\/\/\S+$/.test(f.website_url.trim())) out.website_url = "Start with https://";
    if (f.map_url.trim() && !/^https?:\/\/\S+$/.test(f.map_url.trim())) out.map_url = "Start with https://";
    return out;
}

/** Only changed fields, in PUT /markers/{id} shape. */
export function detailsChanges(f: MarkerDetailsForm, base: MarkerDetailsForm): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const textKeys = ["title", "description", "address", "website_url", "contact", "map_url", "things_to_do_text", "things_to_do_image_url"] as const;
    textKeys.forEach((k) => {
        if (f[k].trim() !== base[k]) out[k] = f[k].trim();
    });
    if (!same(f.categories, base.categories)) out.categories = f.categories;
    if (!same(f.sub_categories, base.sub_categories)) out.sub_categories = f.sub_categories;
    if (!same(f.tags, base.tags)) out.tags = f.tags;
    if (f.status !== base.status) out.status = f.status;
    if (f.hidden !== base.hidden) out.hidden = f.hidden;
    if (f.subscription_flag !== base.subscription_flag) out.subscription_flag = f.subscription_flag;
    if (f.region_id !== base.region_id) out.region_id = f.region_id;
    if (f.opens_at !== base.opens_at && f.opens_at) out.opens_at = f.opens_at;
    if (f.closes_at !== base.closes_at && f.closes_at) out.closes_at = f.closes_at;
    if (f.min_expense.trim() !== base.min_expense && f.min_expense.trim()) out.min_expense = Number(f.min_expense);
    if (f.max_expense.trim() !== base.max_expense && f.max_expense.trim()) out.max_expense = Number(f.max_expense);
    return out;
}
