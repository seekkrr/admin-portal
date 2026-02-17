import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    User,
    CreatorDetailResponse,
    PayoutAccount,
    Creator,
} from "@/types";

// ---- Response Types ----

export interface CreatorsListResponse {
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

export interface ListCreatorsParams {
    q?: string;
    status?: string;
    role?: string;
    page?: number;
    per_page?: number;
}

// ---- Payout Request Types ----

export interface PayoutAccountRequest {
    method: "bank" | "upi" | "wallet";
    bank_details?: {
        account_number: number;
        ifsc_code: string;
        account_holder: string;
    };
    upi_id?: string;
    currency?: string;
}

// ---- Service ----

export const creatorsService = {
    /** Paginated list of creators (users with is_creator=true) */
    listCreators: async (
        params: ListCreatorsParams = {}
    ): Promise<CreatorsListResponse> => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== "") {
                searchParams.append(key, String(value));
            }
        });
        const response = await api.get<CreatorsListResponse>(
            `${API_ENDPOINTS.CREATORS.LIST}?${searchParams.toString()}`
        );
        return response.data;
    },

    /** Get detailed creator info (profile, stats, payout) */
    getCreatorDetails: async (
        userId: string
    ): Promise<CreatorDetailResponse> => {
        const response = await api.get<CreatorDetailResponse>(
            `${API_ENDPOINTS.CREATORS.BY_USER_ID(userId)}?include_stats=true&include_payout=true`
        );
        return response.data;
    },

    /** Update creator verification status (admin only) */
    updateCreatorStatus: async (
        userId: string,
        status: "pending" | "approved" | "rejected" | "suspended"
    ): Promise<Creator> => {
        const response = await api.patch<Creator>(
            API_ENDPOINTS.CREATORS.STATUS(userId),
            { status }
        );
        return response.data;
    },

    /** Add a payout account for a creator */
    addPayoutAccount: async (
        userId: string,
        data: PayoutAccountRequest
    ): Promise<PayoutAccount> => {
        const response = await api.post<PayoutAccount>(
            API_ENDPOINTS.CREATORS.PAYOUT(userId),
            data
        );
        return response.data;
    },

    /** Update an existing payout account */
    updatePayoutAccount: async (
        userId: string,
        data: PayoutAccountRequest
    ): Promise<PayoutAccount> => {
        const response = await api.put<PayoutAccount>(
            API_ENDPOINTS.CREATORS.UPDATE_PAYOUT(userId),
            data
        );
        return response.data;
    },

    /** Delete a user (shared with users) */
    deleteUser: async (userId: string, hard: boolean = false): Promise<void> => {
        const query = hard ? "?soft=false" : "";
        await api.delete(
            `${API_ENDPOINTS.CORE.USER_BY_ID(userId)}${query}`
        );
    },

    /** Bulk suspend/delete (shared with users) */
    bulkAction: async (
        userIds: string[],
        action: "suspend" | "delete"
    ): Promise<BulkActionResponse> => {
        const response = await api.post<BulkActionResponse>(
            API_ENDPOINTS.CORE.BULK_ACTION,
            { user_ids: userIds, action }
        );
        return response.data;
    },
};
