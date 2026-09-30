import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    EventListEntry,
    V2EventDetail,
    EventAttendee,
    EventStatus,
    UpdateEventPayload,
} from "@/types";

export interface ListEventsParams {
    status?: string;
    region?: string;
    page?: number;
    per_page?: number;
}

export interface EventsListResponse {
    events: EventListEntry[];
    pagination: {
        total: number;
        page: number;
        per_page: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
    };
}

const PARAM_MAP: Record<string, string> = {
    region: "region_id",
    per_page: "page_size",
};

type RawListResponse = {
    events?: Array<Record<string, unknown>>;
    total?: number;
    page?: number;
    page_size?: number;
    total_pages?: number;
};

/** Backend serializes `_id`; the admin UI uses `id`. */
function withId<T extends { id: string }>(o: Record<string, unknown>): T {
    const { _id, ...rest } = o;
    return { id: String(_id ?? o.id ?? ""), ...rest } as unknown as T;
}

function buildPagination(raw: RawListResponse): EventsListResponse["pagination"] {
    const page = raw.page ?? 1;
    const total_pages = raw.total_pages ?? 1;
    return {
        total: raw.total ?? 0,
        page,
        per_page: raw.page_size ?? 20,
        total_pages,
        has_next: page < total_pages,
        has_prev: page > 1,
    };
}

export const eventsService = {
    /** Admin list — all statuses, optional status/region filters. */
    listEvents: async (params: ListEventsParams = {}): Promise<EventsListResponse> => {
        const sp = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") sp.append(PARAM_MAP[k] ?? k, String(v));
        });
        const { data } = await api.get<RawListResponse>(`${API_ENDPOINTS.EVENTS.ADMIN}?${sp.toString()}`);
        return {
            events: (data.events ?? []).map((e) => withId<EventListEntry>(e)),
            pagination: buildPagination(data),
        };
    },

    getEventDetail: async (eventId: string): Promise<V2EventDetail> => {
        const { data } = await api.get<{ success: boolean; event: Record<string, unknown> }>(
            API_ENDPOINTS.EVENTS.BY_ID(eventId)
        );
        return withId<V2EventDetail>(data.event);
    },

    setStatus: async (eventId: string, status: EventStatus): Promise<V2EventDetail> => {
        const { data } = await api.post<{ success: boolean; event: Record<string, unknown> }>(
            API_ENDPOINTS.EVENTS.STATUS(eventId),
            { status }
        );
        return withId<V2EventDetail>(data.event);
    },

    updateEvent: async (eventId: string, payload: UpdateEventPayload): Promise<V2EventDetail> => {
        const { data } = await api.patch<{ success: boolean; event: Record<string, unknown> }>(
            API_ENDPOINTS.EVENTS.BY_ID(eventId),
            payload
        );
        return withId<V2EventDetail>(data.event);
    },

    deleteEvent: async (eventId: string): Promise<void> => {
        await api.delete(API_ENDPOINTS.EVENTS.BY_ID(eventId));
    },

    listAttendees: async (
        eventId: string,
        params: { status?: string; page?: number; page_size?: number } = {}
    ): Promise<{ attendees: EventAttendee[]; total: number; page: number; total_pages: number }> => {
        const sp = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") sp.append(k, String(v));
        });
        const { data } = await api.get<{
            attendees?: EventAttendee[];
            total?: number;
            page?: number;
            total_pages?: number;
        }>(`${API_ENDPOINTS.EVENTS.ATTENDEES(eventId)}?${sp.toString()}`);
        return {
            attendees: data.attendees ?? [],
            total: data.total ?? 0,
            page: data.page ?? 1,
            total_pages: data.total_pages ?? 1,
        };
    },
};
