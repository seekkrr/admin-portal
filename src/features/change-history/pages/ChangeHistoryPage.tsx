import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, MessagesSquare, MonitorSmartphone } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Drawer } from "@/components/ui/Modal";
import { Tag } from "@/components/ui/StatusPill";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { IdLink } from "@/components/ui/IdLink";
import { DetailList, DetailRow, Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/States";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { kindOf, shortIdOf } from "@/utils/entity";
import { formatDateTime, formatRelative } from "@/utils/date";
import { auditService, type AuditItem, type AuditSource } from "../services/audit.service";

const PAGE_SIZE = 50;

const TYPE_OPTIONS: FilterOption[] = [
    { value: "user", label: "People" },
    { value: "business", label: "Businesses" },
    { value: "place", label: "Places" },
    { value: "quest", label: "Quests" },
    { value: "region", label: "Regions" },
    { value: "experience", label: "Experiences" },
    { value: "event", label: "Events" },
    { value: "collab", label: "Collabs" },
    { value: "offer", label: "Check-in offers" },
    { value: "category", label: "Categories" },
    { value: "setting", label: "Settings" },
    { value: "thread", label: "Reported chats" },
    { value: "message", label: "Held messages" },
];

const SOURCE_OPTIONS: FilterOption[] = [
    { value: "screen", label: "Screens" },
    { value: "chat", label: "Chat" },
];

const TYPE_LABEL: Record<string, string> = {
    user: "Person",
    business: "Business",
    place: "Place",
    quest: "Quest",
    region: "Region",
    experience: "Experience",
    event: "Event",
    collab: "Collab",
    offer: "Check-in offer",
    category: "Category",
    setting: "Setting",
    thread: "Chat",
    message: "Message",
};

function typeLabel(t: string | null): string {
    if (!t) return "—";
    return TYPE_LABEL[t] ?? t.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function show(value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "on" : "off";
    if (Array.isArray(value)) return value.length === 0 ? "—" : value.every((v) => typeof v !== "object") ? value.join(", ") : JSON.stringify(value);
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function SourceTag({ source }: { source: AuditSource }) {
    return source === "chat" ? (
        <Tag tone="info">
            <MessagesSquare className="h-3 w-3" aria-hidden /> Chat
        </Tag>
    ) : (
        <Tag>
            <MonitorSmartphone className="h-3 w-3" aria-hidden /> Screen
        </Tag>
    );
}

function RecordCell({ item }: { item: AuditItem }) {
    if (!item.entity_id) return <span className="text-ink-muted">{typeLabel(item.entity_type)}</span>;
    const kind = kindOf(item.entity_type);
    return (
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-ink-muted">{typeLabel(item.entity_type)}</span>
            {kind ? (
                <IdLink kind={kind} id={item.entity_id} />
            ) : (
                <span className="font-mono text-xs text-ink-muted" title={item.entity_id}>
                    {item.entity_type === "setting" ? item.entity_id : shortIdOf(item.entity_id)}
                </span>
            )}
        </span>
    );
}

function ActorCell({ item }: { item: AuditItem }) {
    const id = item.actor?.id;
    const name = item.actor?.name || (id ? undefined : "System");
    if (!id) return <span className="text-ink-muted">{name}</span>;
    return <IdLink kind="user" id={id} label={name} />;
}

function ChangesTable({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
    const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
    if (keys.length === 0) return <EmptyState compact title="No field changes were recorded." />;
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        <th scope="col" className="py-2 pr-3">
                            Field
                        </th>
                        <th scope="col" className="py-2 pr-3">
                            Before
                        </th>
                        <th scope="col" className="py-2">
                            After
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-line">
                    {keys.map((k) => (
                        <tr key={k} className="align-top">
                            <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">
                                {k.replace(/_/g, " ")}
                            </th>
                            <td className="max-w-[12rem] break-words py-2 pr-3 text-ink-muted">{show(before?.[k])}</td>
                            <td className="max-w-[12rem] break-words py-2 text-ink">{show(after?.[k])}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/**
 * Change history (Trust and safety): every admin change made on a screen or
 * through the command chat, newest first, from GET /api/v2/admin/audit.
 * Detail pages can link here with ?type=<entity type>&id=<record id>.
 */
export function ChangeHistoryPage() {
    const { state, set, reset } = useUrlState({ type: "", id: "", actor: "", action: "", source: "", page: 1 });
    const type = TYPE_OPTIONS.some((o) => o.value === state.type) ? state.type : "";
    const source = state.source === "screen" || state.source === "chat" ? (state.source as AuditSource) : "";
    const page = Math.max(1, state.page);
    const [recordId, setRecordId] = useDebouncedUrlInput(state.id, (id) => set({ id }, { replace: true }));
    const [action, setAction] = useDebouncedUrlInput(state.action, (a) => set({ action: a }, { replace: true }));
    const [open, setOpen] = useState<AuditItem | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-audit", { type, id: state.id, actor: state.actor, action: state.action, source, page }],
        queryFn: () =>
            auditService.list({
                entity_type: type || undefined,
                entity_id: state.id || undefined,
                actor_id: state.actor || undefined,
                action: state.action || undefined,
                source: source || undefined,
                page,
                page_size: PAGE_SIZE,
            }),
        placeholderData: (prev) => prev,
        retry: false,
    });

    // The source filter is also applied here, for servers that don't filter by source yet.
    const items = (data?.items ?? []).filter((i) => !source || i.source === source);
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const columns: DataColumn<AuditItem>[] = [
        {
            id: "at",
            header: "When",
            hideable: false,
            sortValue: (i) => i.at ?? "",
            csv: (i) => formatDateTime(i.at),
            cell: (i) => (
                <span className="whitespace-nowrap text-ink-muted" title={formatDateTime(i.at)}>
                    {formatRelative(i.at)}
                </span>
            ),
        },
        { id: "actor", header: "Who", sortValue: (i) => i.actor?.name ?? "", csv: (i) => i.actor?.name ?? i.actor?.id ?? "", cell: (i) => <ActorCell item={i} /> },
        {
            id: "summary",
            header: "What changed",
            hideable: false,
            sortValue: (i) => i.summary ?? "",
            className: "min-w-[16rem] max-w-[32rem]",
            cell: (i) => <span className="line-clamp-2 break-words text-ink">{i.summary || i.action || "—"}</span>,
        },
        {
            id: "record",
            header: "Record",
            sortValue: (i) => `${i.entity_type ?? ""} ${i.entity_id ?? ""}`,
            csv: (i) => `${i.entity_type ?? ""}${i.entity_id ? ` ${i.entity_id}` : ""}`,
            cell: (i) => <RecordCell item={i} />,
        },
        { id: "source", header: "Source", sortValue: (i) => i.source, cell: (i) => <SourceTag source={i.source} /> },
        {
            id: "action",
            header: "Action",
            defaultHidden: true,
            sortValue: (i) => i.action ?? "",
            cell: (i) => <span className="font-mono text-xs text-ink-muted">{i.action ?? "—"}</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (type) chips.push({ key: "type", label: chipLabel("Type", type, TYPE_OPTIONS), onRemove: () => set({ type: "" }) });
    if (state.actor) chips.push({ key: "actor", label: "Changed by one person", onRemove: () => set({ actor: "" }) });
    if (state.action) chips.push({ key: "action", label: `Action: ${state.action}`, onRemove: () => set({ action: "" }) });
    if (source) chips.push({ key: "source", label: chipLabel("Source", source, SOURCE_OPTIONS), onRemove: () => set({ source: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={History}
                title="Change history"
                description={
                    <>
                        Who changed what, on a screen or through the chat
                        {data && <span className="text-ink-faint"> · {total.toLocaleString("en-IN")} changes</span>}
                    </>
                }
            />

            <FilterBar
                search={{ value: recordId, onChange: setRecordId, placeholder: "Record ID…", label: "Record ID" }}
                chips={chips}
                onReset={() => {
                    setRecordId("");
                    setAction("");
                    reset();
                }}
            >
                <FilterSelect label="Type" value={type} onChange={(v) => set({ type: v })} options={TYPE_OPTIONS} allLabel="All types" />
                <EntityPicker type="user" variant="filter" label="Changed by" placeholder="Changed by…" value={state.actor} onChange={(id) => set({ actor: id })} />
                <FilterSelect label="Source" value={source} onChange={(v) => set({ source: v })} options={SOURCE_OPTIONS} allLabel="Screens and chat" />
                <input
                    type="text"
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    placeholder="Action (e.g. place.update)"
                    aria-label="Action"
                    className="h-10 w-56 shrink-0 rounded-control border border-line-strong bg-surface px-3 font-mono text-xs text-ink placeholder:font-sans placeholder:text-sm placeholder:text-ink-faint focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
            </FilterBar>

            <DataTable
                label="Change history"
                rows={items}
                columns={columns}
                rowKey={(i) => i.id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{
                    icon: History,
                    title: chips.length || state.id ? "No changes match these filters." : "No changes recorded yet.",
                    description: chips.length || state.id ? "Try clearing a filter." : "Changes made on screens and in the chat show up here.",
                }}
                onRowClick={setOpen}
                storageKey="change-history"
                exportName="change-history"
                summary={data ? `${items.length} of ${total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (i) => i.summary || i.action || "Change",
                    subtitle: (i) => `${i.actor?.name ?? "System"} · ${formatRelative(i.at)}`,
                    fields: ["record", "source"],
                }}
                footer={<Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={(p) => set({ page: p })} />}
            />

            <Drawer open={!!open} onClose={() => setOpen(null)} title="Change" subtitle={open ? formatDateTime(open.at) : undefined}>
                {open && (
                    <>
                        <p className="text-sm leading-relaxed text-ink">{open.summary || open.action}</p>
                        <DetailList>
                            <DetailRow label="Who" value={<ActorCell item={open} />} />
                            <DetailRow label="When" value={`${formatDateTime(open.at)} (${formatRelative(open.at)})`} />
                            <DetailRow label="Record" value={<RecordCell item={open} />} />
                            <DetailRow label="Source" value={<SourceTag source={open.source} />} />
                            <DetailRow label="Action" value={<span className="font-mono text-xs">{open.action ?? "—"}</span>} />
                        </DetailList>
                        <Panel title="Before and after" bodyClassName="p-4">
                            <ChangesTable before={open.before} after={open.after} />
                        </Panel>
                    </>
                )}
            </Drawer>
        </div>
    );
}
