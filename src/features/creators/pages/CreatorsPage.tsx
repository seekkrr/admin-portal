import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Search, Users, ChevronLeft, ChevronRight,
    RefreshCw, AlertTriangle, CheckCircle2,
    X, Filter, TrendingUp, Star, BadgeCheck, UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { LoadingFallback } from "@components/LoadingFallback";
import { creatorsService } from "../services/creators.service";
import { FilterDropdown } from "@/features/users/components/FilterDropdown";
import { usePaginationRange } from "@/features/users/hooks/usePagination";
import { CreatorDetailModal } from "../components/CreatorDetailModal";
import type { DropdownOption } from "@/features/users/components/FilterDropdown";
import type { CreatorEnriched } from "../services/creators.service";

// ---- Constants ----
const ALLOWED_ROLES = ["admin", "super_admin", "finance"];
const PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;

// ---- Badge Styles ----
const creatorStatusConfig: Record<string, { label: string; dot: string; bg: string }> = {
    active: { label: "Active", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { label: "Rejected", dot: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200" },
    suspended: { label: "Suspended", dot: "bg-neutral-400", bg: "bg-neutral-100 text-neutral-700 border-neutral-300" },
};

// ---- Filter Dropdown Options ----
const STATUS_OPTIONS: DropdownOption[] = [
    { value: "", label: "All Statuses" },
    { value: "active", label: "Active", dot: "bg-emerald-500" },
    { value: "rejected", label: "Rejected", dot: "bg-red-500" },
    { value: "suspended", label: "Suspended", dot: "bg-neutral-400" },
];

const VERIFIED_OPTIONS: DropdownOption[] = [
    { value: "", label: "All" },
    { value: "true", label: "Verified", dot: "bg-emerald-500" },
    { value: "false", label: "Unverified", dot: "bg-neutral-400" },
];

// ---- Provision Creator Modal ----
function ProvisionCreatorModal({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient();
    const [userId, setUserId] = useState("");

    const isValidObjectId = /^[0-9a-f]{24}$/i.test(userId.trim());

    const provisionMutation = useMutation({
        mutationFn: (uid: string) => creatorsService.provisionCreator(uid),
        onSuccess: () => {
            toast.success("Creator provisioned successfully");
            queryClient.invalidateQueries({ queryKey: ["admin-creators"] });
            queryClient.invalidateQueries({ queryKey: ["admin-creator-platform-stats"] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["admin-user-stats"] });
            onClose();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 animate-slide-up" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-neutral-900 mb-1 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-teal-600" /> Provision Creator
                </h3>
                <p className="text-sm text-neutral-500 mb-5">
                    Directly grant creator status to a user, bypassing the application workflow.
                </p>
                <input
                    type="text"
                    placeholder="Paste User ID (24-char hex)..."
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 mb-1 transition-colors ${
                        userId.trim() && !isValidObjectId ? "border-red-300 bg-red-50" : "border-neutral-200"
                    }`}
                    disabled={provisionMutation.isPending}
                />
                {userId.trim() && !isValidObjectId && (
                    <p className="text-xs text-red-600 mb-3">Invalid format — must be a 24-character hex string</p>
                )}
                {(!userId.trim() || isValidObjectId) && <div className="mb-3" />}
                <div className="flex gap-2">
                    <button onClick={onClose} disabled={provisionMutation.isPending} className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50">
                        Cancel
                    </button>
                    <button
                        onClick={() => provisionMutation.mutate(userId.trim())}
                        disabled={!isValidObjectId || provisionMutation.isPending}
                        className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
                    >
                        {provisionMutation.isPending ? "Provisioning..." : "Provision"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---- Main Component ----
export function CreatorsPage() {
    const { user: currentUser } = useAuthStore();
    const queryClient = useQueryClient();
    const hasAccess = !!currentUser && currentUser.role?.some(r => ALLOWED_ROLES.includes(r as any));
    const isAdmin = !!currentUser && currentUser.role?.some(r => ["admin", "super_admin"].includes(r as any));

    // ---- State ----
    const [searchInput, setSearchInput] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [verifiedFilter, setVerifiedFilter] = useState("");
    const [page, setPage] = useState(1);
    const [viewingCreator, setViewingCreator] = useState<CreatorEnriched | null>(null);
    const [showProvision, setShowProvision] = useState(false);

    // ---- Debounced search ----
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchInput.trim());
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // ---- Fetch Platform Stats ----
    const { data: platformStats } = useQuery({
        queryKey: ["admin-creator-platform-stats"],
        queryFn: () => creatorsService.getPlatformStats(),
        staleTime: 60_000,
        enabled: isAdmin,
    });

    // ---- Fetch Creators ----
    const queryParams = useMemo(() => ({
        search: debouncedQuery || undefined,
        status: statusFilter || undefined,
        is_verified: verifiedFilter !== "" ? verifiedFilter === "true" : undefined,
        page,
        page_size: PER_PAGE,
    }), [debouncedQuery, statusFilter, verifiedFilter, page]);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-creators", queryParams],
        queryFn: () => creatorsService.listCreators(queryParams),
        placeholderData: (prev) => prev,
    });

    const creators = useMemo(() => data?.creators ?? [], [data]);
    const pagination = data?.pagination;

    const clearFilters = useCallback(() => {
        setSearchInput("");
        setDebouncedQuery("");
        setStatusFilter("");
        setVerifiedFilter("");
        setPage(1);
    }, []);

    // ---- Reload mutation (used in the retry button) ----
    const hasFilters = !!(searchInput || statusFilter || verifiedFilter);

    // ---- Pagination ----
    const totalPages = pagination?.total_pages ?? 1;
    const paginationRange = usePaginationRange(totalPages, page);

    // ---- Render ----
    if (!hasAccess) {
        return <AccessDenied message="Only admins and finance can manage creators." />;
    }

    return (
        <div className="p-6 max-w-[1400px] mx-auto space-y-5 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">Manage Creators</h1>
                        <p className="text-sm text-neutral-500">
                            {pagination ? `${pagination.total} total creators` : "Loading..."}
                        </p>
                    </div>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowProvision(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
                    >
                        <UserPlus className="w-4 h-4" /> Provision Creator
                    </button>
                )}
            </div>

            {/* Platform Stats */}
            {platformStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="w-4 h-4 text-teal-500" />
                            <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Total</span>
                        </div>
                        <div className="text-2xl font-bold text-neutral-900">{platformStats.total_creators?.toLocaleString() ?? "—"}</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Active</span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-700">{(platformStats.by_status?.active ?? 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <BadgeCheck className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Verified</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-700">{platformStats.verified_creators?.toLocaleString() ?? "—"}</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Star className="w-4 h-4 text-amber-500" />
                            <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Suspended</span>
                        </div>
                        <div className="text-2xl font-bold text-amber-700">{(platformStats.by_status?.suspended ?? 0).toLocaleString()}</div>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[260px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search creators by name..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                        />
                        {searchInput && (
                            <button
                                onClick={() => { setSearchInput(""); setDebouncedQuery(""); setPage(1); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <FilterDropdown
                        options={STATUS_OPTIONS}
                        value={statusFilter}
                        onChange={(v) => { setStatusFilter(v); setPage(1); }}
                        icon={<Filter className="w-3.5 h-3.5" />}
                        placeholder="Status"
                    />

                    <FilterDropdown
                        options={VERIFIED_OPTIONS}
                        value={verifiedFilter}
                        onChange={(v) => { setVerifiedFilter(v); setPage(1); }}
                        icon={<BadgeCheck className="w-3.5 h-3.5" />}
                        placeholder="Verified"
                    />

                    {hasFilters && (
                        <button
                            onClick={clearFilters}
                            className="px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                {isLoading && !data ? (
                    <LoadingFallback />
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-16 text-red-500 gap-2">
                        <AlertTriangle className="w-8 h-8" />
                        <p className="text-sm">Failed to load creators</p>
                        <button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-creators"] })} className="text-sm text-teal-600 hover:underline">
                            Retry
                        </button>
                    </div>
                ) : creators.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-neutral-400 gap-2">
                        <Users className="w-8 h-8" />
                        <p className="text-sm">No creators found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Creator</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Status</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Verified</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Quests</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Earnings</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Joined</th>
                                    <th className="text-right px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {creators.map((c) => {
                                    const sc = creatorStatusConfig[c.status] ?? creatorStatusConfig.active;
                                    const displayName = c.name ?? c.id;
                                    return (
                                        <tr
                                            key={c.id}
                                            className="transition-colors group hover:bg-neutral-50/80 cursor-pointer"
                                            onClick={() => setViewingCreator(c)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-neutral-900">{displayName}</div>
                                                {c.tagline && (
                                                    <div className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-[200px]">{c.tagline}</div>
                                                )}
                                                <div className="text-[11px] text-neutral-300 font-mono mt-0.5">{c.id}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc?.bg ?? ""}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${sc?.dot ?? ""}`} />
                                                    {sc?.label ?? c.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {c.is_verified ? (
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                ) : (
                                                    <span className="text-xs text-neutral-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-neutral-700">
                                                {c.total_quests ?? "—"}
                                            </td>
                                            <td className="px-4 py-3 text-neutral-700">
                                                {c.total_earnings != null
                                                    ? `₹${c.total_earnings.toLocaleString("en-IN")}`
                                                    : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                                                {new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setViewingCreator(c); }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 text-teal-700 text-xs font-medium hover:bg-teal-50 transition-colors opacity-0 group-hover:opacity-100"
                                                    aria-label={`View ${displayName}`}
                                                >
                                                    View
                                                </button>
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
                                        onClick={() => setPage(p)}
                                        className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all ${p === page
                                            ? "bg-teal-600 text-white shadow-sm"
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

            {/* Creator Detail Modal */}
            {viewingCreator && (
                <CreatorDetailModal
                    open={!!viewingCreator}
                    creatorId={viewingCreator.id}
                    displayName={viewingCreator.name ?? viewingCreator.id}
                    onClose={() => setViewingCreator(null)}
                />
            )}

            {/* Provision Creator Modal */}
            {showProvision && <ProvisionCreatorModal onClose={() => setShowProvision(false)} />}

            {/* Loading overlay */}
            {isLoading && data && (
                <div className="fixed inset-0 z-40 bg-white/40 flex items-center justify-center pointer-events-none">
                    <RefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
                </div>
            )}
        </div>
    );
}
