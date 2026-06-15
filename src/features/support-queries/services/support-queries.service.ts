import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    SupportQuery,
    ListSupportQueriesParams,
    SupportQueriesResponse
} from "@/types";

export const supportQueriesService = {
    list: async (params: ListSupportQueriesParams = {}): Promise<SupportQueriesResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get(`${API_ENDPOINTS.SUPPORT_QUERIES.BASE}?${qs}`);
        return data;
    },
    getById: async (id: string): Promise<SupportQuery> => {
        const { data } = await api.get(API_ENDPOINTS.SUPPORT_QUERIES.BY_ID(id));
        return data;
    },
    deleteQuery: async (id: string): Promise<void> => {
        await api.delete(API_ENDPOINTS.SUPPORT_QUERIES.BY_ID(id));
    },
    bulkDelete: async (queryIds: string[]): Promise<{ deleted: number }> => {
        const { data } = await api.post(API_ENDPOINTS.SUPPORT_QUERIES.BULK_DELETE, { query_ids: queryIds });
        return data;
    }
};
