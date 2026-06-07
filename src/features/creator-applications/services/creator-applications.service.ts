import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type { CreatorApplication } from "@/types";

export interface CreatorApplicationsListResponse {
    applications: CreatorApplication[];
    pagination: {
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
    };
    pending_count: number;
}

export interface ListCreatorApplicationsParams {
    status?: "pending" | "verifying" | "approved" | "rejected";
    search?: string;
    page?: number;
    page_size?: number;
}

export const creatorApplicationsService = {
    /** List all creator applications with optional filters */
    listApplications: async (
        params: ListCreatorApplicationsParams = {}
    ): Promise<CreatorApplicationsListResponse> => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== "") {
                searchParams.append(key, String(value));
            }
        });
        const raw = (await api.get<Record<string, unknown>>(
            `${API_ENDPOINTS.CREATOR_APPLICATIONS.LIST}?${searchParams.toString()}`
        )).data as any;
        return {
            applications: raw.applications ?? [],
            pagination: {
                total: raw.total ?? 0,
                page: raw.page ?? 1,
                page_size: raw.page_size ?? 20,
                total_pages: raw.total_pages ?? 1,
            },
            pending_count: raw.pending_count ?? 0,
        };
    },

    /** Fetch a single creator application by id */
    getApplication: async (id: string): Promise<CreatorApplication> => {
        const response = await api.get<{ success: boolean; application: CreatorApplication }>(
            API_ENDPOINTS.CREATOR_APPLICATIONS.BY_ID(id)
        );
        return response.data.application;
    },

    /** Approve a creator application */
    approveApplication: async (id: string): Promise<{ success: boolean; application: CreatorApplication }> => {
        const response = await api.post<{ success: boolean; application: CreatorApplication }>(
            API_ENDPOINTS.CREATOR_APPLICATIONS.APPROVE(id)
        );
        return response.data;
    },

    /** Reject a creator application */
    rejectApplication: async (
        id: string,
        reason?: string
    ): Promise<{ success: boolean; application: CreatorApplication }> => {
        const response = await api.post<{ success: boolean; application: CreatorApplication }>(
            API_ENDPOINTS.CREATOR_APPLICATIONS.REJECT(id),
            { reason }
        );
        return response.data;
    },

    /** Delete a creator application (hard=true for permanent, super_admin only) */
    deleteApplication: async (
        id: string,
        hard: boolean = false
    ): Promise<{ success: boolean; deleted: boolean }> => {
        const response = await api.delete<{ success: boolean; deleted: boolean }>(
            `${API_ENDPOINTS.CREATOR_APPLICATIONS.DELETE(id)}?hard=${hard}`
        );
        return response.data;
    },
};
