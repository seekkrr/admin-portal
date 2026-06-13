import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    AdminNarrative,
    NarrativesListResponse,
    ListNarrativesParams,
    NarrativeAudioStatusResponse,
    BulkApproveResponse,
    UpdateNarrativePayload,
} from "@/types";

export const narrativesService = {
    list: async (params: ListNarrativesParams = {}): Promise<NarrativesListResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get(`${API_ENDPOINTS.NARRATIVES.BASE}?${qs}`);
        return data;
    },

    reviewQueue: async (page: number, page_size: number): Promise<NarrativesListResponse> => {
        const qs = new URLSearchParams({ page: String(page), page_size: String(page_size) });
        const { data } = await api.get(`${API_ENDPOINTS.NARRATIVES.REVIEW_QUEUE}?${qs}`);
        return data;
    },

    getById: async (id: string): Promise<AdminNarrative> => {
        const { data } = await api.get(API_ENDPOINTS.NARRATIVES.BY_ID(id));
        return data.narrative;
    },

    update: async (id: string, payload: UpdateNarrativePayload): Promise<AdminNarrative> => {
        const { data } = await api.put(API_ENDPOINTS.NARRATIVES.BY_ID(id), payload);
        return data.narrative;
    },

    remove: async (id: string, hard = false): Promise<void> => {
        await api.delete(API_ENDPOINTS.NARRATIVES.BY_ID(id), { params: hard ? { hard: true } : undefined });
    },

    approve: async (id: string, note?: string): Promise<AdminNarrative> => {
        const { data } = await api.post(API_ENDPOINTS.NARRATIVES.APPROVE(id), { review_note: note });
        return data.narrative;
    },

    reject: async (id: string, note: string): Promise<AdminNarrative> => {
        const { data } = await api.post(API_ENDPOINTS.NARRATIVES.REJECT(id), { review_note: note });
        return data.narrative;
    },

    archive: async (id: string): Promise<AdminNarrative> => {
        const { data } = await api.post(API_ENDPOINTS.NARRATIVES.ARCHIVE(id));
        return data.narrative;
    },

    bulkApprove: async (ids: string[]): Promise<BulkApproveResponse> => {
        const { data } = await api.post(API_ENDPOINTS.NARRATIVES.BULK_APPROVE, { narrative_ids: ids });
        return data;
    },

    generateAudio: async (id: string): Promise<{ success: boolean; audio_status: string }> => {
        const { data } = await api.post(API_ENDPOINTS.NARRATIVES.AUDIO_GENERATE(id), {});
        return data;
    },

    audioStatus: async (id: string): Promise<NarrativeAudioStatusResponse> => {
        const { data } = await api.get(API_ENDPOINTS.NARRATIVES.AUDIO_STATUS(id));
        return data;
    },

    deleteAudio: async (id: string): Promise<void> => {
        await api.delete(API_ENDPOINTS.NARRATIVES.AUDIO_DELETE(id));
    },
};
