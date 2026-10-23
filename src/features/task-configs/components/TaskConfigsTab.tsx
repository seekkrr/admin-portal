import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, Pencil, Settings2, Trash2 } from "lucide-react";
import { FilterBar, FilterSelect, type FilterChip } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { Tag } from "@/components/ui/StatusPill";
import { Switch } from "@/components/ui/Field";
import { IdLink } from "@/components/ui/IdLink";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { humanizeStatus } from "@/components/ui/status";
import { useUrlState } from "@/hooks/useUrlState";
import { formatDate } from "@/utils/date";
import { taskConfigsService } from "../services/task-configs.service";
import { TASK_TYPE_OPTIONS } from "./taskConfigForm";
import { TaskConfigFormModal } from "./TaskConfigFormModal";
import type { TaskConfig, TaskConfigType } from "@/types";

const PER_PAGE = 20;

/** Task configs: filters in the address, the shared list, create / edit / toggle / delete. */
export function TaskConfigsTab({ canManage, createOpen, onCloseCreate }: { canManage: boolean; createOpen: boolean; onCloseCreate: () => void }) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { state, set, reset } = useUrlState({ quest: "", place: "", type: "", page: 1 });
    const taskType = (TASK_TYPE_OPTIONS.some((o) => o.value === state.type) ? state.type : "") as TaskConfigType | "";
    const page = Math.max(1, state.page);

    const [editTask, setEditTask] = useState<TaskConfig | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<TaskConfig | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-task-configs", { quest_id: state.quest, marker_id: state.place, task_type: taskType, page }],
        queryFn: () =>
            taskConfigsService.list({
                quest_id: state.quest || undefined,
                marker_id: state.place || undefined,
                task_type: taskType || undefined,
                page,
                page_size: PER_PAGE,
            }),
        staleTime: 60 * 1000,
        placeholderData: (prev) => prev,
    });

    const toggleMutation = useMutation({
        mutationFn: (id: string) => taskConfigsService.toggleActive(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-task-configs"] });
            toast.success("Active state toggled");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to toggle"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => taskConfigsService.remove(id, false),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-task-configs"] });
            toast.success("Task config deleted");
            setConfirmDelete(null);
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to delete");
            setConfirmDelete(null);
        },
    });

    const configs = data?.task_configs ?? [];

    const columns: DataColumn<TaskConfig>[] = [
        {
            id: "title",
            header: "Title",
            hideable: false,
            sortValue: (t) => t.title,
            cell: (t) => (
                <Link to={`/task-configs/${t._id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                    {t.title}
                </Link>
            ),
        },
        { id: "type", header: "Type", sortValue: (t) => t.task_type, csv: (t) => t.task_type, cell: (t) => <Tag>{humanizeStatus(t.task_type)}</Tag> },
        { id: "place", header: "Place", csv: (t) => t.marker_id, cell: (t) => <IdLink kind="place" id={t.marker_id} /> },
        { id: "quest", header: "Quest", csv: (t) => t.quest_id ?? "", cell: (t) => <IdLink kind="quest" id={t.quest_id} /> },
        {
            id: "points",
            header: "Points",
            align: "right",
            sortValue: (t) => t.base_points,
            cell: (t) => <span className="tabular-nums">{t.base_points.toLocaleString("en-IN")}</span>,
        },
        {
            id: "active",
            header: "Active",
            sortValue: (t) => t.is_active,
            csv: (t) => (t.is_active ? "yes" : "no"),
            cell: (t) =>
                canManage ? (
                    <Switch
                        size="sm"
                        hideLabel
                        checked={t.is_active}
                        label={`${t.title} is ${t.is_active ? "active" : "inactive"}`}
                        disabled={toggleMutation.isPending}
                        onChange={() => toggleMutation.mutate(t._id)}
                    />
                ) : (
                    <Tag tone={t.is_active ? "good" : "neutral"}>{t.is_active ? "Active" : "Inactive"}</Tag>
                ),
        },
        {
            id: "created",
            header: "Created",
            defaultHidden: true,
            sortValue: (t) => t.created_at ?? "",
            csv: (t) => formatDate(t.created_at),
            cell: (t) => <span className="whitespace-nowrap text-ink-muted">{formatDate(t.created_at)}</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (state.place) chips.push({ key: "place", label: "Place filter", onRemove: () => set({ place: "" }) });
    if (state.quest) chips.push({ key: "quest", label: "Quest filter", onRemove: () => set({ quest: "" }) });
    if (taskType) chips.push({ key: "type", label: chipLabel("Type", taskType, TASK_TYPE_OPTIONS), onRemove: () => set({ type: "" }) });

    return (
        <>
            <FilterBar chips={chips} onReset={reset}>
                <EntityPicker variant="filter" type="place" label="Place" placeholder="Filter by place…" value={state.place} onChange={(id) => set({ place: id })} />
                <EntityPicker variant="filter" type="quest" label="Quest" placeholder="Filter by quest…" value={state.quest} onChange={(id) => set({ quest: id })} />
                <FilterSelect label="Type" value={taskType} onChange={(v) => set({ type: v })} options={TASK_TYPE_OPTIONS} allLabel="All types" />
            </FilterBar>

            <DataTable
                label="Task configs"
                rows={configs}
                columns={columns}
                rowKey={(t) => t._id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: Settings2, title: "No task configs match these filters.", description: chips.length ? "Try clearing a filter." : undefined }}
                onRowClick={(t) => navigate(`/task-configs/${t._id}`)}
                rowActions={(t) => (
                    <>
                        <div className="hidden items-center gap-0.5 md:flex">
                            <IconButton icon={Eye} size="sm" label={`View ${t.title}`} onClick={() => navigate(`/task-configs/${t._id}`)} />
                            {canManage && <IconButton icon={Pencil} size="sm" label={`Edit ${t.title}`} onClick={() => setEditTask(t)} />}
                            {canManage && (
                                <IconButton icon={Trash2} size="sm" label={`Delete ${t.title}`} className="hover:bg-bad-soft hover:text-bad" onClick={() => setConfirmDelete(t)} />
                            )}
                        </div>
                        <div className="md:hidden">
                            <Menu
                                label={`Actions for ${t.title}`}
                                triggerVariant="ghost"
                                size="sm"
                                items={[
                                    { label: "View", icon: Eye, to: `/task-configs/${t._id}` },
                                    { label: "Edit", icon: Pencil, onSelect: () => setEditTask(t), hidden: !canManage },
                                    { label: "Delete", icon: Trash2, danger: true, onSelect: () => setConfirmDelete(t), hidden: !canManage },
                                ]}
                            />
                        </div>
                    </>
                )}
                storageKey="task-configs"
                exportName="task-configs"
                summary={data ? `${configs.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (t) => t.title,
                    subtitle: (t) => humanizeStatus(t.task_type),
                    fields: ["place", "points", "active", "quest"],
                }}
                footer={data && <Pagination page={data.page} totalPages={data.total_pages} total={data.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />}
            />

            <TaskConfigFormModal
                open={createOpen || !!editTask}
                task={editTask}
                onClose={() => {
                    setEditTask(null);
                    onCloseCreate();
                }}
            />

            <ConfirmDialog
                open={!!confirmDelete}
                title="Delete task config?"
                description={`Delete "${confirmDelete?.title ?? ""}"? It stops showing at its place.`}
                confirmLabel="Delete"
                tone="danger"
                onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete._id)}
                onCancel={() => setConfirmDelete(null)}
                isPending={deleteMutation.isPending}
            />
        </>
    );
}
