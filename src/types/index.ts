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
    created_at: string;
    updated_at: string;
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
export type QuestDifficulty = "Easy" | "Medium" | "Hard" | "Expert";
export type QuestStatus =
    | "Draft"
    | "Under Review"
    | "Changes Requested"
    | "Approved"
    | "Published"
    | "Paused"
    | "Rejected"
    | "Archived";
export type QuestTheme = "Adventure" | "Romance" | "Culture" | "Food" | "History" | "Nature" | "Custom";

// Review history entry returned by the backend
export interface ReviewHistoryEntry {
    comment: string;
    reviewed_by?: string;   // Frontend expectation
    admin_id?: string;      // Backend raw data fallback
    status?: QuestStatus;
    reviewed_at?: string;   // Frontend expectation
    timestamp?: string;     // Backend raw data fallback
}

export interface QuestLocation {
    _id?: string;
    country?: string;
    region?: string;
    city?: string;
    latitude: number;
    longitude: number;
    address?: string;
    place_name?: string;
}

export interface QuestMetadata {
    _id?: string;
    title: string;
    description: string;
    difficulty: QuestDifficulty;
    duration_minutes?: number;
    theme?: string;
    tags?: string[];
}

export interface QuestMedia {
    _id?: string;
    cloudinary_assets: CloudinaryAsset[];
    video_url?: string;
    source_url?: string;
    source_reel_url?: string;
}

export interface QuestStep {
    _id?: string;
    quest_id?: string;
    order: number;
    title: string;
    description?: string;
    location: QuestLocation;
    points_reward?: number;
}

export interface Quest {
    _id: string;
    metadata_id: string;
    location_id: string;
    media_id: string;
    created_by: string;
    status: QuestStatus;
    price?: number;
    currency?: string;
    booking_enabled: boolean;
    created_at: string;
    updated_at: string;
}

export interface QuestWithDetails extends Quest {
    metadata?: QuestMetadata;
    location?: QuestLocation;
    media?: QuestMedia;
    steps?: QuestStep[];
}

// ---- Enriched Quest (from list endpoint) ----
export interface QuestListItem {
    _id: string;
    metadata_id: string;
    location_id: string;
    media_id: string;
    created_by: string;
    status: QuestStatus;
    price: number;
    currency: string | null;
    booking_enabled: boolean;
    view_count: number;
    is_deleted: boolean;
    deleted_at: string | null;
    schema_version: number;
    version: number;
    created_at: string;
    updated_at: string;
    // Enriched fields from list endpoint
    quest_title: string | null;
    quest_duration_minutes: number | null;
    quest_region: string | null;
    quest_image: string | null;
    quest_difficulty?: string | null;
    quest_theme?: string | null;
    creator_name?: string | null;
}

// Shape returned by the GET /api/v2/quests list endpoint (distinct from the
// full quest document used on the detail page). Verified against the live
// backend serializer — the list trims/renames fields vs the stored model.
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
    status: QuestStatus;
    view_count: number;
    average_rating: number | null;
    total_markers: number;
    completion_count: number;
    review_count: number;
    cloudinary_assets: unknown[];
    created_at: string;
}

// ---- Full Quest Detail Response (from GET /api/quests/:id) ----
export interface QuestDetailLocation {
    _id: string;
    region: string;
    start_location: { type: "Point"; coordinates: [number, number] };
    end_location: { type: "Point"; coordinates: [number, number] };
    route_waypoints: {
        order: number;
        location: { type: "Point"; coordinates: [number, number] };
        estimated_time_minutes: number | null;
        distance_from_previous_km: number | null;
    }[];
    map_data: {
        zoom_level: number;
        map_style: string;
    };
    route_geometry: { type: "LineString"; coordinates: number[][] } | null;
    created_at: string;
    updated_at: string;
}

export interface QuestDetailMetadata {
    _id: string;
    title: string;
    description: string[] | null;
    keywords: string[] | null;
    theme: QuestTheme;
    difficulty: QuestDifficulty;
    price: number;
    max_points: number;
    duration_minutes: number;
    hints_allowed: number;
    created_at: string;
    updated_at: string;
}

export interface QuestDetailMedia {
    _id: string;
    cloudinary_assets: CloudinaryAsset[];
    mapbox_reference: Record<string, string>;
    reel_url?: string | null;
    created_at: string;
    updated_at: string;
}

export interface QuestDetailStep {
    _id: string;
    quest_id: string;
    order: number;
    title: string;
    description: string;
    how_to_reach?: string | null;
    cloudinary_assets: CloudinaryAsset[];
    waypoint_order?: number | null;
    created_at: string;
    updated_at: string;
}

export interface QuestDetailCreator {
    _id: string;
    first_name: string;
    last_name: string;
    role: Array<string>;
    status: string;
    is_creator: boolean;
    created_at: string;
    updated_at: string;
}

// Narrative type for quest narrative management
export interface Narrative {
    _id: string;
    quest_id: string;
    from_step_id: string;
    to_step_id: string;
    from_step_order: number;
    to_step_order: number;
    title?: string;
    content: string;
    trigger_location?: { type: "Point"; coordinates: [number, number] };
    trigger_radius_m: number;
    media?: CloudinaryAsset[];
    is_mandatory: boolean;
    view_count: number;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface QuestDetailResponse {
    quest: QuestListItem;
    metadata: QuestDetailMetadata | null;
    location: QuestDetailLocation | null;
    media: QuestDetailMedia | null;
    steps: QuestDetailStep[];
    narratives: Narrative[];
    creator: QuestDetailCreator | null;
    review_history: ReviewHistoryEntry[];
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
    created_at: string | null;
    updated_at: string | null;
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
    sequence_order?: number;
    media?: string[];
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
