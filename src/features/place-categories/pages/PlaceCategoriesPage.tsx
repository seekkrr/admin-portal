import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil, Plus, Shapes } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { errorMessage } from "@/utils/errors";
import { placeCategoriesService, type PlaceCategory } from "../services/place-categories.service";
import { CategoryFormDrawer } from "../components/CategoryFormDrawer";

const STATUS_OPTIONS: FilterOption[] = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
];

function Swatch({ color }: { color: string | null }) {
    return (
        <span
            className="inline-block h-4 w-4 shrink-0 rounded-full border border-line"
            style={{ backgroundColor: color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : "transparent" }}
            aria-hidden
        />
    );
}

/** Place categories (Places and map): the categories places pick, with sub-categories, colour and pin frame. */
export function PlaceCategoriesPage() {
    const queryClient = useQueryClient();
    const { state, set, reset } = useUrlState({ q: "", status: "" });
    const status = state.status === "active" || state.status === "inactive" ? state.status : "";
    const [search, setSearch] = useDebouncedUrlInput(state.q, (q) => set({ q }, { replace: true }), 200);
    const [editing, setEditing] = useState<PlaceCategory | null>(null);
    const [creating, setCreating] = useState(false);
    const [toggling, setToggling] = useState<PlaceCategory | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["place-categories"],
        queryFn: () => placeCategoriesService.list(),
        retry: false,
    });

    const toggle = useMutation({
        mutationFn: (c: PlaceCategory) => placeCategoriesService.update(c.id, { is_active: !c.is_active }),
        onSuccess: (c) => {
            queryClient.invalidateQueries({ queryKey: ["place-categories"] });
            toast.success(`${c.name} is ${c.is_active ? "active" : "inactive"} now`);
            setToggling(null);
        },
        onError: (e) => {
            toast.error(errorMessage(e));
            setToggling(null);
        },
    });

    const rows = useMemo(() => {
        const q = state.q.toLowerCase();
        return (data ?? []).filter((c) => {
            if (status === "active" && !c.is_active) return false;
            if (status === "inactive" && c.is_active) return false;
            if (!q) return true;
            return c.name.toLowerCase().includes(q) || c.sub_categories.some((s) => s.toLowerCase().includes(q));
        });
    }, [data, state.q, status]);

    const columns: DataColumn<PlaceCategory>[] = [
        {
            id: "name",
            header: "Name",
            hideable: false,
            sortValue: (c) => c.name,
            cell: (c) => (
                <button type="button" onClick={() => setEditing(c)} className="inline-flex items-center gap-2 text-left font-medium text-ink hover:text-accent-700 hover:underline">
                    <Swatch color={c.color} />
                    {c.name}
                </button>
            ),
        },
        {
            id: "subs",
            header: "Sub-categories",
            sortValue: (c) => c.sub_categories.length,
            csv: (c) => c.sub_categories.join(", "),
            className: "max-w-[28rem]",
            cell: (c) =>
                c.sub_categories.length === 0 ? (
                    <span className="text-ink-faint">—</span>
                ) : (
                    <span className="flex flex-wrap gap-1" title={c.sub_categories.join(", ")}>
                        {c.sub_categories.slice(0, 4).map((s) => (
                            <Tag key={s}>{s}</Tag>
                        ))}
                        {c.sub_categories.length > 4 && <Tag tone="brand">+{c.sub_categories.length - 4}</Tag>}
                    </span>
                ),
        },
        {
            id: "status",
            header: "Status",
            sortValue: (c) => c.is_active,
            csv: (c) => (c.is_active ? "active" : "inactive"),
            cell: (c) => <StatusPill status={c.is_active ? "active" : "hidden"} label={c.is_active ? "Active" : "Inactive"} />,
        },
        { id: "color", header: "Colour", defaultHidden: true, sortValue: (c) => c.color ?? "", cell: (c) => <span className="font-mono text-xs text-ink-muted">{c.color ?? "—"}</span> },
        { id: "icon", header: "Icon", defaultHidden: true, sortValue: (c) => c.icon ?? "", cell: (c) => <span className="text-ink-muted">{c.icon ?? "—"}</span> },
        {
            id: "frame",
            header: "Pin frame",
            csv: (c) => c.cdn_frame,
            cell: (c) =>
                c.cdn_frame ? <img src={c.cdn_frame} alt="" className="h-8 w-8 rounded-md border border-line bg-surface-muted object-contain p-0.5" /> : <span className="text-ink-faint">—</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (status) chips.push({ key: "status", label: chipLabel("Status", status, STATUS_OPTIONS), onRemove: () => set({ status: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Shapes}
                title="Categories"
                description={
                    <>
                        The categories places pick from
                        {data && <span className="text-ink-faint"> · {data.length} total</span>}
                    </>
                }
                primaryAction={
                    <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                        New category
                    </Button>
                }
            />

            <FilterBar
                search={{ value: search, onChange: setSearch, placeholder: "Search categories and sub-categories…" }}
                chips={chips}
                onReset={() => {
                    setSearch("");
                    reset();
                }}
            >
                <FilterSelect label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} allLabel="All statuses" />
            </FilterBar>

            <DataTable
                label="Categories"
                rows={rows}
                columns={columns}
                rowKey={(c) => c.id}
                isLoading={isLoading}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{
                    icon: Shapes,
                    title: data?.length ? "No categories match." : "No categories yet.",
                    action: data?.length ? undefined : (
                        <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                            New category
                        </Button>
                    ),
                }}
                onRowClick={setEditing}
                rowActions={(c) => (
                    <>
                        <IconButton icon={Pencil} size="sm" label={`Edit ${c.name}`} onClick={() => setEditing(c)} />
                        <IconButton icon={c.is_active ? EyeOff : Eye} size="sm" label={c.is_active ? `Turn off ${c.name}` : `Turn on ${c.name}`} onClick={() => setToggling(c)} />
                    </>
                )}
                storageKey="place-categories"
                exportName="place-categories"
                summary={data ? `${rows.length} of ${data.length}` : undefined}
                card={{
                    title: (c) => (
                        <span className="inline-flex items-center gap-2">
                            <Swatch color={c.color} />
                            {c.name}
                        </span>
                    ),
                    subtitle: (c) => (c.sub_categories.length ? c.sub_categories.join(", ") : undefined),
                    fields: ["status", "frame"],
                }}
            />

            <CategoryFormDrawer
                open={creating || !!editing}
                category={editing}
                onClose={() => {
                    setCreating(false);
                    setEditing(null);
                }}
            />

            <ConfirmDialog
                open={!!toggling}
                title={toggling?.is_active ? `Turn off ${toggling.name}?` : `Turn on ${toggling?.name ?? ""}?`}
                description={
                    toggling?.is_active
                        ? "It disappears from the app's filters and can't be picked for new places. Places already in it keep it."
                        : "It shows in the app again and can be picked for places."
                }
                confirmLabel={toggling?.is_active ? "Turn off" : "Turn on"}
                tone={toggling?.is_active ? "warning" : "primary"}
                isPending={toggle.isPending}
                onConfirm={() => toggling && toggle.mutate(toggling)}
                onCancel={() => setToggling(null)}
            />
        </div>
    );
}
