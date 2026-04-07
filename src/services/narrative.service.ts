import { api } from "./api";
import { API_ENDPOINTS } from "@config/api";
import type { Narrative } from "@/types";

export interface CreateNarrativePayload {
    quest_id: string;
    from_step_id: string;
    to_step_id: string;
    title?: string;
    content: string;
    trigger_location?: { type: "Point"; coordinates: [number, number] };
    trigger_radius_m: number;
    is_mandatory: boolean;
}

export interface UpdateNarrativePayload {
    title?: string;
    content?: string;
    trigger_location?: { type: "Point"; coordinates: [number, number] };
    trigger_radius_m?: number;
    is_mandatory?: boolean;
}

export const narrativeService = {
    /** Fetch all narratives for a quest */
    async getByQuest(questId: string): Promise<{ narratives: Narrative[] }> {
        const { data } = await api.get(API_ENDPOINTS.NARRATIVES.BY_QUEST(questId));
        return data;
    },

    /** Create a new narrative */
    async create(payload: CreateNarrativePayload): Promise<Narrative> {
        const { data } = await api.post(API_ENDPOINTS.NARRATIVES.CREATE, payload);
        return data.narrative ?? data;
    },

    /** Update a narrative by ID */
    async update(id: string, payload: UpdateNarrativePayload): Promise<Narrative> {
        const { data } = await api.put(API_ENDPOINTS.NARRATIVES.BY_ID(id), payload);
        return data.narrative ?? data;
    },

    /** Delete a narrative by ID */
    async delete(id: string): Promise<void> {
        await api.delete(API_ENDPOINTS.NARRATIVES.BY_ID(id));
    },
};
