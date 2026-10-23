import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "../services/analytics.service";
import { PeriodSelector } from "../components/PeriodSelector";
import { AnalyticsCard } from "../components/AnalyticsCard";
import { SimpleLineChart, SimpleBarChart, SimpleDoughnutChart } from "../components/SimpleChart";
import { Panel } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { useUrlState } from "@/hooks/useUrlState";
import { BarChart3, Users, DollarSign, Map, Video, Globe, MessageSquare, Activity, Star, Award, MapPin, Megaphone, Link2 } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { Navigate } from "react-router-dom";
import type { AnalyticsPeriod } from "@/types";
import { formatCurrency } from "@/utils/format";

const TABS = [
    { id: "users", label: "Users", icon: Users },
    { id: "acquisition", label: "Acquisition", icon: Megaphone },
    { id: "revenue", label: "Revenue", icon: DollarSign },
    { id: "quests", label: "Quests", icon: Map },
    { id: "creators", label: "Creators", icon: Video },
    { id: "regions", label: "Regions", icon: Globe },
    { id: "content", label: "Content", icon: MessageSquare },
] as const;

export function AnalyticsPage() {
    const { user } = useAuthStore();
    const isAdmin = user?.role?.some((r) => ["admin", "super_admin", "finance"].includes(r));
    
    // Tab and period live in the address, so a reload or a shared link keeps them.
    const { state: urlState, set: setUrl } = useUrlState({ tab: "users", period: "30d" });
    const activeTab: typeof TABS[number]["id"] = TABS.some((t) => t.id === urlState.tab) ? (urlState.tab as typeof TABS[number]["id"]) : "users";
    const setActiveTab = (tab: typeof TABS[number]["id"]) => setUrl({ tab });
    const period: AnalyticsPeriod = (["7d", "30d", "60d", "90d"] as const).find((p) => p === urlState.period) ?? "30d";
    const setPeriod = (p: AnalyticsPeriod) => setUrl({ period: p });
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

    // --- Data Fetching ---
    const { data: userGrowth, isLoading: loadUG } = useQuery({ queryKey: ["admin-analytics-users-growth", period], queryFn: () => analyticsService.getUserGrowth(from, to), enabled: activeTab === "users" });
    const { data: activeUsers, isLoading: loadAU } = useQuery({ queryKey: ["admin-analytics-users-active", period], queryFn: () => analyticsService.getActiveUsers(from, to), enabled: activeTab === "users" });
    const { data: usersByRole } = useQuery({ queryKey: ["admin-analytics-users-by-role"], queryFn: analyticsService.getUsersByRole, enabled: activeTab === "users" });
    const { data: retention } = useQuery({ queryKey: ["admin-analytics-users-retention"], queryFn: () => analyticsService.getRetentionCohorts(), enabled: activeTab === "users" });

    const { data: linkClicks, isLoading: loadLC } = useQuery({ queryKey: ["admin-analytics-acquisition-link-clicks", period], queryFn: () => analyticsService.getAcquisitionLinkClicks(from, to, period === "90d" ? "weekly" : "daily"), enabled: activeTab === "acquisition" });

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
    const { data: topRegionsByMarkers } = useQuery({ queryKey: ["admin-analytics-regions-top-markers"], queryFn: () => analyticsService.getTopRegions("markers", 10), enabled: activeTab === "regions" });
    const { data: regionCoverage } = useQuery({ queryKey: ["admin-analytics-regions-coverage"], queryFn: analyticsService.getRegionCoverage, enabled: activeTab === "regions" });

    const { data: narrativesStatus } = useQuery({ queryKey: ["admin-analytics-content-narratives"], queryFn: analyticsService.getNarrativesByStatus, enabled: activeTab === "content" });
    const { data: taskCompletion } = useQuery({ queryKey: ["admin-analytics-content-tasks"], queryFn: analyticsService.getTaskCompletionByType, enabled: activeTab === "content" });
    const { data: achievementUnlockRates } = useQuery({ queryKey: ["admin-analytics-content-achievements"], queryFn: () => analyticsService.getAchievementsUnlockRates(), enabled: activeTab === "content" });
    const { data: markersContrib } = useQuery({ queryKey: ["admin-analytics-markers-contrib", period, period === "90d" ? "monthly" : "daily"], queryFn: () => analyticsService.getMarkerContribution(from, to, period === "90d" ? "monthly" : "daily"), enabled: activeTab === "content" });

    if (user && !isAdmin) {
        return <Navigate to="/access-denied" replace />;
    }

    // Chart palette: brand teal first, then distinct hues that read on white.
    const colors = ["#00a49e", "#003634", "#fecd36", "#1d5fa8", "#b45309", "#5f9f9b", "#b91c1c", "#15803d"];

    // --- Shared Render Helpers ---

    const renderSectionHeader = (title: string, description: string, actions?: ReactNode) => (
        <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
                <h2 className="text-base font-semibold text-ink">{title}</h2>
                <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
            </div>
            {actions && <div className="max-w-full shrink-0">{actions}</div>}
        </div>
    );

    const renderChartCard = (title: string, description: string, children: ReactNode, extraClass = "") => (
        <Panel title={title} description={description} className={extraClass}>
            {children}
        </Panel>
    );

    const renderTable = (headers: string[], rows: ReactNode, emptyMsg: string, isEmpty: boolean, maxH?: string) => (
        <div className={`overflow-x-auto ${maxH ? `max-h-[${maxH}] overflow-y-auto` : ''}`} style={maxH ? { maxHeight: maxH } : undefined}>
            <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} scope="col" className={`px-5 py-3 font-semibold ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-line">
                    {rows}
                    {isEmpty && (
                        <tr><td colSpan={headers.length} className="px-5 py-8 text-center text-ink-faint">{emptyMsg}</td></tr>
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
                    isLoading={loadAU}
                />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {renderChartCard("User Growth", "New registrations over time", (
                    loadUG
                        ? <div className="h-[240px] bg-brand-50 animate-pulse rounded-lg" />
                        : <SimpleLineChart data={(userGrowth?.data || []).map((d: { period: string; count: number }) => ({ label: d.period, value: d.count }))} color="#4f46e5" height={240} />
                ), "lg:col-span-2")}

                {renderChartCard("Users by Role", "Platform distribution", (
                    <SimpleDoughnutChart
                        data={(usersByRole?.data || []).map((r: { role: string; count: number }, i: number) => ({
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
                    (retention?.data || []).map((c: { cohort_month: string; user_count: number }, i: number) => (
                        <tr key={i} className="hover:bg-surface-muted transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-ink">{c.cohort_month}</td>
                            <td className="px-5 py-3.5 text-accent-700 font-bold text-right">{c.user_count}</td>
                        </tr>
                    )),
                    "No cohort data available",
                    !retention?.data || retention.data.length === 0
                )
            )}
        </div>
    );

    // ========== ACQUISITION TAB ==========
    const renderAcquisitionTab = () => (
        <div className="space-y-6 animate-fade-in">
            {renderSectionHeader(
                "Marketing Acquisition",
                `Tracked-link clicks by campaign for the last ${period.replace('d', ' days')} (links: /api/v2/r/<campaign>)`,
                <PeriodSelector value={period} onChange={setPeriod} />
            )}

            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <AnalyticsCard
                    title={`Link Clicks (${period})`}
                    value={linkClicks?.data?.total_clicks || 0}
                    icon={Link2}
                    isLoading={loadLC}
                />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {renderChartCard("Clicks Over Time", "Tracked marketing link clicks", (
                    loadLC
                        ? <div className="h-[240px] bg-brand-50 animate-pulse rounded-lg" />
                        : <SimpleLineChart data={(linkClicks?.data?.series || []).map((d: { period: string; clicks: number }) => ({ label: d.period, value: d.clicks }))} color="#c026d3" height={240} />
                ), "lg:col-span-2")}

                {renderChartCard("Clicks by Campaign", "Which packs/campaigns drive store visits",
                    renderTable(
                        ["Campaign (src)", "Clicks"],
                        (linkClicks?.data?.by_src || []).map((r: { src: string; clicks: number }, index: number) => {
                            const campaignName = r.src || "Direct / Organic";
                            return (
                                <tr key={r.src || "unknown-" + index} className="hover:bg-surface-muted transition-colors">
                                    <td className="px-5 py-3.5 font-semibold text-ink font-mono text-xs">{campaignName}</td>
                                    <td className="px-5 py-3.5 text-fuchsia-600 font-bold text-right">{r.clicks}</td>
                                </tr>
                            );
                        }),
                        "No clicks yet — share tracked links from post packs",
                        !linkClicks?.data?.by_src || linkClicks.data.by_src.length === 0,
                        "280px"
                    )
                )}
            </div>
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
                    value={formatCurrency(revTotal?.data?.total_revenue ?? 0)}
                    icon={DollarSign}
                    isLoading={loadRT}
                />

                {renderChartCard("Payments Funnel", "Transaction lifecycle", (
                    <div className="space-y-5">
                        {(['captured', 'failed', 'refunded'] as const).map((stage) => {
                            const val = revFunnel?.data?.transactions?.[stage] || revFunnel?.data?.refunds?.[stage] || 0;
                            const total = Math.max(revFunnel?.data?.transactions?.captured || 1, 1);
                            const percent = Math.min((val / total) * 100, 100);
                            const barColor = stage === 'captured' ? 'bg-good' : stage === 'failed' ? 'bg-bad' : 'bg-warn';
                            const badgeCls = stage === 'captured' ? 'bg-good-soft text-good ring-good-line' : stage === 'failed' ? 'bg-bad-soft text-bad ring-bad-line' : 'bg-warn-soft text-warn ring-warn-line';
                            return (
                                <div key={stage}>
                                    <div className="flex justify-between items-center text-sm mb-1.5">
                                        <span className="font-semibold capitalize text-ink">{stage}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ring-1 ${badgeCls}`}>{val} txns</span>
                                    </div>
                                    <div className="w-full bg-brand-50 rounded-full h-2.5 overflow-hidden ring-1 ring-line">
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
                        data={(revOverTime?.data || []).map((d: { period: string; revenue: number }) => ({ label: d.period, value: d.revenue }))}
                        color="#10b981"
                        height={260}
                    />
                ))}

                {renderChartCard("Revenue By Quest", "Top earning quests",
                    renderTable(
                        ["Quest Title", "Revenue", "Sales"],
                        (revByQuest?.data || []).map((q: { quest_id: string; quest_title: string; revenue: number; count: number }) => (
                            <tr key={q.quest_id} className="hover:bg-surface-muted transition-colors">
                                <td className="px-5 py-3.5 font-semibold text-ink">{q.quest_title}</td>
                                <td className="px-5 py-3.5 text-good font-bold text-right">{formatCurrency(q.revenue)}</td>
                                <td className="px-5 py-3.5 text-ink-muted text-right">{q.count}</td>
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
                <AnalyticsCard title={`Completion Rate (${period})`} value={`${questCompletion?.data?.completion_rate || 0}%`} icon={Activity} isLoading={loadQC} />
                <AnalyticsCard title="Average Quest Rating" value={`${questReviewSentiment?.data?.average_rating || 0} / 5`} icon={Star} isLoading={loadQRS} />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {renderChartCard("Quests by Status", "Current distribution of quests", (
                    <SimpleBarChart
                        data={(questStatus?.data || []).map((s: { status: string; count: number }) => ({
                            label: s.status, value: s.count, color: "#4f46e5"
                        }))}
                        height={260}
                    />
                ), "lg:col-span-2")}

                {renderChartCard("Quest Review Pipeline", "Count of quests at each review stage", (
                    <SimpleDoughnutChart
                        data={(questApprovalFunnel?.data || []).map((s: { action: string; count: number }, i: number) => ({
                            label: s.action || "Unknown", value: s.count, color: colors[i % colors.length]
                        }))}
                        height={200}
                    />
                ))}
            </div>

            {/* Table */}
            {renderChartCard("Top Performing Quests", "Highest total completion counts",
                renderTable(
                    ["Quest Title", "Completions"],
                    (topQuests?.data || []).map((q: { quest_id: string; title: string; completions: number }) => (
                        <tr key={q.quest_id} className="hover:bg-surface-muted transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-ink">{q.title}</td>
                            <td className="px-5 py-3.5 text-info font-bold text-right">{q.completions}</td>
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
                <AnalyticsCard title="Active Creators" value={activeCreators?.data?.active_creators || 0} icon={Video} isLoading={loadAC} />

                {renderChartCard("Application Funnel", "Application pipeline status", (
                    <SimpleDoughnutChart
                        data={(creatorAppFunnel?.data || []).map((s: { status: string; count: number }, i: number) => ({
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
                    (topCreators?.data || []).map((c: { creator_id: string; name: string; total_quests: number; total_earnings: number }) => (
                        <tr key={c.creator_id} className="hover:bg-surface-muted transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-ink">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-accent-50 text-accent-700 flex items-center justify-center font-bold text-xs ring-1 ring-accent-200 shrink-0">
                                        {c.name.charAt(0).toUpperCase()}
                                    </div>
                                    {c.name}
                                </div>
                            </td>
                            <td className="px-5 py-3.5 text-ink-muted text-right">{c.total_quests}</td>
                            <td className="px-5 py-3.5 text-good font-bold text-right">{formatCurrency(c.total_earnings)}</td>
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
                        data={(regionCoverage?.data || []).map((s: { type?: string; count: number }, i: number) => ({
                            label: s.type || "Unknown", value: s.count, color: colors[i % colors.length]
                        }))}
                        height={240}
                    />
                ))}

                {renderChartCard("Top Regions by Quest Count", "Regions with the most published quests", (
                    <SimpleBarChart
                        data={(topRegions?.data || []).map((r: { name: string; quests: number }) => ({
                            label: r.name, value: r.quests, color: "#8b5cf6"
                        }))}
                        height={240}
                    />
                ))}
            </div>

            {/* Bottom row with Table */}
            <div className="grid grid-cols-1 gap-5">
                {renderChartCard("Top Regions by Markers", "Cities ranked by total marker count across hotspots",
                    renderTable(
                        ["Region Name", "Marker Count"],
                        (topRegionsByMarkers?.data || []).map((r: { region_id: string; name: string; markers: number }) => (
                            <tr key={r.region_id} className="hover:bg-surface-muted transition-colors">
                                <td className="px-5 py-3.5 font-semibold text-ink">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-ink-faint shrink-0" />
                                        {r.name}
                                    </div>
                                </td>
                                <td className="px-5 py-3.5 font-bold text-purple-600 text-right">{r.markers}</td>
                            </tr>
                        )),
                        "No region data available",
                        !topRegionsByMarkers?.data || topRegionsByMarkers.data.length === 0,
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
                        data={(narrativesStatus?.data || []).map((s: { status: string; count: number }) => ({
                            label: s.status, value: s.count, color: "#8b5cf6"
                        }))}
                        height={240}
                    />
                ))}

                {renderChartCard("Task Config Distribution", "Count of active task configs by type", (
                    <SimpleBarChart
                        data={(taskCompletion?.data || []).map((s: { task_type: string; count: number }) => ({
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
                        (achievementUnlockRates?.data || []).map((a: { achievement_id: string; name: string; unlocks: number }) => (
                            <tr key={a.achievement_id} className="hover:bg-surface-muted transition-colors">
                                <td className="px-5 py-3.5 font-semibold text-ink">
                                    <div className="flex items-center gap-2">
                                        <Award className="w-4 h-4 text-warn shrink-0" />
                                        {a.name}
                                    </div>
                                </td>
                                <td className="px-5 py-3.5 text-accent-700 font-bold text-right">{a.unlocks?.toLocaleString()}</td>
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
                                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${markerStatusToggle === "approved" ? "bg-accent-50 text-accent-700" : "bg-brand-50 text-ink-muted hover:bg-brand-50"}`}
                            >
                                Approved
                            </button>
                            <button
                                onClick={() => setMarkerStatusToggle("rejected")}
                                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${markerStatusToggle === "rejected" ? "bg-bad-soft text-bad" : "bg-brand-50 text-ink-muted hover:bg-brand-50"}`}
                            >
                                Rejected
                            </button>
                        </div>
                        <SimpleLineChart
                            data={(markersContrib?.data || [])
                                .filter((d: { status: string; period: string; count: number }) => d.status === markerStatusToggle)
                                .map((d: { status: string; period: string; count: number }) => ({ label: d.period, value: d.count }))}
                            color={markerStatusToggle === "approved" ? "#3b82f6" : "#ec4899"}
                            height={200}
                        />
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-5">
            <PageHeader icon={BarChart3} title="Analytics" description="Growth, revenue and content trends across the platform" />

            <Tabs
                label="Analytics sections"
                value={activeTab}
                onChange={setActiveTab}
                tabs={TABS.map((tab) => ({
                    value: tab.id,
                    label: (
                        <span className="inline-flex items-center gap-2">
                            <tab.icon className="h-4 w-4" aria-hidden />
                            {tab.label}
                        </span>
                    ),
                }))}
            />

            {/* Tab content */}
            <div>
                {activeTab === "users" && renderUsersTab()}
                {activeTab === "acquisition" && renderAcquisitionTab()}
                {activeTab === "revenue" && renderRevenueTab()}
                {activeTab === "quests" && renderQuestsTab()}
                {activeTab === "creators" && renderCreatorsTab()}
                {activeTab === "regions" && renderRegionsTab()}
                {activeTab === "content" && renderContentTab()}
            </div>
        </div>
    );
}
