import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type { User } from "@/types";
import { rolesForTarget } from "../roles";

// ---- Response Types ----

export interface UsersListResponse {
    users: User[];
    pagination: {
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
        next_page: number | null;
        prev_page: number | null;
    };
}

export interface UserStatsResponse {
    total: number;
    by_status: Record<string, number>;
    creators: number;
    creators_by_status?: {
        active?: number;
        suspended?: number;
        rejected?: number;
    };
    by_role: Record<string, number>;
    new_last_7_days: number;
    recent_signups: Array<{ _id: string; email: string; first_name: string; last_name: string; created_at: string }>;
}

export interface ExplorationProfilesResponse {
    profiles: Array<{
        user_id: string;
        preferred_pace?: string;
        preferred_transport?: string;
        preferred_categories?: Record<string, number>;
        preferred_difficulty?: string;
        total_visits: number;
        total_quests: number;
        current_streak: number;
    }>;
    pagination: {
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
    };
}

export interface BulkActionResponse {
    action: string;
    succeeded: string[];
    failed: { user_id: string; reason: string }[];
    summary: string;
}

// ---- Query Params ----

export interface ListUsersParams {
    q?: string;
    status?: string;
    role?: string;
    is_creator?: boolean | string;
    page?: number;
    page_size?: number;
    sort_by?: string;
    sort_order?: number;
}

export interface ListExplorationProfilesParams {
    page?: number;
    page_size?: number;
}

// ---- Service ----

export const usersService = {
    listUsers: async (params: ListUsersParams = {}): Promise<UsersListResponse> => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== "") {
                searchParams.append(key, String(value));
            }
        });
        const response = await api.get<{
            success: boolean;
            users: User[];
            total: number;
            page: number;
            page_size: number;
            total_pages: number;
        }>(`${API_ENDPOINTS.CORE.USERS}?${searchParams.toString()}`);
        const raw = response.data;
        return {
            users: raw.users,
            pagination: {
                total: raw.total,
                page: raw.page,
                page_size: raw.page_size,
                total_pages: raw.total_pages,
                has_next: raw.page < raw.total_pages,
                has_prev: raw.page > 1,
                next_page: raw.page < raw.total_pages ? raw.page + 1 : null,
                prev_page: raw.page > 1 ? raw.page - 1 : null,
            },
        };
    },

    getUserStats: async (): Promise<UserStatsResponse> => {
        const response = await api.get<{ success: boolean } & UserStatsResponse>(
            API_ENDPOINTS.CORE.USER_STATS
        );
        return response.data;
    },

    getExplorationProfiles: async (params: ListExplorationProfilesParams = {}): Promise<ExplorationProfilesResponse> => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) searchParams.append(key, String(value));
        });
        const response = await api.get<{ success: boolean } & ExplorationProfilesResponse>(
            `${API_ENDPOINTS.CORE.USER_EXPLORATION_PROFILES}?${searchParams.toString()}`
        );
        return response.data;
    },

    getUser: async (userId: string): Promise<User> => {
        const response = await api.get<{ success: boolean; user: User }>(
            API_ENDPOINTS.CORE.USER_BY_ID(userId)
        );
        return response.data.user;
    },

    updateUser: async (userId: string, updates: Partial<User>): Promise<User> => {
        const response = await api.put<{ success: boolean; user: User }>(
            API_ENDPOINTS.CORE.USER_BY_ID(userId),
            updates
        );
        return response.data.user;
    },

    updateUserRole: async (userId: string, target: string, current: string[] = []): Promise<User> => {
        // Send the full cumulative ladder, not just the picked tier — replacing
        // the array with a single role would drop "user" and any lower tiers.
        const response = await api.put<{ success: boolean; user: User }>(
            API_ENDPOINTS.CORE.USER_BY_ID(userId),
            { role: rolesForTarget(target, current) }
        );
        return response.data.user;
    },

    deleteUser: async (userId: string, hard: boolean = false): Promise<void> => {
        await api.delete(`${API_ENDPOINTS.CORE.USER_BY_ID(userId)}?soft=${!hard}`);
    },

    bulkAction: async (userIds: string[], action: "suspend" | "delete"): Promise<BulkActionResponse> => {
        const response = await api.post<{ success: boolean } & BulkActionResponse>(
            API_ENDPOINTS.CORE.BULK_ACTION,
            { user_ids: userIds, action }
        );
        return response.data;
    },

    addPoints: async (userId: string, amount: number): Promise<{ user_id: string; points_earned: number }> => {
        const response = await api.post<{ success: boolean; user_id: string; points_earned: number }>(
            API_ENDPOINTS.CORE.USER_POINTS_ADD(userId),
            { amount }
        );
        return response.data;
    },

    deductPoints: async (userId: string, amount: number): Promise<{ user_id: string; points_earned: number }> => {
        const response = await api.post<{ success: boolean; user_id: string; points_earned: number }>(
            API_ENDPOINTS.CORE.USER_POINTS_DEDUCT(userId),
            { amount }
        );
        return response.data;
    },

    promoteToCreator: async (userId: string): Promise<User> => {
        const response = await api.post<{ success: boolean; user: User }>(
            API_ENDPOINTS.CORE.USER_PROMOTE_CREATOR(userId)
        );
        return response.data.user;
    },
};
