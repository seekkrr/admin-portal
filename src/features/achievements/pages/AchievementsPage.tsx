import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Trophy, Plus, Pencil, Trash2, Eye } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Button, IconButton } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusPill";
import { humanizeStatus } from "@/components/ui/status";
import { useUrlState } from "@/hooks/useUrlState";
import { achievementsService } from "../services/achievements.service";
import { AchievementFormModal } from "../components/AchievementFormModal";
import { ExplorerLevelsTable } from "../components/ExplorerLevelsTable";
import { UserAchievementsLookup } from "../components/UserAchievementsLookup";
import { RARITY_OPTIONS, RARITY_TONE, TRIGGER_OPTIONS, triggerLabel } from "../components/achievementForm";
import type { Achievement, AchievementRarity, AchievementTriggerType } from "@/types";

const PER_PAGE = 20;

type Tab = "list" | "levels" | "user";

const ACTIVE_OPTIONS: FilterOption[] = [
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" },
];

/** Achievements (unlockable badges and their rules), explorer levels, and a per-person lookup. */
export function AchievementsPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const CAN_MANAGE = !!user?.role?.some((r) => ["admin", "super_admin"].includes(r));
    const IS_SUPER = !!user?.role?.includes("super_admin");

    const { state, set } = useUrlState({ tab: "list", trigger: "", rarity: "", active: "", user: "", page: 1 });
    const tab: Tab = state.tab === "levels" || state.tab === "user" ? state.tab : "list";
    const triggerType = (TRIGGER_OPTIONS.some((o) => o.value === state.trigger) ? state.trigger : "") as "" | AchievementTriggerType;
    const rarity = (RARITY_OPTIONS.some((o) => o.value === state.rarity) ? state.rarity : "") as "" | AchievementRarity;
    const isActive = state.active === "true" || state.active === "false" ? state.active : "";
    const page = Math.max(1, state.page);

    const [modal, setModal] = useState<{ achievement: Achievement | null } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Achievement | null>(null);
    const [hardDelete, setHardDelete] = useState(false);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-achievements", { page, trigger_type: triggerType, rarity, is_active: isActive }],
        queryFn: () =>
            achievementsService.list({
                page,
                page_size: PER_PAGE,
                trigger_type: triggerType || undefined,
                rarity: rarity || undefined,
                is_active: isActive === "" ? undefined : isActive === "true",
            }),
        staleTime: 5 * 60 * 1000,
        enabled: tab === "list",
        placeholderData: (prev) => prev,
    });

    const deleteMutation = useMutation({
        mutationFn: ({ id, hard }: { id: string; hard: boolean }) => achievementsService.remove(id, hard),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-achievements"] });
            toast.success("Achievement deleted");
            setConfirmDelete(null);
            setHardDelete(false);
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to delete achievement");
            setConfirmDelete(null);
            setHardDelete(false);
        },
    });

    const achievements = data?.achievements ?? [];

    const columns: DataColumn<Achievement>[] = [
        {
            id: "title",
            header: "Title",
            hideable: false,
            sortValue: (a) => a.title,
            cell: (a) => (
                <Link to={`/achievements/${a._id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                    {a.title}
                </Link>
            ),
        },
        { id: "trigger", header: "Trigger", sortValue: (a) => a.trigger_type, csv: (a) => a.trigger_type, cell: (a) => <span className="text-ink-muted">{triggerLabel(a.trigger_type)}</span> },
        { id: "threshold", header: "Threshold", align: "right", sortValue: (a) => a.trigger_threshold, cell: (a) => <span className="tabular-nums">{a.trigger_threshold.toLocaleString("en-IN")}</span> },
        { id: "points", header: "Points", align: "right", sortValue: (a) => a.rewards_points, cell: (a) => <span className="tabular-nums">{a.rewards_points.toLocaleString("en-IN")}</span> },
        { id: "rarity", header: "Rarity", sortValue: (a) => a.rarity, csv: (a) => a.rarity, cell: (a) => <Tag tone={RARITY_TONE[a.rarity]}>{humanizeStatus(a.rarity)}</Tag> },
        {
            id: "status",
            header: "Status",
            sortValue: (a) => a.is_active,
            csv: (a) => (a.is_active ? "active" : "inactive"),
            cell: (a) => <Tag tone={a.is_active ? "good" : "neutral"}>{a.is_active ? "Active" : "Inactive"}</Tag>,
        },
    ];

    const chips: FilterChip[] = [];
    if (triggerType) chips.push({ key: "trigger", label: chipLabel("Trigger", triggerType, TRIGGER_OPTIONS), onRemove: () => set({ trigger: "" }) });
    if (rarity) chips.push({ key: "rarity", label: chipLabel("Rarity", rarity, RARITY_OPTIONS), onRemove: () => set({ rarity: "" }) });
    if (isActive) chips.push({ key: "active", label: chipLabel("Status", isActive, ACTIVE_OPTIONS), onRemove: () => set({ active: "" }) });

    const openDelete = (a: Achievement) => {
        setHardDelete(false);
        setConfirmDelete(a);
    };

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Trophy}
                title="Achievements"
                description={
                    <>
                        Unlockable achievements, their rules and explorer levels
                        {tab === "list" && data && <span className="text-ink-faint"> · {data.total.toLocaleString("en-IN")} total</span>}
                    </>
                }
                primaryAction={
                    CAN_MANAGE && (
                        <Button variant="primary" icon={Plus} onClick={() => setModal({ achievement: null })}>
                            New achievement
                        </Button>
                    )
                }
            />

            <Tabs<Tab>
                label="Achievement views"
                value={tab}
                onChange={(t) => set({ tab: t })}
                tabs={[
                    { value: "list", label: "Achievements" },
                    { value: "levels", label: "Explorer levels" },
                    { value: "user", label: "Look up a person" },
                ]}
            />

            {tab === "list" && (
                <>
                    <FilterBar
                        chips={chips}
                        onReset={() => set({ trigger: "", rarity: "", active: "" })}
                    >
                        <FilterSelect label="Trigger" value={triggerType} onChange={(v) => set({ trigger: v })} options={TRIGGER_OPTIONS} allLabel="All triggers" />
                        <FilterSelect label="Rarity" value={rarity} onChange={(v) => set({ rarity: v })} options={RARITY_OPTIONS} allLabel="All rarities" />
                        <FilterSelect label="Status" value={isActive} onChange={(v) => set({ active: v })} options={ACTIVE_OPTIONS} allLabel="All statuses" />
                    </FilterBar>

                    <DataTable
                        label="Achievements"
                        rows={achievements}
                        columns={columns}
                        rowKey={(a) => a._id}
                        isLoading={isLoading && !data}
                        isFetching={isFetching && !!data}
                        error={error}
                        onRetry={() => refetch()}
                        empty={{ icon: Trophy, title: "No achievements match these filters.", description: chips.length ? "Try clearing a filter." : undefined }}
                        onRowClick={(a) => navigate(`/achievements/${a._id}`)}
                        rowActions={(a) => (
                            <>
                                <div className="hidden items-center gap-0.5 md:flex">
                                    <IconButton icon={Eye} size="sm" label={`View ${a.title}`} onClick={() => navigate(`/achievements/${a._id}`)} />
                                    {CAN_MANAGE && <IconButton icon={Pencil} size="sm" label={`Edit ${a.title}`} onClick={() => setModal({ achievement: a })} />}
                                    {CAN_MANAGE && (
                                        <IconButton icon={Trash2} size="sm" label={`Delete ${a.title}`} className="hover:bg-bad-soft hover:text-bad" onClick={() => openDelete(a)} />
                                    )}
                                </div>
                                <div className="md:hidden">
                                    <Menu
                                        label={`Actions for ${a.title}`}
                                        triggerVariant="ghost"
                                        size="sm"
                                        items={[
                                            { label: "View", icon: Eye, to: `/achievements/${a._id}` },
                                            { label: "Edit", icon: Pencil, onSelect: () => setModal({ achievement: a }), hidden: !CAN_MANAGE },
                                            { label: "Delete", icon: Trash2, danger: true, onSelect: () => openDelete(a), hidden: !CAN_MANAGE },
                                        ]}
                                    />
                                </div>
                            </>
                        )}
                        storageKey="achievements"
                        exportName="achievements"
                        summary={data ? `${achievements.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                        card={{
                            title: (a) => a.title,
                            subtitle: (a) => `${triggerLabel(a.trigger_type)} · ${a.trigger_threshold}`,
                            fields: ["points", "rarity", "status"],
                        }}
                        footer={data && <Pagination page={data.page} totalPages={data.total_pages} total={data.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />}
                    />
                </>
            )}

            {tab === "levels" && <ExplorerLevelsTable />}

            {tab === "user" && <UserAchievementsLookup userId={state.user} onUserChange={(id) => set({ user: id })} />}

            <AchievementFormModal open={!!modal} achievement={modal?.achievement ?? null} onClose={() => setModal(null)} />

            <ConfirmDialog
                open={!!confirmDelete}
                title={hardDelete ? "Permanently delete achievement?" : "Delete achievement?"}
                description={
                    hardDelete
                        ? `"${confirmDelete?.title ?? ""}" is removed for good.`
                        : `"${confirmDelete?.title ?? ""}" is hidden and can no longer be earned.`
                }
                confirmLabel={hardDelete ? "Delete permanently" : "Delete"}
                tone="danger"
                level={hardDelete ? "type" : "simple"}
                typeToConfirm={confirmDelete?.title.trim() || "DELETE"}
                isPending={deleteMutation.isPending}
                onConfirm={() => confirmDelete && deleteMutation.mutate({ id: confirmDelete._id, hard: hardDelete })}
                onCancel={() => {
                    setConfirmDelete(null);
                    setHardDelete(false);
                }}
            >
                {IS_SUPER && <Checkbox checked={hardDelete} onChange={setHardDelete} label="Delete permanently" hint="Can't be undone." />}
            </ConfirmDialog>
        </div>
    );
}
