import { useState, useMemo, useCallback, useEffect } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Trash2, Ban, Shield, Coins, Star, TrendingUp, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { usersService } from "../services/users.service";
import { isRedundantRoleChange, effectiveRole } from "../roles";
import { CopyText } from "@/components/ui/CopyText";
import { Button, IconButton } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { Checkbox, Field, Switch, TextInput } from "@/components/ui/Field";
import { StatGrid, StatTile } from "@/components/ui/Stat";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { formatDate } from "@/utils/date";
import { cx } from "@/utils/cx";
import type { User } from "@/types";

// ---- Constants ----
const ADMIN_ROLES = ["admin", "super_admin"];
const PROMOTABLE_ROLES = ["moderator", "finance", "admin"] as const;
const PER_PAGE = 10;
const SESSION_KEY = "admin_users_selected";

const ROLE_LABELS: Record<string, string> = {
    user: "User",
    creator: "Creator",
    moderator: "Moderator",
    finance: "Finance",
    admin: "Admin",
    super_admin: "Super admin",
    business: "Business",
};
const ROLE_PRIORITY = ["super_admin", "admin", "finance", "moderator", "creator", "user"];

function primaryRole(u: User): string {
    return ROLE_PRIORITY.find((r) => (u.role as readonly string[] | undefined)?.includes(r)) || u.role?.[0] || "user";
}

function fullName(u: Pick<User, "first_name" | "last_name">): string {
    return `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
}

function RoleTag({ role }: { role: string }) {
    const staff = ["super_admin", "admin", "finance", "moderator"].includes(role);
    return <Tag tone={staff ? "brand" : role === "creator" ? "info" : "neutral"}>{ROLE_LABELS[role] ?? role.replace(/_/g, " ")}</Tag>;
}

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
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify([...ids]));
    } catch {
        /* storage unavailable */
    }
}

// ---- Discriminated Union for Confirm Actions ----
type ConfirmAction =
    | { type: "suspend"; payload: { ids: string[] } }
    | { type: "bulk-delete"; payload: { ids: string[] } }
    | { type: "single-delete"; payload: { userId: string; name: string } }
    | { type: "promote"; payload: { userId: string; role: string; current: string[] } }
    | { type: "access"; payload: { userId: string; name: string; kind: AccessKind; enabled: boolean } };

type AccessKind = "creator" | "business";

const ACCESS_COPY: Record<AccessKind, { on: (n: string) => string; off: (n: string) => string; label: string }> = {
    creator: {
        label: "Creator",
        on: (n) => `"${n}" becomes a creator and can use the Creator Portal straight away.`,
        off: (n) => `"${n}" loses Creator Portal access. Their quests and history are kept, and turning this back on restores them.`,
    },
    business: {
        label: "Business",
        on: (n) => `"${n}" gets an active business they own and can open the Partner Portal straight away. If they had a business before, it comes back.`,
        off: (n) => `"${n}" loses Partner Portal access and their business is hidden from the app and website. Nothing is deleted; turning this back on restores it.`,
    },
};

// ---- Filter Options ----
const STATUS_OPTIONS: FilterOption[] = [
    { value: "active", label: "Active" },
    { value: "suspended", label: "Suspended" },
];

const ROLE_OPTIONS: FilterOption[] = [
    { value: "user", label: "User" },
    { value: "moderator", label: "Moderator" },
    { value: "finance", label: "Finance" },
    { value: "admin", label: "Admin" },
    { value: "super_admin", label: "Super admin" },
    { value: "business", label: "Business" },
];

const CREATOR_OPTIONS: FilterOption[] = [
    { value: "true", label: "Creators only" },
    { value: "false", label: "Non-creators" },
];

// ---- Points Modal ----
interface PointsModalProps {
    userId: string;
    userName: string;
    currentPoints: number;
    onClose: () => void;
}

function PointsModal({ userId, userName, currentPoints, onClose }: PointsModalProps) {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState("");
    const [mode, setMode] = useState<"add" | "deduct">("add");

    useEffect(() => {
        setAmount("");
        setMode("add");
    }, [userId]);

    const addMutation = useMutation({
        mutationFn: (amt: number) => usersService.addPoints(userId, amt),
        onSuccess: (data, amt) => {
            toast.success(`Added ${amt} points. New total: ${data.points_earned}`);
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            onClose();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const deductMutation = useMutation({
        mutationFn: (amt: number) => usersService.deductPoints(userId, amt),
        onSuccess: (data, amt) => {
            toast.success(`Deducted ${amt} points. New total: ${data.points_earned}`);
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            onClose();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const isBusy = addMutation.isPending || deductMutation.isPending;
    const parsedAmount = parseInt(amount, 10);
    const isValid = !isNaN(parsedAmount) && parsedAmount > 0;

    const handleSubmit = () => {
        if (!isValid) return;
        if (mode === "add") addMutation.mutate(parsedAmount);
        else deductMutation.mutate(parsedAmount);
    };

    return (
        <Modal
            open
            onClose={onClose}
            dismissible={!isBusy}
            title="Manage points"
            description={
                <span className="flex flex-wrap items-center gap-2">
                    {userName}
                    <Tag tone="warn">
                        <Coins className="h-3 w-3" aria-hidden /> {currentPoints.toLocaleString("en-IN")} pts
                    </Tag>
                </span>
            }
            icon={Coins}
            size="sm"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isBusy}>
                        Cancel
                    </Button>
                    <Button variant={mode === "add" ? "primary" : "danger"} onClick={handleSubmit} disabled={!isValid} loading={isBusy}>
                        {mode === "add" ? "Add points" : "Deduct points"}
                    </Button>
                </>
            }
        >
            <div role="radiogroup" aria-label="Add or deduct" className="grid grid-cols-2 gap-1 rounded-control bg-brand-50/70 p-1">
                {(["add", "deduct"] as const).map((m) => (
                    <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={mode === m}
                        onClick={() => setMode(m)}
                        className={cx(
                            "rounded-lg py-2 text-sm font-medium transition-colors",
                            mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                        )}
                    >
                        {m === "add" ? "Add" : "Deduct"}
                    </button>
                ))}
            </div>
            <Field label="Amount">
                <TextInput
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount…"
                    disabled={isBusy}
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && isValid) handleSubmit();
                    }}
                />
            </Field>
        </Modal>
    );
}

// ---- Main Component ----
/** `/users?focus=<id>` (older search links) opens the user's page. */
export function UsersPage() {
    const [searchParams] = useSearchParams();
    const focusId = searchParams.get("focus");
    if (focusId) return <Navigate to={`/users/${encodeURIComponent(focusId)}`} replace />;
    return <UsersList />;
}

function UsersList() {
    const { user: currentUser } = useAuthStore();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isAdmin = !!currentUser && currentUser.role?.some((r) => ADMIN_ROLES.includes(r));

    // ---- State (filters, search and page live in the address) ----
    const { state, set, reset } = useUrlState({ q: "", status: "", role: "", creator: "", page: 1 });
    const [searchInput, setSearchInput] = useDebouncedUrlInput(state.q, (q) => set({ q }, { replace: true }));
    const debouncedQuery = state.q;
    const statusFilter = STATUS_OPTIONS.some((o) => o.value === state.status) ? state.status : "";
    const roleFilter = ROLE_OPTIONS.some((o) => o.value === state.role) ? state.role : "";
    const creatorFilter = state.creator === "true" || state.creator === "false" ? state.creator : "";
    const page = Math.max(1, state.page);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => loadSessionSelections());
    const [promotingUser, setPromotingUser] = useState<User | null>(null);
    const [pointsUser, setPointsUser] = useState<User | null>(null);

    // Confirmation state — discriminated union for type safety
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
    const [hardDelete, setHardDelete] = useState(false);

    // ---- Persist selections to session ----
    useEffect(() => saveSessionSelections(selectedIds), [selectedIds]);

    // Reset hard delete toggle when modal closes
    useEffect(() => {
        if (!confirmAction) setHardDelete(false);
    }, [confirmAction]);

    // ---- Fetch User Stats ----
    const { data: statsData } = useQuery({
        queryKey: ["admin-user-stats"],
        queryFn: () => usersService.getUserStats(),
        staleTime: 60_000,
        enabled: isAdmin,
    });

    // ---- Fetch Users ----
    const queryParams = useMemo(
        () => ({
            q: debouncedQuery || undefined,
            status: statusFilter || undefined,
            role: roleFilter || undefined,
            is_creator: creatorFilter || undefined,
            page,
            page_size: PER_PAGE,
        }),
        [debouncedQuery, statusFilter, roleFilter, creatorFilter, page]
    );

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-users", queryParams],
        queryFn: () => usersService.listUsers(queryParams),
        placeholderData: (prev) => prev,
        enabled: isAdmin,
    });

    const users = useMemo(() => data?.users ?? [], [data]);
    const pagination = data?.pagination;

    // ---- Client-side instant filter (on top of fetched data) ----
    const filteredUsers = useMemo(() => {
        if (!searchInput.trim() || searchInput.trim() === debouncedQuery) return users;
        const q = searchInput.trim().toLowerCase();
        return users.filter(
            (u) => fullName(u).toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q) || u._id.toLowerCase().includes(q)
        );
    }, [users, searchInput, debouncedQuery]);

    // ---- Mutations ----
    const bulkActionMutation = useMutation({
        mutationFn: ({ ids, action }: { ids: string[]; action: "suspend" | "delete" }) => usersService.bulkAction(ids, action),
        onSuccess: (result) => {
            if (result.succeeded.length > 0) {
                toast.success(result.summary);
                queryClient.invalidateQueries({ queryKey: ["admin-users"] });
                queryClient.invalidateQueries({ queryKey: ["admin-user-stats"] });
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
        onError: (err: Error) => {
            toast.error(err.message);
            setConfirmAction(null);
        },
    });

    const roleMutation = useMutation({
        mutationFn: ({ userId, role, current }: { userId: string; role: string; current: string[] }) => usersService.updateUserRole(userId, role, current),
        onSuccess: () => {
            toast.success("Role updated successfully");
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            setPromotingUser(null);
            setConfirmAction(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setConfirmAction(null);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: ({ userId, hard }: { userId: string; hard: boolean }) => usersService.deleteUser(userId, hard),
        onSuccess: (_, { userId }) => {
            toast.success("User deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["admin-user-stats"] });
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
            setConfirmAction(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setConfirmAction(null);
        },
    });

    const [accessBusinessName, setAccessBusinessName] = useState("");
    const accessMutation = useMutation({
        mutationFn: ({ userId, kind, enabled }: { userId: string; kind: AccessKind; enabled: boolean }) =>
            usersService.setAccess(userId, kind, enabled, kind === "business" && enabled ? accessBusinessName.trim() || undefined : undefined),
        onSuccess: (_, { kind, enabled }) => {
            toast.success(`${ACCESS_COPY[kind].label} access turned ${enabled ? "on" : "off"}`);
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["admin-user-stats"] });
            queryClient.invalidateQueries({ queryKey: kind === "creator" ? ["admin-creators"] : ["collabs-businesses"] });
            setConfirmAction(null);
            setAccessBusinessName("");
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setConfirmAction(null);
        },
    });

    const isBusy = bulkActionMutation.isPending || roleMutation.isPending || deleteMutation.isPending || accessMutation.isPending;

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
            case "access":
                accessMutation.mutate(confirmAction.payload);
                break;
        }
    }, [confirmAction, bulkActionMutation, deleteMutation, roleMutation, accessMutation, hardDelete]);

    const columns: DataColumn<User>[] = useMemo(
        () => [
            {
                id: "name",
                header: "Name",
                hideable: false,
                sortValue: (u) => fullName(u),
                csv: (u) => fullName(u),
                cell: (u) => (
                    <div className="min-w-0">
                        <Link to={`/users/${u._id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                            {fullName(u) || u.email || "—"}
                        </Link>
                        <div className="mt-0.5 text-[11px] text-ink-faint">
                            <CopyText value={u._id} mono truncate={false} title="Copy user ID" />
                        </div>
                    </div>
                ),
            },
            { id: "id", header: "User ID", defaultHidden: true, csv: (u) => u._id, cell: (u) => <span className="font-mono text-xs text-ink-muted">{u._id}</span> },
            {
                id: "email",
                header: "Email",
                sortValue: (u) => u.email ?? "",
                className: "max-w-[240px]",
                cell: (u) => <CopyText value={u.email} title="Copy email" />,
            },
            { id: "role", header: "Role", sortValue: (u) => primaryRole(u), cell: (u) => <RoleTag role={primaryRole(u)} /> },
            { id: "status", header: "Status", sortValue: (u) => u.status, cell: (u) => <StatusPill status={u.status} /> },
            ...(["creator", "business"] as const).map(
                (kind): DataColumn<User> => ({
                    id: kind,
                    header: ACCESS_COPY[kind].label,
                    sortValue: (u) => (kind === "creator" ? !!u.is_creator : !!u.role?.includes("business")),
                    csv: (u) => ((kind === "creator" ? !!u.is_creator : !!u.role?.includes("business")) ? "on" : "off"),
                    cell: (u) => {
                        const on = kind === "creator" ? !!u.is_creator : !!u.role?.includes("business");
                        return (
                            <Switch
                                size="sm"
                                hideLabel
                                checked={on}
                                label={`${ACCESS_COPY[kind].label} access ${on ? "on" : "off"} for ${fullName(u)}`}
                                disabled={isBusy}
                                onChange={() =>
                                    setConfirmAction({
                                        type: "access",
                                        payload: { userId: u._id, name: fullName(u), kind, enabled: !on },
                                    })
                                }
                            />
                        );
                    },
                })
            ),
            {
                id: "joined",
                header: "Joined",
                sortValue: (u) => u.created_at ?? "",
                csv: (u) => formatDate(u.created_at),
                cell: (u) => <span className="whitespace-nowrap text-ink-muted">{formatDate(u.created_at)}</span>,
            },
            { id: "points", header: "Points", align: "right", defaultHidden: true, sortValue: (u) => u.points_earned ?? 0, cell: (u) => <span className="tabular-nums">{(u.points_earned ?? 0).toLocaleString("en-IN")}</span> },
        ],
        [isBusy]
    );

    const rowActions = (u: User) => (
        <>
            <div className="hidden items-center gap-0.5 md:flex">
                <IconButton icon={Eye} size="sm" label={`Open ${fullName(u) || "user"}`} onClick={() => navigate(`/users/${u._id}`)} />
                <IconButton icon={Coins} size="sm" label={`Manage points for ${fullName(u)}`} onClick={() => setPointsUser(u)} />
                <IconButton icon={Shield} size="sm" label={`Change role for ${fullName(u)}`} onClick={() => setPromotingUser(u)} />
                <IconButton
                    icon={Trash2}
                    size="sm"
                    label={`Delete ${fullName(u)}`}
                    className="hover:bg-bad-soft hover:text-bad"
                    onClick={() => setConfirmAction({ type: "single-delete", payload: { userId: u._id, name: fullName(u) || u.email || "" } })}
                />
            </div>
            <div className="md:hidden">
                <Menu
                    label={`Actions for ${fullName(u)}`}
                    triggerVariant="ghost"
                    size="sm"
                    items={[
                        { label: "Open user", icon: Eye, to: `/users/${u._id}` },
                        { label: "Manage points", icon: Coins, onSelect: () => setPointsUser(u) },
                        { label: "Change role", icon: Shield, onSelect: () => setPromotingUser(u) },
                        {
                            label: "Delete user",
                            icon: Trash2,
                            danger: true,
                            onSelect: () => setConfirmAction({ type: "single-delete", payload: { userId: u._id, name: fullName(u) || u.email || "" } }),
                        },
                    ]}
                />
            </div>
        </>
    );

    const card = {
        title: (u: User) => fullName(u) || "—",
        subtitle: (u: User) => u.email ?? u._id,
        fields: ["role", "status", "creator", "business"],
    };

    // ---- Render ----
    if (!isAdmin) {
        return <AccessDenied message="Only admins can manage users." />;
    }

    const chips: FilterChip[] = [];
    if (statusFilter) chips.push({ key: "status", label: chipLabel("Status", statusFilter, STATUS_OPTIONS), onRemove: () => set({ status: "" }) });
    if (roleFilter) chips.push({ key: "role", label: chipLabel("Role", roleFilter, ROLE_OPTIONS), onRemove: () => set({ role: "" }) });
    if (creatorFilter) chips.push({ key: "creator", label: chipLabel("Creator", creatorFilter, CREATOR_OPTIONS), onRemove: () => set({ creator: "" }) });

    const singleDelete = confirmAction?.type === "single-delete" ? confirmAction.payload : null;
    const typeName = singleDelete?.name.trim() || "DELETE";

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Users}
                title="Users"
                description={pagination ? `${pagination.total.toLocaleString("en-IN")} users match` : "Travelers, creators, business members and staff"}
            />

            {/* Stats Panel */}
            {statsData && (
                <StatGrid>
                    <StatTile icon={Users} label="Total" value={statsData.total?.toLocaleString("en-IN") ?? "—"} />
                    <StatTile icon={TrendingUp} label="Active" value={(statsData.by_status?.active ?? 0).toLocaleString("en-IN")} />
                    <StatTile
                        icon={Star}
                        label="Creators"
                        value={statsData.creators?.toLocaleString("en-IN") ?? "—"}
                        hint={(statsData.creators_by_status?.suspended ?? 0) > 0 ? `${statsData.creators_by_status?.suspended} suspended` : undefined}
                        hintTone="warn"
                    />
                    <StatTile icon={TrendingUp} label="New (7d)" value={(statsData.new_last_7_days ?? 0).toLocaleString("en-IN")} />
                </StatGrid>
            )}

            <FilterBar
                search={{ value: searchInput, onChange: setSearchInput, placeholder: "Search by name or email…" }}
                chips={chips}
                onReset={() => {
                    setSearchInput("");
                    reset();
                }}
            >
                <FilterSelect label="Status" value={statusFilter} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} allLabel="All statuses" />
                <FilterSelect label="Role" value={roleFilter} onChange={(v) => set({ role: v })} options={ROLE_OPTIONS} allLabel="All roles" />
                <FilterSelect label="Creator" value={creatorFilter} onChange={(v) => set({ creator: v })} options={CREATOR_OPTIONS} allLabel="All users" />
            </FilterBar>

            <DataTable
                label="Users"
                rows={filteredUsers}
                columns={columns}
                rowKey={(u) => u._id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: Users, title: "No users found", description: chips.length || debouncedQuery ? "Try clearing a filter." : undefined }}
                onRowClick={(u) => navigate(`/users/${u._id}`)}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                bulkActions={[
                    { label: "Suspend", icon: Ban, onClick: (ids) => setConfirmAction({ type: "suspend", payload: { ids } }) },
                    { label: "Delete", icon: Trash2, tone: "danger", onClick: (ids) => setConfirmAction({ type: "bulk-delete", payload: { ids } }) },
                ]}
                bulkBusy={isBusy}
                rowActions={rowActions}
                storageKey="users"
                exportName="users"
                summary={pagination ? `${filteredUsers.length} of ${pagination.total.toLocaleString("en-IN")}` : undefined}
                card={card}
                footer={
                    <Pagination
                        page={page}
                        totalPages={pagination?.total_pages ?? 1}
                        total={pagination?.total ?? 0}
                        pageSize={PER_PAGE}
                        onPageChange={(p) => set({ page: p })}
                    />
                }
            />

            {/* Points Modal */}
            {pointsUser && (
                <PointsModal userId={pointsUser._id} userName={fullName(pointsUser)} currentPoints={pointsUser.points_earned} onClose={() => setPointsUser(null)} />
            )}

            {/* Role Modal */}
            <Modal
                open={!!promotingUser}
                onClose={() => setPromotingUser(null)}
                title="Change role"
                icon={Shield}
                size="sm"
                description={
                    promotingUser && (
                        <span className="flex flex-wrap items-center gap-2">
                            {fullName(promotingUser)}
                            <RoleTag role={effectiveRole(promotingUser.role ?? [])} />
                        </span>
                    )
                }
                footer={
                    <Button variant="secondary" onClick={() => setPromotingUser(null)}>
                        Cancel
                    </Button>
                }
            >
                {promotingUser && (
                    <div className="space-y-2">
                        {PROMOTABLE_ROLES.map((role) => {
                            const isCurrent = effectiveRole(promotingUser.role ?? []) === role;
                            return (
                                <button
                                    key={role}
                                    type="button"
                                    disabled={isRedundantRoleChange(role, promotingUser.role ?? []) || roleMutation.isPending}
                                    onClick={() => {
                                        setConfirmAction({ type: "promote", payload: { userId: promotingUser._id, role, current: promotingUser.role ?? [] } });
                                        setPromotingUser(null);
                                    }}
                                    className={cx(
                                        "flex w-full items-center justify-between rounded-control border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50",
                                        isCurrent ? "cursor-default border-accent-300 bg-accent-50 text-accent-700" : "border-line text-ink hover:border-accent-300 hover:bg-accent-50/50"
                                    )}
                                >
                                    <span>{ROLE_LABELS[role] ?? role}</span>
                                    {isCurrent && <span className="text-xs text-accent-700">Current</span>}
                                </button>
                            );
                        })}
                    </div>
                )}
            </Modal>

            {/* Delete — soft delete is a simple confirm; a permanent delete asks for the name */}
            <ConfirmDialog
                open={confirmAction?.type === "single-delete" || confirmAction?.type === "bulk-delete"}
                title={confirmAction?.type === "bulk-delete" ? `Delete ${confirmAction.payload.ids.length} user(s)?` : hardDelete ? "Permanently delete user?" : "Delete user?"}
                description={
                    confirmAction?.type === "single-delete"
                        ? hardDelete
                            ? "All of this user's data will be permanently removed."
                            : "The user will be marked as deleted and can't sign in."
                        : `This will soft-delete ${confirmAction?.type === "bulk-delete" ? confirmAction.payload.ids.length : 0} user(s). They will be marked as deleted.`
                }
                confirmLabel={hardDelete ? "Delete permanently" : "Delete"}
                tone="danger"
                level={confirmAction?.type === "single-delete" && hardDelete ? "type" : "simple"}
                typeToConfirm={typeName}
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={bulkActionMutation.isPending || deleteMutation.isPending}
            >
                {confirmAction?.type === "single-delete" && (
                    <Checkbox checked={hardDelete} onChange={setHardDelete} label="Delete permanently" hint="Removes all data. This can't be undone." />
                )}
            </ConfirmDialog>

            {/* Suspend */}
            <ConfirmDialog
                open={confirmAction?.type === "suspend"}
                title={`Suspend ${confirmAction?.type === "suspend" ? confirmAction.payload.ids.length : 0} user(s)?`}
                description="They will lose access until reactivated."
                confirmLabel="Suspend"
                tone="warning"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={bulkActionMutation.isPending}
            />

            {/* Promote role */}
            <ConfirmDialog
                open={confirmAction?.type === "promote"}
                title="Change role?"
                description={`This user's role becomes "${confirmAction?.type === "promote" ? (ROLE_LABELS[confirmAction.payload.role] ?? confirmAction.payload.role) : ""}". Their permissions change immediately.`}
                confirmLabel="Change role"
                onConfirm={executeConfirmedAction}
                onCancel={() => {
                    setConfirmAction(null);
                    setPromotingUser(null);
                }}
                isPending={roleMutation.isPending}
            />

            {/* Creator / Business access switch */}
            {confirmAction?.type === "access" &&
                (() => {
                    const { kind, enabled, name } = confirmAction.payload;
                    const copy = ACCESS_COPY[kind];
                    return (
                        <ConfirmDialog
                            open
                            title={`Turn ${enabled ? "on" : "off"} ${copy.label.toLowerCase()} access?`}
                            description={enabled ? copy.on(name) : copy.off(name)}
                            confirmLabel={enabled ? "Turn on" : "Turn off"}
                            tone={enabled ? "primary" : "warning"}
                            onConfirm={executeConfirmedAction}
                            onCancel={() => {
                                setConfirmAction(null);
                                setAccessBusinessName("");
                            }}
                            isPending={accessMutation.isPending}
                        >
                            {kind === "business" && enabled && (
                                <Field label={<>Business name <span className="font-normal text-ink-faint">(optional)</span></>} hint="They can change it in the Partner Portal.">
                                    <TextInput
                                        type="text"
                                        maxLength={150}
                                        value={accessBusinessName}
                                        onChange={(e) => setAccessBusinessName(e.target.value)}
                                        placeholder={`${name.split(" ")[0] || "Their"}'s business`}
                                    />
                                </Field>
                            )}
                        </ConfirmDialog>
                    );
                })()}

        </div>
    );
}
