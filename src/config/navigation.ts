import { LayoutDashboard, Users, Video, Map, UserPlus, MessageSquare, BarChart3, MapPin, BookOpen, Star, Globe, Trophy, ListOrdered, Settings2, Activity, ArrowLeftRight, RotateCcw, Wallet, Banknote, ReceiptText, Tag, type LucideIcon } from "lucide-react";

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
    }
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items);
