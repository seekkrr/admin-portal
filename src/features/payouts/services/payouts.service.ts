import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    Payout,
    PayoutsListResponse,
    ListPayoutsParams,
    InitiatePayoutPayload,
    ProcessPayoutPayload,
    FailPayoutPayload,
    CreatorPayoutSummary,
} from "@/types";

/**
 * Service for the V2 admin-initiated creator disbursements API.
 * NOTE: GET list and creator-summary endpoints return their payload directly
 * (NO `success` envelope key); the by-id / action endpoints wrap in
 * `{ success, payout }`.
 */
export const payoutsService = {
    list: async (params: ListPayoutsParams = {}): Promise<PayoutsListResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get(`${API_ENDPOINTS.PAYOUTS.BASE}?${qs}`);
        return data;
    },

    getById: async (id: string): Promise<Payout> => {
        const { data } = await api.get(API_ENDPOINTS.PAYOUTS.BY_ID(id));
        return data.payout;
    },

    initiate: async (payload: InitiatePayoutPayload): Promise<Payout> => {
        const { data } = await api.post(API_ENDPOINTS.PAYOUTS.BASE, payload);
        return data.payout;
    },

    process: async (id: string, payload: ProcessPayoutPayload): Promise<Payout> => {
        const { data } = await api.patch(API_ENDPOINTS.PAYOUTS.PROCESS(id), payload);
        return data.payout;
    },

    fail: async (id: string, payload: FailPayoutPayload): Promise<Payout> => {
        const { data } = await api.patch(API_ENDPOINTS.PAYOUTS.FAIL(id), payload);
        return data.payout;
    },

    cancel: async (id: string): Promise<Payout> => {
        const { data } = await api.patch(API_ENDPOINTS.PAYOUTS.CANCEL(id));
        return data.payout;
    },

    creatorSummary: async (creatorId: string): Promise<CreatorPayoutSummary> => {
        const { data } = await api.get(API_ENDPOINTS.PAYOUTS.CREATOR_SUMMARY(creatorId));
        return data;
    },
};
