// User & Auth Types
export const ALLOWED_ADMIN_ROLES = ["admin", "super_admin", "moderator", "finance"] as const;

export interface User {
    _id: string;
    first_name: string;
    last_name: string;
    contact_id: string;
    security_id: string;
    profile_id: string;
    role: Array<"user" | "admin" | "super_admin" | "creator" | "moderator" | "finance">;
    status: "active" | "suspended" | "deleted";
    is_creator: boolean;
    points_earned: number;   // returned by the admin user list (to_admin_dict)
    created_at: string;
    updated_at: string;
}

/**
 * Backend role shape is inconsistent: V2 `/auth/verify` may return `role` as a
 * single string (e.g. "admin") OR an array. The whole portal assumes an array
 * (`user.role.some(...)`). Coerce here at the boundary so every consumer is
 * safe — a string-typed role from prod was white-screening the route guard
 * with "role.some is not a function".
 */
export function normalizeUser<T extends { role?: unknown } | null | undefined>(user: T): T {
    if (!user || typeof user !== "object") return user;
    const raw = (user as { role?: unknown }).role;
    const role = Array.isArray(raw) ? raw : raw === null || raw === undefined ? [] : [raw];
    return { ...(user as object), role } as T;
}

export interface UserProfile {
    _id: string;
    bio?: string;
    profile_image?: CloudinaryAsset;
    points_earned: number;
    referral_code?: string;
}

export interface Creator {
    _id: string;
    user_id: string;
    status: "pending" | "approved" | "rejected" | "suspended";
    is_verified: boolean;
    verification_documents?: string[];
    stats_id?: string;
    payout_account_id?: string;
    created_at: string;
    updated_at: string;
}

export interface CreatorApplication {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    social_links: string[];
    social_links_verified: boolean;
    status: "pending" | "verifying" | "approved" | "rejected";
    admin_id: string | null;
    applied_at: string;
    actioned_at: string | null;
    rejection_reason: string | null;
    used_for_creator: boolean;
    used_at: string | null;
    used_by_user_id: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface CreatorStats {
    _id: string;
    total_quests: number;
    total_earnings: number;
    impressions: number;
    is_verified: boolean;
    last_updated: string;
}

export interface PayoutAccount {
    _id: string;
    method: "bank" | "upi" | "wallet";
    bank_details?: {
        account_number: number;
        ifsc_code: string;
        account_holder: string;
    };
    upi_id?: string;
    currency: string;
    created_at: string;
    updated_at: string;
}

export interface CreatorDetailResponse {
    creator_profile: Creator;
    user_profile: User | null;
    stats: CreatorStats | null;
    payout_account: PayoutAccount | null;
}

export interface AuthTokens {
    access_token: string;
    refresh_token: string;
    token_type: "bearer";
    user_id: string;
    expires_in?: number;
}

// Cloudinary Types
export interface CloudinaryAsset {
    public_id: string;
    secure_url: string;
    version?: number;
    format?: string;
    resource_type?: string;
    width?: number;
    height?: number;
    alt_text?: string;
    is_thumbnail?: boolean;
}

export interface CloudinaryUploadResponse {
    public_id: string;
    secure_url: string;
    url: string;
    format: string;
    resource_type: string;
    width: number;
    height: number;
    bytes: number;
    created_at: string;
}

// Quest Types
export type QuestDifficulty = "easy" | "moderate" | "hard" | "expert";
export type QuestStatus =
    | "Draft"
    | "Under Review"
    | "Changes Requested"
    | "Approved"
    | "Published"
    | "Paused"
    | "Rejected"
    | "Archived";
export type QuestTheme =
    | "adventure" | "romance" | "culture" | "food" | "history"
    | "nature" | "spiritual" | "photography" | "archaeological"
    | "offbeat" | "finding_yourself" | "other";

// Shape returned by GET /api/v2/quests (list endpoint) — to_list_dict()
export interface QuestListEntry {
    id: string;
    title: string | null;
    description: string | null;
    theme: string[];
    difficulty: string | null;
    price: number;
    currency: string | null;
    points: number | null;
    duration_minutes: number | null;
    region_id: string | null;
    region_name?: string | null;
    status: QuestStatus;
    view_count: number;
    average_rating: number | null;
    total_markers: number;
    completion_count: number;
    review_count: number;
    cloudinary_assets: CloudinaryAsset[];
    created_at: string | null;
}

// MarkerSummary — one entry per marker in the quest playlist
// coordinates is null for admin (not booked); real coords fetched via markers API
export interface MarkerSummary {
    marker_id: string;
    name: string | null;
    category: string | null;
    tags: string[];
    images: CloudinaryAsset[];
    things_to_do_text: string | null;
    things_to_do_image_url: string | null;
    order: number | null;
    is_required: boolean;
    is_unlocked: boolean;
    coordinates: { lat: number; lng: number } | null;
}

export interface CreatorSummary {
    id: string;
    name: string | null;
    avatar_url: string | null;
    tagline: string | null;
    creator_badge: string | null;
}

export interface RegionSummaryV2 {
    id: string;
    name: string | null;
    crowd_meter: Record<string, number> | null;
}

export interface LinkedAchievement {
    id: string;
    name: string | null;
    icon_url: string | null;
    xp_reward: number | null;
}

// Shape returned by GET /api/v2/quests/{id} — to_detail_response()
export interface V2QuestDetail {
    id: string;
    title: string | null;
    description: string | null;
    theme: string[] | null;
    keywords: string[] | null;
    difficulty: string | null;
    price: number;
    currency: string | null;
    points: number | null;
    duration_minutes: number | null;
    hints_allowed: number | null;
    min_expense: number | null;
    max_expense: number | null;
    best_month_start: string | null;
    best_month_end: string | null;
    start_time: string | null;
    status: QuestStatus;
    view_count: number;
    average_rating: number | null;
    review_count: number;
    completion_count: number;
    total_markers: number;
    cloudinary_assets: CloudinaryAsset[];
    reel_urls: string[];
    creator_summary: CreatorSummary;
    region_summary: RegionSummaryV2;
    start_point: { marker_id: string; name: string | null; lat: number | null; lng: number | null } | null;
    marker_summaries: MarkerSummary[];
    linked_achievement: LinkedAchievement | null;
    user_booking_status: string;
    created_at: string | null;
    updated_at: string | null;
}

// Review history entry from GET /api/v2/quests/{id}/review
export interface QuestReviewHistoryEntry {
    action: string;           // "submitted" | "approved" | "changes_requested" | "rejected" | "paused" | "unpaused"
    comment: string | null;
    commented_by: string | null;
    commented_at: string | null;
}

export interface QuestReviewRecord {
    id: string;
    quest_id: string;
    review_history: QuestReviewHistoryEntry[];
    status_updated_by: string | null;
    status_updated_at: string | null;
    created_at: string | null;
    updated_at: string | null;
}

// Payload for PUT /api/v2/quests/{id} — only fields UpdateQuestBody accepts
export interface UpdateQuestPayload {
    title?: string;
    description?: string | null;
    theme?: string[];
    keywords?: string[];
    difficulty?: string;
    price?: number;
    currency?: string;
    points?: number;
    duration_minutes?: number;
    hints_allowed?: number;
    min_expense?: number;
    max_expense?: number;
    best_month_start?: string | null;
    best_month_end?: string | null;
    cloudinary_assets?: CloudinaryAsset[];
    reel_urls?: string[];
    marker_playlist?: Array<{
        marker_id: string;
        order: number;
        is_required?: boolean;
    }>;
}

// Legacy review history entry — kept for backward compatibility during migration
export interface ReviewHistoryEntry {
    comment: string | null;
    reviewed_by?: string;
    admin_id?: string;
    status?: string;
    reviewed_at?: string;
    timestamp?: string;
}

// API Response Types
export interface ApiResponse<T> {
    data: T;
    status: number;
    message?: string;
}

export interface ApiError {
    error: string;
    details?: string;
    status?: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    pagination: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
    };
}

// ---- Support Query Types (Section 13) ----

export interface SupportQuery {
    id: string; // Updated from _id to id to match backend
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    created_at?: string;
    updated_at?: string;
}

export interface ListSupportQueriesParams {
    page?: number;
    page_size?: number;
    email_filter?: string;
}

export interface SupportQueriesResponse {
    queries: SupportQuery[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

// ---- Analytics Types (Sections 1 & 15) ----
export type AnalyticsPeriod = "7d" | "30d" | "60d" | "90d";

export interface AnalyticsOverview {
    data: {
        period: { from: string, to: string };
        total_users: number;
        published_quests: number;
        active_creators: number;
        total_reviews: number;
        revenue_in_period: number;
        completions_in_period: number;
        completion_rate: number;
    }
}

export interface UserGrowthData {
    data: Array<{
        period: string;
        count: number;
    }>;
}

export interface ActiveUsersData {
    data: {
        active_users: number;
        from: string;
        to: string;
    }
}

export interface UsersByRoleData {
    data: Array<{
        role: string;
        count: number;
    }>;
}

export interface RetentionCohortData {
    data: Array<{
        cohort_month: string;
        user_count: number;
    }>;
}

export interface RevenueData {
    data: {
        total_revenue: number;
        transaction_count: number;
        from: string;
        to: string;
    }
}

export interface RevenueOverTimeData {
    data: Array<{
        period: string;
        revenue: number;
        count: number;
    }>;
}

export interface RevenueByQuestData {
    data: Array<{
        quest_id: string;
        quest_title: string;
        revenue: number;
        count: number;
    }>;
}

export interface RevenueFunnelData {
    data: {
        transactions: Record<string, number>;
        refunds: Record<string, number>;
    }
}

export interface QuestCompletionRateData {
    data: {
        total: number;
        completed: number;
        completion_rate: number;
    }
}

export interface QuestsByStatusData {
    data: Array<{
        status: string;
        count: number;
    }>;
}

export interface TopPerformingQuestsData {
    data: Array<{
        quest_id: string;
        title: string;
        completions?: number;
        revenue?: number;
        average_rating?: number;
    }>;
}

export interface QuestApprovalFunnelData {
    data: Array<{
        action: string;
        count: number;
    }>;
}

export interface ReviewSentimentData {
    data: {
        average_rating: number;
        review_count: number;
        distribution: Record<string, number>;
    }
}

export interface ActiveCreatorsData {
    data: {
        active_creators: number;
    }
}

export interface TopCreatorsData {
    data: Array<{
        creator_id: string;
        name: string;
        total_earnings: number;
        total_quests: number;
    }>;
}

export interface CreatorApplicationFunnelData {
    data: Array<{
        status: string;
        count: number;
    }>;
}

export interface TopRegionsData {
    data: Array<{
        region_id: string;
        name: string;
        quests?: number;
        footfall?: number;
        completions?: number;
    }>;
}

export interface RegionCoverageData {
    data: Array<{
        type: string;
        count: number;
    }>;
}

export interface NarrativesByStatusData {
    data: Array<{
        status: string;
        count: number;
    }>;
}

export interface MarkersByCategoryData {
    data: Array<{
        status: string;
        count: number;
        period: string;
    }>;
}

export interface SessionDurationData {
    average_minutes: number;
    median_minutes: number;
    data: Array<{
        date: string;
        avg_duration: number;
    }>;
    period: AnalyticsPeriod;
}

// ───────────────────────────────────────────────────────────────────────────
// Shared Geo Types
// ───────────────────────────────────────────────────────────────────────────
export interface GeoPoint {
    type: "Point";
    coordinates: [number, number]; // [lon, lat]
}

export interface GeoPolygon {
    type: "Polygon";
    coordinates: number[][][];
}

// ───────────────────────────────────────────────────────────────────────────
// Section 8 — Markers & Marker Applications
//   Backend: v2/models/marker.py → to_public_dict() returns `id` (string)
//   Statuses: approved | pending | hidden | rejected
// ───────────────────────────────────────────────────────────────────────────
export type MarkerStatus = "approved" | "pending" | "hidden" | "rejected";
export type MarkerApplicationStatus = "pending" | "under_review" | "approved" | "rejected";
export type MarkerCategory = string;

export interface Marker {
    id: string;
    title: string;
    location: GeoPoint | null;
    category: MarkerCategory | null;
    description: string | null;
    media: string[] | null;
    tags: string[] | null;
    opens_at: string | null;
    closes_at: string | null;
    address: string | null;
    map_url: string | null;
    min_expense: number | null;
    max_expense: number | null;
    website_url: string | null;
    contact: string | null;
    region_id: string | null;
    status: MarkerStatus;
    source: string | null;
    created_by: string | null;
    usage_count: number;
    center_distance: MarkerCenterDistance | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface MarkerCenterDistance {
    region_id: string | null;
    center: [number, number] | null;
    walk_distance_m: number | null;
    walk_duration_s: number | null;
    drive_distance_m: number | null;
    drive_duration_s: number | null;
    computed_at: string | null;
}

export interface MarkerApplication {
    id: string;
    user_id: string;
    status: MarkerApplicationStatus;
    proposed_location: GeoPoint | null;
    proposed_title: string;
    proposed_category: string | null;
    proposed_description: string | null;
    proposed_address: string | null;
    photos: string[] | null;
    additional_info: Record<string, unknown> | null;
    marker_id: string | null;
    approved_by: string | null;
    approved_at: string | null;
    rejected_by: string | null;
    rejected_at: string | null;
    rejection_reason: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface MarkersListResponse {
    success: boolean;
    markers: Marker[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface MarkerApplicationsListResponse {
    success: boolean;
    applications: MarkerApplication[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface ListMarkersParams {
    status?: MarkerStatus;
    category?: string;
    tags?: string;
    search?: string;
    min_lon?: number;
    min_lat?: number;
    max_lon?: number;
    max_lat?: number;
    page?: number;
    page_size?: number;
}

export interface CreateMarkerPayload {
    title: string;
    location: GeoPoint;
    category?: string;
    description?: string;
    address?: string;
    map_url?: string;
    website_url?: string;
    contact?: string;
    tags?: string[];
    media?: string[];
    min_expense?: number;
    max_expense?: number;
    region_id?: string;
    properties?: Record<string, unknown>;
}

export type UpdateMarkerPayload = Partial<Omit<CreateMarkerPayload, "location">> & {
    status?: MarkerStatus;
};

// ───────────────────────────────────────────────────────────────────────────
// Section 9 — Narratives (admin) & Reviews
//   Backend narrative: v2/models/narrative.py → to_public_dict() = to_dict()
//   so the id key is `_id` (string). Statuses: draft | under_review |
//   approved | rejected | archived. Audio: pending | generating | ready |
//   failed | quota_exceeded.
// ───────────────────────────────────────────────────────────────────────────
export type NarrativeStatus = "draft" | "under_review" | "approved" | "rejected" | "archived";
export type NarrativeAudioStatus = "pending" | "generating" | "ready" | "failed" | "quota_exceeded";
export type NarrativeAttachType = "marker" | "quest" | "region";
export type VoicePersona = "historian_warm" | "mystery_whisper" | "energetic_guide" | "elder_storyteller";

export interface AdminNarrative {
    _id: string;
    title: string;
    attach_type: NarrativeAttachType;
    attach_id: string;
    content: string | null;
    subtitle: string | null;
    trigger_location: GeoPoint | null;
    trigger_radius_m: number | null;
    audio_url: string | null;
    audio_status: NarrativeAudioStatus;
    audio_duration_s: number | null;
    voice_persona: VoicePersona | null;
    media: string[];
    is_mandatory: boolean;
    is_unlocked: boolean;
    chain_id: string | null;
    sequence_order: number | null;
    status: NarrativeStatus;
    reviewed_by: string | null;
    reviewed_at: string | null;
    review_note: string | null;
    view_count: number;
    created_by: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface NarrativesListResponse {
    success: boolean;
    narratives: AdminNarrative[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface ListNarrativesParams {
    attach_type?: NarrativeAttachType;
    attach_id?: string;
    status?: NarrativeStatus;
    chain_id?: string;
    search?: string;
    sort_by?: string;
    sort_order?: 1 | -1;
    page?: number;
    page_size?: number;
}

export interface NarrativeAudioStatusResponse {
    success: boolean;
    narrative_id: string;
    audio_status: NarrativeAudioStatus | null;
    audio_url: string | null;
    audio_duration_s: number | null;
}

export interface BulkApproveResponse {
    success: boolean;
    approved?: number;
    failed?: string[];
    [key: string]: unknown;
}

// Admin-editable narrative fields (PUT /narratives/{id}). All optional;
// only changed keys are sent.
export interface UpdateNarrativePayload {
    title?: string;
    content?: string;
    subtitle?: string;
    voice_persona?: VoicePersona;
    trigger_radius_m?: number;
    is_mandatory?: boolean;
    is_unlocked?: boolean;
    chain_id?: string;
    sequence_order?: number;
    media?: string[];
}

// Create payload (POST /narratives). Mirrors CreateNarrativeBody on the
// backend. attach_type/attach_id/title are required; everything else optional.
export interface CreateNarrativePayload {
    title: string;
    attach_type: NarrativeAttachType;
    attach_id: string;
    content?: string;
    subtitle?: string;
    trigger_location?: GeoPoint;
    trigger_radius_m?: number;
    voice_persona?: VoicePersona;
    media?: string[];
    is_mandatory?: boolean;
    is_unlocked?: boolean;
    // Append onto an EXISTING chain: real ObjectId chain_id from the summary,
    // plus the slot to occupy.
    chain_id?: string;
    sequence_order?: number;
    // Chain onto an existing STANDALONE narrative (its `_id`); the backend mints
    // a chain and back-patches both narratives.
    chain_with?: string;
    // Save-as-Draft → "draft"; Submit → "approved". Defaults to "draft".
    status?: "draft" | "under_review" | "approved";
}

// ── Attach-summary / conflict detection ────────────────────────────────────
// Real backend endpoint:
//   GET /api/v2/narratives/attach-summary?attach_type=<>&attach_id=<>
// "active" narratives = status draft|under_review|approved (archived/rejected
// excluded). Used by the Create modal's pre-check to surface duplicate-
// attachment conflicts and to drive the chain/edit decision.

// One existing narrative chain attached to the target.
export interface NarrativeChainSummary {
    chain_id: string;
    // Human label for the chain (typically the first narrative's title).
    label: string;
    // First narrative in the chain — the "edit existing" navigation target.
    first_narrative_id: string;
    // Number of active narratives in this chain.
    count: number;
    // Highest sequence_order currently used in the chain.
    max_sequence_order: number;
    // Sequence order to use when appending the next narrative.
    next_sequence_order: number;
}

// A standalone (un-chained) active narrative on the target.
export interface NarrativeStandaloneSummary {
    _id: string;
    title: string;
    status: NarrativeStatus;
    sequence_order: number | null;
}

export interface NarrativeAttachSummary {
    success: boolean;
    attach_type: NarrativeAttachType;
    attach_id: string;
    // Total active narratives on the target.
    active_count: number;
    // True when active_count > 0.
    has_conflict: boolean;
    // True when any active narrative already belongs to a chain.
    is_chain: boolean;
    // Existing chains attached to the target.
    chains: NarrativeChainSummary[];
    // Active narratives attached to the target with no chain.
    standalone: NarrativeStandaloneSummary[];
}

// Reviews — backend ReviewService._serialize keeps `_id` (string)
export interface AdminReview {
    _id: string;
    user_id: string | null;
    quest_id: string | null;
    creator_id: string | null;
    rating: number;
    comment: string | null;
    is_verified: boolean;
    is_visible: boolean;
    is_deleted: boolean;
    creator_response?: string | null;
    creator_responded_at?: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface ReviewsListResponse {
    success: boolean;
    reviews: AdminReview[];
    total: number;
    page?: number;
    limit?: number;
}

export interface ListReviewsParams {
    page?: number;
    limit?: number;
    is_visible?: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// Section 11 — Regions
//   Backend: v2/models/region.py → to_public_dict() returns `id` (string).
//   bbox is a GeoJSON Polygon; center_point is a GeoJSON Point;
//   crowd_meter is a { [month: string]: number } map. Update is PATCH.
// ───────────────────────────────────────────────────────────────────────────
export type RegionType = "city" | "hotspot";

export interface Region {
    id: string;
    name: string;
    slug: string;
    type: RegionType;
    parent_id: string | null;
    description: string | null;
    bbox: GeoPolygon | number[] | null;
    center_point: GeoPoint | number[] | null;
    mapbox_place_id: string | null;
    quest_ids: string[];
    marker_count: number;
    admin_weight: number;
    crowd_meter: Record<string, number>;
    is_active: boolean;
    created_at: string | null;
    updated_at: string | null;
}

export interface RegionsListResponse {
    success: boolean;
    regions: Region[];
    total: number;
    page: number;
    page_size: number;
    total_pages?: number;
}

export interface RegionHotspotsResponse {
    success: boolean;
    hotspots: Region[];
    total: number;
}

export interface ListRegionsParams {
    type?: RegionType;
    parent_id?: string;
    page?: number;
    page_size?: number;
}

export interface RegionMatrixPair {
    origin: string;
    destination: string;
    duration_s: number;
    [key: string]: unknown;
}

export interface RegionMatrixResponse {
    region_id: string;
    pairs: RegionMatrixPair[];
    count: number;
}

export interface UpdateRegionPayload {
    name?: string;
    description?: string;
    bbox?: unknown;
    center_point?: unknown;
    is_active?: boolean;
    mapbox_place_id?: string;
}

// Create a region directly (POST /regions). type is required by the backend
// (city | hotspot); center_point/bbox are GeoJSON; parent_id links a hotspot
// to its city.
export interface CreateRegionPayload {
    name: string;
    type: RegionType;
    parent_id?: string;
    description?: string;
    bbox?: GeoPolygon;
    center_point?: GeoPoint;
    mapbox_place_id?: string;
    admin_weight?: number;
    slug?: string;
}

export interface FeatureUsageData {
    features: Array<{
        feature: string;
        usage_count: number;
        unique_users: number;
        percentage: number;
    }>;
}

// ============================================================
// Section 10 — Achievements & Leaderboards
// Backend: /api/v2/achievements, /api/v2/leaderboards
// ============================================================

// Enforced by the Achievement *model* (VALID_TRIGGER_TYPES), which the service
// validates against on create/update. Verified live: the API rejects any other
// value with "trigger_type must be one of [...]". (The route file declares a
// different, unused constant — the model's set is the real boundary.)
export type AchievementTriggerType =
    | "xp_threshold"
    | "quests_completed"
    | "markers_visited"
    | "streak_days"
    | "tasks_completed"
    | "manual";

export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

// Achievement.to_dict() uses the base serializer → keeps `_id` (string), not `id`.
export interface Achievement {
    _id: string;
    title: string;
    description?: string | null;
    icon_url?: string | null;
    trigger_type: AchievementTriggerType;
    trigger_threshold: number;
    rewards_points: number;
    rarity: AchievementRarity;
    perks: string[];
    is_active: boolean;
    is_deleted?: boolean;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface AchievementsListResponse {
    success: boolean;
    achievements: Achievement[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface ListAchievementsParams {
    trigger_type?: AchievementTriggerType;
    rarity?: AchievementRarity;
    is_active?: boolean;
    page?: number;
    page_size?: number;
}

export interface CreateAchievementPayload {
    title: string;
    description?: string;
    trigger_type: AchievementTriggerType;
    trigger_threshold: number;
    rewards_points?: number;
    rarity?: AchievementRarity;
    icon_url?: string;
    perks?: string[];
    is_active?: boolean;
}

// trigger_type is immutable after creation (UpdateAchievementBody omits it).
export type UpdateAchievementPayload = Partial<Omit<CreateAchievementPayload, "trigger_type">>;

export interface ExplorerLevel {
    level: number;
    title: string;
    min_xp: number;
    max_xp: number | null;
    perks: string[];
}

export interface ExplorerLevelsResponse {
    success: boolean;
    explorer_levels: ExplorerLevel[];
}

// UserAchievement.to_dict() — base serializer, `_id`.
export interface UserAchievement {
    _id: string;
    user_id: string;
    achievement_id: string;
    progress_current: number;
    progress_required: number;
    is_completed: boolean;
    earned_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface UserAchievementsResponse {
    success: boolean;
    user_achievements: UserAchievement[];
}

export type LeaderboardType = "quest" | "region" | "global";

// Leaderboard.to_public_dict() emits `id`.
export interface LeaderboardEntry {
    id: string | null;
    type: LeaderboardType;
    user_id: string | null;
    display_name: string | null;
    avatar_url: string | null;
    points_scored: number;
    markers_visited: number | null;
    rank: number | null;
    quest_id: string | null;
    region_id: string | null;
    recorded_at: string | null;
}

// Board endpoints return the board dict directly (NOT wrapped in {success}).
export interface LeaderboardResponse {
    entries: LeaderboardEntry[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface RecomputeResponse {
    message: string;
    region_id?: string;
}

// ============================================================
// Section 12 — Task Configs & Step Rewards
// Backend: /api/v2/tasks, /api/v2/rewards  (NOT task-configs/step-rewards)
// ============================================================

export type TaskConfigType =
    | "photo_challenge"
    | "qr_scan"
    | "quiz"
    | "collection"
    | "social"
    | "checkin";

export interface QuizData {
    question?: string;
    options?: string[];
    correct_answer?: string; // present only via /full (task_configs:manage)
    [k: string]: unknown;
}

// TaskConfig.to_public_dict() — base `_id`; answer keys stripped for non-admin.
export interface TaskConfig {
    _id: string;
    task_type: TaskConfigType;
    title: string;
    description?: string | null;
    marker_id: string;
    quest_id?: string | null;
    photo_requirements?: Record<string, unknown> | null;
    qr_data?: Record<string, unknown> | null;
    quiz_data?: QuizData | null;
    game_config?: Record<string, unknown> | null;
    collection_items?: unknown[] | null;
    social_task?: Record<string, unknown> | null;
    hints?: Array<Record<string, unknown>> | null;
    base_points: number;
    is_active: boolean;
    is_deleted?: boolean;
    deleted_at?: string | null;
    created_by?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface TaskConfigsListResponse {
    success: boolean;
    task_configs: TaskConfig[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface ListTaskConfigsParams {
    marker_id?: string;
    quest_id?: string;
    task_type?: TaskConfigType;
    page?: number;
    page_size?: number;
}

export interface CreateTaskConfigPayload {
    task_type: TaskConfigType;
    title: string;
    description?: string;
    marker_id: string;
    quest_id?: string;
    photo_requirements?: Record<string, unknown>;
    qr_data?: Record<string, unknown>;
    quiz_data?: Record<string, unknown>;
    game_config?: Record<string, unknown>;
    collection_items?: unknown[];
    social_task?: Record<string, unknown>;
    hints?: Array<Record<string, unknown>>;
    base_points?: number;
    is_active?: boolean;
}

// Update body cannot change task_type / marker_id / quest_id.
export type UpdateTaskConfigPayload = Partial<
    Omit<CreateTaskConfigPayload, "task_type" | "marker_id" | "quest_id">
>;

export type StepRewardContextType =
    | "quest_completion"
    | "marker_visit"
    | "task_completion"
    | "streak_bonus";

export type BonusOperator = "gte" | "lte" | "eq" | "in";

export interface BonusCondition {
    field: string;
    operator: BonusOperator;
    value: unknown;
    bonus_points: number;
}

// StepReward.to_dict() — base `_id`.
export interface StepReward {
    _id: string;
    context_type: StepRewardContextType;
    context_id: string;
    base_points: number;
    bonus_conditions?: BonusCondition[] | null;
    unlocked_badges?: string[] | null;
    unlocked_content?: string[] | null;
    is_deleted?: boolean;
    deleted_at?: string | null;
    created_by?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface StepRewardsListResponse {
    success: boolean;
    rewards: StepReward[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface ListStepRewardsParams {
    context_type?: StepRewardContextType;
    context_id?: string;
    page?: number;
    page_size?: number;
}

export interface CreateStepRewardPayload {
    context_type: StepRewardContextType;
    context_id: string;
    base_points: number;
    bonus_conditions?: BonusCondition[];
    unlocked_badges?: string[];
    unlocked_content?: string[];
}

export type UpdateStepRewardPayload = Partial<
    Omit<CreateStepRewardPayload, "context_type" | "context_id">
>;

export interface RewardEvaluation {
    success: boolean;
    reward_id: string;
    base_points: number;
    bonus_points: number;
    total_points: number;
}

// ============================================================
// Section 14 — Progress Tracking (read-only)
// Backend: /api/v2/progress
// ============================================================

export interface MarkerVisit {
    marker_id: string | null;
    visited_at: string | null;
    is_quest_marker: boolean;
    points_earned: number;
}

// ExplorationProgress.to_public_dict() emits `id`.
export interface ExplorationProgress {
    id: string | null;
    user_id: string | null;
    quest_id: string | null;
    is_completed: boolean;
    completion_percentage: number;
    points_earned: number;
    hints_used: number;
    started_at: string | null;
    completed_at: string | null;
    total_time_taken: number | null;
    last_activity_at: string | null;
    markers_visited: MarkerVisit[];
    current_destination_marker_id: string | null;
    total_distance_covered: number | null;
    created_at: string | null;
    updated_at: string | null;
}

// GET /progress/{quest_id}/users — all users' progress (admin oversight).
export interface QuestProgressResponse {
    progress: ExplorationProgress[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

// ============================================================
// Section 6 — Financial: Transactions & Refunds
// Backend: /api/v2/transactions, /api/v2/refunds
// PII (customer_email/phone, card_last4) is masked SERVER-SIDE in
// Transaction.to_safe_dict() based on the caller's roles. Never attempt to
// unmask client-side; render whatever the API returns.
// ============================================================

export type TransactionStatus =
    | "pending"
    | "authorized"
    | "captured"
    | "failed"
    | "expired"
    | "refunded";

export type PaymentGateway = "razorpay" | "stripe" | "paypal";

export type PaymentType =
    | "quest_booking"
    | "premium_addon"
    | "top_up"
    | "subscription"
    | (string & {});

export interface PaymentMethodInfo {
    type?: "card" | "upi" | "netbanking" | string;
    card_last4?: string | null;
    card_network?: string | null;
    card_issuer?: string | null;
    upi_vpa?: string | null;
    bank_name?: string | null;
}

// Transaction (FinanceBaseModel.to_dict → emits `_id`). gateway_signature is
// always stripped server-side.
export interface Transaction {
    _id: string;
    order_id: string;
    gateway_order_id: string | null;
    gateway_payment_id: string | null;
    user_id: string;
    amount: number;
    currency: string;
    status: TransactionStatus;
    payment_gateway: PaymentGateway | string;
    description: string | null;
    metadata: Record<string, unknown> | null;
    payment_type: PaymentType | null;
    idempotency_key: string | null;
    payment_method: PaymentMethodInfo | null;
    razorpay_fee: number | null;
    razorpay_tax: number | null;
    customer_email: string | null; // masked unless caller ∈ {admin, super_admin}
    customer_phone: string | null; // masked unless caller ∈ {finance, admin, super_admin}
    quest_id: string | null;
    error_code: string | null;
    error_description: string | null;
    error_source: string | null;
    error_step: string | null;
    error_reason: string | null;
    is_deleted?: boolean;
    created_at: string;
    updated_at: string;
}

// GET /transactions/{id} returns the transaction fields FLAT alongside `success`
// (no `transaction` wrapper key).
export type TransactionDetail = Transaction;

export interface TransactionsListResponse {
    success: boolean;
    transactions: Transaction[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface ListTransactionsParams {
    status?: TransactionStatus | "";
    user_id?: string;
    payment_type?: string;
    page?: number;
    page_size?: number;
}

// Manual capture requires real Razorpay gateway params + transactions:create
// (only user/super_admin) AND caller-owns-the-transaction. Not usable by a
// plain admin acting on another user's order.
export interface CapturePaymentPayload {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

export type RefundStatus = "initiated" | "processing" | "completed" | "failed";
export type RefundType = "full" | "partial";
export type RefundSpeed = "normal" | "optimum";

// Refund (FinanceBaseModel.to_dict → emits `_id`).
export interface Refund {
    _id: string;
    transaction_id: string;
    user_id: string;
    amount: number;
    currency: string;
    reason: string;
    status: RefundStatus;
    gateway_refund_id: string | null;
    initiated_by: string | null;
    reviewed_by: string | null;
    failure_reason: string | null;
    acquirer_data: Record<string, unknown> | null;
    razorpay_speed: RefundSpeed | null;
    refund_type: RefundType | null;
    is_deleted?: boolean;
    created_at: string;
    updated_at: string;
}

export type RefundDetail = Refund;

export interface RefundsListResponse {
    success: boolean;
    refunds: Refund[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface ListRefundsParams {
    status?: RefundStatus | "";
    user_id?: string;
    page?: number;
    page_size?: number;
}

export interface InitiateRefundPayload {
    transaction_id: string;
    amount?: number; // omit for a full refund
    reason: string; // min 3 chars
}

export interface ApproveRefundPayload {
    speed?: RefundSpeed; // default "normal"
}

// Payment Events — immutable audit log. Backend: /api/v2/payment-events
// (finance/admin/super_admin, view-only). List returns NO `success` key.
export interface PaymentEvent {
    _id: string;
    event_type: string;
    source: string;
    transaction_id: string | null;
    refund_id: string | null;
    payout_id: string | null;
    razorpay_event_id: string | null;
    razorpay_event_type: string | null;
    payload: Record<string, unknown> | null;
    error: Record<string, unknown> | null;
    user_id: string | null;
    ip_address: string | null;
    created_at: string;
    updated_at: string;
}

export interface PaymentEventsListResponse {
    events: PaymentEvent[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface ListPaymentEventsParams {
    transaction_id?: string;
    refund_id?: string;
    payout_id?: string;
    event_type?: string;
    page?: number;
    page_size?: number;
}

// ============================================================
// Section 7 — Financial: Payout Accounts & Payouts
// Backend: /api/v2/payout-accounts, /api/v2/payouts
// NOTE: `AdminPayoutAccount` is the V2 admin shape — distinct from the V1
// `PayoutAccount` (creators feature). Bank/UPI values are masked server-side.
// ============================================================

export type PayoutAccountMethod = "bank_transfer" | "upi";
export type PayoutAccountStatus = "pending_verification" | "verified" | "rejected" | "disabled";

export interface PayoutBankDetails {
    account_number_masked: string | null;
    ifsc_code: string | null;
    bank_name: string | null;
}

// PayoutAccount.to_safe_dict() → emits `id` (not `_id`).
export interface AdminPayoutAccount {
    id: string;
    creator_id: string;
    method: PayoutAccountMethod;
    status: PayoutAccountStatus;
    is_primary: boolean;
    currency: string;
    account_holder_name: string | null;
    bank_details: PayoutBankDetails | null;
    upi_id: string | null;
    verified_by: string | null;
    verified_at: string | null;
    rejection_reason: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface PayoutAccountsListResponse {
    success: boolean;
    accounts: AdminPayoutAccount[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface ListPayoutAccountsParams {
    status?: PayoutAccountStatus | "";
    method?: PayoutAccountMethod | "";
    creator_id?: string;
    page?: number;
    page_size?: number;
}

export interface PayoutAccountBankInput {
    account_number?: string;
    ifsc_code?: string;
    bank_name?: string;
}

export interface CreatePayoutAccountPayload {
    method: PayoutAccountMethod;
    currency: string; // 3-letter ISO, e.g. "INR"
    account_holder_name?: string;
    bank_details?: PayoutAccountBankInput; // required when method === "bank_transfer"
    upi_id?: string; // required when method === "upi"
}

export interface UpdatePayoutAccountPayload {
    currency?: string;
    account_holder_name?: string;
    bank_details?: PayoutAccountBankInput;
    upi_id?: string;
}

export interface VerifyPayoutAccountPayload {
    action: "verify" | "reject";
    rejection_reason?: string; // used when action === "reject"
}

// Payouts — admin-initiated creator disbursements. Backend: /api/v2/payouts
// (Payout.to_safe_dict → emits `_id`; bank_account.account_number & upi_id masked).
export type PayoutStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";
export type PayoutMethod = "bank_transfer" | "upi" | "razorpay_x";

export interface Payout {
    _id: string;
    payout_reference: string;
    creator_id: string;
    initiated_by: string | null;
    amount: number;
    currency: string;
    status: PayoutStatus;
    payout_method: PayoutMethod | string;
    bank_account: Record<string, unknown> | null;
    upi_id: string | null;
    razorpay_payout_id: string | null;
    razorpay_fund_account_id: string | null;
    razorpay_contact_id: string | null;
    reference_number: string | null;
    period_start: string | null;
    period_end: string | null;
    earnings_snapshot: Record<string, unknown> | null;
    notes: string | null;
    failure_reason: string | null;
    processed_at: string | null;
    is_deleted?: boolean;
    created_at: string;
    updated_at: string | null;
}

// GET /payouts returns the result directly — NO `success` key.
export interface PayoutsListResponse {
    payouts: Payout[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface ListPayoutsParams {
    creator_id?: string;
    status?: PayoutStatus | "";
    page?: number;
    page_size?: number;
}

export interface InitiatePayoutPayload {
    creator_id: string;
    amount: number;
    currency?: string;
    payout_method?: PayoutMethod;
    payout_account_id?: string;
    bank_account?: Record<string, unknown>;
    upi_id?: string;
    period_start?: string;
    period_end?: string;
    notes?: string;
}

export interface ProcessPayoutPayload {
    reference_number: string; // UTR / NEFT reference, min 3 chars
}

export interface FailPayoutPayload {
    reason: string; // min 3 chars
}

// GET /payouts/creators/{creator_id}/summary — returned directly (no `success`).
export interface CreatorPayoutSummary {
    creator_id: string;
    total_earnings: number;
    total_paid: number;
    pending_balance: number;
    payouts: Payout[];
}

// ── Admin immersive experience (GET /quests/{id}/experience) ──
export interface ExperienceCoordinates { lat: number; lng: number }

export interface ExperienceTask {
    _id: string;
    task_type: string;
    title: string;
    description: string | null;
    quiz_data: { question: string; options: string[]; correct_answer: number } | null;
    collection_items: string[] | null;
    photo_requirements: Record<string, unknown> | null;
    qr_data: Record<string, unknown> | null;
    social_task: Record<string, unknown> | null;
    game_config: Record<string, unknown> | null;
    hints: { text: string; cost: number }[];
    base_points: number;
    marker_id: string | null;
}

export interface ExperienceMarker {
    marker_id: string;
    name: string | null;
    category: string | null;
    description: string | null;
    coordinates: ExperienceCoordinates | null;
    order: number | null;
    is_required: boolean;
    tags: string[];
    images: string[];
    things_to_do_text: string | null;
    things_to_do_image_url: string | null;
    address: string | null;
    opens_at: string | null;
    closes_at: string | null;
    min_expense: number | null;
    max_expense: number | null;
    website_url: string | null;
    contact: string | null;
    map_url: string | null;
    tasks: ExperienceTask[];
}

export interface ExperienceNarrative {
    id: string;
    title: string | null;
    subtitle: string | null;
    content: string | null;
    trigger_location: { type: "Point"; coordinates: [number, number] } | null;
    trigger_radius_m: number | null;
    voice_persona: string | null;
    audio_status: string | null;
    audio_url: string | null;
    media: string[];
    is_mandatory: boolean;
    sequence_order: number | null;
    attach_type: string;
    attach_id: string;
}

export interface ExperienceRegion {
    id: string;
    name: string | null;
    bbox: GeoPolygon | number[] | null;
    center_point: { type: "Point"; coordinates: [number, number] } | null;
    crowd_meter: Record<string, number>;
}

export interface ExperienceAchievement {
    id: string;
    name: string | null;
    icon_url: string | null;
    xp_reward: number | null;
}

export interface AdminQuestExperience {
    quest: Record<string, unknown>;
    markers: ExperienceMarker[];
    orphan_tasks: ExperienceTask[];
    narratives: ExperienceNarrative[];
    region: ExperienceRegion | null;
    achievement: ExperienceAchievement | null;
    start_point: { marker_id: string; name: string | null; lat: number | null; lng: number | null } | null;
}
