import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    UserPlus, AlertTriangle,
    ChevronLeft, ChevronRight, Filter,
} from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { LoadingFallback } from "@components/LoadingFallback";
import { FilterDropdown } from "@/features/users/components/FilterDropdown";
import { usePaginationRange } from "@/features/users/hooks/usePagination";
import { creatorApplicationsService } from "../services/creator-applications.service";
import { ApplicationDetailModal } from "../components/ApplicationDetailModal";
import type { DropdownOption } from "@/features/users/components/FilterDropdown";
import type { CreatorApplication } from "@/types";

// ---- Constants ----
const ALLOWED_ROLES = ["admin", "super_admin"];
const PER_PAGE = 20;

const STATUS_OPTIONS: DropdownOption[] = [
    { value: "", label: "All Statuses" },
    { value: "pending", label: "Pending", dot: "bg-amber-500" },
    { value: "approved", label: "Approved", dot: "bg-emerald-500" },
    { value: "rejected", label: "Rejected", dot: "bg-red-500" },
];

const statusConfig: Record<CreatorApplication["status"], { label: string; dot: string; bg: string }> = {
    pending: { label: "Pending", dot: "bg-amber-500", bg: "bg-amber-50 text-amber-700 border-amber-200" },
    approved: { label: "Approved", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { label: "Rejected", dot: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200" },
};

export function CreatorApplicationsPage() {
    const { user: currentUser } = useAuthStore();
    const hasAccess = !!currentUser && ALLOWED_ROLES.includes(currentUser.role);

    // ---- State ----
    const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "">("pending");
    const [page, setPage] = useState(1);

    // Modal state
    const [viewingApp, setViewingApp] = useState<CreatorApplication | null>(null);

    // ---- Fetch Applications ----
    const queryParams = useMemo(() => ({
        status: statusFilter ? statusFilter : undefined,
        page,
        limit: PER_PAGE,
    }), [statusFilter, page]);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-creator-applications", queryParams],
        queryFn: () => creatorApplicationsService.listApplications(queryParams),
        placeholderData: (prev) => prev,
    });

    const applications = useMemo(() => data?.applications ?? [], [data]);
    const pagination = data?.pagination;
    const pendingCount = data?.pending_count ?? 0;

    const clearFilters = useCallback(() => {
        setStatusFilter("");
        setPage(1);
    }, []);

    // ---- Pagination ----
    const totalPages = pagination?.total_pages ?? 1;
    const paginationRange = usePaginationRange(totalPages, page);

    // ---- Render ----
    if (!hasAccess) {
        return <AccessDenied message="Only admins can manage creator applications." />;
    }

    return (
        <div className="p-6 max-w-[1400px] mx-auto space-y-5 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm">
                        <UserPlus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-3">
                            Creator Applications
                            {pendingCount > 0 && (
                                <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                    {pendingCount} Pending
                                </span>
                            )}
                        </h1>
                        <p className="text-sm text-neutral-500">
                            {pagination ? `${pagination.total} total applications` : "Loading..."}
                        </p>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3 flex items-center gap-3">
                <FilterDropdown
                    options={STATUS_OPTIONS}
                    value={statusFilter}
                    onChange={(v) => { setStatusFilter(v as "pending" | "approved" | "rejected" | ""); setPage(1); }}
                    icon={<Filter className="w-3.5 h-3.5" />}
                    placeholder="Status"
                />

                {statusFilter && (
                    <button
                        onClick={clearFilters}
                        className="px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                {isLoading && !data ? (
                    <LoadingFallback />
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-16 text-red-500 gap-2">
                        <AlertTriangle className="w-8 h-8" />
                        <p className="text-sm">Failed to load applications</p>
                    </div>
                ) : applications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-neutral-400 gap-2">
                        <UserPlus className="w-8 h-8 opacity-50" />
                        <p className="text-sm">No applications found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Applicant</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Contact</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Status</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Applied</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {applications.map((u) => {
                                    const sc = statusConfig[u.status];
                                    return (
                                        <tr
                                            key={u._id}
                                            className="transition-colors group hover:bg-neutral-50/80 cursor-pointer"
                                            onClick={() => setViewingApp(u)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-neutral-900">{u.name}</div>
                                                <div className="text-[11px] text-neutral-400 font-mono mt-0.5">{u._id}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-neutral-600 truncate max-w-[200px]">{u.email}</div>
                                                {u.phone && <div className="text-[11px] text-neutral-400 mt-0.5">{u.phone}</div>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.bg}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                                    {sc.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                                                {new Date(u.applied_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.total_pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 bg-neutral-50/30">
                        <span className="text-sm text-neutral-500">
                            Page <span className="font-medium text-neutral-700">{pagination.page}</span> of <span className="font-medium text-neutral-700">{pagination.total_pages}</span>
                            <span className="ml-2 text-neutral-400">({pagination.total} total)</span>
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {paginationRange.map((p, idx) =>
                                p === "..." ? (
                                    <span key={`ellipsis-${idx}`} className="px-1 text-neutral-400 text-sm">…</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p as number)}
                                        className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all ${p === page
                                            ? "bg-indigo-600 text-white shadow-sm"
                                            : "text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
                                            }`}
                                    >
                                        {p}
                                    </button>
                                )
                            )}
                            <button
                                onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                                disabled={page >= pagination.total_pages}
                                className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Application Detail Modal - For review/approve/reject */}
            <ApplicationDetailModal
                open={!!viewingApp}
                application={viewingApp}
                onClose={() => setViewingApp(null)}
            />
        </div>
    );
}
