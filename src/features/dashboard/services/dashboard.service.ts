import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    AnalyticsOverview,
    UserGrowthData,
    ActiveUsersData,
    UsersByRoleData,
    RetentionCohortData,
    AnalyticsPeriod
} from "@/types";

const getDatesForPeriod = (period: AnalyticsPeriod) => {
    const to = new Date().toISOString();
    const from = new Date();
    if (period === "7d") from.setDate(from.getDate() - 7);
    else if (period === "60d") from.setDate(from.getDate() - 60);
    else if (period === "90d") from.setDate(from.getDate() - 90);
    else from.setDate(from.getDate() - 30);
    return { from: from.toISOString(), to };
};

export const dashboardService = {
    getOverview: async (period: AnalyticsPeriod = "30d"): Promise<AnalyticsOverview> => {
        const { from, to } = getDatesForPeriod(period);
        const qs = new URLSearchParams({ from, to });
        const { data } = await api.get(`${API_ENDPOINTS.ANALYTICS.OVERVIEW}?${qs}`);
        return data;
    },
    getUserGrowth: async (period: AnalyticsPeriod = "30d"): Promise<UserGrowthData> => {
        const { from, to } = getDatesForPeriod(period);
        const qs = new URLSearchParams({ from, to, interval: "daily" });
        const { data } = await api.get(`${API_ENDPOINTS.ANALYTICS.USERS_GROWTH}?${qs}`);
        return data;
    },
    getActiveUsers: async (period: AnalyticsPeriod = "30d"): Promise<ActiveUsersData> => {
        const { from, to } = getDatesForPeriod(period);
        const qs = new URLSearchParams({ from, to });
        const { data } = await api.get(`${API_ENDPOINTS.ANALYTICS.USERS_ACTIVE}?${qs}`);
        return data;
    },
    getUsersByRole: async (): Promise<UsersByRoleData> => {
        const { data } = await api.get(API_ENDPOINTS.ANALYTICS.USERS_BY_ROLE);
        return data;
    },
    getRetentionCohorts: async (period: AnalyticsPeriod = "30d"): Promise<RetentionCohortData> => {
        const { from, to } = getDatesForPeriod(period);
        const qs = new URLSearchParams({ from, to });
        const { data } = await api.get(`${API_ENDPOINTS.ANALYTICS.USERS_RETENTION}?${qs}`);
        return data;
    },
    getBusinessAnalytics: async (): Promise<{ total_businesses: number, total_active_offers: number, total_platform_checkins: number, platform_redemption_rate: number }> => {
        const { data } = await api.get(`/offers/admin/business-analytics`);
        return data;
    }
};
