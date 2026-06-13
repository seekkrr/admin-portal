import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import type {
    TaskConfig,
    TaskConfigsListResponse,
    ListTaskConfigsParams,
    CreateTaskConfigPayload,
    UpdateTaskConfigPayload,
} from "@/types";

export const taskConfigsService = {
    list: async (params: ListTaskConfigsParams = {}): Promise<TaskConfigsListResponse> => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== "") qs.append(k, String(v));
        });
        const { data } = await api.get<TaskConfigsListResponse>(`${API_ENDPOINTS.TASK_CONFIGS.BASE}?${qs}`);
        return data;
    },

    getById: async (id: string): Promise<TaskConfig> => {
        const { data } = await api.get<{ success: boolean; task_config: TaskConfig }>(
            API_ENDPOINTS.TASK_CONFIGS.BY_ID(id),
        );
        return data.task_config;
    },

    getFull: async (id: string): Promise<TaskConfig> => {
        const { data } = await api.get<{ success: boolean; task_config: TaskConfig }>(
            API_ENDPOINTS.TASK_CONFIGS.FULL(id),
        );
        return data.task_config;
    },

    byMarker: async (markerId: string): Promise<TaskConfig[]> => {
        const { data } = await api.get<{ success: boolean; task_configs: TaskConfig[] }>(
            API_ENDPOINTS.TASK_CONFIGS.BY_MARKER(markerId),
        );
        return data.task_configs;
    },

    byQuest: async (questId: string): Promise<TaskConfig[]> => {
        const { data } = await api.get<{ success: boolean; task_configs: TaskConfig[] }>(
            API_ENDPOINTS.TASK_CONFIGS.BY_QUEST(questId),
        );
        return data.task_configs;
    },

    create: async (payload: CreateTaskConfigPayload): Promise<TaskConfig> => {
        const { data } = await api.post<{ success: boolean; task_config: TaskConfig }>(
            API_ENDPOINTS.TASK_CONFIGS.BASE,
            payload,
        );
        return data.task_config;
    },

    update: async (id: string, payload: UpdateTaskConfigPayload): Promise<TaskConfig> => {
        const { data } = await api.put<{ success: boolean; task_config: TaskConfig }>(
            API_ENDPOINTS.TASK_CONFIGS.BY_ID(id),
            payload,
        );
        return data.task_config;
    },

    toggleActive: async (id: string): Promise<TaskConfig> => {
        const { data } = await api.post<{ success: boolean; task_config: TaskConfig }>(
            API_ENDPOINTS.TASK_CONFIGS.TOGGLE_ACTIVE(id),
        );
        return data.task_config;
    },

    remove: async (id: string, hard = false): Promise<void> => {
        await api.delete(API_ENDPOINTS.TASK_CONFIGS.BY_ID(id), {
            params: hard ? { hard: true } : undefined,
        });
    },
};
