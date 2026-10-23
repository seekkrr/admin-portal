import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, MessageSquareWarning, MessagesSquare, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Modal";
import { Tag } from "@/components/ui/StatusPill";
import { PanelState } from "@/components/ui/States";
import { runBulk } from "@/hooks/useBulkSelection";
import { formatDateTime, formatRelative } from "@/utils/date";
import { shortIdOf } from "@/utils/entity";
import { errorMessage } from "@/utils/errors";
import { cx } from "@/utils/cx";
import { heldMessagesService, type ChatMessage, type HeldDecision } from "../services/held-messages.service";

const SIDE_LABEL: Record<string, string> = { creator: "Creator", business: "Business", system: "SeekKrr" };

function sideLabel(side: string | null): string {
    return (side && SIDE_LABEL[side]) || "Member";
}

function MessageBody({ m, clamp }: { m: ChatMessage; clamp?: boolean }) {
    return (
        <div className="min-w-0 space-y-1.5">
            {m.body ? (
                <p className={cx("whitespace-pre-wrap break-words text-ink", clamp && "line-clamp-3")}>{m.body}</p>
            ) : (
                !m.media_url && <p className="italic text-ink-faint">{m.type === "location" ? "Shared a location" : "No text"}</p>
            )}
            {m.media_url && (
                <a href={m.media_url} target="_blank" rel="noreferrer" className="block w-fit">
                    <img src={m.media_url} alt="Attached photo" className="h-20 w-20 rounded-lg border border-line object-cover" />
                </a>
            )}
        </div>
    );
}

/** One collab chat (opened from a held message). */
function ThreadDrawer({ threadId, focusId, onClose }: { threadId: string | null; focusId: string | null; onClose: () => void }) {
    const q = useQuery({
        queryKey: ["held-thread", threadId],
        queryFn: () => heldMessagesService.thread(threadId ?? ""),
        enabled: !!threadId,
        retry: false,
    });
    return (
        <Drawer open={!!threadId} onClose={onClose} title="Chat" subtitle={threadId ? `Chat ${shortIdOf(threadId)} · opening it is recorded in the change history` : undefined}>
            <PanelState isLoading={q.isLoading} error={q.error} isEmpty={(q.data?.messages.length ?? 0) === 0} emptyText="No messages in this chat." onRetry={() => q.refetch()}>
                <ol className="space-y-3">
                    {(q.data?.messages ?? []).map((m) => {
                        const right = m.side === "business";
                        return (
                            <li key={m.id} className={cx("flex", right ? "justify-end" : "justify-start", m.side === "system" && "justify-center")}>
                                <div
                                    className={cx(
                                        "max-w-[85%] rounded-card border px-3 py-2 text-sm",
                                        m.side === "system" ? "border-line bg-surface-muted text-ink-muted" : right ? "border-accent-200 bg-accent-50" : "border-line bg-surface",
                                        m.id === focusId && "ring-2 ring-highlight"
                                    )}
                                >
                                    <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                                        <span className="font-semibold text-ink-muted">{m.sender_name ?? sideLabel(m.side)}</span>
                                        <span>{formatDateTime(m.created_at)}</span>
                                        {m.held && <Tag tone="warn">Held</Tag>}
                                        {m.masked && <Tag>Masked</Tag>}
                                    </div>
                                    <MessageBody m={m} />
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </PanelState>
        </Drawer>
    );
}

/**
 * Held chat messages (Trust and safety): collab chat messages the filter held
 * back (phone numbers, links, abuse). Release sends them on to the chat;
 * Remove deletes them for both sides.
 */
export function HeldMessagesPage() {
    const queryClient = useQueryClient();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [deciding, setDeciding] = useState<{ ids: string[]; decision: HeldDecision } | null>(null);
    const [thread, setThread] = useState<{ threadId: string; focusId: string } | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["held-messages"],
        queryFn: () => heldMessagesService.list(),
        refetchOnWindowFocus: true,
        retry: false,
    });

    const decide = useMutation({
        mutationFn: ({ ids, decision }: { ids: string[]; decision: HeldDecision }) => runBulk(ids, (id) => heldMessagesService.review(id, decision)),
        onSuccess: ({ ok, failed }, { decision }) => {
            queryClient.invalidateQueries({ queryKey: ["held-messages"] });
            queryClient.invalidateQueries({ queryKey: ["today"] });
            if (ok) toast.success(`${decision === "release" ? "Released" : "Removed"} ${ok} message${ok === 1 ? "" : "s"}`);
            if (failed) toast.error(`${failed} couldn't be ${decision === "release" ? "released" : "removed"} (already reviewed?)`);
            setSelected(new Set());
            setDeciding(null);
        },
        onError: (e) => {
            toast.error(errorMessage(e));
            setDeciding(null);
        },
    });

    const messages = data ?? [];

    const columns: DataColumn<ChatMessage>[] = [
        {
            id: "message",
            header: "Message",
            hideable: false,
            sortValue: (m) => m.body ?? "",
            className: "min-w-[16rem] max-w-[30rem]",
            cell: (m) => <MessageBody m={m} clamp />,
        },
        {
            id: "sender",
            header: "From",
            sortValue: (m) => m.sender_name ?? "",
            csv: (m) => `${m.sender_name ?? ""} (${sideLabel(m.side)})`,
            cell: (m) => (
                <span className="flex flex-col gap-1">
                    <span className="font-medium text-ink">{m.sender_name ?? "—"}</span>
                    <Tag tone={m.side === "business" ? "brand" : "neutral"} className="w-fit">
                        {sideLabel(m.side)}
                    </Tag>
                </span>
            ),
        },
        {
            id: "at",
            header: "Sent",
            sortValue: (m) => m.created_at ?? "",
            csv: (m) => formatDateTime(m.created_at),
            cell: (m) => (
                <span className="whitespace-nowrap text-ink-muted" title={formatDateTime(m.created_at)}>
                    {formatRelative(m.created_at)}
                </span>
            ),
        },
        {
            id: "collab",
            header: "Collab request",
            defaultHidden: true,
            csv: (m) => m.application_id,
            cell: (m) => (m.application_id ? <span className="font-mono text-xs text-ink-muted" title={m.application_id}>{shortIdOf(m.application_id)}</span> : <span className="text-ink-faint">—</span>),
        },
    ];

    const count = deciding?.ids.length ?? 0;
    const plural = count === 1 ? "message" : `${count} messages`;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={MessageSquareWarning}
                title="Held messages"
                description={
                    <>
                        Collab chat messages the filter held back
                        {data && <span className="text-ink-faint"> · {messages.length} waiting</span>}
                    </>
                }
                actions={
                    <Button icon={RefreshCw} loading={isFetching && !!data} onClick={() => refetch()}>
                        Refresh
                    </Button>
                }
            />

            <DataTable
                label="Held messages"
                rows={messages}
                columns={columns}
                rowKey={(m) => m.id}
                isLoading={isLoading}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: Check, title: "No held messages. You're up to date." }}
                selectedIds={selected}
                onSelectionChange={setSelected}
                bulkActions={[
                    { label: "Release", icon: Check, onClick: (ids) => setDeciding({ ids, decision: "release" }) },
                    { label: "Remove", icon: Trash2, tone: "danger", onClick: (ids) => setDeciding({ ids, decision: "remove" }) },
                ]}
                bulkBusy={decide.isPending}
                rowActions={(m) => (
                    <>
                        {m.thread_id && (
                            <IconButton icon={MessagesSquare} size="sm" label="Open the chat" onClick={() => setThread({ threadId: m.thread_id as string, focusId: m.id })} />
                        )}
                        <IconButton icon={Check} size="sm" label="Release to the chat" className="hover:bg-good-soft hover:text-good" onClick={() => setDeciding({ ids: [m.id], decision: "release" })} />
                        <IconButton icon={Trash2} size="sm" label="Remove" className="hover:bg-bad-soft hover:text-bad" onClick={() => setDeciding({ ids: [m.id], decision: "remove" })} />
                    </>
                )}
                storageKey="held-messages"
                exportName="held-messages"
                summary={data ? `${messages.length} held (newest 50)` : undefined}
                card={{ title: (m) => <MessageBody m={m} clamp />, subtitle: (m) => `${m.sender_name ?? sideLabel(m.side)} · ${formatRelative(m.created_at)}`, fields: [] }}
            />

            <ConfirmDialog
                open={!!deciding}
                title={deciding?.decision === "release" ? `Release ${plural}?` : `Remove ${plural}?`}
                description={
                    deciding?.decision === "release"
                        ? "They are delivered to the chat as they were written."
                        : "They are deleted and the other side never sees them."
                }
                confirmLabel={deciding?.decision === "release" ? "Release" : "Remove"}
                tone={deciding?.decision === "release" ? "primary" : "danger"}
                isPending={decide.isPending}
                onConfirm={() => deciding && decide.mutate(deciding)}
                onCancel={() => setDeciding(null)}
            />

            <ThreadDrawer threadId={thread?.threadId ?? null} focusId={thread?.focusId ?? null} onClose={() => setThread(null)} />
        </div>
    );
}
