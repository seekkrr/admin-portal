import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";

/** "all" (everyone), "region:<id>", "event:<id>" (people who RSVP'd), "business:<id>" (its owner and team). */
export type GroupKey = string;

export interface BroadcastInput {
    title: string;
    body: string;
    group_key: GroupKey;
    image?: string;
    long_body?: string;
    /** ISO time (UTC); omit to send now. */
    send_at?: string;
}

export interface BroadcastResult {
    group: string;
    scheduled?: boolean;
    id?: string;
    send_at?: string;
    published?: boolean;
    push_enabled?: boolean;
    /** One business only: phones the push went to, and people on its team. */
    sent?: number;
    people?: number;
    [key: string]: unknown;
}

export interface ScheduledPush {
    id: string;
    group_key: string;
    title: string;
    body: string;
    image: string | null;
    long_body: string | null;
    send_at: string | null;
    status: string;
    created_at: string | null;
    sent_at: string | null;
}

/** Admin push broadcast + scheduled pushes (backend: /api/v2/notifications). */
export const pushService = {
    async broadcast(input: BroadcastInput): Promise<BroadcastResult> {
        const { data } = await api.post<BroadcastResult>(API_ENDPOINTS.NOTIFICATIONS.BROADCAST, input);
        return data;
    },
    async scheduled(): Promise<ScheduledPush[]> {
        const { data } = await api.get<{ scheduled?: ScheduledPush[] }>(API_ENDPOINTS.NOTIFICATIONS.SCHEDULED);
        return data.scheduled ?? [];
    },
    async cancel(id: string): Promise<boolean> {
        const { data } = await api.delete<{ cancelled?: boolean }>(API_ENDPOINTS.NOTIFICATIONS.SCHEDULED_BY_ID(id));
        return !!data.cancelled;
    },
};
