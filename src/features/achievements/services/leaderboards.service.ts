import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type { LeaderboardEntry, LeaderboardResponse, RecomputeResponse } from "@/types";

/** The three competition boards (GET /leaderboards/competition/<kind>). */
export type CompetitionKind = "explorer" | "creator" | "crowd-favorite";

/** A competition row: a leaderboard entry, plus the place for "crowd favourite". */
export interface CompetitionEntry extends Omit<LeaderboardEntry, "type"> {
    type: string | null;
    marker_id?: string | null;
    marker_name?: string | null;
    marker_image?: string | null;
}

export interface CompetitionResponse extends Omit<LeaderboardResponse, "entries"> {
    entries: CompetitionEntry[];
}

const COMPETITION_PATH: Record<CompetitionKind, string> = {
    explorer: API_ENDPOINTS.COMPETITIONS.EXPLORER,
    creator: API_ENDPOINTS.COMPETITIONS.CREATOR,
    "crowd-favorite": API_ENDPOINTS.COMPETITIONS.CROWD_FAVORITE,
};

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
            API_ENDPOINTS.LEADERBOARDS.BY_QUEST(encodeURIComponent(questId)) + "?" + boardQuery(page, page_size),
        );
        return data;
    },

    region: async (regionId: string, page = 1, page_size = 20): Promise<LeaderboardResponse> => {
        const { data } = await api.get<LeaderboardResponse>(
            API_ENDPOINTS.LEADERBOARDS.BY_REGION(encodeURIComponent(regionId)) + "?" + boardQuery(page, page_size),
        );
        return data;
    },

    recomputeRegion: async (regionId: string): Promise<RecomputeResponse> => {
        const { data } = await api.post<RecomputeResponse>(
            API_ENDPOINTS.LEADERBOARDS.REGION_RECOMPUTE(regionId),
        );
        return data;
    },

    competition: async (kind: CompetitionKind, page = 1, page_size = 20): Promise<CompetitionResponse> => {
        const { data } = await api.get<CompetitionResponse>(`${COMPETITION_PATH[kind]}?${boardQuery(page, page_size)}`);
        return data;
    },

    /** Queues a rebuild of the competition boards (admin, super_admin). */
    recomputeCompetitions: async (): Promise<{ success?: boolean; message?: string }> => {
        const { data } = await api.post<{ success?: boolean; message?: string }>(API_ENDPOINTS.COMPETITIONS.RECOMPUTE);
        return data;
    },

    recomputeGlobal: async (): Promise<RecomputeResponse> => {
        const { data } = await api.post<RecomputeResponse>(
            API_ENDPOINTS.LEADERBOARDS.GLOBAL_RECOMPUTE,
        );
        return data;
    },
};
