import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type { User } from "@/types";

// ---- Response Types ----

export interface UsersListResponse {
    users: User[];
    pagination: {
        total: number;
        page: number;
        per_page: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
        next_page: number | null;
        prev_page: number | null;
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
    is_creator?: string;
    page?: number;
    per_page?: number;
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
        const response = await api.get<UsersListResponse>(
            `${API_ENDPOINTS.CORE.USERS}?${searchParams.toString()}`
        );
        return response.data;
    },

    updateUserRole: async (userId: string, role: string): Promise<User> => {
        const response = await api.put<User>(
            API_ENDPOINTS.CORE.USER_BY_ID(userId),
            { role }
        );
        return response.data;
    },

    deleteUser: async (userId: string, hard: boolean = false): Promise<void> => {
        const query = hard ? "?soft=false" : "";
        await api.delete(`${API_ENDPOINTS.CORE.USER_BY_ID(userId)}${query}`);
    },

    bulkAction: async (userIds: string[], action: "suspend" | "delete"): Promise<BulkActionResponse> => {
        const response = await api.post<BulkActionResponse>(
            API_ENDPOINTS.CORE.BULK_ACTION,
            { user_ids: userIds, action }
        );
        return response.data;
    },
};
