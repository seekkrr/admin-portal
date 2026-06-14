import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    QuestListEntry,
    V2QuestDetail,
    QuestReviewRecord,
    UpdateQuestPayload,
} from "@/types";

// ---- List params ----
export interface ListQuestsParams {
    q?: string;
    status?: string;
    statuses?: string;
    difficulty?: string;
    theme?: string;
    region?: string;
    page?: number;
    per_page?: number;
}

export interface QuestsListResponse {
    quests: QuestListEntry[];
    pagination: {
        total: number;
        page: number;
        per_page: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
        next_page: number | null;
        prev_page: number | null;
    };
}

// Frontend param name -> backend query param name
const PARAM_MAP: Record<string, string> = {
    q: "search",
    region: "region_id",
    per_page: "page_size",
};

type RawListResponse = {
    quests?: QuestListEntry[];
    total?: number;
    page?: number;
    page_size?: number;
    total_pages?: number;
};

function buildPagination(raw: RawListResponse): QuestsListResponse["pagination"] {
    const page = raw.page ?? 1;
    const total_pages = raw.total_pages ?? 1;
    return {
        total: raw.total ?? 0,
        page,
        per_page: raw.page_size ?? 20,
        total_pages,
        has_next: page < total_pages,
        has_prev: page > 1,
        next_page: page < total_pages ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null,
    };
}

export const questsService = {
    /** Paginated + filtered list of all quests */
    listQuests: async (params: ListQuestsParams = {}): Promise<QuestsListResponse> => {
        const sp = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") sp.append(PARAM_MAP[k] ?? k, String(v));
        });
        const { data } = await api.get<RawListResponse>(
            `${API_ENDPOINTS.QUESTS.BASE}?${sp.toString()}`
        );
        return { quests: data.quests ?? [], pagination: buildPagination(data) };
    },

    /** Quests awaiting review (requires quests:approve) */
    getReviewQueue: async (
        params: { page?: number; per_page?: number } = {}
    ): Promise<QuestsListResponse> => {
        const sp = new URLSearchParams();
        if (params.page) sp.append("page", String(params.page));
        if (params.per_page) sp.append("page_size", String(params.per_page));
        const { data } = await api.get<RawListResponse>(
            `${API_ENDPOINTS.QUESTS.REVIEW_QUEUE}?${sp.toString()}`
        );
        return { quests: data.quests ?? [], pagination: buildPagination(data) };
    },

    /** Full enriched quest detail */
    getQuestDetail: async (questId: string): Promise<V2QuestDetail> => {
        const { data } = await api.get<{ success: boolean; quest: V2QuestDetail }>(
            API_ENDPOINTS.QUESTS.BY_ID(questId)
        );
        return data.quest;
    },

    /** Review action history for a quest */
    getReviewHistory: async (questId: string): Promise<QuestReviewRecord> => {
        const { data } = await api.get<{ success: boolean; review: QuestReviewRecord }>(
            API_ENDPOINTS.QUESTS.REVIEW_HISTORY(questId)
        );
        return data.review;
    },

    /** Approve a quest — no body required */
    approve: async (questId: string): Promise<V2QuestDetail> => {
        const { data } = await api.post<{ success: boolean; quest: V2QuestDetail }>(
            API_ENDPOINTS.QUESTS.APPROVE(questId)
        );
        return data.quest;
    },

    /** Request changes with a comment (1–2000 chars) */
    requestChanges: async (questId: string, comment: string): Promise<V2QuestDetail> => {
        const { data } = await api.post<{ success: boolean; quest: V2QuestDetail }>(
            API_ENDPOINTS.QUESTS.REQUEST_CHANGES(questId),
            { comment }
        );
        return data.quest;
    },

    /** Reject a quest with a reason (1–2000 chars) */
    reject: async (questId: string, reason: string): Promise<V2QuestDetail> => {
        const { data } = await api.post<{ success: boolean; quest: V2QuestDetail }>(
            API_ENDPOINTS.QUESTS.REJECT(questId),
            { reason }
        );
        return data.quest;
    },

    /** Pause a published quest — no body required */
    pause: async (questId: string): Promise<V2QuestDetail> => {
        const { data } = await api.post<{ success: boolean; quest: V2QuestDetail }>(
            API_ENDPOINTS.QUESTS.PAUSE(questId)
        );
        return data.quest;
    },

    /** Unpause a paused quest — no body required */
    unpause: async (questId: string): Promise<V2QuestDetail> => {
        const { data } = await api.post<{ success: boolean; quest: V2QuestDetail }>(
            API_ENDPOINTS.QUESTS.UNPAUSE(questId)
        );
        return data.quest;
    },

    /** Update quest fields (PUT /{id}) — only UpdateQuestBody-accepted fields */
    updateQuest: async (questId: string, payload: UpdateQuestPayload): Promise<V2QuestDetail> => {
        const { data } = await api.put<{ success: boolean; quest: V2QuestDetail }>(
            API_ENDPOINTS.QUESTS.BY_ID(questId),
            payload
        );
        return data.quest;
    },

    /** Delete a quest. Pass hard=true for permanent deletion (204, no body). */
    deleteQuest: async (questId: string, hard = false): Promise<void> => {
        await api.delete(
            `${API_ENDPOINTS.QUESTS.BY_ID(questId)}${hard ? "?hard=true" : ""}`
        );
    },
};
