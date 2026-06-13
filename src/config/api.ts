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
        REVIEW: (id: string) => `/api/v2/quests/${id}/review`,
        STEPS: (questId: string) => `/api/v2/quests/${questId}/steps`,
        STEP_BY_ID: (stepId: string) => `/api/v2/quests/steps/${stepId}`,
    },
    CREATORS: {
        LIST: "/api/v2/creators",
        PLATFORM_STATS: "/api/v2/creators/platform-stats",
        BY_ID: (creatorId: string) => `/api/v2/creators/${creatorId}`,
        UPDATE: (creatorId: string) => `/api/v2/creators/${creatorId}`,
        STATS_UPDATE: (creatorId: string) => `/api/v2/creators/${creatorId}/stats`,
        PROVISION: (userId: string) => `/api/v2/creators/provision/${userId}`,
    },
    CORE: {
        USERS: "/api/v2/users",
        USER_STATS: "/api/v2/users/stats",
        USER_EXPLORATION_PROFILES: "/api/v2/users/exploration-profiles",
        USER_BY_ID: (id: string) => `/api/v2/users/${id}`,
        BULK_ACTION: "/api/v2/users/bulk-action",
        USER_POINTS_ADD: (id: string) => `/api/v2/users/${id}/points/add`,
        USER_POINTS_DEDUCT: (id: string) => `/api/v2/users/${id}/points/deduct`,
        USER_PROMOTE_CREATOR: (id: string) => `/api/v2/users/${id}/promote-creator`,
    },
    CREATOR_APPLICATIONS: {
        LIST: "/api/v2/creator-applications",
        BY_ID: (id: string) => `/api/v2/creator-applications/${id}`,
        APPROVE: (id: string) => `/api/v2/creator-applications/${id}/approve`,
        REJECT: (id: string) => `/api/v2/creator-applications/${id}/reject`,
        DELETE: (id: string) => `/api/v2/creator-applications/${id}`,
    },
    NARRATIVES: {
        BASE: "/api/v2/narratives",
        CREATE: "/api/v2/narratives",
        REVIEW_QUEUE: "/api/v2/narratives/review-queue",
        BULK_APPROVE: "/api/v2/narratives/bulk-approve",
        BY_ID: (id: string) => `/api/v2/narratives/${id}`,
        BY_QUEST: (questId: string) => `/api/v2/narratives/by-attach/quest/${questId}`,
        BY_ATTACH: (attachType: string, attachId: string) => `/api/v2/narratives/by-attach/${attachType}/${attachId}`,
        APPROVE: (id: string) => `/api/v2/narratives/${id}/approve`,
        REJECT: (id: string) => `/api/v2/narratives/${id}/reject`,
        ARCHIVE: (id: string) => `/api/v2/narratives/${id}/archive`,
        AUDIO_GENERATE: (id: string) => `/api/v2/narratives/${id}/audio/generate`,
        AUDIO_STATUS: (id: string) => `/api/v2/narratives/${id}/audio-status`,
        AUDIO_DELETE: (id: string) => `/api/v2/narratives/${id}/audio`,
    },
    // ── Section 8: Content Moderation — Markers ──
    MARKERS: {
        BASE: "/api/v2/markers",
        BY_ID: (id: string) => `/api/v2/markers/${id}`,
        APPLICATIONS: "/api/v2/markers/applications",
        APPLICATION_BY_ID: (id: string) => `/api/v2/markers/applications/${id}`,
        APPLICATION_APPROVE: (id: string) => `/api/v2/markers/applications/${id}/approve`,
        APPLICATION_REJECT: (id: string) => `/api/v2/markers/applications/${id}/reject`,
    },
    // ── Section 9: Content Moderation — Reviews ──
    REVIEWS: {
        BASE: "/api/v2/reviews",
        BY_ID: (id: string) => `/api/v2/reviews/${id}`,
        MODERATE: (id: string) => `/api/v2/reviews/${id}/moderate`,
        RESPOND: (id: string) => `/api/v2/reviews/${id}/respond`,
    },
    // ── Section 11: Regions & Geographic Configuration ──
    REGIONS: {
        BASE: "/api/v2/regions",
        SEARCH: "/api/v2/regions/search",
        RESOLVE: "/api/v2/regions/resolve",
        RESOLVE_OR_CREATE: "/api/v2/regions/resolve-or-create",
        BY_ID: (id: string) => `/api/v2/regions/${id}`,
        HOTSPOTS: (id: string) => `/api/v2/regions/${id}/hotspots`,
        OFFLINE: (id: string) => `/api/v2/regions/${id}/offline`,
        CROWD_METER: (id: string) => `/api/v2/regions/${id}/crowd-meter`,
        MATRIX: (id: string) => `/api/v2/regions/${id}/matrix`,
        ADMIN_WEIGHT: (id: string) => `/api/v2/regions/${id}/admin-weight`,
        MATRIX_REFRESH: (id: string) => `/api/v2/regions/${id}/matrix/refresh`,
        LINK_QUEST: (regionId: string, questId: string) => `/api/v2/regions/${regionId}/quests/${questId}`,
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
    PAYOUT_ACCOUNTS: {
        LIST: "/api/v2/payout-accounts",
        BY_ID: (id: string) => `/api/v2/payout-accounts/${id}`,
        UPDATE: (id: string) => `/api/v2/payout-accounts/${id}`,
        VERIFY: (id: string) => `/api/v2/payout-accounts/${id}/verify`,
        SET_PRIMARY: (id: string) => `/api/v2/payout-accounts/${id}/set-primary`,
    },
    // ── Section 10: Achievements & Leaderboards ──
    ACHIEVEMENTS: {
        BASE: "/api/v2/achievements",
        EXPLORER_LEVELS: "/api/v2/achievements/explorer-levels",
        BY_ID: (id: string) => `/api/v2/achievements/${id}`,
        USER_EARNED: (userId: string) => `/api/v2/achievements/users/${userId}/earned`,
    },
    LEADERBOARDS: {
        GLOBAL: "/api/v2/leaderboards/global",
        GLOBAL_RECOMPUTE: "/api/v2/leaderboards/global/recompute",
        BY_QUEST: (id: string) => `/api/v2/leaderboards/quest/${id}`,
        BY_REGION: (id: string) => `/api/v2/leaderboards/region/${id}`,
        REGION_RECOMPUTE: (id: string) => `/api/v2/leaderboards/region/${id}/recompute`,
    },
    // ── Section 12: Task Configs & Step Rewards ──
    // Verified backend prefixes: /api/v2/tasks and /api/v2/rewards
    // (the migration spec's /task-configs & /step-rewards paths were stale).
    TASK_CONFIGS: {
        BASE: "/api/v2/tasks",
        BY_MARKER: (id: string) => `/api/v2/tasks/by-marker/${id}`,
        BY_QUEST: (id: string) => `/api/v2/tasks/by-quest/${id}`,
        BY_ID: (id: string) => `/api/v2/tasks/${id}`,
        FULL: (id: string) => `/api/v2/tasks/${id}/full`,
        TOGGLE_ACTIVE: (id: string) => `/api/v2/tasks/${id}/toggle-active`,
    },
    STEP_REWARDS: {
        BASE: "/api/v2/rewards",
        FOR_CONTEXT: "/api/v2/rewards/for-context",
        BY_ID: (id: string) => `/api/v2/rewards/${id}`,
        EVALUATE: (id: string) => `/api/v2/rewards/${id}/evaluate`,
    },
    // ── Section 14: Progress Tracking (read-only) ──
    PROGRESS: {
        BY_QUEST_USERS: (questId: string) => `/api/v2/progress/${questId}/users`,
        BY_QUEST: (questId: string) => `/api/v2/progress/${questId}`,
    },
} as const;
