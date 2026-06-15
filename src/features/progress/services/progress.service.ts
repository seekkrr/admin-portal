import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type { QuestProgressResponse } from "@/types";

export const progressService = {
    questUsers: async (
        questId: string,
        page = 1,
        page_size = 20,
    ): Promise<QuestProgressResponse> => {
        const { data } = await api.get<QuestProgressResponse>(
            API_ENDPOINTS.PROGRESS.BY_QUEST_USERS(questId),
            { params: { page, page_size } },
        );
        return data;
    },
};
