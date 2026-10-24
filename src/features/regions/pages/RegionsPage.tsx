import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Compass, Eye, Globe, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@store/auth.store";
import { regionsService } from "../services/regions.service";
import { RegionCreateModal } from "../components/RegionCreateModal";
import { Button, ButtonLink, IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { runBulk } from "@/hooks/useBulkSelection";
import type { Region, RegionsListResponse, RegionType } from "@/types";

const PER_PAGE = 20;
const EDIT_ROLES = ["admin", "super_admin"];

const TYPE_OPTIONS: FilterOption[] = [
    { value: "city", label: "City" },
    { value: "hotspot", label: "Hotspot" },
];

export function RegionsPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const canEdit = !!user?.role?.some((r) => EDIT_ROLES.includes(r));

    // Search, type and page live in the address.
    const { state, set, reset } = useUrlState({ q: "", type: "", page: 1 });
    const type = (TYPE_OPTIONS.some((o) => o.value === state.type) ? state.type : "") as "" | RegionType;
    const page = Math.max(1, state.page);
    const [search, setSearch] = useDebouncedUrlInput(state.q, (q) => set({ q }, { replace: true }));

    const [showCreate, setShowCreate] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

    const { data, isLoading, isFetching, error, refetch } = useQuery<RegionsListResponse>({
        queryKey: ["admin-regions", { q: state.q, type, page }],
        queryFn: () => {
            if (state.q) return regionsService.search(state.q, page, PER_PAGE);
            return regionsService.list({ type: type || undefined, page, page_size: PER_PAGE });
        },
        staleTime: 5 * 60 * 1000,
        placeholderData: (prev) => prev,
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => regionsService.remove(id, false),
        onSuccess: () => {
            toast.success("Region deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-regions"] });
            setConfirmDelete(null);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const bulkDelete = useMutation({
        mutationFn: (ids: string[]) => runBulk(ids, (id) => regionsService.remove(id, false)),
        onSuccess: ({ ok, failed }) => {
            queryClient.invalidateQueries({ queryKey: ["admin-regions"] });
            if (ok > 0) toast.success(`Deleted ${ok} region${ok === 1 ? "" : "s"}`);
            if (failed > 0) toast.error(`${failed} couldn't be deleted (they may have quests attached)`);
            setSelected(new Set());
            setConfirmBulkDelete(false);
        },
        onError: () => {
            toast.error("Bulk delete failed");
            setConfirmBulkDelete(false);
        },
    });

    // Search results come back for every type; the type filter applies on top.
    const regions = (data?.regions ?? []).filter((r) => !state.q || !type || r.type === type);
    const total = data?.total ?? regions.length;
    const totalPages = data?.total_pages ?? Math.max(1, Math.ceil(total / PER_PAGE));

    const columns: DataColumn<Region>[] = [
        {
            id: "name",
            header: "Name",
            hideable: false,
            sortValue: (r) => r.name,
            cell: (r) => (
                <Link to={`/regions/${r.id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                    {r.name}
                </Link>
            ),
        },
        {
            id: "type",
            header: "Type",
            sortValue: (r) => r.type,
            cell: (r) => (
                <Tag tone={r.type === "city" ? "brand" : "warn"} className="capitalize">
                    {r.type}
                </Tag>
            ),
        },
        { id: "slug", header: "Slug", sortValue: (r) => r.slug, cell: (r) => <span className="font-mono text-xs text-ink-muted">{r.slug}</span> },
        { id: "markers", header: "Places", align: "right", sortValue: (r) => r.marker_count, cell: (r) => <span className="tabular-nums">{r.marker_count}</span> },
        { id: "weight", header: "Weight", align: "right", sortValue: (r) => r.admin_weight, cell: (r) => <span className="tabular-nums text-ink-muted">{r.admin_weight ?? "—"}</span> },
        {
            id: "active",
            header: "Status",
            sortValue: (r) => r.is_active,
            csv: (r) => (r.is_active ? "active" : "inactive"),
            cell: (r) => <StatusPill status={r.is_active ? "active" : "inactive"} label={r.is_active ? "Active" : "Inactive"} tone={r.is_active ? "good" : "neutral"} />,
        },
    ];

    const chips: FilterChip[] = [];
    if (type) chips.push({ key: "type", label: chipLabel("Type", type, TYPE_OPTIONS), onRemove: () => set({ type: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Globe}
                title="Regions"
                description={
                    <>
                        Cities, hotspots and their map settings
                        {data && <span className="text-ink-faint"> · {total.toLocaleString("en-IN")} total</span>}
                    </>
                }
                actions={
                    <ButtonLink to="/explore-map" variant="secondary" icon={Compass}>
                        Explore map
                    </ButtonLink>
                }
                primaryAction={
                    canEdit && (
                        <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
                            New region
                        </Button>
                    )
                }
            />

            <FilterBar
                search={{ value: search, onChange: setSearch, placeholder: "Search regions…" }}
                chips={chips}
                onReset={() => {
                    setSearch("");
                    reset();
                }}
            >
                <FilterSelect label="Type" value={type} onChange={(v) => set({ type: v })} options={TYPE_OPTIONS} allLabel="All types" />
            </FilterBar>

            <DataTable
                label="Regions"
                rows={regions}
                columns={columns}
                rowKey={(r) => r.id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: Globe, title: "No regions match.", description: chips.length || state.q ? "Try clearing a filter." : undefined }}
                onRowClick={(r) => navigate(`/regions/${r.id}`)}
                selectedIds={canEdit ? selected : undefined}
                onSelectionChange={canEdit ? setSelected : undefined}
                bulkActions={[{ label: "Delete", icon: Trash2, tone: "danger", onClick: () => setConfirmBulkDelete(true) }]}
                bulkBusy={bulkDelete.isPending}
                rowActions={(r) => (
                    <>
                        <IconButton icon={Eye} size="sm" label={`Open ${r.name}`} onClick={() => navigate(`/regions/${r.id}`)} />
                        {canEdit && (
                            <IconButton
                                icon={Trash2}
                                size="sm"
                                label={`Delete ${r.name}`}
                                className="hover:bg-bad-soft hover:text-bad"
                                onClick={() => setConfirmDelete({ id: r.id, name: r.name })}
                            />
                        )}
                    </>
                )}
                storageKey="regions"
                exportName="regions"
                summary={data ? `${regions.length} of ${total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (r) => r.name,
                    subtitle: (r) => r.slug,
                    fields: ["type", "markers", "weight", "active"],
                }}
                footer={data && <Pagination page={data.page ?? page} totalPages={totalPages} total={total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />}
            />

            <RegionCreateModal open={showCreate} onClose={() => setShowCreate(false)} onSuccess={(id) => navigate(`/regions/${id}`)} />

            <ConfirmDialog
                open={!!confirmDelete}
                title="Delete region?"
                description={`“${confirmDelete?.name ?? ""}” is removed from the app and the admin lists. Regions with quests attached can't be deleted.`}
                confirmLabel="Delete"
                tone="danger"
                onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
                onCancel={() => setConfirmDelete(null)}
                isPending={deleteMutation.isPending}
            />

            <ConfirmDialog
                open={confirmBulkDelete}
                title={`Delete ${selected.size} region${selected.size === 1 ? "" : "s"}?`}
                description="Regions with quests attached are skipped."
                confirmLabel={`Delete ${selected.size}`}
                tone="danger"
                onConfirm={() => bulkDelete.mutate(Array.from(selected))}
                onCancel={() => setConfirmBulkDelete(false)}
                isPending={bulkDelete.isPending}
            />
        </div>
    );
}
