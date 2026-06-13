import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    StepReward,
    StepRewardsListResponse,
    StepRewardContextType,
    ListStepRewardsParams,
    CreateStepRewardPayload,
    UpdateStepRewardPayload,
    RewardEvaluation,
} from "@/types";

export const stepRewardsService = {
    list: async (params: ListStepRewardsParams = {}): Promise<StepRewardsListResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get<StepRewardsListResponse>(`${API_ENDPOINTS.STEP_REWARDS.BASE}?${qs}`);
        return data;
    },

    forContext: async (
        contextType: StepRewardContextType,
        contextId: string,
    ): Promise<StepReward | null> => {
        const qs = new URLSearchParams();
        qs.append("context_type", contextType);
        qs.append("context_id", contextId);
        const { data } = await api.get<{ success: boolean; reward: StepReward | null }>(
            `${API_ENDPOINTS.STEP_REWARDS.FOR_CONTEXT}?${qs}`,
        );
        return data.reward;
    },

    getById: async (id: string): Promise<StepReward> => {
        const { data } = await api.get<{ success: boolean; reward: StepReward }>(
            API_ENDPOINTS.STEP_REWARDS.BY_ID(id),
        );
        return data.reward;
    },

    create: async (payload: CreateStepRewardPayload): Promise<StepReward> => {
        const { data } = await api.post<{ success: boolean; reward: StepReward }>(
            API_ENDPOINTS.STEP_REWARDS.BASE,
            payload,
        );
        return data.reward;
    },

    update: async (id: string, payload: UpdateStepRewardPayload): Promise<StepReward> => {
        const { data } = await api.put<{ success: boolean; reward: StepReward }>(
            API_ENDPOINTS.STEP_REWARDS.BY_ID(id),
            payload,
        );
        return data.reward;
    },

    evaluate: async (id: string, context: Record<string, unknown>): Promise<RewardEvaluation> => {
        const { data } = await api.post<RewardEvaluation>(
            API_ENDPOINTS.STEP_REWARDS.EVALUATE(id),
            { context },
        );
        return data;
    },

    remove: async (id: string, hard = false): Promise<void> => {
        await api.delete(API_ENDPOINTS.STEP_REWARDS.BY_ID(id), {
            params: hard ? { hard: true } : undefined,
        });
    },
};
