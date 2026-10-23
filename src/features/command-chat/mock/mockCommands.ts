/**
 * Local stand-in for /api/v2/commands/* — follows the shared contract so the
 * chat can be built and demoed before the backend lands. Loaded lazily by
 * commands.service.ts only when the mock is switched on.
 *
 * Try: "add images to ema", "turn off experiences for ara", "make riya a creator",
 * "show bookings for sunrise", "what needs me", "delete emaho", "simulate expired",
 * "simulate network error".
 */
import { CommandsApiError } from "@/services/commands.service";
import type {
    CatalogCommand,
    ChooseOption,
    CommandAttachment,
    CommandHistoryItem,
    CommandSuggestion,
    DoneResult,
    UnderstandRequest,
    UnderstandResult,
} from "@/services/commands.types";

// ── Fake records ───────────────────────────────────────────

function thumb(initials: string, color: string): string {
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="20" fill="${color}"/>` +
        `<text x="48" y="58" font-family="Arial,sans-serif" font-size="32" font-weight="700" fill="#fff" text-anchor="middle">${initials}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

interface Rec extends ChooseOption {
    url: string;
}

const PLACES: Rec[] = [
    { id: "pl_emaho_bir", label: "Emaho Cafe", sublabel: "Cafe · Bir", image_url: thumb("EC", "#00A49E"), url: "/markers/pl_emaho_bir" },
    { id: "pl_emaho_dsl", label: "Emaho Bakery", sublabel: "Bakery · Dharamshala", image_url: thumb("EB", "#0F766E"), url: "/markers/pl_emaho_dsl" },
    { id: "pl_ara_manali", label: "Ara Cafe", sublabel: "Cafe · Manali", image_url: thumb("AC", "#003634"), url: "/markers/pl_ara_manali" },
    { id: "pl_tibet_kitchen", label: "Tibet Kitchen", sublabel: "Restaurant · McLeod Ganj", image_url: thumb("TK", "#B45309"), url: "/markers/pl_tibet_kitchen" },
];

const BUSINESSES: Rec[] = [
    { id: "bz_ara", label: "Ara cafe", sublabel: "Manali · owner Kunal", image_url: thumb("AR", "#003634"), url: "/collabs/businesses/bz_ara" },
    { id: "bz_emaho", label: "Emaho Hospitality", sublabel: "Bir · owner Tashi", image_url: thumb("EH", "#00A49E"), url: "/collabs/businesses/bz_emaho" },
];

const USERS: Rec[] = [
    { id: "us_riya", label: "Riya Sharma", sublabel: "riya@example.com", image_url: thumb("RS", "#7C3AED"), url: "/users?focus=us_riya" },
    { id: "us_rohan", label: "Rohan Mehta", sublabel: "rohan@example.com", image_url: thumb("RM", "#2563EB"), url: "/users?focus=us_rohan" },
    { id: "us_tashi", label: "Tashi Dorje", sublabel: "tashi@example.com", image_url: thumb("TD", "#DB2777"), url: "/users?focus=us_tashi" },
];

const EXPERIENCES: Rec[] = [
    { id: "ex_sunrise", label: "Sunrise paragliding", sublabel: "Emaho Hospitality · Bir", image_url: thumb("SP", "#F59E0B"), url: "/collabs/experiences?focus=ex_sunrise" },
    { id: "ex_momo", label: "Momo making class", sublabel: "Ara cafe · Manali", image_url: thumb("MM", "#EA580C"), url: "/collabs/experiences?focus=ex_momo" },
];

const QUESTS: Rec[] = [
    { id: "qu_bir_trail", label: "Bir monastery trail", sublabel: "Quest · 6 stops", image_url: thumb("BT", "#059669"), url: "/quests/qu_bir_trail" },
];

type SlotKind = "place" | "business" | "user" | "experience" | "quest";
const POOLS: Record<SlotKind, Rec[]> = { place: PLACES, business: BUSINESSES, user: USERS, experience: EXPERIENCES, quest: QUESTS };
const SLOT_WORD: Record<SlotKind, string> = { place: "place", business: "business", user: "person", experience: "experience", quest: "quest" };

// ── Helpers ────────────────────────────────────────────────

const delay = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const latency = () => delay(250 + Math.random() * 350);
const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

function find(kind: SlotKind, raw: string): Rec[] {
    const q = norm(raw);
    const pool = POOLS[kind];
    const exact = pool.filter((r) => r.id === raw.trim() || norm(r.label) === q || norm(r.sublabel ?? "") === q);
    if (exact.length) return exact;
    const prefix = pool.filter((r) => norm(r.label).startsWith(q));
    if (prefix.length) return prefix;
    return pool.filter((r) => norm(r.label).includes(q) || norm(r.sublabel ?? "").includes(q));
}

type Resolved = { rec: Rec } | { result: UnderstandResult };

/** Resolve a slot from picks or text: one match → record; several → choose; none → need/unknown. */
function resolve(kind: SlotKind, raw: string | undefined, req: UnderstandRequest, slot: string = kind): Resolved {
    const picked = req.picks?.[slot];
    if (picked) {
        const rec = POOLS[kind].find((r) => r.id === picked);
        if (rec) return { rec };
    }
    if (!raw || !raw.trim()) {
        return {
            result: { kind: "need", slot, prompt: `Which ${SLOT_WORD[kind]}?`, input: "text", placeholder: `Type a ${SLOT_WORD[kind]} name` },
        };
    }
    const matches = find(kind, raw);
    if (matches.length === 1 && matches[0]) return { rec: matches[0] };
    if (matches.length > 1) {
        return {
            result: {
                kind: "choose",
                slot,
                prompt: `Which ${SLOT_WORD[kind]} did you mean?`,
                options: matches.map(({ id, label, sublabel, image_url }) => ({ id, label, sublabel, image_url })),
            },
        };
    }
    return {
        result: {
            kind: "unknown",
            message: `I couldn't find a ${SLOT_WORD[kind]} called “${raw.trim()}”.`,
            examples: POOLS[kind].slice(0, 2).map((r) => exampleFor(kind, r.label)),
        },
    };
}

function exampleFor(kind: SlotKind, name: string): string {
    switch (kind) {
        case "place":
            return `add images to ${name}`;
        case "business":
            return `turn on experiences for ${name}`;
        case "user":
            return `make ${name} a creator`;
        case "experience":
            return `show bookings for ${name} today`;
        case "quest":
            return `publish quest ${name}`;
    }
}

interface TokenBody {
    command: string;
    done: string;
    url: string | null;
    exp: number;
}

function sign(body: Omit<TokenBody, "exp">, ttlMs = 10 * 60_000): string {
    return `mock.${encodeURIComponent(JSON.stringify({ ...body, exp: Date.now() + ttlMs }))}`;
}

function preview(
    command: string,
    title: string,
    summary: string,
    changes: { label: string; before: string | null; after: string | null }[],
    confirm_label: string,
    done: { message: string; url: string | null },
    danger = false,
    ttlMs?: number
): UnderstandResult {
    return {
        kind: "preview",
        command,
        title,
        summary,
        changes,
        confirm_label,
        danger,
        token: sign({ command, done: done.message, url: done.url }, ttlMs),
    };
}

const EXAMPLES = [
    "add images to Emaho Cafe",
    "turn on experiences for Ara cafe",
    "make Riya Sharma a creator",
    "what needs me",
];

// ── Endpoints ──────────────────────────────────────────────

export async function mockUnderstand(req: UnderstandRequest): Promise<UnderstandResult> {
    await latency();
    const text = norm(req.text);
    let m: RegExpMatchArray | null;

    if (text.includes("simulate network error")) throw new CommandsApiError("network", "Couldn't reach the server. Check your connection and try again.");
    if (text.includes("simulate server error")) throw new CommandsApiError("server", "Something went wrong on the server. Try again in a moment.", 500);
    if (text.includes("simulate expired")) {
        return preview("demo.expired", "Demo: an expired preview", "Confirming this shows what happens when a preview has expired.", [], "Confirm", { message: "", url: null }, false, -1);
    }

    if (/^(delete|remove) /.test(text)) {
        return { kind: "denied", message: "Deleting isn't something the chat can do. Open the record and delete it there." };
    }

    if (text === "what needs me" || text === "what needs me?" || text === "today") {
        return {
            kind: "answer",
            title: "Waiting for you",
            text: "Here's what's pending right now.",
            items: [
                { label: "3 place requests", sublabel: "Oldest from 2 days ago", url_path: "/markers?tab=requests", image_url: null },
                { label: "2 business applications", sublabel: "Ara cafe, Hill Brews", url_path: "/collabs/business-applications", image_url: null },
                { label: "1 report", sublabel: "Collab report · needs a decision", url_path: "/collabs/reports", image_url: null },
            ],
        };
    }

    if ((m = text.match(/^(?:add|upload) (?:images|photos|pictures) to quest ?(.*)$/))) {
        const r = resolve("quest", m[1], req);
        if ("result" in r) return r.result;
        if (!req.attachments?.length) {
            return { kind: "need", slot: "images", prompt: `Which photos should go on ${r.rec.label}?`, input: "images", placeholder: null };
        }
        const n = req.attachments.length;
        return preview("quest.add_images", `Add ${n} photo${n === 1 ? "" : "s"} to ${r.rec.label}`, "They'll appear after the quest's current photos.",
            [{ label: "Photos", before: "4", after: String(4 + n) }], "Add photos", { message: `Added ${n} photo${n === 1 ? "" : "s"} to ${r.rec.label}.`, url: r.rec.url });
    }

    if ((m = text.match(/^(?:add|upload) (?:images|photos|pictures) to ?(.*)$/))) {
        const r = resolve("place", m[1], req);
        if ("result" in r) return r.result;
        if (!req.attachments?.length) {
            return { kind: "need", slot: "images", prompt: `Which photos should go on ${r.rec.label}?`, input: "images", placeholder: null };
        }
        const n = req.attachments.length;
        return preview("place.add_images", `Add ${n} photo${n === 1 ? "" : "s"} to ${r.rec.label}`, `${r.rec.sublabel ?? ""} — they'll appear after its current photos.`,
            [{ label: "Photos", before: "6", after: String(6 + n) }], "Add photos", { message: `Added ${n} photo${n === 1 ? "" : "s"} to ${r.rec.label}.`, url: r.rec.url });
    }

    if ((m = text.match(/^set category of (.+?)(?: to (.*))?$/))) {
        const r = resolve("place", m[1], req);
        if ("result" in r) return r.result;
        const category = m[2]?.trim();
        if (!category) return { kind: "need", slot: "category", prompt: `What category should ${r.rec.label} be?`, input: "text", placeholder: "e.g. cafe, viewpoint, hostel" };
        const before = (r.rec.sublabel ?? "").split(" · ")[0] ?? null;
        return preview("place.set_category", `Change the category of ${r.rec.label}`, r.rec.sublabel ?? "",
            [{ label: "Category", before, after: category.replace(/^\w/, (c) => c.toUpperCase()) }], "Change category",
            { message: `${r.rec.label} is now in ${category}.`, url: r.rec.url });
    }

    if ((m = text.match(/^turn (on|off) (experiences|collabs) for ?(.*)$/))) {
        const on = m[1] === "on";
        const feature = m[2] === "experiences" ? "Experiences" : "Collabs";
        const r = resolve("business", m[3], req);
        if ("result" in r) return r.result;
        return preview(`business.${m[2]}`, `Turn ${on ? "on" : "off"} ${feature} for ${r.rec.label}`,
            on ? `${r.rec.label} will be able to use ${feature} in the Partner Portal.` : `${r.rec.label} won't see ${feature} any more. Nothing they made is deleted.`,
            [{ label: feature, before: on ? "Off" : "On", after: on ? "On" : "Off" }], on ? `Turn on ${feature}` : `Turn off ${feature}`,
            { message: `${feature} ${on ? "on" : "off"} for ${r.rec.label}.`, url: r.rec.url }, !on);
    }

    if ((m = text.match(/^make (.+?) (?:a )?creator$/)) || (m = text.match(/^make ?(.*)$/))) {
        const r = resolve("user", m[1], req);
        if ("result" in r) return r.result;
        return preview("user.make_creator", `Make ${r.rec.label} a creator`, `${r.rec.sublabel ?? ""} — they'll get creator tools in the app.`,
            [{ label: "Role", before: "Traveler", after: "Creator" }], "Make creator", { message: `${r.rec.label} is now a creator.`, url: r.rec.url });
    }

    if ((m = text.match(/^(suspend|reactivate) ?(.*)$/))) {
        const suspend = m[1] === "suspend";
        const r = resolve("user", m[2], req);
        if ("result" in r) return r.result;
        return preview(`user.${m[1]}`, `${suspend ? "Suspend" : "Reactivate"} ${r.rec.label}`,
            suspend ? "They'll be signed out and can't sign in until reactivated." : "They'll be able to sign in again.",
            [{ label: "Account", before: suspend ? "Active" : "Suspended", after: suspend ? "Suspended" : "Active" }], suspend ? "Suspend" : "Reactivate",
            { message: `${r.rec.label} is ${suspend ? "suspended" : "active again"}.`, url: r.rec.url }, suspend);
    }

    if ((m = text.match(/^show bookings for (.+?)(?: (today|tomorrow|\d{4}-\d{2}-\d{2}))?$/))) {
        const r = resolve("experience", m[1], req);
        if ("result" in r) return r.result;
        const when = m[2];
        if (!when) return { kind: "need", slot: "date", prompt: `Bookings for which day?`, input: "date", placeholder: null };
        return {
            kind: "answer",
            title: `${r.rec.label} · ${when}`,
            text: "2 bookings, 5 guests.",
            items: [
                { label: "Riya Sharma · 2 guests", sublabel: "7:00 AM · paid", url_path: "/users?focus=us_riya", image_url: USERS[0]?.image_url ?? null },
                { label: "Rohan Mehta · 3 guests", sublabel: "7:00 AM · pay at venue", url_path: "/users?focus=us_rohan", image_url: USERS[1]?.image_url ?? null },
            ],
        };
    }

    if ((m = text.match(/^(hide|show) (?:place )?(.+)$/)) && !/^(bookings|reports)/.test(m[2] ?? "")) {
        const hide = m[1] === "hide";
        if (!hide) {
            const user = find("user", m[2] ?? "");
            if (user.length === 1 && user[0]) {
                const u = user[0];
                return { kind: "answer", title: u.label, text: u.sublabel, items: [{ label: "Open their profile", sublabel: "Traveler · joined March", url_path: u.url, image_url: u.image_url }] };
            }
        }
        const r = resolve("place", m[2], req);
        if ("result" in r) return r.result;
        return preview(`place.${m[1]}`, `${hide ? "Hide" : "Show"} ${r.rec.label}`,
            hide ? "It disappears from the app and from quests until shown again." : "It shows in the app again.",
            [{ label: "Visible in the app", before: hide ? "Yes" : "No", after: hide ? "No" : "Yes" }], hide ? "Hide place" : "Show place",
            { message: `${r.rec.label} is ${hide ? "hidden" : "visible again"}.`, url: r.rec.url }, hide);
    }

    if (text === "show reports") {
        return { kind: "answer", title: "Open reports", text: null, items: [{ label: "Collab report #1042", sublabel: "Spam · 2 hours ago", url_path: "/collabs/reports", image_url: null }] };
    }

    return { kind: "unknown", message: "I don't know that one yet. Try one of these:", examples: EXAMPLES };
}

export async function mockRun(token: string): Promise<DoneResult> {
    await latency();
    let body: TokenBody | null = null;
    try {
        body = JSON.parse(decodeURIComponent(token.replace(/^mock\./, ""))) as TokenBody;
    } catch {
        body = null;
    }
    if (!body || body.exp < Date.now()) {
        throw new CommandsApiError("expired", "This preview expired. Send the command again.", 400);
    }
    return { kind: "done", message: body.done, url_path: body.url };
}

const TEMPLATES: { prefix: string; slot: SlotKind | null; suffix?: string; hint: string }[] = [
    { prefix: "add images to ", slot: "place", hint: "Places" },
    { prefix: "add images to quest ", slot: "quest", hint: "Quests" },
    { prefix: "set category of ", slot: "place", suffix: " to ", hint: "Places" },
    { prefix: "hide ", slot: "place", hint: "Places" },
    { prefix: "turn on experiences for ", slot: "business", hint: "Businesses" },
    { prefix: "turn off experiences for ", slot: "business", hint: "Businesses" },
    { prefix: "turn on collabs for ", slot: "business", hint: "Businesses" },
    { prefix: "turn off collabs for ", slot: "business", hint: "Businesses" },
    { prefix: "make ", slot: "user", suffix: " a creator", hint: "People" },
    { prefix: "suspend ", slot: "user", hint: "People" },
    { prefix: "reactivate ", slot: "user", hint: "People" },
    { prefix: "show bookings for ", slot: "experience", suffix: " today", hint: "Experiences" },
    { prefix: "what needs me", slot: null, hint: "Today" },
    { prefix: "show reports", slot: null, hint: "Today" },
];

export async function mockSuggest(q: string): Promise<CommandSuggestion[]> {
    await delay(80);
    const query = q.toLowerCase().replace(/\s+/g, " ").trimStart();
    if (!query.trim()) return [];
    const out: CommandSuggestion[] = [];
    for (const t of TEMPLATES) {
        if (t.slot && query.startsWith(t.prefix)) {
            const partial = norm(query.slice(t.prefix.length));
            for (const rec of POOLS[t.slot]) {
                const name = norm(rec.label);
                if (partial && !name.startsWith(partial) && !name.includes(partial)) continue;
                out.push({ text: `${t.prefix}${rec.label}${t.suffix ?? ""}`, label: `${t.prefix}${rec.label}`, hint: rec.sublabel });
            }
        } else if (t.prefix.startsWith(query) && t.prefix.trim() !== query.trim()) {
            out.push({
                text: t.prefix,
                label: t.slot ? `${t.prefix.trim()} … ${t.suffix?.trim() ?? ""}`.trim() : t.prefix,
                hint: t.hint,
            });
        }
    }
    return out.slice(0, 8);
}

export async function mockHistory(): Promise<CommandHistoryItem[]> {
    await latency();
    const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    return [
        { at: ago(190), text: "turn on experiences for Ara cafe", command: "business.experiences", message: "Experiences on for Ara cafe.", status: "done" },
        { at: ago(125), text: "add images to Emaho Cafe", command: "place.add_images", message: "Added 3 photos to Emaho Cafe.", status: "done" },
        { at: ago(40), text: "make Tashi a creator", command: "user.make_creator", message: "This preview expired. Send the command again.", status: "failed" },
    ];
}

export async function mockCatalog(): Promise<CatalogCommand[]> {
    await latency();
    return [
        { id: "today.needs_me", label: "See what's waiting for you", examples: ["what needs me"], area: "Today" },
        { id: "today.reports", label: "Show open reports", examples: ["show reports"], area: "Today" },
        { id: "place.add_images", label: "Add photos to a place", examples: ["add images to Emaho Cafe"], area: "Places" },
        { id: "place.set_category", label: "Change a place's category", examples: ["set category of Ara Cafe to cafe"], area: "Places" },
        { id: "place.hide", label: "Hide or show a place", examples: ["hide Tibet Kitchen", "show Tibet Kitchen"], area: "Places" },
        { id: "user.make_creator", label: "Make someone a creator", examples: ["make Riya Sharma a creator"], area: "People" },
        { id: "user.suspend", label: "Suspend or reactivate someone", examples: ["suspend Rohan Mehta", "reactivate Rohan Mehta"], area: "People" },
        { id: "business.experiences", label: "Turn Experiences on or off", examples: ["turn on experiences for Ara cafe"], area: "Businesses" },
        { id: "business.collabs", label: "Turn Collabs on or off", examples: ["turn off collabs for Emaho Hospitality"], area: "Businesses" },
        { id: "experience.bookings", label: "See bookings for a day", examples: ["show bookings for Sunrise paragliding today"], area: "Experiences" },
        { id: "quest.add_images", label: "Add photos to a quest", examples: ["add images to quest Bir monastery trail"], area: "Quests" },
    ];
}

/** Pretend upload: a local preview URL after a short wait. */
export async function mockUpload(file: File): Promise<CommandAttachment> {
    await delay(500 + Math.random() * 700);
    if (!file.type.startsWith("image/")) throw new Error("Only image files can be uploaded.");
    return { url: URL.createObjectURL(file), kind: "image" };
}
