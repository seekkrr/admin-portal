import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    ChatSettings,
    FeatureFlag,
    PartnerPortalSettings,
    TermsDoc,
    TermsMap,
    TermsVersion,
    UpdateChatSettingsPayload,
    UpdateFeatureFlagPayload,
    UpdatePartnerPortalPayload,
} from "../types";

type PartnerPortalResponse = PartnerPortalSettings & { success?: boolean };

const toPartnerPortal = ({ sections, default_plan, updated_at }: PartnerPortalResponse): PartnerPortalSettings => ({
    sections,
    default_plan,
    updated_at: updated_at ?? null,
});

type ChatSettingsResponse = Partial<ChatSettings> & { success?: boolean };

/** A group missing from the reply counts as off (every group starts off). */
const toChatSettings = ({ audiences, ai_ready, updated_at }: ChatSettingsResponse): ChatSettings => ({
    audiences: {
        users: audiences?.users === true,
        creators: audiences?.creators === true,
        businesses: audiences?.businesses === true,
        admin: audiences?.admin === true,
    },
    ai_ready: ai_ready === true,
    updated_at: updated_at ?? null,
});

/** Feature flags (admin|super_admin), collab terms versions, Partner Portal sections and who gets the chat. */
export const platformConfigService = {
    getPartnerPortal: async (): Promise<PartnerPortalSettings> => {
        const { data } = await api.get<PartnerPortalResponse>(API_ENDPOINTS.PLATFORM_CONFIG.PARTNER_PORTAL);
        return toPartnerPortal(data);
    },

    updatePartnerPortal: async (payload: UpdatePartnerPortalPayload): Promise<PartnerPortalSettings> => {
        const { data } = await api.put<PartnerPortalResponse>(API_ENDPOINTS.PLATFORM_CONFIG.PARTNER_PORTAL, payload);
        return toPartnerPortal(data);
    },

    getChatSettings: async (): Promise<ChatSettings> => {
        const { data } = await api.get<ChatSettingsResponse>(API_ENDPOINTS.PLATFORM_CONFIG.CHAT);
        return toChatSettings(data);
    },

    updateChatSettings: async (payload: UpdateChatSettingsPayload): Promise<ChatSettings> => {
        const { data } = await api.put<ChatSettingsResponse>(API_ENDPOINTS.PLATFORM_CONFIG.CHAT, payload);
        return toChatSettings(data);
    },

    listFlags: async (): Promise<FeatureFlag[]> => {
        const { data } = await api.get<{ flags: FeatureFlag[] }>(API_ENDPOINTS.PLATFORM_CONFIG.FEATURES_ADMIN);
        return data.flags ?? [];
    },

    updateFlag: async (key: string, payload: UpdateFeatureFlagPayload): Promise<FeatureFlag> => {
        const { data } = await api.put<{ flag: FeatureFlag }>(API_ENDPOINTS.PLATFORM_CONFIG.FEATURE_BY_KEY(key), payload);
        return data.flag;
    },

    getTerms: async (): Promise<TermsMap> => {
        const { data } = await api.get<{ terms: TermsMap }>(API_ENDPOINTS.PLATFORM_CONFIG.TERMS);
        return data.terms ?? {};
    },

    /** Publishing a new version forces users to re-accept before their next collab action. */
    publishTerms: async (doc: TermsDoc, version: string, url?: string): Promise<TermsVersion> => {
        const { data } = await api.put<{ terms: TermsVersion }>(API_ENDPOINTS.PLATFORM_CONFIG.TERMS_BY_DOC(doc), {
            version,
            url: url || null,
        });
        return data.terms;
    },
};
