import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MapPin, Plus, Eye, Trash2, MapPinPlus, Folder, Hash } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { markersService } from "../services/markers.service";
import { MarkerCreateModal } from "../components/MarkerCreateModal";
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
import { formatDate } from "@/utils/date";
import type { Marker, MarkerStatus } from "@/types";

const PER_PAGE = 20;

const STATUS_OPTIONS: FilterOption[] = [
    { value: "approved", label: "Approved" },
    { value: "pending", label: "Pending" },
    { value: "rejected", label: "Rejected" },
];

const VISIBILITY_OPTIONS: FilterOption[] = [
    { value: "hidden", label: "Hidden" },
    { value: "visible", label: "Visible" },
];

/** Small text filter (category / tags) that matches the filter-bar controls. */
function TextFilter({ label, icon: Icon, value, onChange }: { label: string; icon: typeof Folder; value: string; onChange: (v: string) => void }) {
    return (
        <div className="relative w-40 shrink-0">
            <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={`${label}…`}
                aria-label={label}
                className="h-10 w-full rounded-control border border-line-strong bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
        </div>
    );
}

export function MarkersPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const CAN_MANAGE = !!user?.role?.some((r) => ["admin", "super_admin"].includes(r));

    // Filters, search and page live in the address.
    const { state, set, reset } = useUrlState({ q: "", status: "", visibility: "", category: "", tags: "", page: 1 });
    const status = (STATUS_OPTIONS.some((o) => o.value === state.status) ? state.status : "") as "" | MarkerStatus;
    const visibility = state.visibility === "hidden" || state.visibility === "visible" ? state.visibility : "";
    const page = Math.max(1, state.page);

    const [search, setSearch] = useDebouncedUrlInput(state.q, (q) => set({ q }, { replace: true }));
    // Category applies from 3 letters (or when cleared), as before.
    const [category, setCategory] = useDebouncedUrlInput(state.category, (c) => {
        if (c.length >= 3 || c.length === 0) set({ category: c }, { replace: true });
    });
    const [tags, setTags] = useDebouncedUrlInput(state.tags, (t) => set({ tags: t }, { replace: true }));

    const [showCreate, setShowCreate] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-markers", { status, visibility, category: state.category, tags: state.tags, q: state.q, page }],
        queryFn: () =>
            markersService.list({
                status: status || undefined,
                hidden: visibility === "" ? undefined : visibility === "hidden",
                category: state.category || undefined,
                tags: state.tags || undefined,
                search: state.q || undefined,
                page,
                page_size: PER_PAGE,
            }),
        staleTime: 5 * 60 * 1000,
        placeholderData: (prev) => prev,
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => markersService.remove(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-markers"] });
            setConfirmDelete(null);
            toast.success("Place deleted");
        },
        onError: () => {
            toast.error("Failed to delete place");
            setConfirmDelete(null);
        },
    });

    const bulkDelete = useMutation({
        mutationFn: (ids: string[]) => runBulk(ids, (id) => markersService.remove(id)),
        onSuccess: ({ ok, failed }) => {
            queryClient.invalidateQueries({ queryKey: ["admin-markers"] });
            toast.success(`Deleted ${ok} place${ok === 1 ? "" : "s"}`);
            if (failed > 0) toast.error(`${failed} could not be deleted`);
            setSelected(new Set());
            setConfirmBulkDelete(false);
        },
        onError: () => {
            toast.error("Bulk delete failed");
            setConfirmBulkDelete(false);
        },
    });

    const markers = data?.markers ?? [];

    const columns: DataColumn<Marker>[] = [
        {
            id: "title",
            header: "Title",
            hideable: false,
            sortValue: (m) => m.title,
            cell: (m) => (
                <Link to={`/markers/${m.id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                    {m.title}
                </Link>
            ),
        },
        {
            id: "category",
            header: "Category",
            sortValue: (m) => m.categories?.[0] ?? "",
            csv: (m) => (m.categories ?? []).join(", "),
            cell: (m) =>
                m.categories && m.categories.length > 0 ? (
                    <Tag title={m.categories.join(", ")} className="max-w-[200px] capitalize">
                        <span className="truncate">
                            {m.categories[0]} {m.categories.length > 1 ? `+${m.categories.length - 1}` : ""}
                        </span>
                    </Tag>
                ) : (
                    <span className="text-ink-faint">—</span>
                ),
        },
        {
            id: "status",
            header: "Status",
            sortValue: (m) => m.status,
            csv: (m) => `${m.status}${m.hidden ? " (hidden)" : ""}`,
            cell: (m) => (
                <div className="flex flex-wrap items-center gap-1.5">
                    <StatusPill status={m.status} />
                    {m.hidden && <Tag>Hidden</Tag>}
                </div>
            ),
        },
        {
            id: "region",
            header: "Region",
            csv: (m) => m.region_id,
            cell: (m) =>
                m.region_id ? (
                    <Link to={`/regions/${m.region_id}`} className="font-mono text-xs text-accent-700 hover:underline" title={m.region_id}>
                        {m.region_id.slice(0, 8)}…
                    </Link>
                ) : (
                    <span className="text-ink-faint">—</span>
                ),
        },
        { id: "usage", header: "Usage", align: "right", sortValue: (m) => m.usage_count, cell: (m) => <span className="tabular-nums text-ink-muted">{m.usage_count}</span> },
        {
            id: "created",
            header: "Created",
            sortValue: (m) => m.created_at ?? "",
            csv: (m) => formatDate(m.created_at),
            cell: (m) => <span className="whitespace-nowrap text-ink-muted">{formatDate(m.created_at)}</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (status) chips.push({ key: "status", label: chipLabel("Status", status, STATUS_OPTIONS), onRemove: () => set({ status: "" }) });
    if (visibility) chips.push({ key: "visibility", label: chipLabel("Visibility", visibility, VISIBILITY_OPTIONS), onRemove: () => set({ visibility: "" }) });
    if (state.category) chips.push({ key: "category", label: `Category: ${state.category}`, onRemove: () => set({ category: "" }) });
    if (state.tags) chips.push({ key: "tags", label: `Tags: ${state.tags}`, onRemove: () => set({ tags: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={MapPin}
                title="Places"
                description={
                    <>
                        Moderate points of interest across regions
                        {data && <span className="text-ink-faint"> · {data.total.toLocaleString("en-IN")} total</span>}
                    </>
                }
                actions={
                    <ButtonLink to="/markers/applications" variant="secondary" icon={MapPinPlus}>
                        Place requests
                    </ButtonLink>
                }
                primaryAction={
                    CAN_MANAGE && (
                        <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
                            New place
                        </Button>
                    )
                }
            />

            <FilterBar
                search={{ value: search, onChange: setSearch, placeholder: "Search places…" }}
                chips={chips}
                onReset={() => {
                    setSearch("");
                    setCategory("");
                    setTags("");
                    reset();
                }}
            >
                <FilterSelect label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} allLabel="All statuses" />
                <FilterSelect label="Visibility" value={visibility} onChange={(v) => set({ visibility: v })} options={VISIBILITY_OPTIONS} allLabel="All visibility" />
                <TextFilter label="Category" icon={Folder} value={category} onChange={setCategory} />
                <TextFilter label="Tags" icon={Hash} value={tags} onChange={setTags} />
            </FilterBar>

            <DataTable
                label="Places"
                rows={markers}
                columns={columns}
                rowKey={(m) => m.id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: MapPin, title: "No places match these filters.", description: chips.length || state.q ? "Try clearing a filter." : undefined }}
                onRowClick={(m) => navigate(`/markers/${m.id}`)}
                selectedIds={CAN_MANAGE ? selected : undefined}
                onSelectionChange={CAN_MANAGE ? setSelected : undefined}
                bulkActions={[{ label: "Delete", icon: Trash2, tone: "danger", onClick: () => setConfirmBulkDelete(true) }]}
                bulkBusy={bulkDelete.isPending}
                rowActions={(m) => (
                    <>
                        <IconButton icon={Eye} size="sm" label={`View ${m.title}`} onClick={() => navigate(`/markers/${m.id}`)} />
                        {CAN_MANAGE && (
                            <IconButton
                                icon={Trash2}
                                size="sm"
                                label={`Delete ${m.title}`}
                                className="hover:bg-bad-soft hover:text-bad"
                                onClick={() => setConfirmDelete({ id: m.id, name: m.title })}
                            />
                        )}
                    </>
                )}
                storageKey="places"
                exportName="places"
                summary={data ? `${markers.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (m) => m.title,
                    subtitle: (m) => (m.categories?.length ? m.categories.join(", ") : undefined),
                    fields: ["status", "region", "usage", "created"],
                }}
                footer={data && <Pagination page={data.page} totalPages={data.total_pages} total={data.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />}
            />

            <MarkerCreateModal open={showCreate} onClose={() => setShowCreate(false)} />

            <ConfirmDialog
                open={!!confirmDelete}
                title="Delete place?"
                description={`Delete "${confirmDelete?.name ?? ""}"? It disappears from the app and the admin lists.`}
                confirmLabel="Delete"
                tone="danger"
                onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
                onCancel={() => setConfirmDelete(null)}
                isPending={deleteMutation.isPending}
            />

            <ConfirmDialog
                open={confirmBulkDelete}
                title={`Delete ${selected.size} place${selected.size === 1 ? "" : "s"}?`}
                description="They disappear from the app and the admin lists."
                confirmLabel={`Delete ${selected.size}`}
                tone="danger"
                onConfirm={() => bulkDelete.mutate(Array.from(selected))}
                onCancel={() => setConfirmBulkDelete(false)}
                isPending={bulkDelete.isPending}
            />
        </div>
    );
}
