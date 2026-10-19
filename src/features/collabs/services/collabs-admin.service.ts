import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import { toQuery } from "../utils";
import type {
    AdminCollab,
    AdminCollabApplication,
    AdminPlan,
    ApplicationsListResponse,
    BillingCoupon,
    CollabsAnalytics,
    CollabsListResponse,
    EffectiveEntitlements,
    FraudFlagsListResponse,
    MatchConfig,
    MatchConfigPayload,
    MatchEvaluationRow,
    MatchPreviewPayload,
    MatchPreviewResult,
    ModerationStatus,
    OverridePayload,
    PendingHandleVerification,
    PublicPlan,
    ReportAction,
    ReportStatus,
    ReportTargetType,
    ReportsListResponse,
    SetTierResult,
    SocialPlatform,
    SubscriptionsListResponse,
    UpdatePlanPayload,
    UpsertBillingCouponPayload,
    VerifyHandleResult,
    CreatorTier,
    FraudFlagStatus,
    CollabStatus,
} from "../types";

const E = API_ENDPOINTS.COLLABS_ADMIN;

/**
 * /api/v2/admin/collabs/* — reads are staff (admin|super_admin|moderator);
 * plans/coupons/subscriptions/overrides, match config PUT and forced
 * transitions are admin-only. Every response is `{success, ...payload}`.
 */
export const collabsAdminService = {
    analytics: async (params: { days: number; region_id?: string }): Promise<CollabsAnalytics> => {
        const { data } = await api.get<CollabsAnalytics & { success: boolean }>(`${E.ANALYTICS}${toQuery(params)}`);
        return data;
    },

    // ── Moderation ──
    moderationQueue: async (params: { status: ModerationStatus; page: number }): Promise<CollabsListResponse> => {
        const { data } = await api.get<CollabsListResponse>(`${E.MODERATION}${toQuery(params)}`);
        return { ...data, collabs: data.collabs ?? [] };
    },

    moderate: async (collabId: string, decision: "approved" | "rejected", reason?: string): Promise<AdminCollab> => {
        const { data } = await api.post<{ collab: AdminCollab }>(E.MODERATE(collabId), { decision, reason: reason || null });
        return data.collab;
    },

    listCollabs: async (params: { business_id?: string; status?: CollabStatus; page?: number }): Promise<CollabsListResponse> => {
        const { data } = await api.get<CollabsListResponse>(`${E.COLLABS}${toQuery(params)}`);
        return { ...data, collabs: data.collabs ?? [] };
    },

    // ── Reports ──
    listReports: async (params: { status: ReportStatus; target_type?: ReportTargetType; page: number }): Promise<ReportsListResponse> => {
        const { data } = await api.get<ReportsListResponse>(`${E.REPORTS}${toQuery(params)}`);
        return { ...data, reports: data.reports ?? [] };
    },

    resolveReport: async (id: string, action: ReportAction, note?: string): Promise<{ resolved: boolean; action: string }> => {
        const { data } = await api.post<{ resolved: boolean; action: string }>(E.REPORT_RESOLVE(id), { action, note: note || null });
        return data;
    },

    // ── Fraud flags ──
    listFraudFlags: async (params: { status: FraudFlagStatus; page: number }): Promise<FraudFlagsListResponse> => {
        const { data } = await api.get<FraudFlagsListResponse>(`${E.FRAUD_FLAGS}${toQuery(params)}`);
        return { ...data, flags: data.flags ?? [] };
    },

    resolveFraudFlag: async (id: string, note?: string): Promise<void> => {
        await api.post(E.FRAUD_FLAG_RESOLVE(id), { note: note || null });
    },

    // ── Applications ──
    listApplications: async (params: {
        status?: string;
        business_id?: string;
        creator_user_id?: string;
        page: number;
    }): Promise<ApplicationsListResponse> => {
        const { data } = await api.get<ApplicationsListResponse>(`${E.APPLICATIONS}${toQuery(params)}`);
        return { ...data, applications: data.applications ?? [] };
    },

    forceTransition: async (id: string, status: string, reason: string): Promise<AdminCollabApplication> => {
        const { data } = await api.post<{ application: AdminCollabApplication }>(E.APPLICATION_FORCE(id), { status, reason });
        return data.application;
    },

    // ── Creators ──
    pendingVerifications: async (): Promise<PendingHandleVerification[]> => {
        const { data } = await api.get<{ pending: PendingHandleVerification[] }>(E.CREATOR_VERIFICATIONS);
        return data.pending ?? [];
    },

    verifyHandle: async (userId: string, platform: SocialPlatform, verified: boolean): Promise<VerifyHandleResult> => {
        const { data } = await api.post<VerifyHandleResult>(E.CREATOR_VERIFY_HANDLE(userId), { platform, verified });
        return data;
    },

    setTier: async (userId: string, tier: CreatorTier, suspended?: boolean): Promise<SetTierResult> => {
        const body: { tier: CreatorTier; suspended?: boolean } = { tier };
        if (suspended !== undefined) body.suspended = suspended;
        const { data } = await api.post<SetTierResult>(E.CREATOR_TIER(userId), body);
        return data;
    },

    // ── Plans & billing ──
    listPlans: async (): Promise<AdminPlan[]> => {
        const { data } = await api.get<{ plans: AdminPlan[] }>(E.PLANS);
        return data.plans ?? [];
    },

    updatePlan: async (code: string, payload: UpdatePlanPayload): Promise<PublicPlan> => {
        const { data } = await api.put<{ plan: PublicPlan }>(E.PLAN_BY_CODE(code), payload);
        return data.plan;
    },

    syncPlanToRazorpay: async (code: string): Promise<PublicPlan> => {
        const { data } = await api.post<{ plan: PublicPlan }>(E.PLAN_SYNC_RAZORPAY(code));
        return data.plan;
    },

    listCoupons: async (): Promise<BillingCoupon[]> => {
        const { data } = await api.get<{ coupons: BillingCoupon[] }>(E.COUPONS);
        return data.coupons ?? [];
    },

    upsertCoupon: async (payload: UpsertBillingCouponPayload): Promise<BillingCoupon> => {
        const { data } = await api.put<{ coupon: BillingCoupon }>(E.COUPONS, payload);
        return data.coupon;
    },

    listSubscriptions: async (params: { status?: string; page: number }): Promise<SubscriptionsListResponse> => {
        const { data } = await api.get<SubscriptionsListResponse>(`${E.SUBSCRIPTIONS}${toQuery(params)}`);
        return { ...data, subscriptions: data.subscriptions ?? [] };
    },

    /** Send all-null to clear the override. */
    setOverride: async (businessId: string, payload: OverridePayload): Promise<EffectiveEntitlements> => {
        const { data } = await api.put<{ effective: EffectiveEntitlements }>(E.SUBSCRIPTION_OVERRIDE(businessId), payload);
        return data.effective;
    },

    // ── Match ──
    getMatchConfig: async (): Promise<MatchConfig> => {
        const { data } = await api.get<{ config: MatchConfig }>(E.MATCH_CONFIG);
        return data.config;
    },

    /** NOTE: the backend overwrites `variant` with what is sent (null removes it). */
    saveMatchConfig: async (payload: MatchConfigPayload): Promise<MatchConfig> => {
        const { data } = await api.put<{ config: MatchConfig }>(E.MATCH_CONFIG, payload);
        return data.config;
    },

    previewMatch: async (payload: MatchPreviewPayload): Promise<MatchPreviewResult[]> => {
        const { data } = await api.post<{ results: MatchPreviewResult[] }>(E.MATCH_PREVIEW, payload);
        return data.results ?? [];
    },

    matchEvaluation: async (): Promise<MatchEvaluationRow[]> => {
        const { data } = await api.get<{ versions: MatchEvaluationRow[] }>(E.MATCH_EVALUATION);
        return data.versions ?? [];
    },
};
