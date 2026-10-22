import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import { toQuery } from "../utils";
import type { AdminExperience, ExperiencesListResponse, ListExperiencesParams } from "../types";

const E = API_ENDPOINTS.EXPERIENCES_ADMIN;

/**
 * /api/v2/admin/experiences — every business's experiences, any status.
 * Staff (admin|super_admin|moderator) can list and hide/unhide.
 */
export const experiencesAdminService = {
    list: async (params: ListExperiencesParams): Promise<ExperiencesListResponse> => {
        const { data } = await api.get<ExperiencesListResponse>(`${E.BASE}${toQuery(params)}`);
        const experiences = data.experiences ?? [];
        return { ...data, experiences, total: data.total ?? experiences.length };
    },

    /** Hidden experiences disappear from the app; the business still sees them (marked hidden). */
    setHidden: async (id: string, hidden: boolean): Promise<AdminExperience | null> => {
        const { data } = await api.patch<{ experience?: AdminExperience }>(E.BY_ID(id), { hidden_by_admin: hidden });
        return data.experience ?? null;
    },
};
