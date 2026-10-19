import { LayoutDashboard, Users, Video, Map, UserPlus, MessageSquare, BarChart3, MapPin, BookOpen, Star, Globe, Trophy, ListOrdered, Settings2, Activity, ArrowLeftRight, RotateCcw, Wallet, Banknote, ReceiptText, Tag, Store, CalendarDays, ListFilter, BellRing, Handshake, Inbox, Building2, ShieldCheck, Flag, Siren, GitPullRequestArrow, UserCheck, CreditCard, SlidersHorizontal, Rocket, Mail, type LucideIcon } from "lucide-react";

export interface NavItem {
    icon: LucideIcon;
    label: string;
    to: string;
    /** If set, item is only shown to users holding at least one of these roles. Omit = visible to all admin roles. */
    roles?: string[];
}

// Roles that may access the financial suite (transactions, refunds, payouts,
// payout accounts, payment events). Moderators are intentionally excluded —
// they hold no financial permissions in the backend RBAC matrix.
export const FINANCE_ROLES = ["admin", "super_admin", "finance"] as const;

// Collabs: queues/read views are open to moderators; money (plans, billing),
// algorithm (match tuning) and rollout/business-offers are admin-only —
// mirrors the backend guards in admin_collabs.py / platform_config.py.
export const COLLAB_STAFF_NAV_ROLES = ["admin", "super_admin", "moderator"] as const;
export const ADMIN_NAV_ROLES = ["admin", "super_admin"] as const;

export interface NavGroup {
    group: string;
    items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
    {
        group: "Overview",
        items: [
            { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
            { icon: BarChart3, label: "Analytics", to: "/analytics" },
        ]
    },
    {
        group: "User Management",
        items: [
            { icon: Users, label: "Users", to: "/users" },
            { icon: UserPlus, label: "Creator Applications", to: "/creator-applications" },
            { icon: Video, label: "Creators", to: "/creators" },
        ]
    },
    {
        group: "World & Content",
        items: [
            { icon: MapPin, label: "Markers", to: "/markers" },
            { icon: Globe, label: "Regions", to: "/regions" },
            { icon: Map, label: "Quests", to: "/quests" },
            { icon: CalendarDays, label: "Events", to: "/events" },
            { icon: BellRing, label: "Notification Access", to: "/notification-access" },
            { icon: ListFilter, label: "Timeline Filters", to: "/timeline-filters" },
            { icon: BookOpen, label: "Narratives", to: "/narratives" },
            { icon: Settings2, label: "Task Configs", to: "/task-configs" },
        ]
    },
    {
        group: "Engagement",
        items: [
            { icon: Trophy, label: "Achievements", to: "/achievements" },
            { icon: ListOrdered, label: "Leaderboards", to: "/leaderboards" },
            { icon: Activity, label: "Progress", to: "/progress" },
        ]
    },
    {
        group: "Support",
        items: [
            { icon: Star, label: "Reviews", to: "/reviews" },
            { icon: MessageSquare, label: "Support Queries", to: "/support-queries" },
        ]
    },
    {
        group: "Finance",
        items: [
            { icon: ArrowLeftRight, label: "Transactions", to: "/transactions", roles: [...FINANCE_ROLES] },
            { icon: RotateCcw, label: "Refunds", to: "/refunds", roles: [...FINANCE_ROLES] },
            { icon: Wallet, label: "Payout Accounts", to: "/payout-accounts", roles: [...FINANCE_ROLES] },
            { icon: Banknote, label: "Payouts", to: "/payouts", roles: [...FINANCE_ROLES] },
            { icon: ReceiptText, label: "Payment Events", to: "/payment-events", roles: [...FINANCE_ROLES] },
            // Coupon create/update/delete require admin/super_admin; the nav entry is
            // gated to those roles even though finance may view via direct link.
            { icon: Tag, label: "Coupons", to: "/coupons", roles: ["admin", "super_admin"] },
        ]
    },
    {
        group: "Collabs",
        items: [
            { icon: Handshake, label: "Overview", to: "/collabs/overview", roles: [...COLLAB_STAFF_NAV_ROLES] },
            { icon: Inbox, label: "Business Applications", to: "/collabs/business-applications", roles: [...COLLAB_STAFF_NAV_ROLES] },
            { icon: Building2, label: "Businesses", to: "/collabs/businesses", roles: [...COLLAB_STAFF_NAV_ROLES] },
            { icon: ShieldCheck, label: "Moderation", to: "/collabs/moderation", roles: [...COLLAB_STAFF_NAV_ROLES] },
            { icon: Flag, label: "Reports", to: "/collabs/reports", roles: [...COLLAB_STAFF_NAV_ROLES] },
            { icon: Siren, label: "Fraud Flags", to: "/collabs/fraud-flags", roles: [...COLLAB_STAFF_NAV_ROLES] },
            { icon: GitPullRequestArrow, label: "Collab Requests", to: "/collabs/applications", roles: [...COLLAB_STAFF_NAV_ROLES] },
            { icon: UserCheck, label: "Collab Creators", to: "/collabs/creators", roles: [...COLLAB_STAFF_NAV_ROLES] },
            { icon: Store, label: "Business Offers", to: "/business-offers", roles: [...ADMIN_NAV_ROLES] },
            { icon: CreditCard, label: "Plans & Billing", to: "/collabs/billing", roles: [...ADMIN_NAV_ROLES] },
            { icon: SlidersHorizontal, label: "Match Tuning", to: "/collabs/match", roles: [...ADMIN_NAV_ROLES] },
            { icon: Rocket, label: "Rollout", to: "/collabs/rollout", roles: [...ADMIN_NAV_ROLES] },
        ]
    },
    {
        group: "Platform",
        items: [
            { icon: Mail, label: "Email Templates", to: "/email-templates", roles: [...ADMIN_NAV_ROLES] },
        ]
    }
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items);
