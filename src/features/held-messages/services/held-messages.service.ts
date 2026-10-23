import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";

export interface ChatMessage {
    id: string;
    side: "creator" | "business" | "system" | string | null;
    type: string | null;
    body: string | null;
    media_url: string | null;
    event: string | null;
    application_id: string | null;
    masked: boolean;
    held: boolean;
    mine?: boolean;
    sender_name: string | null;
    created_at: string | null;
    /** The chat the message belongs to (held list only). */
    thread_id?: string | null;
}

export type HeldDecision = "release" | "remove";

/** Collab chat messages held by the content filter, and reported threads. */
export const heldMessagesService = {
    async list(): Promise<ChatMessage[]> {
        const { data } = await api.get<{ messages?: ChatMessage[] }>(API_ENDPOINTS.PARTNER_ADMIN.HELD_MESSAGES);
        return data.messages ?? [];
    },
    async review(messageId: string, decision: HeldDecision): Promise<void> {
        await api.post(API_ENDPOINTS.PARTNER_ADMIN.HELD_REVIEW(messageId), { decision });
    },
    /** Opens only while one of the chat's messages has an open report (403 otherwise). */
    async thread(threadId: string): Promise<{ thread_id: string; messages: ChatMessage[] }> {
        const { data } = await api.get<{ thread_id: string; messages?: ChatMessage[] }>(API_ENDPOINTS.PARTNER_ADMIN.THREAD(threadId));
        return { thread_id: data.thread_id, messages: data.messages ?? [] };
    },
};
