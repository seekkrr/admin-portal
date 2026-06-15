import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    AdminPayoutAccount,
    PayoutAccountsListResponse,
    ListPayoutAccountsParams,
    CreatePayoutAccountPayload,
    UpdatePayoutAccountPayload,
    VerifyPayoutAccountPayload,
} from "@/types";

/**
 * Service for the V2 admin payout-accounts API (creator bank/UPI accounts
 * under admin/finance oversight). Bank numbers & UPI ids are masked
 * server-side — this layer never attempts to unmask them.
 */
export const payoutAccountsService = {
    list: async (
        params: ListPayoutAccountsParams = {}
    ): Promise<PayoutAccountsListResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get(`${API_ENDPOINTS.PAYOUT_ACCOUNTS.LIST}?${qs}`);
        return data;
    },

    getById: async (id: string): Promise<AdminPayoutAccount> => {
        const { data } = await api.get(API_ENDPOINTS.PAYOUT_ACCOUNTS.BY_ID(id));
        return data.account;
    },

    create: async (payload: CreatePayoutAccountPayload): Promise<AdminPayoutAccount> => {
        const { data } = await api.post(API_ENDPOINTS.PAYOUT_ACCOUNTS.CREATE, payload);
        return data.account;
    },

    update: async (
        id: string,
        payload: UpdatePayoutAccountPayload
    ): Promise<AdminPayoutAccount> => {
        const { data } = await api.put(API_ENDPOINTS.PAYOUT_ACCOUNTS.UPDATE(id), payload);
        return data.account;
    },

    remove: async (id: string, hard = false): Promise<void> => {
        await api.delete(API_ENDPOINTS.PAYOUT_ACCOUNTS.DELETE(id), {
            params: hard ? { hard: true } : undefined,
        });
    },

    setPrimary: async (id: string): Promise<AdminPayoutAccount> => {
        const { data } = await api.post(API_ENDPOINTS.PAYOUT_ACCOUNTS.SET_PRIMARY(id));
        return data.account;
    },

    verify: async (
        id: string,
        payload: VerifyPayoutAccountPayload
    ): Promise<AdminPayoutAccount> => {
        const { data } = await api.put(API_ENDPOINTS.PAYOUT_ACCOUNTS.VERIFY(id), payload);
        return data.account;
    },
};
