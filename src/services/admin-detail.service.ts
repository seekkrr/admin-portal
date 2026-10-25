/**
 * API calls for the admin "edit everything" detail pages (users, businesses,
 * experiences, places, quests, events). Full paths on purpose: this file is
 * kept apart from src/config/api.ts so parallel work doesn't collide.
 *
 * Errors: every call goes through `call()`, which keeps the HTTP status and
 * the backend error code (the shared client turns errors into a bare message).
 * A route the server doesn't have yet (404 "Not Found" or 405) becomes a
 * `NotAvailableError`, which the pages show as "This isn't available on the
 * server yet" for that section only.
 */
import type { AxiosRequestConfig } from "axios";
import { api } from "@/services/api";
import type {
    AnnouncePayload,
    AnnounceResult,
    AuditPage,
    BulkSlotsPayload,
    BulkSlotsResult,
    BusinessOffer,
    EventPayload,
    ExperienceBooking,
    ExperienceBookingsPage,
    ExperienceDetail,
    ExperiencePatch,
    ExperiencePricingPatch,
    ExperienceSlot,
    ExperienceStatus,
    MarkerCollabsInfo,
    MovedMarker,
    OfferPatch,
    PlaceReviewsPage,
    PublicExperienceCard,
    QuestBookingsPage,
    QuestReviewsPage,
    QuestStopPayload,
    RawAdminUser,
    RedeemCodeStatus,
    ScheduledAnnouncement,
    SlotPatch,
    UserOverview,
    UserPatch,
} from "@/types/admin-detail";

// ── Errors ──────────────────────────────────────────────────

/** The server doesn't have this route yet (being built in parallel). */
export class NotAvailableError extends Error {
    readonly notAvailable = true;
    constructor(message = "This isn't available on the server yet.") {
        super(message);
        this.name = "NotAvailableError";
    }
}

/** An API error with its status and the backend's error code. */
export class DetailApiError extends Error {
    readonly status: number;
    readonly code: string | null;
    readonly details: unknown;
    constructor(message: string, status: number, code: string | null, details: unknown) {
        super(message);
        this.name = "DetailApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export function isNotAvailable(error: unknown): error is NotAvailableError {
    return error instanceof NotAvailableError;
}

/** Statuses handled here; 401 (token refresh) and 5xx stay with the shared client. */
const HANDLED = new Set([400, 403, 404, 405, 409, 410, 422, 429]);

type ErrorBody = { message?: unknown; detail?: unknown; error?: unknown; details?: unknown; success?: unknown } | undefined;

function readableDetail(detail: unknown): string | null {
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
        // FastAPI validation errors: [{loc: [...], msg}]
        const parts = detail
            .map((d) => {
                if (!d || typeof d !== "object") return null;
                const item = d as { loc?: unknown[]; msg?: unknown };
                const field = Array.isArray(item.loc) ? item.loc.filter((x) => x !== "body").join(".") : "";
                const msg = typeof item.msg === "string" ? item.msg : "";
                return field ? `${field}: ${msg}` : msg;
            })
            .filter(Boolean);
        return parts.length ? parts.join("; ") : null;
    }
    return null;
}

export async function call<T>(config: AxiosRequestConfig): Promise<T> {
    const res = await api.request<T>({
        ...config,
        validateStatus: (s) => (s >= 200 && s < 300) || HANDLED.has(s),
    });
    if (res.status >= 200 && res.status < 300) return res.data;

    const body = res.data as unknown as ErrorBody;
    const message =
        (typeof body?.message === "string" && body.message) ||
        readableDetail(body?.detail) ||
        (typeof body?.error === "string" && body.error) ||
        "";
    // A missing route answers with Starlette's {"detail": "Not Found"}; a missing
    // record answers with the app's {success: false, message: "… not found"}.
    if (res.status === 405 || (res.status === 404 && (!message || message === "Not Found"))) {
        throw new NotAvailableError();
    }
    const code = typeof body?.error === "string" ? body.error : null;
    throw new DetailApiError(message || `Request failed (${res.status})`, res.status, code, body?.details ?? null);
}

export function qs(params: Record<string, unknown>): string {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || v === "") return;
        sp.append(k, String(v));
    });
    const s = sp.toString();
    return s ? `?${s}` : "";
}

const enc = encodeURIComponent;

// ── Change history ──────────────────────────────────────────

export const auditApi = {
    list: (params: { entity_type: string; entity_id: string; page?: number; page_size?: number }) =>
        call<AuditPage & { success?: boolean }>({ method: "get", url: `/api/v2/admin/audit${qs(params)}` }).then((d) => ({
            items: d.items ?? [],
            total: d.total ?? 0,
        })),
};

// ── Users ───────────────────────────────────────────────────

/** Fields the older PUT /api/v2/users/{id} can't change (only the new PATCH can). */
const PATCH_ONLY_FIELDS = ["username", "phone", "email"] as const;

/** "Act as creator": a one-time code the Partner Portal swaps for the creator's 30-minute session. */
export const impersonationApi = {
    start: (userId: string, reason?: string) =>
        call<{ code: string; session_id: string; expires_at: string; user: { id: string; name: string } }>({
            method: "post",
            url: "/api/v2/admin/impersonation",
            data: { user_id: userId, reason: reason?.trim() || undefined },
        }),
};

export const userDetailApi = {
    overview: (userId: string) =>
        call<UserOverview & { success?: boolean }>({ method: "get", url: `/api/v2/admin/users/${enc(userId)}/overview` }),

    /** Existing admin read (works today); used while the overview isn't live. */
    raw: (userId: string) =>
        call<{ user: RawAdminUser }>({ method: "get", url: `/api/v2/users/${enc(userId)}` }).then((d) => d.user),

    /**
     * Admin edit. Uses PATCH /api/v2/admin/users/{id}; while that isn't live it
     * falls back to PUT /api/v2/users/{id} for the fields that route accepts and
     * reports what it couldn't save.
     */
    patch: async (userId: string, body: UserPatch): Promise<{ skipped: string[] }> => {
        try {
            await call({ method: "patch", url: `/api/v2/admin/users/${enc(userId)}`, data: body });
            return { skipped: [] };
        } catch (e) {
            if (!isNotAvailable(e)) throw e;
        }
        const legacy: Record<string, unknown> = {};
        if (body.first_name !== undefined) legacy.first_name = body.first_name;
        if (body.last_name !== undefined) legacy.last_name = body.last_name;
        if (body.bio !== undefined) legacy.user_bio = body.bio;
        if (body.hobbies !== undefined) legacy.hobbies = body.hobbies;
        if (body.status !== undefined) legacy.status = body.status;
        const skipped = PATCH_ONLY_FIELDS.filter((f) => body[f] !== undefined);
        if (Object.keys(legacy).length === 0) {
            throw new NotAvailableError("Changing the username, phone or email isn't available on the server yet.");
        }
        await call({ method: "put", url: `/api/v2/users/${enc(userId)}`, data: legacy });
        return { skipped: [...skipped] };
    },

    /** Name + email for a user id (team lists, owners). */
    summary: (userId: string) =>
        call<{ user: RawAdminUser }>({ method: "get", url: `/api/v2/users/${enc(userId)}` }).then((d) => d.user),
};

// ── Businesses ──────────────────────────────────────────────

export const businessDetailApi = {
    addMember: (businessId: string, email: string, role: "manager" | "staff") =>
        call({ method: "post", url: `/api/v2/businesses/${enc(businessId)}/members`, data: { email, role } }),

    changeMemberRole: (businessId: string, userId: string, role: "manager" | "staff") =>
        call({ method: "patch", url: `/api/v2/businesses/${enc(businessId)}/members/${enc(userId)}`, data: { role } }),

    setMemberChat: (businessId: string, userId: string, canChat: boolean) =>
        call({ method: "patch", url: `/api/v2/businesses/${enc(businessId)}/members/${enc(userId)}`, data: { can_chat: canChat } }),

    removeMember: (businessId: string, userId: string) =>
        call({ method: "delete", url: `/api/v2/businesses/${enc(businessId)}/members/${enc(userId)}` }),

    linkPlace: (businessId: string, markerId: string) =>
        call({ method: "post", url: `/api/v2/businesses/${enc(businessId)}/places`, data: { marker_id: markerId } }),

    unlinkPlace: (businessId: string, markerId: string) =>
        call({ method: "delete", url: `/api/v2/businesses/${enc(businessId)}/places/${enc(markerId)}` }),

    redeemCode: (businessId: string, markerId: string) =>
        call<RedeemCodeStatus>({ method: "get", url: `/api/v2/businesses/${enc(businessId)}/markers/${enc(markerId)}/redeem-code` }),

    setRedeemCode: (businessId: string, markerId: string, code: string) =>
        call<RedeemCodeStatus>({
            method: "put",
            url: `/api/v2/businesses/${enc(businessId)}/markers/${enc(markerId)}/redeem-code`,
            data: { code },
        }),

    setCollabStatus: (businessId: string, collabId: string, status: "active" | "paused" | "archived") =>
        call({ method: "post", url: `/api/v2/businesses/${enc(businessId)}/collabs/${enc(collabId)}/status`, data: { status } }),

    offersForPlace: (markerId: string) =>
        call<{ offers: BusinessOffer[] }>({ method: "get", url: `/api/v2/offers/business/${enc(markerId)}` }).then((d) => d.offers ?? []),

    /** Admin offer edit; falls back to the business route (admins pass) while the admin one isn't live. */
    patchOffer: async (offerId: string, patch: OfferPatch): Promise<void> => {
        try {
            await call({ method: "patch", url: `/api/v2/offers/admin/${enc(offerId)}`, data: patch });
        } catch (e) {
            if (!isNotAvailable(e)) throw e;
            await call({ method: "put", url: `/api/v2/offers/business/offer/${enc(offerId)}`, data: patch });
        }
    },
};

// ── Experiences (business-scoped; admins pass the role check) ─

const bx = (businessId: string) => `/api/v2/businesses/${enc(businessId)}`;

export const experienceDetailApi = {
    /** Any status, any business (staff). */
    get: (experienceId: string) =>
        call<{ experience: ExperienceDetail }>({ method: "get", url: `/api/v2/admin/experiences/${enc(experienceId)}` }).then(
            (d) => d.experience
        ),

    update: (businessId: string, experienceId: string, patch: ExperiencePatch) =>
        call<{ experience: ExperienceDetail }>({
            method: "patch",
            url: `${bx(businessId)}/experiences/${enc(experienceId)}`,
            data: patch,
        }).then((d) => d.experience),

    setStatus: (businessId: string, experienceId: string, status: ExperienceStatus) =>
        call<{ experience: ExperienceDetail }>({
            method: "post",
            url: `${bx(businessId)}/experiences/${enc(experienceId)}/status`,
            data: { status },
        }).then((d) => d.experience),

    /** Prices and GST (admin only; businesses can't change them). Audit-logged. */
    setPricing: (experienceId: string, patch: ExperiencePricingPatch) =>
        call<{ experience: ExperienceDetail }>({
            method: "patch",
            url: `/api/v2/admin/experiences/${enc(experienceId)}/pricing`,
            data: patch,
        }).then((d) => d.experience),

    setHidden: (experienceId: string, hidden: boolean, reason?: string) =>
        call<{ experience: ExperienceDetail }>({
            method: "patch",
            url: `/api/v2/admin/experiences/${enc(experienceId)}`,
            data: { hidden_by_admin: hidden, reason: reason || null },
        }).then((d) => d.experience),

    slots: (businessId: string, experienceId: string, params: { from?: string; to?: string; include_cancelled?: boolean }) =>
        call<{ slots: ExperienceSlot[] }>({
            method: "get",
            url: `${bx(businessId)}/experiences/${enc(experienceId)}/slots${qs(params)}`,
        }).then((d) => d.slots ?? []),

    addSlots: (businessId: string, experienceId: string, payload: BulkSlotsPayload) =>
        call<BulkSlotsResult>({ method: "post", url: `${bx(businessId)}/experiences/${enc(experienceId)}/slots`, data: payload }),

    updateSlot: (businessId: string, slotId: string, patch: SlotPatch) =>
        call<{ slot: ExperienceSlot }>({ method: "patch", url: `${bx(businessId)}/experience-slots/${enc(slotId)}`, data: patch }).then(
            (d) => d.slot
        ),

    cancelSlot: (businessId: string, slotId: string, reason?: string) =>
        call<{ slot: ExperienceSlot; cancelled_bookings: number }>({
            method: "delete",
            url: `${bx(businessId)}/experience-slots/${enc(slotId)}${qs({ reason })}`,
        }),

    bookings: (
        businessId: string,
        params: { experience_id: string; date?: string; status?: string; page?: number; page_size?: number }
    ) =>
        call<ExperienceBookingsPage>({ method: "get", url: `${bx(businessId)}/experience-bookings${qs(params)}` }).then((d) => ({
            ...d,
            bookings: d.bookings ?? [],
        })),

    checkIn: (businessId: string, bookingId: string) =>
        call<{ booking: ExperienceBooking }>({
            method: "post",
            url: `${bx(businessId)}/experience-bookings/${enc(bookingId)}/check-in`,
        }).then((d) => d.booking),

    cancelBooking: (businessId: string, bookingId: string, reason?: string) =>
        call<{ booking: ExperienceBooking }>({
            method: "post",
            url: `${bx(businessId)}/experience-bookings/${enc(bookingId)}/cancel`,
            data: { reason: reason || null },
        }).then((d) => d.booking),
};

// ── Places (markers) ────────────────────────────────────────

export const placeDetailApi = {
    /** Move the pin (admin). The server re-derives the region. */
    move: async (markerId: string, lat: number, lng: number, address?: string) => {
        const { marker } = await call<{ marker: MovedMarker }>({
            method: "put",
            url: `/api/v2/markers/${enc(markerId)}`,
            data: { location: { lat, lng }, ...(address !== undefined ? { address } : {}) },
        });
        // An older server ignores `location` and answers 200 with the pin unchanged.
        const [savedLng, savedLat] = marker.location?.coordinates ?? [];
        if (savedLng === undefined || savedLat === undefined || Math.abs(savedLng - lng) > 1e-5 || Math.abs(savedLat - lat) > 1e-5) {
            throw new NotAvailableError("Moving a place's pin isn't available on the server yet.");
        }
        return marker;
    },

    /** Any PUT /markers/{id} fields, including staff-only owner_id / subscription_flag / opens_at and admin-only created_by. */
    update: (markerId: string, payload: Record<string, unknown>) =>
        call<{ marker: MovedMarker & Record<string, unknown> }>({ method: "put", url: `/api/v2/markers/${enc(markerId)}`, data: payload }).then(
            (d) => d.marker
        ),

    collabs: (markerId: string) => call<MarkerCollabsInfo>({ method: "get", url: `/api/v2/markers/${enc(markerId)}/collabs` }),

    experiences: (markerId: string) =>
        call<{ experiences: PublicExperienceCard[] }>({ method: "get", url: `/api/v2/markers/${enc(markerId)}/experiences` }).then(
            (d) => d.experiences ?? []
        ),

    reviews: (markerId: string, limit = 10) =>
        call<PlaceReviewsPage>({ method: "get", url: `/api/v2/markers/${enc(markerId)}/reviews${qs({ limit })}` }).then((d) => ({
            reviews: d.reviews ?? [],
            total: d.total ?? 0,
        })),
};

// ── Quests ──────────────────────────────────────────────────

export const questDetailApi = {
    /** Replace the ordered stops. `force` overrides the "active bookings" guard. */
    saveStops: (questId: string, stops: QuestStopPayload[], force = false) =>
        call({
            method: "put",
            url: `/api/v2/quests/${enc(questId)}`,
            data: { marker_playlist: stops, ...(force ? { force: true } : {}) },
        }),

    bookings: (questId: string, params: { status?: string; page?: number; page_size?: number } = {}) =>
        call<QuestBookingsPage>({ method: "get", url: `/api/v2/bookings${qs({ quest_id: questId, ...params })}` }).then((d) => ({
            ...d,
            bookings: d.bookings ?? [],
        })),

    reviews: (questId: string, params: { page?: number; limit?: number } = {}) =>
        call<QuestReviewsPage>({ method: "get", url: `/api/v2/quests/${enc(questId)}/reviews${qs(params)}` }).then((d) => ({
            reviews: d.reviews ?? [],
            total: d.total ?? 0,
        })),

    setReviewVisible: (reviewId: string, visible: boolean) =>
        call({ method: "patch", url: `/api/v2/reviews/${enc(reviewId)}/moderate`, data: { is_visible: visible } }),
};

// ── Events ──────────────────────────────────────────────────

type RawEvent = Record<string, unknown> & { _id?: string; id?: string };

function withId<T>(o: RawEvent): T {
    const { _id, ...rest } = o;
    return { ...rest, id: String(_id ?? o.id ?? "") } as unknown as T;
}

export const eventEditorApi = {
    create: (payload: EventPayload) =>
        call<{ event: RawEvent }>({ method: "post", url: "/api/v2/events", data: payload }).then((d) => withId<{ id: string }>(d.event)),

    update: (eventId: string, payload: EventPayload) =>
        call<{ event: RawEvent }>({ method: "patch", url: `/api/v2/events/${enc(eventId)}`, data: payload }).then((d) =>
            withId<{ id: string }>(d.event)
        ),

    setStatus: (eventId: string, status: string) =>
        call({ method: "post", url: `/api/v2/events/${enc(eventId)}/status`, data: { status } }),

    announce: (eventId: string, payload: AnnouncePayload) =>
        call<AnnounceResult>({ method: "post", url: `/api/v2/events/${enc(eventId)}/announce`, data: payload }),

    scheduled: (eventId: string) =>
        call<{ scheduled: ScheduledAnnouncement[] }>({ method: "get", url: `/api/v2/events/${enc(eventId)}/announce/scheduled` }).then(
            (d) => d.scheduled ?? []
        ),

    cancelScheduled: (eventId: string, scheduledId: string) =>
        call({ method: "delete", url: `/api/v2/events/${enc(eventId)}/announce/scheduled/${enc(scheduledId)}` }),
};
