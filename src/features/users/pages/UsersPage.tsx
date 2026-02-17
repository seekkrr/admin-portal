import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Search, Users, Trash2, Ban, ChevronLeft, ChevronRight,
    Shield, RefreshCw, AlertTriangle, CheckCircle2, XCircle,
    X, Filter
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { LoadingFallback } from "@components/LoadingFallback";
import { usersService } from "../services/users.service";
import { Badge } from "../components/Badge";
import { ConfirmModal } from "../components/ConfirmModal";
import { FilterDropdown } from "../components/FilterDropdown";
import { usePaginationRange } from "../hooks/usePagination";
import type { DropdownOption } from "../components/FilterDropdown";
import type { User } from "@/types";

// ---- Constants ----
const ADMIN_ROLES = ["admin", "super_admin"];
const PROMOTABLE_ROLES = ["moderator", "finance", "admin"] as const;
const PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;
const SESSION_KEY = "admin_users_selected";

// ---- Badge Styles ----
const statusConfig: Record<string, { label: string; dot: string; bg: string }> = {
    active: { label: "Active", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    suspended: { label: "Suspended", dot: "bg-amber-500", bg: "bg-amber-50 text-amber-700 border-amber-200" },
    deleted: { label: "Deleted", dot: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200" },
};

const roleConfig: Record<string, { label: string; bg: string }> = {
    user: { label: "User", bg: "bg-neutral-50 text-neutral-600 border-neutral-200" },
    creator: { label: "Creator", bg: "bg-teal-50 text-teal-700 border-teal-200" },
    moderator: { label: "Moderator", bg: "bg-blue-50 text-blue-700 border-blue-200" },
    finance: { label: "Finance", bg: "bg-violet-50 text-violet-700 border-violet-200" },
    admin: { label: "Admin", bg: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    super_admin: { label: "Super Admin", bg: "bg-rose-50 text-rose-700 border-rose-200" },
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
    | { type: "single-delete"; payload: { userId: string } }
    | { type: "promote"; payload: { userId: string; role: string } };

// ---- Filter Dropdown Options ----
const STATUS_OPTIONS: DropdownOption[] = [
    { value: "", label: "All Statuses" },
    { value: "active", label: "Active", dot: "bg-emerald-500" },
    { value: "suspended", label: "Suspended", dot: "bg-amber-500" },
];

const ROLE_OPTIONS: DropdownOption[] = [
    { value: "", label: "All Roles" },
    { value: "user", label: "User" },
    { value: "moderator", label: "Moderator" },
    { value: "finance", label: "Finance" },
    { value: "admin", label: "Admin" },
    { value: "super_admin", label: "Super Admin" },
];

const CREATOR_OPTIONS: DropdownOption[] = [
    { value: "", label: "All Users" },
    { value: "true", label: "Creators Only", dot: "bg-teal-500" },
    { value: "false", label: "Non-Creators", dot: "bg-neutral-400" },
];

// ---- Main Component ----
export function UsersPage() {
    const { user: currentUser } = useAuthStore();
    const queryClient = useQueryClient();
    const isAdmin = !!currentUser && ADMIN_ROLES.includes(currentUser.role);

    // ---- State ----
    const [searchInput, setSearchInput] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [creatorFilter, setCreatorFilter] = useState("");
    const [page, setPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => loadSessionSelections());
    const [promotingUser, setPromotingUser] = useState<User | null>(null);

    // Confirmation state — discriminated union for type safety
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
    const [hardDelete, setHardDelete] = useState(false);

    // ---- Persist selections to session ----
    useEffect(() => saveSessionSelections(selectedIds), [selectedIds]);

    // ---- Debounced search → triggers API call ----
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchInput.trim());
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Reset hard delete toggle when modal closes
    useEffect(() => { if (!confirmAction) setHardDelete(false); }, [confirmAction]);

    // ---- Fetch Users ----
    const queryParams = useMemo(() => ({
        q: debouncedQuery || undefined,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
        is_creator: creatorFilter || undefined,
        page,
        per_page: PER_PAGE,
    }), [debouncedQuery, statusFilter, roleFilter, creatorFilter, page]);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-users", queryParams],
        queryFn: () => usersService.listUsers(queryParams),
        placeholderData: (prev) => prev,
    });

    const users = useMemo(() => data?.users ?? [], [data]);
    const pagination = data?.pagination;

    // ---- Client-side instant filter (on top of fetched data) ----
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
            usersService.bulkAction(ids, action),
        onSuccess: (result) => {
            if (result.succeeded.length > 0) {
                toast.success(result.summary);
                queryClient.invalidateQueries({ queryKey: ["admin-users"] });
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

    const roleMutation = useMutation({
        mutationFn: ({ userId, role }: { userId: string; role: string }) =>
            usersService.updateUserRole(userId, role),
        onSuccess: () => {
            toast.success("Role updated successfully");
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            setPromotingUser(null);
            setConfirmAction(null);
        },
        onError: (err: Error) => { toast.error(err.message); setConfirmAction(null); },
    });

    const deleteMutation = useMutation({
        mutationFn: ({ userId, hard }: { userId: string; hard: boolean }) => usersService.deleteUser(userId, hard),
        onSuccess: () => {
            toast.success("User deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
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
        setRoleFilter("");
        setCreatorFilter("");
        setPage(1);
    }, []);

    const isBusy = bulkActionMutation.isPending || roleMutation.isPending || deleteMutation.isPending;
    const allOnPageSelected = filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.has(u._id));

    // ---- Confirm handler (type-safe via switch) ----
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
            case "promote":
                roleMutation.mutate(confirmAction.payload);
                break;
        }
    }, [confirmAction, bulkActionMutation, deleteMutation, roleMutation, hardDelete]);

    // ---- Pagination ----
    const totalPages = pagination?.total_pages ?? 1;
    const paginationRange = usePaginationRange(totalPages, page);

    // ---- Render ----
    if (!isAdmin) {
        return <AccessDenied message="Only admins can manage users." />;
    }

    return (
        <div className="p-6 max-w-[1400px] mx-auto space-y-5 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">Manage Users</h1>
                        <p className="text-sm text-neutral-500">
                            {pagination ? `${pagination.total} total users` : "Loading..."}
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
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
                        options={ROLE_OPTIONS}
                        value={roleFilter}
                        onChange={(v) => { setRoleFilter(v); setPage(1); }}
                        icon={<Shield className="w-3.5 h-3.5" />}
                        placeholder="Role"
                    />

                    <FilterDropdown
                        options={CREATOR_OPTIONS}
                        value={creatorFilter}
                        onChange={(v) => { setCreatorFilter(v); setPage(1); }}
                        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        placeholder="Creator"
                    />

                    {(searchInput || statusFilter || roleFilter || creatorFilter) && (
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
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 rounded-xl border border-indigo-100 animate-slide-up">
                        <span className="text-sm font-semibold text-indigo-700">
                            {selectedIds.size} selected
                        </span>
                        <div className="h-4 w-px bg-indigo-200" />
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
                        <p className="text-sm">Failed to load users</p>
                        <button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-users"] })} className="text-sm text-indigo-600 hover:underline">
                            Retry
                        </button>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-neutral-400 gap-2">
                        <Users className="w-8 h-8" />
                        <p className="text-sm">No users found</p>
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
                                            className="w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                        />
                                    </th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Name</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Role</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Status</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Creator</th>
                                    <th className="text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Joined</th>
                                    <th className="text-right px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {filteredUsers.map((u) => {
                                    const sc = statusConfig[u.status] || { label: u.status, dot: "bg-neutral-400", bg: "bg-neutral-50 text-neutral-600 border-neutral-200" };
                                    const rc = roleConfig[u.role] || { label: u.role, bg: "bg-neutral-50 text-neutral-600 border-neutral-200" };
                                    return (
                                        <tr
                                            key={u._id}
                                            className={`transition-colors group hover:bg-neutral-50/80 ${selectedIds.has(u._id) ? "bg-indigo-50/30" : ""}`}
                                        >
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(u._id)}
                                                    onChange={() => toggleSelect(u._id)}
                                                    className="w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-neutral-900">
                                                    {u.first_name} {u.last_name}
                                                </div>
                                                <div className="text-[11px] text-neutral-400 font-mono mt-0.5">{u._id}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge label={rc.label} styles={rc.bg} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.bg}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                                    {sc.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {u.is_creator ? (
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                ) : (
                                                    <XCircle className="w-4 h-4 text-neutral-300" />
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                                                {new Date(u.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setPromotingUser(u)}
                                                        title="Change role"
                                                        className="p-1.5 rounded-lg text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                    >
                                                        <Shield className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmAction({ type: "single-delete", payload: { userId: u._id } })}
                                                        title="Delete user"
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

            {/* Role Promotion Modal */}
            {promotingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in" onClick={() => setPromotingUser(null)}>
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-neutral-900 mb-1">Change Role</h3>
                        <p className="text-sm text-neutral-500 mb-5 flex items-center gap-2">
                            {promotingUser.first_name} {promotingUser.last_name}
                            <Badge label={promotingUser.role} styles={roleConfig[promotingUser.role]?.bg} />
                        </p>
                        <div className="space-y-2">
                            {PROMOTABLE_ROLES.map((role) => (
                                <button
                                    key={role}
                                    disabled={promotingUser.role === role || roleMutation.isPending}
                                    onClick={() => setConfirmAction({ type: "promote", payload: { userId: promotingUser._id, role } })}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all
                                        ${promotingUser.role === role
                                            ? "border-indigo-300 bg-indigo-50 text-indigo-700 cursor-default"
                                            : "border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-neutral-700"
                                        }
                                        disabled:opacity-50`}
                                >
                                    <span className="capitalize">{role.replace("_", " ")}</span>
                                    {promotingUser.role === role && <span className="text-xs text-indigo-500">Current</span>}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setPromotingUser(null)}
                            className="w-full mt-4 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            <ConfirmModal
                open={confirmAction?.type === "single-delete" || confirmAction?.type === "bulk-delete"}
                title="Delete User(s)"
                message={
                    confirmAction?.type === "single-delete"
                        ? `This will ${hardDelete ? "PERMANENTLY" : "soft"}-delete this user. ${hardDelete ? "All data will be permanently removed." : "The user will be marked as deleted."}`
                        : `This will soft-delete ${confirmAction?.type === "bulk-delete" ? confirmAction.payload.ids.length : 0} user(s). This cannot be easily undone.`
                }
                confirmLabel={hardDelete ? "Hard Delete" : "Delete"}
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={bulkActionMutation.isPending || deleteMutation.isPending}
            >
                {/* Hard delete toggle for single-user deletion only */}
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
                title="Suspend User(s)"
                message={`This will suspend ${confirmAction?.type === "suspend" ? confirmAction.payload.ids.length : 0} user(s). They will lose access until reactivated.`}
                confirmLabel="Suspend"
                confirmStyle="bg-amber-600 hover:bg-amber-700"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={bulkActionMutation.isPending}
            />

            {/* Promote Confirmation */}
            <ConfirmModal
                open={confirmAction?.type === "promote"}
                title="Change Role"
                message={`You are about to change this user's role to "${confirmAction?.type === "promote" ? confirmAction.payload.role.replace("_", " ") : ""}". This will update their permissions immediately.`}
                confirmLabel="Change Role"
                confirmStyle="bg-indigo-600 hover:bg-indigo-700"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={roleMutation.isPending}
            />

            {/* Loading overlay for mutations */}
            {isBusy && !confirmAction && (
                <div className="fixed inset-0 z-40 bg-white/60 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                </div>
            )}
        </div>
    );
}
