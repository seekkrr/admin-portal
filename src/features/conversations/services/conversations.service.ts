import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type { ChatMessage } from "@/features/held-messages/services/held-messages.service";

export interface ConversationPerson {
    id: string;
    name: string;
    avatar_url: string | null;
}

export interface ConversationRow {
    id: string;
    business: { id: string; name: string | null; logo_url: string | null };
    creator: ConversationPerson | null;
    offer: string | null;
    /** Status of the pair's current collab request. */
    status: string | null;
    collab_count: number;
    /** People's messages (collab updates not counted). */
    messages: number;
    held: number;
    last_preview: string | null;
    last_sender_side: string | null;
    last_message_at: string | null;
    created_at: string | null;
}

export interface ConversationMessage extends ChatMessage {
    sender_user_id: string | null;
    removed: boolean;
    flags: string[];
}

export interface Conversation {
    thread: {
        id: string;
        business: { id: string; name: string | null; logo_url: string | null; team: (ConversationPerson & { role: string | null })[] };
        creator: ConversationPerson;
        collabs: { application_id: string; status: string | null; source: string | null; offer: string | null; want: string | null; created_at: string | null }[];
        /** Why nobody can write right now: blocked, reviews_done or closed. */
        read_only: string | null;
        created_at: string | null;
    };
    messages: ConversationMessage[];
    has_more: boolean;
}

/** Business–creator collab chats, read-only, for admins. Each opened chat is audit-logged. */
export const conversationsService = {
    async list(params: { q?: string; before?: string }): Promise<{ threads: ConversationRow[]; has_more: boolean }> {
        const { data } = await api.get<{ threads?: ConversationRow[]; has_more?: boolean }>(API_ENDPOINTS.PARTNER_ADMIN.CONVERSATIONS, {
            params: { q: params.q || undefined, before: params.before, limit: 50 },
        });
        return { threads: data.threads ?? [], has_more: !!data.has_more };
    },
    async get(threadId: string, before?: string): Promise<Conversation> {
        const { data } = await api.get<Conversation>(API_ENDPOINTS.PARTNER_ADMIN.CONVERSATION(threadId), { params: { before } });
        return { ...data, messages: data.messages ?? [] };
    },
};
