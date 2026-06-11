import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type { AdminReview, ReviewsListResponse, ListReviewsParams } from "@/types";

export const reviewsService = {
    list: async (params: ListReviewsParams = {}): Promise<ReviewsListResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get(`${API_ENDPOINTS.REVIEWS.BASE}?${qs}`);
        return data;
    },

    getById: async (id: string): Promise<AdminReview> => {
        const { data } = await api.get(API_ENDPOINTS.REVIEWS.BY_ID(id));
        return data.review;
    },

    moderate: async (id: string, isVisible: boolean): Promise<AdminReview> => {
        const { data } = await api.patch(API_ENDPOINTS.REVIEWS.MODERATE(id), { is_visible: isVisible });
        return data.review;
    },

    respond: async (id: string, response: string): Promise<AdminReview> => {
        const { data } = await api.post(API_ENDPOINTS.REVIEWS.RESPOND(id), { response });
        return data.review;
    },

    remove: async (id: string): Promise<void> => {
        await api.delete(API_ENDPOINTS.REVIEWS.BY_ID(id));
    },
};
