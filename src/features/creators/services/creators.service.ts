import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type { Creator } from "@/types";

// ---- Response Types ----

export interface CreatorEnriched {
    id: string;
    user_id: string;
    status: "active" | "suspended" | "rejected";
    is_verified: boolean;
    tagline?: string | null;
    creator_bio?: string | null;
    creator_badge?: Record<string, unknown> | null;
    total_quests: number;
    total_earnings: number;
    pending_payouts: number;
    travelers_served: number;
    rating: number | null;
    top_themes: string[] | null;
    review_count: number;
    quest_ids: string[];
    stats_last_updated: string | null;
    name?: string | null;
    avatar_url?: string | null;
    hobbies?: string[];
    created_at: string;
    updated_at: string;
}

export interface CreatorsListResponse {
    creators: CreatorEnriched[];
    pagination: {
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
    };
}

export interface CreatorPlatformStats {
    total_creators: number;
    total_earnings: number;
    total_quests: number;
    total_travelers: number;
    avg_rating: number | null;
    verified_creators: number;
    by_status: Record<string, number>;
}

// ---- Query Params ----

export interface ListCreatorsParams {
    search?: string;
    status?: string;
    is_verified?: boolean;
    page?: number;
    page_size?: number;
}

// ---- Creator Stats Update ----

export interface CreatorStatsUpdateRequest {
    total_quests?: number;
    total_earnings?: number;
    pending_payouts?: number;
    travelers_served?: number;
    rating?: number;
    top_themes?: string[];
}

// ---- Service ----

export const creatorsService = {
    /** Paginated list of creators */
    listCreators: async (params: ListCreatorsParams = {}): Promise<CreatorsListResponse> => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== "") {
                searchParams.append(key, String(value));
            }
        });
        const response = await api.get<{
            success: boolean;
            creators: CreatorEnriched[];
            total: number;
            page: number;
            page_size: number;
            total_pages: number;
        }>(`${API_ENDPOINTS.CREATORS.LIST}?${searchParams.toString()}`);
        const raw = response.data;
        return {
            creators: raw.creators,
            pagination: {
                total: raw.total,
                page: raw.page,
                page_size: raw.page_size,
                total_pages: raw.total_pages,
                has_next: raw.page < raw.total_pages,
                has_prev: raw.page > 1,
            },
        };
    },

    /** Platform-wide creator statistics */
    getPlatformStats: async (): Promise<CreatorPlatformStats> => {
        const response = await api.get<{ success: boolean; stats: CreatorPlatformStats }>(
            API_ENDPOINTS.CREATORS.PLATFORM_STATS
        );
        return response.data.stats;
    },

    /** Get enriched creator profile by creator ID */
    getCreator: async (creatorId: string): Promise<CreatorEnriched> => {
        const response = await api.get<{ success: boolean; creator: CreatorEnriched }>(
            API_ENDPOINTS.CREATORS.BY_ID(creatorId)
        );
        return response.data.creator;
    },

    /** Admin update creator (status, is_verified, profile fields) */
    updateCreator: async (
        creatorId: string,
        updates: { status?: string; is_verified?: boolean; tagline?: string; creator_bio?: string }
    ): Promise<Creator> => {
        const response = await api.put<{ success: boolean; creator: Creator }>(
            API_ENDPOINTS.CREATORS.UPDATE(creatorId),
            updates
        );
        return response.data.creator;
    },

    /** Admin update creator stats (earnings, payout, rating, etc.) */
    updateCreatorStats: async (
        creatorId: string,
        stats: CreatorStatsUpdateRequest
    ): Promise<Creator> => {
        const response = await api.post<{ success: boolean; creator: Creator }>(
            API_ENDPOINTS.CREATORS.STATS_UPDATE(creatorId),
            stats
        );
        return response.data.creator;
    },

    /** Direct provision — bypass application workflow */
    provisionCreator: async (userId: string): Promise<Creator> => {
        const response = await api.post<{ success: boolean; creator: Creator }>(
            API_ENDPOINTS.CREATORS.PROVISION(userId)
        );
        return response.data.creator;
    },
};
