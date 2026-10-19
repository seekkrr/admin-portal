import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type { FeatureFlag, TermsDoc, TermsMap, TermsVersion, UpdateFeatureFlagPayload } from "../types";

/** Feature flags (admin|super_admin) and collab terms versions. */
export const platformConfigService = {
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
