import { useQueries } from "@tanstack/react-query";
import {
    BellRing,
    Building2,
    Flag,
    Inbox,
    Map as MapIcon,
    BookOpen,
    MapPinPlus,
    RotateCcw,
    ShieldCheck,
    Siren,
    UserCheck,
    UserPlus,
    type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { COLLAB_STAFF_NAV_ROLES, FINANCE_ROLES } from "@/config/navigation";
import { markersService } from "@/features/markers/services/markers.service";
import { creatorApplicationsService } from "@/features/creator-applications/services/creator-applications.service";
import { questsService } from "@/features/quests/services/quests.service";
import { narrativesService } from "@/features/content/services/narratives.service";
import { refundsService } from "@/features/financial/services/refunds.service";
import { notificationAccessService } from "@/features/notification-access/services/notificationAccess.service";
import { collabsAdminService } from "@/features/collabs/services/collabs-admin.service";
import type { CollabsAnalytics } from "@/features/collabs/types";

/**
 * "What needs me": pending counts from EXISTING endpoints. Each item is its
 * own query (or a `select` over a shared one), so one failing call only hides
 * its own card. Shared with the side menu, which shows the same counts.
 */

export interface TodayItem {
    key: string;
    label: string;
    description: string;
    /** Where the card links (may carry a filter). */
    to: string;
    /** The menu item that shows this count. */
    navTo: string;
    icon: LucideIcon;
    area: "People" | "Places and map" | "Content" | "Businesses" | "Trust and safety" | "Money";
    count: number | undefined;
    isLoading: boolean;
    isError: boolean;
}

type Def = Omit<TodayItem, "count" | "isLoading" | "isError"> & {
    roles?: readonly string[];
    queryKey: readonly unknown[];
    queryFn: () => Promise<unknown>;
    select: (data: unknown) => number;
};

const ANALYTICS_KEY = ["today", "collabs-analytics"] as const;
const analytics = () => collabsAdminService.analytics({ days: 30 });
const fromAnalytics = (pick: (a: CollabsAnalytics) => number | undefined) => (d: unknown) => pick(d as CollabsAnalytics) ?? 0;

// Moderators and admins see moderation; finance sees money. Mirrors the menu.
const STAFF = COLLAB_STAFF_NAV_ROLES;

const DEFS: Def[] = [
    {
        key: "place-requests",
        label: "Place requests",
        description: "New places people asked to add",
        to: "/markers/applications",
        navTo: "/markers/applications",
        icon: MapPinPlus,
        area: "Places and map",
        queryKey: ["today", "place-requests"],
        queryFn: () => markersService.listApplications({ status: "pending", page: 1, page_size: 1 }),
        select: (d) => (d as { total?: number }).total ?? 0,
    },
    {
        key: "creator-applications",
        label: "Creator applications",
        description: "People asking to become creators",
        to: "/creator-applications",
        navTo: "/creator-applications",
        icon: UserPlus,
        area: "People",
        queryKey: ["today", "creator-applications"],
        queryFn: () => creatorApplicationsService.listApplications({ status: "pending", page: 1, page_size: 1 }),
        select: (d) => (d as { pagination?: { total?: number } }).pagination?.total ?? 0,
    },
    {
        key: "notification-access",
        label: "Notification access",
        description: "Creators asking to send push messages",
        to: "/notification-access",
        navTo: "/notification-access",
        icon: BellRing,
        area: "People",
        queryKey: ["today", "notification-access"],
        queryFn: () => notificationAccessService.list("pending"),
        select: (d) => (d as unknown[]).length,
    },
    {
        key: "quest-reviews",
        label: "Quest reviews",
        description: "Quests waiting for approval",
        to: "/quests?tab=review-queue",
        navTo: "/quests",
        icon: MapIcon,
        area: "Content",
        queryKey: ["today", "quest-reviews"],
        queryFn: () => questsService.getReviewQueue({ page: 1, per_page: 1 }),
        select: (d) => (d as { pagination?: { total?: number } }).pagination?.total ?? 0,
    },
    {
        key: "narrative-reviews",
        label: "Narrative reviews",
        description: "Stories waiting for approval",
        to: "/narratives",
        navTo: "/narratives",
        icon: BookOpen,
        area: "Content",
        queryKey: ["today", "narrative-reviews"],
        queryFn: () => narrativesService.reviewQueue(1, 1),
        select: (d) => (d as { total?: number }).total ?? 0,
    },
    {
        key: "business-applications",
        label: "Business applications",
        description: "Businesses asking to join",
        to: "/collabs/business-applications",
        navTo: "/collabs/business-applications",
        icon: Inbox,
        area: "Businesses",
        roles: STAFF,
        queryKey: ANALYTICS_KEY,
        queryFn: analytics,
        select: fromAnalytics((a) => a.businesses?.pending_applications),
    },
    {
        key: "businesses-no-owner",
        label: "Businesses with no owner",
        description: "Created by an admin, owner not assigned yet",
        to: "/collabs/businesses?status=pending_claim",
        navTo: "/collabs/businesses",
        icon: Building2,
        area: "Businesses",
        roles: STAFF,
        queryKey: ANALYTICS_KEY,
        queryFn: analytics,
        select: fromAnalytics((a) => a.businesses?.pending_claim),
    },
    {
        key: "creator-handles",
        label: "Creator handles to verify",
        description: "Collab creators waiting for a handle check",
        to: "/collabs/creators",
        navTo: "/collabs/creators",
        icon: UserCheck,
        area: "Businesses",
        roles: STAFF,
        queryKey: ["today", "creator-handles"],
        queryFn: () => collabsAdminService.pendingVerifications(),
        select: (d) => (d as unknown[]).length,
    },
    {
        key: "moderation",
        label: "Moderation",
        description: "Collab posts waiting for a decision",
        to: "/collabs/moderation",
        navTo: "/collabs/moderation",
        icon: ShieldCheck,
        area: "Trust and safety",
        roles: STAFF,
        queryKey: ANALYTICS_KEY,
        queryFn: analytics,
        select: fromAnalytics((a) => a.moderation_pending),
    },
    {
        key: "reports",
        label: "Open reports",
        description: "Things people reported",
        to: "/collabs/reports",
        navTo: "/collabs/reports",
        icon: Flag,
        area: "Trust and safety",
        roles: STAFF,
        queryKey: ANALYTICS_KEY,
        queryFn: analytics,
        select: fromAnalytics((a) => a.open_reports),
    },
    {
        key: "fraud-flags",
        label: "Fraud flags",
        description: "Suspicious activity to check",
        to: "/collabs/fraud-flags",
        navTo: "/collabs/fraud-flags",
        icon: Siren,
        area: "Trust and safety",
        roles: STAFF,
        queryKey: ANALYTICS_KEY,
        queryFn: analytics,
        select: fromAnalytics((a) => a.open_fraud_flags),
    },
    {
        key: "refunds",
        label: "Refunds to approve",
        description: "Refunds started and waiting for approval",
        to: "/refunds?status=initiated",
        navTo: "/refunds",
        icon: RotateCcw,
        area: "Money",
        roles: FINANCE_ROLES,
        queryKey: ["today", "refunds"],
        queryFn: () => refundsService.list({ status: "initiated", page: 1, page_size: 1 }),
        select: (d) => (d as { total?: number }).total ?? 0,
    },
];

export function useTodayItems(): TodayItem[] {
    const roles = useAuthStore((s) => s.user?.role);
    const defs = DEFS.filter((d) => !d.roles || d.roles.some((r) => roles?.includes(r as never)));
    const results = useQueries({
        queries: defs.map((d) => ({
            queryKey: d.queryKey,
            queryFn: d.queryFn,
            select: d.select,
            staleTime: 60_000,
            refetchOnWindowFocus: true,
            retry: false,
        })),
    });
    return defs.map((d, i) => {
        const r = results[i];
        return {
            key: d.key,
            label: d.label,
            description: d.description,
            to: d.to,
            navTo: d.navTo,
            icon: d.icon,
            area: d.area,
            count: r?.data as number | undefined,
            isLoading: !!r?.isLoading,
            isError: !!r?.isError,
        };
    });
}

/** Pending counts per menu path, for badges in the side menu. */
export function useNavCounts(): Record<string, number> {
    const items = useTodayItems();
    const out: Record<string, number> = {};
    for (const it of items) {
        if (it.count) out[it.navTo] = (out[it.navTo] ?? 0) + it.count;
    }
    return out;
}
