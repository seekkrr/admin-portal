// ============================================================
// Email templates (admin|super_admin — platform_config view/edit)
// Backend: /api/v2/admin/email-templates
// Placeholders use Python string.Template syntax: $name or ${name}.
// ============================================================

export type EmailTemplateSource = "v2" | "v1";
export type EmailProvider = "seekkrr" | "zeptomail";

export interface EmailDeliveryStatus {
    transport: "smtp" | "zeptomail" | (string & {});
    smtp_configured: boolean;
    smtp_host: string | null;
    zeptomail_configured: boolean;
    zeptomail_api_url: string | null;
    from: { address: string; name: string };
}

export interface EmailTemplateListItem {
    key: string;
    name: string;
    group: string;
    description: string;
    source: EmailTemplateSource;
    is_layout: boolean;
    has_override: boolean;
    provider: EmailProvider;
    updated_at: string | null;
    version: number | null;
}

export interface EmailTemplatesListResponse {
    templates: EmailTemplateListItem[];
    delivery: EmailDeliveryStatus;
}

export interface EmailTemplateParts {
    subject: string;
    html: string;
    text: string;
}

export interface EmailTemplateVariable {
    name: string;
    sample: string;
    description: string;
}

export interface EmailTemplateVersion {
    version: number;
    saved_at: string | null;
    saved_by: string | null;
}

export interface EmailTemplateDetail {
    key: string;
    name: string;
    group: string;
    description: string;
    source: EmailTemplateSource;
    is_layout: boolean;
    variables: EmailTemplateVariable[];
    brand_variables: string[];
    defaults: EmailTemplateParts;
    current: EmailTemplateParts;
    has_override: boolean;
    updated_at: string | null;
    versions: EmailTemplateVersion[];
    delivery: { provider: EmailProvider; zepto_template_key: string | null };
    supports_zeptomail: boolean;
    zeptomail_merge_fields: string[];
    transport: EmailDeliveryStatus;
    /** Only on the PUT (save) response. */
    warnings?: { unknown_placeholders: string[] };
}

export type EmailTemplateDraft = Partial<EmailTemplateParts>;

export interface EmailPreviewResult {
    subject: string;
    html: string;
    text: string;
    unknown_placeholders: string[];
}

export interface EmailTestPayload extends EmailTemplateDraft {
    to?: string;
    use_zeptomail?: boolean;
    zepto_template_key?: string;
}

export interface EmailTestResult {
    queued: boolean;
    to: string;
    via: string;
}
