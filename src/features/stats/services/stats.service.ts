import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";

export interface DashboardStats {
    total: number;
    with_email: number;
    with_phone: number;
    recent_7_days: number;
}

export interface StatsResponse {
    ok: boolean;
    stats: DashboardStats;
}

export const statsService = {
    getStats: async (): Promise<DashboardStats> => {
        const response = await api.get<StatsResponse>(API_ENDPOINTS.INTEREST.STATS);
        return response.data.stats;
    },

    exportInterests: async (fromDate?: Date, toDate?: Date): Promise<void> => {
        const params = new URLSearchParams();
        if (fromDate) params.append("from", fromDate.toISOString().split("T")[0] as string);
        if (toDate) params.append("to", toDate.toISOString().split("T")[0] as string);

        const response = await api.get(`${API_ENDPOINTS.INTEREST.EXPORT}?${params.toString()}`, {
            responseType: "blob", // Important for file download
        });

        // Create a download link and trigger it
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;

        // Extract filename from header or use default
        const contentDisposition = response.headers["content-disposition"];
        let filename = `interests-${new Date().toISOString().split("T")[0]}.csv`;

        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1];
            }
        }

        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();

        // Cleanup
        link.remove();
        window.URL.revokeObjectURL(url);
    },

    getUserCount: async (params: Record<string, string | boolean>): Promise<number> => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            searchParams.append(key, String(value));
        });
        // We only need the count, so limit=1 is enough
        searchParams.append("limit", "1");

        const response = await api.get<{ pagination: { total: number } }>(`${API_ENDPOINTS.CORE.USERS}?${searchParams.toString()}`);
        return response.data.pagination.total;
    }
};
