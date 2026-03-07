import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type { CreatorApplication } from "@/types";

export interface CreatorApplicationsListResponse {
    applications: CreatorApplication[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        total_pages: number;
    };
    pending_count: number;
}

export interface ListCreatorApplicationsParams {
    status?: "pending" | "approved" | "rejected";
    page?: number;
    limit?: number;
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
        const response = await api.get<CreatorApplicationsListResponse>(
            `${API_ENDPOINTS.CREATOR_APPLICATIONS.LIST}?${searchParams.toString()}`
        );
        return response.data;
    },

    /** Fetch a single creator application by id */
    getApplication: async (id: string): Promise<CreatorApplication> => {
        const response = await api.get<CreatorApplication>(
            API_ENDPOINTS.CREATOR_APPLICATIONS.BY_ID(id)
        );
        return response.data;
    },

    /** Approve a creator application */
    approveApplication: async (id: string): Promise<{ success: boolean; message: string; data?: any }> => {
        const response = await api.put<{ success: boolean; message: string; data?: any }>(
            API_ENDPOINTS.CREATOR_APPLICATIONS.APPROVE(id)
        );
        return response.data;
    },

    /** Reject a creator application */
    rejectApplication: async (
        id: string,
        reason: string
    ): Promise<{ success: boolean; message: string; data?: any }> => {
        const response = await api.put<{ success: boolean; message: string; data?: any }>(
            API_ENDPOINTS.CREATOR_APPLICATIONS.REJECT(id),
            { reason }
        );
        return response.data;
    },
};
