import {
    Activity,
    ArrowLeftRight,
    Banknote,
    BarChart3,
    BellRing,
    BookOpen,
    Building2,
    CalendarDays,
    Compass,
    CreditCard,
    Flag,
    Globe,
    GitPullRequestArrow,
    HandCoins,
    Handshake,
    History,
    Inbox,
    LayoutDashboard,
    ListFilter,
    ListOrdered,
    Mail,
    Map,
    MapPin,
    MapPinPlus,
    Megaphone,
    MessageSquare,
    MessageSquareWarning,
    MessagesSquare,
    ReceiptText,
    Rocket,
    RotateCcw,
    Settings2,
    Shapes,
    ShieldCheck,
    Siren,
    SlidersHorizontal,
    Star,
    Store,
    Sun,
    Tag,
    Ticket,
    TicketCheck,
    Trophy,
    UserCheck,
    UserPlus,
    Users,
    Video,
    Wallet,
    type LucideIcon,
} from "lucide-react";

export interface NavItem {
    icon: LucideIcon;
    label: string;
    to: string;
    /** If set, item is only shown to users holding at least one of these roles. Omit = visible to all admin roles. */
    roles?: string[];
    /** Other words the search palette matches (old names, synonyms). */
    keywords?: string[];
    /** Name of one record on a detail page under this item (breadcrumb), e.g. "Place". */
    detailLabel?: string;
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

/**
 * The admin menu, organised around what admins look after (plan: "New
 * structure"). Every route URL is unchanged; only the grouping and a few
 * labels moved. Role gates are exactly the ones the old menu used.
 */
export const NAV_GROUPS: NavGroup[] = [
    {
        group: "Today",
        items: [
            { icon: Sun, label: "Today", to: "/today", keywords: ["inbox", "to-do", "pending", "what needs me"] },
            { icon: MessagesSquare, label: "Chat", to: "/chat", keywords: ["command", "commands"] },
            { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard", keywords: ["overview", "home"] },
            { icon: BarChart3, label: "Analytics", to: "/analytics", keywords: ["stats", "reports", "charts"] },
        ],
    },
    {
        group: "People",
        items: [
            { icon: Users, label: "Users", to: "/users", keywords: ["travelers", "members", "accounts"], detailLabel: "User" },
            { icon: Video, label: "Creators", to: "/creators", detailLabel: "Creator" },
            { icon: UserPlus, label: "Creator applications", to: "/creator-applications", keywords: ["creator requests"] },
            { icon: BellRing, label: "Notification access", to: "/notification-access", keywords: ["push access", "creators"] },
            { icon: MessageSquare, label: "Support queries", to: "/support-queries", keywords: ["help", "tickets", "contact"], detailLabel: "Support query" },
        ],
    },
    {
        group: "Places and map",
        items: [
            { icon: MapPin, label: "Places", to: "/markers", keywords: ["markers", "pois", "points of interest"], detailLabel: "Place" },
            { icon: MapPinPlus, label: "Place requests", to: "/markers/applications", keywords: ["marker applications", "new places"], detailLabel: "Place request" },
            { icon: Globe, label: "Regions", to: "/regions", keywords: ["cities", "areas"], detailLabel: "Region" },
            // Explore-map order/settings need the admin-only regions:manage permission.
            { icon: Compass, label: "Explore map", to: "/explore-map", roles: [...ADMIN_NAV_ROLES], keywords: ["region order", "map settings"] },
            // Categories admin routes are admin/super_admin only.
            { icon: Shapes, label: "Categories", to: "/place-categories", roles: [...ADMIN_NAV_ROLES], keywords: ["place categories", "marker categories", "sub-categories"] },
        ],
    },
    {
        group: "Content",
        items: [
            { icon: Map, label: "Quests", to: "/quests", keywords: ["review queue", "trails"], detailLabel: "Quest" },
            { icon: BookOpen, label: "Narratives", to: "/narratives", keywords: ["stories", "audio"], detailLabel: "Narrative" },
            { icon: CalendarDays, label: "Events", to: "/events", keywords: ["festivals"], detailLabel: "Event" },
            { icon: ListFilter, label: "Timeline filters", to: "/timeline-filters" },
            { icon: Settings2, label: "Task configs", to: "/task-configs", keywords: ["tasks", "step rewards"], detailLabel: "Task config" },
            { icon: Trophy, label: "Achievements", to: "/achievements", keywords: ["badges", "levels"], detailLabel: "Achievement" },
            { icon: ListOrdered, label: "Leaderboards", to: "/leaderboards" },
            { icon: Activity, label: "Progress", to: "/progress", keywords: ["quest progress"] },
        ],
    },
    {
        group: "Businesses",
        items: [
            { icon: Building2, label: "Businesses", to: "/collabs/businesses", roles: [...COLLAB_STAFF_NAV_ROLES], keywords: ["partners", "hosts"], detailLabel: "Business" },
            { icon: Inbox, label: "Business applications", to: "/collabs/business-applications", roles: [...COLLAB_STAFF_NAV_ROLES] },
            { icon: Handshake, label: "Collabs overview", to: "/collabs/overview", roles: [...COLLAB_STAFF_NAV_ROLES], keywords: ["collabs"] },
            { icon: GitPullRequestArrow, label: "Collab requests", to: "/collabs/applications", roles: [...COLLAB_STAFF_NAV_ROLES] },
            { icon: UserCheck, label: "Collab creators", to: "/collabs/creators", roles: [...COLLAB_STAFF_NAV_ROLES], keywords: ["handle verification"] },
            { icon: Ticket, label: "Experiences", to: "/collabs/experiences", roles: [...COLLAB_STAFF_NAV_ROLES], keywords: ["bookings", "slots", "tours", "classes"], detailLabel: "Experience" },
            { icon: Store, label: "Check-in offers", to: "/business-offers", roles: [...ADMIN_NAV_ROLES], keywords: ["business offers"] },
        ],
    },
    {
        group: "Trust and safety",
        items: [
            { icon: ShieldCheck, label: "Moderation", to: "/collabs/moderation", roles: [...COLLAB_STAFF_NAV_ROLES], keywords: ["collab moderation"] },
            { icon: Star, label: "Reviews", to: "/reviews", detailLabel: "Review" },
            { icon: Flag, label: "Reports", to: "/collabs/reports", roles: [...COLLAB_STAFF_NAV_ROLES] },
            { icon: Siren, label: "Fraud flags", to: "/collabs/fraud-flags", roles: [...COLLAB_STAFF_NAV_ROLES] },
            { icon: MessageSquareWarning, label: "Held messages", to: "/held-messages", roles: [...COLLAB_STAFF_NAV_ROLES], keywords: ["chat", "held chat messages", "collab chat"] },
            { icon: History, label: "Change history", to: "/change-history", roles: [...COLLAB_STAFF_NAV_ROLES], keywords: ["audit", "audit log", "who changed what"] },
        ],
    },
    {
        group: "Money",
        items: [
            { icon: ArrowLeftRight, label: "Transactions", to: "/transactions", roles: [...FINANCE_ROLES], keywords: ["payments"], detailLabel: "Transaction" },
            // GET /api/v2/bookings needs bookings:manage (moderator, admin, super_admin).
            { icon: TicketCheck, label: "Quest bookings", to: "/quest-bookings", roles: [...COLLAB_STAFF_NAV_ROLES], keywords: ["bookings", "booked quests"] },
            // SeekKrr collects experience payments, keeps a commission and pays businesses out.
            {
                icon: HandCoins,
                label: "Experience payments",
                to: "/experience-payments",
                roles: [...FINANCE_ROLES],
                keywords: ["experience bookings", "commission", "business payouts", "razorpay", "gst", "earnings"],
            },
            { icon: RotateCcw, label: "Refunds", to: "/refunds", roles: [...FINANCE_ROLES], detailLabel: "Refund" },
            { icon: ReceiptText, label: "Payment events", to: "/payment-events", roles: [...FINANCE_ROLES] },
            { icon: Banknote, label: "Payouts", to: "/payouts", roles: [...FINANCE_ROLES], detailLabel: "Payout" },
            { icon: Wallet, label: "Payout accounts", to: "/payout-accounts", roles: [...FINANCE_ROLES], detailLabel: "Payout account" },
            // Coupon create/update/delete require admin/super_admin; the nav entry is
            // gated to those roles even though finance may view via direct link.
            { icon: Tag, label: "Quest coupons", to: "/coupons", roles: ["admin", "super_admin"], keywords: ["coupons", "discount codes"], detailLabel: "Coupon" },
            { icon: CreditCard, label: "Plans & billing", to: "/collabs/billing", roles: [...ADMIN_NAV_ROLES], keywords: ["subscriptions", "plan coupons"] },
        ],
    },
    {
        group: "Settings",
        items: [
            { icon: Megaphone, label: "Push messages", to: "/push-messages", roles: [...ADMIN_NAV_ROLES], keywords: ["broadcast", "push", "notifications", "scheduled pushes"] },
            { icon: Mail, label: "Email templates", to: "/email-templates", roles: [...ADMIN_NAV_ROLES], detailLabel: "Template" },
            { icon: Rocket, label: "Rollout", to: "/collabs/rollout", roles: [...ADMIN_NAV_ROLES], keywords: ["partner portal sections", "terms", "feature flags"] },
            { icon: SlidersHorizontal, label: "Match tuning", to: "/collabs/match", roles: [...ADMIN_NAV_ROLES], keywords: ["algorithm"] },
        ],
    },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function canSeeNavItem(item: NavItem, roles: readonly string[] | undefined): boolean {
    return !item.roles || item.roles.some((r) => roles?.includes(r));
}

/** Menu groups and items this user may open (empty groups dropped). */
export function navGroupsForRoles(roles: readonly string[] | undefined): NavGroup[] {
    return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canSeeNavItem(i, roles)) })).filter((g) => g.items.length > 0);
}

export interface NavMatch {
    group: NavGroup;
    item: NavItem;
    /** True when the path is below the item (a detail page). */
    isDetail: boolean;
}

/**
 * The menu item a path belongs to: the longest item path that is the path
 * itself or a parent of it. `/markers/applications/42` → Place requests (detail),
 * `/markers/42` → Places (detail).
 */
export function findNavMatch(pathname: string): NavMatch | null {
    const path = pathname.replace(/\/+$/, "") || "/";
    let best: NavMatch | null = null;
    for (const group of NAV_GROUPS) {
        for (const item of group.items) {
            if (path === item.to || path.startsWith(`${item.to}/`)) {
                if (!best || item.to.length > best.item.to.length) {
                    best = { group, item, isDetail: path !== item.to };
                }
            }
        }
    }
    return best;
}
