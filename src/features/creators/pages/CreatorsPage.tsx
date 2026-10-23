import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, TrendingUp, Star, BadgeCheck, UserPlus, Eye, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { creatorsService, type CreatorEnriched } from "../services/creators.service";
import { CreatorDetailModal } from "../components/CreatorDetailModal";
import { Button, IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { StatGrid, StatTile } from "@/components/ui/Stat";
import { IdLink } from "@/components/ui/IdLink";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { formatDate } from "@/utils/date";
import { formatCurrency } from "@/utils/format";

// ---- Constants ----
const ALLOWED_ROLES = ["admin", "super_admin", "finance"];
const PER_PAGE = 10;

const STATUS_OPTIONS: FilterOption[] = [
    { value: "active", label: "Active" },
    { value: "rejected", label: "Rejected" },
    { value: "suspended", label: "Suspended" },
];

const VERIFIED_OPTIONS: FilterOption[] = [
    { value: "true", label: "Verified" },
    { value: "false", label: "Unverified" },
];

// ---- Provision Creator Modal ----
function ProvisionCreatorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [userId, setUserId] = useState("");

    const provisionMutation = useMutation({
        mutationFn: (uid: string) => creatorsService.provisionCreator(uid),
        onSuccess: () => {
            toast.success("Creator provisioned successfully");
            queryClient.invalidateQueries({ queryKey: ["admin-creators"] });
            queryClient.invalidateQueries({ queryKey: ["admin-creator-platform-stats"] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["admin-user-stats"] });
            setUserId("");
            onClose();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const close = () => {
        setUserId("");
        onClose();
    };

    return (
        <Modal
            open={open}
            onClose={close}
            dismissible={!provisionMutation.isPending}
            title="Provision creator"
            description="Make someone a creator straight away, without the application."
            icon={UserPlus}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={provisionMutation.isPending}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={() => provisionMutation.mutate(userId)} disabled={!userId} loading={provisionMutation.isPending}>
                        Provision
                    </Button>
                </>
            }
        >
            <Field label="Person" htmlFor="provision-user" required hint="Search by name or email, or paste their user ID.">
                <EntityPicker id="provision-user" type="user" label="Person" value={userId} onChange={(id) => setUserId(id)} disabled={provisionMutation.isPending} />
            </Field>
        </Modal>
    );
}

// ---- Main Component ----
export function CreatorsPage() {
    const { user: currentUser } = useAuthStore();
    const navigate = useNavigate();
    const hasAccess = !!currentUser && currentUser.role?.some((r) => ALLOWED_ROLES.includes(r));
    const isAdmin = !!currentUser && currentUser.role?.some((r) => ["admin", "super_admin"].includes(r));

    // Filters, search and page live in the address.
    const { state, set, reset } = useUrlState({ q: "", status: "", verified: "", page: 1 });
    const [searchInput, setSearchInput] = useDebouncedUrlInput(state.q, (q) => set({ q }, { replace: true }));
    const statusFilter = STATUS_OPTIONS.some((o) => o.value === state.status) ? state.status : "";
    const verifiedFilter = state.verified === "true" || state.verified === "false" ? state.verified : "";
    const page = Math.max(1, state.page);

    const [viewingCreator, setViewingCreator] = useState<CreatorEnriched | null>(null);
    const [showProvision, setShowProvision] = useState(false);

    const { data: platformStats } = useQuery({
        queryKey: ["admin-creator-platform-stats"],
        queryFn: () => creatorsService.getPlatformStats(),
        staleTime: 60_000,
        enabled: isAdmin,
    });

    const queryParams = {
        search: state.q || undefined,
        status: statusFilter || undefined,
        is_verified: verifiedFilter !== "" ? verifiedFilter === "true" : undefined,
        page,
        page_size: PER_PAGE,
    };

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-creators", queryParams],
        queryFn: () => creatorsService.listCreators(queryParams),
        placeholderData: (prev) => prev,
        enabled: hasAccess,
    });

    const creators = data?.creators ?? [];
    const pagination = data?.pagination;

    if (!hasAccess) {
        return <AccessDenied message="Only admins and finance can manage creators." />;
    }

    const columns: DataColumn<CreatorEnriched>[] = [
        {
            id: "creator",
            header: "Creator",
            hideable: false,
            sortValue: (c) => c.name ?? "",
            csv: (c) => c.name ?? c.id,
            cell: (c) => (
                <div className="min-w-0">
                    <Link to={`/creators/${c.id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                        {c.name ?? c.id}
                    </Link>
                    {c.tagline && <div className="mt-0.5 max-w-[240px] truncate text-xs text-ink-muted">{c.tagline}</div>}
                </div>
            ),
        },
        { id: "user", header: "User", csv: (c) => c.user_id, cell: (c) => <IdLink kind="user" id={c.user_id} /> },
        { id: "status", header: "Status", sortValue: (c) => c.status, cell: (c) => <StatusPill status={c.status} /> },
        {
            id: "verified",
            header: "Verified",
            sortValue: (c) => c.is_verified,
            csv: (c) => (c.is_verified ? "yes" : "no"),
            cell: (c) =>
                c.is_verified ? (
                    <Tag tone="good">
                        <CheckCircle2 className="h-3 w-3" aria-hidden /> Verified
                    </Tag>
                ) : (
                    <span className="text-ink-faint">—</span>
                ),
        },
        { id: "quests", header: "Quests", align: "right", sortValue: (c) => c.total_quests ?? 0, cell: (c) => <span className="tabular-nums">{c.total_quests ?? "—"}</span> },
        {
            id: "earnings",
            header: "Earnings",
            align: "right",
            sortValue: (c) => c.total_earnings ?? 0,
            cell: (c) => <span className="tabular-nums">{c.total_earnings !== null && c.total_earnings !== undefined ? formatCurrency(c.total_earnings) : "—"}</span>,
        },
        {
            id: "joined",
            header: "Joined",
            sortValue: (c) => c.created_at ?? "",
            csv: (c) => formatDate(c.created_at),
            cell: (c) => <span className="whitespace-nowrap text-ink-muted">{formatDate(c.created_at)}</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (statusFilter) chips.push({ key: "status", label: chipLabel("Status", statusFilter, STATUS_OPTIONS), onRemove: () => set({ status: "" }) });
    if (verifiedFilter) chips.push({ key: "verified", label: chipLabel("Verified", verifiedFilter, VERIFIED_OPTIONS), onRemove: () => set({ verified: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Users}
                title="Creators"
                description={pagination ? `${pagination.total.toLocaleString("en-IN")} creators` : "People who make quests on SeekKrr"}
                primaryAction={
                    isAdmin && (
                        <Button variant="primary" icon={UserPlus} onClick={() => setShowProvision(true)}>
                            Provision creator
                        </Button>
                    )
                }
            />

            {platformStats && (
                <StatGrid>
                    <StatTile icon={Users} label="Total" value={platformStats.total_creators?.toLocaleString("en-IN") ?? "—"} />
                    <StatTile icon={TrendingUp} label="Active" value={(platformStats.by_status?.active ?? 0).toLocaleString("en-IN")} />
                    <StatTile icon={BadgeCheck} label="Verified" value={platformStats.verified_creators?.toLocaleString("en-IN") ?? "—"} />
                    <StatTile icon={Star} label="Suspended" value={(platformStats.by_status?.suspended ?? 0).toLocaleString("en-IN")} />
                </StatGrid>
            )}

            <FilterBar
                search={{ value: searchInput, onChange: setSearchInput, placeholder: "Search creators by name…" }}
                chips={chips}
                onReset={() => {
                    setSearchInput("");
                    reset();
                }}
            >
                <FilterSelect label="Status" value={statusFilter} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} allLabel="All statuses" />
                <FilterSelect label="Verified" value={verifiedFilter} onChange={(v) => set({ verified: v })} options={VERIFIED_OPTIONS} allLabel="Verified or not" />
            </FilterBar>

            <DataTable
                label="Creators"
                rows={creators}
                columns={columns}
                rowKey={(c) => c.id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: Users, title: "No creators found", description: chips.length || state.q ? "Try clearing a filter." : undefined }}
                onRowClick={(c) => setViewingCreator(c)}
                rowActions={(c) => (
                    <>
                        <IconButton icon={Eye} size="sm" label={`Quick view ${c.name ?? "creator"}`} onClick={() => setViewingCreator(c)} />
                        <IconButton icon={ExternalLink} size="sm" label={`Open ${c.name ?? "creator"}`} onClick={() => navigate(`/creators/${c.id}`)} />
                    </>
                )}
                storageKey="creators"
                exportName="creators"
                summary={pagination ? `${creators.length} of ${pagination.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (c) => c.name ?? c.id,
                    subtitle: (c) => c.tagline ?? undefined,
                    fields: ["status", "verified", "quests", "earnings"],
                }}
                footer={
                    pagination && (
                        <Pagination page={page} totalPages={pagination.total_pages} total={pagination.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />
                    )
                }
            />

            <CreatorDetailModal
                open={!!viewingCreator}
                creatorId={viewingCreator?.id ?? null}
                displayName={viewingCreator?.name ?? viewingCreator?.id ?? ""}
                onClose={() => setViewingCreator(null)}
            />

            <ProvisionCreatorModal open={showProvision} onClose={() => setShowProvision(false)} />
        </div>
    );
}
