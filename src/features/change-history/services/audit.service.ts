import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";

export type AuditSource = "screen" | "chat";

export interface AuditItem {
    id: string;
    at: string | null;
    actor: { id: string | null; name: string | null } | null;
    action: string | null;
    entity_type: string | null;
    entity_id: string | null;
    summary: string | null;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    source: AuditSource;
}

export interface AuditQuery {
    entity_type?: string;
    entity_id?: string;
    actor_id?: string;
    action?: string;
    source?: AuditSource;
    page?: number;
    page_size?: number;
}

export interface AuditPage {
    items: AuditItem[];
    total: number;
}

/** GET /api/v2/admin/audit — admin screen changes and chat command runs, newest first. */
export const auditService = {
    async list(query: AuditQuery): Promise<AuditPage> {
        const { data } = await api.get<{ items?: AuditItem[]; total?: number }>(API_ENDPOINTS.ADMIN_AUDIT, { params: query });
        return { items: data.items ?? [], total: data.total ?? 0 };
    },
};
