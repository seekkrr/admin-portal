import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    QuestListEntry,
    QuestDetailResponse,
    QuestStatus,
} from "@/types";

// ---- Response Types ----

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

// ---- Query Params ----

export interface ListQuestsParams {
    q?: string;          // free-text search (mapped to backend `search`)
    status?: string;
    statuses?: string;   // Comma-separated list of statuses for multi-status filtering
    difficulty?: string;
    theme?: string;
    region?: string;     // region id (mapped to backend `region_id`)
    page?: number;
    per_page?: number;   // mapped to backend `page_size`
}

// Frontend param name -> backend query param name. The backend list endpoint
// expects `search`, `region_id`, `page_size` (not `q`, `region`, `per_page`).
const PARAM_NAME_MAP: Record<string, string> = {
    q: "search",
    region: "region_id",
    per_page: "page_size",
};

// ---- Service ----

export const questsService = {
    /** Paginated + filtered list of quests */
    listQuests: async (
        params: ListQuestsParams = {}
    ): Promise<QuestsListResponse> => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== "") {
                searchParams.append(PARAM_NAME_MAP[key] ?? key, String(value));
            }
        });
        const raw = (await api.get<Record<string, unknown>>(
            `${API_ENDPOINTS.QUESTS.BASE}?${searchParams.toString()}`
        )).data as {
            quests?: QuestListEntry[];
            total?: number;
            page?: number;
            page_size?: number;
            total_pages?: number;
        };
        return {
            quests: raw.quests ?? [],
            pagination: {
                total: raw.total ?? 0,
                page: raw.page ?? 1,
                per_page: raw.page_size ?? 20,
                total_pages: raw.total_pages ?? 1,
                has_next: (raw.page ?? 1) < (raw.total_pages ?? 1),
                has_prev: (raw.page ?? 1) > 1,
                next_page: (raw.page ?? 1) < (raw.total_pages ?? 1) ? (raw.page ?? 1) + 1 : null,
                prev_page: (raw.page ?? 1) > 1 ? (raw.page ?? 1) - 1 : null,
            },
        };
    },

    /** Get full quest details (quest + metadata + location + media + steps + creator) */
    getQuestDetail: async (
        questId: string
    ): Promise<QuestDetailResponse> => {
        const response = await api.get<QuestDetailResponse>(
            API_ENDPOINTS.QUESTS.BY_ID(questId)
        );
        return response.data;
    },

    /** Update quest fields (status, price, currency, booking_enabled, or sub-documents) */
    updateQuest: async (
        questId: string,
        data: Record<string, unknown>
    ): Promise<QuestDetailResponse> => {
        const response = await api.put<QuestDetailResponse>(
            API_ENDPOINTS.QUESTS.BY_ID(questId),
            data
        );
        return response.data;
    },

    /** Change quest status specifically */
    updateQuestStatus: async (
        questId: string,
        status: QuestStatus
    ): Promise<QuestDetailResponse> => {
        const response = await api.put<QuestDetailResponse>(
            API_ENDPOINTS.QUESTS.BY_ID(questId),
            { status }
        );
        return response.data;
    },

    /** Review a quest - accept/reject/request changes with comment */
    reviewQuest: async (
        questId: string,
        data: { status: 'Published' | 'Rejected' | 'Changes Requested'; comment?: string }
    ): Promise<QuestDetailResponse> => {
        const response = await api.put<QuestDetailResponse>(
            API_ENDPOINTS.QUESTS.REVIEW(questId),
            data
        );
        return response.data;
    },

    /** Delete a quest (soft by default, hard if specified) */
    deleteQuest: async (questId: string, hard: boolean = false): Promise<void> => {
        const query = hard ? "?hard=true" : "";
        await api.delete(
            `${API_ENDPOINTS.QUESTS.BY_ID(questId)}${query}`
        );
    },

    /** Update a quest step (title, description, etc.) */
    updateStep: async (
        stepId: string,
        data: Record<string, unknown>
    ): Promise<void> => {
        await api.put(API_ENDPOINTS.QUESTS.STEP_BY_ID(stepId), data);
    },
};
