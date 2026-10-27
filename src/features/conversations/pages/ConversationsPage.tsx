import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Drawer } from "@/components/ui/Modal";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { PanelState } from "@/components/ui/States";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDateTime, formatRelative } from "@/utils/date";
import { cx } from "@/utils/cx";
import { errorMessage } from "@/utils/errors";
import { ChatMessageBody } from "@/features/held-messages/components/ChatMessageBody";
import { sideLabel } from "@/features/held-messages/components/sideLabel";
import { conversationsService, type ConversationMessage, type ConversationRow } from "../services/conversations.service";

const READ_ONLY: Record<string, string> = {
    blocked: "One side blocked the other",
    reviews_done: "Closed after both reviews",
    closed: "Closed 30 days after the collab ended",
};

function Bubble({ m }: { m: ConversationMessage }) {
    const right = m.side === "business";
    return (
        <li className={cx("flex", m.side === "system" ? "justify-center" : right ? "justify-end" : "justify-start")}>
            <div
                className={cx(
                    "max-w-[85%] rounded-card border px-3 py-2 text-sm",
                    m.side === "system" ? "border-line bg-surface-muted text-ink-muted" : right ? "border-accent-200 bg-accent-50" : "border-line bg-surface",
                    m.removed && "opacity-60"
                )}
            >
                <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                    <span className="font-semibold text-ink-muted">{m.sender_name ?? sideLabel(m.side)}</span>
                    {m.side !== "system" && <span>{sideLabel(m.side)}</span>}
                    <span>{formatDateTime(m.created_at)}</span>
                    {m.held && !m.removed && <Tag tone="warn">Held</Tag>}
                    {m.removed && <Tag tone="bad">Removed</Tag>}
                    {m.masked && <Tag>Contacts hidden</Tag>}
                </div>
                <ChatMessageBody m={m} />
            </div>
        </li>
    );
}

/** One chat, oldest first, with older messages a click away. */
function ConversationDrawer({ threadId, onClose }: { threadId: string | null; onClose: () => void }) {
    const [older, setOlder] = useState<ConversationMessage[]>([]);
    const [olderDone, setOlderDone] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const q = useQuery({
        queryKey: ["conversation", threadId],
        queryFn: () => conversationsService.get(threadId ?? ""),
        enabled: !!threadId,
        retry: false,
    });
    const close = () => {
        setOlder([]);
        setOlderDone(false);
        onClose();
    };
    const loadOlder = async () => {
        const oldest = older[0]?.id ?? q.data?.messages[0]?.id;
        if (!threadId || !oldest) return;
        setLoadingOlder(true);
        try {
            const page = await conversationsService.get(threadId, oldest);
            setOlder((prev) => [...page.messages, ...prev]);
            if (!page.has_more) setOlderDone(true);
        } catch (e) {
            toast.error(errorMessage(e));
        } finally {
            setLoadingOlder(false);
        }
    };
    const t = q.data?.thread;
    const messages = [...older, ...(q.data?.messages ?? [])];
    const hasMore = olderDone ? false : older.length ? true : !!q.data?.has_more;
    return (
        <Drawer
            open={!!threadId}
            onClose={close}
            title={t ? `${t.business.name ?? "Business"} · ${t.creator.name}` : "Chat"}
            subtitle="Read-only. The business and creator don't see that you opened it; it is recorded in the change history."
        >
            <PanelState isLoading={q.isLoading} error={q.error} isEmpty={!t} emptyText="This chat doesn't exist any more." onRetry={() => q.refetch()}>
                {t && (
                    <div className="space-y-4">
                        <dl className="grid gap-2 rounded-card border border-line bg-surface-muted p-3 text-sm sm:grid-cols-2">
                            <div>
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Business team</dt>
                                <dd className="text-ink">{t.business.team.map((p) => `${p.name} (${p.role ?? "member"})`).join(", ") || "—"}</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Creator</dt>
                                <dd className="text-ink">{t.creator.name}</dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Collabs in this chat</dt>
                                <dd className="mt-1 flex flex-wrap gap-1.5">
                                    {t.collabs.map((c) => (
                                        <span key={c.application_id} className="flex items-center gap-1.5 text-ink">
                                            {c.offer ?? "Collab"} <StatusPill status={c.status} />
                                        </span>
                                    ))}
                                </dd>
                            </div>
                            {t.read_only && (
                                <div className="sm:col-span-2">
                                    <Tag tone="neutral">{READ_ONLY[t.read_only] ?? "Read-only"}</Tag>
                                </div>
                            )}
                        </dl>
                        {hasMore && (
                            <div className="flex justify-center">
                                <Button size="sm" loading={loadingOlder} onClick={loadOlder}>
                                    Load older messages
                                </Button>
                            </div>
                        )}
                        <ol className="space-y-3">
                            {messages.map((m) => (
                                <Bubble key={m.id} m={m} />
                            ))}
                        </ol>
                    </div>
                )}
            </PanelState>
        </Drawer>
    );
}

/**
 * Conversations (Trust and safety, admins only): every business–creator collab
 * chat, newest activity first. Open one to read it in full, held and removed
 * messages included.
 */
export function ConversationsPage() {
    const [search, setSearch] = useState("");
    const q = useDebouncedValue(search.trim(), 350);
    const [open, setOpen] = useState<string | null>(null);

    const list = useInfiniteQuery({
        queryKey: ["conversations", q],
        queryFn: ({ pageParam }) => conversationsService.list({ q, before: pageParam }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (last) => (last.has_more ? last.threads[last.threads.length - 1]?.last_message_at ?? undefined : undefined),
        retry: false,
    });
    const rows = list.data?.pages.flatMap((p) => p.threads) ?? [];

    const columns: DataColumn<ConversationRow>[] = [
        {
            id: "pair",
            header: "Business · Creator",
            hideable: false,
            sortValue: (r) => r.business.name ?? "",
            csv: (r) => `${r.business.name ?? ""} · ${r.creator?.name ?? ""}`,
            cell: (r) => (
                <span className="flex flex-col">
                    <span className="font-medium text-ink">{r.business.name ?? "Business"}</span>
                    <span className="text-ink-muted">{r.creator?.name ?? "Creator"}</span>
                </span>
            ),
        },
        {
            id: "latest",
            header: "Latest message",
            className: "min-w-[14rem] max-w-[26rem]",
            csv: (r) => r.last_preview,
            cell: (r) => (
                <span className="flex flex-col gap-0.5">
                    <span className="line-clamp-2 break-words text-ink">{r.last_preview ?? "—"}</span>
                    {r.last_sender_side && <span className="text-[11px] text-ink-faint">{sideLabel(r.last_sender_side)}</span>}
                </span>
            ),
        },
        {
            id: "collab",
            header: "Collab",
            sortValue: (r) => r.status ?? "",
            csv: (r) => `${r.offer ?? ""} (${r.status ?? ""})`,
            cell: (r) => (
                <span className="flex flex-col gap-1">
                    <span className="text-ink-muted">{r.offer ?? "—"}</span>
                    <span className="flex items-center gap-1.5">
                        <StatusPill status={r.status} />
                        {r.collab_count > 1 && <span className="text-[11px] text-ink-faint">+{r.collab_count - 1} more</span>}
                    </span>
                </span>
            ),
        },
        {
            id: "messages",
            header: "Messages",
            sortValue: (r) => r.messages,
            csv: (r) => String(r.messages),
            cell: (r) => (
                <span className="flex items-center gap-1.5 tabular-nums text-ink">
                    {r.messages}
                    {r.held > 0 && <Tag tone="warn">{r.held} held</Tag>}
                </span>
            ),
        },
        {
            id: "at",
            header: "Last activity",
            sortValue: (r) => r.last_message_at ?? "",
            csv: (r) => formatDateTime(r.last_message_at),
            cell: (r) => (
                <span className="whitespace-nowrap text-ink-muted" title={formatDateTime(r.last_message_at)}>
                    {formatRelative(r.last_message_at)}
                </span>
            ),
        },
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                icon={MessageCircle}
                title="Conversations"
                description="Chats between businesses and creators. Read-only; opening one is recorded in the change history."
                actions={
                    <Button icon={RefreshCw} loading={list.isFetching && !!list.data && !list.isFetchingNextPage} onClick={() => list.refetch()}>
                        Refresh
                    </Button>
                }
            />

            <FilterBar search={{ value: search, onChange: setSearch, placeholder: "Business or creator name…", label: "Search chats" }} onReset={() => setSearch("")} />

            <DataTable
                label="Conversations"
                rows={rows}
                columns={columns}
                rowKey={(r) => r.id}
                isLoading={list.isLoading}
                isFetching={list.isFetching && !!list.data}
                error={list.error}
                onRetry={() => list.refetch()}
                empty={{ icon: MessageCircle, title: q ? "No chats match that name." : "No chats yet." }}
                onRowClick={(r) => setOpen(r.id)}
                storageKey="conversations"
                exportName="conversations"
                summary={list.data ? `${rows.length} chat${rows.length === 1 ? "" : "s"}${list.hasNextPage ? " (more below)" : ""}` : undefined}
                footer={
                    list.hasNextPage ? (
                        <div className="flex justify-center py-2">
                            <Button size="sm" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                                Load more
                            </Button>
                        </div>
                    ) : undefined
                }
                card={{
                    title: (r) => `${r.business.name ?? "Business"} · ${r.creator?.name ?? "Creator"}`,
                    subtitle: (r) => `${r.last_preview ?? ""} · ${formatRelative(r.last_message_at)}`,
                    fields: ["collab", "messages"],
                }}
            />

            <ConversationDrawer threadId={open} onClose={() => setOpen(null)} />
        </div>
    );
}
