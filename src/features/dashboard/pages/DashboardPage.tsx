import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, BadgeIndianRupee, BarChart3, LayoutDashboard, Map, MapPinCheck, MessageSquare, Store, Target, Trophy, Users, Video } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatGrid, StatTile } from "@/components/ui/Stat";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { ButtonLink } from "@/components/ui/Button";
import type { AnalyticsPeriod } from "@/types";
import { SimpleLineChart } from "@/features/analytics/components/SimpleChart";
import { formatCurrency } from "@/utils/format";
import { formatTime } from "@/utils/date";
import { dashboardService } from "../services/dashboard.service";

const ALLOWED_ROLES = ["admin", "super_admin", "moderator", "finance"];
const ADMIN_ROLES = ["admin", "super_admin"];
const GROWTH_PERIODS = ["7d", "30d", "60d", "90d"] as const;
const ACTIVE_PERIODS = ["30d", "60d", "90d"] as const;

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("en-IN");

/** Platform numbers at a glance (admins). */
export function DashboardPage() {
    const { user } = useAuthStore();
    const [growthPeriod, setGrowthPeriod] = useState<AnalyticsPeriod>("30d");
    const [activeUsersPeriod, setActiveUsersPeriod] = useState<AnalyticsPeriod>("30d");
    const [loadedAt] = useState(() => new Date());

    const isAdmin = !!user && !!user.role?.some((r) => ADMIN_ROLES.includes(r));

    const { data: overview, isLoading: loadingOverview } = useQuery({
        queryKey: ["admin-dashboard-overview", "30d"],
        queryFn: () => dashboardService.getOverview("30d"),
        enabled: isAdmin,
        staleTime: 5 * 60 * 1000,
    });

    const { data: growth } = useQuery({
        queryKey: ["admin-dashboard-growth", growthPeriod],
        queryFn: () => dashboardService.getUserGrowth(growthPeriod),
        enabled: isAdmin,
        staleTime: 5 * 60 * 1000,
    });

    const { data: activeUsers } = useQuery({
        queryKey: ["admin-dashboard-active", activeUsersPeriod],
        queryFn: () => dashboardService.getActiveUsers(activeUsersPeriod),
        enabled: isAdmin,
        staleTime: 5 * 60 * 1000,
    });

    const { data: businessStats } = useQuery({
        queryKey: ["admin-business-analytics"],
        queryFn: () => dashboardService.getBusinessAnalytics(),
        enabled: isAdmin,
        staleTime: 5 * 60 * 1000,
    });

    const { data: roles } = useQuery({
        queryKey: ["admin-dashboard-roles"],
        queryFn: () => dashboardService.getUsersByRole(),
        enabled: isAdmin,
        staleTime: 5 * 60 * 1000,
    });

    if (user && !user.role?.some((r) => ALLOWED_ROLES.includes(r))) {
        return <Navigate to="/access-denied" replace />;
    }

    const header = (
        <PageHeader
            icon={LayoutDashboard}
            title="Dashboard"
            description={`Platform numbers at a glance · updated ${formatTime(loadedAt)}`}
            actions={
                isAdmin && (
                    <ButtonLink to="/analytics" icon={BarChart3}>
                        Analytics
                    </ButtonLink>
                )
            }
        />
    );

    if (!isAdmin) {
        return (
            <div className="space-y-5">
                {header}
                <Panel>
                    <EmptyState
                        icon={BarChart3}
                        title={`Welcome${user?.first_name ? `, ${user.first_name}` : ""}`}
                        description="The dashboard is for admins. Use the menu to open the parts of the portal you work on."
                    />
                </Panel>
            </div>
        );
    }

    if (loadingOverview) {
        return (
            <div className="space-y-5">
                {header}
                <LoadingState label="Loading dashboard…" />
            </div>
        );
    }

    const o = overview?.data;
    const totalUsers = o?.total_users || 0;
    const active = activeUsers?.data?.active_users || 0;
    const activeShare = totalUsers ? Math.min((active / totalUsers) * 100, 100) : 0;
    const roleRows = roles?.data ?? [];

    return (
        <div className="space-y-5">
            {header}

            <StatGrid cols={5}>
                <StatTile icon={Users} label="Total users" value={n(o?.total_users)} to="/users" />
                <StatTile icon={Activity} label="Active accounts" value={n(active)} />
                <StatTile icon={Map} label="Published quests" value={n(o?.published_quests)} to="/quests" />
                <StatTile icon={Video} label="Active creators" value={n(o?.active_creators)} to="/creators" />
                <StatTile icon={BadgeIndianRupee} label="Revenue (30 days)" value={formatCurrency(o?.revenue_in_period ?? 0)} />
                <StatTile icon={MessageSquare} label="Total reviews" value={n(o?.total_reviews)} to="/reviews" />
                <StatTile icon={Trophy} label="Completions (30 days)" value={n(o?.completions_in_period)} />
                <StatTile icon={Target} label="Completion rate" value={`${o?.completion_rate || 0}%`} />
                <StatTile icon={Store} label="Active check-in offers" value={n(businessStats?.total_active_offers)} />
                <StatTile icon={MapPinCheck} label="Platform check-ins" value={n(businessStats?.total_platform_checkins)} />
            </StatGrid>

            <Panel
                title="User growth"
                description="New users joined over time"
                actions={
                    <Tabs
                        label="Growth period"
                        variant="pill"
                        value={growthPeriod}
                        onChange={(p) => setGrowthPeriod(p)}
                        tabs={GROWTH_PERIODS.map((p) => ({ value: p, label: p }))}
                    />
                }
            >
                <div className="h-[260px] w-full sm:h-[300px]">
                    <SimpleLineChart data={growth?.data?.map((d) => ({ label: d.period, value: d.count })) || []} />
                </div>
            </Panel>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Panel
                    title="Active users"
                    description={`Active in the last ${activeUsersPeriod.replace("d", " days")}`}
                    actions={
                        <Tabs
                            label="Active users period"
                            variant="pill"
                            value={activeUsersPeriod}
                            onChange={(p) => setActiveUsersPeriod(p)}
                            tabs={ACTIVE_PERIODS.map((p) => ({ value: p, label: p }))}
                        />
                    }
                >
                    <div className="flex items-end justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Total active</p>
                            <p className="mt-1 flex items-baseline gap-2">
                                <span className="text-3xl font-semibold tabular-nums text-ink">{n(active)}</span>
                                <span className="text-sm text-ink-faint">of {n(totalUsers)}</span>
                            </p>
                        </div>
                        <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent-700">{activeShare.toFixed(1)}%</span>
                    </div>
                    <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-brand-50" role="img" aria-label={`${activeShare.toFixed(1)}% of users active`}>
                        <div className="h-full rounded-full bg-accent-500 transition-all duration-700" style={{ width: `${activeShare}%` }} />
                    </div>
                </Panel>

                <Panel title="Roles" description="Users by their main role">
                    {roleRows.length === 0 ? (
                        <EmptyState compact title="No role data yet." />
                    ) : (
                        <ul className="space-y-3">
                            {roleRows.map((r: { role: string; count: number }) => (
                                <li key={r.role} className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-medium capitalize text-ink">{r.role.replace(/_/g, " ")}</span>
                                    <span className="flex w-1/2 items-center justify-end gap-3">
                                        <span className="hidden h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-brand-50 sm:block">
                                            <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.min((r.count / (totalUsers || 1)) * 100, 100)}%` }} />
                                        </span>
                                        <span className="min-w-[2.5rem] text-right text-sm font-semibold tabular-nums text-ink">{n(r.count)}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>
        </div>
    );
}
