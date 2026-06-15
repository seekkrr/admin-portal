import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    Marker,
    MarkerApplication,
    MarkersListResponse,
    MarkerApplicationsListResponse,
    ListMarkersParams,
    CreateMarkerPayload,
    UpdateMarkerPayload,
} from "@/types";

export interface ListMarkerApplicationsParams {
    status?: string;
    page?: number;
    page_size?: number;
}

export const markersService = {
    list: async (params: ListMarkersParams = {}): Promise<MarkersListResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get(`${API_ENDPOINTS.MARKERS.BASE}?${qs}`);
        return data;
    },

    getById: async (id: string): Promise<Marker> => {
        const { data } = await api.get(API_ENDPOINTS.MARKERS.BY_ID(id));
        return data.marker;
    },

    create: async (payload: CreateMarkerPayload): Promise<Marker> => {
        const { data } = await api.post(API_ENDPOINTS.MARKERS.BASE, payload);
        return data.marker;
    },

    update: async (id: string, payload: UpdateMarkerPayload): Promise<Marker> => {
        const { data } = await api.put(API_ENDPOINTS.MARKERS.BY_ID(id), payload);
        return data.marker;
    },

    remove: async (id: string, hard = false): Promise<void> => {
        await api.delete(API_ENDPOINTS.MARKERS.BY_ID(id), { params: hard ? { hard: true } : undefined });
    },

    listApplications: async (
        params: ListMarkerApplicationsParams = {}
    ): Promise<MarkerApplicationsListResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get(`${API_ENDPOINTS.MARKERS.APPLICATIONS}?${qs}`);
        return data;
    },

    getApplication: async (id: string): Promise<MarkerApplication> => {
        const { data } = await api.get(API_ENDPOINTS.MARKERS.APPLICATION_BY_ID(id));
        return data.application;
    },

    approveApplication: async (id: string): Promise<MarkerApplication> => {
        const { data } = await api.post(API_ENDPOINTS.MARKERS.APPLICATION_APPROVE(id));
        return data.application;
    },

    rejectApplication: async (id: string, reason?: string): Promise<MarkerApplication> => {
        const { data } = await api.post(API_ENDPOINTS.MARKERS.APPLICATION_REJECT(id), {
            rejection_reason: reason,
        });
        return data.application;
    },
};
