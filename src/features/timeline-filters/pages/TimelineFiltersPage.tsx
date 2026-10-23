import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListFilter, Pencil, Plus, Trash2 } from "lucide-react";
import { AccessDenied } from "@/components/AccessDenied";
import { Button, IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Field, SelectInput, Switch, TextInput } from "@/components/ui/Field";
import { StatusPill } from "@/components/ui/StatusPill";
import { useAuthStore } from "@/store/auth.store";
import { timelineFiltersService } from "../services/timelineFilters.service";
import type { TimelineFilterItem } from "@/types";

const ALLOWED = ["admin", "super_admin", "moderator"];
const DEFAULT_COLOR = "#003634";

// Feeds the app's timeline can load; every chip opens one of them.
const FEEDS = [
    { key: "travel_logs", label: "Main Quest" },
    { key: "friends", label: "Friends" },
    { key: "community", label: "Community" },
    { key: "all", label: "Everything" },
] as const;
const isFeed = (key: string) => FEEDS.some((f) => f.key === key);
const feedLabel = (key: string) => FEEDS.find((f) => f.key === key)?.label;

function Swatch({ color }: { color?: string | null }) {
    return <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-line" style={{ backgroundColor: color || DEFAULT_COLOR }} aria-hidden />;
}

/** Edit one chip: label, feed, icon, colour, order, on/off. */
function FilterEditor({ row, onClose }: { row: TimelineFilterItem; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState<TimelineFilterItem>(row);
    const patch = (p: Partial<TimelineFilterItem>) => setDraft((d) => ({ ...d, ...p }));
    const labelMissing = !draft.label.trim();
    const feedMissing = !isFeed(draft.key);

    const save = useMutation({
        mutationFn: () =>
            timelineFiltersService.update(draft.id, {
                key: draft.key,
                label: draft.label.trim(),
                icon: draft.icon,
                color: draft.color,
                order: draft.order,
                is_active: draft.is_active,
            }),
        onSuccess: () => {
            toast.success("Saved");
            queryClient.invalidateQueries({ queryKey: ["admin-timeline-filters"] });
            onClose();
        },
        onError: (e: Error) => toast.error(e.message || "Save failed"),
    });

    return (
        <Modal
            open
            onClose={onClose}
            dismissible={!save.isPending}
            title="Edit filter"
            description="A chip on the app's Timeline feed."
            icon={ListFilter}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={() => save.mutate()} loading={save.isPending} disabled={labelMissing || feedMissing}>
                        Save
                    </Button>
                </>
            }
        >
            <Field label="Label" required error={labelMissing ? "Label is required." : undefined}>
                <TextInput value={draft.label} onChange={(e) => patch({ label: e.target.value })} placeholder="Label" autoFocus />
            </Field>
            <Field
                label="Opens feed"
                required
                error={feedMissing ? "Pick which feed this chip opens. Until then it's hidden in the app." : undefined}
            >
                <SelectInput value={isFeed(draft.key) ? draft.key : ""} onChange={(e) => patch({ key: e.target.value })}>
                    {feedMissing && (
                        <option value="" disabled>
                            Not shown in app: pick a feed
                        </option>
                    )}
                    {FEEDS.map((f) => (
                        <option key={f.key} value={f.key}>
                            {f.label}
                        </option>
                    ))}
                </SelectInput>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Icon" hint="Icon name used by the app." className="sm:col-span-1">
                    <TextInput value={draft.icon ?? ""} onChange={(e) => patch({ icon: e.target.value })} placeholder="icon" />
                </Field>
                <Field label="Colour" htmlFor="tf-color">
                    <input
                        id="tf-color"
                        type="color"
                        value={draft.color || DEFAULT_COLOR}
                        onChange={(e) => patch({ color: e.target.value })}
                        className="h-10 w-full cursor-pointer rounded-control border border-line-strong bg-surface px-1"
                    />
                </Field>
                <Field label="Order">
                    <TextInput type="number" inputMode="numeric" value={draft.order} onChange={(e) => patch({ order: parseInt(e.target.value || "0", 10) })} />
                </Field>
            </div>
            <Switch checked={draft.is_active} onChange={(v) => patch({ is_active: v })} label="Active" description="Inactive chips are kept but not shown in the app." />
        </Modal>
    );
}

export function TimelineFiltersPage() {
    const { user } = useAuthStore();
    const hasAccess = !!user?.role?.some((r) => ALLOWED.includes(r));
    if (!hasAccess) {
        return <AccessDenied message="You need an admin or moderator role to manage timeline filters." />;
    }
    return <TimelineFiltersList />;
}

function TimelineFiltersList() {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState<TimelineFilterItem | null>(null);
    const [deleting, setDeleting] = useState<TimelineFilterItem | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-timeline-filters"],
        queryFn: () => timelineFiltersService.list(),
    });
    const rows = data ?? [];
    const unusedFeed = FEEDS.find((f) => !rows.some((r) => r.key === f.key));

    const add = useMutation({
        mutationFn: () => {
            if (!unusedFeed) throw new Error("Every feed already has a chip");
            return timelineFiltersService.create({ label: unusedFeed.label, key: unusedFeed.key, color: DEFAULT_COLOR, order: rows.length });
        },
        onSuccess: () => {
            toast.success("Filter added");
            queryClient.invalidateQueries({ queryKey: ["admin-timeline-filters"] });
        },
        onError: (e: Error) => toast.error(e.message || "Add failed"),
    });

    const remove = useMutation({
        mutationFn: (id: string) => timelineFiltersService.remove(id),
        onSuccess: () => {
            toast.success("Deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-timeline-filters"] });
            setDeleting(null);
        },
        onError: (e: Error) => {
            toast.error(e.message || "Delete failed");
            setDeleting(null);
        },
    });

    const columns: DataColumn<TimelineFilterItem>[] = [
        {
            id: "label",
            header: "Label",
            hideable: false,
            sortValue: (r) => r.label,
            cell: (r) => (
                <span className="inline-flex items-center gap-2 font-medium text-ink">
                    <Swatch color={r.color} />
                    {r.label || <span className="text-ink-faint">Untitled</span>}
                </span>
            ),
        },
        {
            id: "feed",
            header: "Opens feed",
            sortValue: (r) => feedLabel(r.key) ?? "",
            csv: (r) => feedLabel(r.key) ?? r.key,
            cell: (r) => (isFeed(r.key) ? <span className="text-ink">{feedLabel(r.key)}</span> : <StatusPill status="missing" tone="bad" label="Not shown: pick a feed" />),
        },
        { id: "icon", header: "Icon", sortValue: (r) => r.icon ?? "", cell: (r) => (r.icon ? <span className="font-mono text-xs text-ink-muted">{r.icon}</span> : <span className="text-ink-faint">—</span>) },
        { id: "color", header: "Colour", csv: (r) => r.color ?? "", cell: (r) => <span className="font-mono text-xs text-ink-muted">{r.color || DEFAULT_COLOR}</span>, defaultHidden: true },
        { id: "order", header: "Order", align: "right", sortValue: (r) => r.order, cell: (r) => <span className="tabular-nums text-ink-muted">{r.order}</span> },
        {
            id: "active",
            header: "Status",
            sortValue: (r) => r.is_active,
            csv: (r) => (r.is_active ? "active" : "inactive"),
            cell: (r) => <StatusPill status={r.is_active ? "active" : "hidden"} label={r.is_active ? "Active" : "Inactive"} />,
        },
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                icon={ListFilter}
                title="Timeline filters"
                description="Chips shown on the app's Timeline feed. Each one opens a feed; with none set the app shows Main Quest, Friends and Community."
                primaryAction={
                    <Button
                        variant="primary"
                        icon={Plus}
                        onClick={() => add.mutate()}
                        loading={add.isPending}
                        disabled={!unusedFeed || isLoading}
                        title={unusedFeed ? `Adds a chip for ${unusedFeed.label}` : "Every feed already has a chip"}
                    >
                        Add filter
                    </Button>
                }
            />

            <DataTable
                label="Timeline filters"
                rows={rows}
                columns={columns}
                rowKey={(r) => r.id}
                isLoading={isLoading}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: ListFilter, title: "No filters yet.", description: "Add one to choose which feeds the app shows." }}
                onRowClick={(r) => setEditing(r)}
                rowActions={(r) => (
                    <>
                        <IconButton icon={Pencil} size="sm" label={`Edit ${r.label}`} onClick={() => setEditing(r)} />
                        <IconButton icon={Trash2} size="sm" label={`Delete ${r.label}`} className="hover:bg-bad-soft hover:text-bad" onClick={() => setDeleting(r)} />
                    </>
                )}
                storageKey="timeline-filters"
                summary={data ? `${rows.length} filter${rows.length === 1 ? "" : "s"}` : undefined}
                card={{
                    title: (r) => (
                        <span className="inline-flex items-center gap-2">
                            <Swatch color={r.color} />
                            {r.label || "Untitled"}
                        </span>
                    ),
                    fields: ["feed", "active", "order", "icon"],
                }}
            />

            {editing && <FilterEditor key={editing.id} row={editing} onClose={() => setEditing(null)} />}

            <ConfirmDialog
                open={!!deleting}
                title="Delete filter?"
                description={
                    <>
                        The <span className="font-medium text-ink">{deleting?.label}</span> chip disappears from the app's Timeline.
                    </>
                }
                confirmLabel="Delete"
                tone="danger"
                isPending={remove.isPending}
                onConfirm={() => deleting && remove.mutate(deleting.id)}
                onCancel={() => setDeleting(null)}
            />
        </div>
    );
}
