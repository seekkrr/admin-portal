import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type { LeaderboardResponse, RecomputeResponse } from "@/types";

function boardQuery(page: number, page_size: number): string {
    const qs = new URLSearchParams();
    qs.append("page", String(page));
    qs.append("page_size", String(page_size));
    return qs.toString();
}

export const leaderboardsService = {
    global: async (page = 1, page_size = 20): Promise<LeaderboardResponse> => {
        const { data } = await api.get<LeaderboardResponse>(
            `${API_ENDPOINTS.LEADERBOARDS.GLOBAL}?${boardQuery(page, page_size)}`,
        );
        return data;
    },

    quest: async (questId: string, page = 1, page_size = 20): Promise<LeaderboardResponse> => {
        const { data } = await api.get<LeaderboardResponse>(
            `${API_ENDPOINTS.LEADERBOARDS.BY_QUEST(questId)}?${boardQuery(page, page_size)}`,
        );
        return data;
    },

    region: async (regionId: string, page = 1, page_size = 20): Promise<LeaderboardResponse> => {
        const { data } = await api.get<LeaderboardResponse>(
            `${API_ENDPOINTS.LEADERBOARDS.BY_REGION(regionId)}?${boardQuery(page, page_size)}`,
        );
        return data;
    },

    recomputeRegion: async (regionId: string): Promise<RecomputeResponse> => {
        const { data } = await api.post<RecomputeResponse>(
            API_ENDPOINTS.LEADERBOARDS.REGION_RECOMPUTE(regionId),
        );
        return data;
    },

    recomputeGlobal: async (): Promise<RecomputeResponse> => {
        const { data } = await api.post<RecomputeResponse>(
            API_ENDPOINTS.LEADERBOARDS.GLOBAL_RECOMPUTE,
        );
        return data;
    },
};
