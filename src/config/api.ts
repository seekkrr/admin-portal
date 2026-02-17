export const API_ENDPOINTS = {
    AUTH: {
        GOOGLE: "/api/auth/google",
        LOGOUT: "/api/auth/logout",
        REFRESH: "/api/auth/token/refresh",
    },
    QUESTS: {
        BASE: "/api/quests",
        CREATE: "/api/quests",
        BY_ID: (id: string) => `/api/quests/${id}`,
        STEPS: (questId: string) => `/api/quests/${questId}/steps`,
    },
    CREATORS: {
        BY_USER_ID: (userId: string) => `/api/core/creators/${userId}`,
        STATS: (userId: string) => `/api/core/creators/${userId}/stats`,
    },
    CORE: {
        USERS: "/api/core/users",
        USER_BY_ID: (id: string) => `/api/core/users/${id}`,
        BULK_ACTION: "/api/core/users/bulk-action",
    },
    QUERIES: {
        SUBMIT: "/api/queries",
    },
    INTEREST: {
        STATS: "/api/interest/admin/stats",
        EXPORT: "/api/interest/admin/export",
    }
} as const;
