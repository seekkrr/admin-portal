import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    PaymentEvent,
    PaymentEventsListResponse,
    ListPaymentEventsParams,
} from "@/types";

/**
 * Payment Events — immutable audit log of every gateway / money-movement event.
 * Backend: /api/v2/payment-events (finance/admin/super_admin, view-only).
 * Note: the list endpoint returns the result WITHOUT a `success` wrapper.
 */
export const paymentEventsService = {
    list: async (
        params: ListPaymentEventsParams = {}
    ): Promise<PaymentEventsListResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get(`${API_ENDPOINTS.PAYMENT_EVENTS.BASE}?${qs}`);
        return data;
    },

    getById: async (id: string): Promise<PaymentEvent> => {
        const { data } = await api.get(API_ENDPOINTS.PAYMENT_EVENTS.BY_ID(id));
        return data.event;
    },
};
