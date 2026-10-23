import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";

export type BookingStatus = "active" | "completed" | "cancelled" | "expired";

export interface QuestBooking {
    _id: string;
    user_id: string;
    quest_id: string;
    /** Null for free quests and 100%-off coupon bookings. */
    transaction_id: string | null;
    refund_id?: string | null;
    status: BookingStatus;
    booked_at?: string | null;
    completed_at?: string | null;
    expires_at?: string | null;
    cancelled_at?: string | null;
    created_at?: string | null;
    coupon_code?: string | null;
}

export interface QuestBookingsQuery {
    quest_id?: string;
    user_id?: string;
    status?: BookingStatus;
    page?: number;
    page_size?: number;
}

export interface QuestBookingsPage {
    bookings: QuestBooking[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

/** GET /api/v2/bookings — every quest booking (admin, moderator). */
export const questBookingsService = {
    async list(query: QuestBookingsQuery): Promise<QuestBookingsPage> {
        const { data } = await api.get<Partial<QuestBookingsPage>>(API_ENDPOINTS.BOOKINGS.ADMIN_LIST, { params: query });
        return {
            bookings: data.bookings ?? [],
            total: data.total ?? 0,
            page: data.page ?? query.page ?? 1,
            page_size: data.page_size ?? query.page_size ?? 20,
            total_pages: data.total_pages ?? 1,
        };
    },
};
