import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    Achievement,
    AchievementsListResponse,
    ListAchievementsParams,
    CreateAchievementPayload,
    UpdateAchievementPayload,
    ExplorerLevel,
    ExplorerLevelsResponse,
    UserAchievement,
    UserAchievementsResponse,
} from "@/types";

export const achievementsService = {
    list: async (params: ListAchievementsParams = {}): Promise<AchievementsListResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get<AchievementsListResponse>(
            `${API_ENDPOINTS.ACHIEVEMENTS.BASE}?${qs}`,
        );
        return data;
    },

    getById: async (id: string): Promise<Achievement> => {
        const { data } = await api.get<{ success: boolean; achievement: Achievement }>(
            API_ENDPOINTS.ACHIEVEMENTS.BY_ID(id),
        );
        return data.achievement;
    },

    create: async (payload: CreateAchievementPayload): Promise<Achievement> => {
        const { data } = await api.post<{ success: boolean; achievement: Achievement }>(
            API_ENDPOINTS.ACHIEVEMENTS.BASE,
            payload,
        );
        return data.achievement;
    },

    update: async (id: string, payload: UpdateAchievementPayload): Promise<Achievement> => {
        const { data } = await api.put<{ success: boolean; achievement: Achievement }>(
            API_ENDPOINTS.ACHIEVEMENTS.BY_ID(id),
            payload,
        );
        return data.achievement;
    },

    remove: async (id: string, hard = false): Promise<void> => {
        await api.delete(API_ENDPOINTS.ACHIEVEMENTS.BY_ID(id), {
            params: hard ? { hard: true } : undefined,
        });
    },

    explorerLevels: async (): Promise<ExplorerLevel[]> => {
        const { data } = await api.get<ExplorerLevelsResponse>(
            API_ENDPOINTS.ACHIEVEMENTS.EXPLORER_LEVELS,
        );
        return data.explorer_levels;
    },

    userEarned: async (userId: string): Promise<UserAchievement[]> => {
        const { data } = await api.get<UserAchievementsResponse>(
            API_ENDPOINTS.ACHIEVEMENTS.USER_EARNED(encodeURIComponent(userId)),
        );
        return data.user_achievements;
    },
};
