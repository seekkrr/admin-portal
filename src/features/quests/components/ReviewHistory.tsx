import { AlertCircle, CheckCircle, MessageSquare, Pause, Play, XCircle, type LucideIcon } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import type { StatusTone } from "@/components/ui/status";
import { IdLink } from "@/components/ui/IdLink";
import { formatDateTime, toDate } from "@/utils/date";
import type { QuestReviewHistoryEntry } from "@/types";

interface ReviewHistoryProps {
    entries: QuestReviewHistoryEntry[];
}

const ACTIONS: Record<string, { icon: LucideIcon; tone: StatusTone; label: string }> = {
    approved: { icon: CheckCircle, tone: "good", label: "Approved" },
    rejected: { icon: XCircle, tone: "bad", label: "Rejected" },
    changes_requested: { icon: AlertCircle, tone: "warn", label: "Changes requested" },
    submitted: { icon: MessageSquare, tone: "info", label: "Submitted" },
    paused: { icon: Pause, tone: "neutral", label: "Paused" },
    unpaused: { icon: Play, tone: "good", label: "Unpaused" },
};

const TONE_TEXT: Record<StatusTone, string> = {
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
    info: "text-info",
    neutral: "text-ink-faint",
    brand: "text-accent-600",
};

function humanize(action: string): string {
    const s = action.replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The review trail of a quest, newest first. */
export function ReviewHistory({ entries }: ReviewHistoryProps) {
    if (entries.length === 0) {
        return <p className="text-sm text-ink-muted">No review actions yet for this quest.</p>;
    }

    const sorted = [...entries].sort((a, b) => (toDate(b.commented_at)?.getTime() ?? 0) - (toDate(a.commented_at)?.getTime() ?? 0));

    return (
        <ol className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
            {sorted.map((entry, i) => {
                const cfg = ACTIONS[entry.action] ?? { icon: MessageSquare, tone: "neutral" as StatusTone, label: humanize(entry.action) };
                const Icon = cfg.icon;
                return (
                    <li key={i} className="space-y-2 rounded-card border border-line bg-surface-muted p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Icon className={`h-4 w-4 shrink-0 ${TONE_TEXT[cfg.tone]}`} aria-hidden />
                                <StatusPill status={entry.action} label={cfg.label} tone={cfg.tone} />
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
                                {entry.commented_by && (
                                    <>
                                        <span>By</span>
                                        <IdLink kind="user" id={entry.commented_by} />
                                        <span aria-hidden>·</span>
                                    </>
                                )}
                                <span>{formatDateTime(entry.commented_at)}</span>
                            </div>
                        </div>
                        {entry.comment && <p className="pl-6 text-sm leading-relaxed text-ink">“{entry.comment}”</p>}
                    </li>
                );
            })}
        </ol>
    );
}
