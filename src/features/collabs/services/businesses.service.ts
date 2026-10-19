import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import { toQuery } from "../utils";
import type {
    AdminBusiness,
    AdminBusinessApplication,
    ApproveBusinessApplicationResult,
    BusinessCategory,
    BusinessApplicationsListResponse,
    BusinessesListResponse,
    ClaimInvite,
    CreateBusinessPayload,
    ListBusinessApplicationsParams,
    ListBusinessesParams,
    UpdateBusinessPayload,
} from "../types";

/**
 * Business profiles (admin) + business applications intake.
 * GETs are open to moderators; create / PATCH / claim invites need admin.
 * Applications approve/reject are allowed for moderators too.
 */
export const businessesService = {
    // ── Businesses ──
    categories: async (): Promise<BusinessCategory[]> => {
        const { data } = await api.get<{ categories: BusinessCategory[] }>(API_ENDPOINTS.BUSINESSES_ADMIN.CATEGORIES);
        return data.categories ?? [];
    },

    list: async (params: ListBusinessesParams): Promise<BusinessesListResponse> => {
        const { data } = await api.get<BusinessesListResponse>(`${API_ENDPOINTS.BUSINESSES_ADMIN.BASE}${toQuery(params)}`);
        return { ...data, businesses: data.businesses ?? [] };
    },

    getById: async (id: string): Promise<AdminBusiness> => {
        const { data } = await api.get<{ business: AdminBusiness }>(API_ENDPOINTS.BUSINESSES_ADMIN.BY_ID(id));
        return data.business;
    },

    create: async (payload: CreateBusinessPayload): Promise<AdminBusiness> => {
        const { data } = await api.post<{ business: AdminBusiness }>(API_ENDPOINTS.BUSINESSES_ADMIN.BASE, payload);
        return data.business;
    },

    update: async (id: string, payload: UpdateBusinessPayload): Promise<AdminBusiness> => {
        const { data } = await api.patch<{ business: AdminBusiness }>(API_ENDPOINTS.BUSINESSES_ADMIN.BY_ID(id), payload);
        return data.business;
    },

    createClaimInvite: async (id: string, phone?: string): Promise<ClaimInvite> => {
        const { data } = await api.post<{ invite: ClaimInvite }>(API_ENDPOINTS.BUSINESSES_ADMIN.CLAIM_INVITES(id), {
            phone: phone || null,
        });
        return data.invite;
    },

    // ── Business applications ──
    listApplications: async (params: ListBusinessApplicationsParams): Promise<BusinessApplicationsListResponse> => {
        const { data } = await api.get<BusinessApplicationsListResponse>(
            `${API_ENDPOINTS.BUSINESS_APPLICATIONS.LIST}${toQuery(params)}`
        );
        return { ...data, applications: data.applications ?? [] };
    },

    getApplication: async (id: string): Promise<AdminBusinessApplication> => {
        const { data } = await api.get<{ application: AdminBusinessApplication }>(API_ENDPOINTS.BUSINESS_APPLICATIONS.BY_ID(id));
        return data.application;
    },

    approveApplication: async (id: string): Promise<ApproveBusinessApplicationResult> => {
        const { data } = await api.post<ApproveBusinessApplicationResult>(API_ENDPOINTS.BUSINESS_APPLICATIONS.APPROVE(id));
        return { application: data.application, business: data.business };
    },

    rejectApplication: async (id: string, reason?: string): Promise<AdminBusinessApplication> => {
        const { data } = await api.post<{ application: AdminBusinessApplication }>(
            API_ENDPOINTS.BUSINESS_APPLICATIONS.REJECT(id),
            { reason: reason || null }
        );
        return data.application;
    },
};
