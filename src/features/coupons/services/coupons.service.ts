import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    Coupon,
    CouponsListResponse,
    ListCouponsParams,
    CreateCouponPayload,
    UpdateCouponPayload,
    CouponRedemptionsListResponse,
    ListCouponRedemptionsParams,
} from "@/types";

/**
 * Coupons — discount codes.
 * Backend: /api/v2/coupons. Create/update/delete require admin/super_admin;
 * list/get also allow finance to view (read-only).
 */
export const couponsService = {
    list: async (params: ListCouponsParams = {}): Promise<CouponsListResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get<CouponsListResponse>(`${API_ENDPOINTS.COUPONS.BASE}?${qs}`);
        return data;
    },

    getById: async (id: string): Promise<Coupon> => {
        const { data } = await api.get<{ success: boolean; coupon: Coupon }>(
            API_ENDPOINTS.COUPONS.BY_ID(id)
        );
        return data.coupon;
    },

    create: async (payload: CreateCouponPayload): Promise<Coupon> => {
        const { data } = await api.post<{ success: boolean; coupon: Coupon }>(
            API_ENDPOINTS.COUPONS.BASE,
            payload
        );
        return data.coupon;
    },

    update: async (id: string, payload: UpdateCouponPayload): Promise<Coupon> => {
        const { data } = await api.patch<{ success: boolean; coupon: Coupon }>(
            API_ENDPOINTS.COUPONS.BY_ID(id),
            payload
        );
        return data.coupon;
    },

    // Soft delete.
    remove: async (id: string): Promise<void> => {
        await api.delete(API_ENDPOINTS.COUPONS.BY_ID(id));
    },

    listRedemptions: async (
        id: string,
        params: ListCouponRedemptionsParams = {}
    ): Promise<CouponRedemptionsListResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get<CouponRedemptionsListResponse>(
            `${API_ENDPOINTS.COUPONS.REDEMPTIONS(id)}?${qs}`
        );
        return data;
    },
};
