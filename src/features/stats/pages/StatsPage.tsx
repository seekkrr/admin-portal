import { Card, CardHeader, CardTitle, CardDescription } from "@components/ui";
import { Users, Mail, Phone, Calendar, Download, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { statsService } from "../services/stats.service";
import { StatsCard } from "../components/StatsCard";
import { useState } from "react";
import { LoadingFallback } from "@components/LoadingFallback";
import { toast } from 'sonner';
import { useAuthStore } from "@store/auth.store";
import { Navigate } from "react-router-dom";

// Roles configuration moved outside component to prevent recreation on render
const ALLOWED_ROLES = ['admin', 'super_admin', 'moderator', 'finance'];
const ADMIN_ROLES = ['admin', 'super_admin'];

export function StatsPage() {
    const { user } = useAuthStore();

    // 1. RBAC Check
    if (user && !ALLOWED_ROLES.includes(user.role)) {
        return <Navigate to="/access-denied" replace />;
    }

    const isAdmin = user && ADMIN_ROLES.includes(user.role);

    // 2. Query Stats - Only if Admin/Super Admin
    // If not admin, we skip the query (enabled: false) or ignore the result
    const { data: stats, isLoading, error, dataUpdatedAt } = useQuery({
        queryKey: ["admin-stats"],
        queryFn: statsService.getStats,
        enabled: !!isAdmin, // Only fetch if admin
        retry: 1
    });

    const [fromDate, setFromDate] = useState<string>("");
    const [toDate, setToDate] = useState<string>("");
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        try {
            setIsExporting(true);
            const start = fromDate ? new Date(fromDate) : undefined;
            const end = toDate ? new Date(toDate) : undefined;

            await statsService.exportInterests(start, end);
            toast.success("Export completed successfully");
        } catch (err: unknown) {
            console.error("Export failed:", err);
            toast.error("Failed to export data. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    if (isAdmin && isLoading) {
        return <LoadingFallback message="Loading stats..." />;
    }

    if (isAdmin && error) {
        return (
            <div className="p-6 text-center text-red-500">
                Failed to load statistics. Please try refreshing the page.
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-neutral-900">Dashboard & Stats</h1>
                <div className="text-sm text-neutral-500">
                    Last updated: {isAdmin && stats && dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : new Date().toLocaleTimeString()}
                </div>
            </div>

            {/* Key Metrics Grid */}
            {/* Content for Non-Admins (Moderator/Finance) */}
            {!isAdmin && (
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
            )}

            {/* Content for Admins Only */}
            {isAdmin && (
                <>
                    {/* Section 1: User Interest Statistics */}
                    <section className="space-y-6">
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-neutral-900 tracking-tight">User Interest Statistics</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <StatsCard
                                    title="Total Interests"
                                    value={stats?.total || 0}
                                    icon={Users}
                                    description="Total users registered"
                                />
                                <StatsCard
                                    title="With Email"
                                    value={stats?.with_email || 0}
                                    icon={Mail}
                                    description="Users provided email"
                                />
                                <StatsCard
                                    title="With Phone"
                                    value={stats?.with_phone || 0}
                                    icon={Phone}
                                    description="Users provided phone"
                                />
                                <StatsCard
                                    title="Last 7 Days"
                                    value={stats?.recent_7_days || 0}
                                    icon={Calendar}
                                    description="New registrations this week"
                                />
                            </div>
                        </div>

                        {/* Data Export - Integrated into Interest Stats */}
                        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                <div>
                                    <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                                        <span className="p-2 bg-neutral-100 rounded-lg">
                                            <Download className="w-4 h-4 text-neutral-700" />
                                        </span>
                                        Export Interest Data
                                    </h3>
                                    <p className="text-sm text-neutral-500 mt-2 ml-10 max-w-md">
                                        Download a detailed CSV report of user interests. Select a date range to filter the records.
                                    </p>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 ml-10 lg:ml-0">
                                    <div className="w-full sm:w-auto">
                                        <input
                                            type="date"
                                            className="w-full sm:w-40 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900/20 transition-all cursor-default [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:hover:opacity-80 hover:bg-neutral-100"
                                            value={fromDate}
                                            onChange={(e) => setFromDate(e.target.value)}
                                            onKeyDown={(e) => e.preventDefault()}
                                            placeholder="From"
                                        />
                                    </div>
                                    <div className="w-full sm:w-auto">
                                        <input
                                            type="date"
                                            className="w-full sm:w-40 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900/20 transition-all cursor-default [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:hover:opacity-80 hover:bg-neutral-100"
                                            value={toDate}
                                            onChange={(e) => setToDate(e.target.value)}
                                            onKeyDown={(e) => e.preventDefault()}
                                            placeholder="To"
                                        />
                                    </div>
                                    <button
                                        onClick={handleExport}
                                        disabled={isExporting}
                                        className={`
                                            px-5 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium 
                                            hover:bg-neutral-800 active:transform active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm
                                            ${isExporting ? 'opacity-70 cursor-not-allowed' : ''}
                                        `}
                                    >
                                        {isExporting ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Exporting...
                                            </>
                                        ) : (
                                            <>
                                                <span>Export CSV</span>
                                                <Download className="w-3.5 h-3.5 opacity-70" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="border-t border-neutral-200" />

                    {/* Section 2: User Statistics */}
                    <UserStatsSection isAdmin={isAdmin} />
                </>
            )}
        </div>
    );
}

function UserStatsSection({ isAdmin }: { isAdmin: boolean }) {
    const [showSystemRoles, setShowSystemRoles] = useState(false);

    // Queries for User Stats
    const { data: activeUsers } = useQuery({
        queryKey: ["stats-users-active"],
        queryFn: () => statsService.getUserCount({ status: 'active', role: 'user' }),
        enabled: isAdmin,
    });

    const { data: activeCreators } = useQuery({
        queryKey: ["stats-creators-active"],
        queryFn: () => statsService.getUserCount({ status: 'active', is_creator: true }),
        enabled: isAdmin,
    });

    const { data: admins } = useQuery({
        queryKey: ["stats-admins"],
        queryFn: () => statsService.getUserCount({ role: 'admin' }),
        enabled: isAdmin && showSystemRoles,
    });

    const { data: superAdmins } = useQuery({
        queryKey: ["stats-super-admins"],
        queryFn: () => statsService.getUserCount({ role: 'super_admin' }),
        enabled: isAdmin && showSystemRoles,
    });

    const { data: moderators } = useQuery({
        queryKey: ["stats-moderators"],
        queryFn: () => statsService.getUserCount({ role: 'moderator' }),
        enabled: isAdmin && showSystemRoles,
    });

    const { data: finance } = useQuery({
        queryKey: ["stats-finance"],
        queryFn: () => statsService.getUserCount({ role: 'finance' }),
        enabled: isAdmin && showSystemRoles,
    });

    if (!isAdmin) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-neutral-900">User Statistics</h2>
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="showSystemRoles"
                        checked={showSystemRoles}
                        onChange={(e) => setShowSystemRoles(e.target.checked)}
                        className="w-4 h-4 text-neutral-900 border-neutral-300 rounded focus:ring-neutral-900"
                    />
                    <label htmlFor="showSystemRoles" className="text-sm font-medium text-neutral-700 cursor-pointer select-none">
                        Include System Roles
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Active Users"
                    value={activeUsers || 0}
                    icon={Users}
                    description="Regular users with active status"
                />
                <StatsCard
                    title="Active Creators"
                    value={activeCreators || 0}
                    icon={BarChart3}
                    description="Users with creator privileges"
                />

                {showSystemRoles && (
                    <>
                        <StatsCard
                            title="Super Admins"
                            value={superAdmins || 0}
                            icon={Users}
                            description="System Super Admins"
                            className="bg-neutral-50/50 border-dashed"
                        />
                        <StatsCard
                            title="Admins"
                            value={admins || 0}
                            icon={Users}
                            description="System Administrators"
                            className="bg-neutral-50/50 border-dashed"
                        />
                        <StatsCard
                            title="Moderators"
                            value={moderators || 0}
                            icon={Users}
                            description="Content Moderators"
                            className="bg-neutral-50/50 border-dashed"
                        />
                        <StatsCard
                            title="Finance Team"
                            value={finance || 0}
                            icon={Users}
                            description="Finance Managers"
                            className="bg-neutral-50/50 border-dashed"
                        />
                    </>
                )}
            </div>
        </div>
    );
}
