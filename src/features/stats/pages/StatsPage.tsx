import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@components/ui";
import { Users, Mail, Phone, Calendar, Download, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { statsService } from "../services/stats.service";
import { StatsCard } from "../components/StatsCard";
import { useState } from "react";
import { LoadingFallback } from "@components/LoadingFallback";
import { toast } from 'sonner';
import { useAuthStore } from "@store/auth.store";
import { Navigate } from "react-router-dom";

export function StatsPage() {
    const { user } = useAuthStore();

    // 1. RBAC Check: Allow admin, super_admin, moderator, finance
    const ALLOWED_ROLES = ['admin', 'super_admin', 'moderator', 'finance'];
    if (user && !ALLOWED_ROLES.includes(user.role)) {
        return <Navigate to="/access-denied" replace />;
    }

    const isAdmin = user && ['admin', 'super_admin'].includes(user.role);

    // 2. Query Stats - Only if Admin/Super Admin
    // If not admin, we skip the query (enabled: false) or ignore the result
    const { data: stats, isLoading, error } = useQuery({
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
                    Last updated: {new Date().toLocaleTimeString()}
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
                            You have access to the dashboard. Please use the sidebar to navigate to your specific modules.
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            {/* Content for Admins Only */}
            {isAdmin && (
                <>
                    {/* Key Metrics Grid */}
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

                    {/* Data Export Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Download className="w-5 h-5" />
                                Data Export
                            </CardTitle>
                            <CardDescription>
                                Export user interest data to CSV based on registration date.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row gap-4 items-end">
                                <div className="w-full sm:w-auto">
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        From Date
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                    />
                                </div>
                                <div className="w-full sm:w-auto">
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        To Date
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleExport}
                                    disabled={isExporting}
                                    className={`
                                        w-full sm:w-auto px-4 py-2 bg-neutral-900 text-white rounded-md font-medium 
                                        hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2
                                        ${isExporting ? 'opacity-70 cursor-not-allowed' : ''}
                                    `}
                                >
                                    {isExporting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Exporting...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-4 h-4" />
                                            Export CSV
                                        </>
                                    )}
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
