import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AudioLines, BookOpen, CheckCircle2, Eye, Link2, Play, Plus, Trash2 } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { Button, IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tabs } from "@/components/ui/Tabs";
import { Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { runBulk } from "@/hooks/useBulkSelection";
import { formatDate } from "@/utils/date";
import type { EntityKind } from "@/utils/entity";
import { narrativesService } from "../services/narratives.service";
import type { AdminNarrative, NarrativeAttachType, NarrativeStatus, VoicePersona } from "@/types";
import { playVoicePreview, PERSONAS } from "../components/voicePersonas";
import { CreateNarrativeModal } from "../components/CreateNarrativeModal";
import { AudioStatusPill, NarrativeStatusPill } from "../components/NarrativePills";
import { audioStatusLabel, narrativeStatusLabel } from "../components/narrativeStatus";

const CAN_MODERATE_ROLES = ["admin", "super_admin", "moderator"];
const PAGE_SIZE = 20;

const STATUS_OPTIONS: FilterOption[] = [
    { value: "draft", label: "Draft" },
    { value: "under_review", label: "Under review" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "archived", label: "Archived" },
];

const ATTACH_OPTIONS: FilterOption[] = [
    { value: "marker", label: "Place" },
    { value: "quest", label: "Quest" },
    { value: "region", label: "Region" },
];

const ATTACH_KIND: Record<NarrativeAttachType, EntityKind> = { marker: "place", quest: "quest", region: "region" };
const ATTACH_LABEL: Record<NarrativeAttachType, string> = { marker: "Place", quest: "Quest", region: "Region" };

type TabKey = "queue" | "all";
type BulkConfirm = null | "approve" | "delete";

/** Chains (chain_id with more than one member on this page) first, members in order; then the rest. */
function orderByChain(narratives: AdminNarrative[]): { rows: AdminNarrative[]; chainSize: Map<string, number> } {
    const byChain = new Map<string, AdminNarrative[]>();
    const loose: AdminNarrative[] = [];
    for (const n of narratives) {
        if (n.chain_id) {
            const arr = byChain.get(n.chain_id) ?? [];
            arr.push(n);
            byChain.set(n.chain_id, arr);
        } else {
            loose.push(n);
        }
    }
    const rows: AdminNarrative[] = [];
    const chainSize = new Map<string, number>();
    for (const [chainId, members] of byChain.entries()) {
        if (members.length > 1) {
            members.sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
            chainSize.set(chainId, members.length);
            rows.push(...members);
        } else {
            loose.push(...members);
        }
    }
    return { rows: [...rows, ...loose], chainSize };
}

function personaLabel(p: VoicePersona | null): string {
    if (!p) return "";
    return PERSONAS.find((x) => x.id === p)?.label || p.replace(/_/g, " ");
}

export function NarrativesPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const canModerate = !!user?.role?.some((r) => CAN_MODERATE_ROLES.includes(r as string));

    const { state, set } = useUrlState({ tab: "queue", q: "", status: "", attach: "", page: 1 });
    const tab: TabKey = state.tab === "all" ? "all" : "queue";
    const status = (STATUS_OPTIONS.some((o) => o.value === state.status) ? state.status : "") as NarrativeStatus | "";
    const attachType = (ATTACH_OPTIONS.some((o) => o.value === state.attach) ? state.attach : "") as NarrativeAttachType | "";
    const page = Math.max(1, state.page);
    const [searchInput, setSearchInput] = useDebouncedUrlInput(state.q, (q) => set({ q }, { replace: true }));

    const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [confirmBulk, setConfirmBulk] = useState<BulkConfirm>(null);

    // ---- Data ----
    const queue = useQuery({
        queryKey: ["admin-narratives-queue", { page: tab === "queue" ? page : 1 }],
        queryFn: () => narrativesService.reviewQueue(tab === "queue" ? page : 1, PAGE_SIZE),
        staleTime: 60 * 1000,
        placeholderData: (prev) => prev,
    });

    const all = useQuery({
        queryKey: ["admin-narratives", { status, attachType, page, search: state.q }],
        queryFn: () =>
            narrativesService.list({
                page,
                page_size: PAGE_SIZE,
                status: status || undefined,
                attach_type: attachType || undefined,
                search: state.q || undefined,
            }),
        staleTime: 60 * 1000,
        enabled: tab === "all",
        placeholderData: (prev) => prev,
    });

    const active = tab === "queue" ? queue : all;
    const narratives = useMemo(() => active.data?.narratives ?? [], [active.data]);
    const { rows, chainSize } = useMemo(() => (tab === "all" ? orderByChain(narratives) : { rows: narratives, chainSize: new Map<string, number>() }), [narratives, tab]);

    // ---- Mutations ----
    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-narratives-queue"] });
        queryClient.invalidateQueries({ queryKey: ["admin-narratives"] });
    };

    const deleteMutation = useMutation({
        mutationFn: (id: string) => narrativesService.remove(id),
        onSuccess: () => {
            toast.success("Narrative deleted");
            invalidate();
            setConfirmDelete(null);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const bulkApprove = useMutation({
        mutationFn: (ids: string[]) => narrativesService.bulkApprove(ids),
        onSuccess: (res, ids) => {
            invalidate();
            toast.success(`Approved ${res.approved ?? ids.length} narratives`);
            if (res.failed && res.failed.length > 0) toast.error(`${res.failed.length} could not be approved`);
            setSelected(new Set());
            setConfirmBulk(null);
        },
        onError: () => {
            toast.error("Bulk approve failed");
            setConfirmBulk(null);
        },
    });

    const bulkAudio = useMutation({
        mutationFn: (ids: string[]) => runBulk(ids, (id) => narrativesService.generateAudio(id)),
        onSuccess: ({ ok, failed }) => {
            invalidate();
            toast.success(`Queued audio generation for ${ok} narrative${ok === 1 ? "" : "s"}`);
            if (failed > 0) toast.error(`${failed} could not be queued`);
            setSelected(new Set());
        },
        onError: () => toast.error("Bulk audio generation failed"),
    });

    const bulkDelete = useMutation({
        mutationFn: (ids: string[]) => runBulk(ids, (id) => narrativesService.remove(id)),
        onSuccess: ({ ok, failed }) => {
            invalidate();
            toast.success(`Deleted ${ok} narrative${ok === 1 ? "" : "s"}`);
            if (failed > 0) toast.error(`${failed} could not be deleted`);
            setSelected(new Set());
            setConfirmBulk(null);
        },
        onError: () => {
            toast.error("Bulk delete failed");
            setConfirmBulk(null);
        },
    });

    const busy = bulkApprove.isPending || bulkAudio.isPending || bulkDelete.isPending;
    const count = selected.size;
    const plural = count === 1 ? "narrative" : "narratives";

    const changeTab = (next: TabKey) => {
        setSelected(new Set());
        set({ tab: next, page: 1 });
    };

    // ---- Columns ----
    const columns: DataColumn<AdminNarrative>[] = [
        {
            id: "title",
            header: "Title",
            hideable: false,
            sortValue: (n) => n.title,
            csv: (n) => n.title,
            cell: (n) => {
                const size = n.chain_id ? chainSize.get(n.chain_id) : undefined;
                return (
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {n.chain_id && (
                                <Tag tone="brand" title={size ? `Part of a chain of ${size}` : "Part of a chain"}>
                                    <Link2 className="h-3 w-3" aria-hidden />
                                    {n.sequence_order !== null ? `#${n.sequence_order}` : "Chain"}
                                    {size ? ` of ${size}` : ""}
                                </Tag>
                            )}
                            <Link to={`/narratives/${n._id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                                {n.title || "Untitled"}
                            </Link>
                        </div>
                        {n.subtitle && <div className="mt-0.5 max-w-[320px] truncate text-xs text-ink-muted">{n.subtitle}</div>}
                    </div>
                );
            },
        },
        {
            id: "attach",
            header: "Attached to",
            sortValue: (n) => n.attach_type,
            csv: (n) => `${n.attach_type}:${n.attach_id}`,
            cell: (n) => (
                <span className="inline-flex items-center gap-1.5">
                    <Tag>{ATTACH_LABEL[n.attach_type] ?? n.attach_type}</Tag>
                    <IdLink kind={ATTACH_KIND[n.attach_type] ?? "place"} id={n.attach_id} />
                </span>
            ),
        },
        {
            id: "status",
            header: "Status",
            sortValue: (n) => n.status,
            csv: (n) => narrativeStatusLabel(n.status),
            cell: (n) => <NarrativeStatusPill status={n.status} />,
        },
        {
            id: "voice",
            header: "Voice",
            sortValue: (n) => personaLabel(n.voice_persona),
            csv: (n) => personaLabel(n.voice_persona),
            cell: (n) =>
                n.voice_persona ? (
                    <Button size="sm" variant="ghost" icon={Play} onClick={() => playVoicePreview(n.voice_persona as VoicePersona)} title="Play voice sample" className="-ml-2">
                        {personaLabel(n.voice_persona)}
                    </Button>
                ) : (
                    <span className="text-ink-faint">—</span>
                ),
        },
        {
            id: "audio",
            header: "Audio",
            sortValue: (n) => n.audio_status,
            csv: (n) => audioStatusLabel(n.audio_status),
            cell: (n) => <AudioStatusPill status={n.audio_status} />,
        },
        { id: "views", header: "Views", align: "right", sortValue: (n) => n.view_count, cell: (n) => <span className="tabular-nums text-ink-muted">{n.view_count}</span> },
        {
            id: "created",
            header: "Created",
            sortValue: (n) => n.created_at ?? "",
            csv: (n) => formatDate(n.created_at),
            cell: (n) => <span className="whitespace-nowrap text-ink-muted">{formatDate(n.created_at)}</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (attachType) chips.push({ key: "attach", label: chipLabel("Attached to", attachType, ATTACH_OPTIONS), onRemove: () => set({ attach: "" }) });
    if (status) chips.push({ key: "status", label: chipLabel("Status", status, STATUS_OPTIONS), onRemove: () => set({ status: "" }) });

    const total = active.data?.total ?? 0;
    const totalPages = active.data?.total_pages ?? 1;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={BookOpen}
                title="Narratives"
                description="Review, moderate and publish the stories attached to places, quests and regions"
                primaryAction={
                    canModerate && (
                        <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
                            New narrative
                        </Button>
                    )
                }
            />

            <Tabs<TabKey>
                label="Narrative views"
                tabs={[
                    { value: "queue", label: "Review queue", count: queue.data?.total },
                    { value: "all", label: "All narratives" },
                ]}
                value={tab}
                onChange={changeTab}
            />

            {tab === "all" && (
                <FilterBar
                    search={{ value: searchInput, onChange: setSearchInput, placeholder: "Search narratives…" }}
                    chips={chips}
                    onReset={() => {
                        setSearchInput("");
                        set({ q: "", status: "", attach: "", page: 1 });
                    }}
                >
                    <FilterSelect label="Attached to" value={attachType} onChange={(v) => set({ attach: v })} options={ATTACH_OPTIONS} allLabel="All types" />
                    <FilterSelect label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} allLabel="All statuses" />
                </FilterBar>
            )}

            <DataTable
                label={tab === "queue" ? "Narratives waiting for review" : "Narratives"}
                rows={rows}
                columns={columns}
                rowKey={(n) => n._id}
                isLoading={active.isLoading && !active.data}
                isFetching={active.isFetching && !!active.data}
                error={active.error}
                onRetry={() => active.refetch()}
                empty={
                    tab === "queue"
                        ? { icon: CheckCircle2, title: "The review queue is empty.", description: "You're up to date." }
                        : { icon: BookOpen, title: "No narratives found.", description: chips.length || state.q ? "Try clearing a filter." : undefined }
                }
                onRowClick={(n) => navigate(`/narratives/${n._id}`)}
                selectedIds={canModerate ? selected : undefined}
                onSelectionChange={canModerate ? setSelected : undefined}
                bulkActions={[
                    { label: "Approve", icon: CheckCircle2, onClick: () => setConfirmBulk("approve") },
                    { label: "Generate audio", icon: AudioLines, onClick: (ids) => bulkAudio.mutate(ids) },
                    { label: "Delete", icon: Trash2, tone: "danger", onClick: () => setConfirmBulk("delete") },
                ]}
                bulkBusy={busy}
                rowActions={(n) => (
                    <>
                        <IconButton icon={Eye} size="sm" label={`Open ${n.title || "narrative"}`} onClick={() => navigate(`/narratives/${n._id}`)} />
                        {canModerate && (
                            <IconButton
                                icon={Trash2}
                                size="sm"
                                label={`Delete ${n.title || "narrative"}`}
                                className="hover:bg-bad-soft hover:text-bad"
                                onClick={() => setConfirmDelete({ id: n._id, name: n.title || "this narrative" })}
                            />
                        )}
                    </>
                )}
                storageKey="narratives"
                exportName={tab === "queue" ? "narrative-review-queue" : "narratives"}
                summary={
                    active.data
                        ? tab === "queue"
                            ? `${total.toLocaleString("en-IN")} waiting for review`
                            : `${rows.length} of ${total.toLocaleString("en-IN")}`
                        : undefined
                }
                card={{
                    title: (n) => n.title || "Untitled",
                    subtitle: (n) => n.subtitle ?? undefined,
                    fields: ["status", "attach", "audio", "created"],
                }}
                footer={<Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={(p) => set({ page: p })} />}
            />

            <ConfirmDialog
                open={!!confirmDelete}
                title="Delete narrative?"
                description={`"${confirmDelete?.name ?? ""}" disappears from the app and the admin lists.`}
                confirmLabel="Delete"
                tone="danger"
                onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
                onCancel={() => setConfirmDelete(null)}
                isPending={deleteMutation.isPending}
            />

            <ConfirmDialog
                open={confirmBulk === "approve"}
                title={`Approve ${count} ${plural}?`}
                description={
                    tab === "queue"
                        ? "Approved narratives become publicly visible immediately."
                        : "Only those under review will change; approved narratives become publicly visible."
                }
                confirmLabel={`Approve ${count}`}
                onConfirm={() => bulkApprove.mutate(Array.from(selected))}
                onCancel={() => setConfirmBulk(null)}
                isPending={bulkApprove.isPending}
            />
            <ConfirmDialog
                open={confirmBulk === "delete"}
                title={`Delete ${count} ${plural}?`}
                description="They disappear from the app and the admin lists."
                confirmLabel={`Delete ${count}`}
                tone="danger"
                onConfirm={() => bulkDelete.mutate(Array.from(selected))}
                onCancel={() => setConfirmBulk(null)}
                isPending={bulkDelete.isPending}
            />

            <CreateNarrativeModal open={createOpen} onClose={() => setCreateOpen(false)} />
        </div>
    );
}
