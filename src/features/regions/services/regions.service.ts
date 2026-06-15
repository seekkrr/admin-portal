import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    Region,
    RegionsListResponse,
    RegionHotspotsResponse,
    ListRegionsParams,
    RegionMatrixResponse,
    UpdateRegionPayload,
    CreateRegionPayload,
} from "@/types";

export const regionsService = {
    list: async (params: ListRegionsParams = {}): Promise<RegionsListResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get<RegionsListResponse>(`${API_ENDPOINTS.REGIONS.BASE}?${qs}`);
        return data;
    },

    listAll: async (params: ListRegionsParams = {}): Promise<Region[]> => {
        let allRegions: Region[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const data = await regionsService.list({ ...params, page, page_size: 100 });
            if (data.regions && data.regions.length > 0) {
                allRegions = [...allRegions, ...data.regions];
            }
            if (page >= (data.total_pages || 1)) {
                hasMore = false;
            } else {
                page++;
            }
        }
        return allRegions;
    },

    search: async (q: string, page = 1, page_size = 20): Promise<RegionsListResponse> => {
        const qs = new URLSearchParams();
        qs.append("q", q);
        qs.append("page", String(page));
        qs.append("page_size", String(page_size));
        const { data } = await api.get<RegionsListResponse>(`${API_ENDPOINTS.REGIONS.SEARCH}?${qs}`);
        return data;
    },

    getById: async (id: string): Promise<Region> => {
        const { data } = await api.get<{ success: boolean; region: Region }>(API_ENDPOINTS.REGIONS.BY_ID(id));
        return data.region;
    },

    create: async (payload: CreateRegionPayload): Promise<Region> => {
        const { data } = await api.post<{ success: boolean; region: Region }>(API_ENDPOINTS.REGIONS.BASE, payload);
        return data.region;
    },

    update: async (id: string, payload: UpdateRegionPayload): Promise<Region> => {
        const { data } = await api.patch<{ success: boolean; region: Region }>(API_ENDPOINTS.REGIONS.BY_ID(id), payload);
        return data.region;
    },

    remove: async (id: string, hard = false): Promise<void> => {
        await api.delete(API_ENDPOINTS.REGIONS.BY_ID(id), { params: hard ? { hard: true } : undefined });
    },

    getHotspots: async (id: string, page = 1, page_size = 50): Promise<RegionHotspotsResponse> => {
        const qs = new URLSearchParams();
        qs.append("page", String(page));
        qs.append("page_size", String(page_size));
        const { data } = await api.get<RegionHotspotsResponse>(`${API_ENDPOINTS.REGIONS.HOTSPOTS(id)}?${qs}`);
        return data;
    },

    getCrowdMeter: async (id: string): Promise<Record<string, number>> => {
        const { data } = await api.get<{ success: boolean; crowd_meter: Record<string, number> }>(
            API_ENDPOINTS.REGIONS.CROWD_METER(id),
        );
        return data.crowd_meter;
    },

    updateCrowdMeter: async (id: string, month: string, value: number): Promise<Record<string, number>> => {
        const { data } = await api.patch<{ success: boolean; crowd_meter: Record<string, number> }>(
            API_ENDPOINTS.REGIONS.CROWD_METER(id),
            { month, value },
        );
        return data.crowd_meter;
    },

    setAdminWeight: async (id: string, weight: number): Promise<Region> => {
        const { data } = await api.patch<{ success: boolean; region: Region }>(
            API_ENDPOINTS.REGIONS.ADMIN_WEIGHT(id),
            { weight },
        );
        return data.region;
    },

    getMatrix: async (id: string): Promise<RegionMatrixResponse> => {
        const { data } = await api.get<RegionMatrixResponse>(API_ENDPOINTS.REGIONS.MATRIX(id));
        return data;
    },

    refreshMatrix: async (id: string): Promise<{ message: string; region_id: string }> => {
        const { data } = await api.post<{ message: string; region_id: string }>(
            API_ENDPOINTS.REGIONS.MATRIX_REFRESH(id),
        );
        return data;
    },

    attachQuest: async (regionId: string, questId: string): Promise<void> => {
        await api.post(API_ENDPOINTS.REGIONS.LINK_QUEST(regionId, questId));
    },

    detachQuest: async (regionId: string, questId: string): Promise<void> => {
        await api.delete(API_ENDPOINTS.REGIONS.LINK_QUEST(regionId, questId));
    },
};
