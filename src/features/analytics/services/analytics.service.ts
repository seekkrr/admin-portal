import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";

// The backend endpoints now either don't require dates (snapshot) or require 'from' and 'to' ISO strings.
export const analyticsService = {
    // --- Dashboard Overview ---
    getOverview: async (from?: string, to?: string) => {
        const qs = new URLSearchParams();
        if (from) qs.append("from", from);
        if (to) qs.append("to", to);
        return (await api.get(`${API_ENDPOINTS.ANALYTICS.OVERVIEW}?${qs}`)).data;
    },

    // --- Users ---
    getUserGrowth: async (from?: string, to?: string, interval: string = "daily") => {
        const qs = new URLSearchParams({ interval });
        if (from) qs.append("from", from);
        if (to) qs.append("to", to);
        return (await api.get(`${API_ENDPOINTS.ANALYTICS.USERS_GROWTH}?${qs}`)).data;
    },
    getActiveUsers: async (from?: string, to?: string) => {
        const qs = new URLSearchParams();
        if (from) qs.append("from", from);
        if (to) qs.append("to", to);
        return (await api.get(`${API_ENDPOINTS.ANALYTICS.USERS_ACTIVE}?${qs}`)).data;
    },
    getUsersByRole: async () => (await api.get(API_ENDPOINTS.ANALYTICS.USERS_BY_ROLE)).data,
    getRetentionCohorts: async (from?: string, to?: string) => {
        const qs = new URLSearchParams();
        if (from) qs.append("from", from);
        if (to) qs.append("to", to);
        return (await api.get(`${API_ENDPOINTS.ANALYTICS.USERS_RETENTION}?${qs}`)).data;
    },

    // --- Acquisition ---
    getAcquisitionLinkClicks: async (from?: string, to?: string, interval: string = "daily") => {
        const qs = new URLSearchParams({ interval });
        if (from) qs.append("from", from);
        if (to) qs.append("to", to);
        return (await api.get(`${API_ENDPOINTS.ANALYTICS.ACQUISITION_LINK_CLICKS}?${qs}`)).data;
    },

    // --- Revenue ---
    getRevenueTotal: async (from?: string, to?: string) => {
        const qs = new URLSearchParams();
        if (from) qs.append("from", from);
        if (to) qs.append("to", to);
        return (await api.get(`${API_ENDPOINTS.ANALYTICS.REVENUE_TOTAL}?${qs}`)).data;
    },
    getRevenueOverTime: async (from?: string, to?: string, interval: string = "daily") => {
        const qs = new URLSearchParams({ interval });
        if (from) qs.append("from", from);
        if (to) qs.append("to", to);
        return (await api.get(`${API_ENDPOINTS.ANALYTICS.REVENUE_OVER_TIME}?${qs}`)).data;
    },
    getRevenueByQuest: async (from?: string, to?: string, limit: number = 10) => {
        const qs = new URLSearchParams({ limit: limit.toString() });
        if (from) qs.append("from", from);
        if (to) qs.append("to", to);
        return (await api.get(`${API_ENDPOINTS.ANALYTICS.REVENUE_BY_QUEST}?${qs}`)).data;
    },
    getPaymentsFunnel: async (from?: string, to?: string) => {
        const qs = new URLSearchParams();
        if (from) qs.append("from", from);
        if (to) qs.append("to", to);
        return (await api.get(`${API_ENDPOINTS.ANALYTICS.PAYMENTS_FUNNEL}?${qs}`)).data;
    },

    // --- Quests ---
    getQuestCompletionRate: async (from?: string, to?: string) => {
        const qs = new URLSearchParams();
        if (from) qs.append("from", from);
        if (to) qs.append("to", to);
        return (await api.get(`${API_ENDPOINTS.ANALYTICS.QUESTS_COMPLETION_RATE}?${qs}`)).data;
    },
    getQuestsByStatus: async () => (await api.get(API_ENDPOINTS.ANALYTICS.QUESTS_BY_STATUS)).data,
    getTopQuests: async (sortBy: string = "completions", limit: number = 10) => {
        const qs = new URLSearchParams({ sort_by: sortBy, limit: limit.toString() });
        return (await api.get(`${API_ENDPOINTS.ANALYTICS.QUESTS_TOP}?${qs}`)).data;
    },
    getQuestApprovalFunnel: async () => (await api.get(API_ENDPOINTS.ANALYTICS.QUESTS_APPROVAL_FUNNEL)).data,
    getQuestReviewSentiment: async () => (await api.get(API_ENDPOINTS.ANALYTICS.QUESTS_REVIEWS_SENTIMENT)).data,

    // --- Creators ---
    getActiveCreatorsCount: async () => (await api.get(API_ENDPOINTS.ANALYTICS.CREATORS_ACTIVE_COUNT)).data,
    getTopCreators: async (sortBy: string = "total_quests", limit: number = 10) => {
        const qs = new URLSearchParams({ sort_by: sortBy, limit: limit.toString() });
        return (await api.get(`${API_ENDPOINTS.ANALYTICS.CREATORS_TOP}?${qs}`)).data;
    },
    getCreatorApplicationFunnel: async () => (await api.get(API_ENDPOINTS.ANALYTICS.CREATORS_APPLICATION_FUNNEL)).data,

    // --- Regions ---
    getTopRegions: async (sortBy: string = "quests", limit: number = 10) => {
        const qs = new URLSearchParams({ sort_by: sortBy, limit: limit.toString() });
        return (await api.get(`${API_ENDPOINTS.ANALYTICS.REGIONS_TOP}?${qs}`)).data;
    },
    getRegionCoverage: async () => (await api.get(API_ENDPOINTS.ANALYTICS.REGIONS_COVERAGE)).data,

    // --- Content ---
    getNarrativesByStatus: async () => (await api.get(API_ENDPOINTS.ANALYTICS.CONTENT_NARRATIVES_BY_STATUS)).data,
    getTaskCompletionByType: async () => (await api.get(API_ENDPOINTS.ANALYTICS.CONTENT_TASK_COMPLETION)).data,
    getAchievementsUnlockRates: async (limit: number = 20) => {
        const qs = new URLSearchParams({ limit: limit.toString() });
        return (await api.get(`${API_ENDPOINTS.ANALYTICS.CONTENT_ACHIEVEMENTS}?${qs}`)).data;
    },
    getMarkerContribution: async (from?: string, to?: string, interval: string = "monthly") => {
        const qs = new URLSearchParams({ interval });
        if (from) qs.append("from", from);
        if (to) qs.append("to", to);
        return (await api.get(`${API_ENDPOINTS.ANALYTICS.MARKERS_CONTRIBUTION}?${qs}`)).data;
    },
};
