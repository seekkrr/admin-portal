import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowRight, History, MessageSquare, MonitorSmartphone } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/StatusPill";
import { auditApi } from "@/services/admin-detail.service";
import { formatDateTime, formatRelative } from "@/utils/date";
import type { AuditEntityType, AuditEntry } from "@/types/admin-detail";
import { SectionState } from "./DetailStates";

const PAGE_SIZE = 20;
const MAX_FIELDS = 8;

function show(value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "on" : "off";
    if (Array.isArray(value)) {
        if (value.length === 0) return "—";
        if (value.every((v) => typeof v !== "object")) return value.join(", ");
        return `${value.length} item${value.length === 1 ? "" : "s"}`;
    }
    if (typeof value === "object") {
        const json = JSON.stringify(value);
        return json.length > 80 ? `${json.slice(0, 77)}…` : json;
    }
    const s = String(value);
    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}

function label(key: string): string {
    const s = key.replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Changed fields of one entry: before → after. */
function changes(entry: AuditEntry): { key: string; before: string; after: string }[] {
    const before = entry.before ?? {};
    const after = entry.after ?? {};
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    return keys
        .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
        .map((k) => ({ key: k, before: show(before[k]), after: show(after[k]) }));
}

function EntryRow({ entry }: { entry: AuditEntry }) {
    const diff = changes(entry);
    const shown = diff.slice(0, MAX_FIELDS);
    const chat = entry.source === "chat";
    const who = entry.actor?.name || (entry.actor?.id ? `User ${entry.actor.id.slice(-6)}` : "System");
    return (
        <li className="px-4 py-3.5 sm:px-5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {entry.actor?.id ? (
                    <Link to={`/users/${entry.actor.id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                        {who}
                    </Link>
                ) : (
                    <span className="font-medium text-ink">{who}</span>
                )}
                <span className="text-ink-muted">{entry.summary || label(entry.action.replace(/\./g, " "))}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                <time dateTime={entry.at ?? undefined} title={formatDateTime(entry.at)}>
                    {formatRelative(entry.at)}
                </time>
                <Tag tone={chat ? "info" : "neutral"}>
                    {chat ? <MessageSquare className="h-3 w-3" aria-hidden /> : <MonitorSmartphone className="h-3 w-3" aria-hidden />}
                    {chat ? "Command chat" : "Portal screen"}
                </Tag>
                <span className="font-mono">{entry.action}</span>
            </div>
            {shown.length > 0 && (
                <dl className="mt-2 space-y-1 rounded-control bg-surface-muted px-3 py-2 text-xs">
                    {shown.map((c) => (
                        <div key={c.key} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <dt className="font-medium text-ink-muted">{label(c.key)}:</dt>
                            <dd className="flex min-w-0 flex-wrap items-center gap-1.5 text-ink">
                                <span className="break-all text-ink-faint line-through decoration-ink-faint/60">{c.before}</span>
                                <ArrowRight className="h-3 w-3 shrink-0 text-ink-faint" aria-label="changed to" />
                                <span className="break-all">{c.after}</span>
                            </dd>
                        </div>
                    ))}
                    {diff.length > shown.length && <p className="text-ink-faint">+{diff.length - shown.length} more fields</p>}
                </dl>
            )}
        </li>
    );
}

/** "Change history" tab: who changed what and when, from screens and the command chat. */
export function ChangeHistoryPanel({ entityType, entityId }: { entityType: AuditEntityType; entityId: string }) {
    const query = useInfiniteQuery({
        queryKey: ["admin-audit", entityType, entityId],
        queryFn: ({ pageParam }) => auditApi.list({ entity_type: entityType, entity_id: entityId, page: pageParam, page_size: PAGE_SIZE }),
        initialPageParam: 1,
        getNextPageParam: (last, all) => {
            const loaded = all.reduce((n, p) => n + p.items.length, 0);
            return loaded < last.total && last.items.length > 0 ? all.length + 1 : undefined;
        },
        enabled: !!entityId,
        staleTime: 30_000,
    });
    const items = query.data?.pages.flatMap((p) => p.items) ?? [];
    const total = query.data?.pages[0]?.total ?? 0;

    return (
        <Panel
            title="Change history"
            icon={History}
            description={total ? `${total.toLocaleString("en-IN")} change${total === 1 ? "" : "s"} recorded` : "Every change made from the portal or the command chat"}
            bodyClassName="p-0"
        >
            <SectionState
                isLoading={query.isLoading}
                error={query.error}
                isEmpty={items.length === 0}
                emptyText="No changes recorded yet"
                emptyIcon={History}
                what="The change history"
                onRetry={() => query.refetch()}
            >
                <ul className="divide-y divide-line">
                    {items.map((entry) => (
                        <EntryRow key={entry.id} entry={entry} />
                    ))}
                </ul>
                {query.hasNextPage && (
                    <div className="border-t border-line px-4 py-3 text-center">
                        <Button size="sm" variant="secondary" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>
                            Show older changes
                        </Button>
                    </div>
                )}
            </SectionState>
        </Panel>
    );
}
