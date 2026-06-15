import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    Transaction,
    TransactionDetail,
    TransactionsListResponse,
    ListTransactionsParams,
    CapturePaymentPayload,
} from "@/types";

/**
 * Transactions — Section 6 Financial.
 * Backend: /api/v2/transactions (transactions:view to list/read).
 * PII fields are masked SERVER-SIDE based on caller role; render as returned.
 *
 * Notes on envelopes:
 *  - LIST  → { success, transactions, total, page, page_size, total_pages }
 *  - BY_ID → transaction fields returned FLAT alongside `success` (NO wrapper).
 *  - CAPTURE → flat transaction (manual gateway reconciliation, super_admin only).
 */
export const transactionsService = {
    list: async (
        params: ListTransactionsParams = {}
    ): Promise<TransactionsListResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get(`${API_ENDPOINTS.TRANSACTIONS.BASE}?${qs}`);
        return data;
    },

    getById: async (id: string): Promise<TransactionDetail> => {
        const { data } = await api.get(API_ENDPOINTS.TRANSACTIONS.BY_ID(id));
        // Fields come back flat alongside `success`; the extra boolean is harmless.
        return data as TransactionDetail;
    },

    capture: async (
        id: string,
        payload: CapturePaymentPayload
    ): Promise<Transaction> => {
        const { data } = await api.post(API_ENDPOINTS.TRANSACTIONS.CAPTURE(id), payload);
        return data as Transaction;
    },
};
