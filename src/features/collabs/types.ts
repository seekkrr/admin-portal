// ============================================================
// Collabs (creator × business) — admin portal types
// Backend: /api/v2/admin/collabs/*, /api/v2/businesses/admin*,
// /api/v2/business-applications*, /api/v2/config/features*, /api/v2/terms*
//
// Dates: most collab/business serializers emit NAIVE ISO strings (no offset)
// that are UTC. Always format through `fmtDateTime`/`fmtDate` in ./utils.
// ============================================================

/** Collab-admin list envelope (no total_pages — derive from total/page_size). */
export interface CollabsPage {
    total: number;
    page: number;
    page_size: number;
}

// ── Analytics ──────────────────────────────────────────────

export interface CollabFunnel {
    requested: number;
    approved: number;
    redeemed: number;
    delivered: number;
    completed: number;
    invited: number;
    declined: number;
    expired: number;
    no_show: number;
}

export interface CollabsAnalytics {
    days: number;
    businesses: { active: number; pending_claim: number; pending_applications: number };
    creators_open: number;
    collabs_active: number;
    moderation_pending: number;
    open_reports: number;
    open_fraud_flags: number;
    funnel: CollabFunnel;
    attribution: { click: number; app_open: number; checkin: number };
    revenue: {
        mrr_inr: number;
        arr_inr: number;
        paying_by_plan: Record<string, number>;
        trialing: number;
        cancelled: number;
    };
}

// ── Collabs ────────────────────────────────────────────────

export type CollabMode = "open" | "approval";
export type CollabStatus = "active" | "paused" | "archived";
export type ModerationStatus = "approved" | "pending" | "rejected";
export type DeliverableType = "reel" | "post" | "story" | "video" | "review";

export interface CollabBrief {
    deliverables: { type: DeliverableType; count: number }[];
    tag_handles: string[];
    hashtags: string[];
    location_tag: boolean;
    post_within_days: number;
    usage_rights: "none" | "repost_30d" | "repost_unlimited" | "ads";
    disclosure_label: "#ad" | "#collab" | "#gifted";
}

export interface CollabAvailability {
    days_of_week: number[]; // 0 = Monday
    time_windows: { start: string; end: string }[];
    daily_cap: number | null;
    blackout_dates: string[];
    timezone: string;
}

export interface CollabModeration {
    status: ModerationStatus;
    flags: string[];
    reason: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
}

export interface AdminCollab {
    id: string;
    business_id: string | null;
    marker_id: string | null;
    offer: string;
    want: string;
    description: string;
    mode: CollabMode;
    allow_advance_requests: boolean;
    slots_left: number;
    slots_total: number;
    slots_used: number;
    valid_from: string | null;
    valid_until: string | null;
    created_at: string | null;
    updated_at: string | null;
    brief: CollabBrief | null;
    availability: CollabAvailability | null;
    min_creator_tier: CreatorTier;
    per_creator_limit: number;
    status: CollabStatus;
    moderation: CollabModeration;
    counters: { requests: number; redemptions: number; completed: number };
    /** Only present on the moderation queue. */
    business_name?: string | null;
}

export interface CollabsListResponse extends CollabsPage {
    collabs: AdminCollab[];
}

// ── Reports & fraud flags ──────────────────────────────────

export type ReportTargetType = "business" | "creator" | "collab" | "application";
export type ReportStatus = "open" | "actioned" | "dismissed";
export type ReportReason =
    | "unsafe"
    | "harassment"
    | "not_honoured"
    | "no_show"
    | "spam"
    | "inappropriate"
    | "fraud"
    | "other";
export type ReportAction = "dismiss" | "hide" | "restore" | "suspend";

export interface CollabReport {
    id: string;
    reporter_user_id: string;
    target_type: ReportTargetType;
    target_id: string;
    reason: ReportReason;
    details: string | null;
    status: ReportStatus;
    resolution: { action: string; note: string | null } | null;
    created_at: string | null;
    resolved_at: string | null;
}

export interface ReportsListResponse extends CollabsPage {
    reports: CollabReport[];
}

export type FraudFlagType = "code_lockout" | "redeem_without_checkin" | "repeat_pairing";
export type FraudFlagStatus = "open" | "resolved";

export interface FraudFlag {
    id: string;
    type: FraudFlagType | (string & {});
    business_id: string | null;
    creator_user_id: string | null;
    details: Record<string, unknown>;
    status: FraudFlagStatus;
    created_at: string | null;
}

export interface FraudFlagsListResponse extends CollabsPage {
    flags: FraudFlag[];
}

// ── Collab applications (requests) ─────────────────────────

export const APPLICATION_STATUSES = [
    "invited",
    "requested",
    "approved",
    "redeemed",
    "delivered",
    "completed",
    "declined",
    "expired",
    "cancelled",
    "overdue",
    "no_show",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface ApplicationRating {
    score: number;
    comment: string | null;
    at: string | null;
}

export interface ApplicationDeliverable {
    url: string;
    type: string;
    submitted_at: string | null;
    auto_check: {
        ok: boolean;
        platform: string | null;
        author: string | null;
        thumbnail: string | null;
        reason: string | null;
    } | null;
}

export interface AdminCollabApplication {
    id: string;
    collab_id: string | null;
    business_id: string | null;
    marker_id: string | null;
    creator_user_id: string | null;
    source: "walk_in" | "advance" | "invite";
    status: ApplicationStatus;
    visit_window: { from: string; to: string } | null;
    note: string | null;
    decline_reason: string | null;
    redemption: { method: "code" | "staff_qr"; at: string | null } | null;
    deliverables: ApplicationDeliverable[];
    due_at: string | null;
    ratings: {
        business_to_creator: ApplicationRating | null;
        creator_to_business: ApplicationRating | null;
    } | null;
    timeline: { status: string; at: string | null }[];
    created_at: string | null;
    updated_at: string | null;
    tracking_code: string | null;
    business_name?: string;
    creator_name?: string;
}

export interface ApplicationsListResponse extends CollabsPage {
    applications: AdminCollabApplication[];
}

// ── Creators ───────────────────────────────────────────────

export type CreatorTier = "community" | "verified";
export type SocialPlatform = "instagram" | "youtube" | "x" | "facebook" | "linkedin" | "website";

export interface PendingHandleVerification {
    user_id: string;
    display_name: string | null;
    platform: SocialPlatform;
    handle: string;
    code: string | null;
}

export interface VerifyHandleResult {
    user_id: string;
    platform: SocialPlatform;
    verified: boolean;
    tier: CreatorTier;
}

export interface SetTierResult {
    user_id: string;
    tier: CreatorTier;
    suspended?: boolean;
    open_to_collab?: false;
}

// ── Plans, coupons, subscriptions ──────────────────────────

/** `null` on a numeric limit = unlimited. */
export interface Entitlements {
    active_collabs: number | null;
    redemptions_per_month: number | null;
    approval_mode: boolean;
    team_members: number | null;
    match_reveals_per_month: number | null;
    invites_per_month: number | null;
    match_breakdown: boolean;
    attribution: boolean;
    content_library: boolean;
    featured: boolean;
    locations: number | null;
}
export type EntitlementKey = keyof Entitlements;

export interface PublicPlan {
    code: string;
    name: string | null;
    custom: boolean;
    price_monthly_inr: number | null;
    price_annual_inr: number | null;
    price_monthly_inr_incl_gst: number | null;
    price_annual_inr_incl_gst: number | null;
    gst_rate: number;
    trial_days: number;
    entitlements: Entitlements;
}

export interface AdminPlan extends PublicPlan {
    active: boolean;
    razorpay_plan_ids: { monthly?: string; annual?: string };
}

export interface UpdatePlanPayload {
    name?: string;
    price_monthly_inr?: number;
    price_annual_inr?: number;
    trial_days?: number;
    active?: boolean;
    sort?: number;
    entitlements?: Partial<Entitlements>;
}

export interface BillingCoupon {
    code: string;
    description: string | null;
    razorpay_offer_id: string | null;
    plans: string[];
    max_redemptions: number | null;
    redemptions: number;
    expires_at: string | null;
    active: boolean;
}

export interface UpsertBillingCouponPayload {
    code: string;
    description?: string | null;
    razorpay_offer_id?: string | null;
    plans?: string[] | null;
    max_redemptions?: number | null;
    expires_at?: string | null;
    active?: boolean | null;
}

export type SubscriptionStatus = "free" | "trialing" | "active" | "pending" | "halted" | "cancelled";

export interface SubscriptionOverride {
    plan_code: string | null;
    entitlements: Partial<Entitlements>;
    until: string | null;
    reason: string | null;
    set_by: string | null;
    set_at: string | null;
}

export interface AdminSubscription {
    business_id: string;
    business_name: string | null;
    plan_code: string | null;
    status: SubscriptionStatus | null;
    period: "monthly" | "annual" | null;
    trial_ends_at: string | null;
    trial_used: boolean;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    coupon_code: string | null;
    referral_credits: { days: number; applied: boolean; granted_at: string | null }[];
    override: SubscriptionOverride | null;
}

export interface SubscriptionsListResponse extends CollabsPage {
    subscriptions: AdminSubscription[];
}

export interface OverridePayload {
    plan_code: string | null;
    entitlements: Partial<Entitlements> | null;
    until: string | null;
    reason: string | null;
}

export interface EffectiveEntitlements {
    plan_code: string;
    status: string;
    entitlements: Entitlements;
    override_until: string | null;
    trial_ends_at: string | null;
}

// ── Match tuning ───────────────────────────────────────────

export const MATCH_WEIGHT_KEYS = ["theme", "local", "quality", "reliability", "content", "peer", "activity"] as const;
export type MatchWeightKey = (typeof MATCH_WEIGHT_KEYS)[number];
export type MatchWeights = Record<MatchWeightKey, number>;

export interface MatchRerank {
    lambda: number;
    explore_ratio: number;
}

export interface MatchConfig {
    version: string;
    weights: MatchWeights;
    rerank: MatchRerank;
}

export interface MatchVariantPayload {
    version: string;
    traffic_percent: number;
    weights: MatchWeights;
    rerank?: MatchRerank;
}

export interface MatchConfigPayload {
    weights: MatchWeights;
    rerank: MatchRerank;
    variant: MatchVariantPayload | null;
}

export interface MatchPreviewPayload {
    collab_id: string;
    weights?: MatchWeights;
    rerank?: MatchRerank;
    limit: number;
}

export interface MatchPreviewResult {
    creator_user_id: string;
    display_name: string;
    score: number; // 0–100
    reasons: string[];
    breakdown: Partial<MatchWeights>;
    is_new: boolean;
    config_version?: string;
}

export interface MatchEvaluationRow {
    config_version: string;
    impression: number;
    reveal: number;
    invite: number;
    accept: number;
    complete: number;
    invite_acceptance: number | null;
    completion_after_accept: number | null;
}

// ── Businesses ─────────────────────────────────────────────

export type BusinessStatus = "pending_claim" | "active" | "suspended";
export type BusinessMemberRole = "owner" | "manager" | "staff";

export interface BusinessSocial {
    platform: string | null;
    url: string;
}

export interface BusinessBilling {
    legal_name?: string | null;
    gstin?: string | null;
    state_code?: string | null;
    address?: string | null;
}

export interface AdminBusiness {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    description: string | null;
    categories: string[];
    sub_categories: string[];
    region_id: string | null;
    socials: BusinessSocial[];
    photos: string[];
    logo_url: string | null;
    verified: boolean;
    marker_ids: string[];
    status: BusinessStatus;
    plan_code: string;
    contact_phone: string | null;
    contact_email: string | null;
    show_on_website: boolean;
    website_featured: boolean;
    members: { user_id: string | null; role: BusinessMemberRole; added_at: string | null }[];
    claimed_at: string | null;
    created_at: string | null;
    updated_at: string | null;
    billing: BusinessBilling | null;
    owner_user_id: string | null;
    created_by_admin: boolean;
    application_id: string | null;
}

export interface BusinessesListResponse extends CollabsPage {
    businesses: AdminBusiness[];
    total_pages: number;
}

export interface ListBusinessesParams {
    status?: BusinessStatus;
    verified?: boolean;
    search?: string;
    /** Category or sub-category name. */
    category?: string;
    page?: number;
    page_size?: number;
}

/** PATCH /businesses/admin/{id} — null/omitted fields are left unchanged. */
export interface UpdateBusinessPayload {
    name?: string;
    tagline?: string;
    description?: string;
    categories?: string[];
    sub_categories?: string[];
    socials?: BusinessSocial[];
    contact_phone?: string;
    contact_email?: string;
    show_on_website?: boolean;
    verified?: boolean;
    status?: BusinessStatus;
    website_featured?: boolean;
    public_slug?: string;
    region_id?: string;
    marker_ids?: string[];
}

/** POST /businesses/admin — live straight away when an owner (user ID or email) is given. */
export interface CreateBusinessPayload {
    name: string;
    owner_user_id?: string;
    tagline?: string;
    description?: string;
    categories?: string[];
    sub_categories?: string[];
    socials?: BusinessSocial[];
    contact_phone?: string;
    contact_email?: string;
    show_on_website?: boolean;
    website_featured?: boolean;
    public_slug?: string;
    region_id?: string;
    marker_ids?: string[];
}

/** A predefined place category a business can be listed under. */
export interface BusinessCategory {
    name: string;
    sub_categories: string[];
}

// ── Business applications ──────────────────────────────────

export type BusinessApplicationStatus = "pending" | "approved" | "rejected";

export interface AdminBusinessApplication {
    id: string;
    business_name: string;
    contact_name: string;
    email: string;
    phone: string;
    claimed_marker_id: string | null;
    maps_url: string | null;
    region_id: string | null;
    categories: string[];
    sub_categories?: string[];
    social_links: string[];
    requested_plan: "free" | "growth" | "pro" | "multi_location" | null;
    gstin: string | null;
    message: string | null;
    source: "website" | "app" | "portal" | "admin";
    status: BusinessApplicationStatus;
    rejection_reason: string | null;
    business_id: string | null;
    owner_attached: boolean;
    applied_at: string | null;
    actioned_at: string | null;
}

export interface BusinessApplicationsListResponse extends CollabsPage {
    applications: AdminBusinessApplication[];
    total_pages: number;
    pending_count: number;
}

export interface ListBusinessApplicationsParams {
    status?: BusinessApplicationStatus;
    search?: string;
    page?: number;
    page_size?: number;
}

export interface ApproveBusinessApplicationResult {
    application: AdminBusinessApplication;
    business: AdminBusiness;
}

// ── Platform config: feature flags & terms ─────────────────

export interface FeatureFlag {
    key: string;
    enabled: boolean;
    regions_enabled: string[];
    min_app_version: string | null;
    updated_at: string | null;
}

export interface UpdateFeatureFlagPayload {
    enabled?: boolean;
    regions_enabled?: string[];
    min_app_version?: string;
}

export type TermsDoc = "creator_collab_terms" | "business_terms";

export interface TermsVersion {
    doc: TermsDoc;
    version: string;
    url: string | null;
}

export type TermsMap = Partial<Record<TermsDoc, TermsVersion>>;
