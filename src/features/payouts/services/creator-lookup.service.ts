import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";

/**
 * Creator profiles for the payout pickers. Payouts and payout accounts key on
 * the CREATOR PROFILE id (the `creators` collection), not the user id, so the
 * user search can't be used here — this looks creators up by name through
 * GET /api/v2/creators?search= and labels an id through GET /api/v2/creators/{id}.
 */
export interface CreatorOption {
    id: string;
    name: string | null;
    user_id: string;
    status: string;
}

interface RawCreator {
    id: string;
    user_id: string;
    name?: string | null;
    status: string;
}

export const creatorLookupService = {
    search: async (q: string, limit = 8): Promise<CreatorOption[]> => {
        const { data } = await api.get<{ creators?: RawCreator[] }>(API_ENDPOINTS.CREATORS.LIST, {
            params: { search: q, page: 1, page_size: limit },
        });
        return (data.creators ?? []).map((c) => ({ id: c.id, name: c.name ?? null, user_id: c.user_id, status: c.status }));
    },

    get: async (creatorId: string): Promise<CreatorOption | null> => {
        const { data } = await api.get<{ creator?: RawCreator }>(API_ENDPOINTS.CREATORS.BY_ID(creatorId));
        const c = data.creator;
        return c ? { id: c.id, name: c.name ?? null, user_id: c.user_id, status: c.status } : null;
    },
};
