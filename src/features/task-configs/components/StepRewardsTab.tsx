import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calculator, Gift, Hash, Pencil, Trash2 } from "lucide-react";
import { FilterBar, FilterSelect, type FilterChip } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { humanizeStatus } from "@/components/ui/status";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { stepRewardsService } from "../services/step-rewards.service";
import type { StepReward, StepRewardContextType } from "@/types";
import { CONTEXT_OPTIONS, contextTarget } from "./stepRewardForm";
import { StepRewardFormModal } from "./StepRewardFormModal";
import { EvaluateModal } from "./EvaluateModal";

const PER_PAGE = 20;

function ContextLink({ reward }: { reward: StepReward }) {
    const kind = contextTarget(reward.context_type).kind;
    if (kind) return <IdLink kind={kind} id={reward.context_id} />;
    return (
        <span className="font-mono text-xs text-ink-muted" title={reward.context_id}>
            {reward.context_id}
        </span>
    );
}

/** Step rewards: points for finishing a quest, visiting a place, completing a task or keeping a streak. */
export function StepRewardsTab({ canManage, createOpen, onCloseCreate }: { canManage: boolean; createOpen: boolean; onCloseCreate: () => void }) {
    const queryClient = useQueryClient();
    const { state, set, reset } = useUrlState({ context: "", ref: "", page: 1 });
    const contextType = (CONTEXT_OPTIONS.some((o) => o.value === state.context) ? state.context : "") as StepRewardContextType | "";
    const page = Math.max(1, state.page);
    const target = contextType ? contextTarget(contextType) : null;
    const [refInput, setRefInput] = useDebouncedUrlInput(state.ref, (ref) => set({ ref }, { replace: true }));

    const [editReward, setEditReward] = useState<StepReward | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<StepReward | null>(null);
    const [evaluateTarget, setEvaluateTarget] = useState<StepReward | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-step-rewards", { context_type: contextType, context_id: state.ref, page }],
        queryFn: () =>
            stepRewardsService.list({
                context_type: contextType || undefined,
                context_id: state.ref || undefined,
                page,
                page_size: PER_PAGE,
            }),
        staleTime: 60 * 1000,
        placeholderData: (prev) => prev,
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => stepRewardsService.remove(id, false),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-step-rewards"] });
            toast.success("Step reward deleted");
            setConfirmDelete(null);
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to delete step reward");
            setConfirmDelete(null);
        },
    });

    const rewards = data?.rewards ?? [];

    const columns: DataColumn<StepReward>[] = [
        {
            id: "context",
            header: "Context",
            hideable: false,
            sortValue: (r) => r.context_type,
            csv: (r) => r.context_type,
            cell: (r) => <Tag>{humanizeStatus(r.context_type)}</Tag>,
        },
        { id: "ref", header: "For", csv: (r) => r.context_id, cell: (r) => <ContextLink reward={r} /> },
        { id: "base", header: "Base points", align: "right", sortValue: (r) => r.base_points, cell: (r) => <span className="tabular-nums">{r.base_points.toLocaleString("en-IN")}</span> },
        {
            id: "bonuses",
            header: "Bonuses",
            align: "right",
            sortValue: (r) => r.bonus_conditions?.length ?? 0,
            cell: (r) => <span className="tabular-nums text-ink-muted">{r.bonus_conditions?.length ?? 0}</span>,
        },
        {
            id: "badges",
            header: "Unlocks",
            defaultHidden: true,
            csv: (r) => [...(r.unlocked_badges ?? []), ...(r.unlocked_content ?? [])].join(", "),
            cell: (r) => {
                const items = [...(r.unlocked_badges ?? []), ...(r.unlocked_content ?? [])];
                return items.length ? <span className="text-ink-muted">{items.join(", ")}</span> : <span className="text-ink-faint">—</span>;
            },
        },
    ];

    const chips: FilterChip[] = [];
    if (contextType) chips.push({ key: "context", label: chipLabel("Context", contextType, CONTEXT_OPTIONS), onRemove: () => set({ context: "", ref: "" }) });
    if (state.ref) chips.push({ key: "ref", label: `${target?.label ?? "Context ID"} filter`, onRemove: () => set({ ref: "" }) });

    return (
        <>
            <FilterBar
                chips={chips}
                onReset={() => {
                    setRefInput("");
                    reset();
                }}
            >
                <FilterSelect label="Context" value={contextType} onChange={(v) => set({ context: v, ref: "" })} options={CONTEXT_OPTIONS} allLabel="All contexts" />
                {target?.search ? (
                    <EntityPicker variant="filter" type={target.search} label={target.label} value={state.ref} onChange={(id) => set({ ref: id })} />
                ) : (
                    <div className="relative w-56 shrink-0">
                        <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
                        <input
                            type="text"
                            value={refInput}
                            onChange={(e) => setRefInput(e.target.value)}
                            placeholder={`${target?.label ?? "Context ID"}…`}
                            aria-label={target?.label ?? "Context ID"}
                            className="h-10 w-full rounded-control border border-line-strong bg-surface pl-9 pr-3 font-mono text-sm text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent-500"
                        />
                    </div>
                )}
            </FilterBar>

            <DataTable
                label="Step rewards"
                rows={rewards}
                columns={columns}
                rowKey={(r) => r._id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: Gift, title: "No step rewards match these filters.", description: chips.length ? "Try clearing a filter." : undefined }}
                rowActions={(r) => (
                    <>
                        <div className="hidden items-center gap-0.5 md:flex">
                            <IconButton icon={Calculator} size="sm" label="Evaluate reward" onClick={() => setEvaluateTarget(r)} />
                            {canManage && <IconButton icon={Pencil} size="sm" label="Edit step reward" onClick={() => setEditReward(r)} />}
                            {canManage && (
                                <IconButton icon={Trash2} size="sm" label="Delete step reward" className="hover:bg-bad-soft hover:text-bad" onClick={() => setConfirmDelete(r)} />
                            )}
                        </div>
                        <div className="md:hidden">
                            <Menu
                                label="Step reward actions"
                                triggerVariant="ghost"
                                size="sm"
                                items={[
                                    { label: "Evaluate", icon: Calculator, onSelect: () => setEvaluateTarget(r) },
                                    { label: "Edit", icon: Pencil, onSelect: () => setEditReward(r), hidden: !canManage },
                                    { label: "Delete", icon: Trash2, danger: true, onSelect: () => setConfirmDelete(r), hidden: !canManage },
                                ]}
                            />
                        </div>
                    </>
                )}
                storageKey="step-rewards"
                exportName="step-rewards"
                summary={data ? `${rewards.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (r) => humanizeStatus(r.context_type),
                    fields: ["ref", "base", "bonuses"],
                }}
                footer={data && <Pagination page={data.page} totalPages={data.total_pages} total={data.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />}
            />

            <StepRewardFormModal
                open={createOpen || !!editReward}
                reward={editReward}
                onClose={() => {
                    setEditReward(null);
                    onCloseCreate();
                }}
            />

            <EvaluateModal reward={evaluateTarget} onClose={() => setEvaluateTarget(null)} />

            <ConfirmDialog
                open={!!confirmDelete}
                title="Delete step reward?"
                description={`Delete the ${confirmDelete ? humanizeStatus(confirmDelete.context_type).toLowerCase() : ""} reward for ${confirmDelete?.context_id ?? ""}? No points are given for it afterwards.`}
                confirmLabel="Delete"
                tone="danger"
                onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete._id)}
                onCancel={() => setConfirmDelete(null)}
                isPending={deleteMutation.isPending}
            />
        </>
    );
}
