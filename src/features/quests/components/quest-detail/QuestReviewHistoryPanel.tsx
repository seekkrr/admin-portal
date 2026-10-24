import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { SectionState } from "@/components/detail/DetailStates";
import { formatDateTime, formatRelative } from "@/utils/date";
import { questsService } from "../../services/quests.service";

const ACTION_STATUS: Record<string, string> = {
    submitted: "pending",
    approved: "approved",
    changes_requested: "changes_requested",
    rejected: "rejected",
    paused: "paused",
    unpaused: "active",
};

/** Submit / approve / request changes / reject / pause steps with their comments. */
export function QuestReviewHistoryPanel({ questId }: { questId: string }) {
    const query = useQuery({
        queryKey: ["quest-review-history", questId],
        queryFn: () => questsService.getReviewHistory(questId),
        retry: false,
    });
    const entries = [...(query.data?.review_history ?? [])].reverse();
    return (
        <Panel title="Review steps" icon={ClipboardCheck} bodyClassName="p-0">
            <SectionState isLoading={query.isLoading} error={query.error} isEmpty={entries.length === 0} emptyText="Not reviewed yet" emptyIcon={ClipboardCheck} onRetry={() => query.refetch()}>
                <ul className="divide-y divide-line">
                    {entries.map((e, i) => (
                        <li key={`${e.action}-${e.commented_at ?? i}`} className="px-4 py-3 sm:px-5">
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusPill status={ACTION_STATUS[e.action] ?? e.action} label={e.action.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())} />
                                <span className="text-xs text-ink-faint" title={formatDateTime(e.commented_at)}>
                                    {formatRelative(e.commented_at)}
                                </span>
                            </div>
                            {e.comment && <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-muted">{e.comment}</p>}
                        </li>
                    ))}
                </ul>
            </SectionState>
        </Panel>
    );
}
