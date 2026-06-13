import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    Refund,
    RefundsListResponse,
    ListRefundsParams,
    InitiateRefundPayload,
    ApproveRefundPayload,
} from "@/types";

/**
 * Refunds — Section 6 Financial.
 * Backend: /api/v2/refunds.
 *  - LIST    → { success, refunds, total, page, page_size, total_pages } (refunds:view)
 *  - BY_ID   → { success, refund } (refunds:view)
 *  - INITIATE→ { success, refund } 201 (refunds:create) — only `captured` txns refundable
 *  - APPROVE → { success, refund } (refunds:manage) — MOVES MONEY, only `initiated` refunds
 */
export const refundsService = {
    list: async (params: ListRefundsParams = {}): Promise<RefundsListResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get(`${API_ENDPOINTS.REFUNDS.BASE}?${qs}`);
        return data;
    },

    getById: async (id: string): Promise<Refund> => {
        const { data } = await api.get(API_ENDPOINTS.REFUNDS.BY_ID(id));
        return data.refund;
    },

    initiate: async (payload: InitiateRefundPayload): Promise<Refund> => {
        const { data } = await api.post(API_ENDPOINTS.REFUNDS.BASE, payload);
        return data.refund;
    },

    approve: async (id: string, payload: ApproveRefundPayload = {}): Promise<Refund> => {
        const { data } = await api.post(API_ENDPOINTS.REFUNDS.APPROVE(id), payload);
        return data.refund;
    },
};
