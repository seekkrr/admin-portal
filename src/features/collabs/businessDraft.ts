import { splitList } from "./utils";
import type { AdminBusiness, BusinessStatus, CreateBusinessPayload, UpdateBusinessPayload } from "./types";

/** Editable form state for a business profile (create + admin edit). */
export interface BusinessDraft {
    name: string;
    tagline: string;
    description: string;
    categories: string; // comma separated
    region_id: string;
    marker_ids: string[];
    contact_phone: string;
    contact_email: string;
    public_slug: string;
    show_on_website: boolean;
    website_featured: boolean;
    verified: boolean;
    status: BusinessStatus;
}

export function emptyBusinessDraft(): BusinessDraft {
    return {
        name: "",
        tagline: "",
        description: "",
        categories: "",
        region_id: "",
        marker_ids: [],
        contact_phone: "",
        contact_email: "",
        public_slug: "",
        show_on_website: true,
        website_featured: false,
        verified: true,
        status: "pending_claim",
    };
}

export function draftFromBusiness(b: AdminBusiness): BusinessDraft {
    return {
        name: b.name ?? "",
        tagline: b.tagline ?? "",
        description: b.description ?? "",
        categories: (b.categories ?? []).join(", "),
        region_id: b.region_id ?? "",
        marker_ids: b.marker_ids ?? [],
        contact_phone: b.contact_phone ?? "",
        contact_email: b.contact_email ?? "",
        public_slug: b.slug ?? "",
        show_on_website: !!b.show_on_website,
        website_featured: !!b.website_featured,
        verified: !!b.verified,
        status: b.status,
    };
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Only changed fields — PATCH drops nulls, so a field can't be "cleared" to
 * null; region/slug are only sent when non-empty.
 */
export function diffBusinessDraft(draft: BusinessDraft, b: AdminBusiness): UpdateBusinessPayload {
    const base = draftFromBusiness(b);
    const out: UpdateBusinessPayload = {};
    if (draft.name.trim() !== base.name) out.name = draft.name.trim();
    if (draft.tagline.trim() !== base.tagline) out.tagline = draft.tagline.trim();
    if (draft.description.trim() !== base.description) out.description = draft.description.trim();
    const cats = splitList(draft.categories);
    if (!sameList(cats, b.categories ?? [])) out.categories = cats;
    if (draft.region_id && draft.region_id !== base.region_id) out.region_id = draft.region_id;
    if (!sameList(draft.marker_ids, base.marker_ids)) out.marker_ids = draft.marker_ids;
    if (draft.contact_phone.trim() !== base.contact_phone) out.contact_phone = draft.contact_phone.trim();
    if (draft.contact_email.trim() !== base.contact_email) out.contact_email = draft.contact_email.trim();
    const slug = draft.public_slug.trim();
    if (slug && slug !== base.public_slug) out.public_slug = slug;
    if (draft.show_on_website !== base.show_on_website) out.show_on_website = draft.show_on_website;
    if (draft.website_featured !== base.website_featured) out.website_featured = draft.website_featured;
    if (draft.verified !== base.verified) out.verified = draft.verified;
    if (draft.status !== base.status) out.status = draft.status;
    return out;
}

export function createPayloadFromDraft(draft: BusinessDraft): CreateBusinessPayload {
    const out: CreateBusinessPayload = { name: draft.name.trim() };
    if (draft.tagline.trim()) out.tagline = draft.tagline.trim();
    if (draft.description.trim()) out.description = draft.description.trim();
    const cats = splitList(draft.categories);
    if (cats.length) out.categories = cats;
    if (draft.region_id) out.region_id = draft.region_id;
    if (draft.marker_ids.length) out.marker_ids = draft.marker_ids;
    if (draft.contact_phone.trim()) out.contact_phone = draft.contact_phone.trim();
    if (draft.contact_email.trim()) out.contact_email = draft.contact_email.trim();
    if (draft.public_slug.trim()) out.public_slug = draft.public_slug.trim();
    out.show_on_website = draft.show_on_website;
    out.website_featured = draft.website_featured;
    return out;
}

/** The backend slugifies + de-duplicates; we only enforce its 2–80 length. */
export function slugError(slug: string): string | null {
    const s = slug.trim();
    if (!s) return null;
    if (s.length < 2 || s.length > 80) return "Slug must be 2–80 characters.";
    return null;
}
