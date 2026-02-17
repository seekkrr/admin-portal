import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Search, Users, Trash2, Ban, ChevronLeft, ChevronRight,
    RefreshCw, AlertTriangle,
    X, Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { LoadingFallback } from "@components/LoadingFallback";
import { creatorsService } from "../services/creators.service";
import { ConfirmModal } from "@/features/users/components/ConfirmModal";
import { FilterDropdown } from "@/features/users/components/FilterDropdown";
import { usePaginationRange } from "@/features/users/hooks/usePagination";
import { CreatorDetailModal } from "../components/CreatorDetailModal";
import type { DropdownOption } from "@/features/users/components/FilterDropdown";
import type { User } from "@/types";

// ---- Constants ----
const ALLOWED_ROLES = ["admin", "super_admin", "finance"];
const PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;
const SESSION_KEY = "admin_creators_selected";

// ---- Badge Styles ----
const userStatusConfig: Record<string, { label: string; dot: string; bg: string }> = {
    active: { label: "Active", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    suspended: { label: "Suspended", dot: "bg-amber-500", bg: "bg-amber-50 text-amber-700 border-amber-200" },
    deleted: { label: "Deleted", dot: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200" },
};

// ---- Session Helpers ----
function loadSessionSelections(): Set<string> {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
        return new Set();
    }
}

function saveSessionSelections(ids: Set<string>) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...ids]));
}

// ---- Discriminated Union for Confirm Actions ----
type ConfirmAction =
    | { type: "suspend"; payload: { ids: string[] } }
    | { type: "bulk-delete"; payload: { ids: string[] } }
    | { type: "single-delete"; payload: { userId: string } };

// ---- Filter Dropdown Options ----
const STATUS_OPTIONS: DropdownOption[] = [
    { value: "", label: "All Statuses" },
    { value: "active", label: "Active", dot: "bg-emerald-500" },
    { value: "suspended", label: "Suspended", dot: "bg-amber-500" },
];

// ---- Main Component ----
export function CreatorsPage() {
    const { user: currentUser } = useAuthStore();
    const queryClient = useQueryClient();
    const hasAccess = !!currentUser && ALLOWED_ROLES.includes(currentUser.role);

    // ---- State ----
    const [searchInput, setSearchInput] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [page, setPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => loadSessionSelections());
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
    const [hardDelete, setHardDelete] = useState(false);

    // Modal state
    const [viewingUser, setViewingUser] = useState<User | null>(null);

    // ---- Persist selections to session ----
    useEffect(() => saveSessionSelections(selectedIds), [selectedIds]);

    // ---- Debounced search ----
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchInput.trim());
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Reset hard delete toggle when modal closes
    useEffect(() => { if (!confirmAction) setHardDelete(false); }, [confirmAction]);

    // ---- Fetch Creators ----
    const queryParams = useMemo(() => ({
        q: debouncedQuery || undefined,
        status: statusFilter || undefined,
        page,
        per_page: PER_PAGE,
    }), [debouncedQuery, statusFilter, page]);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-creators", queryParams],
        queryFn: () => creatorsService.listCreators(queryParams),
        placeholderData: (prev) => prev,
    });

    const users = useMemo(() => data?.users ?? [], [data]);
    const pagination = data?.pagination;

    // ---- Client-side instant filter ----
    const filteredUsers = useMemo(() => {
        if (!searchInput.trim() || searchInput.trim() === debouncedQuery) return users;
        const q = searchInput.trim().toLowerCase();
        return users.filter((u) =>
            `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
            u._id.toLowerCase().includes(q)
        );
    }, [users, searchInput, debouncedQuery]);

    // ---- Mutations ----
    const bulkActionMutation = useMutation({
        mutationFn: ({ ids, action }: { ids: string[]; action: "suspend" | "delete" }) =>
            creatorsService.bulkAction(ids, action),
        onSuccess: (result) => {
            if (result.succeeded.length > 0) {
                toast.success(result.summary);
                queryClient.invalidateQueries({ queryKey: ["admin-creators"] });
                setSelectedIds((prev) => {
                    const next = new Set(prev);
                    result.succeeded.forEach((id) => next.delete(id));
                    return next;
                });
            }
            if (result.failed.length > 0) {
                result.failed.forEach((f) => toast.error(`${f.user_id}: ${f.reason}`));
            }
            setConfirmAction(null);
        },
        onError: (err: Error) => { toast.error(err.message); setConfirmAction(null); },
    });

    const deleteMutation = useMutation({
        mutationFn: ({ userId, hard }: { userId: string; hard: boolean }) =>
            creatorsService.deleteUser(userId, hard),
        onSuccess: (_, { userId }) => {
            toast.success("Creator deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-creators"] });
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
            setConfirmAction(null);
        },
        onError: (err: Error) => { toast.error(err.message); setConfirmAction(null); },
    });

    // ---- Handlers ----
    const toggleSelect = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleSelectAll = useCallback(() => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            const allOnPage = filteredUsers.map((u) => u._id);
            const allSelected = allOnPage.every((id) => next.has(id));
            if (allSelected) {
                allOnPage.forEach((id) => next.delete(id));
            } else {
                allOnPage.forEach((id) => next.add(id));
            }
            return next;
        });
    }, [filteredUsers]);

    const clearFilters = useCallback(() => {
        setSearchInput("");
        setDebouncedQuery("");
        setStatusFilter("");
        setPage(1);
    }, []);

    const isBusy = bulkActionMutation.isPending || deleteMutation.isPending;
    const allOnPageSelected = filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.has(u._id));

    // ---- Confirm handler ----
    const executeConfirmedAction = useCallback(() => {
        if (!confirmAction) return;
        switch (confirmAction.type) {
            case "suspend":
                bulkActionMutation.mutate({ ids: confirmAction.payload.ids, action: "suspend" });
                break;
            case "bulk-delete":
                bulkActionMutation.mutate({ ids: confirmAction.payload.ids, action: "delete" });
                break;
            case "single-delete":
                deleteMutation.mutate({ userId: confirmAction.payload.userId, hard: hardDelete });
                break;
        }
    }, [confirmAction, bulkActionMutation, deleteMutation, hardDelete]);

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
            </div>

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                {/* Search + Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[260px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search by name or ID..."
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

                    {(searchInput || statusFilter) && (
                        <button
                            onClick={clearFilters}
                            className="px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                        >
                            Reset
                        </button>
                    )}
                </div>

                {/* Bulk Actions Bar */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-teal-50 rounded-xl border border-teal-100 animate-slide-up">
                        <span className="text-sm font-semibold text-teal-700">
                            {selectedIds.size} selected
                        </span>
                        <div className="h-4 w-px bg-teal-200" />
                        <button
                            onClick={() => setConfirmAction({ type: "suspend", payload: { ids: [...selectedIds] } })}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-sm font-medium hover:bg-amber-200 transition-colors disabled:opacity-50"
                        >
                            <Ban className="w-3.5 h-3.5" /> Suspend
                        </button>
                        <button
                            onClick={() => setConfirmAction({ type: "bulk-delete", payload: { ids: [...selectedIds] } })}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                        <button
                            onClick={() => { setSelectedIds(new Set()); sessionStorage.removeItem(SESSION_KEY); }}
                            className="ml-auto text-xs text-neutral-500 hover:text-neutral-700"
                        >
                            Deselect all
                        </button>
                    </div>
                )}
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
                ) : filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-neutral-400 gap-2">
                        <Users className="w-8 h-8" />
                        <p className="text-sm">No creators found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                    <th className="w-12 px-4 py-3.5">
                                        <input
                                            type="checkbox"
                                            checked={allOnPageSelected}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 rounded border-neutral-300 text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600"
                                        />
                                    </th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Name</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Account</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Joined</th>
                                    <th className="text-right px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {filteredUsers.map((u) => {
                                    const sc = userStatusConfig[u.status] || { label: u.status, dot: "bg-neutral-400", bg: "bg-neutral-50 text-neutral-600 border-neutral-200" };
                                    return (
                                        <tr
                                            key={u._id}
                                            className={`transition-colors group hover:bg-neutral-50/80 cursor-pointer ${selectedIds.has(u._id) ? "bg-teal-50/30" : ""}`}
                                            onClick={() => setViewingUser(u)}
                                        >
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(u._id)}
                                                    onChange={() => toggleSelect(u._id)}
                                                    className="w-4 h-4 rounded border-neutral-300 text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-neutral-900">
                                                    {u.first_name} {u.last_name}
                                                </div>
                                                <div className="text-[11px] text-neutral-400 font-mono mt-0.5">{u._id}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.bg}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                                    {sc.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                                                {new Date(u.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                            </td>
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setConfirmAction({ type: "single-delete", payload: { userId: u._id } })}
                                                        title="Delete creator"
                                                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
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

            {/* Creator Detail Modal (read-only quick view) */}
            <CreatorDetailModal
                open={!!viewingUser}
                userId={viewingUser?._id ?? null}
                userName={viewingUser ? `${viewingUser.first_name} ${viewingUser.last_name}` : ""}
                onClose={() => setViewingUser(null)}
            />

            {/* Delete Confirmation */}
            <ConfirmModal
                open={confirmAction?.type === "single-delete" || confirmAction?.type === "bulk-delete"}
                title="Delete Creator(s)"
                message={
                    confirmAction?.type === "single-delete"
                        ? `This will ${hardDelete ? "PERMANENTLY" : "soft"}-delete this creator. ${hardDelete ? "All data will be permanently removed." : "The creator will be marked as deleted."}`
                        : `This will soft-delete ${confirmAction?.type === "bulk-delete" ? confirmAction.payload.ids.length : 0} creator(s). This cannot be easily undone.`
                }
                confirmLabel={hardDelete ? "Hard Delete" : "Delete"}
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={bulkActionMutation.isPending || deleteMutation.isPending}
            >
                {confirmAction?.type === "single-delete" && (
                    <label className="flex items-center gap-2 mt-3 mb-1 px-1 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={hardDelete}
                            onChange={(e) => setHardDelete(e.target.checked)}
                            className="w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500 accent-red-600"
                        />
                        <span className="text-xs text-red-600 font-medium">Hard delete (permanent, irreversible)</span>
                    </label>
                )}
            </ConfirmModal>

            {/* Suspend Confirmation */}
            <ConfirmModal
                open={confirmAction?.type === "suspend"}
                title="Suspend Creator(s)"
                message={`This will suspend ${confirmAction?.type === "suspend" ? confirmAction.payload.ids.length : 0} creator(s). They will lose access until reactivated.`}
                confirmLabel="Suspend"
                confirmStyle="bg-amber-600 hover:bg-amber-700"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={bulkActionMutation.isPending}
                theme="warning"
            />

            {/* Loading overlay for mutations */}
            {isBusy && !confirmAction && (
                <div className="fixed inset-0 z-40 bg-white/60 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
                </div>
            )}
        </div>
    );
}
