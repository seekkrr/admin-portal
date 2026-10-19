import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    EmailPreviewResult,
    EmailProvider,
    EmailTemplateDetail,
    EmailTemplateDraft,
    EmailTemplatesListResponse,
    EmailTestPayload,
    EmailTestResult,
} from "../types";

const E = API_ENDPOINTS.EMAIL_TEMPLATES;

/** /api/v2/admin/email-templates — admin|super_admin. Saved changes reach senders within ~1 minute. */
export const emailTemplatesService = {
    list: async (): Promise<EmailTemplatesListResponse> => {
        const { data } = await api.get<EmailTemplatesListResponse>(E.BASE);
        return { templates: data.templates ?? [], delivery: data.delivery };
    },

    get: async (key: string): Promise<EmailTemplateDetail> => {
        const { data } = await api.get<{ template: EmailTemplateDetail }>(E.BY_KEY(key));
        return data.template;
    },

    /** Send only the fields that changed; layouts accept `html` only. */
    save: async (key: string, draft: EmailTemplateDraft): Promise<EmailTemplateDetail> => {
        const { data } = await api.put<{ template: EmailTemplateDetail }>(E.BY_KEY(key), draft);
        return data.template;
    },

    preview: async (key: string, draft: EmailTemplateDraft, signal?: AbortSignal): Promise<EmailPreviewResult> => {
        const { data } = await api.post<EmailPreviewResult>(E.PREVIEW(key), draft, { signal });
        return {
            subject: data.subject ?? "",
            html: data.html ?? "",
            text: data.text ?? "",
            unknown_placeholders: data.unknown_placeholders ?? [],
        };
    },

    sendTest: async (key: string, payload: EmailTestPayload): Promise<EmailTestResult> => {
        const { data } = await api.post<EmailTestResult>(E.TEST(key), payload);
        return data;
    },

    reset: async (key: string): Promise<EmailTemplateDetail> => {
        const { data } = await api.post<{ template: EmailTemplateDetail }>(E.RESET(key));
        return data.template;
    },

    restore: async (key: string, version: number): Promise<EmailTemplateDetail> => {
        const { data } = await api.post<{ template: EmailTemplateDetail }>(E.RESTORE(key), { version });
        return data.template;
    },

    setDelivery: async (key: string, provider: EmailProvider, zeptoTemplateKey?: string): Promise<EmailTemplateDetail> => {
        const { data } = await api.put<{ template: EmailTemplateDetail }>(E.DELIVERY(key), {
            provider,
            zepto_template_key: provider === "zeptomail" ? zeptoTemplateKey?.trim() || null : null,
        });
        return data.template;
    },
};

/** Router path for a template key (dots encoded so static hosts never treat it as a file). */
export function emailTemplatePath(key: string): string {
    return `/email-templates/${encodeURIComponent(key).replace(/\./g, "%2E")}`;
}
