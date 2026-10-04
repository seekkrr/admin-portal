import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type { TimelineFilterItem } from "@/types";

function withId(o: Record<string, unknown>): TimelineFilterItem {
    const { _id, ...rest } = o;
    return { id: String(_id ?? o.id ?? ""), ...rest } as unknown as TimelineFilterItem;
}

export interface FilterPayload {
    key?: string;
    label?: string;
    icon?: string | null;
    color?: string | null;
    order?: number;
    is_active?: boolean;
}

export const timelineFiltersService = {
    list: async (): Promise<TimelineFilterItem[]> => {
        const { data } = await api.get<{ filters?: Array<Record<string, unknown>> }>(
            `${API_ENDPOINTS.TIMELINE_FILTERS.BASE}?include_inactive=true`
        );
        return (data.filters ?? []).map(withId);
    },
    create: async (payload: FilterPayload): Promise<TimelineFilterItem> => {
        const { data } = await api.post<{ filter: Record<string, unknown> }>(
            API_ENDPOINTS.TIMELINE_FILTERS.BASE,
            payload
        );
        return withId(data.filter);
    },
    update: async (id: string, payload: FilterPayload): Promise<TimelineFilterItem> => {
        const { data } = await api.patch<{ filter: Record<string, unknown> }>(
            API_ENDPOINTS.TIMELINE_FILTERS.BY_ID(id),
            payload
        );
        return withId(data.filter);
    },
    remove: async (id: string): Promise<void> => {
        await api.delete(API_ENDPOINTS.TIMELINE_FILTERS.BY_ID(id));
    },
};
