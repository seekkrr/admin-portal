import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";

export interface NotificationAccessRequest {
    id: string;              // creator id
    user_id: string | null;
    name: string | null;
    email: string | null;
    notification_access: string;
}

export const notificationAccessService = {
    /** Creators awaiting (or in a given state of) notification access. */
    list: async (status = "pending"): Promise<NotificationAccessRequest[]> => {
        const { data } = await api.get<{ requests: NotificationAccessRequest[] }>(
            API_ENDPOINTS.CREATORS.NOTIFICATION_ACCESS_REQUESTS,
            { params: { status } }
        );
        return data.requests ?? [];
    },

    /** Approve / reject / reset a creator's notification access. */
    setAccess: async (creatorId: string, status: "approved" | "rejected" | "none"): Promise<void> => {
        await api.post(API_ENDPOINTS.CREATORS.NOTIFICATION_ACCESS(creatorId), { status });
    },
};
