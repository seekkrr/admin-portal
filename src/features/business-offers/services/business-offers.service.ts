import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";

/** A check-in offer as GET /api/v2/offers/admin/business-offers returns it. */
export interface BusinessOffer {
    _id: string;
    id?: string;
    marker_id: string;
    rule_type: "quantitative" | "qualitative" | string;
    trigger_n: number;
    reward_type: "flat" | "product" | string;
    flat_discount_value: number | null;
    product_details?: { title?: string | null; description?: string | null } | null;
    /** Older offers stored the product name flat. */
    product_name?: string | null;
    title?: string | null;
    description?: string | null;
    display_title?: string | null;
    is_active: boolean;
    expires_at?: string | null;
    created_at: string | null;
    updated_at?: string | null;
}

export interface BusinessOffersPage {
    offers: BusinessOffer[];
    total: number;
}

/** PATCH /api/v2/offers/admin/{offer_id} — send only what changed; `expires_at: null` clears it. */
export interface AdminOfferPatch {
    title?: string | null;
    description?: string | null;
    rule_type?: "quantitative" | "qualitative";
    trigger_n?: number;
    reward_type?: "flat" | "product";
    flat_discount_value?: number | null;
    active?: boolean;
    expires_at?: string | null;
}

export const businessOffersService = {
    list: async (page: number, pageSize: number): Promise<BusinessOffersPage> => {
        const { data } = await api.get<BusinessOffersPage>(API_ENDPOINTS.OFFERS.ADMIN_LIST, {
            params: { skip: (page - 1) * pageSize, limit: pageSize },
        });
        return { offers: data.offers ?? [], total: data.total ?? 0 };
    },

    /** Edit or switch off an offer (audit-logged by the backend). */
    update: async (offerId: string, patch: AdminOfferPatch): Promise<BusinessOffer | null> => {
        const { data } = await api.patch<{ offer?: BusinessOffer }>(API_ENDPOINTS.OFFERS_ADMIN_BY_ID(offerId), patch);
        return data.offer ?? null;
    },
};

/** "₹100 off" / "Free coffee". */
export function rewardText(o: BusinessOffer): string {
    if (o.display_title) return o.display_title;
    if (o.reward_type === "flat") return o.flat_discount_value !== null && o.flat_discount_value !== undefined ? `₹${o.flat_discount_value.toLocaleString("en-IN")} off` : "Discount";
    const name = o.product_details?.title || o.product_name || o.title;
    return name ? `Free ${name}` : "Free product";
}

/** "Every 3rd check-in" / "Every 5th new visitor". */
export function ruleText(o: Pick<BusinessOffer, "rule_type" | "trigger_n">): string {
    const n = o.trigger_n || 1;
    const what = o.rule_type === "qualitative" ? "new visitor" : "check-in";
    if (n === 1) return `Every ${what}`;
    const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
    return `Every ${n}${suffix} ${what}`;
}
