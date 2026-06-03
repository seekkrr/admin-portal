import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@components/ui";
import { Users, Activity, Map, DollarSign, MessageSquare, BarChart3, Video } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "../services/dashboard.service";
import { LoadingFallback } from "@components/LoadingFallback";
import { useAuthStore } from "@store/auth.store";
import { Navigate } from "react-router-dom";
import type { AnalyticsPeriod } from "@/types";
import { SimpleLineChart } from "@/features/analytics/components/SimpleChart";

export function DashboardPage() {
    const { user } = useAuthStore();
    const [growthPeriod, setGrowthPeriod] = useState<AnalyticsPeriod>("30d");
    const [activeUsersPeriod, setActiveUsersPeriod] = useState<AnalyticsPeriod>("30d");

    const ALLOWED_ROLES = ["admin", "super_admin", "moderator", "finance"];
    const ADMIN_ROLES = ["admin", "super_admin"];
    const roleColors = ["bg-indigo-600", "bg-indigo-500", "bg-indigo-400", "bg-indigo-300", "bg-indigo-200"];

    if (user && !user.role?.some(r => ALLOWED_ROLES.includes(r as any))) {
        return <Navigate to="/access-denied" replace />;
    }

    const isAdmin = user && user.role?.some(r => ADMIN_ROLES.includes(r as any));

    const { data: overview, isLoading: loadingOverview } = useQuery({
        queryKey: ["admin-dashboard-overview", "30d"],
        queryFn: () => dashboardService.getOverview("30d"),
        enabled: !!isAdmin,
        staleTime: 5 * 60 * 1000,
    });

    const { data: growth } = useQuery({
        queryKey: ["admin-dashboard-growth", growthPeriod],
        queryFn: () => dashboardService.getUserGrowth(growthPeriod),
        enabled: !!isAdmin,
        staleTime: 5 * 60 * 1000,
    });

    const { data: activeUsers } = useQuery({
        queryKey: ["admin-dashboard-active", activeUsersPeriod],
        queryFn: () => dashboardService.getActiveUsers(activeUsersPeriod),
        enabled: !!isAdmin,
        staleTime: 5 * 60 * 1000,
    });

    const { data: roles } = useQuery({
        queryKey: ["admin-dashboard-roles"],
        queryFn: () => dashboardService.getUsersByRole(),
        enabled: !!isAdmin,
        staleTime: 5 * 60 * 1000,
    });

    if (isAdmin && loadingOverview) {
        return <LoadingFallback message="Loading dashboard..." />;
    }

    // Helper to render KPI cards beautifully and perfectly aligned
    const renderKpiCard = (title: string, value: string | number, Icon: any, colorClass: string) => (
        <Card className="hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 ease-out border-neutral-100 shadow-sm h-full overflow-hidden relative group bg-white/70 backdrop-blur-xl">
            {/* Subtle top border accent */}
            <div className={`absolute top-0 left-0 w-full h-1 opacity-50 group-hover:opacity-100 transition-opacity ${(colorClass.split(' ')[0] || '').replace('ring', 'bg').replace('text', 'bg')}`} />
            <CardContent className="p-5 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start mb-4 gap-2">
                    <p className="uppercase text-xs tracking-wider font-bold text-neutral-500 leading-snug">{title}</p>
                    <div className={`p-2.5 bg-white shadow-sm ring-1 ${colorClass} rounded-xl shrink-0 transition-transform duration-300 group-hover:scale-110`}>
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
                <div>
                    <h3 className="text-3xl font-extrabold text-neutral-900 tracking-tight leading-none">{value}</h3>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="animate-fade-in space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Dashboard</h1>
                <div className="text-sm font-medium text-neutral-500 bg-white px-3 py-1.5 rounded-full shadow-sm ring-1 ring-neutral-200/50">
                    Last updated: {new Date().toLocaleTimeString()}
                </div>
            </div>

            {!isAdmin ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5" />
                            Welcome, {user?.first_name}
                        </CardTitle>
                        <CardDescription>
                            You don't have access to this dashboard. Please use the sidebar to navigate to your specific modules.
                        </CardDescription>
                    </CardHeader>
                </Card>
            ) : (
                <>
                    {/* Overview Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                        {renderKpiCard("Total Users", overview?.data?.total_users || 0, Users, "ring-indigo-100 text-indigo-600")}
                        {renderKpiCard(`Active Users (Last ${activeUsersPeriod.replace('d', ' Days')})`, activeUsers?.data?.active_users || 0, Activity, "ring-emerald-100 text-emerald-600")}
                        {renderKpiCard("Published Quests", overview?.data?.published_quests || 0, Map, "ring-blue-100 text-blue-600")}
                        {renderKpiCard("Active Creators", overview?.data?.active_creators || 0, Video, "ring-amber-100 text-amber-600")}
                        {renderKpiCard("Revenue (Last 30 Days)", `$${overview?.data?.revenue_in_period?.toLocaleString() || 0}`, DollarSign, "ring-emerald-100 text-emerald-600")}
                        {renderKpiCard("Total Reviews", overview?.data?.total_reviews || 0, MessageSquare, "ring-violet-100 text-violet-600")}
                        {renderKpiCard("Quest Completions (Last 30 Days)", overview?.data?.completions_in_period || 0, Map, "ring-rose-100 text-rose-600")}
                        {renderKpiCard("Completion Rate", `${overview?.data?.completion_rate || 0}%`, Activity, "ring-cyan-100 text-cyan-600")}
                    </div>

                    {/* Growth Chart */}
                    <Card className="shadow-sm border-neutral-100 overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-b from-neutral-50/50 to-transparent pointer-events-none" />
                        <CardHeader className="flex flex-row items-center justify-between pb-4 relative z-10 border-b border-neutral-100/50">
                            <div>
                                <CardTitle className="text-lg font-bold tracking-tight">User Growth</CardTitle>
                                <CardDescription className="font-medium text-neutral-500 mt-1">New users joined over time</CardDescription>
                            </div>
                            <div className="flex gap-1 bg-neutral-100/80 p-1 rounded-xl ring-1 ring-neutral-200/50 backdrop-blur-sm shadow-inner">
                                {(["7d", "30d", "60d", "90d"] as const).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setGrowthPeriod(p)}
                                        className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                                            growthPeriod === p ? "bg-white text-indigo-600 shadow-sm ring-1 ring-neutral-200/50" : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/50"
                                        }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </CardHeader>
                        <CardContent className="relative z-10 pt-4">
                            <div className="h-[300px] w-full">
                                <SimpleLineChart data={growth?.data?.map(d => ({ label: d.period, value: d.count })) || []} />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                        {/* Active Users breakdown */}
                        <Card className="shadow-sm border-neutral-100 group hover:shadow-md transition-all duration-300">
                            <CardHeader className="flex flex-row items-start justify-between pb-4 border-b border-neutral-100/50">
                                <div>
                                    <CardTitle className="text-lg font-bold tracking-tight">Active Users Overview</CardTitle>
                                    <CardDescription className="font-medium text-neutral-500 mt-1">Activity breakdown in the last {activeUsersPeriod.replace('d', ' days')}</CardDescription>
                                </div>
                                <div className="flex gap-1 bg-neutral-100/80 p-1 rounded-xl ring-1 ring-neutral-200/50 shadow-inner">
                                    {(["30d", "60d", "90d"] as const).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setActiveUsersPeriod(p)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                                                activeUsersPeriod === p ? "bg-white text-indigo-600 shadow-sm ring-1 ring-neutral-200/50" : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/50"
                                            }`}
                                        >
                                            {p.replace('d', '')}
                                        </button>
                                    ))}
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end mb-2">
                                        <div>
                                            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">Total Active</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-3xl font-extrabold text-neutral-900 tracking-tight">{activeUsers?.data?.active_users || 0}</span>
                                                <span className="text-sm font-medium text-neutral-400">/ {overview?.data?.total_users || 0}</span>
                                            </div>
                                        </div>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/50">
                                            {((activeUsers?.data?.active_users || 0) / (overview?.data?.total_users || 1) * 100).toFixed(1)}% Rate
                                        </span>
                                    </div>
                                    <div className="w-full bg-neutral-100 rounded-full h-2.5 overflow-hidden ring-1 ring-neutral-200/50 shadow-inner">
                                        <div 
                                            className="bg-indigo-600 h-full rounded-full transition-all duration-1000 ease-out relative" 
                                            style={{ width: `${Math.min(((activeUsers?.data?.active_users || 0) / (overview?.data?.total_users || 1)) * 100, 100)}%` }}
                                        >
                                            <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Roles */}
                        <Card className="shadow-sm border-neutral-100 hover:shadow-md transition-all duration-300">
                            <CardHeader className="border-b border-neutral-100/50 pb-4">
                                <CardTitle className="text-lg font-bold tracking-tight">Platform Roles</CardTitle>
                                <CardDescription className="font-medium text-neutral-500 mt-1">Distribution of users by their primary role</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="space-y-4">
                                    {roles?.data?.map((r: any, i: number) => (
                                        <div key={r.role} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full shadow-sm ring-2 ring-white ${roleColors[i % roleColors.length]}`}></div>
                                                <span className="text-sm font-bold text-neutral-700 capitalize group-hover:text-indigo-600 transition-colors">{r.role.replace('_', ' ')}</span>
                                            </div>
                                            <div className="flex items-center gap-3 w-1/2 justify-end">
                                                <div className="h-1.5 bg-neutral-100 rounded-full w-full overflow-hidden hidden sm:block max-w-[120px]">
                                                    <div className={`h-full transition-all duration-1000 ease-out ${roleColors[i % roleColors.length]}`} style={{ width: `${Math.min((r.count / (overview?.data?.total_users || 1)) * 100, 100)}%` }}></div>
                                                </div>
                                                <span className="font-extrabold text-neutral-900 bg-neutral-50 px-2 py-0.5 rounded-md text-sm min-w-[2.5rem] text-center ring-1 ring-neutral-200/50">{r.count}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {(!roles || !roles.data || roles.data.length === 0) && (
                                        <div className="text-center text-sm font-medium text-neutral-400 py-8 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                                            No role data available
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
