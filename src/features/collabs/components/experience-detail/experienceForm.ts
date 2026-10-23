import type { ExperienceDetail, ExperiencePatch } from "@/types/admin-detail";

/** Editable copy of an experience; every value is text so inputs stay controlled. */
export interface TitledForm extends Record<string, string> {
    title: string;
    description: string;
}

export interface ItineraryForm extends Record<string, string> {
    time_label: string;
    title: string;
    description: string;
    image_url: string;
}

export interface FaqForm extends Record<string, string> {
    question: string;
    answer: string;
}

export interface OptionForm extends Record<string, string> {
    id: string;
    name: string;
    description: string;
    duration_minutes: string;
    price: string;
}

export interface ContentForm {
    title: string;
    tagline: string;
    description: string;
    tags: string[];
    duration_text: string;
    marker_id: string;
    address: string;
    map_url: string;
    /** Kept as they are (not edited here) so a save doesn't drop the pin. */
    lat: number | null;
    lng: number | null;
    region_id: string;
    media: string[];
    experience_media: string[];
    gallery: string[];
    curator: { name: string; title: string; years: string; photo_url: string; note: string };
    highlights: TitledForm[];
    included: TitledForm[];
    cancellation_policy: TitledForm[];
    itinerary: ItineraryForm[];
    faqs: FaqForm[];
    options: OptionForm[];
}

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function formFrom(e: ExperienceDetail): ContentForm {
    return {
        title: e.title ?? "",
        tagline: s(e.tagline),
        description: s(e.description),
        tags: e.tags ?? [],
        duration_text: s(e.duration_text),
        marker_id: s(e.marker_id),
        address: s(e.location?.address),
        map_url: s(e.location?.map_url),
        lat: e.location?.lat ?? null,
        lng: e.location?.lng ?? null,
        region_id: s(e.region_id),
        media: e.media ?? [],
        experience_media: e.experience_media ?? [],
        gallery: e.gallery ?? [],
        curator: {
            name: s(e.curator?.name),
            title: s(e.curator?.title),
            years: s(e.curator?.years),
            photo_url: s(e.curator?.photo_url),
            note: s(e.curator?.note),
        },
        highlights: (e.highlights ?? []).map((x) => ({ title: x.title ?? "", description: s(x.description) })),
        included: (e.included ?? []).map((x) => ({ title: x.title ?? "", description: s(x.description) })),
        cancellation_policy: (e.cancellation_policy ?? []).map((x) => ({ title: x.title ?? "", description: s(x.description) })),
        itinerary: (e.itinerary ?? []).map((x) => ({
            time_label: s(x.time_label),
            title: x.title ?? "",
            description: s(x.description),
            image_url: s(x.image_url),
        })),
        faqs: (e.faqs ?? []).map((x) => ({ question: x.question ?? "", answer: s(x.answer) })),
        options: (e.options ?? []).map((o) => ({
            id: o.id,
            name: o.name ?? "",
            description: s(o.description),
            duration_minutes: s(o.duration_minutes),
            price: s(o.price),
        })),
    };
}

const text = (v: string) => (v.trim() ? v.trim() : null);
const filled = (...vs: string[]) => vs.some((v) => v.trim());
const num = (v: string): number | null => {
    if (!v.trim()) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

/** The full PATCH body this form describes. */
function payloadOf(f: ContentForm): Required<Omit<ExperiencePatch, "region_id" | "location">> & Pick<ExperiencePatch, "region_id" | "location"> {
    const linked = !!f.marker_id;
    const years = num(f.curator.years);
    return {
        title: f.title.trim(),
        tagline: text(f.tagline),
        description: text(f.description),
        tags: f.tags,
        duration_text: text(f.duration_text),
        marker_id: f.marker_id || null,
        // A linked place decides the location and region.
        ...(linked
            ? {}
            : {
                  region_id: f.region_id || null,
                  location: { address: text(f.address), map_url: text(f.map_url), lat: f.lat, lng: f.lng },
              }),
        media: f.media,
        experience_media: f.experience_media,
        gallery: f.gallery,
        curator: {
            name: text(f.curator.name),
            title: text(f.curator.title),
            years: years === null ? null : Math.round(years),
            photo_url: text(f.curator.photo_url),
            note: text(f.curator.note),
        },
        highlights: f.highlights.filter((x) => filled(x.title, x.description)).map((x) => ({ title: x.title.trim(), description: text(x.description) })),
        included: f.included.filter((x) => filled(x.title, x.description)).map((x) => ({ title: x.title.trim(), description: text(x.description) })),
        cancellation_policy: f.cancellation_policy
            .filter((x) => filled(x.title, x.description))
            .map((x) => ({ title: x.title.trim(), description: text(x.description) })),
        itinerary: f.itinerary
            .filter((x) => filled(x.time_label, x.title, x.description, x.image_url))
            .map((x) => ({ time_label: text(x.time_label), title: x.title.trim(), description: text(x.description), image_url: text(x.image_url) })),
        faqs: f.faqs.filter((x) => filled(x.question, x.answer)).map((x) => ({ question: x.question.trim(), answer: text(x.answer) })),
        options: f.options
            .filter((o) => filled(o.name, o.description, o.duration_minutes, o.price))
            .map((o) => {
                const minutes = num(o.duration_minutes);
                return {
                    ...(o.id ? { id: o.id } : {}),
                    name: o.name.trim(),
                    description: text(o.description),
                    duration_minutes: minutes === null ? null : Math.round(minutes),
                    price: num(o.price),
                };
            }),
    };
}

/** Only the sections that changed. */
export function changedPayload(form: ContentForm, base: ContentForm): ExperiencePatch {
    const next = payloadOf(form);
    const prev = payloadOf(base);
    const out: Record<string, unknown> = {};
    (Object.keys(next) as (keyof typeof next)[]).forEach((k) => {
        if (JSON.stringify(next[k]) !== JSON.stringify(prev[k])) out[k] = next[k];
    });
    // Switching from a place to a free location needs both pieces.
    if (!form.marker_id && ("marker_id" in out || "location" in out || "region_id" in out)) {
        out.location = next.location;
        out.region_id = next.region_id;
    }
    return out as ExperiencePatch;
}

/** Problems that would make the server refuse the save. */
export function formErrors(f: ContentForm): string[] {
    const errs: string[] = [];
    if (!f.title.trim()) errs.push("Add a title.");
    if (f.highlights.some((x) => !x.title.trim() && x.description.trim())) errs.push("Every highlight needs a title.");
    if (f.included.some((x) => !x.title.trim() && x.description.trim())) errs.push("Every 'what's included' item needs a title.");
    if (f.cancellation_policy.some((x) => !x.title.trim() && x.description.trim())) errs.push("Every cancellation rule needs a title.");
    if (f.itinerary.some((x) => !x.title.trim() && filled(x.time_label, x.description, x.image_url))) errs.push("Every itinerary step needs a title.");
    if (f.faqs.some((x) => !x.question.trim() && x.answer.trim())) errs.push("Every FAQ needs a question.");
    const opts = f.options.filter((o) => filled(o.name, o.description, o.duration_minutes, o.price));
    if (opts.some((o) => !o.name.trim())) errs.push("Every option needs a name.");
    const names = opts.map((o) => o.name.trim().toLowerCase()).filter(Boolean);
    if (new Set(names).size !== names.length) errs.push("Two options have the same name.");
    if (opts.some((o) => o.price.trim() && (num(o.price) === null || (num(o.price) ?? 0) < 0))) errs.push("Option prices must be 0 or more.");
    if (opts.some((o) => o.duration_minutes.trim() && ((num(o.duration_minutes) ?? 0) < 1 || (num(o.duration_minutes) ?? 0) > 1440)))
        errs.push("Option durations are 1 to 1440 minutes.");
    if (f.curator.years.trim() && ((num(f.curator.years) ?? -1) < 0 || (num(f.curator.years) ?? 101) > 100)) errs.push("Curator years must be 0 to 100.");
    if (f.map_url.trim() && !/^https:\/\/\S+$/.test(f.map_url.trim())) errs.push("The map link must start with https://");
    return errs;
}
