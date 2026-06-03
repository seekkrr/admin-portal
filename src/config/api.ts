export const API_ENDPOINTS = {
    AUTH: {
        OAUTH_LOGIN: "/api/v2/auth/oauth/login",
        LOGOUT: "/api/v2/auth/logout",
        REFRESH: "/api/v2/auth/refresh",
        VERIFY: "/api/v2/auth/verify",
    },
    QUESTS: {
        BASE: "/api/v2/quests",
        CREATE: "/api/v2/quests",
        BY_ID: (id: string) => `/api/v2/quests/${id}`,
        REVIEW: (id: string) => `/api/v2/admin/quests/${id}/review`,
        STEPS: (questId: string) => `/api/v2/quests/${questId}/steps`,
        STEP_BY_ID: (stepId: string) => `/api/v2/quests/steps/${stepId}`,
    },
    CREATORS: {
        LIST: "/api/v2/core/creators",
        BY_USER_ID: (userId: string) => `/api/v2/core/creators/${userId}`,
        STATS: (userId: string) => `/api/v2/core/creators/${userId}/stats`,
        STATUS: (userId: string) => `/api/v2/core/creators/${userId}/status`,
        PAYOUT: (userId: string) => `/api/v2/core/creators/${userId}/payout-account`,
        UPDATE_PAYOUT: (userId: string) => `/api/v2/core/payout-accounts/${userId}`,
    },
    CORE: {
        USERS: "/api/v2/users",
        USER_BY_ID: (id: string) => `/api/v2/users/${id}`,
        BULK_ACTION: "/api/v2/users/bulk-action",
    },
    INTEREST: {
        STATS: "/api/v2/interest/admin/stats",
        EXPORT: "/api/v2/interest/admin/export",
    },
    CREATOR_APPLICATIONS: {
        LIST: "/api/v2/admin/creator-applications",
        BY_ID: (id: string) => `/api/v2/admin/creator-applications/${id}`,
        APPROVE: (id: string) => `/api/v2/admin/creator-applications/${id}/approve`,
        REJECT: (id: string) => `/api/v2/admin/creator-applications/${id}/reject`,
    },
    NARRATIVES: {
        CREATE: "/api/v2/locations/narrative",
        BY_ID: (id: string) => `/api/v2/locations/narrative/${id}`,
        BY_QUEST: (questId: string) => `/api/v2/locations/quest/${questId}/narratives`,
    },
    ANALYTICS: {
        OVERVIEW: "/api/v2/analytics/overview",
        // Users
        USERS_GROWTH: "/api/v2/analytics/users/growth",
        USERS_ACTIVE: "/api/v2/analytics/users/active",
        USERS_BY_ROLE: "/api/v2/analytics/users/by-role",
        USERS_RETENTION: "/api/v2/analytics/users/retention",
        // Revenue
        REVENUE_TOTAL: "/api/v2/analytics/revenue/total",
        REVENUE_OVER_TIME: "/api/v2/analytics/revenue/over-time",
        REVENUE_BY_QUEST: "/api/v2/analytics/revenue/by-quest",
        PAYMENTS_FUNNEL: "/api/v2/analytics/payments/funnel",
        // Quests
        QUESTS_COMPLETION_RATE: "/api/v2/analytics/quests/completion-rate",
        QUESTS_BY_STATUS: "/api/v2/analytics/quests/by-status",
        QUESTS_TOP: "/api/v2/analytics/quests/top",
        QUESTS_APPROVAL_FUNNEL: "/api/v2/analytics/quests/approval-funnel",
        QUESTS_REVIEWS_SENTIMENT: "/api/v2/analytics/quests/reviews/sentiment",
        // Creators
        CREATORS_ACTIVE_COUNT: "/api/v2/analytics/creators/active-count",
        CREATORS_TOP: "/api/v2/analytics/creators/top",
        CREATORS_APPLICATION_FUNNEL: "/api/v2/analytics/creators/application-funnel",
        // Regions
        REGIONS_TOP: "/api/v2/analytics/regions/top",
        REGIONS_COVERAGE: "/api/v2/analytics/regions/coverage",
        // Content
        CONTENT_NARRATIVES_BY_STATUS: "/api/v2/analytics/content/narratives-by-status",
        CONTENT_TASK_COMPLETION: "/api/v2/analytics/content/task-completion-by-type",
        CONTENT_ACHIEVEMENTS: "/api/v2/analytics/content/achievements-unlock-rates",
        MARKERS_CONTRIBUTION: "/api/v2/analytics/markers/contribution",
    },
    SUPPORT_QUERIES: {
        BASE: "/api/v2/queries",
        BY_ID: (id: string) => `/api/v2/queries/${id}`,
        BULK_DELETE: "/api/v2/queries/bulk/delete",
    },
} as const;

