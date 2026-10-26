// ============================================================
// Admin "edit everything" detail pages — shared types.
// Endpoints live in src/services/admin-detail.service.ts.
// ============================================================

// ── Change history (GET /api/v2/admin/audit) ───────────────

export type AuditEntityType = "user" | "business" | "place" | "quest" | "experience" | "event" | "region" | "collab";

export interface AuditEntry {
    id: string;
    at: string | null;
    actor: { id: string | null; name: string | null } | null;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    summary: string | null;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    /** "screen" = changed on a portal page, "chat" = the command chat. */
    source: "screen" | "chat" | string;
}

export interface AuditPage {
    items: AuditEntry[];
    total: number;
}

// ── Users ──────────────────────────────────────────────────

export interface AdminUserProfile {
    id: string;
    first_name: string;
    last_name: string;
    username: string | null;
    email: string | null;
    phone: string | null;
    bio: string | null;
    avatar_url: string | null;
    roles: string[];
    status: string;
    is_creator: boolean;
    created_at: string | null;
    last_active_at: string | null;
    points: number;
    hobbies: string[];
}

export interface UserCreatorInfo {
    status: string | null;
    verified: boolean;
    handles: Array<string | { platform?: string | null; handle?: string | null; verified?: boolean | null }>;
}

export interface UserBusinessLink {
    id: string;
    name: string;
    role: string;
    status: string;
    features?: { collabs?: boolean; experiences?: boolean } | null;
}

export interface UserOverviewStats {
    checkins: number;
    experience_bookings: number;
    quest_bookings: number;
    reviews: number;
    collab_applications: number;
    markers_created: number;
}

export interface UserRecentItem {
    id: string;
    title: string;
    subtitle: string | null;
    at: string | null;
    url_path: string | null;
}

export type UserRecentKey = keyof UserOverviewStats;

export interface UserOverview {
    user: AdminUserProfile;
    creator: UserCreatorInfo | null;
    businesses: UserBusinessLink[];
    stats: UserOverviewStats;
    recent: Partial<Record<UserRecentKey, UserRecentItem[]>>;
}

/** PATCH /api/v2/admin/users/{id} — any subset. */
export interface UserPatch {
    first_name?: string;
    last_name?: string;
    username?: string;
    bio?: string;
    phone?: string;
    email?: string;
    hobbies?: string[];
    status?: "active" | "suspended";
    /** Sent with status changes; recorded in the change history when the server keeps it. */
    reason?: string;
}

/** Raw admin user record from GET /api/v2/users/{id} (fallback while the overview isn't live). */
export interface RawAdminUser {
    _id: string;
    first_name?: string;
    last_name?: string;
    username?: string | null;
    email?: string | null;
    phone?: string | null;
    phone_number?: string | null;
    user_bio?: string | null;
    bio?: string | null;
    hobbies?: string[] | null;
    role?: string[] | string | null;
    status?: string;
    is_creator?: boolean;
    points_earned?: number;
    profile_image?: { secure_url?: string; url?: string } | string | null;
    created_at?: string | null;
    last_login_at?: string | null;
    last_active_at?: string | null;
}

// ── Businesses ─────────────────────────────────────────────

export interface BusinessMemberView {
    user_id: string | null;
    role: "owner" | "manager" | "staff";
    added_at: string | null;
    can_chat?: boolean;
}

export interface RedeemCodeStatus {
    marker_id: string;
    code: string | null;
    is_set: boolean;
    set_at: string | null;
}

export interface BusinessOffer {
    _id: string;
    marker_id: string;
    rule_type: "quantitative" | "qualitative" | string;
    trigger_n: number;
    reward_type: "flat" | "product" | string;
    product_details?: { title?: string | null; description?: string | null } | null;
    flat_discount_value?: number | null;
    is_active: boolean;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface OfferPatch {
    rule_type?: "quantitative" | "qualitative";
    trigger_n?: number;
    reward_type?: "flat" | "product";
    product_details?: { title: string; description?: string | null } | null;
    flat_discount_value?: number | null;
    is_active?: boolean;
}

// ── Experiences (business-scoped editor) ───────────────────

export interface TitledText {
    title: string;
    description: string | null;
}

export interface ItineraryItem {
    time_label: string | null;
    title: string;
    description: string | null;
    image_url: string | null;
}

export interface ExperienceFaq {
    question: string;
    answer: string | null;
}

export interface ExperienceOption {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number | null;
    /** Per person; set by SeekKrr admins only (Pricing tab). Null = the experience's price per person. */
    price: number | null;
}

/** GST rates an experience can charge. */
export const GST_RATES = [5, 12, 18, 28] as const;

/** Per-experience GST (admin-set). `inclusive` = the price already includes GST. */
export interface ExperienceGst {
    enabled: boolean;
    rate_pct: number;
    inclusive: boolean;
}

export const GST_DEFAULTS: ExperienceGst = { enabled: false, rate_pct: 18, inclusive: false };

/** PATCH /api/v2/admin/experiences/{id}/pricing — any subset. */
export interface ExperiencePricingPatch {
    price_per_person?: number | null;
    options?: Array<{ id: string; price: number | null }>;
    gst?: ExperienceGst;
}

export interface ExperienceCurator {
    name: string | null;
    title: string | null;
    years: number | null;
    photo_url: string | null;
    note: string | null;
}

export interface ExperienceLocation {
    address: string | null;
    lat: number | null;
    lng: number | null;
    map_url: string | null;
}

export type ExperienceStatus = "draft" | "published" | "paused" | "archived";

/** Whether slots block each other: one shared space (a go-kart track) or one group per slot. */
export interface ExperienceScheduling {
    shared_space: boolean;
    private_slots: boolean;
}

export interface ExperienceDetail {
    id: string;
    business_id: string;
    business: { id: string; name: string | null };
    title: string;
    tagline: string | null;
    description: string | null;
    tags: string[];
    cover_url: string | null;
    marker_id: string | null;
    region_id: string | null;
    region_name: string | null;
    media: string[];
    curator: ExperienceCurator;
    duration_text: string | null;
    location: ExperienceLocation;
    highlights: TitledText[];
    experience_media: string[];
    itinerary: ItineraryItem[];
    included: TitledText[];
    cancellation_policy: TitledText[];
    faqs: ExperienceFaq[];
    gallery: string[];
    options: ExperienceOption[];
    scheduling?: ExperienceScheduling | null;
    /** Admin-set price per person (null = not set). Slot price = option price ?? this ?? free. */
    price_per_person?: number | null;
    gst?: ExperienceGst | null;
    price_from: number | null;
    currency: string;
    status: ExperienceStatus;
    hidden_by_admin: boolean;
    stats: { bookings: number; people: number };
    next_date: string | null;
    dates_text: string | null;
    upcoming_slots?: number;
    created_by: string | null;
    created_at: string | null;
    updated_at: string | null;
}

/** PATCH /businesses/{id}/experiences/{eid} — any subset. */
export interface ExperiencePatch {
    title?: string;
    tagline?: string | null;
    description?: string | null;
    tags?: string[];
    marker_id?: string | null;
    region_id?: string | null;
    media?: string[];
    curator?: Partial<ExperienceCurator>;
    duration_text?: string | null;
    location?: Partial<ExperienceLocation>;
    highlights?: TitledText[];
    experience_media?: string[];
    itinerary?: ItineraryItem[];
    included?: TitledText[];
    cancellation_policy?: TitledText[];
    faqs?: ExperienceFaq[];
    gallery?: string[];
    /** `price` is only echoed back unchanged (prices are set on the Pricing tab). */
    options?: Array<Omit<ExperienceOption, "id" | "price"> & { id?: string; price?: number | null }>;
    scheduling?: Partial<ExperienceScheduling>;
}

export interface ExperienceSlot {
    id: string;
    experience_id: string;
    option_id: string | null;
    option_name: string | null;
    date: string;
    start_time: string;
    end_time: string;
    starts_at: string | null;
    ends_at: string | null;
    capacity: number;
    booked: number;
    remaining: number;
    /** Computed: option price ?? experience price per person ?? 0 (read-only). */
    price: number | null;
    sold_out: boolean;
    status: "open" | "cancelled";
    cancelled_at: string | null;
    /** Why travellers can't book it: "price_not_set" until SeekKrr prices its option. */
    unavailable_reason?: "cancelled" | "blocked" | "price_not_set" | "time_taken" | "private_booked" | "full" | null;
}

export interface BulkSlotsPayload {
    option_id?: string | null;
    dates?: string[];
    from?: string;
    to?: string;
    /** 0 = Monday … 6 = Sunday */
    weekdays?: number[];
    times: Array<{ start: string; end: string }>;
    capacity: number;
}

export interface BulkSlotsResult {
    created: number;
    slots: ExperienceSlot[];
    skipped: number;
    skipped_past: number;
}

export interface SlotPatch {
    capacity?: number;
    start_time?: string;
    end_time?: string;
}

export type ExperienceBookingStatus = "pending_payment" | "confirmed" | "cancelled" | "checked_in" | "no_show" | "expired";

export type ExperiencePaymentStatus = "not_required" | "pending" | "paid" | "refund_pending" | "refunded" | "failed";

/** Razorpay payment of one booking (amount in rupees). */
export interface ExperienceBookingPayment {
    status: ExperiencePaymentStatus;
    amount?: number | null;
    currency?: string | null;
    order_id?: string | null;
    payment_id?: string | null;
    refund_id?: string | null;
    paid_at?: string | null;
    refunded_at?: string | null;
}

/** Price breakdown stored on the booking when it was made. */
export interface ExperienceBookingPricing {
    unit_price?: number | null;
    people?: number | null;
    /** Taxable value. */
    subtotal?: number | null;
    gst_enabled?: boolean;
    gst_rate_pct?: number | null;
    gst_inclusive?: boolean;
    gst_amount?: number | null;
    total?: number | null;
}

export interface ExperienceBookingItem {
    slot_id: string | null;
    option_id: string | null;
    option_name: string | null;
    date: string | null;
    start_time: string | null;
    end_time: string | null;
    people: number;
    price: number | null;
    status: string;
}

export interface ExperienceBooking {
    id: string;
    code: string | null;
    status: ExperienceBookingStatus;
    total_people: number;
    total_amount: number | null;
    currency: string;
    starts_at: string | null;
    items: ExperienceBookingItem[];
    user?: { id: string; name: string | null; avatar_url: string | null } | null;
    user_id: string | null;
    contact?: { name: string | null; phone: string | null } | null;
    note?: string | null;
    created_at: string | null;
    cancelled_at: string | null;
    cancel_reason?: string | null;
    checked_in_at: string | null;
    payment?: ExperienceBookingPayment | null;
    pricing?: ExperienceBookingPricing | null;
    hold_expires_at?: string | null;
    cancellable_until?: string | null;
    source?: "app" | "offline" | null;
}

export interface ExperienceBookingsPage {
    bookings: ExperienceBooking[];
    total: number;
    page: number;
    page_size: number;
}

// ── Places (markers) ───────────────────────────────────────

/** Fields GET /markers/{id} returns beyond the shared `Marker` type. */
export interface MarkerExtras {
    owner_id?: string | null;
    region_name?: string | null;
    creator_name?: string | null;
    rating?: number | null;
    review_count?: number | null;
    checkins_count?: number | null;
    likes_count?: number | null;
    collab_open_count?: number | null;
    properties?: Record<string, unknown> | null;
}

export interface MarkerCollabsInfo {
    enabled: boolean;
    business: { id: string; name: string | null; slug?: string | null; logo_url?: string | null; verified?: boolean } | null;
    collabs: Array<{ id: string; offer?: string | null; status?: string | null }>;
}

export interface PublicExperienceCard {
    id: string;
    title: string;
    cover_url: string | null;
    business: { id: string | null; name: string | null };
    marker_id: string | null;
    next_date: string | null;
}

export interface PlaceReview {
    _id: string;
    user_id?: string | null;
    rating?: number | null;
    comment?: string | null;
    is_visible?: boolean;
    created_at?: string | null;
}

export interface PlaceReviewsPage {
    reviews: PlaceReview[];
    total: number;
}

/** Moved-pin result: the marker as the server now has it. */
export interface MovedMarker {
    id: string;
    location: { type: "Point"; coordinates: [number, number] } | null;
    region_id: string | null;
    region_name: string | null;
    address: string | null;
}

// ── Quests ─────────────────────────────────────────────────

/** One stop of PUT /api/v2/quests/{id} {marker_playlist}. */
export interface QuestStopPayload {
    marker_id: string;
    suggested_order: number;
    is_required: boolean;
    things_to_do_text?: string | null;
    things_to_do_image_url?: string | null;
}

export interface QuestBookingRow {
    _id: string;
    user_id: string;
    quest_id: string;
    status: string;
    booked_at?: string | null;
    completed_at?: string | null;
    created_at?: string | null;
}

export interface QuestBookingsPage {
    bookings: QuestBookingRow[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface QuestReviewRow {
    _id: string;
    user_id?: string | null;
    rating?: number | null;
    comment?: string | null;
    is_visible?: boolean;
    created_at?: string | null;
    creator_response?: string | null;
}

export interface QuestReviewsPage {
    reviews: QuestReviewRow[];
    total: number;
}

// ── Events ─────────────────────────────────────────────────

export interface EventVenue {
    marker_id: string;
    name?: string | null;
    category?: string | null;
    thumbnail_url?: string | null;
    /** [lng, lat] */
    coordinates?: number[] | null;
    /** Kept as-is (map filter chip key etc.). */
    [extra: string]: unknown;
}

export interface EventMedia {
    cover_image_url?: string;
    image_urls?: string[];
    video_urls?: string[];
}

/** POST /api/v2/events and PATCH /api/v2/events/{id}. */
export interface EventPayload {
    title?: string;
    subtitle?: string;
    description?: string;
    website?: string;
    categories?: string[];
    media?: EventMedia;
    start_date?: string | null;
    end_date?: string | null;
    timezone?: string;
    region_id?: string;
    venues?: EventVenue[];
    main_venue_marker_id?: string | null;
    bounding_box?: { min: [number, number]; max: [number, number] };
    capacity?: number;
    is_featured?: boolean;
}

export interface ScheduledAnnouncement {
    id: string;
    title: string | null;
    body: string | null;
    image: string | null;
    long_body: string | null;
    send_at: string | null;
    status: string | null;
    created_at: string | null;
}

export interface AnnouncePayload {
    title: string;
    body: string;
    image?: string;
    long_body?: string;
    /** ISO (UTC). Omit to send now. */
    send_at?: string;
}

export interface AnnounceResult {
    recipients: number;
    sent?: number;
    scheduled_id?: string;
    id?: string;
}
