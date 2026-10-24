import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import { toQuery } from "../utils";
import type {
    AdminExperience,
    CreateExperiencePayload,
    ExperiencesListResponse,
    ListExperiencesParams,
    SetupHostPayload,
    SetupHostResult,
} from "../types";

const E = API_ENDPOINTS.EXPERIENCES_ADMIN;

/**
 * /api/v2/admin/experiences — every business's experiences, any status.
 * Staff (admin|super_admin|moderator) can list and hide/unhide, set up hosts,
 * and create experiences on any business (they act as its owner).
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

    /** Turn Experiences on for a business (or the user's newest owned one), or create a business they own. */
    setupHost: async (payload: SetupHostPayload): Promise<SetupHostResult> => {
        const { data } = await api.post<SetupHostResult>(E.HOSTS, {
            id: payload.id.trim(),
            business_name: payload.business_name?.trim() || undefined,
        });
        return data;
    },

    /** New draft experience on a business (403 "Experiences are turned off…" when its switch is off). */
    create: async (businessId: string, payload: CreateExperiencePayload): Promise<AdminExperience> => {
        const { data } = await api.post<{ experience: AdminExperience }>(E.FOR_BUSINESS(businessId), {
            title: payload.title.trim(),
            description: payload.description?.trim() || undefined,
        });
        return data.experience;
    },
};
