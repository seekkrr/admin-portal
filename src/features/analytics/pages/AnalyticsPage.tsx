import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "../services/analytics.service";
import { PeriodSelector } from "../components/PeriodSelector";
import { AnalyticsCard } from "../components/AnalyticsCard";
import { SimpleLineChart, SimpleBarChart, SimpleDoughnutChart } from "../components/SimpleChart";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@components/ui";
import { Users, DollarSign, Map, Video, Globe, MessageSquare, Activity, Star, Award, MapPin } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { Navigate } from "react-router-dom";
import type { AnalyticsPeriod } from "@/types";

const TABS = [
    { id: "users", label: "Users", icon: Users },
    { id: "revenue", label: "Revenue", icon: DollarSign },
    { id: "quests", label: "Quests", icon: Map },
    { id: "creators", label: "Creators", icon: Video },
    { id: "regions", label: "Regions", icon: Globe },
    { id: "content", label: "Content", icon: MessageSquare },
] as const;

export function AnalyticsPage() {
    const { user } = useAuthStore();
    const isAdmin = user?.role?.some(r => ["admin", "super_admin", "finance"].includes(r as any));
    
    const [activeTab, setActiveTab] = useState<typeof TABS[number]["id"]>("users");
    const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
    const [markerStatusToggle, setMarkerStatusToggle] = useState<"approved" | "rejected">("approved");
    
    const getDates = () => {
        const to = new Date().toISOString();
        const from = new Date();
        if (period === "7d") from.setDate(from.getDate() - 7);
        else if (period === "60d") from.setDate(from.getDate() - 60);
        else if (period === "90d") from.setDate(from.getDate() - 90);
        else from.setDate(from.getDate() - 30);
        return { from: from.toISOString(), to };
    };
    const { from, to } = getDates();

    if (user && !isAdmin) {
        return <Navigate to="/access-denied" replace />;
    }

    // --- Data Fetching ---
    const { data: userGrowth, isLoading: loadUG } = useQuery({ queryKey: ["admin-analytics-users-growth", period], queryFn: () => analyticsService.getUserGrowth(from, to), enabled: activeTab === "users" });
    const { data: activeUsers, isLoading: loadAU } = useQuery({ queryKey: ["admin-analytics-users-active", period], queryFn: () => analyticsService.getActiveUsers(from, to), enabled: activeTab === "users" });
    const { data: usersByRole } = useQuery({ queryKey: ["admin-analytics-users-by-role"], queryFn: analyticsService.getUsersByRole, enabled: activeTab === "users" });
    const { data: retention } = useQuery({ queryKey: ["admin-analytics-users-retention"], queryFn: () => analyticsService.getRetentionCohorts(), enabled: activeTab === "users" });

    const { data: revTotal, isLoading: loadRT } = useQuery({ queryKey: ["admin-analytics-revenue-total", period], queryFn: () => analyticsService.getRevenueTotal(from, to), enabled: activeTab === "revenue" });
    const { data: revOverTime } = useQuery({ queryKey: ["admin-analytics-revenue-over-time", period], queryFn: () => analyticsService.getRevenueOverTime(from, to), enabled: activeTab === "revenue" });
    const { data: revByQuest } = useQuery({ queryKey: ["admin-analytics-revenue-by-quest", period], queryFn: () => analyticsService.getRevenueByQuest(from, to), enabled: activeTab === "revenue" });
    const { data: revFunnel } = useQuery({ queryKey: ["admin-analytics-payments-funnel", period], queryFn: () => analyticsService.getPaymentsFunnel(from, to), enabled: activeTab === "revenue" });

    const { data: questStatus } = useQuery({ queryKey: ["admin-analytics-quests-status"], queryFn: analyticsService.getQuestsByStatus, enabled: activeTab === "quests" });
    const { data: questCompletion, isLoading: loadQC } = useQuery({ queryKey: ["admin-analytics-quests-completion", period], queryFn: () => analyticsService.getQuestCompletionRate(from, to), enabled: activeTab === "quests" });
    const { data: topQuests } = useQuery({ queryKey: ["admin-analytics-quests-top"], queryFn: () => analyticsService.getTopQuests(), enabled: activeTab === "quests" });
    const { data: questApprovalFunnel } = useQuery({ queryKey: ["admin-analytics-quests-approval-funnel"], queryFn: analyticsService.getQuestApprovalFunnel, enabled: activeTab === "quests" });
    const { data: questReviewSentiment, isLoading: loadQRS } = useQuery({ queryKey: ["admin-analytics-quests-review-sentiment"], queryFn: analyticsService.getQuestReviewSentiment, enabled: activeTab === "quests" });

    const { data: activeCreators, isLoading: loadAC } = useQuery({ queryKey: ["admin-analytics-creators-active"], queryFn: analyticsService.getActiveCreatorsCount, enabled: activeTab === "creators" });
    const { data: topCreators } = useQuery({ queryKey: ["admin-analytics-creators-top"], queryFn: () => analyticsService.getTopCreators(), enabled: activeTab === "creators" });
    const { data: creatorAppFunnel } = useQuery({ queryKey: ["admin-analytics-creators-application-funnel"], queryFn: analyticsService.getCreatorApplicationFunnel, enabled: activeTab === "creators" });

    const { data: topRegions } = useQuery({ queryKey: ["admin-analytics-regions-top"], queryFn: () => analyticsService.getTopRegions(), enabled: activeTab === "regions" });
    const { data: regionCoverage } = useQuery({ queryKey: ["admin-analytics-regions-coverage"], queryFn: analyticsService.getRegionCoverage, enabled: activeTab === "regions" });

    const { data: narrativesStatus } = useQuery({ queryKey: ["admin-analytics-content-narratives"], queryFn: analyticsService.getNarrativesByStatus, enabled: activeTab === "content" });
    const { data: taskCompletion } = useQuery({ queryKey: ["admin-analytics-content-tasks"], queryFn: analyticsService.getTaskCompletionByType, enabled: activeTab === "content" });
    const { data: achievementUnlockRates } = useQuery({ queryKey: ["admin-analytics-content-achievements"], queryFn: () => analyticsService.getAchievementsUnlockRates(), enabled: activeTab === "content" });
    const { data: markersContrib } = useQuery({ queryKey: ["admin-analytics-markers-contrib", period], queryFn: () => analyticsService.getMarkerContribution(from, to, period === "90d" ? "monthly" : "daily"), enabled: activeTab === "content" });

    const colors = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"];

    // --- Shared Render Helpers ---

    const renderSectionHeader = (title: string, description: string, actions?: React.ReactNode) => (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <div>
                <h2 className="text-xl font-bold text-neutral-900 tracking-tight">{title}</h2>
                <p className="text-sm text-neutral-500 mt-0.5">{description}</p>
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
        </div>
    );

    const renderChartCard = (title: string, description: string, children: React.ReactNode, extraClass = "") => (
        <Card className={`shadow-sm border-neutral-100 hover:shadow-md transition-shadow duration-300 overflow-hidden ${extraClass}`}>
            <CardHeader className="border-b border-neutral-100/60 pb-3 pt-5 px-6">
                <CardTitle className="text-base font-bold tracking-tight">{title}</CardTitle>
                <CardDescription className="text-neutral-500 mt-0.5 text-sm">{description}</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
                {children}
            </CardContent>
        </Card>
    );

    const renderTable = (headers: string[], rows: React.ReactNode, emptyMsg: string, isEmpty: boolean, maxH?: string) => (
        <div className={`overflow-x-auto ${maxH ? `max-h-[${maxH}] overflow-y-auto` : ''}`} style={maxH ? { maxHeight: maxH } : undefined}>
            <table className="min-w-full text-sm">
                <thead className="text-xs text-neutral-500 bg-neutral-50/80 uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className={`px-5 py-3 font-bold ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                    {rows}
                    {isEmpty && (
                        <tr><td colSpan={headers.length} className="px-5 py-8 text-center text-neutral-400">{emptyMsg}</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    // ========== USERS TAB ==========
    const renderUsersTab = () => (
        <div className="space-y-6 animate-fade-in">
            {renderSectionHeader(
                "User Engagement",
                `Activity and distribution over the last ${period.replace('d', ' days')}`,
                <PeriodSelector value={period} onChange={setPeriod} />
            )}

            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <AnalyticsCard
                    title={`Active Users (${period})`}
                    value={activeUsers?.data?.active_users || 0}
                    icon={Activity}
                    colorClass="ring-indigo-100 text-indigo-600"
                    isLoading={loadAU}
                />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {renderChartCard("User Growth", "New registrations over time", (
                    loadUG
                        ? <div className="h-[240px] bg-neutral-100 animate-pulse rounded-lg" />
                        : <SimpleLineChart data={(userGrowth?.data || []).map((d: any) => ({ label: d.period, value: d.count }))} color="#4f46e5" height={240} />
                ), "lg:col-span-2")}

                {renderChartCard("Users by Role", "Platform distribution", (
                    <SimpleDoughnutChart
                        data={(usersByRole?.data || []).map((r: any, i: number) => ({
                            label: r.role.replace('_', ' '), value: r.count, color: colors[i % colors.length]
                        }))}
                        height={180}
                    />
                ))}
            </div>

            {/* Cohorts table */}
            {renderChartCard("Monthly Signup Cohorts", "New user signups grouped by registration month",
                renderTable(
                    ["Cohort Month", "Signups"],
                    (retention?.data || []).map((c: any, i: number) => (
                        <tr key={i} className="hover:bg-neutral-50/60 transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-neutral-800">{c.cohort_month}</td>
                            <td className="px-5 py-3.5 text-indigo-600 font-bold text-right">{c.user_count}</td>
                        </tr>
                    )),
                    "No cohort data available",
                    !retention?.data || retention.data.length === 0
                )
            )}
        </div>
    );

    // ========== REVENUE TAB ==========
    const renderRevenueTab = () => (
        <div className="space-y-6 animate-fade-in">
            {renderSectionHeader(
                "Revenue Operations",
                `Financial metrics for the last ${period.replace('d', ' days')}`,
                <PeriodSelector value={period} onChange={setPeriod} />
            )}

            {/* KPI + Funnel row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                <AnalyticsCard
                    title={`Total Revenue (${period})`}
                    value={`$${revTotal?.data?.total_revenue?.toLocaleString() || 0}`}
                    icon={DollarSign}
                    colorClass="ring-emerald-100 text-emerald-600"
                    isLoading={loadRT}
                />

                {renderChartCard("Payments Funnel", "Transaction lifecycle", (
                    <div className="space-y-5">
                        {(['captured', 'failed', 'refunded'] as const).map((stage) => {
                            const val = revFunnel?.data?.transactions?.[stage] || revFunnel?.data?.refunds?.[stage] || 0;
                            const total = Math.max(revFunnel?.data?.transactions?.captured || 1, 1);
                            const percent = Math.min((val / total) * 100, 100);
                            const barColor = stage === 'captured' ? 'bg-emerald-500' : stage === 'failed' ? 'bg-rose-500' : 'bg-amber-500';
                            const badgeCls = stage === 'captured' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : stage === 'failed' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-700 ring-amber-200';
                            return (
                                <div key={stage}>
                                    <div className="flex justify-between items-center text-sm mb-1.5">
                                        <span className="font-semibold capitalize text-neutral-700">{stage}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ring-1 ${badgeCls}`}>{val} txns</span>
                                    </div>
                                    <div className="w-full bg-neutral-100 rounded-full h-2.5 overflow-hidden ring-1 ring-neutral-200/50">
                                        <div className={`${barColor} h-full rounded-full transition-all duration-700 ease-out`} style={{ width: `${Math.max(2, percent)}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ), "lg:col-span-2")}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {renderChartCard("Revenue Over Time", "Daily or weekly gross revenue", (
                    <SimpleLineChart
                        data={(revOverTime?.data || []).map((d: any) => ({ label: d.period, value: d.revenue }))}
                        color="#10b981"
                        height={260}
                    />
                ))}

                {renderChartCard("Revenue By Quest", "Top earning quests",
                    renderTable(
                        ["Quest Title", "Revenue", "Sales"],
                        (revByQuest?.data || []).map((q: any) => (
                            <tr key={q.quest_id} className="hover:bg-neutral-50/60 transition-colors">
                                <td className="px-5 py-3.5 font-semibold text-neutral-800">{q.quest_title}</td>
                                <td className="px-5 py-3.5 text-emerald-600 font-bold text-right">${q.revenue?.toLocaleString()}</td>
                                <td className="px-5 py-3.5 text-neutral-500 text-right">{q.count}</td>
                            </tr>
                        )),
                        "No revenue data available",
                        !revByQuest?.data || revByQuest.data.length === 0,
                        "280px"
                    )
                )}
            </div>
        </div>
    );

    // ========== QUESTS TAB ==========
    const renderQuestsTab = () => (
        <div className="space-y-6 animate-fade-in">
            {renderSectionHeader(
                "Quest Analytics",
                `Performance and metrics for the last ${period.replace('d', ' days')}`,
                <PeriodSelector value={period} onChange={setPeriod} />
            )}

            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <AnalyticsCard title={`Completion Rate (${period})`} value={`${questCompletion?.data?.completion_rate || 0}%`} icon={Activity} colorClass="ring-blue-100 text-blue-600" isLoading={loadQC} />
                <AnalyticsCard title="Average Quest Rating" value={`${questReviewSentiment?.data?.average_rating || 0} / 5`} icon={Star} colorClass="ring-amber-100 text-amber-600" isLoading={loadQRS} />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {renderChartCard("Quests by Status", "Current distribution of quests", (
                    <SimpleBarChart
                        data={(questStatus?.data || []).map((s: any) => ({
                            label: s.status, value: s.count, color: "#4f46e5"
                        }))}
                        height={260}
                    />
                ), "lg:col-span-2")}

                {renderChartCard("Quest Review Pipeline", "Current review stage for each quest under review", (
                    <SimpleDoughnutChart
                        data={(questApprovalFunnel?.data || []).map((s: any, i: number) => ({
                            label: s.action || s.status || "Unknown", value: s.count, color: colors[i % colors.length]
                        }))}
                        height={200}
                    />
                ))}
            </div>

            {/* Table */}
            {renderChartCard("Top Performing Quests", "Highest total completion counts",
                renderTable(
                    ["Quest Title", "Completions"],
                    (topQuests?.data || []).map((q: any) => (
                        <tr key={q.quest_id} className="hover:bg-neutral-50/60 transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-neutral-800">{q.title}</td>
                            <td className="px-5 py-3.5 text-blue-600 font-bold text-right">{q.completions}</td>
                        </tr>
                    )),
                    "No quest data available",
                    !topQuests?.data || topQuests.data.length === 0
                )
            )}
        </div>
    );

    // ========== CREATORS TAB ==========
    const renderCreatorsTab = () => (
        <div className="space-y-6 animate-fade-in">
            {renderSectionHeader("Creator Platform Overview", "Active creators and application pipeline")}

            {/* KPI + Funnel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                <AnalyticsCard title="Active Creators" value={activeCreators?.data?.active_creators || 0} icon={Video} colorClass="ring-indigo-100 text-indigo-600" isLoading={loadAC} />

                {renderChartCard("Application Funnel", "Application pipeline status", (
                    <SimpleDoughnutChart
                        data={(creatorAppFunnel?.data || []).map((s: any, i: number) => ({
                            label: s.status, value: s.count, color: colors[i % colors.length]
                        }))}
                        height={200}
                    />
                ), "lg:col-span-2")}
            </div>

            {/* Table */}
            {renderChartCard("Top Creators", "Most prolific creators by quest count",
                renderTable(
                    ["Creator Name", "Total Quests", "Total Earnings"],
                    (topCreators?.data || []).map((c: any) => (
                        <tr key={c.creator_id} className="hover:bg-neutral-50/60 transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-neutral-800">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs ring-1 ring-indigo-200 shrink-0">
                                        {c.name.charAt(0).toUpperCase()}
                                    </div>
                                    {c.name}
                                </div>
                            </td>
                            <td className="px-5 py-3.5 text-neutral-600 text-right">{c.total_quests}</td>
                            <td className="px-5 py-3.5 text-emerald-600 font-bold text-right">${c.total_earnings?.toLocaleString()}</td>
                        </tr>
                    )),
                    "No creator data available",
                    !topCreators?.data || topCreators.data.length === 0
                )
            )}
        </div>
    );

    // ========== REGIONS TAB ==========
    const renderRegionsTab = () => (
        <div className="space-y-6 animate-fade-in">
            {renderSectionHeader("Region Analytics", "Geographical distribution of quests")}

            {/* Top row with Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {renderChartCard("Region Coverage By Type", "Types of locations mapped", (
                    <SimpleDoughnutChart
                        data={(regionCoverage?.data || []).map((s: any, i: number) => ({
                            label: s.type || "Unknown", value: s.count, color: colors[i % colors.length]
                        }))}
                        height={240}
                    />
                ))}

                {renderChartCard("Top Regions by Quest Count", "Regions with the most published quests", (
                    <SimpleBarChart
                        data={(topRegions?.data || []).map((r: any) => ({
                            label: r.name, value: r.quests, color: "#8b5cf6"
                        }))}
                        height={240}
                    />
                ))}
            </div>

            {/* Bottom row with Table */}
            <div className="grid grid-cols-1 gap-5">
                {renderChartCard("Region Details", "Detailed quest counts per region",
                    renderTable(
                        ["Region Name", "Quest Count"],
                        (topRegions?.data || []).map((r: any) => (
                            <tr key={r.region_id} className="hover:bg-neutral-50/60 transition-colors">
                                <td className="px-5 py-3.5 font-semibold text-neutral-800">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-neutral-400 shrink-0" />
                                        {r.name}
                                    </div>
                                </td>
                                <td className="px-5 py-3.5 font-bold text-indigo-600 text-right">{r.quests}</td>
                            </tr>
                        )),
                        "No region data available",
                        !topRegions?.data || topRegions.data.length === 0,
                        "300px"
                    )
                )}
            </div>
        </div>
    );

    // ========== CONTENT TAB ==========
    const renderContentTab = () => (
        <div className="space-y-6 animate-fade-in">
            {renderSectionHeader(
                "Content Overview",
                `Narratives, task configs, and achievements across the platform`,
                <PeriodSelector value={period} onChange={setPeriod} />
            )}

            {/* Bar charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {renderChartCard("Narratives by Status", "Current state of story narratives", (
                    <SimpleBarChart
                        data={(narrativesStatus?.data || []).map((s: any) => ({
                            label: s.status, value: s.count, color: "#8b5cf6"
                        }))}
                        height={240}
                    />
                ))}

                {renderChartCard("Task Config Distribution", "Count of active task configs by type", (
                    <SimpleBarChart
                        data={(taskCompletion?.data || []).map((s: any) => ({
                            label: s.task_type, value: s.count, color: "#ec4899"
                        }))}
                        height={240}
                    />
                ))}
            </div>

            {/* Table + Line chart row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {renderChartCard("Achievement Unlock Rates", "Top achievements by total unlock count",
                    renderTable(
                        ["Achievement", "Unlocks"],
                        (achievementUnlockRates?.data || []).map((a: any) => (
                            <tr key={a.achievement_id} className="hover:bg-neutral-50/60 transition-colors">
                                <td className="px-5 py-3.5 font-semibold text-neutral-800">
                                    <div className="flex items-center gap-2">
                                        <Award className="w-4 h-4 text-amber-500 shrink-0" />
                                        {a.name}
                                    </div>
                                </td>
                                <td className="px-5 py-3.5 text-indigo-600 font-bold text-right">{a.unlocks?.toLocaleString()}</td>
                            </tr>
                        )),
                        "No achievement data available",
                        !achievementUnlockRates?.data || achievementUnlockRates.data.length === 0,
                        "260px"
                    )
                )}

                {renderChartCard("Marker Contribution Over Time", "Marker submissions over time by approval status", (
                    <div>
                        <div className="flex gap-2 mb-4 justify-end">
                            <button
                                onClick={() => setMarkerStatusToggle("approved")}
                                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${markerStatusToggle === "approved" ? "bg-indigo-100 text-indigo-700" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
                            >
                                Approved
                            </button>
                            <button
                                onClick={() => setMarkerStatusToggle("rejected")}
                                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${markerStatusToggle === "rejected" ? "bg-pink-100 text-pink-700" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
                            >
                                Rejected
                            </button>
                        </div>
                        <SimpleLineChart
                            data={(markersContrib?.data || [])
                                .filter((d: any) => d.status === markerStatusToggle)
                                .map((d: any) => ({ label: d.period, value: d.count }))}
                            color={markerStatusToggle === "approved" ? "#3b82f6" : "#ec4899"}
                            height={200}
                        />
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="animate-fade-in space-y-6 pb-12">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Analytics Suite</h1>
                    <p className="text-neutral-500 mt-1">Comprehensive data and insights across the platform</p>
                </div>
                <div className="text-sm font-medium text-neutral-500 bg-white px-4 py-2 rounded-full shadow-sm ring-1 ring-neutral-200/50 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live Data
                </div>
            </div>

            {/* Tab navigation */}
            <div className="bg-neutral-100/70 p-1.5 rounded-xl inline-flex overflow-x-auto max-w-full scrollbar-hide ring-1 ring-neutral-200/50 shadow-inner">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 whitespace-nowrap ${
                                isActive
                                    ? "bg-white text-indigo-700 shadow-md ring-1 ring-neutral-200/50"
                                    : "text-neutral-500 hover:text-neutral-800 hover:bg-white/50"
                            }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-neutral-400'}`} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            <div>
                {activeTab === "users" && renderUsersTab()}
                {activeTab === "revenue" && renderRevenueTab()}
                {activeTab === "quests" && renderQuestsTab()}
                {activeTab === "creators" && renderCreatorsTab()}
                {activeTab === "regions" && renderRegionsTab()}
                {activeTab === "content" && renderContentTab()}
            </div>
        </div>
    );
}
